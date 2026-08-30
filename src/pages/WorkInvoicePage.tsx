import React, { useMemo, useRef, useState } from 'react';
import {
  Save,
  FileDown,
  Printer,
  Share2,
  Plus,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

type InvoiceRow = {
  description: string;
  qty: string;
  unitPrice: string;
  totalPrice: string;
};

type WorkInvoiceData = {
  invoiceNo: string;
  date: string;
  customer: string;

  rightTitle: string;
  companyArabic: string;
  companyEnglish: string;
  leftTitle: string;
  activity: string;
  location: string;

  rows: InvoiceRow[];

  totalWords: string;
  notes: string;
};

const STORAGE_KEY = 'baakr-work-invoice-v1';

const today = new Date().toISOString().slice(0, 10);

const emptyRows = (): InvoiceRow[] =>
  Array.from({ length: 7 }, () => ({
    description: '',
    qty: '',
    unitPrice: '',
    totalPrice: '',
  }));

const initialData: WorkInvoiceData = {
  invoiceNo: '0001',
  date: today,
  customer: '',

  rightTitle: 'كرينات',
  companyArabic: 'رافعات الحديثة',
  companyEnglish: 'RAFIËAT AL-HADITHA',
  leftTitle: 'بوم ترك',
  activity: 'لتأجير المعدات الثقيلة',
  location: 'خميس مشيط - أبها',

  rows: emptyRows(),

  totalWords: '',
  notes: '',
};

function loadInvoice(): WorkInvoiceData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return initialData;

    const parsed = JSON.parse(saved);

    return {
      ...initialData,
      ...parsed,
      rows:
        Array.isArray(parsed.rows) && parsed.rows.length
          ? Array.from({ length: 7 }, (_, i) => ({
              description: parsed.rows[i]?.description ?? '',
              qty: parsed.rows[i]?.qty ?? '',
              unitPrice: parsed.rows[i]?.unitPrice ?? '',
              totalPrice: parsed.rows[i]?.totalPrice ?? '',
            }))
          : emptyRows(),
    };
  } catch {
    return initialData;
  }
}

