import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
  ArrowRight,
  Eye,
  FileDown,
  RotateCcw,
  Save,
  Share2,
  X,
} from 'lucide-react';

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import {
  Filesystem,
  Directory,
} from '@capacitor/filesystem';

import { Share } from '@capacitor/share';

import { AppLayout } from '@/components/layout/AppLayout';

const STORAGE_KEY = 'baakr-work-invoice-v3';

type InvoiceRow = {
  description: string;
  qty: string;
  unitPrice: string;
};

type InvoiceData = {
  companyArabic: string;
  companyEnglish: string;

  cranesText: string;
  boomTruckText: string;

  activityText: string;
  locationText: string;

  invoiceTypeArabic: string;
  invoiceTypeEnglish: string;

  invoiceNo: string;
  date: string;
  customer: string;

  rows: InvoiceRow[];

  totalWords: string;

  receivedBy: string;
  salesman: string;
};

const createEmptyInvoice = (): InvoiceData => ({
  companyArabic: 'رافعات الحديثة',
  companyEnglish: 'RAFIEAT AL-HADITHA',

  cranesText: 'كرينات',
  boomTruckText: 'بوم تراك',

  activityText: 'لتأجير المعدات الثقيلة',
  locationText: 'خميس مشيط - أبها',

  invoiceTypeArabic: 'فاتورة نقداً',
  invoiceTypeEnglish: 'Cash Invoice',

  invoiceNo: '',
  date: '',
  customer: '',

  rows: [
    {
      description: '',
      qty: '1',
      unitPrice: '',
    },
    {
      description: '',
      qty: '',
      unitPrice: '',
    },
    {
      description: '',
      qty: '',
      unitPrice: '',
    },
    {
      description: '',
      qty: '',
      unitPrice: '',
    },
  ],

  totalWords: '',

  receivedBy: '',
  salesman: '',
});

function numberValue(value: string) {
  const cleaned = String(value || '')
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '');

  const number = Number(cleaned);

  return Number.isFinite(number)
    ? number
    : 0;
}

function formatMoney(value: number) {
  if (!value) return '';

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value);
}

function calculateRowTotal(row: InvoiceRow) {
  return (
    numberValue(row.qty) *
    numberValue(row.unitPrice)
  );
}

