import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BellRing, CalendarDays, CheckCheck, CheckCircle2, ChevronDown, ChevronUp,
  Clock3, Copy, Eye, ListChecks, MessageCircle, RotateCw, Save,
  Send, Settings2, ShieldCheck, Users, Wallet, XCircle,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';

/**
 * BAKR PRO – Accounts receivable reminder planner.
 * This page DOES NOT send messages automatically. Real background WhatsApp
 * delivery requires an authenticated server + approved WhatsApp Business
 * Platform message templates and customer opt-in. Never store API tokens here.
 * Receivable records remain unchanged; the reminder settings are separate.
 */
const RECEIVABLES_KEY = 'bakr_pro_receivables_v1';
const REMINDERS_KEY = 'bakr_pro_receivable_reminders_v1';

type Payment = { amount?: number | string };
type Receivable = {
  id: string;
  customer: string;
  phone?: string;
  equipment?: string;
  workName?: string;
  work?: string;
  date?: string;
  total?: number | string;
  payments?: Payment[];
};
type Recipient = {
  consent: boolean;
  enabled: boolean;
  everyDays: number | null;
  lastConfirmedSentDate: string | null;
};
type Settings = {
  everyDays: number;
  template: string;
  recipients: Record<string, Recipient>;
};
const DEFAULT_TEMPLATE = `🏗️ *BAKR PRO | تذكير بالمستحقات*
السلام عليكم ورحمة الله وبركاته،

👤 *العميل:* {العميل}
🏗️ *العمل:* {العمل}
📅 *تاريخ الشغل:* {التاريخ}

💵 *قيمة العمل:* {القيمة} ريال
✅ *المدفوع:* {المدفوع} ريال
🔴 *المتبقي:* {المتبقي} ريال

نأمل منكم التكرم بسداد المبلغ المستحق، شاكرين لكم حسن تعاونكم. 🤝`;

