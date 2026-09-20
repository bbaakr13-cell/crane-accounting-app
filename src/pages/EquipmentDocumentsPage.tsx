import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, BellRing, CalendarDays, ChevronDown, ChevronUp,
  FileDown, FilePlus2, FolderOpen, Plus, Save, Trash2,
  Upload, UserRound, Wrench
} from 'lucide-react';
import jsPDF from 'jspdf';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { AppLayout } from '@/components/layout/AppLayout';

const STORAGE_KEY = 'crane_accounting_equipment_documents_v1';

type StoredFile = { name: string; mime: string; dataUrl: string };

type DocumentInfo = {
  id: string; title: string; number: string; issueDate: string;
  expiryDate: string; notes: string; file?: StoredFile | null;
};

type DriverInfo = {
  name: string; phone: string; iqamaNumber: string; iqamaExpiry: string;
  licenseNumber: string; licenseExpiry: string; tuvNumber: string;
  tuvIssueDate: string; tuvExpiryDate: string;
  iqamaFile?: StoredFile | null; licenseFile?: StoredFile | null; tuvFile?: StoredFile | null;
};

type EquipmentFile = {
  id: string; name: string; brand: string; capacity: string; model: string; year: string;
  plateNumber: string; chassisNumber: string; serialNumber: string;
  image?: StoredFile | null;
  registration: DocumentInfo; craneTuv: DocumentInfo; insurance: DocumentInfo;
  driver: DriverInfo; extraDocuments: DocumentInfo[]; notes: string;
};

const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const emptyDoc = (title:string):DocumentInfo => ({id:id(),title,number:'',issueDate:'',expiryDate:'',notes:'',file:null});
const emptyDriver = ():DriverInfo => ({
  name:'',phone:'',iqamaNumber:'',iqamaExpiry:'',licenseNumber:'',licenseExpiry:'',
  tuvNumber:'',tuvIssueDate:'',tuvExpiryDate:'',iqamaFile:null,licenseFile:null,tuvFile:null
});
const createEquipment = ():EquipmentFile => ({
  id:id(),name:'',brand:'',capacity:'',model:'',year:'',plateNumber:'',chassisNumber:'',serialNumber:'',image:null,
  registration:emptyDoc('رخصة سير الكرين'),craneTuv:emptyDoc('TUV الكرين'),insurance:emptyDoc('التأمين'),
  driver:emptyDriver(),extraDocuments:[],notes:''
});
function normalize(x:any):EquipmentFile {
  const n=createEquipment();
  return {...n,...x,
    registration:{...n.registration,...(x?.registration||{})},
    craneTuv:{...n.craneTuv,...(x?.craneTuv||{})},
    insurance:{...n.insurance,...(x?.insurance||{})},
    driver:{...n.driver,...(x?.driver||{})},
    extraDocuments:Array.isArray(x?.extraDocuments)?x.extraDocuments.map((d:any)=>({...emptyDoc('مستند إضافي'),...d})):[]
  };
}
function daysUntil(v:string){
  if(!v)return null; const t=new Date();t.setHours(0,0,0,0);const d=new Date(`${v}T00:00:00`);
  if(Number.isNaN(d.getTime()))return null; return Math.ceil((d.getTime()-t.getTime())/86400000);
}
function status(v:string){
  const d=daysUntil(v);
  if(d===null)return {key:'missing',text:'بدون تاريخ',cls:'text-slate-400 bg-slate-500/10 border-slate-500/20'};
  if(d<0)return {key:'expired',text:'منتهي',cls:'text-red-400 bg-red-500/10 border-red-500/20'};
  if(d===0)return {key:'expired',text:'ينتهي اليوم',cls:'text-red-400 bg-red-500/10 border-red-500/20'};
  if(d<=30)return {key:'soon',text:`باقي ${d} يوم`,cls:'text-amber-400 bg-amber-500/10 border-amber-500/20'};
  return {key:'valid',text:`ساري • ${d} يوم`,cls:'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'};
}
function toStored(file:File):Promise<StoredFile>{
  return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve({name:file.name,mime:file.type||'application/octet-stream',dataUrl:String(r.result||'')});r.onerror=()=>reject(r.error);r.readAsDataURL(file);});
}
function blob64(blob:Blob):Promise<string>{
  return new Promise((resolve,reject)=>{const r=new FileReader();r.onloadend=()=>{const s=String(r.result||'');resolve(s.includes(',')?s.split(',')[1]:s)};r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});
}

