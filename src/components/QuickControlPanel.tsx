import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  X, Plus, Pencil, Check, ChevronUp, ChevronDown, Trash2, RotateCcw,
  Truck, Wallet, Users, FileText, Receipt, Bell, Search, Home, Calculator,
  CalendarClock, Wrench, ClipboardList, Settings, FileBarChart, Building2,
  UserRound, DatabaseBackup, BadgeDollarSign, BookOpen, BriefcaseBusiness,
  Sparkles, SlidersHorizontal, ArrowUpLeft, LayoutGrid, Star, ShieldCheck,
  HandCoins, CircleCheck,
} from 'lucide-react';

type IconType = ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
type Tone = 'gold' | 'blue' | 'green' | 'violet' | 'rose';
type Shortcut = { key: string; title: string; tone?: Tone };
type CatalogItem = { key: string; title: string; subtitle: string; path: string; icon: IconType; tone: Tone };

// كل مسار يُفتح داخل BAKR PRO؛ لا نسمح بروابط خارجية أو مسارات يكتبها المستخدم.
const CATALOG: CatalogItem[] = [
  { key: 'trips', title: 'مشوار / يومية', subtitle: 'تسجيل عمل جديد', path: '/daily-trips', icon: Truck, tone: 'gold' },
  { key: 'expense', title: 'مصروف كرين', subtitle: 'ديزل وصيانة ومصاريف', path: '/operating-expenses', icon: Wallet, tone: 'rose' },
  { key: 'advance', title: 'سلفة سائق', subtitle: 'سلف وسحوبات السائقين', path: '/operating-expenses', icon: HandCoins, tone: 'violet' },
  { key: 'statement', title: 'كشف حساب عميل', subtitle: 'كشوف المشاوير واليوميات', path: '/daily-trips', icon: FileText, tone: 'blue' },
  { key: 'invoice', title: 'فاتورة عمل', subtitle: 'فاتورة قابلة للمشاركة', path: '/work-invoice', icon: Receipt, tone: 'green' },
  { key: 'alarm', title: 'المنبّه الذكي', subtitle: 'مهام وتذكيرات', path: '/command-center', icon: Bell, tone: 'gold' },
  { key: 'transactions', title: 'الحركات', subtitle: 'سجل عمليات الحساب', path: '/transactions', icon: ClipboardList, tone: 'blue' },
  { key: 'newjob', title: 'إضافة شغل / مصروف', subtitle: 'الإضافة التقليدية', path: '/add', icon: Plus, tone: 'green' },
  { key: 'customers', title: 'العملاء', subtitle: 'بيانات وحسابات العملاء', path: '/customers', icon: Users, tone: 'blue' },
  { key: 'equipment', title: 'المعدات', subtitle: 'إدارة الأسطول', path: '/equipment', icon: Wrench, tone: 'gold' },
  { key: 'drivers', title: 'السائقون والمشغلون', subtitle: 'الحسابات والسلف', path: '/drivers', icon: UserRound, tone: 'violet' },
  { key: 'reports', title: 'التقارير', subtitle: 'تقارير الأعمال', path: '/reports', icon: FileBarChart, tone: 'green' },
  { key: 'monthly', title: 'الحساب الشهري', subtitle: 'متابعة الحسابات الشهرية', path: '/monthly', icon: CalendarClock, tone: 'blue' },
  { key: 'rentals', title: 'التأجير الشهري', subtitle: 'إيجارات المعدات', path: '/monthly-rental', icon: Building2, tone: 'gold' },
  { key: 'quotations', title: 'عروض الأسعار', subtitle: 'إصدار عرض سعر', path: '/quotation-pro', icon: BriefcaseBusiness, tone: 'violet' },
  { key: 'receivables', title: 'المستحقات', subtitle: 'متابعة التحصيل', path: '/receivables', icon: BadgeDollarSign, tone: 'rose' },
  { key: 'calculator', title: 'حساب اليوم', subtitle: 'حاسبة اليوميات', path: '/daily-calculator', icon: Calculator, tone: 'blue' },
  { key: 'backup', title: 'النسخ الاحتياطي', subtitle: 'حماية البيانات', path: '/backup', icon: DatabaseBackup, tone: 'green' },
  { key: 'settings', title: 'الإعدادات', subtitle: 'خيارات التطبيق', path: '/settings', icon: Settings, tone: 'gold' },
  { key: 'home', title: 'الرئيسية', subtitle: 'لوحة التطبيق', path: '/', icon: Home, tone: 'blue' },
  { key: 'expensesHistory', title: 'سجل المصروفات', subtitle: 'عرض المصروفات', path: '/expenses', icon: BookOpen, tone: 'rose' },
];

