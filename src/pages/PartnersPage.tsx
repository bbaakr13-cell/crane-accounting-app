// BAKR PRO - Partners Account Page
// Full version: manual/automatic income, custom percentages, saved settlements, PDF save/share.

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, Users, RefreshCw, Truck, Wallet, TrendingUp, TrendingDown, FileText, Share2, FolderOpen, X, Pencil } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { fetchEquipment, type Equipment } from '@/lib/equipment';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

type IncomeMode = 'auto' | 'manual';
type Partner = { id:string; name:string; percentage:number; paid:number; notes:string };
type DayRow = { day:number; tripPrice?:number; expenseAmount?:number };
type ExternalExpenseRecord = { date?:string; equipmentId?:string; amount?:number };
type SavedSettlement = {
 id:string; createdAt:string; updatedAt?:string; equipmentId:string; equipmentName:string; year:number; month:number;
 incomeMode:IncomeMode; manualIncome:number; monthlyIncome:number; monthlyManualExpenses:number; linkedExpenses:number;
 additionalExpenses:number; totalExpenses:number; distributable:number; partners:Partner[];
};

const STORAGE_KEY='bakr_pro_partner_settlements_v3';
const OLD_STORAGE_KEY='bakr_pro_partner_settlements_v2';
const EXTERNAL_EXPENSE_KEY='crane_accounting_driver_equipment_expenses_v1';
const monthNames=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const n=(v:any)=>Number.isFinite(Number(v))?Number(v):0;
const money=(v:number)=>`${n(v).toLocaleString('en-US',{maximumFractionDigits:2})} ر.س`;
const makePartner=():Partner=>({id:`${Date.now()}-${Math.random()}`,name:'',percentage:0,paid:0,notes:''});
const safeFileName=(v:string)=>v.replace(/[\\/:*?"<>|]/g,'-').replace(/\s+/g,'-');
function getDateParts(v:string){const p=String(v||'').split('-');if(p.length<3)return null;const year=n(p[0]),month=n(p[1]),day=n(p[2]);return year&&month&&day?{year,month,day}:null}

export function PartnersAccountPage(){
 const now=new Date();
 const [equipmentList,setEquipmentList]=useState<Equipment[]>([]); const [equipmentId,setEquipmentId]=useState(''); const [equipmentLoading,setEquipmentLoading]=useState(true);
 const [year,setYear]=useState(now.getFullYear()); const [month,setMonth]=useState(now.getMonth());
 const [incomeMode,setIncomeMode]=useState<IncomeMode>('auto'); const [manualIncome,setManualIncome]=useState(0);
 const [monthlyIncome,setMonthlyIncome]=useState(0); const [monthlyManualExpenses,setMonthlyManualExpenses]=useState(0); const [linkedExpenses,setLinkedExpenses]=useState(0); const [additionalExpenses,setAdditionalExpenses]=useState(0);
 const [partners,setPartners]=useState<Partner[]>([makePartner(),makePartner(),makePartner()]);
 const [loadingAccount,setLoadingAccount]=useState(false); const [savedSettlements,setSavedSettlements]=useState<SavedSettlement[]>([]); const [historyOpen,setHistoryOpen]=useState(false); const [editingId,setEditingId]=useState<string|null>(null); const [savingPdf,setSavingPdf]=useState(false);

 useEffect(()=>{let cancelled=false;(async()=>{try{setEquipmentLoading(true);const result=await fetchEquipment();if(cancelled)return;const list=Array.isArray(result)?result:[];setEquipmentList(list);if(list.length)setEquipmentId(String(list[0].id));}catch(e){console.error(e)}finally{if(!cancelled)setEquipmentLoading(false)}})();return()=>{cancelled=true}},[]);
 const selectedEquipment=useMemo(()=>equipmentList.find(i=>String(i.id)===String(equipmentId))||null,[equipmentList,equipmentId]); const equipmentName=selectedEquipment?.name||'';

 function loadSavedSettlements(){try{const raw=localStorage.getItem(STORAGE_KEY)||localStorage.getItem(OLD_STORAGE_KEY);const p=raw?JSON.parse(raw):[];setSavedSettlements(Array.isArray(p)?p.map((x:any)=>({...x,incomeMode:x.incomeMode==='manual'?'manual':'auto',manualIncome:n(x.manualIncome)})):[])}catch{setSavedSettlements([])}}
 useEffect(()=>loadSavedSettlements(),[]);

 function loadMonthlyAccount(){if(!equipmentId){setMonthlyIncome(0);setMonthlyManualExpenses(0);setLinkedExpenses(0);return}try{setLoadingAccount(true);const raw=localStorage.getItem(`monthly-ledger-v3-${equipmentId}-${year}-${month}`);let rows:DayRow[]=[];if(raw){const p=JSON.parse(raw);if(Array.isArray(p))rows=p}setMonthlyIncome(rows.reduce((s,r)=>s+n(r.tripPrice),0));setMonthlyManualExpenses(rows.reduce((s,r)=>s+n(r.expenseAmount),0));let ext:ExternalExpenseRecord[]=[];const er=localStorage.getItem(EXTERNAL_EXPENSE_KEY);if(er){const p=JSON.parse(er);if(Array.isArray(p))ext=p}setLinkedExpenses(ext.reduce((s,e)=>{if(String(e.equipmentId||'')!==String(equipmentId))return s;const d=getDateParts(e.date||'');return d&&d.year===year&&d.month===month+1?s+n(e.amount):s},0));}catch(e){console.error(e);setMonthlyIncome(0);setMonthlyManualExpenses(0);setLinkedExpenses(0)}finally{setLoadingAccount(false)}}
 useEffect(()=>loadMonthlyAccount(),[equipmentId,year,month]);

 const effectiveIncome=incomeMode==='manual'?manualIncome:monthlyIncome; const totalExpenses=monthlyManualExpenses+linkedExpenses+additionalExpenses; const distributable=effectiveIncome-totalExpenses;
 const percentageTotal=useMemo(()=>partners.reduce((s,p)=>s+n(p.percentage),0),[partners]); const distributed=useMemo(()=>partners.reduce((s,p)=>s+distributable*(n(p.percentage)/100),0),[partners,distributable]); const difference=distributable-distributed;
 function updatePartner(id:string,field:keyof Omit<Partner,'id'>,value:string){setPartners(old=>old.map(p=>p.id===id?{...p,[field]:field==='percentage'||field==='paid'?n(value):value}:p))}
 function distributeEqually(){if(!partners.length)return;const base=Number((100/partners.length).toFixed(4));let used=0;setPartners(partners.map((p,i)=>{const percentage=i===partners.length-1?Number((100-used).toFixed(4)):base;used+=percentage;return{...p,percentage}}))}
 function validateAccount(){if(!equipmentId){alert('اختر المعدة أو الكرين');return false}if(!partners.length){alert('أضف شريكاً واحداً على الأقل');return false}if(partners.some(p=>!p.name.trim())){alert('أدخل أسماء جميع الشركاء');return false}if(Math.abs(percentageTotal-100)>.01){alert(`مجموع نسب الشركاء يجب أن يكون 100%.\nالمجموع الحالي: ${percentageTotal.toFixed(2)}%`);return false}return true}
 function createRecord():SavedSettlement{return{id:editingId||String(Date.now()),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),equipmentId,equipmentName,year,month,incomeMode,manualIncome,monthlyIncome,monthlyManualExpenses,linkedExpenses,additionalExpenses,totalExpenses,distributable,partners:partners.map(p=>({...p}))}}
 function saveSettlement(){if(!validateAccount())return;const record=createRecord();let list=[...savedSettlements];const idx=list.findIndex(x=>x.id===record.id);if(idx>=0)list[idx]={...record,createdAt:list[idx].createdAt};else list=[record,...list];localStorage.setItem(STORAGE_KEY,JSON.stringify(list));setSavedSettlements(list);setEditingId(record.id);alert('تم حفظ حساب الشركاء بنجاح')}
 function openSettlement(i:SavedSettlement){setEditingId(i.id);setEquipmentId(String(i.equipmentId));setYear(i.year);setMonth(i.month);setIncomeMode(i.incomeMode==='manual'?'manual':'auto');setManualIncome(n(i.manualIncome));setMonthlyIncome(n(i.monthlyIncome));setMonthlyManualExpenses(n(i.monthlyManualExpenses));setLinkedExpenses(n(i.linkedExpenses));setAdditionalExpenses(n(i.additionalExpenses));setPartners(i.partners?.map(p=>({...p,id:p.id||`${Date.now()}-${Math.random()}`}))||[]);setHistoryOpen(false);window.scrollTo({top:0,behavior:'smooth'})}
 function deleteSettlement(id:string){if(!confirm('هل تريد حذف حساب الشركاء المحفوظ؟'))return;const next=savedSettlements.filter(x=>x.id!==id);localStorage.setItem(STORAGE_KEY,JSON.stringify(next));setSavedSettlements(next);if(editingId===id)setEditingId(null)}
 function newSettlement(){setEditingId(null);setIncomeMode('auto');setManualIncome(0);setAdditionalExpenses(0);setPartners([makePartner(),makePartner(),makePartner()]);loadMonthlyAccount()}

 async function buildPdf(){
  if(!validateAccount()) return null;

  const report=document.createElement('div');
  report.dir='rtl';
  report.style.cssText='position:fixed;left:-10000px;top:0;width:794px;min-height:1123px;background:#fff;color:#10233d;font-family:Arial,Tahoma,sans-serif;box-sizing:border-box;overflow:hidden;';

  const fmt=(v:number)=>n(v).toLocaleString('en-US',{maximumFractionDigits:2});
  const reportNo=`PA-${String(equipmentId||'CR').replace(/[^a-zA-Z0-9]/g,'').slice(-6)}-${year}-${String(month+1).padStart(2,'0')}`;
  const issueDate=new Date().toLocaleDateString('en-GB');
  const rows=partners.map((p,index)=>{
    const due=distributable*n(p.percentage)/100;
    const remaining=due-n(p.paid);
    return `<tr>
      <td>${index+1}</td><td class="name">${p.name}</td><td>${fmt(p.percentage)}%</td>
      <td>${fmt(due)}</td><td>${fmt(p.paid)}</td><td class="remain">${fmt(remaining)}</td>
    </tr>`;
  }).join('');

  report.innerHTML=`
   <style>
    *{box-sizing:border-box} .page{width:794px;min-height:1123px;background:#fff;position:relative;padding-bottom:86px}
    .hero{height:218px;background:linear-gradient(120deg,#03182e 0%,#062846 58%,#0a3558 100%);color:white;padding:26px 34px;position:relative;overflow:hidden;border-bottom:7px solid #f5a623}
    .hero:after{content:'';position:absolute;left:-80px;bottom:-130px;width:410px;height:270px;border:3px solid rgba(245,166,35,.25);transform:rotate(-12deg);border-radius:50%}
    .brand{position:absolute;left:34px;top:27px;text-align:left;direction:ltr}.brand-main{font-size:37px;font-weight:900;letter-spacing:1px}.brand-main span{color:#f5a623}.brand-sub{font-size:10px;letter-spacing:1.2px;margin-top:2px;color:#d8e5f0}
    .crane{position:absolute;left:320px;top:31px;width:210px;height:115px;opacity:.95}.boom{height:8px;width:185px;background:#f5a623;transform:rotate(-13deg);transform-origin:left;border-radius:5px;position:absolute;top:35px;left:0}.cab{position:absolute;width:68px;height:47px;border:7px solid #f5a623;left:90px;top:56px;border-radius:8px 18px 5px 5px}.wheel{position:absolute;width:22px;height:22px;border:6px solid #f5a623;border-radius:50%;top:96px}.w1{left:96px}.w2{left:146px}.hook{position:absolute;width:2px;height:55px;background:#f5a623;left:181px;top:8px}.hook:after{content:'J';font-size:22px;color:#f5a623;position:absolute;bottom:-17px;left:-3px;font-weight:900}
    .title{position:absolute;right:35px;top:31px;text-align:right}.title h1{font-size:31px;margin:0 0 4px;font-weight:900}.title .en{font-size:17px;letter-spacing:.7px;color:#dce8f2}.title .line{width:145px;height:3px;background:#f5a623;margin:12px 0 10px auto}.title .slogan{font-size:13px;color:#f5c96e;font-weight:700}
    .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:18px 28px 12px}.meta-card{background:#f5f8fc;border:1px solid #edf1f6;border-radius:12px;padding:12px;text-align:center;min-height:66px}.meta-label{font-size:10px;color:#66778a;margin-bottom:7px}.meta-value{font-size:13px;font-weight:900;color:#10233d}
    .section{margin:8px 28px 0}.section-title{background:linear-gradient(90deg,#062846,#0b3c62);color:white;border-radius:8px;padding:10px 16px;font-size:16px;font-weight:900;display:flex;justify-content:space-between;align-items:center}.section-title small{font-size:10px;font-weight:500;opacity:.9;direction:ltr}
    .summary{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin-top:12px}.sum{border-radius:12px;padding:13px 7px;text-align:center;border:1px solid #e5eaf0;background:#fafcfe}.sum.income{background:#effcf5;border-color:#c9efda}.sum.total{background:#eef8ff;border-color:#cce8fa}.sum-label{font-size:10px;font-weight:800;min-height:25px}.sum-value{font-size:18px;font-weight:900;margin-top:5px;color:#14283f}.sum.income .sum-value{color:#087c3e}.sum.total .sum-value{color:#0b5d94}.sar{font-size:9px;color:#66778a;margin-top:2px}
    .net{margin-top:13px;border:2px solid #38a76a;background:linear-gradient(90deg,#ecfff4,#f7fffa);border-radius:12px;padding:12px 18px;display:flex;align-items:center;justify-content:space-between}.net-label{font-size:15px;font-weight:900}.net-label small{display:block;font-size:9px;color:#3e6a54;margin-top:4px;direction:ltr}.net-value{font-size:27px;font-weight:900;color:#07833f}.net-value span{font-size:10px;display:block;text-align:center;color:#217b4c}
    table{width:100%;border-collapse:separate;border-spacing:0;margin-top:10px;font-size:11px;text-align:center;overflow:hidden;border:1px solid #dbe4ed;border-radius:9px}th{background:#082c4d;color:#fff;padding:10px 5px;font-weight:800}td{padding:10px 5px;border-bottom:1px solid #dbe4ed;border-left:1px solid #e4eaf0;font-weight:700}tr:last-child td{border-bottom:0}.name{font-weight:900}.remain{color:#087c3e;font-weight:900}
    .totals{background:#eaf6ff!important;color:#0a3558;font-weight:900}.notes{margin-top:13px;background:#f7f9fc;border:1px solid #e6ebf1;border-radius:10px;padding:11px 15px;font-size:9px;line-height:1.8;color:#526274}.notes b{color:#0a3558;font-size:11px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:90px;margin:17px 35px 0;text-align:center;font-size:11px;font-weight:800}.sign-line{border-bottom:1px dashed #6b7b8c;height:25px}
    .footer{position:absolute;bottom:0;left:0;right:0;height:70px;background:#03182e;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 32px;border-top:5px solid #f5a623}.footer-brand{direction:ltr;font-size:20px;font-weight:900}.footer-brand span{color:#f5a623}.footer-mid{text-align:center;font-size:10px}.footer-mid b{display:block;font-size:12px;margin-bottom:3px}.footer-date{font-size:9px;text-align:right}
   </style>
   <div class="page">
    <div class="hero">
      <div class="brand"><div class="brand-main">BAKR <span>PRO</span></div><div class="brand-sub">CRANE MANAGEMENT SOLUTIONS</div></div>
      <div class="crane"><div class="boom"></div><div class="cab"></div><div class="wheel w1"></div><div class="wheel w2"></div><div class="hook"></div></div>
      <div class="title"><h1>حساب الشركاء</h1><div class="en">PARTNERS ACCOUNT</div><div class="line"></div><div class="slogan">إدارة أسهل • حساب أدق • شراكة أوضح</div></div>
    </div>
    <div class="meta">
      <div class="meta-card"><div class="meta-label">رقم التقرير</div><div class="meta-value">${reportNo}</div></div>
      <div class="meta-card"><div class="meta-label">تاريخ الإصدار</div><div class="meta-value">${issueDate}</div></div>
      <div class="meta-card"><div class="meta-label">الشهر</div><div class="meta-value">${monthNames[month]} ${year}</div></div>
      <div class="meta-card"><div class="meta-label">اسم الكرين / المعدة</div><div class="meta-value">${equipmentName||'—'}</div></div>
    </div>
    <div class="section">
      <div class="section-title"><span>الملخص المالي</span><small>FINANCIAL SUMMARY</small></div>
      <div class="summary">
       <div class="sum income"><div class="sum-label">إجمالي الدخل</div><div class="sum-value">${fmt(effectiveIncome)}</div><div class="sar">ريال سعودي</div></div>
       <div class="sum"><div class="sum-label">مصاريف الحساب الشهري</div><div class="sum-value">${fmt(monthlyManualExpenses)}</div><div class="sar">ريال سعودي</div></div>
       <div class="sum"><div class="sum-label">مصاريف السواقين والمعدات</div><div class="sum-value">${fmt(linkedExpenses)}</div><div class="sar">ريال سعودي</div></div>
       <div class="sum"><div class="sum-label">مصاريف إضافية</div><div class="sum-value">${fmt(additionalExpenses)}</div><div class="sar">ريال سعودي</div></div>
       <div class="sum total"><div class="sum-label">إجمالي المصاريف</div><div class="sum-value">${fmt(totalExpenses)}</div><div class="sar">ريال سعودي</div></div>
      </div>
      <div class="net"><div class="net-label">صافي المبلغ القابل للتوزيع<small>NET AMOUNT TO BE DISTRIBUTED</small></div><div class="net-value">${fmt(distributable)}<span>ريال سعودي</span></div></div>
    </div>
    <div class="section" style="margin-top:15px">
      <div class="section-title"><span>توزيع الشركاء</span><small>PARTNERS DISTRIBUTION</small></div>
      <table><thead><tr><th>م</th><th>اسم الشريك</th><th>النسبة</th><th>المستحق</th><th>المسحوب</th><th>المتبقي</th></tr></thead><tbody>${rows}
      <tr class="totals"><td colspan="2">الإجمالي</td><td>${fmt(percentageTotal)}%</td><td>${fmt(distributed)}</td><td>${fmt(partners.reduce((s,p)=>s+n(p.paid),0))}</td><td>${fmt(partners.reduce((s,p)=>{const due=distributable*n(p.percentage)/100;return s+due-n(p.paid)},0))}</td></tr></tbody></table>
      <div class="notes"><b>ملاحظات</b><br>• تم احتساب التوزيع حسب النسب المحددة لكل شريك. &nbsp; • جميع المبالغ بالريال السعودي.<br>• مصدر الدخل: ${incomeMode==='manual'?'إدخال يدوي':'الحساب الشهري تلقائياً'}. &nbsp; • أي تعديل في الحساب ينعكس على مبالغ التوزيع.</div>
      <div class="signatures"><div><div>توقيع المسؤول</div><div class="sign-line"></div></div><div><div>اعتماد / ختم</div><div class="sign-line"></div></div></div>
    </div>
    <div class="footer"><div class="footer-brand">BAKR <span>PRO</span></div><div class="footer-mid"><b>كرينات • بوم ترك • معدات ثقيلة</b>CRANES • BOOM TRUCKS • HEAVY EQUIPMENT</div><div class="footer-date">${issueDate}<br>تم الإنشاء بواسطة BAKR PRO</div></div>
   </div>`;

  document.body.appendChild(report);
  try{
    await new Promise(resolve=>setTimeout(resolve,80));
    const canvas=await html2canvas(report,{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false});
    const img=canvas.toDataURL('image/jpeg',0.96);
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
    doc.addImage(img,'JPEG',0,0,210,297,undefined,'FAST');
    return doc;
  }finally{
    report.remove();
  }
 }
 async function savePdf(){
  try{
   setSavingPdf(true);
   const doc=await buildPdf(); if(!doc)return;
   const fileName=safeFileName(`BAKR-PRO-Partners-${equipmentName||'Equipment'}-${month+1}-${year}.pdf`);
   const base64=doc.output('datauristring').split(',')[1];
   await Filesystem.writeFile({path:`BAKR_PRO/${fileName}`,data:base64,directory:Directory.Documents,recursive:true});
   alert('تم حفظ ملف PDF بنجاح في المستندات');
  }catch(e){console.error(e);alert('تعذر حفظ ملف PDF')}finally{setSavingPdf(false)}
 }
 async function sharePdf(){
  try{
   setSavingPdf(true);
   const doc=await buildPdf(); if(!doc)return;
   const fileName=safeFileName(`BAKR-PRO-Partners-${equipmentName||'Equipment'}-${month+1}-${year}.pdf`);
   const base64=doc.output('datauristring').split(',')[1];
   const result=await Filesystem.writeFile({path:fileName,data:base64,directory:Directory.Cache});
   await Share.share({title:'حساب الشركاء - BAKR PRO',text:`حساب الشركاء - ${equipmentName} - ${monthNames[month]} ${year}`,url:result.uri,dialogTitle:'مشاركة حساب الشركاء'});
  }catch(e){console.error(e);alert('تعذر مشاركة ملف PDF')}finally{setSavingPdf(false)}
 }

 const inputStyle:React.CSSProperties={width:'100%',boxSizing:'border-box',padding:12,borderRadius:12,border:'1px solid #263b58',background:'#081526',color:'#fff',outline:'none',fontSize:13};
 const cardStyle:React.CSSProperties={background:'linear-gradient(145deg,#0d1b2f,#07111f)',border:'1px solid rgba(255,255,255,.08)',borderRadius:20,padding:14};
 const btn:React.CSSProperties={padding:13,borderRadius:13,border:'1px solid rgba(96,165,250,.25)',background:'rgba(59,130,246,.08)',color:'#93c5fd',fontWeight:800};

 return <AppLayout><div dir="rtl" style={{padding:16,paddingBottom:120,color:'#fff'}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><h1 style={{margin:0,fontSize:26}}>حساب الشركاء</h1><p style={{color:'#94a3b8',fontSize:11}}>توزيع صافي حساب الكرين على الشركاء</p></div><Users size={28} color="#60a5fa"/></div>
  <button style={{...btn,width:'100%',marginTop:12}} onClick={()=>{loadSavedSettlements();setHistoryOpen(true)}}><FolderOpen size={17}/> الحسابات المحفوظة ({savedSettlements.length})</button>
  <section style={{...cardStyle,marginTop:12}}><div><Truck size={17} color="#fbbf24"/> <b>المعدة / الكرين</b></div><select value={equipmentId} onChange={e=>setEquipmentId(e.target.value)} disabled={equipmentLoading} style={{...inputStyle,marginTop:8}}>{!equipmentList.length&&<option value="">لا توجد معدات</option>}{equipmentList.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}><select value={month} onChange={e=>setMonth(n(e.target.value))} style={inputStyle}>{monthNames.map((x,i)=><option key={x} value={i}>{x}</option>)}</select><input type="number" value={year} onChange={e=>setYear(n(e.target.value))} style={inputStyle}/></div></section>
  <section style={{...cardStyle,marginTop:12}}><b>مصدر الدخل</b><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}><button style={btn} onClick={()=>setIncomeMode('auto')}>تلقائي</button><button style={btn} onClick={()=>setIncomeMode('manual')}>مبلغ يدوي</button></div>{incomeMode==='auto'?<><div style={{textAlign:'center',marginTop:10,color:'#4ade80',fontWeight:900,fontSize:20}}>{money(monthlyIncome)}</div><button style={{...btn,width:'100%',marginTop:8}} onClick={loadMonthlyAccount}><RefreshCw size={16}/> {loadingAccount?'جاري...':'تحديث الآن'}</button></>:<input type="number" inputMode="decimal" value={manualIncome||''} onChange={e=>setManualIncome(n(e.target.value))} placeholder="اكتب مبلغ الدخل" style={{...inputStyle,marginTop:10,fontSize:17}}/>}</section>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:12}}><Summary label="إجمالي الدخل" value={money(effectiveIncome)} color="#4ade80" icon={<TrendingUp size={17}/>}/><Summary label="مصاريف الحساب الشهري" value={money(monthlyManualExpenses)} color="#fb7185" icon={<TrendingDown size={17}/>}/><Summary label="مصاريف السواقين والمعدات" value={money(linkedExpenses)} color="#fb923c"/><Summary label="إجمالي المصاريف" value={money(totalExpenses)} color="#f87171"/></div>
  <section style={{...cardStyle,marginTop:12}}><label style={{fontSize:11,color:'#94a3b8'}}>مصاريف إضافية خاصة بالشراكة</label><input type="number" value={additionalExpenses||''} onChange={e=>setAdditionalExpenses(n(e.target.value))} style={{...inputStyle,marginTop:7}}/></section>
  <section style={{...cardStyle,marginTop:12,textAlign:'center'}}><Wallet size={25} color="#60a5fa"/><div style={{fontSize:11,color:'#94a3b8'}}>صافي المبلغ القابل للتوزيع</div><div style={{fontSize:25,fontWeight:900,color:distributable>=0?'#4ade80':'#fb7185'}}>{money(distributable)}</div></section>
  <section style={{...cardStyle,marginTop:12}}><div style={{display:'flex',justifyContent:'space-between'}}><div><b>الشركاء</b><div style={{fontSize:11,color:'#fbbf24'}}>مجموع النسب: {percentageTotal.toFixed(2)}%</div></div><button style={btn} onClick={distributeEqually}>توزيع متساوي</button></div>{partners.map((p,index)=>{const due=distributable*p.percentage/100,remaining=due-p.paid;return <div key={p.id} style={{padding:10,border:'1px solid rgba(255,255,255,.08)',borderRadius:14,marginTop:10}}><div style={{display:'flex',justifyContent:'space-between'}}><b>الشريك {index+1}</b>{partners.length>1&&<button onClick={()=>setPartners(old=>old.filter(x=>x.id!==p.id))} style={{background:'transparent',border:0,color:'#fb7185'}}><Trash2 size={17}/></button>}</div><input placeholder="اسم الشريك" value={p.name} onChange={e=>updatePartner(p.id,'name',e.target.value)} style={{...inputStyle,marginTop:8}}/><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}><input type="number" placeholder="النسبة %" value={p.percentage||''} onChange={e=>updatePartner(p.id,'percentage',e.target.value)} style={inputStyle}/><input type="number" placeholder="السحوبات / المدفوع" value={p.paid||''} onChange={e=>updatePartner(p.id,'paid',e.target.value)} style={inputStyle}/></div><input placeholder="ملاحظات" value={p.notes} onChange={e=>updatePartner(p.id,'notes',e.target.value)} style={{...inputStyle,marginTop:8}}/><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}><Summary label="المستحق" value={money(due)} color="#4ade80" small/><Summary label="المتبقي" value={money(remaining)} color="#fbbf24" small/></div></div>})}<button style={{...btn,width:'100%',marginTop:10}} onClick={()=>setPartners(old=>[...old,makePartner()])}><Plus size={17}/> إضافة شريك</button></section>
  <div style={{marginTop:12}}><Summary label="فارق التوزيع" value={money(difference)} color={Math.abs(difference)<.01?'#4ade80':'#fbbf24'}/></div>
  <div style={{display:'grid',gap:8,marginTop:12}}><button style={{...btn,background:'#0f5fb7',color:'#fff'}} onClick={saveSettlement}><Save size={18}/> {editingId?'حفظ التعديلات':'حفظ حساب الشركاء'}</button><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><button style={btn} disabled={savingPdf} onClick={savePdf}><FileText size={17}/> حفظ PDF</button><button style={btn} disabled={savingPdf} onClick={sharePdf}><Share2 size={17}/> مشاركة PDF</button></div><button style={btn} onClick={newSettlement}>+ حساب شراكة جديد</button></div>
  {historyOpen&&<div style={{position:'fixed',inset:0,zIndex:99999,background:'rgba(2,6,15,.96)',overflowY:'auto',padding:18}}><div style={{maxWidth:430,margin:'0 auto'}}><div style={{display:'flex',justifyContent:'space-between'}}><h2>الحسابات المحفوظة</h2><button style={btn} onClick={()=>setHistoryOpen(false)}><X size={18}/></button></div>{!savedSettlements.length?<p>لا توجد حسابات محفوظة</p>:savedSettlements.map(i=><div key={i.id} style={{...cardStyle,marginTop:8}}><b>{i.equipmentName||'كرين'} — {monthNames[i.month]} {i.year}</b><div style={{color:'#4ade80',marginTop:5}}>{money(i.distributable)}</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}><button style={btn} onClick={()=>openSettlement(i)}><Pencil size={15}/> فتح وتعديل</button><button style={{...btn,color:'#fb7185'}} onClick={()=>deleteSettlement(i.id)}><Trash2 size={15}/> حذف</button></div></div>)}</div></div>}
 </div></AppLayout>
}

function Summary({label,value,color,small=false,icon}:{label:string;value:string;color:string;small?:boolean;icon?:React.ReactNode}){return <div style={{background:'linear-gradient(145deg,#0d1b2f,#07111f)',border:'1px solid rgba(255,255,255,.07)',borderRadius:small?12:17,padding:small?9:12,textAlign:'center'}}>{icon&&<div style={{color,display:'flex',justifyContent:'center'}}>{icon}</div>}<div style={{color:'#94a3b8',fontSize:small?9:10}}>{label}</div><div style={{color,fontWeight:900,fontSize:small?12:15,marginTop:5}}>{value}</div></div>}
