import { useEffect, useMemo, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { fetchEquipment, type Equipment } from '@/lib/equipment';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

type WorkDay = { date: string; worked: boolean; notes: string };
type WorkRecord = { id: string; equipmentId: string; equipmentName: string; client: string; driver: string; site: string; rate: number; paid: number; days: WorkDay[]; createdAt: string };
const KEY = 'bakr_pro_daily_crane_work_v1'; // نفس مفتاح الحفظ القديم
const dark = '#10233c';
const inputStyle: React.CSSProperties = { display:'block', width:'100%', minWidth:0, boxSizing:'border-box', height:48, borderRadius:12, padding:'0 12px', background:'#f8fafc', color:'#17263c', border:'1px solid #cbd5e1', fontSize:16, outline:'none' };
const card: React.CSSProperties = {background:'#fff', borderRadius:17, padding:15, marginBottom:14, border:'1px solid #e2e8f0', boxShadow:'0 3px 14px #0000000a', minWidth:0};
const btn: React.CSSProperties = {minHeight:48, border:0, borderRadius:12, background:dark, color:'#fff', fontSize:14, fontWeight:800, padding:'10px 14px', cursor:'pointer'};
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const amount = (v:number) => `${v.toLocaleString('en-US',{maximumFractionDigits:2})} ر.س`;
const dayName = (s:string) => new Intl.DateTimeFormat('ar-SA',{weekday:'long'}).format(new Date(`${s}T12:00:00`));
const clean = (s:string) => s.replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
const validNumber = (s:string) => s.trim()!=='' && Number.isFinite(Number(clean(s))) && Number(clean(s))>=0;
const parseRecords = ():WorkRecord[] => { try { const v=JSON.parse(localStorage.getItem(KEY)||'[]'); return Array.isArray(v)?v:[]; } catch {return [];} };

export function DailyCraneWorkPage(){
 const [equipment,setEquipment]=useState<Equipment[]>([]);
 const [equipmentError,setEquipmentError]=useState('');
 const [records,setRecords]=useState<WorkRecord[]>(parseRecords);
 const [editing,setEditing]=useState<string|null>(null);
 const [equipmentId,setEquipmentId]=useState('');
 const [client,setClient]=useState(''); const [driver,setDriver]=useState(''); const [site,setSite]=useState('');
 const [rate,setRate]=useState(''); const [paid,setPaid]=useState('0');
 const [newDate,setNewDate]=useState(today());
 const [days,setDays]=useState<WorkDay[]>([]);
 const [notice,setNotice]=useState(''); const [busy,setBusy]=useState(false);
 const reportRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{let active=true;fetchEquipment().then(v=>{if(active)setEquipment(v||[]);}).catch(()=>{if(active)setEquipmentError('تعذر تحميل المعدات');});return()=>{active=false;};},[]);
 const selected=useMemo(()=>equipment.find(e=>String(e.id)===equipmentId),[equipment,equipmentId]);
 const workDays=useMemo(()=>days.filter(d=>d.worked).sort((a,b)=>a.date.localeCompare(b.date)),[days]);
 const dailyRate=validNumber(rate)?Number(clean(rate)):0;
 const received=validNumber(paid)?Number(clean(paid)):0;
 const total=workDays.length*dailyRate;
 const balance=total-received;
 const addDay=()=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(newDate)||Number.isNaN(new Date(newDate+'T12:00:00').getTime())){setNotice('اختر تاريخاً صحيحاً');return;}
  if(days.some(d=>d.date===newDate&&d.worked)){setNotice('هذا اليوم مضاف بالفعل');return;}
  setDays(old=>[...old.filter(d=>d.date!==newDate),{date:newDate,worked:true,notes:''}].sort((a,b)=>a.date.localeCompare(b.date)));
  setNotice('تمت إضافة يوم العمل');
 };
 const removeDay=(date:string)=>setDays(old=>old.filter(d=>d.date!==date));
 const reset=()=>{setEditing(null);setEquipmentId('');setClient('');setDriver('');setSite('');setRate('');setPaid('0');setNewDate(today());setDays([]);setNotice('كشف جديد');};
 const load=(r:WorkRecord)=>{setEditing(r.id);setEquipmentId(String(r.equipmentId));setClient(r.client);setDriver(r.driver);setSite(r.site);setRate(String(r.rate));setPaid(String(r.paid));setDays((r.days||[]).map(d=>({...d})));setNewDate(today());setNotice('تم فتح الكشف للتعديل. أيام التوقف القديمة لا تدخل في الحساب.');window.scrollTo({top:0,behavior:'smooth'});};
 const check=()=>{if(!selected||!client.trim()||workDays.length===0||!validNumber(rate)||!validNumber(paid)){setNotice('اختر الكرين والعميل وأضف يوم عمل واحداً على الأقل وأدخل السعر والمستلم بشكل صحيح.');return false;}return true;};
 const save=()=>{if(!check())return;const entry:WorkRecord={id:editing||`dw-${Date.now()}`,equipmentId:String(selected!.id),equipmentName:selected!.name,client:client.trim(),driver:driver.trim(),site:site.trim(),rate:dailyRate,paid:received,days:workDays,createdAt:editing?(records.find(r=>r.id===editing)?.createdAt||new Date().toISOString()):new Date().toISOString()};const next=editing?records.map(r=>r.id===editing?entry:r):[entry,...records];try{localStorage.setItem(KEY,JSON.stringify(next));setRecords(next);setEditing(entry.id);setNotice('تم حفظ الكشف بنجاح على الجهاز.');}catch{setNotice('تعذر الحفظ، تحقق من مساحة الجهاز.');}};
 const makePdf=async():Promise<{base64:string;filename:string}|null>=>{
  if(!check()||!reportRef.current)return null;
  setBusy(true);setNotice('جار إعداد ملف PDF...');
  try{
   if(document.fonts?.ready)await document.fonts.ready;
   const canvas=await html2canvas(reportRef.current,{scale:2,backgroundColor:'#fff',useCORS:true,scrollX:0,scrollY:0,windowWidth:900});
   const pdf=new jsPDF('p','mm','a4'); const margin=10,pageWidth=210-2*margin,pageHeight=297-2*margin;
   // تقطيع الصورة إلى صفحات بدلاً من صورة طويلة مخفية خارج الصفحة
   const pixelsPerPage=Math.floor(canvas.width*pageHeight/pageWidth);
   for(let y=0,page=0;y<canvas.height;y+=pixelsPerPage,page++){
    if(page)pdf.addPage();const slice=document.createElement('canvas');slice.width=canvas.width;slice.height=Math.min(pixelsPerPage,canvas.height-y);const ctx=slice.getContext('2d');if(!ctx)throw new Error('Canvas');ctx.fillStyle='#fff';ctx.fillRect(0,0,slice.width,slice.height);ctx.drawImage(canvas,0,y,canvas.width,slice.height,0,0,canvas.width,slice.height);
    const height=slice.height*pageWidth/slice.width;pdf.addImage(slice.toDataURL('image/jpeg',0.92),'JPEG',margin,margin,pageWidth,height);
   }
   const base64=pdf.output('datauristring').split(',')[1];return {base64,filename:`BAKR-Daily-Work-${editing||today()}.pdf`};
  }catch(e){console.error(e);setNotice('تعذر إنشاء PDF، حاول مرة أخرى.');return null;}finally{setBusy(false);}
 };
 const exportPdf=async()=>{const result=await makePdf();if(!result)return;try{const saved=await Filesystem.writeFile({path:result.filename,data:result.base64,directory:Directory.Documents,recursive:true});setNotice('تم حفظ PDF في مستندات الجهاز.');return saved.uri;}catch(e){console.warn(e);const a=document.createElement('a');a.href=`data:application/pdf;base64,${result.base64}`;a.download=result.filename;document.body.appendChild(a);a.click();a.remove();setNotice('تم طلب تنزيل PDF. تحقق من التنزيلات.');}};
 const sharePdf=async()=>{const result=await makePdf();if(!result)return;try{const saved=await Filesystem.writeFile({path:`BAKR-PDF/${result.filename}`,data:result.base64,directory:Directory.Cache,recursive:true});await Share.share({title:'كشف شغل اليوميات - BAKR PRO',text:'كشف شغل اليوميات',url:saved.uri,dialogTitle:'مشاركة PDF عبر واتساب'});setNotice('اختر واتساب من قائمة المشاركة.');}catch(e){console.error(e);setNotice('تعذرت مشاركة PDF مباشرة. استخدم حفظ PDF ثم شاركه من ملفاتي.');}};
 const field=(label:string,value:string,onChange:(s:string)=>void,type='text')=><label style={{display:'block',minWidth:0}}><span style={{display:'block',fontWeight:800,fontSize:13,marginBottom:6}}>{label}</span><input style={inputStyle} type={type} value={value} onChange={e=>onChange(e.target.value)}/></label>;
 return <AppLayout><div dir="rtl" style={{width:'100%',maxWidth:'100%',minWidth:0,overflowX:'clip',boxSizing:'border-box',padding:'0 0 24px',color:dark}}>
  <header style={{background:dark,color:'#fff',borderRadius:17,padding:18,marginBottom:14}}><div style={{color:'#e5bd65',fontSize:12,fontWeight:800}}>BAKR PRO</div><h1 style={{fontSize:22,fontWeight:900,margin:'5px 0'}}>شغل اليوميات</h1><div style={{fontSize:12,color:'#dbe3ec'}}>أضف أيام العمل الفعلية فقط • حفظ ومشاركة PDF</div></header>
  <section style={card}><h2 style={{fontSize:17,fontWeight:900,margin:'0 0 14px'}}>بيانات العمل</h2><label style={{display:'block',fontWeight:800,fontSize:13,marginBottom:6}}>الكرين من المعدات المحفوظة</label><select style={inputStyle} value={equipmentId} onChange={e=>setEquipmentId(e.target.value)}><option value="">اختر الكرين</option>{equipment.map(e=><option key={e.id} value={String(e.id)}>{e.name}{e.capacity?` - ${e.capacity}`:''}</option>)}</select>{equipmentError&&<p style={{color:'#b91c1c'}}>{equipmentError}</p>}<div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr)',gap:12,marginTop:12}}>{field('اسم العميل',client,setClient)}{field('اسم السائق',driver,setDriver)}{field('موقع العمل',site,setSite)}</div></section>
  <section style={card}><h2 style={{fontSize:17,fontWeight:900,margin:'0 0 8px'}}>أيام الشغل الفعلية</h2><p style={{fontSize:12,color:'#64748b',margin:'0 0 12px'}}>اختر تاريخ اليوم الذي اشتغل فيه الكرين ثم اضغط إضافة. الأيام التي لم يشتغل فيها لا تضيفها.</p>{field('تاريخ يوم العمل',newDate,setNewDate,'date')}<button type="button" style={{...btn,width:'100%',marginTop:10,background:'#157347'}} onClick={addDay}>+ إضافة يوم عمل</button><div style={{marginTop:12}}>{workDays.length===0?<p style={{fontSize:13,color:'#64748b'}}>لم تضف أيام عمل بعد.</p>:workDays.map(d=><div key={d.date} style={{padding:'10px 0',borderBottom:'1px solid #e2e8f0',display:'flex',alignItems:'center',gap:8,minWidth:0}}><div style={{flex:1,minWidth:0}}><b style={{display:'block',fontSize:13}}>{dayName(d.date)} — {d.date}</b><input aria-label={`ملاحظة ${d.date}`} value={d.notes} onChange={e=>setDays(old=>old.map(x=>x.date===d.date?{...x,notes:e.target.value}:x))} placeholder="ملاحظة (اختياري)" style={{...inputStyle,height:38,fontSize:13,marginTop:5}}/></div><button type="button" onClick={()=>removeDay(d.date)} style={{...btn,background:'#fee2e2',color:'#991b1b',padding:'8px 10px',fontSize:12,flexShrink:0}}>حذف</button></div>)}</div></section>
  <section style={card}><h2 style={{fontSize:17,fontWeight:900,margin:'0 0 14px'}}>الحساب المالي</h2><div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr)',gap:12}}>{field('سعر اليوم (ريال)',rate,setRate,'text')}{field('المبلغ المستلم (ريال)',paid,setPaid,'text')}</div><div style={{marginTop:14,background:'#f1f5f9',borderRadius:12,padding:13,lineHeight:2,fontSize:14}}><div>أيام العمل: <b>{workDays.length}</b></div><div>الإجمالي: <b>{amount(total)}</b></div><div>المستلم: <b>{amount(received)}</b></div><div style={{fontSize:19,fontWeight:900,color:balance>0?'#9a3412':'#166534'}}>المتبقي: {amount(balance)}</div></div></section>
  <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr)',gap:9,marginBottom:14}}><button type="button" style={{...btn,background:'#15803d'}} onClick={save}>حفظ الكشف</button><button type="button" style={{...btn,background:'#98712b'}} disabled={busy} onClick={exportPdf}>{busy?'جار التجهيز...':'حفظ PDF'}</button><button type="button" style={{...btn,background:'#0b7a4b'}} disabled={busy} onClick={sharePdf}>مشاركة PDF عبر واتساب</button><button type="button" style={{...btn,background:'#475569'}} onClick={reset}>كشف جديد</button></div>
  {notice&&<p role="status" style={{background:'#fef3c7',color:'#78350f',padding:12,borderRadius:12,fontSize:13}}>{notice}</p>}
  <section style={card}><h2 style={{fontSize:16,fontWeight:900,margin:'0 0 12px'}}>الكشوف المحفوظة</h2>{records.length===0?<p style={{fontSize:13}}>لا توجد كشوف محفوظة بعد.</p>:records.map(r=><button type="button" key={r.id} onClick={()=>load(r)} style={{...inputStyle,height:'auto',textAlign:'right',marginBottom:8,padding:12,cursor:'pointer'}}><b>{r.client}</b><div style={{fontSize:12}}>{r.equipmentName} — {(r.days||[]).filter(x=>x.worked).length} أيام — {amount((r.days||[]).filter(x=>x.worked).length*r.rate)}</div></button>)}</section>
  <div aria-hidden="true" style={{position:'fixed',left:-10000,top:0,width:790,pointerEvents:'none'}}><div ref={reportRef} dir="rtl" style={{width:760,boxSizing:'border-box',padding:28,background:'#fff',color:dark,fontFamily:'Tahoma,Arial,sans-serif'}}><div style={{background:dark,color:'#fff',padding:22,textAlign:'center'}}><b style={{color:'#e5bd65',fontSize:25}}>BAKR PRO</b><h2 style={{margin:'8px 0'}}>كشف شغل اليوميات</h2><small>DAILY CRANE WORK STATEMENT</small></div><div style={{padding:'16px 0',lineHeight:2,fontSize:15}}>العميل: <b>{client}</b>　|　الكرين: <b>{selected?.name||''}</b><div>السائق: {driver||'—'}　|　الموقع: {site||'—'}</div><div>سعر اليوم: {amount(dailyRate)}　|　عدد أيام العمل: {workDays.length}</div></div><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr style={{background:dark,color:'#fff'}}>{['م','اليوم والتاريخ','الحالة','المبلغ','ملاحظات'].map(h=><th key={h} style={{border:'1px solid #d1d5db',padding:9}}>{h}</th>)}</tr></thead><tbody>{workDays.map((d,i)=><tr key={d.date} style={{background:i%2?'#f1f5f9':'#fff'}}><td style={{border:'1px solid #ddd',padding:8}}>{i+1}</td><td style={{border:'1px solid #ddd',padding:8}}>{dayName(d.date)} {d.date}</td><td style={{border:'1px solid #ddd',padding:8}}>اشتغل</td><td style={{border:'1px solid #ddd',padding:8}}>{amount(dailyRate)}</td><td style={{border:'1px solid #ddd',padding:8}}>{d.notes}</td></tr>)}</tbody></table><div style={{background:'#eef2f7',marginTop:20,padding:15,lineHeight:2,fontSize:16}}>إجمالي أيام العمل: {workDays.length}<div>الإجمالي: <b>{amount(total)}</b></div><div>المستلم: <b>{amount(received)}</b></div><div style={{fontWeight:900,fontSize:20}}>المتبقي: {amount(balance)}</div></div><div style={{display:'flex',justifyContent:'space-around',marginTop:55,fontSize:14}}><span>توقيع مسؤول العمل: ____________</span><span>توقيع العميل: ____________</span></div></div></div>
 </div></AppLayout>;
                                                                                                                                                                                             }
