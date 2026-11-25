import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, Plus, Check, Clock3, Trash2, Pencil, PhoneCall, Truck, CalendarClock, ShieldCheck, Wallet, Wrench, Search, RotateCcw } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { fetchEquipment, type Equipment } from '@/lib/equipment';
import { categories, priorityLabels, repeatLabels, readReminders, writeReminders, newNativeId, nativeAlertsAvailable, scheduleNativeReminder, cancelNativeReminder, nextOccurrence, enableNativeAlerts, type CommandReminder, type ReminderCategory, type ReminderPriority, type ReminderRepeat } from '@/lib/commandReminders';

const dark = '#0c2039', gold = '#e7bd70';
const card: CSSProperties = { borderRadius: 19, background: '#fff', padding: 15, marginBottom: 12, boxShadow: '0 7px 25px #0000000a', color: dark };
const input: CSSProperties = { width: '100%', height: 46, padding: '0 12px', borderRadius: 11, border: '1px solid #cbd5e1', background: '#f8fafc', color: dark, fontSize: 15, boxSizing: 'border-box' };
const field: CSSProperties = { display: 'grid', gap: 5, fontWeight: 700, fontSize: 12, color: '#334155' };
const btn: CSSProperties = { padding: '11px 14px', border: 0, borderRadius: 11, fontWeight: 800, cursor: 'pointer', background: dark, color: '#fff', minHeight: 43 };
const localDateTime = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
const initialTime = () => localDateTime(new Date(Date.now() + 60 * 60 * 1000));
const fmt = (d: Date) => new Intl.DateTimeFormat('ar-SA', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }).format(d);
const destinations: Record<ReminderCategory, string> = { operation:'/daily-trips',collection:'/receivables', maintenance:'/operating-expenses',documents:'/equipment-documents',personal:'/' };
const icons: Record<ReminderCategory, typeof Truck> = { operation:Truck,collection:Wallet,maintenance:Wrench,documents:ShieldCheck,personal:CalendarClock };
const fresh = () => ({ title:'', details:'', category:'operation' as ReminderCategory, priority:'important' as ReminderPriority, repeat:'none' as ReminderRepeat, when:initialTime(), equipmentId:'', contactName:'', phone:'', destination:'/daily-trips' });