export function EquipmentDocumentsPage(){
  const navigate=useNavigate();
  const [items,setItems]=useState<EquipmentFile[]>([]);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [screen,setScreen]=useState<'center'|'file'>('center');
  const [query,setQuery]=useState('');
  const [busy,setBusy]=useState(false);

  useEffect(()=>{try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){const a=JSON.parse(raw);if(Array.isArray(a))setItems(a.map(normalize));}}catch(e){console.error(e)}},[]);
  const selected=useMemo(()=>items.find(x=>x.id===selectedId)||null,[items,selectedId]);
  const persist=(next:EquipmentFile[])=>{setItems(next);localStorage.setItem(STORAGE_KEY,JSON.stringify(next));};
  const update=(fn:(x:EquipmentFile)=>EquipmentFile)=>{if(selected)persist(items.map(x=>x.id===selected.id?fn(x):x));};
  const field=(k:keyof EquipmentFile,v:any)=>update(x=>({...x,[k]:v}));
  const doc=(k:'registration'|'craneTuv'|'insurance',f:keyof DocumentInfo,v:any)=>update(x=>({...x,[k]:{...x[k],[f]:v}}));
  const driver=(f:keyof DriverInfo,v:any)=>update(x=>({...x,driver:{...x.driver,[f]:v}}));
  const add=()=>{const e=createEquipment();persist([e,...items]);setSelectedId(e.id);setScreen('file');};

  const global=useMemo(()=>{
    const a:{key:string}[]=[];
    items.forEach(e=>[e.registration.expiryDate,e.craneTuv.expiryDate,e.insurance.expiryDate,e.driver.iqamaExpiry,e.driver.licenseExpiry,e.driver.tuvExpiryDate].forEach(d=>a.push({key:status(d).key})));
    return {valid:a.filter(x=>x.key==='valid').length,soon:a.filter(x=>x.key==='soon').length,expired:a.filter(x=>x.key==='expired').length};
  },[items]);

  if(screen==='center'){
    const list=items.filter(e=>`${e.name} ${e.brand} ${e.capacity} ${e.driver.name}`.toLowerCase().includes(query.toLowerCase()));
    return <AppLayout><div dir="rtl" className="pb-24">
      <Header title="مركز المستندات" sub="BAAKR PRO • إدارة ملفات الكرينات والمشغلين" back={()=>navigate(-1)} add={add}/>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Summary n={global.valid} label="سارية" c="emerald"/><Summary n={global.soon} label="قريبة" c="amber"/><Summary n={global.expired} label="منتهية" c="red"/>
      </div>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="بحث عن كرين أو سائق..." className="w-full h-13 mb-4 px-4 rounded-2xl bg-[#0b1524] border border-white/10 text-white outline-none"/>
      {!list.length?<div className="rounded-[26px] border border-dashed border-white/10 bg-[#0b1524] p-8 text-center"><Wrench className="w-12 h-12 text-slate-600 mx-auto mb-3"/><b className="text-white">لا توجد معدات</b><p className="text-slate-500 text-xs mt-2">أضف أول كرين وابدأ المحفظة الرقمية</p></div>:
      <div className="space-y-4">{list.map(e=><EquipmentCard key={e.id} e={e} open={()=>{setSelectedId(e.id);setScreen('file')}}/>)}</div>}
      <button onClick={add} className="w-full h-14 mt-5 rounded-2xl bg-gradient-to-l from-amber-500 to-orange-500 text-black font-black flex items-center justify-center gap-2"><Plus className="w-5 h-5"/>إضافة كرين جديد</button>
    </div></AppLayout>;
  }

  if(!selected)return <AppLayout><div/> </AppLayout>;

  const complete=[selected.registration.file,selected.craneTuv.file,selected.insurance.file,selected.driver.iqamaFile,selected.driver.licenseFile,selected.driver.tuvFile].filter(Boolean).length;
  const alerts=[
    ['رخصة سير الكرين',selected.registration.expiryDate],['TUV الكرين',selected.craneTuv.expiryDate],['التأمين',selected.insurance.expiryDate],
    ['إقامة السائق',selected.driver.iqamaExpiry],['رخصة السائق',selected.driver.licenseExpiry],['TUV السائق',selected.driver.tuvExpiryDate]
  ].filter(([,d])=>{const n=daysUntil(d);return n!==null&&n<=30}).sort((a,b)=>(daysUntil(a[1])??9999)-(daysUntil(b[1])??9999));

  async function pdf(){
    if(busy)return;
    try{
      setBusy(true);const p=new jsPDF({unit:'mm',format:'a4'});let y=18;
      const line=(a:string,b:string)=>{if(y>280){p.addPage();y=18}p.setFontSize(10);p.text(`${a}: ${b||'-'}`,15,y);y+=7};
      p.setFontSize(19);p.text('BAAKR PRO',15,y);y+=10;p.setFontSize(14);p.text('Equipment Digital File',15,y);y+=12;
      line('Equipment',selected.name);line('Brand',selected.brand);line('Capacity',selected.capacity);line('Model',selected.model);line('Plate',selected.plateNumber);line('Driver',selected.driver.name);
      y+=4;line('Registration',selected.registration.number);line('Registration Expiry',selected.registration.expiryDate);line('Crane TUV',selected.craneTuv.number);line('Crane TUV Expiry',selected.craneTuv.expiryDate);line('Insurance',selected.insurance.number);line('Insurance Expiry',selected.insurance.expiryDate);
      line('Iqama',selected.driver.iqamaNumber);line('Iqama Expiry',selected.driver.iqamaExpiry);line('Driver License',selected.driver.licenseNumber);line('License Expiry',selected.driver.licenseExpiry);line('Driver TUV',selected.driver.tuvNumber);line('Driver TUV Expiry',selected.driver.tuvExpiryDate);
      const b=p.output('blob'),data=await blob64(b),name=`BAAKR-PRO-${(selected.name||'equipment').replace(/[\\/:*?"<>|]/g,'-')}-${Date.now()}.pdf`;
      const out=await Filesystem.writeFile({path:name,data,directory:Directory.Cache});
      await Share.share({title:'ملف الكرين',text:selected.name||'ملف الكرين',url:out.uri,dialogTitle:'مشاركة ملف الكرين'});
    }catch(e){console.error(e);alert('تعذر إنشاء ملف PDF')}finally{setBusy(false)}
  }

  return <AppLayout><div dir="rtl" className="pb-24">
    <Header title="المحفظة الرقمية" sub="ملف الكرين والمشغل" back={()=>setScreen('center')}/>
    <section className="mb-4 overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1524]">
      <div className="relative h-48 bg-gradient-to-br from-[#10213b] to-[#07111d]">
        {selected.image?.dataUrl?<img src={selected.image.dataUrl} className="w-full h-full object-cover" alt="crane"/>:<div className="h-full flex items-center justify-center"><Wrench className="w-16 h-16 text-slate-700"/></div>}
        <Uploader label="صورة الكرين" accept="image/*" onFile={f=>field('image',f)} floating/>
        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black via-black/60 to-transparent">
          <div className="flex justify-between items-end"><div><h2 className="text-white text-xl font-black">{selected.name||'كرين جديد'}</h2><p className="text-slate-300 text-xs mt-1">{selected.brand||'—'} • {selected.capacity||'—'} • {selected.driver.name||'بدون مشغل'}</p></div><span className="px-3 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black">{complete}/6</span></div>
        </div>
      </div>
    </section>

    {!!alerts.length&&<section className="mb-5"><h3 className="text-white font-black flex items-center gap-2 mb-2"><BellRing className="w-5 h-5 text-amber-400"/>التنبيهات المهمة</h3><div className="space-y-2">{alerts.slice(0,4).map(([t,d])=><div key={t} className="p-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex justify-between items-center"><span className="text-white text-sm font-bold">{t}</span><Status date={d}/></div>)}</div></section>}

    <Card title="بيانات سريعة" icon={<Wrench className="w-5 h-5"/>} start={false}>
      <Field label="اسم الكرين" value={selected.name} set={v=>field('name',v)}/><div className="grid grid-cols-2 gap-3"><Field label="الشركة" value={selected.brand} set={v=>field('brand',v)}/><Field label="الحمولة" value={selected.capacity} set={v=>field('capacity',v)}/></div>
      <div className="grid grid-cols-2 gap-3"><Field label="الموديل" value={selected.model} set={v=>field('model',v)}/><Field label="سنة الصنع" value={selected.year} set={v=>field('year',v)}/></div><Field label="رقم اللوحة" value={selected.plateNumber} set={v=>field('plateNumber',v)}/>
    </Card>

    <Title icon={<FolderOpen className="w-5 h-5"/>} text="مستندات الكرين"/>
    <DocCard title="رخصة سير الكرين" d={selected.registration} change={(f,v)=>doc('registration',f,v)}/>
    <DocCard title="TUV الكرين" d={selected.craneTuv} change={(f,v)=>doc('craneTuv',f,v)}/>
    <DocCard title="التأمين" d={selected.insurance} change={(f,v)=>doc('insurance',f,v)}/>

    <Title icon={<UserRound className="w-5 h-5"/>} text="مستندات السائق / المشغل"/>
    <Card title={selected.driver.name||'بيانات السائق'} icon={<UserRound className="w-5 h-5"/>} start={false}><Field label="اسم السائق" value={selected.driver.name} set={v=>driver('name',v)}/><Field label="رقم الجوال" value={selected.driver.phone} set={v=>driver('phone',v)}/></Card>
    <DriverDoc title="الإقامة" number={selected.driver.iqamaNumber} expiry={selected.driver.iqamaExpiry} file={selected.driver.iqamaFile} numberSet={v=>driver('iqamaNumber',v)} expirySet={v=>driver('iqamaExpiry',v)} fileSet={v=>driver('iqamaFile',v)}/>
    <DriverDoc title="رخصة السائق" number={selected.driver.licenseNumber} expiry={selected.driver.licenseExpiry} file={selected.driver.licenseFile} numberSet={v=>driver('licenseNumber',v)} expirySet={v=>driver('licenseExpiry',v)} fileSet={v=>driver('licenseFile',v)}/>
    <DriverDoc title="TUV السائق" number={selected.driver.tuvNumber} expiry={selected.driver.tuvExpiryDate} file={selected.driver.tuvFile} numberSet={v=>driver('tuvNumber',v)} expirySet={v=>driver('tuvExpiryDate',v)} fileSet={v=>driver('tuvFile',v)}/>

    <Card title="مستندات إضافية" icon={<FilePlus2 className="w-5 h-5"/>} start={selected.extraDocuments.length>0}>
      {selected.extraDocuments.map((d,i)=><div key={d.id} className="p-3 rounded-2xl border border-white/10 bg-black/20"><div className="flex justify-between mb-3"><b className="text-white">مستند {i+1}</b><button onClick={()=>update(x=>({...x,extraDocuments:x.extraDocuments.filter(z=>z.id!==d.id)}))} className="text-red-400"><Trash2 className="w-5 h-5"/></button></div><Field label="اسم المستند" value={d.title} set={v=>update(x=>({...x,extraDocuments:x.extraDocuments.map(z=>z.id===d.id?{...z,title:v}:z)}))}/><div className="mt-3"><DocBody d={d} change={(f,v)=>update(x=>({...x,extraDocuments:x.extraDocuments.map(z=>z.id===d.id?{...z,[f]:v}:z)}))}/></div></div>)}
      <button onClick={()=>update(x=>({...x,extraDocuments:[...x.extraDocuments,emptyDoc('مستند إضافي')]}))} className="w-full h-12 rounded-2xl border border-dashed border-blue-500/30 bg-blue-500/5 text-blue-400 font-black flex items-center justify-center gap-2"><Plus className="w-5 h-5"/>إضافة مستند جديد</button>
    </Card>

    <div className="grid grid-cols-2 gap-3 mt-5"><button onClick={()=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(items));alert('تم الحفظ')}} className="h-14 rounded-2xl bg-slate-800 border border-white/10 text-white font-black flex items-center justify-center gap-2"><Save className="w-5 h-5"/>حفظ</button><button disabled={busy} onClick={pdf} className="h-14 rounded-2xl bg-gradient-to-l from-amber-500 to-orange-500 text-black font-black flex items-center justify-center gap-2"><FileDown className="w-5 h-5"/>{busy?'جاري التجهيز...':'تجهيز PDF'}</button></div>
    <button onClick={()=>{if(window.confirm(`حذف ${selected.name||'هذه المعدة'}؟`)){persist(items.filter(x=>x.id!==selected.id));setSelectedId(null);setScreen('center')}}} className="w-full h-12 mt-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-black flex items-center justify-center gap-2"><Trash2 className="w-5 h-5"/>حذف المعدة</button>
  </div></AppLayout>;
}