const STORAGE_KEY = 'bakr_pro_quick_controls_v1';
const DEFAULT_KEYS = ['trips', 'expense', 'advance', 'statement', 'invoice', 'alarm'];
const TONES: { key: Tone; color: string; background: string; border: string; label: string }[] = [
  { key: 'gold', color: '#f4c66f', background: 'rgba(237,179,71,.13)', border: 'rgba(237,179,71,.26)', label: 'ذهبي' },
  { key: 'blue', color: '#83baff', background: 'rgba(99,165,255,.13)', border: 'rgba(99,165,255,.25)', label: 'أزرق' },
  { key: 'green', color: '#82e3bd', background: 'rgba(65,204,150,.12)', border: 'rgba(65,204,150,.25)', label: 'أخضر' },
  { key: 'violet', color: '#c9acff', background: 'rgba(160,117,248,.13)', border: 'rgba(160,117,248,.25)', label: 'بنفسجي' },
  { key: 'rose', color: '#ffa0ad', background: 'rgba(242,111,133,.12)', border: 'rgba(242,111,133,.24)', label: 'وردي' },
];
const getCatalogItem = (key: string) => CATALOG.find(item => item.key === key);
const defaults = (): Shortcut[] => DEFAULT_KEYS.map(key => ({ key, title: getCatalogItem(key)?.title || key }));
const validTone = (tone: unknown): tone is Tone => TONES.some(item => item.key === tone);
const normalize = (value: unknown): Shortcut[] => {
  if (!Array.isArray(value)) return defaults();
  const shortcuts: Shortcut[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Partial<Shortcut>;
    if (typeof item.key !== 'string' || !getCatalogItem(item.key) || shortcuts.some(s => s.key === item.key)) continue;
    const original = getCatalogItem(item.key)!;
    shortcuts.push({
      key: item.key,
      title: typeof item.title === 'string' && item.title.trim() ? item.title.trim().slice(0, 32) : original.title,
      ...(validTone(item.tone) ? { tone: item.tone } : {}),
    });
  }
  return shortcuts.slice(0, CATALOG.length);
};
const read = (): Shortcut[] => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === null ? defaults() : normalize(JSON.parse(value));
  } catch { return defaults(); }
};

type Props = { onClose: () => void; onNavigate: (path: string) => void };

