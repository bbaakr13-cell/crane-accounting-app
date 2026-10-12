import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { Capacitor } from '@capacitor/core';
import {
  Directory,
  Filesystem,
} from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

import {
  Building2,
  Eye,
  FileDown,
  FileImage,
  FileText,
  Plus,
  RotateCcw,
  Share2,
  Trash2,
  X,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { QuotationDocumentModern } from './QuotationDocumentModern';

export type QuotationItem = {
  id: string;
  equipment: string;
  description: string;
  quantity: string;
  monthly: string;
  daily: string;
};

export type QuotationForm = {
  quoteNo: string;
  date: string;
  companyName: string;
  customer: string;
  region: string;
  workDays: string;
  workHours: string;
  housingDiesel: string;
  vatNote: string;
  extraNote: string;
  items: QuotationItem[];
};

type AiQuotationPayload = {
  companyName?: unknown;
  customer?: unknown;
  region?: unknown;
  workDays?: unknown;
  workHours?: unknown;
  housingDiesel?: unknown;
  vatNote?: unknown;
  extraNote?: unknown;
  items?: unknown;
};

const STORAGE_KEY = 'bakr_pro_professional_quotation_v2';
const OLD_STORAGE_KEY = 'bakr_pro_professional_quotation_v1';
const PAPER_WIDTH = 794;
const PAPER_HEIGHT = 1123;

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function makeQuoteNo(value: string) {
  const date = value || todayIso();
  return `QT-${date.replace(/-/g, '')}-01`;
}

function aiText(value: unknown) {
  return String(value ?? '').trim();
}

function aiNumberText(value: unknown) {
  const text = aiText(value)
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٬,]/g, '')
    .replace(/[^0-9.]/g, '');

  return text;
}

function parseAiQuotation(rawText: string): AiQuotationPayload {
  const cleaned = String(rawText || '')
    .replace(/^\s*BAKRQUOTE(?:_V1)?\s*:?/i, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const jsonText =
    firstBrace >= 0 && lastBrace > firstBrace
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned;

  const parsed = JSON.parse(jsonText);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('صيغة بيانات العرض غير صحيحة');
  }

  return parsed as AiQuotationPayload;
}

function makeItemsFromAi(value: unknown): QuotationItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, 6)
    .map((raw, index) => {
      const item =
        raw && typeof raw === 'object'
          ? (raw as Record<string, unknown>)
          : {};

      const quantity = aiNumberText(item.quantity || item.qty || 1) || '1';

      return {
        id: `${uid()}-ai-${index}`,
        equipment: aiText(item.equipment || item.machine || item.type),
        description: aiText(item.description || item.capacity || item.details),
        quantity,
        monthly: aiNumberText(item.monthly || item.monthlyRent || item.monthlyPrice),
        daily: aiNumberText(item.daily || item.dailyRent || item.dailyPrice),
      };
    })
    .filter(
      (item) =>
        item.equipment ||
        item.description ||
        item.monthly ||
        item.daily
    );
}

function defaultForm(): QuotationForm {
  const date = todayIso();

  return {
    quoteNo: makeQuoteNo(date),
    date,
    companyName: 'مؤسسة صقر الجنوب',
    customer: 'شركة بلت',
    region: 'خميس مشيط • أبها',
    workDays: 'الدوام الشهري: 26 يوم عمل',
    workHours: 'ساعات العمل: 8 ساعات يوميًا',
    housingDiesel: 'السكن والديزل حسب الاتفاق',
    vatNote: 'الأسعار لا تشمل ضريبة القيمة المضافة',
    extraNote: '',
    items: [
      {
        id: uid(),
        equipment: 'كرين',
        description: '25 طن',
        quantity: '1',
        monthly: '17000',
        daily: '',
      },
      {
        id: uid(),
        equipment: 'بوم ترك',
        description: '5 طن',
        quantity: '1',
        monthly: '14000',
        daily: '',
      },
    ],
  };
}