export function WorkInvoicePage() {
  const navigate = useNavigate();

  const invoiceRef =
    useRef<HTMLDivElement | null>(null);

  const [data, setData] =
    useState<InvoiceData>(
      createEmptyInvoice()
    );

  const [preview, setPreview] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY);

      if (!saved) return;

      const parsed =
        JSON.parse(saved);

      const empty =
        createEmptyInvoice();

      const savedRows =
        Array.isArray(parsed?.rows)
          ? parsed.rows
          : [];

      setData({
        ...empty,
        ...parsed,

        rows: Array.from(
          { length: 4 },
          (_, index) => ({
            ...empty.rows[index],
            ...(savedRows[index] || {}),
          })
        ),
      });
    } catch (error) {
      console.error(
        'Work invoice load error:',
        error
      );
    }
  }, []);

  const totals = useMemo(() => {
    return data.rows.map((row) =>
      calculateRowTotal(row)
    );
  }, [data.rows]);

  const grandTotal = useMemo(() => {
    return totals.reduce(
      (sum, value) => sum + value,
      0
    );
  }, [totals]);

  function updateField<K extends keyof InvoiceData>(
    key: K,
    value: InvoiceData[K]
  ) {
    setData((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateRow(
    index: number,
    field: keyof InvoiceRow,
    value: string
  ) {
    setData((current) => {
      const rows =
        current.rows.map(
          (row, rowIndex) =>
            rowIndex === index
              ? {
                  ...row,
                  [field]: value,
                }
              : row
        );

      return {
        ...current,
        rows,
      };
    });
  }

  function saveData(showAlert = true) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
      );

      if (showAlert) {
        alert('تم حفظ بيانات الفاتورة');
      }
    } catch (error) {
      console.error(
        'Save invoice error:',
        error
      );

      alert('تعذر حفظ بيانات الفاتورة');
    }
  }

  function newInvoice() {
    const confirmed =
      window.confirm(
        'هل تريد إنشاء فاتورة جديدة ومسح البيانات الحالية؟'
      );

    if (!confirmed) return;

    const fresh =
      createEmptyInvoice();

    setData(fresh);
    setPreview(false);

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(fresh)
      );
    } catch (error) {
      console.error(error);
    }
  }

  async function waitForImage() {
    const container =
      invoiceRef.current;

    if (!container) return;

    const images =
      Array.from(
        container.querySelectorAll('img')
      );

    await Promise.all(
      images.map((image) => {
        if (image.complete) {
          return Promise.resolve();
        }

        return new Promise<void>(
          (resolve) => {
            image.onload = () => resolve();
            image.onerror = () => resolve();
          }
        );
      })
    );
  }

  async function createCanvas() {
    if (!invoiceRef.current) {
      throw new Error(
        'Invoice element not found'
      );
    }

    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
    } catch {
      // تجاهل
    }

    await waitForImage();

    await new Promise<void>(
      (resolve) => {
        setTimeout(resolve, 150);
      }
    );

    return await html2canvas(
      invoiceRef.current,
      {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      }
    );
  }

  async function createPdfBlob() {
    const canvas =
      await createCanvas();

    const imageData =
      canvas.toDataURL(
        'image/jpeg',
        0.96
      );

    const pdf =
      new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

    const pageWidth =
      pdf.internal.pageSize.getWidth();

    const pageHeight =
      pdf.internal.pageSize.getHeight();

    const canvasRatio =
      canvas.width / canvas.height;

    let width = pageWidth;
    let height =
      width / canvasRatio;

    if (height > pageHeight) {
      height = pageHeight;
      width =
        height * canvasRatio;
    }

    const x =
      (pageWidth - width) / 2;

    const y =
      (pageHeight - height) / 2;

    pdf.addImage(
      imageData,
      'JPEG',
      x,
      y,
      width,
      height
    );

    return pdf.output('blob');
  }

  function blobToBase64(
    blob: Blob
  ): Promise<string> {
    return new Promise(
      (resolve, reject) => {
        const reader =
          new FileReader();

        reader.onloadend = () => {
          const result =
            String(
              reader.result || ''
            );

          const comma =
            result.indexOf(',');

          resolve(
            comma >= 0
              ? result.slice(comma + 1)
              : result
          );
        };

        reader.onerror =
          () => reject(reader.error);

        reader.readAsDataURL(blob);
      }
    );
  }

  function getFileName() {
    const number =
      data.invoiceNo
        .trim()
        .replace(
          /[\\/:*?"<>|]/g,
          '-'
        );

    if (number) {
      return `work-invoice-${number}.pdf`;
    }

    return `work-invoice-${Date.now()}.pdf`;
  }

  async function savePDF() {
    if (busy) return;

    try {
      setBusy(true);

      saveData(false);

      const blob =
        await createPdfBlob();

      const base64 =
        await blobToBase64(blob);

      const name =
        getFileName();

      try {
        await Filesystem.writeFile({
          path: name,
          data: base64,
          directory:
            Directory.Documents,
          recursive: true,
        });

        alert(
          'تم حفظ الفاتورة PDF بنجاح'
        );
      } catch (nativeError) {
        console.error(
          'Native save failed:',
          nativeError
        );

        const url =
          URL.createObjectURL(blob);

        const link =
          document.createElement('a');

        link.href = url;
        link.download = name;

        document.body.appendChild(link);

        link.click();
        link.remove();

        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 2000);
      }
    } catch (error) {
      console.error(
        'PDF error:',
        error
      );

      alert(
        'حدث خطأ أثناء إنشاء PDF'
      );
    } finally {
      setBusy(false);
    }
  }

  async function sharePDF() {
    if (busy) return;

    try {
      setBusy(true);

      saveData(false);

      const blob =
        await createPdfBlob();

      const base64 =
        await blobToBase64(blob);

      const name =
        getFileName();

      const result =
        await Filesystem.writeFile({
          path: name,
          data: base64,
          directory:
            Directory.Cache,
          recursive: true,
        });

      await Share.share({
        title: 'فاتورة عمل',
        text: 'فاتورة عمل',
        url: result.uri,
        dialogTitle:
          'مشاركة الفاتورة',
      });
    } catch (error) {
      console.error(
        'Share error:',
        error
      );

      alert(
        'تعذرت مشاركة الفاتورة'
      );
    } finally {
      setBusy(false);
    }
  }

  function openPreview() {
    saveData(false);
    setPreview(true);

    setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }, 50);
  }

  return (
    <AppLayout>
      <div
        dir="rtl"
        className="w-full pb-24"
      >
        <div className="flex items-center justify-between mb-5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center"
          >
            <ArrowRight className="w-5 h-5 text-white" />
          </button>

          <div className="text-center">
            <h1 className="text-lg font-black text-white">
              فاتورة عمل
            </h1>

            <p className="text-[11px] text-slate-500 mt-1">
              تعبئة البيانات ثم المعاينة
            </p>
          </div>

          <button
            type="button"
            onClick={newInvoice}
            className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center"
          >
            <RotateCcw className="w-5 h-5 text-red-400" />
          </button>
        </div>

        {!preview ? (
          <>
            <Section title="بيانات رأس الفاتورة">
              <Field
                label="اسم المؤسسة بالعربي"
                value={data.companyArabic}
                onChange={(value) =>
                  updateField(
                    'companyArabic',
                    value
                  )
                }
              />

              <Field
                label="اسم المؤسسة بالإنجليزي"
                value={data.companyEnglish}
                dir="ltr"
                onChange={(value) =>
                  updateField(
                    'companyEnglish',
                    value
                  )
                }
              />

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="كرينات"
                  value={data.cranesText}
                  onChange={(value) =>
                    updateField(
                      'cranesText',
                      value
                    )
                  }
                />

                <Field
                  label="بوم تراك"
                  value={data.boomTruckText}
                  onChange={(value) =>
                    updateField(
                      'boomTruckText',
                      value
                    )
                  }
                />
              </div>

              <Field
                label="النشاط"
                value={data.activityText}
                onChange={(value) =>
                  updateField(
                    'activityText',
                    value
                  )
                }
              />

              <Field
                label="الموقع"
                value={data.locationText}
                onChange={(value) =>
                  updateField(
                    'locationText',
                    value
                  )
                }
              />

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="نوع الفاتورة بالعربي"
                  value={data.invoiceTypeArabic}
                  onChange={(value) =>
                    updateField(
                      'invoiceTypeArabic',
                      value
                    )
                  }
                />

                <Field
                  label="نوع الفاتورة بالإنجليزي"
                  value={data.invoiceTypeEnglish}
                  dir="ltr"
                  onChange={(value) =>
                    updateField(
                      'invoiceTypeEnglish',
                      value
                    )
                  }
                />
              </div>
            </Section>

            <Section title="بيانات الفاتورة">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="رقم الفاتورة"
                  value={data.invoiceNo}
                  inputMode="numeric"
                  onChange={(value) =>
                    updateField(
                      'invoiceNo',
                      value
                    )
                  }
                />

                <Field
                  label="التاريخ"
                  value={data.date}
                  placeholder="2 / 8 / 2026"
                  onChange={(value) =>
                    updateField(
                      'date',
                      value
                    )
                  }
                />
              </div>

              <Field
                label="المطلوب من السيد / السادة"
                value={data.customer}
                placeholder="مثال: شركة أركان الحفر المحدودة"
                onChange={(value) =>
                  updateField(
                    'customer',
                    value
                  )
                }
              />
            </Section>

            <Section title="البيان والأسعار">
              <div className="space-y-4">
                {data.rows.map(
                  (row, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-white/10 bg-black/20 p-3"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-white font-black text-sm">
                          السطر {index + 1}
                        </span>

                        <span className="text-emerald-400 text-xs font-bold">
                          الإجمالي:{' '}
                          {formatMoney(
                            totals[index]
                          ) || '0'}{' '}
                          ر.س
                        </span>
                      </div>

                      <Field
                        label="البيان"
                        value={row.description}
                        placeholder={
                          index === 0
                            ? 'إيجار كرين 50 طن شهر سبتمبر'
                            : index === 1
                              ? 'إيجار بوم تراك'
                              : 'اكتب البيان'
                        }
                        onChange={(value) =>
                          updateRow(
                            index,
                            'description',
                            value
                          )
                        }
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <Field
                          label="الكمية"
                          value={row.qty}
                          inputMode="decimal"
                          onChange={(value) =>
                            updateRow(
                              index,
                              'qty',
                              value
                            )
                          }
                        />

                        <Field
                          label="سعر الوحدة"
                          value={row.unitPrice}
                          inputMode="decimal"
                          onChange={(value) =>
                            updateRow(
                              index,
                              'unitPrice',
                              value
                            )
                          }
                        />
                      </div>

                      <div className="mt-3 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between px-3">
                        <span className="text-xs text-slate-400">
                          السعر الإجمالي
                        </span>

                        <span className="text-emerald-400 font-black">
                          {formatMoney(
                            totals[index]
                          ) || '0'}{' '}
                          ر.س
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>

              <div className="mt-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-300">
                  المجموع النهائي
                </span>

                <span className="text-xl font-black text-emerald-400">
                  {formatMoney(grandTotal) || '0'} ر.س
                </span>
              </div>

              <div className="mt-3">
                <Field
                  label="المجموع كتابةً"
                  value={data.totalWords}
                  placeholder="مثال: ثمانية عشر ألف ريال لا غير"
                  onChange={(value) =>
                    updateField(
                      'totalWords',
                      value
                    )
                  }
                />
              </div>
            </Section>

            <Section title="التوقيع">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="المستلم"
                  value={data.receivedBy}
                  onChange={(value) =>
                    updateField(
                      'receivedBy',
                      value
                    )
                  }
                />

                <Field
                  label="البائع / المندوب"
                  value={data.salesman}
                  onChange={(value) =>
                    updateField(
                      'salesman',
                      value
                    )
                  }
                />
              </div>
            </Section>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                type="button"
                onClick={() => saveData(true)}
                className="h-14 rounded-2xl bg-slate-800 border border-white/10 text-white font-black flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                حفظ البيانات
              </button>

              <button
                type="button"
                onClick={openPreview}
                className="h-14 rounded-2xl bg-blue-600 text-white font-black flex items-center justify-center gap-2"
              >
                <Eye className="w-5 h-5" />
                معاينة
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 p-3 flex items-center justify-between">
              <div>
                <div className="text-white font-black text-sm">
                  معاينة الفاتورة
                </div>

                <div className="text-[11px] text-slate-400 mt-1">
                  تأكد من كل البيانات قبل الحفظ أو المشاركة
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreview(false)}
                className="h-10 px-4 rounded-xl bg-white/10 text-white font-bold flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                تعديل
              </button>
            </div>

            <InvoicePreview
              invoiceRef={invoiceRef}
              data={data}
              totals={totals}
              grandTotal={grandTotal}
            />

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                type="button"
                disabled={busy}
                onClick={savePDF}
                className="h-14 rounded-2xl bg-emerald-600 text-white font-black flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <FileDown className="w-5 h-5" />

                {busy
                  ? 'انتظر...'
                  : 'حفظ PDF'}
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={sharePDF}
                className="h-14 rounded-2xl bg-blue-600 text-white font-black flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Share2 className="w-5 h-5" />

                {busy
                  ? 'انتظر...'
                  : 'مشاركة'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setPreview(false)}
              className="w-full h-12 mt-3 rounded-2xl bg-white/5 border border-white/10 text-slate-300 font-bold"
            >
              رجوع للتعديل
            </button>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4 rounded-[22px] border border-white/10 bg-[#0b1524] p-4">
      <h2 className="text-white text-base font-black mb-4">
        {title}
      </h2>

      <div className="space-y-3">
        {children}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder = '',
  dir = 'rtl',
  inputMode = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  dir?: 'rtl' | 'ltr';
  inputMode?:
    | 'text'
    | 'numeric'
    | 'decimal';
}) {
  return (
    <label className="block">
      <span className="block mb-2 text-[12px] font-bold text-slate-400">
        {label}
      </span>

      <input
        dir={dir}
        type="text"
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full h-12 px-3 rounded-xl bg-[#07111d] border border-white/10 text-white text-sm font-bold outline-none focus:border-blue-500/60"
      />
    </label>
  );
}

function InvoicePreview({
  invoiceRef,
  data,
  totals,
  grandTotal,
}: {
  invoiceRef: React.RefObject<HTMLDivElement | null>;
  data: InvoiceData;
  totals: number[];
  grandTotal: number;
}) {
  return (
    <div className="w-full overflow-x-auto rounded-xl">
      <div
        ref={invoiceRef}
        className="relative mx-auto bg-white overflow-hidden"
        style={{
          width: '794px',
          height: '1085px',
          fontFamily:
            'Arial, Tahoma, sans-serif',
        }}
      >
        {/* صورة الفاتورة الأصلية */}
        <img
          src="/work-invoice-template.png"
          alt="قالب الفاتورة"
          draggable={false}
          className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
        />

        {/* رافعات الحديثة */}
        <InvoiceText
          top={42}
          left={220}
          width={355}
          height={42}
          size={31}
          weight={900}
        >
          {data.companyArabic}
        </InvoiceText>

        {/* RAFIEAT AL-HADITHA */}
        <InvoiceText
          top={82}
          left={225}
          width={345}
          height={28}
          size={17}
          weight={900}
          dir="ltr"
        >
          {data.companyEnglish}
        </InvoiceText>

        {/* بوم تراك */}
        <InvoiceText
          top={42}
          left={45}
          width={135}
          height={55}
          size={23}
          weight={900}
        >
          {data.boomTruckText}
        </InvoiceText>

        {/* كرينات */}
        <InvoiceText
          top={42}
          left={620}
          width={125}
          height={55}
          size={23}
          weight={900}
        >
          {data.cranesText}
        </InvoiceText>

        {/* خميس مشيط - أبها */}
        <InvoiceText
          top={120}
          left={110}
          width={270}
          height={45}
          size={21}
          weight={900}
        >
          {data.locationText}
        </InvoiceText>

        {/* تأجير المعدات الثقيلة */}
        <InvoiceText
          top={120}
          left={405}
          width={310}
          height={45}
          size={21}
          weight={900}
        >
          {data.activityText}
        </InvoiceText>

        {/* فاتورة نقداً */}
        <InvoiceText
          top={218}
          left={135}
          width={180}
          height={32}
          size={18}
          weight={900}
        >
          {data.invoiceTypeArabic}
        </InvoiceText>

        {/* Cash Invoice */}
        <InvoiceText
          top={247}
          left={135}
          width={180}
          height={27}
          size={16}
          weight={800}
          dir="ltr"
        >
          {data.invoiceTypeEnglish}
        </InvoiceText>

        {/* رقم الفاتورة */}
        <InvoiceText
          top={285}
          left={50}
          width={140}
          height={32}
          size={18}
          weight={800}
          dir="ltr"
        >
          {data.invoiceNo}
        </InvoiceText>

        {/* التاريخ */}
        <InvoiceText
          top={286}
          left={575}
          width={165}
          height={34}
          size={17}
          weight={800}
          dir="ltr"
        >
          {data.date}
        </InvoiceText>

        {/* اسم العميل */}
        <InvoiceText
          top={328}
          left={175}
          width={410}
          height={38}
          size={20}
          weight={900}
        >
          {data.customer}
        </InvoiceText>

        {/* الأسطر الأربعة */}
        {data.rows.map((row, index) => {
          const top =
            505 + index * 43;

          return (
            <React.Fragment key={index}>
              {/* البيان */}
              <InvoiceText
                top={top}
                left={35}
                width={340}
                height={35}
                size={17}
                weight={800}
              >
                {row.description}
              </InvoiceText>

              {/* الكمية */}
              <InvoiceText
                top={top}
                left={380}
                width={55}
                height={35}
                size={17}
                weight={800}
                dir="ltr"
              >
                {row.qty}
              </InvoiceText>

              {/* سعر الوحدة */}
              <InvoiceText
                top={top}
                left={445}
                width={105}
                height={35}
                size={18}
                weight={900}
                dir="ltr"
              >
                {formatMoney(
                  numberValue(
                    row.unitPrice
                  )
                )}
              </InvoiceText>

              {/* السعر الإجمالي */}
              <InvoiceText
                top={top}
                left={600}
                width={110}
                height={35}
                size={18}
                weight={900}
                dir="ltr"
              >
                {formatMoney(
                  totals[index]
                )}
              </InvoiceText>
            </React.Fragment>
          );
        })}

        {/* المبلغ كتابة */}
        <InvoiceText
          top={956}
          left={125}
          width={450}
          height={40}
          size={17}
          weight={900}
        >
          {data.totalWords}
        </InvoiceText>

        {/* المجموع النهائي */}
        <InvoiceText
          top={956}
          left={610}
          width={130}
          height={40}
          size={22}
          weight={900}
          dir="ltr"
        >
          {formatMoney(
            grandTotal
          )}
        </InvoiceText>

        {/* المستلم */}
        <InvoiceText
          top={1010}
          left={75}
          width={210}
          height={32}
          size={14}
          weight={700}
        >
          {data.receivedBy}
        </InvoiceText>

        {/* البائع */}
        <InvoiceText
          top={1010}
          left={510}
          width={210}
          height={32}
          size={14}
          weight={700}
        >
          {data.salesman}
        </InvoiceText>
      </div>
    </div>
  );
}

function InvoiceText({
  children,
  top,
  left,
  width,
  height,
  size,
  weight,
  dir = 'rtl',
}: {
  children: React.ReactNode;
  top: number;
  left: number;
  width: number;
  height: number;
  size: number;
  weight: number;
  dir?: 'rtl' | 'ltr';
}) {
  return (
    <div
      dir={dir}
      className="absolute text-black flex items-center justify-center text-center leading-tight"
      style={{
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: `${height}px`,
        fontSize: `${size}px`,
        fontWeight: weight,
        zIndex: 10,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
        }
