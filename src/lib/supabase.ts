/* Offline-first database backed by IndexedDB.
   Existing localStorage data is copied once, and kept untouched as a safety backup. */
type Row = Record<string, any>;
type DB = Record<string, Row[]>;
const KEY = 'crane_accounting_offline_db_v2';
const TABLES = ['equipment','customers','jobs','expenses','payments','invoices','monthly_equipment_days','settings','job_types'];
const IDB_NAME = 'crane_accounting_indexed_db_v1';
const STORE = 'database';
let queue: Promise<unknown> = Promise.resolve();

function initialDB(): DB {
  const db: DB = Object.fromEntries(TABLES.map(t => [t, []]));
  db.job_types = ['مشوار','ساعة','يومية','أسبوع','شهري'].map((name, i) => ({id:`jt-${i+1}`, name, created_at:new Date().toISOString()}));
  return db;
}
function uid() { return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`); }
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB غير متاح في هذا الجهاز')); return; }
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('تعذر فتح قاعدة البيانات'));
    request.onblocked = () => reject(new Error('قاعدة البيانات مستخدمة في نافذة أخرى'));
  });
}
async function transaction<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = fn(tx.objectStore(STORE));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error ?? request.error ?? new Error('فشل تخزين البيانات')); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('أُلغي حفظ البيانات')); };
  });
}
async function load(): Promise<DB> {
  const existing = await transaction('readonly', store => store.get('main')) as DB | undefined;
  if (existing) return existing;
  // Import the complete legacy database; never delete or overwrite the original.
  let legacy: DB | undefined;
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try { legacy = JSON.parse(raw) as DB; }
    catch { throw new Error('تعذر قراءة النسخة القديمة؛ لم يتم حذف أي بيانات'); }
  }
  const db = legacy ?? initialDB();
  for (const table of TABLES) if (!Array.isArray(db[table])) db[table] = [];
  await transaction('readwrite', store => store.put(db, 'main'));
  return db;
}
async function save(db: DB): Promise<void> {
  await transaction('readwrite', store => store.put(db, 'main'));
}
class Query {
  table: string; op='select'; payload:any=null; filters:Array<[string,string,any]>=[]; orderBy?:[string,boolean];
  constructor(table:string){this.table=table;}
  select(_cols='*'){ if(this.op==='select') this.op='select'; return this; }
  insert(v:any){this.op='insert'; this.payload=v; return this;}
  update(v:any){this.op='update'; this.payload=v; return this;}
  delete(){this.op='delete'; return this;}
  upsert(v:any,_opts?:any){this.op='upsert'; this.payload=v; return this;}
  eq(k:string,v:any){this.filters.push([k,'eq',v]); return this;}
  neq(k:string,v:any){this.filters.push([k,'neq',v]); return this;}
  gte(k:string,v:any){this.filters.push([k,'gte',v]); return this;}
  lte(k:string,v:any){this.filters.push([k,'lte',v]); return this;}
  order(k:string,o?:{ascending?:boolean}){this.orderBy=[k,o?.ascending!==false]; return this;}
  maybeSingle(){return this.exec(true,false);}
  single(){return this.exec(true,true);}
  then(resolve:any,reject:any){return this.exec(false,false).then(resolve,reject);}
  match(r:Row){return this.filters.every(([k,op,v])=> op==='eq'?r[k]===v:op==='neq'?r[k]!==v:op==='gte'?r[k]>=v:r[k]<=v);}
  async exec(single:boolean, required:boolean){
    // Serialize all operations, including reads, to prevent lost updates.
    const action = async () => {
      try {
        const db=await load(); if(!db[this.table]) db[this.table]=[]; let rows=db[this.table];
        if(this.op==='select'){
          let out=rows.filter(r=>this.match(r));
          if(this.orderBy){const [k,asc]=this.orderBy; out=[...out].sort((a,b)=>String(a[k]??'').localeCompare(String(b[k]??''))*(asc?1:-1));}
          const data=single?(out[0]??null):out; return {data,error:required&&!data?new Error('Not found'):null};
        }
        if(this.op==='insert'){
          const list=Array.isArray(this.payload)?this.payload:[this.payload]; const now=new Date().toISOString();
          const made=list.map((x:any)=>({...x,id:x.id??uid(),created_at:x.created_at??now}));
          db[this.table].push(...made); await save(db);
          return {data:single?made[0]:made,error:null};
        }
        if(this.op==='update'){
          const changed:Row[]=[];
          db[this.table]=rows.map(r=>this.match(r)?(changed.push({...r,...this.payload}),{...r,...this.payload}):r);
          await save(db);
          return {data:single?(changed[0]??null):changed,error:required&&!changed[0]?new Error('Not found'):null};
        }
        if(this.op==='delete'){
          const removed=rows.filter(r=>this.match(r)); db[this.table]=rows.filter(r=>!this.match(r)); await save(db);
          return {data:removed,error:null};
        }
        if(this.op==='upsert'){
          const list=Array.isArray(this.payload)?this.payload:[this.payload]; const made:Row[]=[];
          for(const x of list){
            let idx=-1;
            if(this.table==='settings') idx=rows.findIndex(r=>r.id===x.id);
            else if(this.table==='monthly_equipment_days') idx=rows.findIndex(r=>r.equipment_id===x.equipment_id&&r.date===x.date);
            else if(x.id) idx=rows.findIndex(r=>r.id===x.id);
            const val={...(idx>=0?rows[idx]:{}),...x,id:x.id??(idx>=0?rows[idx].id:uid()),created_at:x.created_at??(idx>=0?rows[idx].created_at:new Date().toISOString())};
            if(idx>=0) rows[idx]=val; else rows.push(val); made.push(val);
          }
          await save(db); return {data:single?made[0]:made,error:null};
        }
        return {data:null,error:null};
      } catch(error){return {data:null,error};}
    };
    const result = queue.then(action, action);
    queue = result.then(() => undefined, () => undefined);
    return result;
  }
}
export const supabase={from:(table:string)=>new Query(table)};
export const OFFLINE_DB_KEY=KEY;
