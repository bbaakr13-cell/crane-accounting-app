import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays, ChevronDown, ChevronUp, ClipboardList, FileDown,
  Pencil, Plus, Save, Search, Share2, Trash2, Wallet, X,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/** Saved in localStorage, so both the ordinary and the comprehensive BAKR PRO backup include it. */
const STORAGE_KEY = 'bakr_pro_receivables_v1';

type Payment = { id: string; date: string; amount: number; note: string };
type Term = 'آجل' | 'لم يحاسب';
type Receivable = {
  id: string;
  customer: string;
  phone: string;
  equipment: string;
  workName: string;
  work: string;
  date: string;
  dueDate: string;
  total: number;
  term: Term;
  notes: string;
  payments: Payment[];
  createdAt: string;
  updatedAt: string;
};
type FormData = Omit<Receivable, 'id' | 'payments' | 'createdAt' | 'updatedAt' | 'total'> & { total: string };

function localDay() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
function freshForm(): FormData {
  return { customer: '', phone: '', equipment: 'كرين', workName: '', work: '', date: localDay(), dueDate: '', total: '', term: 'لم يحاسب', notes: '' };
}
function uid() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function amount(value: number) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value || 0); }
function money(value: number) { return `${amount(value)} ر.س`; }
function paid(record: Receivable) { return record.payments.reduce((s, p) => s + p.amount, 0); }
function remaining(record: Receivable) { return Math.max(0, record.total - paid(record)); }
function paymentStatus(record: Receivable) {
  if (record.total <= 0) return 'بانتظار تحديد القيمة';
  if (remaining(record) <= 0.001) return 'تم السداد';
  if (paid(record) > 0) return 'سداد جزئي';
  return record.term === 'آجل' ? 'مستحق آجل' : 'لم يحاسب';
}
function loadRecords(): Receivable[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter(v => v && typeof v.id === 'string' && typeof v.customer === 'string')
      .map(v => ({ ...v, workName: typeof v.workName === 'string' ? v.workName : '', total: Number(v.total) || 0, payments: Array.isArray(v.payments) ? v.payments : [] }));
  } catch { return []; }
}
function safeText(s: unknown) {
  return String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function normalizedPhone(value: string) {
  let n = value.replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  if (n.startsWith('0') && n.length === 10) n = '966' + n.slice(1);
  if (n.length === 9 && n.startsWith('5')) n = '966' + n;
  return n;
}
const card = 'rounded-[22px] border border-amber-200/20 bg-[#11233d] shadow-xl';
const field = 'block w-full rounded-xl border border-white/15 bg-[#071626] px-3 py-3 text-[14px] text-white placeholder:text-slate-500 outline-none focus:border-amber-400';

/** A4 print-layout with a fixed physical aspect ratio, crisp Arabic and a separate Save / Share flow. */
function reportHtml(pageRecords: Receivable[], allRecords: Receivable[], page: number, totalPages: number) {
  const total = allRecords.reduce((s, r) => s + r.total, 0);
  const received = allRecords.reduce((s, r) => s + paid(r), 0);
  const due = allRecords.reduce((s, r) => s + remaining(r), 0);
  const unpriced = allRecords.filter(r => r.total <= 0).length;
  const tile = (label: string, value: string, tone: string) => `
    <div style="flex:1;min-width:0;padding:16px 13px;border-radius:12px;background:${tone};border:1px solid #dfE5ed;box-sizing:border-box">
      <div style="font-size:14px;font-weight:700;color:#526174;white-space:nowrap">${label}</div>
      <div dir="ltr" style="direction:ltr;text-align:right;margin-top:9px;font-size:23px;line-height:1.1;font-weight:900;color:#10233a;white-space:nowrap">${value}</div>
    </div>`;
  const oneRecord = pageRecords.length === 1;
  const rowHeight = oneRecord ? 500 : 280;
  const rows = pageRecords.map((r, index) => {
    const isSingle = oneRecord;
    const status = paymentStatus(r);
    const recordPaid = paid(r);
    const recordDue = remaining(r);
    return `<section style="position:relative;box-sizing:border-box;height:${rowHeight}px;background:#fff;border:1px solid #d9e0e9;border-radius:15px;margin-bottom:12px;overflow:hidden;box-shadow:0 2px 5px rgba(13,33,56,.04)">
      <div style="position:absolute;right:0;top:0;bottom:0;width:6px;background:#c9a35c"></div>
      <div style="padding:12px 22px 9px 20px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:35px">
          <div style="display:flex;gap:11px;align-items:center;min-width:0">
            <span style="width:30px;height:30px;line-height:30px;text-align:center;border-radius:9px;background:#0e2947;color:#edcc7c;font-size:16px;font-weight:800">${(page - 1) * 2 + index + 1}</span>
            <strong style="font-size:${r.customer.length > 38 ? 15 : r.customer.length > 25 ? 17 : 21}px;font-weight:900;color:#0c223b;max-width:450px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safeText(r.customer)}</strong>
          </div>
          <div style="padding:7px 11px;background:${recordDue < .01 && r.total > 0 ? '#e8f8f0' : '#fff3dc'};color:${recordDue < .01 && r.total > 0 ? '#087b56' : '#93600c'};border-radius:8px;font-weight:900;font-size:13px;white-space:nowrap">${safeText(status)}</div>
        </div>
        <div style="margin-top:6px;display:flex;align-items:baseline;gap:9px;min-height:23px;font-size:15px;line-height:1.5;overflow-wrap:anywhere">
          <b style="color:#223951;white-space:nowrap">اسم العمل:</b>
          <strong style="font-size:16px;color:#0d3152">${safeText(r.workName || 'غير محدد')}</strong>
        </div>
        <div style="margin-top:1px;color:#53657b;font-size:13px;line-height:1.5;min-height:23px;overflow-wrap:anywhere">
          <span><b style="color:#223951">وصف العمل:</b> ${safeText(r.work || '—')}</span>
        </div>
        <div style="display:flex;gap:10px;margin-top:5px;font-size:13px;line-height:1.65;color:#30445f">
          <div style="flex:1"><span style="color:#748396">التاريخ: </span><b dir="ltr">${safeText(r.date)}</b></div>
          <div style="flex:1"><span style="color:#748396">المعدة: </span><b>${safeText(r.equipment || '—')}</b></div>
          <div style="flex:1"><span style="color:#748396">موعد السداد: </span><b dir="ltr">${safeText(r.dueDate || '—')}</b></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:10px;border-top:1px solid #edf0f5;padding-top:9px">
          <div style="flex:1;padding:9px;background:#f2f5f9;border-radius:9px;box-sizing:border-box">
            <div style="font-size:12px;color:#57677c">قيمة العمل</div><div dir="ltr" style="text-align:right;font-size:17px;font-weight:900;color:#152b48">${money(r.total)}</div>
          </div>
          <div style="flex:1;padding:10px;background:#edf8f3;border-radius:9px;box-sizing:border-box">
            <div style="font-size:12px;color:#57677c">المبلغ المدفوع</div><div dir="ltr" style="text-align:right;font-size:17px;font-weight:900;color:#11875d">${money(recordPaid)}</div>
          </div>
          <div style="flex:1;padding:10px;background:#fff3e1;border-radius:9px;box-sizing:border-box">
            <div style="font-size:12px;color:#79562e">المتبقي على العميل</div><div dir="ltr" style="text-align:right;font-size:18px;font-weight:900;color:#9d5a10">${money(recordDue)}</div>
          </div>
        </div>
        ${isSingle ? `
          <div style="margin-top:18px;display:flex;gap:12px">
            <div style="flex:1;border:1px solid #e6eaf0;border-radius:10px;padding:12px;min-height:70px;box-sizing:border-box">
              <div style="color:#718197;font-size:12px;font-weight:800">رقم جوال العميل</div>
              <div dir="ltr" style="text-align:right;font-size:17px;color:#203d5a;font-weight:900;margin-top:6px">${safeText(r.phone || '—')}</div>
            </div>
            <div style="flex:2;border:1px solid #e6eaf0;border-radius:10px;padding:12px;min-height:70px;box-sizing:border-box">
              <div style="color:#718197;font-size:12px;font-weight:800">الملاحظات</div>
              <div style="font-size:14px;color:#213a53;margin-top:6px;overflow-wrap:anywhere">${safeText(r.notes || 'لا توجد ملاحظات مسجلة')}</div>
            </div>
          </div>
          <div style="margin-top:13px;padding:11px 13px;background:#f6f8fb;border:1px solid #e6eaf0;border-radius:10px">
            <div style="font-size:13px;font-weight:900;color:#1f3753;margin-bottom:5px">سجل الدفعات (${r.payments.length})</div>
            <div style="color:#506277;font-size:12px;line-height:1.6;overflow-wrap:anywhere">${r.payments.length ? safeText(r.payments.map(p => `${p.date}: ${money(Number(p.amount) || 0)}${p.note ? ` (${p.note})` : ''}`).join('  •  ')) : 'لا توجد دفعات مسجلة حتى تاريخ التقرير.'}</div>
          </div>` : `<div style="font-size:12px;color:#526176;margin-top:9px;overflow-wrap:anywhere">${r.phone ? `جوال: ${safeText(r.phone)}   •   ` : ''}الدفعات: ${r.payments.length}${r.notes ? `   •   ${safeText(r.notes)}` : ''}</div>`}
      </div>
    </section>`;
  }).join('');

  return `<div dir="rtl" style="width:794px;height:1123px;box-sizing:border-box;overflow:hidden;padding:30px 35px 29px;background:#fff;color:#132840;direction:rtl;font-family:'Noto Sans Arabic','Noto Naskh Arabic',Tahoma,Arial,sans-serif;position:relative">
    <header style="height:148px;border-radius:18px;background:linear-gradient(112deg,#091b32,#112d4c);color:#fff;border-bottom:5px solid #cba75f;position:relative;box-sizing:border-box;overflow:hidden;padding:25px 28px">
      <div style="position:absolute;left:-52px;top:-90px;width:280px;height:280px;border:1px solid rgba(230,198,121,.18);border-radius:100%"></div>
      <div style="position:absolute;left:-5px;top:-15px;width:170px;height:170px;border:1px solid rgba(230,198,121,.12);border-radius:100%"></div>
      <div style="font-size:19px;letter-spacing:2px;font-weight:900;color:#f4d381;direction:ltr;text-align:right">BAKR PRO</div>
      <h1 style="font-size:31px;line-height:1.25;font-weight:900;margin:9px 0 4px">تقرير مستحقات العملاء</h1>
      <div style="font-size:14px;color:#dae3ed">كشف الأعمال الآجلة وغير المسددة • سجل المتابعة المالية</div>
      <div style="position:absolute;left:28px;bottom:24px;text-align:left;color:#e7eaf0;font-size:13px">تاريخ التقرير<br><b style="font-size:15px;direction:ltr">${safeText(localDay())}</b></div>
    </header>
    <div style="display:flex;gap:10px;margin-top:17px;height:91px">
      ${tile('عدد السجلات', String(allRecords.length), '#f3f6fa')}
      ${tile('قيمة الأعمال (ر.س)', amount(total), '#f3f6fa')}
      ${tile('المبالغ المحصلة', amount(received), '#eff8f4')}
      ${tile('المبلغ المتبقي', amount(due), '#fff5e3')}
    </div>
    <div style="margin-top:16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
      <strong style="font-size:19px;color:#142b47">تفاصيل المستحقات</strong>
      <span style="font-size:12px;color:#6e7b8e;font-weight:700">${unpriced ? `أعمال لم تحدد قيمتها: ${unpriced} • ` : ''}صفحة ${page} من ${totalPages}</span>
    </div>
    ${rows}
    <div style="position:absolute;bottom:83px;right:35px;left:35px;box-sizing:border-box;background:#f1f5f9;border:1px solid #dce4ec;border-radius:13px;padding:15px 18px;display:flex;align-items:center;justify-content:space-between">
      <div><div style="color:#4b5e76;font-size:13px;font-weight:700">إجمالي المتبقي على العملاء</div><div style="font-size:13px;color:#748295;margin-top:5px">الدفعات المسجلة محسوبة ضمن الإجمالي</div></div>
      <div dir="ltr" style="direction:ltr;font-size:28px;font-weight:900;color:#aa6a15">${money(due)}</div>
    </div>
    <div style="position:absolute;bottom:29px;right:35px;left:35px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid #e0e6ee;padding-top:12px;font-size:12px;color:#6a7a8c">
      <div>BAKR PRO • تقرير للمتابعة والتوثيق • لا يُعد فاتورة ضريبية</div>
      <div dir="ltr" style="font-weight:800;color:#153453">Page ${page} / ${totalPages}</div>
    </div>
  </div>`;
}

async function createPdf(records: Receivable[], mode: 'save' | 'share' = 'save') {
  if (!records.length) throw new Error('لا توجد مستحقات للتصدير');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  if (document.fonts?.ready) await document.fonts.ready;
  const perPage = 2;
  const pages = Math.ceil(records.length / perPage);
  for (let page = 1; page <= pages; page++) {
    const sheet = document.createElement('div');
    sheet.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;background:#fff;z-index:-1;box-sizing:border-box';
    sheet.innerHTML = reportHtml(records.slice((page - 1) * perPage, page * perPage), records, page, pages);
    document.body.appendChild(sheet);
    try {
      const canvas = await html2canvas(sheet, {
        backgroundColor: '#ffffff', scale: 2.5, width: 794, height: 1123,
        logging: false, useCORS: true, scrollX: 0, scrollY: 0,
      });
      if (page > 1) pdf.addPage();
      // Occupy the full A4 page: no shrunk report or long unbalanced blank space.
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.96), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    } finally { sheet.remove(); }
  }
  const d = new Date();
  const time = `${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
  const filename = `BAKR_PRO_Receivables_${localDay()}_${time}.pdf`;
  if (Capacitor.isNativePlatform()) {
    const data = pdf.output('datauristring').split(',')[1];
    if (mode === 'share') {
      const shared = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache, recursive: true });
      await Share.share({ title: 'BAKR PRO | مستحقات العملاء', url: shared.uri, dialogTitle: 'مشاركة كشف المستحقات' });
      return filename;
    }
    await Filesystem.writeFile({ path: `BAKR_PRO/${filename}`, data, directory: Directory.Documents, recursive: true });
    return filename;
  }
  pdf.save(filename);
  return filename;
}

export function ReceivablesPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<Receivable[]>(loadRecords);
  const [form, setForm] = useState<FormData>(freshForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all'|'pending'|'paid'|'unpriced'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newPaymentId, setNewPaymentId] = useState<string | null>(null);
  const [paymentInput, setPaymentInput] = useState({ date: localDay(), amount: '', note: '' });
  const [busy, setBusy] = useState(false);

  function persist(next: Receivable[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setRecords(next);
      return true;
    } catch {
      alert('تعذر حفظ البيانات. تأكد من توفر مساحة تخزين في الجوال ثم حاول مجددًا.');
      return false;
    }
  }
  const ordered = useMemo(() => [...records].sort((a,b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || '')), [records]);
  const filtered = useMemo(() => ordered.filter(r => {
    const matches = [r.customer,r.phone,r.equipment,r.workName,r.work,r.notes].join(' ').toLowerCase().includes(search.trim().toLowerCase());
    if (!matches) return false;
    if (filter === 'paid') return r.total > 0 && remaining(r) < 0.001;
    if (filter === 'pending') return r.total > 0 && remaining(r) > 0.001;
    if (filter === 'unpriced') return r.total <= 0;
    return true;
  }), [ordered, search, filter]);
  const statistics = useMemo(() => ({
    total: records.reduce((s,r) => s + r.total, 0),
    paid: records.reduce((s,r) => s + paid(r), 0),
    due: records.reduce((s,r) => s + remaining(r), 0),
    unpriced: records.filter(r => r.total <= 0).length,
  }), [records]);
  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) { setForm(f => ({ ...f, [key]: value })); }
  function openNew() { setEditId(null); setForm(freshForm()); setShowForm(true); window.scrollTo({top:0,behavior:'smooth'}); }
  function edit(record: Receivable) {
    setForm({ customer:record.customer,phone:record.phone,equipment:record.equipment,workName:record.workName || '',work:record.work,date:record.date,dueDate:record.dueDate,total:String(record.total || ''),term:record.term,notes:record.notes });
    setEditId(record.id); setShowForm(true); window.scrollTo({top:0,behavior:'smooth'});
  }
  function saveRecord() {
    if (!form.customer.trim() || (!form.workName.trim() && !form.work.trim())) { alert('أدخل اسم العميل واسم العمل أو وصفه.'); return; }
    const sum = form.total.trim() === '' ? 0 : Number(form.total);
    if (!Number.isFinite(sum) || sum < 0) { alert('قيمة العمل يجب أن تكون رقمًا صحيحًا غير سالب.'); return; }
    const current = editId ? records.find(r => r.id === editId) : undefined;
    if (current && sum + 0.001 < paid(current)) { alert('قيمة العمل لا يمكن أن تقل عن الدفعات المسجلة.'); return; }
    const now = new Date().toISOString();
    const record: Receivable = {
      id: current?.id || uid(),
      customer: form.customer.trim(), phone: form.phone.trim(), equipment: form.equipment.trim(),
      workName: form.workName.trim(), work: form.work.trim(), date: form.date || localDay(), dueDate: form.dueDate,
      total: Math.round(sum * 100) / 100, term: form.term, notes: form.notes.trim(),
      payments: current?.payments || [], createdAt: current?.createdAt || now, updatedAt: now,
    };
    const next = current ? records.map(r => r.id === current.id ? record : r) : [record, ...records];
    if (persist(next)) { setShowForm(false); setEditId(null); setForm(freshForm()); }
  }
  function addPayment(record: Receivable) {
    const value = Number(paymentInput.amount);
    if (!Number.isFinite(value) || Math.round(value * 100) < 1) { alert('أدخل قيمة الدفعة بشكل صحيح.'); return; }
    if (record.total <= 0) { alert('حدد قيمة الشغل أولاً من زر تعديل.'); return; }
    if (Math.round(value * 100) > Math.round(remaining(record) * 100)) { alert(`قيمة الدفعة أكبر من المبلغ المتبقي (${money(remaining(record))}).`); return; }
    const payment: Payment = { id: uid(), amount: Math.round(value * 100) / 100, date: paymentInput.date || localDay(), note: paymentInput.note.trim() };
    const updated = { ...record, payments: [...record.payments, payment], updatedAt: new Date().toISOString() };
    if (persist(records.map(r => r.id === record.id ? updated : r))) {
      setPaymentInput({ date: localDay(), amount:'', note:'' }); setNewPaymentId(null); setExpandedId(record.id);
    }
  }
  function removePayment(record: Receivable, payment: Payment) {
    if (!window.confirm(`حذف دفعة ${money(payment.amount)} من حساب ${record.customer}؟`)) return;
    const updated = { ...record, payments: record.payments.filter(p => p.id !== payment.id), updatedAt: new Date().toISOString() };
    persist(records.map(r => r.id === record.id ? updated : r));
  }
  function removeRecord(record: Receivable) {
    if (!window.confirm(`حذف سجل ${record.customer} نهائيًا بكل الدفعات التابعة له؟ تأكد من وجود نسخة احتياطية.`)) return;
    persist(records.filter(r => r.id !== record.id));
  }
  async function shareRecord(record: Receivable) {
    const text = `السلام عليكم\nحساب الشغل لدى BAKR PRO\nالعميل: ${record.customer}\nاسم العمل: ${record.workName || '—'}\nوصف العمل: ${record.work || '—'}\nالتاريخ: ${record.date}\nقيمة العمل: ${money(record.total)}\nالمدفوع: ${money(paid(record))}\nالمتبقي: ${money(remaining(record))}${record.dueDate ? `\nموعد السداد: ${record.dueDate}` : ''}\nشاكرين تعاونكم.`;
    const phone = normalizedPhone(record.phone);
    if (phone && /^\d{10,15}$/.test(phone)) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    } else if (Capacitor.isNativePlatform() || navigator.share) {
      try { await Share.share({ title:'مستحقات العميل', text }); } catch { /* Share cancelled. */ }
    } else {
      await navigator.clipboard?.writeText(text);
      alert('تم نسخ ملخص الحساب للمشاركة.');
    }
  }
  async function exportPdf(mode: 'save' | 'share' = 'save') {
    if (!records.length) return;
    try {
      setBusy(true);
      const file = await createPdf(ordered, mode);
      if (mode === 'save' && Capacitor.isNativePlatform()) {
        alert(`تم حفظ التقرير بنجاح في المستندات داخل مجلد BAKR_PRO\n${file}`);
      }
    } catch (error) {
      console.error('Receivables PDF error:', error);
      alert('تعذر إخراج ملف PDF. تأكد من توفر مساحة تخزين ثم حاول مرة أخرى.');
    } finally { setBusy(false); }
  }

  return (
    <AppLayout showBottomNav={false}>
      <main dir="rtl" className="min-h-screen w-full px-2 pb-24 pt-6 text-white" style={{ background: 'linear-gradient(180deg,#0a182b,#091422)' }}>
        <section className={`${card} p-5 mb-4`} style={{background:'linear-gradient(145deg,#172d4a,#091729)',borderColor:'#b3914b66'}}>
          <div className="flex gap-3 items-center mb-2">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl" style={{background:'linear-gradient(130deg,#e2c47c,#ae7d2d)'}}><ClipboardList className="w-7 h-7 text-slate-900" /></div>
            <div><p className="text-xs font-bold tracking-widest text-amber-300">BAKR PRO</p><h1 className="text-[23px] font-black">مستحقات العملاء</h1></div>
          </div>
          <p className="text-[12px] text-slate-300 leading-6">سجل مشاوير الكرين والبوم ترك غير المدفوعة، والعمل الآجل، والدفعات الجزئية، واعرف كم باقي عند كل عميل.</p>
        </section>

        <section className="grid grid-cols-2 gap-2 mb-4">
          {[
            ['إجمالي الأعمال', statistics.total, '#d4b16d'], ['إجمالي المحصل', statistics.paid, '#55d7a3'],
            ['المبلغ المتبقي', statistics.due, '#fb8d72'], ['أعمال بلا تسعير', statistics.unpriced, '#89b9f4'],
          ].map(([label,value,color], index) => <div key={String(label)} className={`${card} p-3`}>
            <div className="text-[11px] text-slate-300 font-bold">{label}</div>
            <div className="text-[19px] font-black mt-1" style={{color:String(color)}}>{index === 3 ? amount(Number(value)) : money(Number(value))}</div>
          </div>)}
        </section>

        <div className="flex gap-2 mb-4">
          <button type="button" onClick={openNew} className="flex-1 rounded-xl bg-amber-400 py-3 px-2 text-slate-950 font-black text-[13px] flex justify-center items-center gap-2"><Plus className="w-5 h-5" /> إضافة شغل آجل</button>
          <button type="button" onClick={() => exportPdf('save')} disabled={busy || !records.length} className="rounded-xl border border-amber-400/40 bg-amber-400/10 py-3 px-3 text-amber-200 font-black text-[12px] flex items-center gap-2 disabled:opacity-50"><FileDown className="w-4 h-4" /> {busy ? 'جاري الحفظ...' : 'حفظ PDF'}</button>
          <button type="button" onClick={() => exportPdf('share')} disabled={busy || !records.length} className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 py-3 px-3 text-cyan-200 font-black text-[12px] flex items-center gap-1 disabled:opacity-50"><Share2 className="w-4 h-4" /> مشاركة</button>
        </div>


        <button type="button" onClick={() => navigate('/receivable-reminders')}
          className="mb-4 w-full rounded-[20px] border border-amber-400/30 p-4 text-right flex items-center gap-3 active:scale-[.99]"
          style={{background:'linear-gradient(135deg,#193551,#0b1a2f)'}}>
          <span className="flex justify-center items-center w-12 h-12 bg-amber-300/10 rounded-xl text-2xl">🔔</span>
          <span className="flex-1"><strong className="text-[15px] text-amber-200 block">تذكيرات مستحقات العملاء</strong>
            <span className="block mt-1 text-[11px] text-slate-300">حدد العملاء • اختر كل 5 أيام أو المدة المناسبة • معاينة الرسائل</span>
          </span>
          <span className="text-xl text-amber-200">‹</span>
        </button>

        {showForm && <section className={`${card} p-4 mb-4`} style={{borderColor:'#d4af63'}}>
          <div className="flex justify-between items-center mb-4"><h2 className="font-black text-amber-200 text-lg">{editId ? 'تعديل حساب العميل' : 'تسجيل شغل لم يُسدّد'}</h2><button type="button" aria-label="إغلاق" onClick={() => {setShowForm(false);setEditId(null);}}><X /></button></div>
          <div className="grid grid-cols-1 gap-3">
            <label className="text-xs text-slate-200 font-bold">اسم العميل *<input value={form.customer} onChange={e=>updateField('customer',e.target.value)} className={`${field} mt-1`} placeholder="مثال: شركة المقاولات أو أبو محمد" /></label>
            <label className="text-xs text-slate-200 font-bold">رقم جوال العميل<input type="tel" value={form.phone} onChange={e=>updateField('phone',e.target.value)} className={`${field} mt-1`} placeholder="05xxxxxxxx" dir="ltr" /></label>
            <label className="text-xs text-slate-200 font-bold">اسم العمل / المشروع<input value={form.workName} onChange={e=>updateField('workName',e.target.value)} className={`${field} mt-1`} placeholder="مثال: تركيب هنجر شركة المياه / مشوار أبها" /></label>
            <label className="text-xs text-slate-200 font-bold">وصف الشغل / المشوار<input value={form.work} onChange={e=>updateField('work',e.target.value)} className={`${field} mt-1`} placeholder="التفاصيل: رفع حديد، نقل حاوية، ساعات العمل..." /></label>
            <div>
              <p className="text-xs text-slate-200 font-bold mb-2">الكرين أو المعدة</p>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="اختر نوع المعدة">
                {(['كرين', 'بوم ترك'] as const).map(kind => (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={form.equipment === kind}
                    onClick={() => updateField('equipment', kind)}
                    className={`rounded-xl border px-3 py-3 text-[14px] font-black transition-colors ${form.equipment === kind
                      ? 'bg-amber-400 border-amber-400 text-slate-950 shadow-[0_4px_15px_rgba(251,191,36,.16)]'
                      : 'bg-[#061525] border-white/20 text-slate-200'}`}
                  >
                    {kind === 'كرين' ? '🏗️ كرين' : '🚚 بوم ترك'}
                  </button>
                ))}
              </div>
              {form.equipment && !['كرين', 'بوم ترك'].includes(form.equipment) && (
                <p className="text-[11px] text-slate-400 mt-2">المعدة المسجلة سابقًا: {form.equipment} — يمكنك الإبقاء عليها أو اختيار نوع جديد.</p>
              )}
              <p className="text-[11px] text-slate-400 mt-2">«كرين» محدد تلقائيًا للمشوار الجديد، ولمسة واحدة تغيّره إلى «بوم ترك».</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-200 font-bold">تاريخ الشغل<input type="date" value={form.date} onChange={e=>updateField('date',e.target.value)} className={`${field} mt-1`} dir="ltr" /></label>
              <label className="text-xs text-slate-200 font-bold">موعد السداد (اختياري)<input type="date" value={form.dueDate} onChange={e=>updateField('dueDate',e.target.value)} className={`${field} mt-1`} dir="ltr" /></label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-200 font-bold">قيمة العمل (ر.س)<input type="number" min="0" step="0.01" value={form.total} onChange={e=>updateField('total',e.target.value)} className={`${field} mt-1`} placeholder="اتركها فارغة لو لم تتحدد" dir="ltr" /></label>
              <label className="text-xs text-slate-200 font-bold">نوع المستحق<select value={form.term} onChange={e=>updateField('term',e.target.value as Term)} className={`${field} mt-1`}><option value="لم يحاسب">لم يحاسب</option><option value="آجل">حساب آجل</option></select></label>
            </div>
            <label className="text-xs text-slate-200 font-bold">ملاحظات<textarea value={form.notes} rows={2} onChange={e=>updateField('notes',e.target.value)} className={`${field} mt-1`} placeholder="الموقع، اتفاق الدفع، تفاصيل العمل..." /></label>
          </div>
          <p className="my-3 text-[11px] text-slate-400">إذا مبلغ المشوار لم يتحدد، اترك القيمة فارغة وعدّلها لاحقًا. لن تعتبر مدفوعة.</p>
          <button type="button" onClick={saveRecord} className="w-full py-3 rounded-xl bg-amber-400 text-slate-950 font-black flex justify-center items-center gap-2"><Save className="w-5 h-5" /> {editId ? 'حفظ التعديلات' : 'حفظ المستحق'}</button>
        </section>}

        <section className={`${card} p-3 mb-4`}>
          <div className="flex items-center gap-2 rounded-xl bg-[#081525] border border-white/10 px-3"><Search className="w-4 h-4 text-slate-400" /><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="بحث باسم العميل أو اسم العمل أو الوصف..." className="flex-1 bg-transparent outline-none py-3 text-[13px]" /></div>
          <div className="grid grid-cols-4 gap-1.5 mt-3">
            {([['all','الكل'],['pending','المتبقي'],['paid','المسدد'],['unpriced','بلا مبلغ']] as const).map(([id,label]) => <button key={id} type="button" onClick={()=>setFilter(id)} className={`text-[11px] py-2 rounded-lg font-bold border ${filter===id?'bg-amber-400 text-slate-950 border-amber-400':'bg-white/5 border-white/10 text-slate-300'}`}>{label}</button>)}
          </div>
        </section>
        <div className="flex items-center gap-2 mb-3 px-1"><Wallet className="w-5 h-5 text-amber-300" /><h2 className="text-base font-black">سجل المستحقات ({filtered.length})</h2></div>
        {filtered.length === 0 && <div className={`${card} p-8 text-center text-slate-400 text-sm`}>لا توجد سجلات مطابقة. اضغط «إضافة شغل آجل» لتسجيل أول مشوار.</div>}

        <section className="space-y-3">
          {filtered.map(record => {
            const balance = remaining(record);
            const status = paymentStatus(record);
            const expanded = expandedId === record.id;
            return <article key={record.id} className={`${card} p-4`} style={{borderColor:balance>0?'#b3914b55':'#ffffff20'}}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><h3 className="text-base font-black truncate">{record.customer}</h3><p className="text-[12px] text-slate-400 mt-1"><CalendarDays className="w-3 h-3 inline ml-1" />{record.date}{record.equipment?' • '+record.equipment:''}</p></div>
                <span className={`text-[10px] font-black rounded-full px-2.5 py-1 border whitespace-nowrap ${balance <= 0 && record.total > 0?'border-emerald-400/25 text-emerald-300 bg-emerald-500/10':'border-amber-400/25 text-amber-300 bg-amber-500/10'}`}>{status}</span>
              </div>
              <p className="mt-2 text-[13px] font-black text-amber-200">اسم العمل: {record.workName || 'غير محدد'}</p>
              {record.work && <p className="mt-1 text-[12px] text-slate-200">وصف العمل: {record.work}</p>}
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div className="p-2 rounded-xl bg-white/5"><p className="text-[10px] text-slate-400">قيمة الشغل</p><strong className="text-[13px] text-white">{amount(record.total)}</strong></div>
                <div className="p-2 rounded-xl bg-white/5"><p className="text-[10px] text-slate-400">المدفوع</p><strong className="text-[13px] text-emerald-300">{amount(paid(record))}</strong></div>
                <div className="p-2 rounded-xl bg-amber-400/10"><p className="text-[10px] text-slate-400">المتبقي</p><strong className="text-[15px] text-amber-300">{amount(balance)}</strong></div>
              </div>
              {record.dueDate && <p className="mt-2 text-[11px] text-slate-300">موعد السداد: <b className="text-amber-200">{record.dueDate}</b></p>}
              <div className="flex flex-wrap gap-2 mt-3">
                <button type="button" onClick={()=>{setExpandedId(expanded?null:record.id);setNewPaymentId(null);}} className="flex-1 min-w-[105px] px-3 py-2 rounded-xl bg-white/10 text-white text-[12px] font-bold flex items-center justify-center gap-1">{expanded?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>} التفاصيل</button>
                <button type="button" onClick={()=>edit(record)} className="px-3 py-2 rounded-xl bg-amber-400/15 text-amber-200 text-[12px] font-bold flex items-center gap-1"><Pencil className="w-4 h-4"/> تعديل</button>
                <button type="button" onClick={()=>shareRecord(record)} className="px-3 py-2 rounded-xl bg-green-500/15 text-green-300 text-[12px] font-bold flex items-center gap-1"><Share2 className="w-4 h-4"/> مشاركة</button>
              </div>
              {expanded && <div className="mt-4 border-t border-white/10 pt-3">
                {record.notes && <p className="text-xs text-slate-300 mb-2">ملاحظات: {record.notes}</p>}
                {record.phone && <p className="text-xs text-slate-300 mb-2">الجوال: <span dir="ltr">{record.phone}</span></p>}
                <h4 className="font-black text-amber-200 mb-2">سجل الدفعات ({record.payments.length})</h4>
                {record.payments.length ? <div className="space-y-2">{record.payments.map(p => <div key={p.id} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
                  <div className="flex-1"><b className="text-sm text-emerald-300">{money(p.amount)}</b><p className="text-[11px] text-slate-400">{p.date} {p.note ? '• '+p.note : ''}</p></div>
                  <button type="button" aria-label="حذف الدفعة" onClick={()=>removePayment(record,p)} className="p-2 rounded-lg text-red-300 bg-red-500/10"><Trash2 className="w-4 h-4"/></button>
                </div>)}</div> : <p className="text-xs text-slate-400 mb-2">لم تسجل أي دفعة بعد.</p>}
                {balance > 0 && record.total > 0 && <>
                  <button type="button" onClick={()=>{setNewPaymentId(newPaymentId===record.id?null:record.id);setPaymentInput({date:localDay(),amount:'',note:''});}} className="w-full bg-emerald-500/15 border border-emerald-400/20 text-emerald-300 rounded-xl py-2.5 text-sm font-black mt-3">+ تسجيل دفعة من العميل</button>
                  {newPaymentId === record.id && <div className="mt-3 p-3 rounded-xl bg-[#081725] space-y-2">
                    <label className="block text-xs text-slate-300">تاريخ الدفعة<input type="date" className={`${field} mt-1`} value={paymentInput.date} onChange={e=>setPaymentInput(v=>({...v,date:e.target.value}))} dir="ltr" /></label>
                    <label className="block text-xs text-slate-300">المبلغ المستلم<input type="number" min="0.01" max={balance} step="0.01" className={`${field} mt-1`} value={paymentInput.amount} onChange={e=>setPaymentInput(v=>({...v,amount:e.target.value}))} dir="ltr"/></label>
                    <label className="block text-xs text-slate-300">ملاحظة الدفعة<input className={`${field} mt-1`} value={paymentInput.note} onChange={e=>setPaymentInput(v=>({...v,note:e.target.value}))} placeholder="نقدًا / تحويل ..." /></label>
                    <button type="button" onClick={()=>addPayment(record)} className="rounded-xl py-2.5 w-full font-black bg-emerald-500 text-slate-950">حفظ الدفعة</button>
                  </div>}
                </>}
                <button type="button" onClick={()=>removeRecord(record)} className="flex gap-1 items-center justify-center text-xs text-red-300 mt-3"><Trash2 className="w-4 h-4"/> حذف المستحق نهائيًا</button>
              </div>}
            </article>;
          })}
        </section>
        <p className="text-center text-[11px] text-slate-500 mt-6 leading-5">تُحفظ المستحقات ضمن بيانات BAKR PRO المحلية والنسخ الاحتياطي الشامل. الدفعات هنا مستقلة عن قسم الدخل لتجنّب تسجيل نفس المبلغ مرتين.</p>
      </main>
    </AppLayout>
  );
}