function Header({title,sub,back,add}:{title:string;sub:string;back:()=>void;add?:()=>void}){return <div className="flex justify-between items-center mb-5"><button onClick={back} className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center"><ArrowRight className="w-5 h-5 text-white"/></button><div className="text-center"><h1 className="text-xl text-white font-black">{title}</h1><p className="text-[10px] text-slate-500 mt-1">{sub}</p></div>{add?<button onClick={add} className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-black flex items-center justify-center"><Plus className="w-5 h-5"/></button>:<div className="w-11"/>}</div>}
function Summary({n,label,c}:{n:number;label:string;c:'emerald'|'amber'|'red'}){const x={emerald:'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',amber:'text-amber-400 border-amber-500/20 bg-amber-500/10',red:'text-red-400 border-red-500/20 bg-red-500/10'}[c];return <div className={`p-3 rounded-2xl border text-center ${x}`}><div className="text-2xl font-black">{n}</div><div className="text-[10px] font-bold">{label}</div></div>}
function EquipmentCard({e,open}:{e:EquipmentFile;open:()=>void}){const files=[e.registration.file,e.craneTuv.file,e.insurance.file,e.driver.iqamaFile,e.driver.licenseFile,e.driver.tuvFile].filter(Boolean).length;const s=[e.registration.expiryDate,e.craneTuv.expiryDate,e.insurance.expiryDate,e.driver.iqamaExpiry,e.driver.licenseExpiry,e.driver.tuvExpiryDate].map(status);return <button onClick={open} className="w-full rounded-[26px] overflow-hidden border border-white/10 bg-[#0b1524] text-right"><div className="relative h-40 bg-[#07111d]">{e.image?.dataUrl?<img src={e.image.dataUrl} className="w-full h-full object-cover" alt="crane"/>:<div className="h-full flex items-center justify-center"><Wrench className="w-14 h-14 text-slate-700"/></div>}<div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent"/><div className="absolute bottom-3 right-4"><b className="text-white text-lg">{e.name||'معدة جديدة'}</b><p className="text-slate-300 text-xs">{e.driver.name||'بدون مشغل'}</p></div><span className="absolute bottom-3 left-4 w-14 h-14 rounded-full border-4 border-emerald-500 bg-black/70 text-white flex items-center justify-center font-black">{files}/6</span></div><div className="grid grid-cols-3 p-3 text-center text-[10px] font-black"><span className="text-emerald-400">● {s.filter(x=>x.key==='valid').length} سارية</span><span className="text-amber-400">● {s.filter(x=>x.key==='soon').length} قريبة</span><span className="text-red-400">● {s.filter(x=>x.key==='expired').length} منتهية</span></div></button>}
function Title({icon,text}:{icon:React.ReactNode;text:string}){return <h2 className="flex items-center gap-2 text-white font-black mt-6 mb-3"><span className="text-orange-400">{icon}</span>{text}</h2>}
function DocCard({title,d,change}:{title:string;d:DocumentInfo;change:(f:keyof DocumentInfo,v:any)=>void}){return <section className="mb-3 p-4 rounded-[22px] bg-[#0b1524] border border-white/10"><div className="flex justify-between items-center mb-3"><div><b className="text-white">{title}</b><p className="text-slate-500 text-[10px] mt-1">{d.file?.name||'صورة أو PDF'}</p></div><Status date={d.expiryDate}/></div>{d.file?.mime.startsWith('image/')&&<img src={d.file.dataUrl} className="w-full h-36 object-cover rounded-2xl mb-3" alt={title}/>}<div className="grid grid-cols-2 gap-2 mb-3"><Uploader label="إضافة صورة" accept="image/*" onFile={f=>change('file',f)}/><Uploader label="إضافة PDF" accept="application/pdf" onFile={f=>change('file',f)}/></div><DocBody d={d} change={change}/></section>}
function DocBody({d,change}:{d:DocumentInfo;change:(f:keyof DocumentInfo,v:any)=>void}){return <div className="space-y-3"><Field label="رقم المستند / الشهادة" value={d.number} set={v=>change('number',v)}/><div className="grid grid-cols-2 gap-3"><DateField label="تاريخ الإصدار" value={d.issueDate} set={v=>change('issueDate',v)}/><DateField label="تاريخ الانتهاء" value={d.expiryDate} set={v=>change('expiryDate',v)}/></div></div>}
function DriverDoc({title,number,expiry,file,numberSet,expirySet,fileSet}:{title:string;number:string;expiry:string;file?:StoredFile|null;numberSet:(v:string)=>void;expirySet:(v:string)=>void;fileSet:(v:StoredFile)=>void}){return <section className="mb-3 p-4 rounded-[22px] bg-[#0b1524] border border-white/10"><div className="flex justify-between items-center mb-3"><div><b className="text-white">{title}</b><p className="text-slate-500 text-[10px]">{file?.name||'صورة أو PDF'}</p></div><Status date={expiry}/></div>{file?.mime.startsWith('image/')&&<img src={file.dataUrl} className="w-full h-36 object-cover rounded-2xl mb-3" alt={title}/>}<div className="grid grid-cols-2 gap-2 mb-3"><Uploader label="إضافة صورة" accept="image/*" onFile={fileSet}/><Uploader label="إضافة PDF" accept="application/pdf" onFile={fileSet}/></div><Field label="رقم المستند" value={number} set={numberSet}/><div className="mt-3"><DateField label="تاريخ الانتهاء" value={expiry} set={expirySet}/></div></section>}
function Uploader({label,accept,onFile,floating=false}:{label:string;accept:string;onFile:(f:StoredFile)=>void;floating?:boolean}){const r=useRef<HTMLInputElement>(null);return <><input ref={r} className="hidden" type="file" accept={accept} onChange={async e=>{const f=e.target.files?.[0];if(f)onFile(await toStored(f));e.currentTarget.value=''}}/><button type="button" onClick={()=>r.current?.click()} className={`${floating?'absolute top-3 left-3':''} min-h-11 px-3 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-300 font-black text-xs flex items-center justify-center gap-2`}><Upload className="w-4 h-4"/>{label}</button></>}
function Status({date}:{date:string}){const s=status(date);return <span className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-xl border text-[10px] font-black ${s.cls}`}><CalendarDays className="w-3.5 h-3.5"/>{s.text}</span>}
function Card({title,icon,children,start=true}:{title:string;icon:React.ReactNode;children:React.ReactNode;start?:boolean}){const[o,setO]=useState(start);return <section className="mb-4 rounded-[24px] bg-[#0b1524] border border-white/10 overflow-hidden"><button onClick={()=>setO(!o)} className="w-full p-4 flex justify-between items-center"><div className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">{icon}</span><b className="text-white">{title}</b></div>{o?<ChevronUp className="text-slate-500"/>:<ChevronDown className="text-slate-500"/>}</button>{o&&<div className="px-4 pb-4 space-y-3">{children}</div>}</section>}
function Field({label,value,set}:{label:string;value:string;set:(v:string)=>void}){return <label className="block"><span className="block mb-2 text-[11px] font-bold text-slate-400">{label}</span><input value={value} onChange={e=>set(e.target.value)} className="w-full h-12 px-3 rounded-xl bg-[#07111d] border border-white/10 text-white text-sm font-bold outline-none focus:border-blue-500/60"/></label>}
function DateField({label,value,set}:{label:string;value:string;set:(v:string)=>void}){return <label className="block"><span className="block mb-2 text-[11px] font-bold text-slate-400">{label}</span><input type="date" value={value} onChange={e=>set(e.target.value)} className="w-full h-12 px-3 rounded-xl bg-[#07111d] border border-white/10 text-white text-sm font-bold outline-none focus:border-blue-500/60"/></label>}
