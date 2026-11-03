import { useEffect, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { fetchEquipment, type Equipment } from '@/lib/equipment';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

type WorkDay = { date: string; worked: boolean; notes: string };
type WorkRecord = { id: string; equipmentId: string; equipmentName: string; client: string; driver: string; site: string; rate: number; paid: number; days: WorkDay[]; createdAt: string };
const KEY = 'bakr_pro_daily_crane_work_v1';
const css: Record<string, React.CSSProperties> = {
  input: { width:'100%', padding:12, border:'1px solid #cbd5e1', borderRadius:10, background:'#fff', color:'#17263c', boxSizing:'border-box' },
  label: {display:'block', fontWeight:700, marginBottom:5, fontSize:13},
  card: {background:'#fff', borderRadius:16, padding:16, marginBottom:14, boxShadow:'0 2px 10px #15233b0c'},
  btn: {padding:'12px 16px', borderRadius:10, background:'#14253d', color:'#fff', border:0, fontWeight:700, cursor:'pointer'},
};
function localDate(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function makeDays(from:string,to:string):WorkDay[] {
  if(!from||!to||to<from)return [];
  const start=new Date(from+'T12:00:00'), end=new Date(to+'T12:00:00');
  const count=Math.round((end.getTime()-start.getTime())/86400000)+1;
  if(count>366)return [];
  return Array.from({length:count},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return {date:localDate(d),worked:true,notes:''};});
}
function money(n:number){return n.toLocaleString('en-US',{maximumFractionDigits:2})+' ر.س';}
export function DailyCraneWorkPage(){
  const today=localDate(new Date());
  const [equipment,setEquipment]=useState<Equipment[]>([]);
  const [equipmentError,setEquipmentError]=useState('');
  const [records,setRecords]=useState<WorkRecord[]>(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]');}catch{return [];}});
  const [editing,setEditing]=useState<string|null>(null);
  const [equipmentId,setEquipmentId]=useState('');
  const [client,setClient]=useState(''); const [driver,setDriver]=useState(''); const [site,setSite]=useState('');
  const [rate,setRate]=useState(''); const [paid,setPaid]=useState('0');
  const [from,setFrom]=useState(today); const [to,setTo]=useState(today);
  const [days,setDays]=useState<WorkDay[]>(makeDays(today,today));
  const [notice,setNotice]=useState(''); const [busy,setBusy]=useState(false);
  const reportRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{fetchEquipment().then(setEquipment).catch(()=>setEquipmentError('تعذر تحميل المعدات. تحقق من الاتصال ثم أعد فتح الصفحة.'));},[]);
  const selected=equipment.find(e=>e.id===equipmentId);
  const worked=days.filter(d=>d.worked).length;
  const dailyRate=Math.max(0,Number(rate)||0), received=Math.max(0,Number(paid)||0);
  const total=worked*dailyRate, balance=total-received;
  const updateRange=(a:string,b:string)=>{setFrom(a);setTo(b);const next=makeDays(a,b);setDays(old=>next.map(d=>old.find(x=>x.date===d.date)||d));};
  const save=()=>{
    if(!selected||!client.trim()||!days.length||!rate.trim()||Number(rate)<0||!Number.isFinite(Number(rate))||Number(paid)<0||!Number.isFinite(Number(paid))){setNotice('اختر كريناً مسجلاً وأدخل العميل والتواريخ والسعر والمستلم بشكل صحيح.');return;}
    const entry:WorkRecord={id:editing||('dw-'+Date.now()),equipmentId:selected.id,equipmentName:selected.name,client:client.trim(),driver,site,rate:dailyRate,paid:received,days,createdAt:new Date().toISOString()};
    const next=editing?records.map(r=>r.id===editing?entry:r):[entry,...records];
    try{localStorage.setItem(KEY,JSON.stringify(next));setRecords(next);setEditing(entry.id);setNotice('تم حفظ الكشف على هذا الجهاز. احفظ نسخة PDF أو نسخة احتياطية أيضاً.');}catch{setNotice('تعذر الحفظ في تخزين الجهاز.');}
  };
  const load=(r:WorkRecord)=>{setEditing(r.id);setEquipmentId(r.equipmentId);setClient(r.client);setDriver(r.driver);setSite(r.site);setRate(String(r.rate));setPaid(String(r.paid));setDays(r.days);setFrom(r.days[0]?.date||today);setTo(r.days[r.days.length-1]?.date||today);setNotice('تم فتح الكشف للتعديل.');window.scrollTo({top:0,behavior:'smooth'});};
  const reset=()=>{setEditing(null);setEquipmentId('');setClient('');setDriver('');setSite('');setRate('');setPaid('0');setFrom(today);setTo(today);setDays(makeDays(today,today));setNotice('كشف جديد');};
  const pdf=async()=>{
    if(!reportRef.current||!selected||!client.trim()||!days.length){setNotice('اختر الكرين والعميل والأيام قبل تصدير PDF.');return;}
    setBusy(true);setNotice('جار تجهيز ملف PDF...');
    try{
      if(document.fonts?.ready)await document.fonts.ready;
      const canvas=await html2canvas(reportRef.current,{scale:2,backgroundColor:'#fff',useCORS:true});
      const doc=new jsPDF('p','mm','a4'); const w=210, h=297, margin=9, drawW=w-2*margin;
      const drawH=canvas.height*drawW/canvas.width;
      const pageH=h-2*margin;
      const image=canvas.toDataURL('image/png');
      for(let offset=0;offset<drawH;offset+=pageH){if(offset>0)doc.addPage();doc.addImage(image,'PNG',margin,margin-offset,drawW,drawH);}
      doc.save(`BAKR-Daily-Work-${editing||today}.pdf`);setNotice('تم إنشاء PDF. اختر مكان الحفظ من جهازك.');
    }catch(e){console.error(e);setNotice('تعذر إنشاء PDF على هذا الجهاز.');}finally{setBusy(false);}
  };
  const input=(label:string,value:string,onChange:(v:string)=>void,type='text')=><label style={{display:'block',flex:'1 1 180px'}}><span style={css.label}>{label}</span><input style={css.input} type={type} value={value} onChange={e=>onChange(e.target.value)}/></label>;
  return <AppLayout><main dir="rtl" style={{maxWidth:850,margin:'auto',padding:'16px 12px 80px',color:'#14253d'}}>
    <header style={{background:'#14253d',color:'white',borderRadius:18,padding:22,marginBottom:16}}><small style={{color:'#e5bd65'}}>BAKR PRO</small><h1 style={{fontSize:25,fontWeight:800,margin:'5px 0'}}>شغل اليوميات</h1><div style={{color:'#dbe3ec'}}>كشف أعمال الكرينات • حفظ وتصدير PDF</div></header>
    <section style={css.card}><h2 style={{fontWeight:800,marginBottom:12}}>بيانات العمل</h2><label style={css.label}>اختيار الكرين من المعدات المحفوظة</label><select style={css.input} value={equipmentId} onChange={e=>setEquipmentId(e.target.value)}><option value="">— اختر الكرين —</option>{equipment.map(e=><option key={e.id} value={e.id}>{e.name} {e.capacity?'— '+e.capacity:''} {e.plateNumber?'— '+e.plateNumber:''}</option>)}</select>{equipmentError&&<p style={{color:'#b91c1c'}}>{equipmentError}</p>}
    <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:12}}>{input('اسم العميل',client,setClient)}{input('اسم السائق',driver,setDriver)}{input('موقع العمل',site,setSite)}</div></section>
    <section style={css.card}><h2 style={{fontWeight:800,marginBottom:12}}>تحديد أيام العمل</h2><div style={{display:'flex',gap:12,flexWrap:'wrap'}}>{input('من تاريخ',from,v=>updateRange(v,to),'date')}{input('إلى تاريخ',to,v=>updateRange(from,v),'date')}</div><p style={{fontSize:12,color:'#64748b',margin:'10px 0'}}>حدد المدة (حتى 366 يوماً)، ثم ألغِ علامة الأيام التي لم يعمل فيها الكرين.</p>
    {days.length===0&&<p style={{color:'#b91c1c'}}>اختر فترة صحيحة لا تتجاوز سنة.</p>}
    <div style={{maxHeight:380,overflowY:'auto'}}>{days.map((d,i)=><div key={d.date} style={{display:'flex',gap:10,alignItems:'center',padding:'9px 3px',borderBottom:'1px solid #e2e8f0',flexWrap:'wrap'}}><label style={{display:'flex',gap:8,alignItems:'center',minWidth:190}}><input type="checkbox" checked={d.worked} onChange={e=>setDays(old=>old.map((x,j)=>j===i?{...x,worked:e.target.checked}:x))} style={{width:20,height:20}}/><b>{new Intl.DateTimeFormat('ar-SA',{weekday:'long'}).format(new Date(d.date+'T12:00:00'))}</b> <span>{d.date}</span></label><span style={{color:d.worked?'#15803d':'#b91c1c',fontSize:12}}>{d.worked?'اشتغل':'لم يشتغل'}</span><input aria-label={'ملاحظات '+d.date} placeholder="ملاحظات اليوم" value={d.notes} onChange={e=>setDays(old=>old.map((x,j)=>j===i?{...x,notes:e.target.value}:x))} style={{...css.input,flex:'1 1 140px',padding:8}}/></div>)}</div></section>
    <section style={css.card}><h2 style={{fontWeight:800,marginBottom:12}}>الحساب المالي</h2><div style={{display:'flex',gap:12,flexWrap:'wrap'}}>{input('سعر اليوم (ريال)',rate,setRate,'number')}{input('المبلغ المستلم (ريال)',paid,setPaid,'number')}</div><div style={{background:'#f1f5f9',padding:15,borderRadius:12,marginTop:12,lineHeight:2.1}}><div>أيام العمل: <b>{worked} من {days.length}</b></div><div>الإجمالي: <b>{money(total)}</b></div><div>المستلم: <b>{money(received)}</b></div><div style={{fontSize:20,fontWeight:800}}>المتبقي: {money(balance)}</div></div></section>
    <div style={{display:'flex',gap:9,flexWrap:'wrap',marginBottom:16}}><button style={css.btn} onClick={save}>حفظ الكشف</button><button style={{...css.btn,background:'#9b742a'}} onClick={pdf} disabled={busy}>{busy?'جار التصدير...':'حفظ PDF'}</button><button style={{...css.btn,background:'#475569'}} onClick={reset}>كشف جديد</button></div>
    {notice&&<p role="status" style={{padding:12,background:'#fef3c7',borderRadius:10,marginBottom:12}}>{notice}</p>}
    <section style={css.card}><h2 style={{fontWeight:800,marginBottom:12}}>الكشوف المحفوظة على الجهاز</h2>{records.length===0?<p>لا توجد كشوف محفوظة بعد.</p>:records.map(r=><button key={r.id} onClick={()=>load(r)} style={{...css.input,textAlign:'right',marginBottom:8,cursor:'pointer'}}><b>{r.client}</b> — {r.equipmentName} — {r.days.filter(x=>x.worked).length} أيام — {money(r.days.filter(x=>x.worked).length*r.rate)}</button>)}</section>
    <div style={{position:'absolute',left:'-9999px',top:0,width:790,pointerEvents:'none'}}><div ref={reportRef} dir="rtl" style={{background:'#fff',width:790,padding:32,fontFamily:'Tahoma, Arial, sans-serif',color:'#14253d',boxSizing:'border-box'}}><div style={{background:'#14253d',padding:24,color:'white',textAlign:'center'}}><div style={{color:'#e5bd65',fontSize:25,fontWeight:800}}>BAKR PRO</div><h2 style={{margin:6}}>كشف شغل اليوميات</h2><small>DAILY CRANE WORK STATEMENT</small></div><div style={{padding:'18px 0',lineHeight:2}}><div>العميل: <b>{client}</b>　 |　 الكرين: <b>{selected?.name||''}</b></div><div>السائق: {driver||'—'}　 |　 الموقع: {site||'—'}</div><div>الفترة: {from} إلى {to}　 |　 سعر اليوم: {money(dailyRate)}</div></div><table style={{borderCollapse:'collapse',width:'100%',fontSize:14}}><thead><tr style={{background:'#14253d',color:'white'}}>{['م','اليوم / التاريخ','الحالة','المبلغ','ملاحظات'].map(t=><th key={t} style={{padding:9,border:'1px solid #d1d5db'}}>{t}</th>)}</tr></thead><tbody>{days.map((d,i)=><tr key={d.date} style={{background:i%2?'#f1f5f9':'#fff'}}><td style={{padding:8,border:'1px solid #ddd'}}>{i+1}</td><td style={{padding:8,border:'1px solid #ddd'}}>{new Intl.DateTimeFormat('ar-SA',{weekday:'long'}).format(new Date(d.date+'T12:00:00'))} {d.date}</td><td style={{padding:8,border:'1px solid #ddd'}}>{d.worked?'اشتغل':'لم يشتغل'}</td><td style={{padding:8,border:'1px solid #ddd'}}>{d.worked?money(dailyRate):'0'}</td><td style={{padding:8,border:'1px solid #ddd'}}>{d.notes}</td></tr>)}</tbody></table><div style={{marginTop:22,background:'#eef2f7',padding:16,lineHeight:2}}><div>أيام العمل: <b>{worked}</b></div><div>الإجمالي: <b>{money(total)}</b></div><div>المستلم: <b>{money(received)}</b></div><div style={{fontSize:21,fontWeight:800}}>المتبقي: {money(balance)}</div></div><div style={{display:'flex',justifyContent:'space-around',marginTop:55}}><div>توقيع مسؤول العمل: ______________</div><div>توقيع العميل: ______________</div></div></div></div>
  </main></AppLayout>;
}