const shell = 'rounded-[22px] border border-[#d9b76c]/20 bg-[#102139] shadow-[0_12px_30px_rgba(0,0,0,.16)]';
const miniButton = 'rounded-xl px-3 py-2.5 text-[12px] font-black transition active:scale-[.98]';
const textField = 'w-full rounded-xl border border-white/15 bg-[#071524] text-slate-100 outline-none focus:border-[#e6c372] px-3 py-2.5';
const sar = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
function sanitizeDays(value: unknown, fallback = 5): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 && n <= 365 ? Math.floor(n) : fallback;
}
function normalizedPhone(value?: string): string {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^05\d{8}$/.test(digits)) digits = `966${digits.slice(1)}`;
  if (/^5\d{8}$/.test(digits)) digits = `966${digits}`;
  return /^\d{10,15}$/.test(digits) ? digits : '';
}
function readRecords(): Receivable[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(RECEIVABLES_KEY) || '[]');
    if (!Array.isArray(data)) return [];
    return data.filter((r): r is Receivable => Boolean(r) && typeof r.id === 'string' && typeof r.customer === 'string');
  } catch { return []; }
}
function readSettings(): Settings {
  try {
    const data = JSON.parse(localStorage.getItem(REMINDERS_KEY) || '{}');
    const recipients = data?.recipients && typeof data.recipients === 'object' && !Array.isArray(data.recipients) ? data.recipients : {};
    return {
      everyDays: sanitizeDays(data?.everyDays),
      template: typeof data?.template === 'string' && data.template.trim() ? data.template : DEFAULT_TEMPLATE,
      recipients,
    };
  } catch { return { everyDays: 5, template: DEFAULT_TEMPLATE, recipients: {} }; }
}
function paid(r: Receivable): number {
  return Array.isArray(r.payments) ? r.payments.reduce((s, p) => s + (Number(p?.amount) || 0), 0) : 0;
}
function balance(r: Receivable): number {
  return Math.max(0, Math.round(((Number(r.total) || 0) - paid(r)) * 100) / 100);
}
function dateFromISO(value?: string): Date | null {
  if (!/^\d{4}-\d\d-\d\d$/.test(value || '')) return null;
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function addDays(iso: string, days: number): string | null {
  const d = dateFromISO(iso);
  if (!d) return null;
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function displayDate(iso?: string | null): string {
  return iso && /^\d{4}-\d\d-\d\d$/.test(iso) ? iso.split('-').reverse().join('/') : '—';
}
function workText(r: Receivable): string {
  return [r.workName, r.work].filter(Boolean).join(' — ') || r.equipment || 'مشوار كرين / بوم ترك';
}
function makeMessage(r: Receivable, template: string): string {
  const text: Record<string, string> = {
    '{العميل}': r.customer,
    '{العمل}': workText(r),
    '{اسم_العمل}': r.workName || '—',
    '{الوصف}': r.work || '—',
    '{التاريخ}': displayDate(r.date),
    '{المعدة}': r.equipment || '—',
    '{القيمة}': sar(Number(r.total) || 0),
    '{المدفوع}': sar(paid(r)),
    '{المتبقي}': sar(balance(r)),
  };
  return Object.entries(text).reduce((result, [placeholder, value]) => result.split(placeholder).join(value), template);
}
function getRecipient(s: Settings, id: string): Recipient {
  const raw = s.recipients[id];
  return {
    consent: raw?.consent === true,
    enabled: raw?.enabled === true,
    everyDays: raw?.everyDays != null ? sanitizeDays(raw.everyDays, s.everyDays) : null,
    lastConfirmedSentDate: typeof raw?.lastConfirmedSentDate === 'string' ? raw.lastConfirmedSentDate : null,
  };
}
function isOpenBalance(r: Receivable) {
  return Number(r.total) > 0 && balance(r) > 0.005;
}

export function ReceivablesRemindersPage() {
  const [records, setRecords] = useState<Receivable[]>(readRecords);
  const [settings, setSettings] = useState<Settings>(readSettings);
  const [query, setQuery] = useState('');
  const [only, setOnly] = useState<'all' | 'enabled' | 'due' | 'missing'>('all');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [notice, setNotice] = useState('');
  const [nowDate, setNowDate] = useState(todayISO());

  const reload = useCallback(() => {
    setRecords(readRecords());
    setNowDate(todayISO());
  }, []);
  useEffect(() => {
    window.addEventListener('focus', reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener('focus', reload);
      window.removeEventListener('storage', reload);
    };
  }, [reload]);
  useEffect(() => {
    try { localStorage.setItem(REMINDERS_KEY, JSON.stringify(settings)); }
    catch { setNotice('تعذر حفظ إعدادات التذكيرات. تأكد من مساحة تخزين الجهاز.'); }
  }, [settings]);

  function editRecipient(id: string, changes: Partial<Recipient>) {
    setSettings(previous => ({
      ...previous,
      recipients: {
        ...previous.recipients,
        [id]: { ...getRecipient(previous, id), ...changes },
      },
    }));
  }
  function hasValidConsent(r: Receivable) {
    return getRecipient(settings, r.id).consent && Boolean(normalizedPhone(r.phone));
  }
  function selected(r: Receivable) {
    const x = getRecipient(settings, r.id);
    return x.enabled && x.consent && Boolean(normalizedPhone(r.phone)) && isOpenBalance(r);
  }
  function interval(r: Receivable) {
    return getRecipient(settings, r.id).everyDays || settings.everyDays;
  }
  function nextDue(r: Receivable) {
    const last = getRecipient(settings, r.id).lastConfirmedSentDate;
    return addDays(last || r.date || nowDate, interval(r));
  }
  function dueNow(r: Receivable) {
    const date = nextDue(r);
    return selected(r) && Boolean(date && date <= nowDate);
  }
  const outstanding = useMemo(() => records.filter(isOpenBalance), [records]);
  const stats = useMemo(() => ({
    outstanding: outstanding.length,
    balance: outstanding.reduce((total, r) => total + balance(r), 0),
    selected: outstanding.filter(selected).length,
    due: outstanding.filter(dueNow).length,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [outstanding, settings, nowDate]);
  const rows = useMemo(() => {
    return [...records].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .filter(r => `${r.customer} ${r.phone || ''} ${r.workName || ''} ${r.work || ''}`.toLowerCase().includes(query.toLowerCase().trim()))
      .filter(r => only === 'all' ? true : only === 'enabled' ? selected(r) : only === 'due' ? dueNow(r) : !hasValidConsent(r) && isOpenBalance(r));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, query, only, settings, nowDate]);
  const previewRecord = records.find(r => r.id === previewId);

  function bulkEnable() {
    const eligible = outstanding.filter(hasValidConsent);
    if (!eligible.length) {
      setNotice('لا يوجد عملاء مؤهلون بعد. يلزم رقم جوال صحيح وموافقة العميل على التذكيرات.');
      return;
    }
    setSettings(previous => {
      const next = { ...previous.recipients };
      eligible.forEach(r => { next[r.id] = { ...getRecipient(previous, r.id), enabled: true }; });
      return { ...previous, recipients: next };
    });
    setNotice(`تم اختيار ${eligible.length} عميل مؤهل. لن تُرسل أي رسالة تلقائيًا قبل ربط WhatsApp Business الرسمي.`);
  }
  function bulkDisable() {
    setSettings(previous => {
      const next = { ...previous.recipients };
      for (const id of Object.keys(next)) next[id] = { ...getRecipient(previous, id), enabled: false };
      return { ...previous, recipients: next };
    });
    setNotice('تم إيقاف جميع التذكيرات في القائمة.');
  }
  function openWhatsApp(r: Receivable) {
    const phone = normalizedPhone(r.phone);
    if (!phone || !hasValidConsent(r) || !isOpenBalance(r)) {
      setNotice('قبل التواصل: تأكد من رقم جوال العميل وموافقته على استلام التذكيرات ووجود مبلغ مستحق.');
      return;
    }
    const uri = `https://wa.me/${phone}?text=${encodeURIComponent(makeMessage(r, settings.template))}`;
    window.open(uri, '_blank', 'noopener,noreferrer');
    setNotice('تم فتح محادثة واتساب فقط؛ اضغط «إرسال» داخل واتساب. لم يجرِ إرسال تلقائي.');
  }
  function confirmManualSend(r: Receivable) {
    if (!window.confirm(`هل أرسلت رسالة التذكير فعلًا إلى ${r.customer} من واتساب؟\nإذا لم ترسلها اضغط إلغاء.`)) return;
    editRecipient(r.id, { lastConfirmedSentDate: todayISO() });
    setNotice('تم تسجيل تاريخ الإرسال اليدوي. تاريخ التذكير القادم سيُحسب بعد عدد الأيام المحدد.');
  }
  function copyPreview(r: Receivable) {
    const message = makeMessage(r, settings.template);
    void (async () => {
      try {
        await navigator.clipboard.writeText(message);
        setNotice('تم نسخ الرسالة، وهي جاهزة للصق في واتساب.');
      } catch { window.prompt('انسخ الرسالة التالية:', message); }
    })();
  }

  return (
    <AppLayout showBottomNav={false}>
      <main dir="rtl" className="min-h-screen w-full px-3 pb-28 pt-6 text-slate-100" style={{background:'linear-gradient(180deg,#091b31,#060f1d)'}}>
        <section className={`${shell} p-5 mb-4`} style={{ background:'linear-gradient(140deg,#193353,#0b1a2d)',borderColor:'#c7a25d66' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-2xl p-3 bg-amber-300 text-slate-950"><BellRing className="h-6 w-6" /></div>
            <div>
              <p className="text-[11px] tracking-widest text-amber-300 font-black">BAKR PRO</p>
              <h1 className="text-xl font-black">تذكيرات مستحقات العملاء</h1>
            </div>
          </div>
          <p className="text-[12px] leading-6 text-slate-300">تحديد العملاء • كل 5 أيام افتراضيًا • معاينة الرسالة • متابعة الدفعات والمبلغ المتبقي</p>
          <div className="mt-3 p-3 rounded-xl bg-orange-400/10 border border-orange-300/30 text-orange-100 text-[12px] leading-6">
            <b>حالة الإرسال: بانتظار الربط الرسمي بواتساب.</b> يمكنك حاليًا إعداد المواعيد وفتح الرسالة للإرسال اليدوي فقط؛ لا يرسل التطبيق رسائل تلقائية بعد.
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2 mb-4">
          {([
            ['أعمال غير مسددة', String(stats.outstanding), '#f3d28a'],
            ['المبلغ المتبقي', `${sar(stats.balance)} ر.س`, '#fb9e8f'],
            ['عملاء محددون', String(stats.selected), '#8fe0c3'],
            ['تذكيرات مستحقة', String(stats.due), '#a2c7fd'],
          ] as const).map(([label,value,color]) => (
            <div key={label} className={`${shell} px-4 py-3`}>
              <p className="text-[11px] text-slate-400 font-bold">{label}</p>
              <p className="mt-2 text-lg font-black" style={{color}}>{value}</p>
            </div>
          ))}
        </section>

        <section className={`${shell} p-4 mb-4`}>
          <div className="flex items-center gap-2 mb-3"><Settings2 className="h-5 w-5 text-amber-300" /><h2 className="font-black text-[15px]">إعدادات التذكيرات</h2></div>
          <label className="block text-[12px] text-slate-300 font-bold mb-2">التكرار الافتراضي من تاريخ الشغل (بالأيام)</label>
          <div className="flex gap-2 items-center">
            {[3,5,7,10,15].map(days => <button key={days} className={`${miniButton} flex-1 ${settings.everyDays===days?'bg-amber-300 text-slate-950':'bg-white/5 border border-white/10 text-slate-200'}`} onClick={()=>setSettings(s=>({...s,everyDays:days}))}>{days}</button>)}
          </div>
          <div className="flex gap-3 items-center mt-3">
            <span className="text-[12px] text-slate-300 font-bold whitespace-nowrap">أو أدخل عدد الأيام</span>
            <input aria-label="عدد أيام التذكير" type="number" min={1} max={365} className={`${textField} w-[85px] text-center`} value={settings.everyDays} onChange={e=>setSettings(s=>({...s,everyDays:sanitizeDays(e.target.value)}))} />
            <span className="text-[11px] text-slate-400">يوم</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <button onClick={bulkEnable} className={`${miniButton} bg-emerald-400/15 border border-emerald-400/30 text-emerald-200 flex items-center gap-1`}><ListChecks className="w-4 h-4" /> تحديد كل المؤهلين</button>
            <button onClick={bulkDisable} className={`${miniButton} bg-rose-400/10 border border-rose-400/25 text-rose-200 flex items-center gap-1`}><XCircle className="w-4 h-4" /> إيقاف الكل</button>
            <button onClick={()=>setShowAdvanced(v=>!v)} className={`${miniButton} bg-white/5 border border-white/10 text-slate-100 flex items-center gap-1`}><Clock3 className="w-4 h-4" /> كيف تعمل المواعيد؟ {showAdvanced?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}</button>
          </div>
          {showAdvanced && <p className="mt-3 text-[12px] bg-white/5 rounded-xl p-3 text-slate-300 leading-6">يبدأ أول تذكير بعد المدة المحددة من <b>تاريخ تنفيذ الشغل</b>، وبعد تسجيل إرسال يدوي يُحسب التذكير التالي من تاريخ الإرسال. العميل المسدد بالكامل لا تظهر له تذكيرات مستحقة. تحديد الكل لا يشمل من لم يوافقوا على رسائل واتساب.</p>}
        </section>

        <section className={`${shell} p-4 mb-4`}>
          <button onClick={()=>setShowTemplate(v=>!v)} className="flex items-center justify-between w-full text-right">
            <span className="font-black text-[15px] flex items-center gap-2"><MessageCircle className="w-5 h-5 text-emerald-300" /> قالب الرسالة الجاهزة</span>
            {showTemplate?<ChevronUp className="w-5 h-5"/>:<ChevronDown className="w-5 h-5"/>}
          </button>
          {showTemplate && <div className="mt-3">
            <p className="text-[11px] leading-5 text-slate-400 mb-2">يمكنك تعديل النص، وتتبدل تلقائيًا الكلمات بين الأقواس: {'{العميل} {العمل} {التاريخ} {القيمة} {المدفوع} {المتبقي}'}.</p>
            <textarea rows={12} className={`${textField} text-[13px] leading-6`} value={settings.template} onChange={e=>setSettings(s=>({...s,template:e.target.value}))} />
            <div className="flex gap-2 mt-2">
              <button className={`${miniButton} bg-amber-300 text-slate-950 flex items-center gap-1`} onClick={()=>{setSettings(s=>({...s}));setNotice('تم حفظ النص في إعدادات الجهاز.')}}><Save className="w-4 h-4" /> حفظ النص</button>
              <button className={`${miniButton} bg-white/10 text-white`} onClick={()=>{if(window.confirm('إعادة النص الأساسي؟'))setSettings(s=>({...s,template:DEFAULT_TEMPLATE}));}}>استعادة النص الأساسي</button>
            </div>
          </div>}
        </section>

        {notice && <div role="status" className="rounded-xl p-3 mb-4 bg-[#244460] text-amber-100 text-[12px] leading-5 border border-amber-400/20">{notice}</div>}

        <section className={`${shell} p-3 mb-3`}>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-300" />
            <input className={`${textField} flex-1 text-[13px]`} value={query} onChange={e=>setQuery(e.target.value)} placeholder="بحث باسم العميل أو الجوال أو الشغل..." />
            <button title="تحديث قائمة المستحقات" onClick={reload} className="p-2 text-amber-200 rounded-lg border border-amber-500/30"><RotateCw className="w-5 h-5"/></button>
          </div>
          <div className="grid grid-cols-4 gap-1.5 mt-3">
            {([['all','الكل'],['enabled','المحدد'],['due','مستحق'],['missing','غير مؤهل']] as const).map(([key,label])=>(
              <button key={key} onClick={()=>setOnly(key)} className={`${miniButton} px-0 !text-[10px] ${only===key?'bg-amber-300 text-slate-950':'bg-white/5 text-slate-300 border border-white/10'}`}>{label}</button>
            ))}
          </div>
        </section>

        {!rows.length && <section className={`${shell} text-center p-8 text-slate-300 text-[13px] leading-7`}>لا يوجد عملاء مطابقون. أضف بيانات العميل ورقم جواله وقيمة العمل في صفحة «مستحقات العملاء» أولًا.</section>}

        <section className="space-y-3">
          {rows.map(r => {
            const op = getRecipient(settings, r.id);
            const phone = normalizedPhone(r.phone);
            const outstandingNow = isOpenBalance(r);
            const canEnable = outstandingNow && Boolean(phone) && op.consent;
            const active = selected(r);
            const date = nextDue(r);
            const isDue = dueNow(r);
            const howOften = interval(r);
            return <article key={r.id} className={`${shell} p-4`} style={{borderColor:active?'#e0bc7333':'#ffffff1c'}}>
              <div className="flex justify-between gap-3 items-start">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><Wallet className="w-4 h-4 text-amber-300" /><h3 className="font-black text-[16px] truncate">{r.customer}</h3></div>
                  <p className="text-[11px] mt-1 text-slate-400">{workText(r)}</p>
                  <p className="text-[11px] mt-1 text-slate-400"><CalendarDays className="w-3 h-3 inline ml-1" />تاريخ الشغل: {displayDate(r.date)}</p>
                </div>
                <div className="text-left shrink-0">
                  <p className="text-[10px] text-slate-400 mb-1">المتبقي</p>
                  <strong className={`text-[16px] ${outstandingNow?'text-amber-300':'text-emerald-300'}`}>{sar(balance(r))} ر.س</strong>
                </div>
              </div>
              {outstandingNow ? <div className="text-[11px] text-slate-300 mt-3 p-3 bg-white/5 rounded-xl">
                <p>📞 جوال العميل: <span dir="ltr">{r.phone || 'غير مسجل'}</span> {!phone && <b className="text-rose-300">(غير صالح)</b>}</p>
                <label className="flex items-center gap-2 mt-3 text-[12px] font-bold">
                  <input type="checkbox" checked={op.consent} className="w-4 h-4 accent-amber-400" onChange={e=>{
                    if(e.target.checked && !window.confirm(`هل وافق ${r.customer} بالفعل على استقبال رسائل تذكير المستحقات عبر واتساب؟`)) return;
                    editRecipient(r.id,{consent:e.target.checked,enabled:e.target.checked?op.enabled:false});
                  }} />
                  <ShieldCheck className="w-4 h-4 text-emerald-300"/> العميل وافق على تذكيرات واتساب
                </label>
                <div className="flex flex-wrap gap-2 items-center mt-3">
                  <button disabled={!canEnable} onClick={()=>editRecipient(r.id,{enabled:!op.enabled})} className={`${miniButton} ${active?'bg-emerald-400 text-slate-900':'bg-amber-300 text-slate-950'} disabled:opacity-40 flex items-center gap-1`}>
                    {active?<CheckCheck className="w-4 h-4" />:<BellRing className="w-4 h-4" />}{active?'التذكير محدد':'تحديد العميل'}
                  </button>
                  <label className="text-[11px] text-slate-300">كل
                    <select value={op.everyDays??0} className="rounded-lg bg-[#061524] border border-white/20 px-2 py-2 mx-2 text-white" onChange={e=>editRecipient(r.id,{everyDays:e.target.value==='0'?null:sanitizeDays(e.target.value)})}>
                      <option value="0">الافتراضي ({settings.everyDays})</option>
                      {[3,5,7,10,15,20,30].filter(n=>n!==settings.everyDays).map(n=><option key={n} value={n}>{n} أيام</option>)}
                    </select> يوم
                  </label>
                  <input type="number" min="1" max="365" title="عدد أيام مخصص" aria-label={`عدد أيام مخصص للعميل ${r.customer}`} placeholder="مخصص" className={`${textField} !w-20 !py-2 text-center text-[11px]`} value={op.everyDays ?? ''} onChange={e=>editRecipient(r.id,{everyDays:e.target.value?sanitizeDays(e.target.value):null})}/>
                </div>
                {active && <p className={`mt-3 text-[11px] font-bold ${isDue?'text-orange-200':'text-sky-200'}`}>
                  {isDue?'🔔 التذكير مستحق الآن':'📅 موعد التذكير القادم'}: {displayDate(date)} • كل {howOften} أيام
                </p>}
              </div> : <p className="mt-3 text-[12px] font-bold text-emerald-300 bg-emerald-500/10 p-3 rounded-xl"><CheckCircle2 className="w-4 h-4 inline ml-1" />{Number(r.total)>0?'الحساب مسدد — التذكيرات متوقفة تلقائيًا':'القيمة لم تحدد بعد — لا يمكن إرسال تذكير'}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={()=>setPreviewId(r.id)} className={`${miniButton} bg-[#d3b56b]/15 border border-[#d3b56b]/30 text-[#f2d592] flex gap-1 items-center`}><Eye className="w-4 h-4" /> معاينة الرسالة</button>
                <button onClick={()=>openWhatsApp(r)} disabled={!canEnable} className={`${miniButton} bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 disabled:opacity-35 flex gap-1 items-center`}><MessageCircle className="w-4 h-4" /> فتح واتساب</button>
                {active && <button onClick={()=>confirmManualSend(r)} className={`${miniButton} bg-blue-500/10 border border-blue-500/30 text-blue-200 flex gap-1 items-center`}><Send className="w-4 h-4" /> تسجيل إرسال يدوي</button>}
              </div>
              {op.lastConfirmedSentDate && <p className="text-[10px] text-slate-400 mt-2">آخر إرسال يدوي أكدته: {displayDate(op.lastConfirmedSentDate)}</p>}
            </article>;
          })}
        </section>
        <p className="text-[11px] leading-6 text-slate-400 mt-5 text-center">لن تُرسل رسائل تلقائية من هذه النسخة. لتشغيل التذكير كل 5 أيام دون تدخل، يلزم ربط خادم رسمي مع WhatsApp Business Platform وقالب رسالة وموافقة العميل، ومزامنة الحسابات مع الخادم. لا تخزّن كلمات مرور أو رموز واتساب داخل التطبيق.</p>
      </main>

      {previewRecord && <div dir="rtl" className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/80 p-4">
        <div className="bg-[#102139] rounded-[22px] border border-amber-300/40 w-full max-w-xl p-4 max-h-[88vh] overflow-auto shadow-2xl">
          <div className="flex justify-between items-center gap-3"><h2 className="font-black text-lg text-amber-200">👁️ معاينة رسالة واتساب</h2><button aria-label="إغلاق" onClick={()=>setPreviewId(null)}><XCircle className="w-6 h-6 text-white"/></button></div>
          <p className="text-[11px] text-slate-400 mt-2">هذه معاينة للرسالة قبل الإرسال، وليست إرسالًا تلقائيًا.</p>
          <pre dir="rtl" className="whitespace-pre-wrap break-words font-sans text-[13px] text-slate-100 leading-7 bg-[#071626] border border-white/10 rounded-xl p-4 mt-3">{makeMessage(previewRecord,settings.template)}</pre>
          <div className="flex flex-wrap gap-2 mt-4">
            <button onClick={()=>copyPreview(previewRecord)} className={`${miniButton} bg-amber-300 text-slate-950 flex items-center gap-1`}><Copy className="w-4 h-4"/> نسخ الرسالة</button>
            <button disabled={!hasValidConsent(previewRecord) || !isOpenBalance(previewRecord)} onClick={()=>openWhatsApp(previewRecord)} className={`${miniButton} bg-emerald-500 text-slate-950 disabled:opacity-40 flex items-center gap-1`}><MessageCircle className="w-4 h-4"/> فتح واتساب</button>
            <button onClick={()=>setPreviewId(null)} className={`${miniButton} bg-white/10 text-white`}>إغلاق</button>
          </div>
        </div>
      </div>}
    </AppLayout>
  );
}