export function QuickControlPanel({ onClose, onNavigate }: Props) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(read);
  const [editMode, setEditMode] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts)); setNotice(''); }
    catch { setNotice('تعذر حفظ الاختصارات على هذا الجهاز؛ تحقق من مساحة التخزين.'); }
  }, [shortcuts]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const available = useMemo(() => CATALOG.filter(item =>
    !shortcuts.some(shortcut => shortcut.key === item.key) &&
    `${item.title} ${item.subtitle}`.includes(search.trim()),
  ), [shortcuts, search]);
  const getTone = (shortcut: Shortcut) => TONES.find(item => item.key === (shortcut.tone || getCatalogItem(shortcut.key)?.tone)) || TONES[0];
  const update = (key: string, patch: Partial<Shortcut>) => setShortcuts(items => items.map(s => s.key === key ? { ...s, ...patch } : s));
  const shift = (index: number, delta: number) => {
    setShortcuts(items => {
      const target = index + delta;
      if (index < 0 || target < 0 || target >= items.length) return items;
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };
  const open = (key: string) => {
    const item = getCatalogItem(key);
    if (item) onNavigate(item.path);
  };

  return (
    <div dir="rtl" role="dialog" aria-modal="true" aria-label="لوحة التحكم السريعة" className="fixed inset-0 z-[20000] flex items-end justify-center sm:items-center">
      <button type="button" aria-label="إغلاق لوحة التحكم" className="absolute inset-0 bg-black/85" onClick={onClose} style={{ backdropFilter: 'blur(9px)' }} />
      <section className="relative w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] flex flex-col overflow-hidden text-white" style={{ maxHeight: '94dvh', background: 'linear-gradient(165deg,#12233b 0%,#09172a 36%,#07111f 100%)', border: '1px solid rgba(232,184,92,.25)', boxShadow: '0 -25px 85px rgba(0,0,0,.65)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="h-1 w-20 rounded-b-full mx-auto" style={{ background: 'linear-gradient(90deg,transparent,#e8bd68,transparent)' }} />
        <header className="px-5 pt-5 pb-4 border-b border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(140deg,rgba(246,194,91,.25),rgba(246,194,91,.05))', border: '1px solid rgba(246,194,91,.37)' }}><LayoutGrid size={25} className="text-amber-300" /></div>
              <div className="min-w-0">
                <p className="text-[10px] tracking-widest font-black text-amber-300 flex items-center gap-1"><Sparkles size={13}/> BAKR PRO VIP</p>
                <h2 className="text-[21px] leading-7 mt-1 font-black">لوحة التحكم السريعة</h2>
                <p className="text-[11px] text-slate-400 mt-1">كل أعمالك بضغطة واحدة</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="إغلاق" className="w-10 h-10 shrink-0 bg-white/10 border border-white/10 rounded-xl flex items-center justify-center"><X size={20}/></button>
          </div>
          <div className="mt-4 flex gap-2 items-center">
            <div className="flex-1 flex items-center gap-2 rounded-xl bg-white/[.045] border border-white/10 px-3 py-2.5">
              <ShieldCheck size={16} className="text-emerald-300" />
              <span className="text-xs text-slate-300">اختصارات محفوظة على الجهاز</span>
              <strong className="text-amber-300 mr-auto tabular-nums">{shortcuts.length}</strong>
            </div>
            <button type="button" onClick={() => { setEditMode(v => !v); setAdding(false); setEditingKey(null); }} className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-200 px-3 py-2.5 text-xs font-bold"><SlidersHorizontal size={16}/>{editMode ? 'إنهاء' : 'تخصيص'}</button>
          </div>
        </header>

        <div className="overflow-y-auto overscroll-contain px-4 pb-5 pt-4">
          {notice && <p role="alert" className="text-amber-200 text-xs mb-3">{notice}</p>}
          <div className="flex justify-between items-center mb-3 px-1"><h3 className="text-sm font-black text-slate-200 flex items-center gap-2"><Star size={15} className="text-amber-300"/>اختصاراتي</h3><span className="text-[11px] text-slate-500">{editMode ? 'غيّر الاسم واللون والترتيب' : 'اضغط لفتح القسم'}</span></div>
          <div className="grid grid-cols-2 gap-3">
            {shortcuts.map((shortcut, index) => {
              const item = getCatalogItem(shortcut.key);
              if (!item) return null;
              const Icon = item.icon;
              const tone = getTone(shortcut);
              return <div key={shortcut.key} className="min-w-0 rounded-[20px] overflow-hidden flex flex-col" style={{ background: 'linear-gradient(150deg,rgba(255,255,255,.078),rgba(255,255,255,.025))', border: '1px solid rgba(255,255,255,.11)', boxShadow: '0 8px 20px rgba(0,0,0,.15)' }}>
                {editingKey === shortcut.key ? <div className="p-3 space-y-3">
                  <label className="text-[11px] text-slate-400 block">اسم الاختصار</label>
                  <input autoFocus maxLength={32} value={draftTitle} onChange={e => setDraftTitle(e.target.value)} className="w-full min-w-0 rounded-xl bg-[#071421] border border-white/20 p-2 text-white text-sm" />
                  <div className="flex gap-2 flex-wrap" aria-label="لون الاختصار">
                    {TONES.map(t => <button type="button" key={t.key} title={t.label} aria-label={`اختيار اللون ${t.label}`} aria-pressed={tone.key === t.key} onClick={() => update(shortcut.key, { tone: t.key })} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: t.background, border: `2px solid ${t.color}` }}>{tone.key === t.key && <Check size={15} style={{ color: t.color }}/>}</button>)}
                  </div>
                  <button type="button" onClick={() => { if (draftTitle.trim()) update(shortcut.key, { title: draftTitle.trim().slice(0, 32) }); setEditingKey(null); }} className="w-full py-2 bg-amber-400 text-slate-950 rounded-xl font-bold flex justify-center gap-2"><Check size={17}/>حفظ</button>
                </div> : <button type="button" disabled={editMode} onClick={() => open(shortcut.key)} className="min-h-[130px] w-full py-4 px-2 flex flex-col items-center justify-center gap-2 active:scale-[.97] transition-transform disabled:opacity-90">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: tone.background, border: `1px solid ${tone.border}` }}><span style={{ color: tone.color }}><Icon size={25} strokeWidth={2.05} className="shrink-0" /></span></div>
                  <span className="text-[13px] font-black text-center leading-5 break-words">{shortcut.title}</span>
                  <span className="text-[10px] text-slate-400 text-center leading-4">{item.subtitle}</span>
                  {!editMode && <ArrowUpLeft size={13} className="text-slate-500"/>}
                </button>}
                {editMode && editingKey !== shortcut.key && <div className="flex items-center justify-evenly gap-1 border-t border-white/10 p-2">
                  <button type="button" aria-label="تقديم الاختصار" disabled={index === 0} onClick={() => shift(index, -1)} className="p-1.5 disabled:opacity-20"><ChevronUp size={17}/></button>
                  <button type="button" aria-label="تأخير الاختصار" disabled={index === shortcuts.length - 1} onClick={() => shift(index, 1)} className="p-1.5 disabled:opacity-20"><ChevronDown size={17}/></button>
                  <button type="button" aria-label="تعديل الاختصار" onClick={() => { setEditingKey(shortcut.key); setDraftTitle(shortcut.title); }} className="p-1.5 text-amber-300"><Pencil size={17}/></button>
                  <button type="button" aria-label="إزالة الاختصار" onClick={() => setShortcuts(items => items.filter(s => s.key !== shortcut.key))} className="p-1.5 text-rose-300"><Trash2 size={17}/></button>
                </div>}
              </div>;
            })}
          </div>
          {shortcuts.length === 0 && <p className="py-6 text-center text-sm text-slate-400">لوحتك فارغة. أضف اختصاراً للبدء.</p>}
          {!adding ? <button type="button" onClick={() => { setAdding(true); setEditMode(false); setSearch(''); }} className="w-full mt-3 py-4 rounded-2xl flex items-center justify-center gap-2 border border-dashed border-amber-400/45 bg-amber-400/[.055] text-amber-200 font-black text-sm"><Plus size={20}/> إضافة اختصار جديد</button> :
            <section className="mt-3 rounded-2xl border border-amber-400/25 bg-[#10243b] p-3">
              <div className="flex items-center justify-between mb-3"><strong className="text-sm">إضافة من أقسام التطبيق</strong><button type="button" aria-label="إغلاق إضافة الاختصار" onClick={() => setAdding(false)}><X size={19}/></button></div>
              <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/15 bg-[#061423]"><Search size={17} className="text-amber-300"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن قسم..." className="w-full min-w-0 bg-transparent outline-none text-sm text-white" /></label>
              <div className="max-h-[220px] overflow-y-auto space-y-1.5 mt-3">
                {available.map(item => { const Icon = item.icon; return <button type="button" key={item.key} onClick={() => { setShortcuts(current => [...current, { key: item.key, title: item.title }]); setAdding(false); setSearch(''); }} className="w-full text-right flex items-center gap-3 p-3 rounded-xl bg-white/[.045] hover:bg-white/10"><Icon size={19} className="text-amber-300"/><span className="flex-1 min-w-0"><b className="text-xs block">{item.title}</b><span className="text-[10px] text-slate-400">{item.subtitle}</span></span><Plus size={16}/></button>; })}
                {available.length === 0 && <p className="text-slate-400 text-xs p-3">لا توجد أقسام مطابقة أو جميع الاختصارات مضافة.</p>}
              </div>
            </section>}
          {editMode && <button type="button" onClick={() => { if (window.confirm('هل تريد استعادة ترتيب الاختصارات الافتراضي؟')) { setShortcuts(defaults()); setEditingKey(null); } }} className="flex items-center gap-2 text-xs text-slate-400 mx-auto mt-5"><RotateCcw size={15}/> استعادة الاختصارات الافتراضية</button>}
          <div className="mt-5 p-3 flex items-start gap-2 rounded-xl bg-white/[.03] border border-white/[.06]"><CircleCheck size={17} className="text-emerald-300 shrink-0"/><p className="text-[11px] leading-5 text-slate-400">تغيير الاختصارات لا يحذف أي بيانات. يمكن إضافة اختصار لأي قسم متاح في هذه القائمة دون تحديث APK. الاسم واللون والترتيب محفوظة على هذا الجهاز.</p></div>
        </div>
      </section>
    </div>
  );
}