function migrateSaved(saved: unknown): QuotationForm {
  const base = defaultForm();
  if (!saved || typeof saved !== 'object') return base;

  const parsed = saved as Record<string, unknown>;
  const oldItems = Array.isArray(parsed.items) ? parsed.items : [];

  const items: QuotationItem[] = oldItems.length
    ? oldItems.slice(0, 6).map((raw, index) => {
        const item = (raw || {}) as Record<string, unknown>;
        const oldEquipment = String(item.equipment || '');
        let equipment = oldEquipment;
        let description = String(item.description || '');

        if (!description && oldEquipment) {
          const match = oldEquipment.match(/^(كرين|بوم ترك|سطحة|جي سي بي|رافعة شوكية)\s*(.*)$/);
          if (match) {
            equipment = match[1];
            description = match[2] || '';
          }
        }

        return {
          id: String(item.id || `${uid()}-${index}`),
          equipment,
          description,
          quantity: String(item.quantity || '1'),
          monthly: String(item.monthly || ''),
          daily: String(item.daily || ''),
        };
      })
    : base.items;

  return {
    ...base,
    quoteNo: String(parsed.quoteNo || base.quoteNo),
    date: String(parsed.date || base.date),
    companyName: String(parsed.companyName || base.companyName),
    customer: String(parsed.customer || base.customer),
    region: String(parsed.region || base.region),
    workDays: String(parsed.workDays || base.workDays),
    workHours: String(parsed.workHours || base.workHours),
    housingDiesel: String(parsed.housingDiesel || base.housingDiesel),
    vatNote: String(parsed.vatNote || base.vatNote),
    extraNote: String(parsed.extraNote || ''),
    items,
  };
}

function safeFilePart(value: string) {
  return value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[\\/:*?"<>|]/g, '')
    .slice(0, 55);
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'decimal';
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black text-slate-300">
        {label}
      </span>
      <input
        type={type}
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-right text-sm font-bold text-white outline-none transition focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/10"
      />
    </label>
  );
}

