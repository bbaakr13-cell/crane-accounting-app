import React, { useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Edit3,
  Filter,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { addToRecycleBin } from '@/lib/recycleBin';

type OpportunityStatus =
  | 'new'
  | 'contacted'
  | 'quote'
  | 'followup'
  | 'won'
  | 'done'
  | 'lost';

type LeadSource =
  | 'واتساب'
  | 'حراج'
  | 'Google Maps'
  | 'TikTok'
  | 'Snapchat'
  | 'توصية'
  | 'اتصال'
  | 'أخرى';

type CustomerOpportunity = {
  id: string;
  customerName: string;
  companyName: string;
  phone: string;
  city: string;
  projectLocation: string;
  workType: string;
  quoteValue: number;
  status: OpportunityStatus;
  source: LeadSource;
  lastContact: string;
  nextFollowUp: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = 'bakr_pro_customers_opportunities_v1';

const STATUS_META: Record<
  OpportunityStatus,
  { label: string; bg: string; color: string; border: string }
> = {
  new: { label: 'فرصة جديدة', bg: '#e8fff1', color: '#118847', border: '#a7efc5' },
  contacted: { label: 'تم التواصل', bg: '#fff7db', color: '#9a6a00', border: '#f4d873' },
  quote: { label: 'طلب عرض سعر', bg: '#eaf2ff', color: '#1765c1', border: '#b9d3ff' },
  followup: { label: 'يحتاج متابعة', bg: '#ffe9ee', color: '#c62843', border: '#ffbcc9' },
  won: { label: 'تم الاتفاق', bg: '#e3fff1', color: '#087744', border: '#93e5bc' },
  done: { label: 'تم التنفيذ', bg: '#e7f7ff', color: '#0078a9', border: '#a9dff5' },
  lost: { label: 'لم يتم الاتفاق', bg: '#edf0f4', color: '#596373', border: '#cfd5dc' },
};

const STATUS_ORDER: OpportunityStatus[] = [
  'new',
  'contacted',
  'quote',
  'followup',
  'won',
  'done',
  'lost',
];

const SOURCES: LeadSource[] = [
  'واتساب',
  'حراج',
  'Google Maps',
  'TikTok',
  'Snapchat',
  'توصية',
  'اتصال',
  'أخرى',
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(): CustomerOpportunity {
  return {
    id: '',
    customerName: '',
    companyName: '',
    phone: '',
    city: '',
    projectLocation: '',
    workType: '',
    quoteValue: 0,
    status: 'new',
    source: 'واتساب',
    lastContact: todayIso(),
    nextFollowUp: '',
    notes: '',
    createdAt: '',
    updatedAt: '',
  };
}

function normalizePhone(value: string) {
  let phone = value.replace(/[^\d+]/g, '').trim();
  if (phone.startsWith('00966')) phone = `+966${phone.slice(5)}`;
  if (phone.startsWith('05')) phone = `+966${phone.slice(1)}`;
  if (phone.startsWith('5') && phone.length === 9) phone = `+966${phone}`;
  return phone;
}

function safeDate(value: string) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(`${value}T12:00:00`));
  } catch {
    return value;
  }
}

function needsFollowUp(value: string) {
  if (!value) return false;
  return value <= todayIso();
}

