/* Offline-first local database. No internet or Supabase account is required. */
type Row = Record<string, any>;
type DB = Record<string, Row[]>;
const KEY = 'crane_accounting_offline_db_v2';
const TABLES = ['equipment','customers','jobs','expenses','payments','invoices','monthly_equipment_days','settings','job_types'];

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const db: DB = Object.fromEntries(TABLES.map(t => [t, []]));
  db.job_types = ['مشوار','ساعة','يومية','أسبوع','شهري'].map((name, i) => ({id:`jt-${i+1}`, name, created_at:new Date().toISOString()}));
  save(db); return db;
}
function save(db: DB) { localStorage.setItem(KEY, JSON.stringify(db)); }
function uid() { return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`); }

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
    try {
      const db=load(); if(!db[this.table]) db[this.table]=[]; let rows=db[this.table];
      if(this.op==='select'){
        let out=rows.filter(r=>this.match(r));
        if(this.orderBy){const [k,asc]=this.orderBy; out=[...out].sort((a,b)=>String(a[k]??'').localeCompare(String(b[k]??''))*(asc?1:-1));}
        const data=single?(out[0]??null):out; return {data,error:required&&!data?new Error('Not found'):null};
      }
      if(this.op==='insert'){
        const list=Array.isArray(this.payload)?this.payload:[this.payload]; const now=new Date().toISOString();
        const made=list.map((x:any)=>({...x,id:x.id??uid(),created_at:x.created_at??now})); rows.push(...made); save(db);
        return {data:single?made[0]:made,error:null};
      }
      if(this.op==='update'){
        let changed:Row[]=[]; db[this.table]=rows.map(r=>this.match(r)?(changed.push({...r,...this.payload}),{...r,...this.payload}):r); save(db);
        return {data:single?(changed[0]??null):changed,error:required&&!changed[0]?new Error('Not found'):null};
      }
      if(this.op==='delete'){
        const removed=rows.filter(r=>this.match(r)); db[this.table]=rows.filter(r=>!this.match(r)); save(db); return {data:removed,error:null};
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
        save(db); return {data:single?made[0]:made,error:null};
      }
      return {data:null,error:null};
    } catch(error){return {data:null,error};}
  }
}
export const supabase={from:(table:string)=>new Query(table)};
export const OFFLINE_DB_KEY=KEY;
