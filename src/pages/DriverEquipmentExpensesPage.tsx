import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { fetchEquipment, type Equipment } from '@/lib/equipment';
import { CalendarDays, Check, ChevronDown, Pencil, Search, Trash2, Truck, UserRound } from 'lucide-react';

// Keep the existing storage keys and record structure. DriversPage-1 reads this key.
const DRIVER_KEY = 'crane_drivers_v1';
const STORAGE_KEY = 'crane_accounting_driver_equipment_expenses_v1';
type Driver = { id: number | string; name: string; phone?: string };
type ExpenseRecord = {
  id: number; date: string; driverId: string; driverName: string;
  equipmentId: string; equipmentName: string; category: string;
  amount: number; location: string; notes: string;
  affectsDriverBalance: boolean; createdAt: string; updatedAt: string;
};
type Mode = 'equipment' | 'driver';
const NAVY = '#102640';
const GOLD = '#bd914b';
const BG = '#f4f7fb';
const INK = '#172b43';
const expenseSuggestions = ['ديزل', 'كفرات', 'بنشر', 'زيت مكينة', 'قطع غيار', 'شغل ميكانيكي', 'إيجار حوش', 'زيت دركسون', 'بطاريات', 'شغل كهربائي', 'تحميل لوبد'];
const getToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const normalizeDigits = (v: string) => v.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[,٬]/g, '');
const fmt = (v: number) => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const asMoney = (v: number) => `${fmt(v)} ر.س`;
function readArray<T>(key: string): T[] {
  try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
function driverMovement(r: ExpenseRecord): boolean {
  return r.affectsDriverBalance === true || r.category === 'سلفة / سحب';
}
const panel: CSSProperties = { background: '#fff', border: '1px solid #e1e8f0', borderRadius: 18, padding: 16, marginBottom: 13, boxShadow: '0 4px 15px #0c254007' };
const input: CSSProperties = { width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', height: 48, padding: '0 12px', border: '1px solid #cbd6e2', borderRadius: 12, background: '#f9fbfd', color: INK, fontSize: 15, outline: 'none' };
const label: CSSProperties = { display: 'block', fontWeight: 800, fontSize: 13, color: INK, marginBottom: 7 };
const action: CSSProperties = { border: 0, borderRadius: 12, height: 48, fontWeight: 850, fontSize: 14, cursor: 'pointer', padding: '0 14px' };
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T12:00:00`).getTime());

export function DriverEquipmentExpensesPage() {
  const [searchParams] = useSearchParams();
  const requestedEquipmentId = searchParams.get('equipmentId') || '';
  const [drivers] = useState<Driver[]>(() => readArray<Driver>(DRIVER_KEY));
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [records, setRecords] = useState<ExpenseRecord[]>(() => readArray<ExpenseRecord>(STORAGE_KEY));
  const [mode, setMode] = useState<Mode>('equipment');
  const [driverId, setDriverId] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [movement, setMovement] = useState<'سحب' | 'سلفة'>('سحب');
  const [category, setCategory] = useState('');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(getToday());
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [details, setDetails] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | Mode>('all');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchEquipment().then(v => { if (mounted) { setEquipment(v || []); if (requestedEquipmentId && (v || []).some(x => String(x.id) === requestedEquipmentId)) { setMode('equipment'); setEquipmentId(requestedEquipmentId); } } })
      .catch(() => { if (mounted) setError('تعذر تحميل المعدات. حاول إعادة فتح الصفحة.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [requestedEquipmentId]);

  const selectedEquipment = equipment.find(e => String(e.id) === equipmentId);
  const selectedDriver = drivers.find(d => String(d.id) === driverId);
  const today = getToday();
  const todayEquipment = useMemo(() => records.filter(r => r.date === today && !driverMovement(r)).reduce((s, r) => s + Number(r.amount || 0), 0), [records, today]);
  const todayDrivers = useMemo(() => records.filter(r => r.date === today && driverMovement(r)).reduce((s, r) => s + Number(r.amount || 0), 0), [records, today]);
  const visibleRecords = useMemo(() => records.filter(r => {
    if (filter === 'driver' && !driverMovement(r)) return false;
    if (filter === 'equipment' && driverMovement(r)) return false;
    const term = search.trim().toLowerCase();
    return !term || [r.driverName, r.equipmentName, r.category, r.location, r.notes, r.date].join(' ').toLowerCase().includes(term);
  }).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id), [records, filter, search]);

  function clearForm(nextMode: Mode = mode) {
    setMode(nextMode); setDriverId(''); setEquipmentId(''); setMovement('سحب'); setCategory('');
    setValue(''); setDate(getToday()); setLocation(''); setNotes(''); setDetails(false); setEditingId(null);
  }
  function selectMode(next: Mode) { clearForm(next); setError(''); setMessage(''); }
  function persist(next: ExpenseRecord[]): boolean {
    try {
      // Persist FIRST: this prevents success messages when local storage is full.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setRecords(next);
      return true;
    } catch (e) {
      console.error('Failed saving driver/equipment expense', e);
      setError('تعذر الحفظ: مساحة تخزين التطبيق غير كافية. احفظ نسخة احتياطية ولا تمسح بيانات التطبيق.');
      return false;
    }
  }
  function saveMovement() {
    setError(''); setMessage('');
    const numeric = Number(normalizeDigits(value.trim()));
    if (!isDate(date)) { setError('اختر تاريخاً صحيحاً.'); return; }
    if (!value.trim() || !Number.isFinite(numeric) || numeric <= 0) { setError('اكتب مبلغاً صحيحاً أكبر من صفر.'); return; }
    if (mode === 'equipment' && !selectedEquipment) { setError('اختر الكرين أو المعدة.'); return; }
    if (mode === 'equipment' && !category.trim()) { setError('اكتب وصف المصروف، مثل ديزل أو قطع غيار.'); return; }
    if (mode === 'driver' && !selectedDriver) { setError('اختر السائق أولاً.'); return; }
    const now = new Date().toISOString();
    const old = editingId === null ? undefined : records.find(r => r.id === editingId);
    const record: ExpenseRecord = {
      id: old?.id ?? Date.now(), date,
      driverId: mode === 'driver' ? driverId : '',
      driverName: mode === 'driver' ? (selectedDriver?.name || '') : '',
      equipmentId: mode === 'equipment' ? equipmentId : '',
      equipmentName: mode === 'equipment' ? (selectedEquipment?.name || '') : '',
      category: mode === 'driver' ? movement : category.trim(),
      amount: numeric, location: location.trim(), notes: notes.trim(),
      affectsDriverBalance: mode === 'driver',
      createdAt: old?.createdAt || now, updatedAt: now,
    };
    const next = old ? records.map(r => r.id === old.id ? record : r) : [record, ...records];
    if (!persist(next)) return;
    clearForm(mode);
    setMessage(old ? 'تم حفظ التعديل بنجاح.' : mode === 'driver' ? 'تم تسجيل السحب أو السلفة في حساب السائق.' : 'تم تسجيل مصروف المعدة بنجاح.');
  }
  function edit(r: ExpenseRecord) {
    const isDriver = driverMovement(r);
    setMode(isDriver ? 'driver' : 'equipment');
    setEditingId(r.id); setDate(r.date); setDriverId(r.driverId || ''); setEquipmentId(r.equipmentId || '');
    setMovement(r.category === 'سلفة' ? 'سلفة' : 'سحب');
    setCategory(isDriver ? '' : r.category); setValue(String(r.amount)); setLocation(r.location || ''); setNotes(r.notes || '');
    setDetails(true); setMessage(''); setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function remove(r: ExpenseRecord) {
    if (!window.confirm(`حذف ${r.category} بقيمة ${asMoney(r.amount)}؟`)) return;
    if (!persist(records.filter(x => x.id !== r.id))) return;
    if (editingId === r.id) clearForm();
    setMessage('تم حذف الحركة.'); setError('');
  }

  return <AppLayout>
    <div dir="rtl" style={{ width: '100%', maxWidth: 760, margin: '0 auto', minWidth: 0, boxSizing: 'border-box', overflowX: 'clip', paddingBottom: 80, color: INK }}>
      <header style={{ background: NAVY, borderRadius: 18, padding: '19px 18px', marginBottom: 14, color: 'white' }}>
        <div style={{ color: '#e1ba76', fontSize: 11, fontWeight: 900, letterSpacing: 1 }}>BAKR PRO</div>
        <h1 style={{ fontSize: 20, margin: '7px 0', lineHeight: 1.5 }}>إدارة مصروفات المعدات وسحوبات السائقين</h1>
        <div style={{ fontSize: 12, color: '#d2dfec' }}>تسجيل سريع • حسابات منفصلة • سجل محفوظ</div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 7, marginBottom: 13 }}>
        {[
          { title: 'مصروف المعدات اليوم', val: todayEquipment },
          { title: 'سحوبات السائقين اليوم', val: todayDrivers },
          { title: 'الخارج اليوم', val: todayEquipment + todayDrivers },
        ].map((item, idx) => <div key={item.title} style={{ background: idx === 2 ? NAVY : '#fff', border: `1px solid ${idx === 2 ? NAVY : '#e1e8f0'}`, padding: '12px 7px', borderRadius: 13, textAlign: 'center', minWidth: 0 }}>
          <div style={{ fontSize: 10, color: idx === 2 ? '#d1dfeb' : '#64748b', minHeight: 28, lineHeight: 1.4 }}>{item.title}</div>
          <div style={{ fontWeight: 900, fontSize: 16, color: idx === 2 ? '#fff' : INK, overflowWrap: 'anywhere' }}>{fmt(item.val)}</div>
          <div style={{ fontSize: 10, color: idx === 2 ? '#d1dfeb' : '#64748b' }}>ريال</div>
        </div>)}
      </div>

      {error && <div role="alert" style={{ ...panel, color: '#a42323', background: '#fff2f2', borderColor: '#facaca', fontWeight: 700, fontSize: 13 }}>{error}</div>}
      {message && <div role="status" style={{ ...panel, color: '#166534', background: '#effaf2', borderColor: '#c8ebd2', fontWeight: 700, fontSize: 13 }}><Check size={16} style={{ verticalAlign: 'middle', marginLeft: 5 }} />{message}</div>}

      <section style={panel}>
        <h2 style={{ fontSize: 17, margin: '0 0 13px' }}>{editingId ? 'تعديل الحركة' : 'تسجيل حركة جديدة'}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginBottom: 16 }}>
          <button type="button" onClick={() => selectMode('equipment')} style={{ ...action, background: mode === 'equipment' ? NAVY : BG, color: mode === 'equipment' ? '#fff' : INK, border: mode === 'equipment' ? `1px solid ${NAVY}` : '1px solid #dce5ee', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7 }}><Truck size={17} />مصروف معدة</button>
          <button type="button" onClick={() => selectMode('driver')} style={{ ...action, background: mode === 'driver' ? NAVY : BG, color: mode === 'driver' ? '#fff' : INK, border: mode === 'driver' ? `1px solid ${NAVY}` : '1px solid #dce5ee', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7 }}><UserRound size={17} />سحب / سلفة</button>
        </div>

        <div style={{ display: 'grid', gap: 13 }}>
          {mode === 'equipment' ? <>
            <label><span style={label}>اختر الكرين / المعدة</span><select style={input} value={equipmentId} disabled={loading} onChange={e => setEquipmentId(e.target.value)}><option value="">{loading ? 'جار تحميل المعدات...' : 'اختر من المعدات المحفوظة'}</option>{equipment.map(e => <option key={e.id} value={String(e.id)}>{e.name}</option>)}</select></label>
            <label><span style={label}>وصف المصروف</span><input style={input} value={category} onChange={e => setCategory(e.target.value)} placeholder="اكتب أي مصروف، مثل ديزل أو قطع غيار" /></label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {expenseSuggestions.map(item => <button type="button" key={item} onClick={() => setCategory(item)} style={{ border: `1px solid ${category === item ? GOLD : '#dbe3ec'}`, color: INK, background: category === item ? '#fff3da' : BG, padding: '6px 9px', fontSize: 11, borderRadius: 20, cursor: 'pointer' }}>{item}</button>)}
            </div>
          </> : <>
            <label><span style={label}>اختر السائق</span><select style={input} value={driverId} onChange={e => setDriverId(e.target.value)}><option value="">اختر من السائقين المحفوظين</option>{drivers.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}</select></label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
              {(['سحب', 'سلفة'] as const).map(item => <button type="button" key={item} onClick={() => setMovement(item)} style={{ ...action, background: movement === item ? '#e9f1ff' : BG, color: INK, border: `1px solid ${movement === item ? '#528bce' : '#dbe3ec'}` }}>{item}</button>)}
            </div>
            <div style={{ padding: 10, borderRadius: 10, background: '#fff8e8', color: '#795218', fontSize: 12 }}>تُربط هذه الحركة بحساب السائق تلقائياً، ولا تدخل ضمن مصروفات المعدات.</div>
          </>}
          <label><span style={label}>المبلغ (ريال)</span><input style={{ ...input, fontSize: 20, fontWeight: 900, direction: 'ltr', textAlign: 'right' }} inputMode="decimal" value={value} onChange={e => setValue(normalizeDigits(e.target.value))} placeholder="0" /></label>
          <button type="button" onClick={() => setDetails(v => !v)} style={{ border: 0, background: 'transparent', color: '#506780', display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}><CalendarDays size={16} /> التاريخ اليوم تلقائياً • تفاصيل إضافية <ChevronDown size={15} style={{ transform: details ? 'rotate(180deg)' : undefined }} /></button>
          {details && <>
            <label><span style={label}>التاريخ</span><input style={input} type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
            <label><span style={label}>الموقع / الجهة (اختياري)</span><input style={input} value={location} onChange={e => setLocation(e.target.value)} placeholder="مثلاً خميس مشيط" /></label>
            <label><span style={label}>ملاحظات (اختياري)</span><textarea style={{ ...input, height: 78, padding: 12, resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="تفاصيل إضافية إن وجدت" /></label>
          </>}
          <button type="button" onClick={saveMovement} style={{ ...action, background: '#187449', color: '#fff', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Check size={18} />{editingId ? 'حفظ التعديل' : mode === 'driver' ? 'حفظ السحب / السلفة' : 'حفظ المصروف'}</button>
          {editingId !== null && <button type="button" style={{ ...action, background: BG, color: INK, width: '100%' }} onClick={() => { clearForm(); setError(''); }}>إلغاء التعديل</button>}
        </div>
      </section>

      <section style={panel}>
        <h2 style={{ fontSize: 17, margin: '0 0 13px' }}>سجل الحركات المحفوظة</h2>
        <div style={{ display: 'grid', gap: 9 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {([{ v: 'all', t: 'الكل' }, { v: 'equipment', t: 'المعدات' }, { v: 'driver', t: 'السائقون' }] as const).map(f => <button key={f.v} type="button" onClick={() => setFilter(f.v)} style={{ ...action, flex: 1, height: 38, padding: 3, fontSize: 12, background: filter === f.v ? NAVY : BG, color: filter === f.v ? '#fff' : INK }}>{f.t}</button>)}
          </div>
          <div style={{ position: 'relative' }}><Search size={17} color="#8292a3" style={{ position: 'absolute', right: 13, top: 15 }} /><input style={{ ...input, paddingRight: 40 }} placeholder="ابحث باسم السائق أو المعدة أو المصروف" value={search} onChange={e => setSearch(e.target.value)} /></div>
          {visibleRecords.length === 0 ? <p style={{ color: '#697b90', fontSize: 13, margin: 0 }}>لا توجد حركات مطابقة.</p> : visibleRecords.map(r => <div key={r.id} style={{ border: '1px solid #e2e9f1', borderRadius: 13, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
              <div style={{ minWidth: 0 }}><b style={{ fontSize: 14 }}>{r.category}</b><div style={{ fontSize: 12, color: '#65778a', marginTop: 5, overflowWrap: 'anywhere' }}>{driverMovement(r) ? (r.driverName || 'سائق') : (r.equipmentName || 'معدة')} • {r.date}</div></div>
              <div style={{ fontWeight: 900, color: '#b45309', whiteSpace: 'nowrap', fontSize: 14 }}>{asMoney(Number(r.amount))}</div>
            </div>
            {(r.notes || r.location) && <div style={{ color: '#67788b', fontSize: 12, marginTop: 6, overflowWrap: 'anywhere' }}>{[r.location, r.notes].filter(Boolean).join(' • ')}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" onClick={() => edit(r)} style={{ ...action, height: 34, fontSize: 12, color: '#244b77', background: '#eaf2ff', display: 'flex', alignItems: 'center', gap: 5 }}><Pencil size={14} />تعديل</button>
              <button type="button" onClick={() => remove(r)} style={{ ...action, height: 34, fontSize: 12, color: '#9d2929', background: '#ffefef', display: 'flex', alignItems: 'center', gap: 5 }}><Trash2 size={14} />حذف</button>
            </div>
          </div>)}
        </div>
      </section>
      <div style={{ fontSize: 11, color: '#8b99a8', textAlign: 'center' }}>الأرصدة القديمة محفوظة • سحوبات السائقين لا تُحسب مرتين</div>
    </div>
  </AppLayout>;
}

export default DriverEquipmentExpensesPage;