export function QuotationProPage() {
  const [form, setForm] = useState<QuotationForm>(() => {
    try {
      const savedV2 = localStorage.getItem(STORAGE_KEY);
      if (savedV2) return migrateSaved(JSON.parse(savedV2));

      const old = localStorage.getItem(OLD_STORAGE_KEY);
      if (old) return migrateSaved(JSON.parse(old));
    } catch (error) {
      console.error('Quotation load error:', error);
    }
    return defaultForm();
  });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState<'pdf' | 'image' | 'share' | null>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const [aiImportOpen, setAiImportOpen] = useState(false);
  const [aiImportText, setAiImportText] = useState('');
  const [aiImportError, setAiImportError] = useState('');

  const previewScale = useMemo(() => {
    if (typeof window === 'undefined') return 0.42;
    return Math.min(0.92, Math.max(0.34, (window.innerWidth - 34) / PAPER_WIDTH));
  }, [previewOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch (error) {
      console.error('Quotation save error:', error);
    }
  }, [form]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get('bakrQuote') || params.get('quoteData');
      if (!encoded) return;

      const payload = parseAiQuotation(decodeURIComponent(encoded));
      applyAiPayload(payload);

      params.delete('bakrQuote');
      params.delete('quoteData');
      const next = params.toString();
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}${next ? `?${next}` : ''}`
      );
    } catch (error) {
      console.error('AI quotation URL import error:', error);
    }
    // يعمل مرة واحدة عند فتح صفحة عرض السعر من رابط واتساب.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof QuotationForm>(
    key: K,
    value: QuotationForm[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateDate(value: string) {
    setForm((current) => ({
      ...current,
      date: value,
      quoteNo:
        current.quoteNo === makeQuoteNo(current.date) || !current.quoteNo
          ? makeQuoteNo(value)
          : current.quoteNo,
    }));
  }

  function updateItem(
    id: string,
    key: keyof Omit<QuotationItem, 'id'>,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id ? { ...item, [key]: value } : item
      ),
    }));
  }

  function addItem() {
    setForm((current) => {
      if (current.items.length >= 6) {
        window.alert('الحد الأقصى 6 معدات في عرض السعر الواحد.');
        return current;
      }

      return {
        ...current,
        items: [
          ...current.items,
          {
            id: uid(),
            equipment: '',
            description: '',
            quantity: '1',
            monthly: '',
            daily: '',
          },
        ],
      };
    });
  }

  function removeItem(id: string) {
    setForm((current) => {
      if (current.items.length <= 1) return current;
      return {
        ...current,
        items: current.items.filter((item) => item.id !== id),
      };
    });
  }

  async function capturePaper() {
    if (!paperRef.current) throw new Error('تعذر تجهيز عرض السعر');
    if (document.fonts?.ready) await document.fonts.ready;

    return html2canvas(paperRef.current, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: PAPER_WIDTH,
      height: PAPER_HEIGHT,
      windowWidth: PAPER_WIDTH,
      windowHeight: PAPER_HEIGHT,
    });
  }

  async function createPdf() {
    const canvas = await capturePaper();
    const image = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    pdf.addImage(image, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    return pdf;
  }

  function fileBase() {
    const customer = safeFilePart(form.customer) || 'عميل';
    return `عرض-سعر-${customer}-${form.date}`;
  }

  async function savePdf() {
    try {
      setBusy('pdf');
      const pdf = await createPdf();
      const name = `${fileBase()}.pdf`;

      if (!Capacitor.isNativePlatform()) {
        pdf.save(name);
        return;
      }

      const base64 = pdf.output('datauristring').split(',')[1];
      const result = await Filesystem.writeFile({
        path: name,
        data: base64,
        directory: Directory.Documents,
        recursive: true,
      });
      window.alert(`تم حفظ ملف PDF بنجاح\n${result.uri}`);
    } catch (error) {
      console.error(error);
      window.alert('تعذر حفظ ملف PDF. حاول مرة أخرى.');
    } finally {
      setBusy(null);
    }
  }

  async function saveImage() {
    try {
      setBusy('image');
      const canvas = await capturePaper();
      const name = `${fileBase()}.png`;
      const dataUrl = canvas.toDataURL('image/png');

      if (!Capacitor.isNativePlatform()) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = name;
        link.click();
        return;
      }

      const result = await Filesystem.writeFile({
        path: name,
        data: dataUrl.split(',')[1],
        directory: Directory.Documents,
        recursive: true,
      });
      window.alert(`تم حفظ الصورة بنجاح\n${result.uri}`);
    } catch (error) {
      console.error(error);
      window.alert('تعذر حفظ الصورة. حاول مرة أخرى.');
    } finally {
      setBusy(null);
    }
  }

  async function sharePdf() {
    try {
      setBusy('share');
      const pdf = await createPdf();
      const name = `${fileBase()}.pdf`;

      if (!Capacitor.isNativePlatform()) {
        pdf.save(name);
        window.alert('تم تنزيل الملف. يمكنك مشاركته الآن عبر واتساب.');
        return;
      }

      const base64 = pdf.output('datauristring').split(',')[1];
      const file = await Filesystem.writeFile({
        path: name,
        data: base64,
        directory: Directory.Cache,
        recursive: true,
      });

      await Share.share({
        title: 'عرض سعر',
        text: `عرض سعر من ${form.companyName} إلى ${form.customer}`,
        url: file.uri,
        dialogTitle: 'مشاركة عرض السعر',
      });
    } catch (error) {
      console.error(error);
      window.alert('تعذرت المشاركة. حاول مرة أخرى.');
    } finally {
      setBusy(null);
    }
  }

  function applyAiPayload(payload: AiQuotationPayload) {
    const importedItems = makeItemsFromAi(payload.items);

    setForm((current) => ({
      ...current,
      quoteNo: makeQuoteNo(todayIso()),
      date: todayIso(),
      companyName: aiText(payload.companyName) || current.companyName,
      customer: aiText(payload.customer) || current.customer,
      region: aiText(payload.region) || current.region,
      workDays: aiText(payload.workDays) || current.workDays,
      workHours: aiText(payload.workHours) || current.workHours,
      housingDiesel: aiText(payload.housingDiesel) || current.housingDiesel,
      vatNote: aiText(payload.vatNote) || current.vatNote,
      extraNote: aiText(payload.extraNote),
      items: importedItems.length ? importedItems : current.items,
    }));
  }

  async function openAiImport() {
    setAiImportError('');
    setAiImportOpen(true);

    try {
      const clipboardText = await navigator.clipboard?.readText?.();
      if (clipboardText && (clipboardText.includes('{') || /BAKRQUOTE/i.test(clipboardText))) {
        setAiImportText(clipboardText);
      }
    } catch {
      // بعض أجهزة أندرويد تمنع قراءة الحافظة تلقائياً؛ يمكن اللصق يدوياً.
    }
  }

  function confirmAiImport() {
    try {
      const payload = parseAiQuotation(aiImportText);
      applyAiPayload(payload);
      setAiImportError('');
      setAiImportOpen(false);
      setAiImportText('');
      window.setTimeout(() => {
        window.alert('تم استيراد طلب واتساب. راجع الأسعار ثم احفظ أو شارك PDF.');
      }, 50);
    } catch (error) {
      console.error('AI quotation import error:', error);
      setAiImportError(
        'تعذر قراءة الطلب. تأكد أن رسالة الذكاء الاصطناعي تبدأ بـ BAKRQUOTE وتحتوي بيانات JSON.'
      );
    }
  }

  function resetNewQuotation() {
    if (!window.confirm('بدء عرض سعر جديد؟ سيتم مسح بيانات عرض السعر الحالي فقط.')) {
      return;
    }
    setForm(defaultForm());
  }

  return (
    <AppLayout showBottomNav={false}>
      <div dir="rtl" className="w-full pb-32 text-white">
        <section
          className="relative mb-4 overflow-hidden rounded-[26px] border border-amber-400/20 p-5"
          style={{
            background:
              'linear-gradient(135deg,rgba(8,22,40,0.98),rgba(15,50,82,0.96))',
            boxShadow: '0 18px 45px rgba(0,0,0,0.24)',
          }}
        >
          <div className="absolute -left-10 -top-12 h-36 w-36 rounded-full bg-amber-400/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1.5 text-[10px] font-black text-amber-300">
                <Building2 size={14} />
                الخانات كلها قابلة للتعديل
              </div>
              <h1 className="text-[24px] font-black text-white">عرض سعر احترافي</h1>
              <p className="mt-2 max-w-[310px] text-[11px] leading-5 text-slate-300">
                اسم المؤسسة والعميل والمعدات والوصف والعدد والأسعار والشروط تتغير من هنا ثم تحفظ PDF أو صورة.
              </p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-400/10 text-amber-300">
              <FileText size={28} />
            </div>
          </div>
        </section>

        <section className="mb-4 rounded-[24px] border border-white/8 bg-slate-900/70 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-black text-white">بيانات العرض والشركات</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openAiImport}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-[10px] font-black text-emerald-200"
              >
                <FileText size={14} />
                استيراد من واتساب AI
              </button>
              <button
                type="button"
                onClick={resetNewQuotation}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/7 px-3 py-2 text-[10px] font-black text-slate-300"
              >
                <RotateCcw size={14} />
                عرض جديد
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="اسم المؤسسة التي تقدم العرض"
              value={form.companyName}
              placeholder="مثال: مؤسسة صقر الجنوب"
              onChange={(value) => update('companyName', value)}
            />
            <Field
              label="اسم الشركة المستلمة للعرض"
              value={form.customer}
              placeholder="مثال: شركة بلت"
              onChange={(value) => update('customer', value)}
            />
            <Field
              label="رقم عرض السعر"
              value={form.quoteNo}
              onChange={(value) => update('quoteNo', value)}
            />
            <Field
              label="التاريخ"
              type="date"
              value={form.date}
              onChange={updateDate}
            />
            <Field
              label="الموقع / منطقة الخدمة"
              value={form.region}
              placeholder="خميس مشيط • أبها"
              onChange={(value) => update('region', value)}
            />
          </div>
        </section>

        <section className="mb-4 rounded-[24px] border border-white/8 bg-slate-900/70 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-white">المعدات والأسعار</h2>
              <p className="mt-1 text-[9px] text-slate-500">
                ترتيب الجدول: م • المعدات • الوصف • العدد • الإيجار الشهري • الإيجار اليومي
              </p>
            </div>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-amber-400 px-3 text-[11px] font-black text-slate-950 active:scale-95"
            >
              <Plus size={16} />
              إضافة معدة
            </button>
          </div>

          <div className="space-y-3">
            {form.items.map((item, index) => (
              <div
                key={item.id}
                className="rounded-2xl border border-white/8 bg-slate-950/40 p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-400/15 px-2 text-[11px] font-black text-amber-300">
                    م {index + 1}
                  </span>
                  <button
                    type="button"
                    disabled={form.items.length <= 1}
                    onClick={() => removeItem(item.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-rose-400/10 text-rose-300 disabled:cursor-not-allowed disabled:opacity-25"
                    aria-label="حذف المعدة"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Field
                    label="المعدات"
                    value={item.equipment}
                    placeholder="كرين"
                    onChange={(value) => updateItem(item.id, 'equipment', value)}
                  />
                  <Field
                    label="الوصف"
                    value={item.description}
                    placeholder="50 طن"
                    onChange={(value) => updateItem(item.id, 'description', value)}
                  />
                  <Field
                    label="العدد"
                    value={item.quantity}
                    placeholder="1"
                    inputMode="numeric"
                    onChange={(value) => updateItem(item.id, 'quantity', value)}
                  />
                  <Field
                    label="الإيجار الشهري"
                    value={item.monthly}
                    placeholder="مثال: 25000"
                    inputMode="decimal"
                    onChange={(value) => updateItem(item.id, 'monthly', value)}
                  />
                  <Field
                    label="الإيجار اليومي"
                    value={item.daily}
                    placeholder="مثال: 1500"
                    inputMode="decimal"
                    onChange={(value) => updateItem(item.id, 'daily', value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-4 rounded-[24px] border border-white/8 bg-slate-900/70 p-4">
          <h2 className="mb-4 text-sm font-black text-white">الشروط</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="الدوام الشهري"
              value={form.workDays}
              onChange={(value) => update('workDays', value)}
            />
            <Field
              label="ساعات العمل"
              value={form.workHours}
              onChange={(value) => update('workHours', value)}
            />
            <Field
              label="السكن والديزل"
              value={form.housingDiesel}
              onChange={(value) => update('housingDiesel', value)}
            />
            <Field
              label="الضريبة"
              value={form.vatNote}
              onChange={(value) => update('vatNote', value)}
            />
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-[11px] font-black text-slate-300">
              ملاحظة إضافية - اختيارية
            </span>
            <textarea
              value={form.extraNote}
              onChange={(event) => update('extraNote', event.target.value)}
              rows={2}
              className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-right text-sm font-bold text-white outline-none focus:border-amber-400/60"
            />
          </label>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-3.5 text-xs font-black text-cyan-200 active:scale-[0.98]"
          >
            <Eye size={18} />
            معاينة
          </button>
          <button
            type="button"
            onClick={savePdf}
            disabled={busy !== null}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400 px-3 py-3.5 text-xs font-black text-slate-950 active:scale-[0.98] disabled:opacity-60"
          >
            <FileDown size={18} />
            {busy === 'pdf' ? 'جاري الحفظ...' : 'حفظ PDF'}
          </button>
          <button
            type="button"
            onClick={saveImage}
            disabled={busy !== null}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3.5 text-xs font-black text-white active:scale-[0.98] disabled:opacity-60"
          >
            <FileImage size={18} />
            {busy === 'image' ? 'جاري الحفظ...' : 'حفظ صورة'}
          </button>
          <button
            type="button"
            onClick={sharePdf}
            disabled={busy !== null}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-3 py-3.5 text-xs font-black text-white active:scale-[0.98] disabled:opacity-60"
          >
            <Share2 size={18} />
            {busy === 'share' ? 'جاري التجهيز...' : 'مشاركة'}
          </button>
        </section>

        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '-10000px',
            top: 0,
            width: PAPER_WIDTH,
            height: PAPER_HEIGHT,
          }}
        >
          <div ref={paperRef}>
            <QuotationDocumentModern data={form} />
          </div>
        </div>

        {aiImportOpen ? (
          <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/90 p-3 backdrop-blur-md sm:items-center">
            <div className="w-full max-w-xl rounded-[26px] border border-emerald-300/15 bg-slate-900 p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-white">استيراد طلب من ذكاء واتساب</div>
                  <div className="mt-1 text-[10px] leading-5 text-slate-400">
                    الصق رسالة BAKRQUOTE التي جهزها الذكاء الاصطناعي، وسيتم تعبئة اسم الشركة والمعدات والعدد والأسعار والشروط تلقائياً.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAiImportOpen(false)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/8 text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <textarea
                value={aiImportText}
                onChange={(event) => {
                  setAiImportText(event.target.value);
                  setAiImportError('');
                }}
                rows={11}
                dir="ltr"
                placeholder={'BAKRQUOTE\n{\n  "customer": "شركة بلت",\n  "items": [{"equipment":"كرين","description":"25 طن","quantity":2,"monthly":50000,"daily":2500}]\n}'}
                className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-left font-mono text-[11px] leading-5 text-white outline-none focus:border-emerald-300/40"
              />

              {aiImportError ? (
                <div className="mt-2 rounded-xl border border-rose-300/15 bg-rose-400/10 px-3 py-2 text-[10px] font-bold leading-5 text-rose-200">
                  {aiImportError}
                </div>
              ) : null}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAiImportOpen(false)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs font-black text-white"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={confirmAiImport}
                  disabled={!aiImportText.trim()}
                  className="rounded-2xl bg-emerald-500 px-3 py-3 text-xs font-black text-white disabled:opacity-40"
                >
                  تعبئة عرض السعر
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {previewOpen ? (
          <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95 p-3 backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-black text-white">معاينة عرض السعر</div>
                <div className="mt-1 text-[9px] font-bold text-slate-400">
                  نفس الشكل الذي سيحفظ داخل PDF
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-2xl bg-slate-900/80 p-3">
              <div
                style={{
                  width: PAPER_WIDTH * previewScale,
                  height: PAPER_HEIGHT * previewScale,
                  margin: '0 auto',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: PAPER_WIDTH,
                    height: PAPER_HEIGHT,
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top left',
                    boxShadow: '0 22px 60px rgba(0,0,0,.35)',
                  }}
                >
                  <QuotationDocumentModern data={form} />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
                    }
