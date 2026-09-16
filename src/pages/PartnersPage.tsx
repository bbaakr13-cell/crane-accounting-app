import React, { useMemo, useState } from 'react';
import { Plus, Save, Trash2, Users } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';

type Partner = { id:string; name:string; percentage:number; paid:number; notes:string };
const STORAGE_KEY='bakr_pro_partner_settlements_v1';
const money=(v:number)=>`${(Number(v)||0).toLocaleString('en-US',{maximumFractionDigits:2})} ر.س`;
const n=(v:string|number)=>Number.isFinite(Number(v))?Number(v):0;
const makePartner=():Partner=>({id:`${Date.now()}-${Math.random()}`,name:'',percentage:0,paid:0,notes:''});

export function PartnersPage(){
 const [equipmentName,setEquipmentName]=useState('');
 const [income,setIncome]=useState(0);
 const [sharedExpenses,setSharedExpenses]=useState(0);
 const [partners,setPartners]=useState<Partner[]>([makePartner(),makePartner(),makePartner()]);
 const distributable=Math.max(0,income-sharedExpenses);
 const percentageTotal=useMemo(()=>partners.reduce((s,p)=>s+n(p.percentage),0),[partners]);
 const distributed=useMemo(()=>partners.reduce((s,p)=>s+distributable*(n(p.percentage)/100),0),[partners,distributable]);
 const difference=distributable-distributed;
 const input:React.CSSProperties={width:'100%',boxSizing:'border-box',padding:12,borderRadius:12,border:'1px solid #263b58',background:'#081526',color:'#fff',outline:'none'};
 const card:React.CSSProperties={background:'linear-gradient(145deg,#0d1b2f,#07111f)',border:'1px solid rgba(255,255,255,.08)',borderRadius:20,padding:14};
 function update(id:string,field:keyof Omit<Partner,'id'>,value:string){setPartners(old=>old.map(p=>p.id===id?{...p,[field]:field==='percentage'||field==='paid'?n(value):value}:p));}
 function save(){
  if(!equipmentName.trim()) return alert('اكتب اسم المعدة');
  if(income<=0) return alert('أدخل إجمالي الدخل');
  if(partners.some(p=>!p.name.trim())) return alert('أدخل أسماء الشركاء');
  if(Math.abs(percentageTotal-100)>.001) return alert(`مجموع النسب يجب أن يكون 100% — الحالي ${percentageTotal}%`);
  try{const old=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); const record={id:String(Date.now()),createdAt:new Date().toISOString(),equipmentName,income,sharedExpenses,distributable,partners}; localStorage.setItem(STORAGE_KEY,JSON.stringify([record,...(Array.isArray(old)?old:[])])); alert('تم حفظ تسوية الشركاء');}catch{alert('تعذر حفظ التسوية');}
 }
 return <AppLayout><div dir="rtl" style={{padding:16,paddingBottom:110,color:'#fff'}}>
  <h1 style={{margin:0,fontSize:26,fontWeight:900}}>حساب الشركاء</h1><p style={{color:'#94a3b8',fontSize:12}}>تسوية دخل ومصاريف الكرين وتوزيع الصافي حسب نسب الشركاء</p>
  <section style={card}><label style={{display:'block',color:'#94a3b8',fontSize:11,marginBottom:7}}>المعدة / الكرين</label><input value={equipmentName} onChange={e=>setEquipmentName(e.target.value)} placeholder="مثال: كرين 50 طن" style={input}/></section>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:12}}><NumberCard label="إجمالي الدخل" value={income} setValue={setIncome} color="#4ade80"/><NumberCard label="المصاريف المشتركة" value={sharedExpenses} setValue={setSharedExpenses} color="#fb7185"/></div>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:12}}><Summary label="صافي التوزيع" value={money(distributable)} color="#60a5fa"/><Summary label="الفارق" value={money(difference)} color={Math.abs(difference)<.01?'#4ade80':'#fbbf24'}/></div>
  <section style={{...card,marginTop:14}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}><div><strong style={{fontSize:18}}>الشركاء</strong><div style={{color:Math.abs(percentageTotal-100)<.001?'#4ade80':'#fbbf24',fontSize:11}}>مجموع النسب: {percentageTotal}%</div></div><Users color="#60a5fa"/></div>
  <div style={{display:'grid',gap:12}}>{partners.map((p,i)=>{const due=distributable*(p.percentage/100);const remaining=due-p.paid;return <div key={p.id} style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.07)',borderRadius:16,padding:12}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:9}}><strong>الشريك {i+1}</strong>{partners.length>1&&<button type="button" onClick={()=>setPartners(old=>old.filter(x=>x.id!==p.id))} style={{border:0,borderRadius:10,padding:8,background:'rgba(239,68,68,.12)',color:'#fb7185'}}><Trash2 size={17}/></button>}</div><input placeholder="اسم الشريك" value={p.name} onChange={e=>update(p.id,'name',e.target.value)} style={input}/><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}><input type="number" inputMode="decimal" placeholder="النسبة %" value={p.percentage||''} onChange={e=>update(p.id,'percentage',e.target.value)} style={input}/><input type="number" inputMode="decimal" placeholder="المدفوع / السحوبات" value={p.paid||''} onChange={e=>update(p.id,'paid',e.target.value)} style={input}/></div><input placeholder="ملاحظات" value={p.notes} onChange={e=>update(p.id,'notes',e.target.value)} style={{...input,marginTop:8}}/><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:9}}><Summary label="المستحق" value={money(due)} color="#4ade80" small/><Summary label="المتبقي" value={money(remaining)} color={remaining>0?'#fbbf24':'#60a5fa'} small/></div></div>})}</div>
  <button type="button" onClick={()=>setPartners(old=>[...old,makePartner()])} style={{width:'100%',marginTop:12,padding:13,borderRadius:13,border:'1px dashed rgba(96,165,250,.55)',background:'rgba(59,130,246,.08)',color:'#93c5fd',fontWeight:800,display:'flex',gap:6,justifyContent:'center',alignItems:'center'}}><Plus size={18}/>إضافة شريك</button></section>
  <button type="button" onClick={save} style={{width:'100%',marginTop:14,padding:16,border:0,borderRadius:16,background:'linear-gradient(135deg,#0f5fb7,#063a78)',color:'#fff',fontWeight:900,fontSize:15,display:'flex',gap:7,justifyContent:'center',alignItems:'center'}}><Save size={19}/>حفظ تسوية الشركاء</button>
 </div></AppLayout>;
}
function NumberCard({label,value,setValue,color}:{label:string;value:number;setValue:(v:number)=>void;color:string}){return <div style={{background:'linear-gradient(145deg,#0d1b2f,#07111f)',border:'1px solid rgba(255,255,255,.08)',borderRadius:20,padding:12}}><div style={{color:'#94a3b8',fontSize:10}}>{label}</div><input type="number" inputMode="decimal" value={value||''} onChange={e=>setValue(n(e.target.value))} placeholder="0" style={{width:'100%',boxSizing:'border-box',marginTop:8,padding:9,borderRadius:10,border:'1px solid #263b58',background:'#081526',color,fontWeight:900,fontSize:17,outline:'none'}}/></div>}
function Summary({label,value,color,small=false}:{label:string;value:string;color:string;small?:boolean}){return <div style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.07)',borderRadius:small?12:17,padding:small?9:12,textAlign:'center'}}><div style={{color:'#94a3b8',fontSize:small?9:11}}>{label}</div><div style={{color,fontWeight:900,fontSize:small?12:16,marginTop:5}}>{value}</div></div>}