export function CustomersOpportunitiesPage() {
  const [items, setItems] = useState<CustomerOpportunity[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OpportunityStatus>('all');
  const [selectedId, setSelectedId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CustomerOpportunity>(emptyForm());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setItems(Array.isArray(parsed) ? parsed : []);
    } catch {
      setItems([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, loaded]);

  const stats = useMemo(() => ({
    followUps: items.filter(
      x => x.status !== 'done' && x.status !== 'lost' && needsFollowUp(x.nextFollowUp)
    ).length,
    quotePending: items.filter(x => x.status === 'quote').length,
    newCount: items.filter(x => x.status === 'new').length,
    wonCount: items.filter(x => x.status === 'won' || x.status === 'done').length,
  }), [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    return [...items]
      .filter(item => {
        if (statusFilter !== 'all' && item.status !== statusFilter) return false;
        if (!q) return true;

        return [
          item.customerName,
          item.companyName,
          item.phone,
          item.city,
          item.projectLocation,
          item.workType,
          item.notes,
        ]
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const au = needsFollowUp(a.nextFollowUp) ? 1 : 0;
        const bu = needsFollowUp(b.nextFollowUp) ? 1 : 0;
        if (au !== bu) return bu - au;
        return String(b.updatedAt).localeCompare(String(a.updatedAt));
      });
  }, [items, search, statusFilter]);

  const selected =
    items.find(x => x.id === selectedId) || filteredItems[0] || null;

  function openNew() {
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(item: CustomerOpportunity) {
    setForm({ ...item });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setForm(emptyForm());
  }

  function saveForm() {
    if (!form.customerName.trim() && !form.companyName.trim()) {
      alert('اكتب اسم العميل أو اسم الشركة');
      return;
    }
    if (!form.phone.trim()) {
      alert('أدخل رقم الجوال');
      return;
    }

    const now = new Date().toISOString();

    if (form.id) {
      setItems(old =>
        old.map(item =>
          item.id === form.id
            ? { ...form, phone: normalizePhone(form.phone), updatedAt: now }
            : item
        )
      );
      setSelectedId(form.id);
    } else {
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const created: CustomerOpportunity = {
        ...form,
        id,
        phone: normalizePhone(form.phone),
        createdAt: now,
        updatedAt: now,
      };

      setItems(old => [created, ...old]);
      setSelectedId(id);
    }

    closeModal();
  }

  function deleteItem(item: CustomerOpportunity) {
    const name =
      item.companyName ||
      item.customerName ||
      'العميل';

    const ok = window.confirm(
      `نقل ${name} إلى سلة المحذوفات؟

يمكن استعادته لاحقًا.`
    );

    if (!ok) return;

    const originalIndex =
      items.findIndex(
        x => x.id === item.id
      );

    addToRecycleBin({
      entityType:
        'customers-opportunities',
      title: name,
      subtitle: [
        item.phone,
        item.workType,
        item.projectLocation ||
          item.city,
      ]
        .filter(Boolean)
        .join(' • '),
      sourceStorageKey:
        STORAGE_KEY,
      payload: item,
      originalIndex,
    });

    setItems(old =>
      old.filter(
        x => x.id !== item.id
      )
    );

    if (
      selectedId === item.id
    ) {
      setSelectedId('');
    }
  }

  function openPhone(phone: string) {
    window.location.href = `tel:${normalizePhone(phone)}`;
  }

  function openWhatsApp(item: CustomerOpportunity) {
    const phone = normalizePhone(item.phone).replace('+', '');
    const name = item.customerName || item.companyName || 'أخي';
    const text = [
      `السلام عليكم ${name}،`,
      'معك BAKR PRO لخدمات الكرينات والرافعات.',
      item.workType ? `بخصوص: ${item.workType}` : '',
      item.projectLocation ? `الموقع: ${item.projectLocation}` : '',
      '',
      'حابين نتابع معكم ونكون جاهزين لخدمتكم في الوقت المناسب.',
    ].filter(Boolean).join('\n');

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  }

  function openMap(item: CustomerOpportunity) {
    const query = item.projectLocation || item.city;
    if (!query.trim()) {
      alert('أضف موقع المشروع أو المدينة أولاً');
      return;
    }
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
      '_blank'
    );
  }

  function followTomorrow(item: CustomerOpportunity) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const next = d.toISOString().slice(0, 10);

    setItems(old =>
      old.map(x =>
        x.id === item.id
          ? { ...x, status: 'followup', nextFollowUp: next, updatedAt: new Date().toISOString() }
          : x
      )
    );
  }

  const card: React.CSSProperties = {
    background: '#0b1527',
    border: '1px solid #1e304b',
    borderRadius: 18,
    boxShadow: '0 14px 32px rgba(0,0,0,.12)',
  };

  const input: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: 12,
    border: '1px solid #2a3c59',
    background: '#091321',
    color: '#fff',
    padding: '12px 13px',
    outline: 'none',
    fontSize: 14,
  };

  return (
    <AppLayout>
      <div dir="rtl" style={{ padding: 18, paddingBottom: 110, color: '#fff' }}>
        <style>{`
          .crm-scroll::-webkit-scrollbar{width:8px;height:8px}
          .crm-scroll::-webkit-scrollbar-thumb{background:#304867;border-radius:10px}
          .crm-card{transition:.18s ease}
          .crm-card:hover{transform:translateY(-1px);border-color:#36587f!important}
          @media(max-width:980px){.crm-grid{grid-template-columns:1fr!important}.crm-details{display:none!important}}
          @media(max-width:720px){.crm-stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}.crm-toolbar{grid-template-columns:1fr!important}}
        `}</style>

        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>العملاء والفرص</h1>
              <div style={{ color: '#94a3b8', marginTop: 5, fontSize: 13 }}>
                إدارة العملاء ومتابعة الفرص والمشاريع المحتملة
              </div>
            </div>

            <button onClick={openNew} style={{ border: 'none', borderRadius: 13, padding: '12px 17px', background: '#f4b51f', color: '#101010', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
              <Plus size={19} /> عميل جديد
            </button>
          </div>

          <div className="crm-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, marginBottom: 14 }}>
            <StatCard title="يحتاج متابعة اليوم" value={stats.followUps} icon={<Clock3 size={21} />} color="#cb2f49" bg="#ffe9ef" />
            <StatCard title="عروض سعر معلقة" value={stats.quotePending} icon={<CircleDollarSign size={21} />} color="#2867c7" bg="#e9f1ff" />
            <StatCard title="فرص جديدة" value={stats.newCount} icon={<UsersRound size={21} />} color="#15865c" bg="#e5fbf1" />
            <StatCard title="تم الاتفاق / التنفيذ" value={stats.wonCount} icon={<CheckCircle2 size={21} />} color="#9a6200" bg="#fff4db" />
          </div>

          <div className="crm-toolbar" style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 10, marginBottom: 14 }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', right: 13, top: 13, color: '#8da0b8' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث باسم العميل أو الجوال أو المشروع أو المدينة..." style={{ ...input, paddingRight: 40 }} />
            </div>

            <div style={{ position: 'relative' }}>
              <Filter size={17} style={{ position: 'absolute', right: 12, top: 13, color: '#8da0b8', pointerEvents: 'none' }} />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | OpportunityStatus)} style={{ ...input, paddingRight: 38 }}>
                <option value="all">كل الحالات</option>
                {STATUS_ORDER.map(status => <option key={status} value={status}>{STATUS_META[status].label}</option>)}
              </select>
            </div>
          </div>

          <div className="crm-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.55fr) minmax(310px,.8fr)', gap: 14, alignItems: 'start' }}>
            <div className="crm-scroll" style={{ display: 'grid', gap: 10, maxHeight: 'calc(100vh - 310px)', overflowY: 'auto', paddingLeft: 3 }}>
              {!filteredItems.length ? (
                <div style={{ ...card, padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                  <UsersRound size={42} style={{ marginBottom: 10 }} />
                  <div style={{ color: '#fff', fontWeight: 900, fontSize: 17 }}>لا يوجد عملاء أو فرص بعد</div>
                  <div style={{ marginTop: 6 }}>اضغط «عميل جديد» وسجّل أول فرصة عمل.</div>
                </div>
              ) : filteredItems.map(item => {
                const meta = STATUS_META[item.status];
                const urgent = item.status !== 'done' && item.status !== 'lost' && needsFollowUp(item.nextFollowUp);

                return (
                  <div key={item.id} className="crm-card" onClick={() => setSelectedId(item.id)} style={{ ...card, border: selected?.id === item.id ? '1px solid #2f87f6' : urgent ? '1px solid #7c3e4f' : '1px solid #1e304b', padding: 14, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 220, flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ fontWeight: 900, fontSize: 17 }}>{item.companyName || item.customerName || 'بدون اسم'}</div>
                          <span style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, padding: '5px 9px', borderRadius: 999, fontSize: 11, fontWeight: 900 }}>{meta.label}</span>
                          {urgent && <span style={{ background: '#351521', color: '#ff98ac', padding: '5px 9px', borderRadius: 999, fontSize: 11, fontWeight: 900 }}>متابعة اليوم</span>}
                        </div>

                        {item.customerName && item.companyName && (
                          <div style={{ color: '#c2ccda', marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                            <UserRound size={15} /> {item.customerName}
                          </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 7, marginTop: 10, color: '#aab7c8', fontSize: 13 }}>
                          <div><Phone size={14} style={{ verticalAlign: -3 }} /> {item.phone}</div>
                          <div><MapPin size={14} style={{ verticalAlign: -3 }} /> {item.city || item.projectLocation || 'بدون موقع'}</div>
                          <div><BriefcaseBusiness size={14} style={{ verticalAlign: -3 }} /> {item.workType || 'نوع العمل غير محدد'}</div>
                          <div><CalendarDays size={14} style={{ verticalAlign: -3 }} /> آخر تواصل: {safeDate(item.lastContact)}</div>
                        </div>
                      </div>

                      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                        <RoundButton title="اتصال" onClick={() => openPhone(item.phone)}><Phone size={18} /></RoundButton>
                        <RoundButton title="واتساب" onClick={() => openWhatsApp(item)} bg="#0aa86f"><MessageCircle size={18} /></RoundButton>
                        <RoundButton title="الموقع" onClick={() => openMap(item)}><MapPin size={18} /></RoundButton>
                        <RoundButton title="تعديل" onClick={() => openEdit(item)}><Edit3 size={18} /></RoundButton>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="crm-details" style={{ ...card, position: 'sticky', top: 14, overflow: 'hidden' }}>
              {!selected ? (
                <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>اختر عميلًا لعرض التفاصيل</div>
              ) : (
                <>
                  <div style={{ minHeight: 145, padding: 18, background: 'linear-gradient(135deg,#0a2646 0%,#11213a 55%,#111827 100%)', borderBottom: '1px solid #243755' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <button onClick={() => openEdit(selected)} style={{ background: '#ffffff14', color: '#fff', border: '1px solid #ffffff2e', borderRadius: 10, padding: '8px 10px', display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', fontWeight: 800 }}>
                        <Edit3 size={16} /> تعديل
                      </button>
                      <span style={{ background: STATUS_META[selected.status].bg, color: STATUS_META[selected.status].color, padding: '6px 10px', borderRadius: 999, fontSize: 11, fontWeight: 900 }}>{STATUS_META[selected.status].label}</span>
                    </div>

                    <div style={{ fontSize: 21, fontWeight: 900, marginTop: 25 }}>{selected.companyName || selected.customerName || 'بدون اسم'}</div>
                    {selected.customerName && selected.companyName && <div style={{ color: '#b7c5d8', marginTop: 5 }}>المسؤول: {selected.customerName}</div>}
                  </div>

                  <div style={{ padding: 16 }}>
                    <DetailRow label="رقم الجوال" value={selected.phone || '—'} />
                    <DetailRow label="المدينة" value={selected.city || '—'} />
                    <DetailRow label="موقع المشروع" value={selected.projectLocation || '—'} />
                    <DetailRow label="نوع العمل" value={selected.workType || '—'} />
                    <DetailRow label="قيمة عرض السعر" value={selected.quoteValue > 0 ? `${selected.quoteValue.toLocaleString('en-US')} ر.س` : '—'} />
                    <DetailRow label="المصدر" value={selected.source} />
                    <DetailRow label="آخر تواصل" value={safeDate(selected.lastContact)} />
                    <DetailRow label="المتابعة القادمة" value={safeDate(selected.nextFollowUp)} />

                    <div style={{ marginTop: 12, padding: 12, background: '#081321', border: '1px solid #223650', borderRadius: 12 }}>
                      <div style={{ color: '#8fa2ba', fontSize: 11, fontWeight: 800, marginBottom: 5 }}>ملاحظات</div>
                      <div style={{ color: '#e7edf5', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{selected.notes || 'لا توجد ملاحظات'}</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginTop: 14 }}>
                      <ActionButton label="واتساب" icon={<MessageCircle size={17} />} onClick={() => openWhatsApp(selected)} bg="#0aa86f" />
                      <ActionButton label="اتصال" icon={<Phone size={17} />} onClick={() => openPhone(selected.phone)} bg="#1976df" />
                      <ActionButton label="الموقع" icon={<MapPin size={17} />} onClick={() => openMap(selected)} bg="#263b58" />
                      <ActionButton label="متابعة غدًا" icon={<CalendarDays size={17} />} onClick={() => followTomorrow(selected)} bg="#7b4e13" />
                    </div>

                    <button onClick={() => deleteItem(selected)} style={{ width: '100%', marginTop: 8, borderRadius: 11, border: '1px solid #632b35', background: '#2a1117', color: '#ff9aab', padding: 11, cursor: 'pointer', fontWeight: 900, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7 }}>
                      <Trash2 size={17} /> حذف العميل
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {modalOpen && (
          <div onMouseDown={e => { if (e.target === e.currentTarget) closeModal(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(2,8,18,.74)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 9999, backdropFilter: 'blur(4px)' }}>
            <div className="crm-scroll" style={{ width: 'min(760px,100%)', maxHeight: '92vh', overflowY: 'auto', background: '#0b1527', border: '1px solid #2a405f', borderRadius: 20, boxShadow: '0 30px 90px rgba(0,0,0,.45)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 17, borderBottom: '1px solid #20314a', position: 'sticky', top: 0, background: '#0b1527', zIndex: 2 }}>
                <div style={{ fontSize: 19, fontWeight: 900 }}>{form.id ? 'تعديل العميل والفرصة' : 'إضافة عميل وفرصة جديدة'}</div>
                <button onClick={closeModal} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid #2b3d57', background: '#111f33', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={19} /></button>
              </div>

              <div style={{ padding: 17, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
                <Field label="اسم العميل / المسؤول"><input value={form.customerName} onChange={e => setForm(old => ({ ...old, customerName: e.target.value }))} placeholder="مثال: أحمد محمد" style={input} /></Field>
                <Field label="اسم الشركة / المؤسسة"><input value={form.companyName} onChange={e => setForm(old => ({ ...old, companyName: e.target.value }))} placeholder="مثال: شركة المقاولات الحديثة" style={input} /></Field>
                <Field label="رقم الجوال"><input value={form.phone} onChange={e => setForm(old => ({ ...old, phone: e.target.value }))} inputMode="tel" placeholder="05xxxxxxxx" style={input} /></Field>
                <Field label="المدينة"><input value={form.city} onChange={e => setForm(old => ({ ...old, city: e.target.value }))} placeholder="خميس مشيط / أبها..." style={input} /></Field>
                <Field label="موقع المشروع"><input value={form.projectLocation} onChange={e => setForm(old => ({ ...old, projectLocation: e.target.value }))} placeholder="اسم الحي أو المشروع" style={input} /></Field>
                <Field label="نوع العمل"><input value={form.workType} onChange={e => setForm(old => ({ ...old, workType: e.target.value }))} placeholder="هناجر / مصاعد / أبراج / تحميل..." style={input} /></Field>
                <Field label="حالة الفرصة"><select value={form.status} onChange={e => setForm(old => ({ ...old, status: e.target.value as OpportunityStatus }))} style={input}>{STATUS_ORDER.map(status => <option key={status} value={status}>{STATUS_META[status].label}</option>)}</select></Field>
                <Field label="مصدر العميل"><select value={form.source} onChange={e => setForm(old => ({ ...old, source: e.target.value as LeadSource }))} style={input}>{SOURCES.map(source => <option key={source} value={source}>{source}</option>)}</select></Field>
                <Field label="قيمة عرض السعر"><input value={form.quoteValue || ''} onChange={e => setForm(old => ({ ...old, quoteValue: Number(e.target.value || 0) }))} inputMode="decimal" type="number" min={0} placeholder="0" style={input} /></Field>
                <Field label="تاريخ آخر تواصل"><input value={form.lastContact} onChange={e => setForm(old => ({ ...old, lastContact: e.target.value }))} type="date" style={input} /></Field>
                <Field label="المتابعة القادمة"><input value={form.nextFollowUp} onChange={e => setForm(old => ({ ...old, nextFollowUp: e.target.value }))} type="date" style={input} /></Field>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 12, color: '#aab7c8', display: 'block', marginBottom: 6, fontWeight: 700 }}>ملاحظات المشروع والعميل</label>
                  <textarea value={form.notes} onChange={e => setForm(old => ({ ...old, notes: e.target.value }))} rows={4} placeholder="مثال: يحتاج كرين لتركيب هنجر، ينتظر موافقة الإدارة..." style={{ ...input, resize: 'vertical' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: 17, borderTop: '1px solid #20314a' }}>
                <button onClick={saveForm} style={{ border: 'none', borderRadius: 12, padding: 13, background: '#f4b51f', color: '#111', fontWeight: 900, cursor: 'pointer' }}>{form.id ? 'حفظ التعديلات' : 'إضافة العميل'}</button>
                <button onClick={closeModal} style={{ border: '1px solid #2c405f', borderRadius: 12, padding: 13, background: '#101d30', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>إلغاء</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function StatCard({ title, value, icon, color, bg }: { title: string; value: number; icon: React.ReactNode; color: string; bg: string }) {
  return (
    <div style={{ background: bg, color, border: '1px solid #ffffff30', borderRadius: 16, padding: 15, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
      <div><div style={{ fontSize: 12, fontWeight: 800 }}>{title}</div><div style={{ fontSize: 28, lineHeight: 1.1, marginTop: 5, fontWeight: 900 }}>{value}</div></div>
      {icon}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: '#aab7c8', display: 'block', marginBottom: 6, fontWeight: 700 }}>{label}</label>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '125px minmax(0,1fr)', gap: 10, padding: '10px 0', borderBottom: '1px solid #1d2e46', alignItems: 'center' }}>
      <div style={{ color: '#8fa2ba', fontSize: 12, fontWeight: 800 }}>{label}</div>
      <div style={{ color: '#fff', fontWeight: 800, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  );
}

function RoundButton({ title, onClick, bg = '#263b58', children }: { title: string; onClick: () => void; bg?: string; children: React.ReactNode }) {
  return (
    <button title={title} onClick={onClick} style={{ width: 39, height: 39, borderRadius: 999, border: '1px solid #2d4666', background: bg, color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
      {children}
    </button>
  );
}

function ActionButton({ label, icon, onClick, bg }: { label: string; icon: React.ReactNode; onClick: () => void; bg: string }) {
  return (
    <button onClick={onClick} style={{ border: 'none', borderRadius: 11, background: bg, color: '#fff', padding: '11px 8px', cursor: 'pointer', fontWeight: 900, display: 'flex', gap: 7, justifyContent: 'center', alignItems: 'center' }}>
      {icon}{label}
    </button>
  );
}