function safeNumber(value: string | number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function WorkInvoicePage() {
  const [data, setData] = useState<WorkInvoiceData>(() => loadInvoice());
  const [busy, setBusy] = useState(false);

  const invoiceRef = useRef<HTMLDivElement>(null);

  const grandTotal = useMemo(() => {
    return data.rows.reduce((sum, row) => {
      return sum + safeNumber(row.totalPrice);
    }, 0);
  }, [data.rows]);

  function updateField<K extends keyof WorkInvoiceData>(
    key: K,
    value: WorkInvoiceData[K]
  ) {
    setData((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updateRow(
    index: number,
    key: keyof InvoiceRow,
    value: string
  ) {
    setData((prev) => {
      const rows = [...prev.rows];

      const nextRow = {
        ...rows[index],
        [key]: value,
      };

      if (key === 'qty' || key === 'unitPrice') {
        const qty =
          key === 'qty'
            ? safeNumber(value)
            : safeNumber(nextRow.qty);

        const unit =
          key === 'unitPrice'
            ? safeNumber(value)
            : safeNumber(nextRow.unitPrice);

        if (qty > 0 || unit > 0) {
          nextRow.totalPrice = String(qty * unit);
        }
      }

      rows[index] = nextRow;

      return {
        ...prev,
        rows,
      };
    });
  }

  function saveInvoice() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    alert('تم حفظ فاتورة العمل');
  }

  function newInvoice() {
    const confirmed = confirm('إنشاء فاتورة عمل جديدة؟');

    if (!confirmed) return;

    setData({
      ...initialData,
      invoiceNo: String(Date.now()).slice(-6),
      date: new Date().toISOString().slice(0, 10),
      rows: emptyRows(),
    });
  }

  async function createPdfBlob() {
    if (!invoiceRef.current) return null;

    const canvas = await html2canvas(invoiceRef.current, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
    });

    const img = canvas.toDataURL('image/jpeg', 0.96);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;

    const ratio = Math.min(
      pageWidth / canvas.width,
      pageHeight / canvas.height
    );

    const width = canvas.width * ratio;
    const height = canvas.height * ratio;

    pdf.addImage(
      img,
      'JPEG',
      (pageWidth - width) / 2,
      0,
      width,
      height
    );

    return pdf;
  }

  async function savePdf() {
    try {
      setBusy(true);

      const pdf = await createPdfBlob();

      if (!pdf) return;

      const fileName = `work-invoice-${data.invoiceNo || 'invoice'}.pdf`;

      if (Capacitor.isNativePlatform()) {
        const base64 = pdf.output('datauristring').split(',')[1];

        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Documents,
        });

        alert('تم حفظ PDF في الجهاز');
      } else {
        pdf.save(fileName);
      }
    } catch (error) {
      console.error(error);
      alert('تعذر حفظ ملف PDF');
    } finally {
      setBusy(false);
    }
  }

  async function shareInvoice() {
    try {
      setBusy(true);

      const pdf = await createPdfBlob();

      if (!pdf) return;

      const fileName = `work-invoice-${data.invoiceNo || 'invoice'}.pdf`;

      if (Capacitor.isNativePlatform()) {
        const base64 = pdf.output('datauristring').split(',')[1];

        const saved = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });

        await Share.share({
          title: 'فاتورة عمل',
          text: `فاتورة رقم ${data.invoiceNo}`,
          url: saved.uri,
          dialogTitle: 'مشاركة الفاتورة',
        });
      } else {
        pdf.save(fileName);
      }
    } catch (error) {
      console.error(error);
      alert('تعذر مشاركة الفاتورة');
    } finally {
      setBusy(false);
    }
  }

  function printInvoice() {
    window.print();
  }

  return (
    <AppLayout>
      <div
        dir="rtl"
        className="min-h-screen bg-[#06101f] pb-28 text-white"
      >
        <div className="mx-auto max-w-6xl px-3 py-4">
          {/* عنوان الصفحة */}
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => history.back()}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-[#0c1728]"
            >
              <ArrowRight size={22} />
            </button>

            <div className="text-center">
              <h1 className="text-xl font-bold">فاتورة عمل</h1>
              <p className="mt-1 text-xs text-slate-400">
                إنشاء وتعديل فاتورة
              </p>
            </div>

            <button
              type="button"
              onClick={newInvoice}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600"
            >
              <Plus size={24} />
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            {/* ===================================== */}
            {/* لوحة التعديل */}
            {/* ===================================== */}

            <div className="rounded-2xl border border-slate-700 bg-[#0a1525] p-3">
              <h2 className="mb-3 font-bold">بيانات فاتورة العمل</h2>

              <Field
                label="رقم الفاتورة"
                value={data.invoiceNo}
                onChange={(v) => updateField('invoiceNo', v)}
              />

              <Field
                label="التاريخ"
                type="date"
                value={data.date}
                onChange={(v) => updateField('date', v)}
              />

              <Field
                label="اسم العميل"
                value={data.customer}
                onChange={(v) => updateField('customer', v)}
                placeholder="اكتب اسم العميل"
              />

              <div className="my-4 border-t border-slate-700" />

              <p className="mb-3 text-sm font-bold text-violet-300">
                واجهة الفاتورة
              </p>

              <Field
                label="يمين"
                value={data.rightTitle}
                onChange={(v) => updateField('rightTitle', v)}
              />

              <Field
                label="اسم المؤسسة"
                value={data.companyArabic}
                onChange={(v) => updateField('companyArabic', v)}
              />

              <Field
                label="الاسم الإنجليزي"
                value={data.companyEnglish}
                onChange={(v) => updateField('companyEnglish', v)}
              />

              <Field
                label="يسار"
                value={data.leftTitle}
                onChange={(v) => updateField('leftTitle', v)}
              />

              <Field
                label="النشاط"
                value={data.activity}
                onChange={(v) => updateField('activity', v)}
              />

              <Field
                label="الموقع"
                value={data.location}
                onChange={(v) => updateField('location', v)}
              />

              <div className="my-4 border-t border-slate-700" />

              <p className="mb-3 text-sm font-bold text-violet-300">
                السطور السبعة
              </p>

              {data.rows.map((row, index) => (
                <div
                  key={index}
                  className="mb-3 rounded-xl border border-slate-700 bg-[#07111f] p-3"
                >
                  <div className="mb-2 text-sm font-bold text-slate-300">
                    السطر {index + 1}
                  </div>

                  <Field
                    label="البيان"
                    value={row.description}
                    onChange={(v) =>
                      updateRow(index, 'description', v)
                    }
                    placeholder="مثال: إيجار كرين 25 طن"
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <MiniField
                      label="الكمية"
                      value={row.qty}
                      onChange={(v) =>
                        updateRow(index, 'qty', v)
                      }
                    />

                    <MiniField
                      label="سعر الوحدة"
                      value={row.unitPrice}
                      onChange={(v) =>
                        updateRow(index, 'unitPrice', v)
                      }
                    />

                    <MiniField
                      label="الإجمالي"
                      value={row.totalPrice}
                      onChange={(v) =>
                        updateRow(index, 'totalPrice', v)
                      }
                    />
                  </div>
                </div>
              ))}

              <Field
                label="المبلغ كتابة"
                value={data.totalWords}
                onChange={(v) => updateField('totalWords', v)}
                placeholder="مثال: ثمانية عشر ألف ريال لا غير"
              />

              <Field
                label="ملاحظات"
                value={data.notes}
                onChange={(v) => updateField('notes', v)}
                placeholder="ملاحظات اختيارية"
              />

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={saveInvoice}
                  className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-3 font-bold"
                >
                  <Save size={18} />
                  حفظ
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={savePdf}
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-3 font-bold disabled:opacity-50"
                >
                  <FileDown size={18} />
                  PDF
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={shareInvoice}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 font-bold disabled:opacity-50"
                >
                  <Share2 size={18} />
                  مشاركة
                </button>

                <button
                  type="button"
                  onClick={printInvoice}
                  className="flex items-center justify-center gap-2 rounded-xl bg-slate-700 px-3 py-3 font-bold"
                >
                  <Printer size={18} />
                  طباعة
                </button>
              </div>
            </div>

            {/* ===================================== */}
            {/* معاينة الفاتورة */}
            {/* ===================================== */}

            <div className="overflow-auto rounded-2xl border border-slate-700 bg-[#0a1525] p-2">
              <div
                ref={invoiceRef}
                className="mx-auto min-h-[1120px] w-[794px] max-w-full overflow-hidden bg-white text-[#20255d]"
              >
                {/* الواجهة العلوية */}
                <div className="bg-[#272778] px-6 pb-7 pt-6 text-center">
                  <div className="grid grid-cols-[1fr_2fr_1fr] items-start gap-5">
                    {/* يمين */}
                    <div className="flex justify-center">
                      <div className="rounded-2xl bg-white px-5 py-3 text-2xl font-extrabold text-[#272778]">
                        {data.rightTitle}
                      </div>
                    </div>

                    {/* وسط */}
                    <div className="rounded-[30px] bg-white px-5 py-3">
                      <div className="text-3xl font-black text-[#272778]">
                        ● {data.companyArabic} ●
                      </div>

                      <div
                        dir="ltr"
                        className="mt-1 text-xl font-extrabold tracking-wide text-[#272778]"
                      >
                        {data.companyEnglish}
                      </div>
                    </div>

                    {/* يسار */}
                    <div className="flex justify-center">
                      <div className="rounded-2xl bg-white px-5 py-3 text-2xl font-extrabold text-[#272778]">
                        {data.leftTitle}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-5 px-16">
                    <div className="rounded-full bg-white px-5 py-2 text-2xl font-extrabold text-[#272778]">
                      {data.location}
                    </div>

                    <div className="rounded-full bg-white px-5 py-2 text-2xl font-extrabold text-[#272778]">
                      {data.activity}
                    </div>
                  </div>
                </div>

                {/* قوس */}
                <div className="relative h-12 overflow-hidden bg-white">
                  <div className="absolute -top-14 left-[-5%] h-24 w-[110%] rounded-[50%] border-[5px] border-[#272778] bg-white" />
                </div>

                {/* بيانات أعلى الفاتورة */}
                <div className="px-7">
                  <div className="grid grid-cols-3 items-center gap-2">
                    <div dir="ltr" className="text-left">
                      <div className="text-2xl font-bold">
                        فاتورة نقداً
                      </div>
                      <div className="text-xl font-bold">
                        Cash Invoice
                      </div>

                      <div className="mt-5 text-3xl">
                        No
                      </div>

                      <div className="mt-3 text-xl font-bold">
                        {data.invoiceNo}
                      </div>
                    </div>

                    {/* صورة الكرين مؤقتًا */}
                    <div className="flex h-185px items-center justify-center">
                      <div className="relative flex h-44 w-full items-center justify-center">
                        <div className="text-center text-[#272778]">
                          <div className="text-6xl">🏗️</div>
                          <div className="mt-2 text-sm font-bold">
                            صورة الكرين
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xl font-bold">
                        التاريخ
                      </div>

                      <div
                        dir="ltr"
                        className="mt-2 text-xl font-bold"
                      >
                        {data.date}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-end justify-between gap-4 border-b-2 border-[#272778] pb-3">
                    <div dir="ltr" className="text-xl">
                      Mr. / Messrs
                    </div>

                    <div className="flex-1 text-center text-2xl font-black text-black">
                      {data.customer || 'اسم العميل'}
                    </div>

                    <div className="text-xl font-bold">
                      المطلوب من السيد / السادة
                    </div>
                  </div>

                  {/* الجدول */}
                  <div className="mt-5 overflow-hidden rounded-2xl border-[3px] border-[#272778]">
                    <div className="grid grid-cols-[2.5fr_0.7fr_1.15fr_1.15fr] bg-[#f2f2fb]">
                      <TableHeader>
                        البيان
                        <small>Description</small>
                      </TableHeader>

                      <TableHeader>
                        الكمية
                        <small>Qty.</small>
                      </TableHeader>

                      <TableHeader>
                        سعر الوحدة
                        <small>Unit Price</small>
                      </TableHeader>

                      <TableHeader>
                        السعر الإجمالي
                        <small>Total Price</small>
                      </TableHeader>
                    </div>

                    {data.rows.map((row, index) => (
                      <div
                        key={index}
                        className="grid min-h-[86px] grid-cols-[2.5fr_0.7fr_1.15fr_1.15fr] border-t border-dotted border-[#666]"
                      >
                        <TableCell>
                          {row.description}
                        </TableCell>

                        <TableCell>
                          {row.qty}
                        </TableCell>

                        <TableCell>
                          {row.unitPrice}
                        </TableCell>

                        <TableCell>
                          {row.totalPrice}
                        </TableCell>
                      </div>
                    ))}

                    <div className="grid grid-cols-[1fr_2.4fr_0.7fr_1fr] border-t-[3px] border-[#272778]">
                      <div
                        dir="ltr"
                        className="flex items-center px-3 py-3 text-sm font-bold"
                      >
                        Total S.R.
                      </div>

                      <div className="flex items-center justify-center border-r border-[#272778] px-3 py-3 text-lg font-black text-black">
                        {data.totalWords || 'فقط لا غير'}
                      </div>

                      <div className="flex items-center justify-center border-r border-[#272778] px-2 font-bold">
                        المجموع
                      </div>

                      <div className="flex items-center justify-center border-r border-[#272778] px-2 text-3xl font-black text-black">
                        {grandTotal.toLocaleString('en-US')}
                      </div>
                    </div>
                  </div>

                  {/* التواقيع */}
                  <div className="grid grid-cols-2 gap-10 px-10 py-6">
                    <div className="text-center font-bold">
                      <div>توقيع المستلم</div>
                      <div dir="ltr" className="text-sm">
                        Received
                      </div>

                      <div className="mx-auto mt-8 w-32 border-b-2 border-dotted border-slate-400" />
                    </div>

                    <div className="text-center font-bold">
                      <div>توقيع البائع</div>
                      <div dir="ltr" className="text-sm">
                        Salesman Sig.
                      </div>

                      <div className="mx-auto mt-8 w-32 border-b-2 border-dotted border-slate-400" />
                    </div>
                  </div>

                  {data.notes && (
                    <div className="mb-5 rounded-lg bg-slate-50 p-3 text-center text-sm text-black">
                      {data.notes}
                    </div>
                  )}

                  <div
                    dir="ltr"
                    className="pb-4 text-sm font-bold text-black"
                  >
                    1/1
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs text-slate-400">
        {label}
      </span>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-[#07111f] px-3 py-3 text-sm text-white outline-none focus:border-violet-500"
      />
    </label>
  );
}

function MiniField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-slate-400">
        {label}
      </span>

      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-[#0a1525] px-2 py-2 text-center text-sm text-white outline-none focus:border-violet-500"
      />
    </label>
  );
}

function TableHeader({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[85px] flex-col items-center justify-center border-l-2 border-[#272778] px-2 text-center text-lg font-bold last:border-l-0">
      {children}
    </div>
  );
}

function TableCell({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-center border-l-2 border-[#272778] px-2 text-center text-lg font-bold text-black last:border-l-0">
      {children}
    </div>
  );
      }
