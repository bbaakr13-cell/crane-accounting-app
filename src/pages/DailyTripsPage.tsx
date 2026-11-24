import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { fetchEquipment, type Equipment } from '@/lib/equipment';
import { CalendarDays, Truck, Save, FileText, Send, Wallet, ExternalLink } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

type Mode = 'trip' | 'daily';
type Entry = {
  id: string; mode: Mode; equipmentId: string; equipmentName: string;
  client: string; date: string; site: string; description: string;
  price: number; paid: number; expenseType: string; expenseAmount: number;
  notes: string; createdAt: string;
};
type OldDayRow = { day: number; workType?: string; tripType?: string; tripPrice?: number; expenseType?: string; expenseAmount?: number; notes?: string };
const KEY = 'bakr_pro_trips_daily_entries_v1';
const cleanNumber = (value: string) => value.replace(/[٠-٩]/g, x => String('٠١٢٣٤٥٦٧٨٩'.indexOf(x))).replace(/[۰-۹]/g, x => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(x))).replace(/[,،\s]/g, '');
const num = (v: string) => Number(cleanNumber(v));
const valid = (v: string) => cleanNumber(v) !== '' && Number.isFinite(num(v)) && num(v) >= 0;
const fmt = (v: number) => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const currentDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const getEntries = (): Entry[] => { try { const value = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
const monthKey = (id: string, date: string) => { const [y,m] = date.split('-').map(Number); return `monthly-ledger-v3-${id}-${y}-${m-1}`; };
const safeName = (name: string) => name.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g,' ').replace(/\s+/g,' ').slice(0,70) || 'عميل';
const field = 'w-full min-h-[49px] rounded-[13px] px-3 bg-[#091525] border border-white/10 text-white text-[13px] outline-none placeholder:text-slate-500';
const section = 'rounded-[21px] border border-white/10 p-4 mb-4 bg-[#0e1d30]';
const label = 'block text-[12px] font-bold text-slate-300 mb-2';

/** We preserve the existing monthly-ledger-v3 data. New movements are marked in its notes
 * so a later save never counts the same entry twice. Never overwrite a legacy row. */
function addToMonthlyLedger(entry: Entry) {
  const key = monthKey(entry.equipmentId, entry.date);
  const previous = localStorage.getItem(key);
  const rows: OldDayRow[] = previous ? JSON.parse(previous) : [];
  if (!Array.isArray(rows)) throw new Error('بيانات الحساب الشهري ليست قائمة؛ توقف الحفظ حفاظاً عليها');
  const day = Number(entry.date.slice(-2));
  const marker = `[BAKR:${entry.id}]`;
  const at = rows.findIndex(row => Number(row.day) === day);
  const old = at >= 0 ? rows[at] : { day };
  if ((old.notes || '').includes(marker)) return { key, previous };
  const info = `${marker} ${entry.mode === 'trip' ? 'مشوار' : 'يومية'}: ${entry.client} - ${entry.description || entry.site}`;
  const next: OldDayRow = {
    ...old, day,
    workType: old.workType || (entry.mode === 'trip' ? 'مشاوير' : 'يوميات'),
    tripType: old.tripType || entry.site,
    tripPrice: Number(old.tripPrice || 0) + entry.price,
    expenseType: old.expenseType || entry.expenseType,
    expenseAmount: Number(old.expenseAmount || 0) + entry.expenseAmount,
    notes: [old.notes || '', info].filter(Boolean).join(' | '),
  };
  if (at < 0) rows.push(next); else rows[at] = next;
  rows.sort((a,b) => Number(a.day) - Number(b.day));
  localStorage.setItem(key, JSON.stringify(rows));
  return { key, previous };
}

export function DailyTripsPage() {
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState('');
  const [mode, setMode] = useState<Mode>('trip');
  const [date, setDate] = useState(currentDate());
  const [client, setClient] = useState('');
  const [site, setSite] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [paid, setPaid] = useState('0');
  const [expenseType, setExpenseType] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [entries, setEntries] = useState<Entry[]>(getEntries);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [showStatement, setShowStatement] = useState(false);
  const [filterClient, setFilterClient] = useState('');
  const [filterEquipment, setFilterEquipment] = useState('');
  const [filterMode, setFilterMode] = useState<Mode>('trip');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetchEquipment().then(v => {
      if (!active) return;
      setEquipment(v || []);
      setEquipmentId(old => old || String(v?.[0]?.id || ''));
    }).catch(() => { if(active) setError('تعذر تحميل الكرينات المحفوظة'); })
      .finally(() => { if(active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const equip = equipment.find(x => String(x.id) === equipmentId);
  const equipName = String(equip?.name || '');
  const clients = useMemo(() => [...new Set(entries.map(x => x.client))].sort(), [entries]);
  const matching = useMemo(() => entries.filter(x => x.client === filterClient && x.mode === filterMode &&
    (!filterEquipment || x.equipmentId === filterEquipment) && (!from || x.date >= from) && (!to || x.date <= to))
    .sort((a,b) => a.date.localeCompare(b.date)), [entries, filterClient, filterMode, filterEquipment, from, to]);
  const selected = matching.filter(x => selectedIds.includes(x.id));
  const total = selected.reduce((sum,x) => sum + x.price, 0);
  const received = selected.reduce((sum,x) => sum + x.paid, 0);
  const balance = total - received;
  const selectFilter = (c: string, m: Mode, e: string, a: string, b: string) => {
    const found = entries.filter(x => x.client === c && x.mode === m && (!e || x.equipmentId === e) && (!a || x.date >= a) && (!b || x.date <= b));
    setSelectedIds(found.map(x => x.id));
  };

  const save = () => {
    setError(''); setNotice('');
    if (!equipmentId || !equip) return setError('اختر الكرين أولاً');
    if (!client.trim()) return setError('أدخل اسم العميل');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date+'T12:00:00').getTime())) return setError('حدد تاريخاً صحيحاً');
    if (!valid(price) || num(price) <= 0) return setError('أدخل سعر العمل بشكل صحيح');
    if (!valid(paid) || !valid(expenseAmount)) return setError('تأكد من المبلغ المستلم والمصروف');
    const entry: Entry = {
      id: `bt-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      mode, equipmentId, equipmentName: equipName, client: client.trim(), date, site: site.trim(),
      description: description.trim(), price: num(price), paid: num(paid), expenseType: expenseType.trim(),
      expenseAmount: num(expenseAmount), notes: notes.trim(), createdAt: new Date().toISOString(),
    };
    setBusy(true);
    const old = localStorage.getItem(KEY);
    let ledgerUpdate: { key: string; previous: string | null } | null = null;
    try {
      // Save the detail and its monthly summary; if the monthly write fails, restore details.
      const next = [entry, ...entries];
      localStorage.setItem(KEY, JSON.stringify(next));
      ledgerUpdate = addToMonthlyLedger(entry);
      setEntries(next);
      setNotice(`تم حفظ ${mode === 'trip' ? 'المشوار' : 'اليومية'} للعميل ${entry.client} وربطه بالحساب الشهري`);
      setPrice(''); setPaid('0'); setDescription(''); setExpenseType(''); setExpenseAmount('0'); setNotes('');
    } catch (err) {
      try { if (old === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, old); } catch { /* report error below */ }
      if (ledgerUpdate) { try { if (ledgerUpdate.previous === null) localStorage.removeItem(ledgerUpdate.key); else localStorage.setItem(ledgerUpdate.key, ledgerUpdate.previous); } catch { /* preserve error */ } }
      setError(err instanceof Error ? `تعذر الحفظ: ${err.message}` : 'تعذر الحفظ؛ راجع مساحة التخزين');
    } finally { setBusy(false); }
  };

  const makePdf = async (action: 'save' | 'share') => {
    setError(''); setNotice('');
    if (selected.length === 0) return setError('حدد حركة واحدة على الأقل لإصدار الكشف');
    if (!reportRef.current || busy) return;
    setBusy(true);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const pages = Array.from(reportRef.current.querySelectorAll<HTMLElement>('[data-statement-page]'));
      const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4', compress:true });
      for (let i=0; i<pages.length; i++) {
        const canvas = await html2canvas(pages[i], { scale: 2.2, backgroundColor:'#ffffff', useCORS:true, logging:false, windowWidth:1200 });
        if(i) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg',0.9),'JPEG',0,0,210,297);
        canvas.width=0; canvas.height=0;
      }
      const filename = `كشف ${filterMode === 'trip' ? 'مشاوير' : 'يوميات'} - ${safeName(filterClient)} - ${Date.now()}.pdf`;
      const base64 = pdf.output('datauristring').split(',')[1];
      if(action === 'share') {
        const saved = await Filesystem.writeFile({ path:`BAKR-Statements/${filename}`, data:base64, directory:Directory.Cache, recursive:true });
        await Share.share({ title:'كشف حساب العميل - BAKR PRO', url:saved.uri, dialogTitle:'إرسال كشف PDF' });
        setNotice('اختر واتساب لإرسال كشف الحساب');
      } else {
        try { await Filesystem.writeFile({ path:filename, data:base64, directory:Directory.Documents, recursive:true }); setNotice(`تم حفظ ${filename}`); }
        catch { const a=document.createElement('a'); a.href=`data:application/pdf;base64,${base64}`; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setNotice('تم طلب تنزيل الكشف؛ راجع التنزيلات'); }
      }
    } catch(err) { console.error(err); setError('تعذر إنشاء أو مشاركة كشف PDF؛ تأكد من أذونات الملفات وحاول مجدداً'); }
    finally { setBusy(false); }
  };

  const input = (caption:string, value:string, onChange:(v:string)=>void, type='text', placeholder='') =>
    <label className="block"><span className={label}>{caption}</span><input className={field} type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></label>;

  return <AppLayout><div dir="rtl" className="w-full pb-8 text-white">
    <header className="rounded-[23px] p-5 mb-4 bg-gradient-to-br from-[#172d48] to-[#071321] border border-amber-500/20">
      <div className="text-amber-400 text-[10px] font-black tracking-widest">BAKR PRO</div>
      <h1 className="text-[21px] font-black mt-1">مشاوير يومية</h1>
      <p className="text-slate-300 text-[12px] mt-1">تسجيل سريع • حسابات العملاء • كشوف PDF</p>
    </header>
    {error && <p role="alert" className="rounded-xl p-3 bg-red-950 text-red-200 mb-3 text-sm">{error}</p>}
    {notice && <p role="status" className="rounded-xl p-3 bg-green-950 text-green-200 mb-3 text-sm">{notice}</p>}
    <section className={section}>
      <h2 className="text-[15px] font-black mb-3">نوع التسجيل</h2>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {([['trip','مشوار'],['daily','يومية']] as const).map(([v,n])=><button key={v} type="button" onClick={()=>{setMode(v);setError('');}} className={`rounded-xl py-3 font-black text-[14px] ${mode===v?'bg-amber-500 text-[#101b2c]':'bg-[#091525] text-slate-200 border border-white/10'}`}>{n}</button>)}
      </div>
      <div className="space-y-3">
        {input('التاريخ',date,setDate,'date')}
        <label className="block"><span className={label}>الكرين / المعدة</span><select className={field} value={equipmentId} onChange={e=>setEquipmentId(e.target.value)} disabled={loading}>
          <option value="">{loading?'جاري تحميل الكرينات':'اختر الكرين'}</option>
          {equipment.map(e=><option key={e.id} value={String(e.id)}>{e.name}</option>)}
        </select></label>
        {input('اسم العميل',client,setClient,'text','اسم الشركة أو الزبون')}
        {input('موقع العمل',site,setSite,'text','مثال: خميس مشيط')}
        {input(mode==='trip'?'وصف المشوار (اختياري)':'وصف اليومية (اختياري)',description,setDescription,'text','مثال: رفع كونتينر')}
        {input(mode==='trip'?'سعر المشوار (ريال)':'سعر اليومية (ريال)',price,setPrice,'text','0')}
        {input('المبلغ المستلم (اختياري)',paid,setPaid,'text','0')}
      </div>
      <details className="mt-4 text-[12px] text-slate-300"><summary className="cursor-pointer font-bold">مصروف وملاحظات (اختياري)</summary>
        <div className="space-y-3 pt-3">
          {input('بيان المصروف',expenseType,setExpenseType,'text','ديزل أو غيره')}
          {input('مبلغ المصروف',expenseAmount,setExpenseAmount,'text','0')}
          {input('ملاحظات',notes,setNotes)}
        </div>
      </details>
      <button type="button" disabled={busy||loading} onClick={save} className="w-full rounded-2xl py-4 bg-green-700 text-white font-black mt-4 flex justify-center items-center gap-2 disabled:opacity-50"><Save size={19}/> حفظ {mode==='trip'?'المشوار':'اليومية'}</button>
    </section>
    <button type="button" onClick={()=>{setShowStatement(x=>!x);setError('');}} className="w-full rounded-2xl py-4 mb-4 bg-amber-500 text-[#101b2c] font-black flex justify-center items-center gap-2"><FileText size={19}/> استخراج كشف حساب العميل</button>
    {showStatement && <section className={section}>
      <h2 className="font-black mb-3">استخراج كشف حساب العميل</h2>
      <div className="grid grid-cols-2 gap-2 mb-4">{([['trip','مشاوير'],['daily','يوميات']] as const).map(([m,t])=><button type="button" key={m} onClick={()=>{setFilterMode(m);selectFilter(filterClient,m,filterEquipment,from,to);}} className={`py-3 rounded-xl font-black ${filterMode===m?'bg-amber-500 text-[#101b2c]':'bg-[#091525] border border-white/10'}`}>{t}</button>)}</div>
      <div className="space-y-3">
        <label className="block"><span className={label}>العميل</span><select className={field} value={filterClient} onChange={e=>{setFilterClient(e.target.value);selectFilter(e.target.value,filterMode,filterEquipment,from,to);}}><option value="">اختر العميل</option>{clients.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
        <label className="block"><span className={label}>الكرين (اختياري: جميع الكرينات)</span><select className={field} value={filterEquipment} onChange={e=>{setFilterEquipment(e.target.value);selectFilter(filterClient,filterMode,e.target.value,from,to);}}><option value="">جميع الكرينات</option>{equipment.map(e=><option key={e.id} value={String(e.id)}>{e.name}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-2">{input('من تاريخ',from,v=>{setFrom(v);selectFilter(filterClient,filterMode,filterEquipment,v,to);},'date')}{input('إلى تاريخ',to,v=>{setTo(v);selectFilter(filterClient,filterMode,filterEquipment,from,v);},'date')}</div>
      </div>
      <div className="flex justify-between items-center mt-4 mb-2"><b className="text-[13px]">{filterMode==='trip'?'المشاوير':'اليوميات'} المسجلة ({matching.length})</b><button type="button" className="text-amber-400 text-[12px]" onClick={()=>setSelectedIds(matching.map(x=>x.id))}>تحديد الكل</button></div>
      <div className="max-h-64 overflow-y-auto space-y-2">{matching.map(x=><label key={x.id} className="flex gap-2 items-center rounded-xl p-3 bg-[#091525] border border-white/10 text-[12px]"><input type="checkbox" checked={selectedIds.includes(x.id)} onChange={e=>setSelectedIds(old=>e.target.checked?[...old,x.id]:old.filter(id=>id!==x.id))}/><span className="flex-1">{x.date} • {x.equipmentName}<br/><span className="text-slate-400">{x.description || x.site || 'شغل كرين'}</span></span><b>{fmt(x.price)} ر.س</b></label>)}</div>
      {filterClient && matching.length===0 && <p className="text-slate-400 text-xs py-3">لا توجد حركات ضمن الاختيارات. السجلات القديمة التي لم يُسجل فيها اسم عميل لا يمكن تصنيفها تلقائياً.</p>}
      <div className="bg-[#091525] border border-white/10 rounded-xl p-3 mt-3 text-[13px] leading-8"><div>الحركات المحددة: <b>{selected.length}</b></div><div>الإجمالي: <b>{fmt(total)} ر.س</b></div><div>المستلم: <b>{fmt(received)} ر.س</b></div><div className="text-amber-400 font-black">المتبقي: {fmt(balance)} ر.س</div></div>
      <p className="text-[11px] text-slate-400 mt-2">المبالغ المستلمة هنا تخص العمليات المحددة فقط؛ لا تُوزع دفعات قديمة مجهولة تلقائياً على أيام أو مشاوير أخرى.</p>
      <div className="grid grid-cols-2 gap-2 mt-4"><button disabled={!selected.length||busy} type="button" className="bg-slate-700 rounded-xl py-3 font-black disabled:opacity-40" onClick={()=>void makePdf('save')}><FileText className="inline" size={16}/> حفظ PDF</button><button disabled={!selected.length||busy} type="button" className="bg-green-700 rounded-xl py-3 font-black disabled:opacity-40" onClick={()=>void makePdf('share')}><Send className="inline" size={16}/> إرسال واتساب</button></div>
    </section>}
    <section className={section}><h2 className="font-black text-[14px] mb-3">آخر الحركات المحفوظة</h2>{entries.length===0?<p className="text-slate-400 text-xs">لم تُسجل حركات جديدة بعد.</p>:entries.slice(0,10).map(x=><div key={x.id} className="py-2 border-b border-white/10 text-[12px] flex justify-between gap-2"><span><b>{x.client}</b> • {x.mode==='trip'?'مشوار':'يومية'}<br/><span className="text-slate-400">{x.date} • {x.equipmentName}</span></span><b className="text-green-400 whitespace-nowrap">{fmt(x.price)} ر.س</b></div>)}</section>
    <button type="button" onClick={()=>equipmentId && navigate(`/monthly/${equipmentId}`)} className="w-full rounded-2xl py-3 bg-[#12243a] border border-amber-500/20 text-amber-400 text-[12px] font-bold"><ExternalLink className="inline me-2" size={15}/> فتح الحساب الشهري للكرين</button>
    <div aria-hidden="true" style={{position:'fixed',left:-12000,top:0,width:794,pointerEvents:'none'}} ref={reportRef}>
      {Array.from({length:Math.max(1,Math.ceil(selected.length/12))},(_,page)=>{
        const rows=selected.slice(page*12,(page+1)*12); const last=page===Math.max(1,Math.ceil(selected.length/12))-1;
        return <div data-statement-page="true" key={page} dir="rtl" style={{height:1123,width:794,boxSizing:'border-box',padding:48,background:'#fff',color:'#12233d',fontFamily:'Tahoma, Arial, sans-serif',position:'relative'}}>
          <div style={{background:'#132b46',color:'white',padding:25,borderRadius:12,display:'flex',justifyContent:'space-between'}}><div><b style={{fontSize:26}}>BAKR <span style={{color:'#d5aa58'}}>PRO</span></b><h2 style={{fontSize:23,margin:'6px 0'}}>كشف حساب {filterMode==='trip'?'المشاوير':'اليوميات'}</h2></div><div style={{fontSize:13,textAlign:'left'}}>0558995962<br/>{currentDate()}</div></div>
          <div style={{margin:'25px 0',fontSize:16,lineHeight:2}}><strong>العميل:</strong> {filterClient}<br/><strong>نوع الكشف:</strong> {filterMode==='trip'?'مشاوير':'يوميات'}<br/><strong>الكرين:</strong> {filterEquipment?equipment.find(x=>String(x.id)===filterEquipment)?.name:'جميع الكرينات'}</div>
          <table style={{borderCollapse:'collapse',width:'100%',fontSize:12,tableLayout:'fixed'}}><thead><tr style={{background:'#132b46',color:'#fff'}}>{['م','التاريخ','الكرين','البيان / الموقع','المبلغ'].map(h=><th key={h} style={{padding:12,border:'1px solid #e0e4e9'}}>{h}</th>)}</tr></thead><tbody>{rows.map((x,i)=><tr key={x.id} style={{background:i%2?'#f4f6f8':'white'}}><td style={{padding:11,border:'1px solid #e0e4e9'}}>{page*12+i+1}</td><td style={{padding:11,border:'1px solid #e0e4e9'}}>{x.date}</td><td style={{padding:11,border:'1px solid #e0e4e9',overflowWrap:'anywhere'}}>{x.equipmentName}</td><td style={{padding:11,border:'1px solid #e0e4e9',overflowWrap:'anywhere'}}>{x.description || x.site || 'شغل كرين'}</td><td style={{padding:11,border:'1px solid #e0e4e9',whiteSpace:'nowrap'}}>{fmt(x.price)}</td></tr>)}</tbody></table>
          {last&&<div style={{marginTop:24,background:'#f2f5f8',padding:18,borderRadius:8,fontSize:17,lineHeight:2}}><div>عدد الحركات: <b>{selected.length}</b></div><div>إجمالي الأعمال: <b>{fmt(total)} ر.س</b></div><div>المستلم المسجل لهذه الحركات: <b>{fmt(received)} ر.س</b></div><div style={{fontWeight:900,fontSize:20}}>المتبقي: {fmt(balance)} ر.س</div></div>}
          <div style={{position:'absolute',bottom:35,right:48,left:48,borderTop:'1px solid #ddd',paddingTop:10,display:'flex',justifyContent:'space-between',fontSize:11,color:'#64748b'}}><span>BAKR PRO • كشف حساب العميل</span><span>صفحة {page+1} / {Math.max(1,Math.ceil(selected.length/12))}</span></div>
        </div>;
      })}
    </div>
  </div></AppLayout>;
}
export default DailyTripsPage;