export function CommandCenterPage() {
  const navigate = useNavigate();
  const [items,setItems] = useState<CommandReminder[]>(readReminders);
  const [equipment,setEquipment] = useState<Equipment[]>([]);
  const [form,setForm] = useState(fresh);
  const [editing,setEditing] = useState<string | null>(null);
  const [showForm,setShowForm] = useState(false);
  const [filter,setFilter] = useState<'all'|'today'|'late'|'done'>('all');
  const [search,setSearch] = useState('');
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const [now,setNow] = useState(Date.now());
  useEffect(() => { fetchEquipment().then(setEquipment).catch(() => undefined); }, []);
  useEffect(() => {
    const update = () => {setItems(readReminders());setNow(Date.now());};
    document.addEventListener('visibilitychange',update);
    window.addEventListener('bakr-reminders-changed',update);
    return () => {document.removeEventListener('visibilitychange',update);window.removeEventListener('bakr-reminders-changed',update);};
  }, []);
  const set = <K extends keyof ReturnType<typeof fresh>>(key:K,value:ReturnType<typeof fresh>[K]) => setForm(old => ({...old,[key]:value}));
  const saveList=(list:CommandReminder[])=>{writeReminders(list);setItems(list);};
  const totals = useMemo(() => {
    const today = new Date(now).toDateString();
    const active = items.filter(r=>r.status==='open');
    return { today:active.filter(r=>nextOccurrence(r).toDateString()===today).length,
      overdue:active.filter(r=>r.repeat==='none' && new Date(r.dueAt).getTime()<now).length,
      upcoming:active.filter(r=>nextOccurrence(r).getTime()>now).length };
  }, [items,now]);
  const filtered = useMemo(() => items.filter(r=>{
    const due = nextOccurrence(r);
    if (filter==='done' && r.status!=='done') return false;
    if (filter!=='done' && r.status==='done') return false;
    if (filter==='today' && due.toDateString()!==new Date(now).toDateString()) return false;
    if (filter==='late' && !(r.repeat==='none' && new Date(r.dueAt).getTime()<now)) return false;
    const q=search.trim().toLowerCase();
    return !q || [r.title,r.details,r.contactName,r.equipmentName,categories[r.category]].join(' ').toLowerCase().includes(q);
  }).sort((a,b)=>nextOccurrence(a).getTime()-nextOccurrence(b).getTime()),[items,filter,search,now]);
  const reset =()=>{setForm(fresh());setEditing(null);setShowForm(false);};
  const openEdit=(r:CommandReminder)=>{
    setEditing(r.id);setForm({title:r.title,details:r.details,category:r.category,priority:r.priority,repeat:r.repeat,when:localDateTime(new Date(r.dueAt)),equipmentId:r.equipmentId,contactName:r.contactName,phone:r.phone,destination:r.destination});
    setShowForm(true);window.scrollTo({top:0,behavior:'smooth'});
  };
  const submit = async () => {
    if (busy) return;
    if (!form.title.trim() || !form.when || !Number.isFinite(new Date(form.when).getTime())) {setMessage('اكتب عنواناً واختر تاريخاً ووقتاً صحيحين.');return;}
    if(new Date(form.when).getTime()<=Date.now()) {setMessage('اختر موعداً مستقبلياً للمنبّه.');return;}
    const existing=items.find(x=>x.id===editing);
    const selected=equipment.find(e=>String(e.id)===form.equipmentId);
    const reminder:CommandReminder={id: existing?.id || `cmd-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      notificationId:existing?.notificationId || newNativeId(items), title:form.title.trim(),details:form.details.trim(),category:form.category,priority:form.priority,repeat:form.repeat,
      dueAt:new Date(form.when).toISOString(), equipmentId:form.equipmentId,equipmentName:selected?.name||existing?.equipmentName||'',contactName:form.contactName.trim(),phone:form.phone.trim(),destination:form.destination,
      status:'open',createdAt:existing?.createdAt||new Date().toISOString()};
    setBusy(true);
    try {
      const next=existing?items.map(r=>r.id===existing.id?reminder:r):[reminder,...items];
      saveList(next);
      const warning=await scheduleNativeReminder(reminder);
      reset();setMessage(warning || (nativeAlertsAvailable()?'تم حفظ المهمة وجدولة إشعار أندرويد.':'تم حفظ المهمة. إشعارات الخلفية تحتاج نسخة أندرويد.'));
    } catch {setMessage('تعذر حفظ المهمة. تحقق من مساحة التخزين.');}
    finally {setBusy(false);}
  };
  const done = async (r:CommandReminder) => {
    const completed = r.status !== 'done';
    try {saveList(items.map(x=>x.id===r.id?{...x,status:completed?'done':'open',completedAt:completed?new Date().toISOString():undefined}:x));
      if(completed) await cancelNativeReminder(r.notificationId); else setMessage(await scheduleNativeReminder({...r,status:'open'}) || 'تمت إعادة تفعيل التنبيه.');
    } catch {setMessage('تعذر تحديث التذكير.');}
  };
  const remove = async (r:CommandReminder) => {
    if (!window.confirm(`حذف التذكير «${r.title}»؟`)) return;
    try {saveList(items.filter(x=>x.id!==r.id));await cancelNativeReminder(r.notificationId);setMessage('تم حذف التذكير.');} catch {setMessage('تعذر حذف التذكير.');}
  };
  const snooze = async (r:CommandReminder,minutes:number) => {
    const updated={...r,dueAt:new Date(Date.now()+minutes*60000).toISOString(),repeat:'none' as ReminderRepeat};
    try {saveList(items.map(x=>x.id===r.id?updated:x));setMessage(await scheduleNativeReminder(updated)||`تم تأجيل المهمة ${minutes} دقيقة.`);} catch {setMessage('تعذر التأجيل.');}
  };
  return <AppLayout><div dir="rtl" style={{color:dark}}>
    <section style={{...card,background:'linear-gradient(140deg,#0b1b31,#15375c)',color:'#fff',padding:19}}>
      <div style={{fontSize:11,fontWeight:800,color:gold,letterSpacing:1}}>BAKR PRO • SMART CONTROL VIP</div>
      <h1 style={{fontSize:23,margin:'9px 0 3px',fontWeight:900}}>مركز القيادة والتنبيهات</h1>
      <p style={{fontSize:12,color:'#cbd5e1',margin:0}}>حجوزات الكرين • التحصيل • الصيانة • الوثائق • مهامك الشخصية</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8,marginTop:16}}>
        {[['اليوم',totals.today],['القادمة',totals.upcoming],['متأخرة',totals.overdue]].map(([name,n])=><div key={name} style={{padding:'10px 4px',textAlign:'center',borderRadius:12,background:'#ffffff12'}}><div style={{fontSize:22,fontWeight:900}}>{n}</div><span style={{fontSize:11,color:'#cbd5e1'}}>{name}</span></div>)}
      </div>
    </section>
    <section style={card}>
      <button style={{...btn,width:'100%',background:'#c08e39',fontSize:15}} onClick={()=>{if(showForm)reset();else {setForm(fresh());setEditing(null);setShowForm(true);}}}>
        <Plus size={17} style={{verticalAlign:'middle',marginLeft:7}}/> {showForm?'إغلاق نموذج التذكير':'إضافة تذكير جديد'}
      </button>
      {showForm && <div style={{display:'grid',gap:12,marginTop:17}}>
        <label style={field}>عنوان المهمة<input style={input} value={form.title} placeholder="مثلاً: إرسال كرين 50 طن للموقع" onChange={e=>set('title',e.target.value)}/></label>
        <label style={field}>نوع المهمة<select style={input} value={form.category} onChange={e=>{const c=e.target.value as ReminderCategory;setForm(f=>({...f,category:c,destination:destinations[c]}));}}>{Object.entries(categories).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
        <label style={field}>التاريخ والوقت<input style={input} type="datetime-local" value={form.when} onChange={e=>set('when',e.target.value)}/></label>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <label style={field}>التكرار<select style={input} value={form.repeat} onChange={e=>set('repeat',e.target.value as ReminderRepeat)}>{Object.entries(repeatLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
          <label style={field}>الأولوية<select style={input} value={form.priority} onChange={e=>set('priority',e.target.value as ReminderPriority)}>{Object.entries(priorityLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
        </div>
        <label style={field}>ربط التذكير بكرين (اختياري)<select style={input} value={form.equipmentId} onChange={e=>set('equipmentId',e.target.value)}><option value="">بدون كرين</option>{equipment.map(e=><option key={e.id} value={String(e.id)}>{e.name}</option>)}</select></label>
        <label style={field}>اسم العميل أو المسؤول (اختياري)<input style={input} value={form.contactName} onChange={e=>set('contactName',e.target.value)}/></label>
        <label style={field}>رقم الاتصال (اختياري)<input style={input} type="tel" dir="ltr" value={form.phone} onChange={e=>set('phone',e.target.value)}/></label>
        <label style={field}>تفاصيل وملاحظات<textarea style={{...input,height:75,padding:11,resize:'vertical'}} value={form.details} onChange={e=>set('details',e.target.value)} placeholder="موقع العمل، رقم المشروع، المطلوب..."/></label>
        <button disabled={busy} style={{...btn,background:'#147d56',opacity:busy?.6:1}} onClick={()=>void submit()}>{busy?'جار الحفظ...': editing?'حفظ التعديلات':'حفظ وجدولة التذكير'}</button>
      </div>}
      {!nativeAlertsAvailable() && <p style={{fontSize:11,color:'#92400e',marginBottom:0}}>المعاينة عبر المتصفح تحفظ المهام فقط؛ إشعارات أندرويد تعمل بعد بناء APK بإضافة التنبيهات.</p>}
    </section>
    <section style={card}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:10}}><b style={{fontSize:16}}>متابعة المهام</b><button style={{...btn,background:'#e2e8f0',color:dark,fontSize:11}} onClick={async()=>setMessage(await enableNativeAlerts()||'إشعارات أندرويد مسموحة.')}>فحص الإشعارات</button></div>
      <div style={{display:'flex',gap:5,overflowX:'auto',paddingBottom:8}}>{([['all','الكل'],['today','اليوم'],['late','المتأخرة'],['done','المكتملة']] as const).map(([key,label])=><button key={key} style={{...btn,whiteSpace:'nowrap',minHeight:37,padding:'7px 10px',background:filter===key?dark:'#f1f5f9',color:filter===key?'#fff':dark}} onClick={()=>{setNow(Date.now());setFilter(key);}}>{label}</button>)}</div>
      <div style={{position:'relative'}}><Search size={16} style={{position:'absolute',right:12,top:15,color:'#64748b'}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="بحث عن عميل أو كرين أو مهمة" style={{...input,paddingRight:35}}/></div>
    </section>
    {message && <div role="status" style={{...card,fontSize:12,background:'#fff8e7',border:'1px solid #f0d89b'}}>{message}</div>}
    {filtered.length===0 && <section style={{...card,textAlign:'center',padding:27}}><BellRing size={36} style={{margin:'auto',color:'#b38e50'}}/><b style={{display:'block',marginTop:8}}>لا توجد مهام في هذا العرض</b><p style={{fontSize:12,color:'#64748b'}}>أضف تذكيراً للمشروع أو العميل أو الكرين وسيظهر هنا.</p></section>}
    {filtered.map(r=>{const Icon=icons[r.category];const due=nextOccurrence(r);const late=r.repeat==='none'&&new Date(r.dueAt).getTime()<now&&r.status==='open';return <section key={r.id} style={{...card,borderRight:`4px solid ${r.status==='done'?'#16a34a':late?'#dc2626':r.priority==='urgent'?'#e59b28':'#cbd5e1'}`}}>
      <div style={{display:'flex',gap:10,alignItems:'start'}}><span style={{background:'#f1f5f9',padding:9,borderRadius:11,flexShrink:0}}><Icon size={21}/></span><div style={{flex:1,minWidth:0}}><b style={{fontSize:14}}>{r.title}</b><div style={{fontSize:11,color:'#64748b',marginTop:4}}>{categories[r.category]} • {priorityLabels[r.priority]} • {repeatLabels[r.repeat]}</div></div></div>
      <div style={{fontSize:12,color:late?'#b91c1c':'#475569',margin:'10px 0 3px',fontWeight:800}}><Clock3 size={14} style={{verticalAlign:'middle',marginLeft:5}}/>{fmt(due)} {late?'• متأخر':''} {r.status==='done'?'• مكتمل':''}</div>
      {(r.equipmentName||r.contactName)&&<div style={{fontSize:12,color:'#475569'}}> {r.equipmentName}{r.equipmentName&&r.contactName?' • ':''}{r.contactName}</div>}
      {r.details&&<p style={{fontSize:12,color:'#64748b',lineHeight:1.7,margin:'8px 0'}}>{r.details}</p>}
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:12}}>
        <button style={{...btn,background:r.status==='done'?'#e2e8f0':'#0f8b61',color:r.status==='done'?dark:'#fff',fontSize:12}} onClick={()=>void done(r)}>{r.status==='done'?<RotateCcw size={14} style={{verticalAlign:'middle'}}/>:<Check size={14} style={{verticalAlign:'middle'}}/>} {r.status==='done'?'إعادة فتح':'تم التنفيذ'}</button>
        {r.status==='open'&&<button style={{...btn,background:'#e9eef5',color:dark,fontSize:12}} onClick={()=>void snooze(r,10)}>تأجيل 10 دقائق</button>}
        <button aria-label="تعديل" style={{...btn,background:'#e9eef5',color:dark}} onClick={()=>openEdit(r)}><Pencil size={15}/></button>
        <button aria-label="حذف" style={{...btn,background:'#fee2e2',color:'#991b1b'}} onClick={()=>void remove(r)}><Trash2 size={15}/></button>
        {r.phone&&<button style={{...btn,background:'#dcefe7',color:'#166534'}} onClick={()=>window.location.href=`tel:${r.phone.replace(/[^\d+]/g,'')}`}><PhoneCall size={14}/></button>}
        {r.destination&&<button style={{...btn,background:'#e9eef5',color:dark,fontSize:12}} onClick={()=>navigate(r.destination)}>فتح القسم</button>}
      </div>
    </section>;})}
    <div style={{textAlign:'center',fontSize:11,color:'#cbd5e1',marginBottom:20}}>إشعارات أندرويد قد تتأثر بوضع توفير البطارية وإعدادات التنبيه الدقيق. إنذار ملء الشاشة غير مدعوم بهذه النسخة.</div>
  </div></AppLayout>;
}
export default CommandCenterPage;
