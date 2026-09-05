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
  Directory,
  Filesystem,
} from '@capacitor/filesystem';

import { Share } from '@capacitor/share';

import { AppLayout } from '@/components/layout/AppLayout';

const STORAGE_KEY = 'baakr-work-invoice-v3';

const TEMPLATE_WIDTH = 1056;
const TEMPLATE_HEIGHT = 1440;

const ARABIC_FONT_NAME = 'InvoiceNaskh';

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

  receivedBy: '',
  salesman: '',
});

function toNumber(value: string) {
  const cleaned = String(value || '')
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '');

  const result = Number(cleaned);

  return Number.isFinite(result) ? result : 0;
}

function rowTotal(row: InvoiceRow) {
  return toNumber(row.qty) * toNumber(row.unitPrice);
}

function formatMoney(value: number) {
  if (!value) return '';

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  if (!value) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');

    return `${Number(day)} / ${Number(month)} / ${year}`;
  }

  return value;
}

function numberToArabicWords(value: number): string {
  const n = Math.floor(Math.abs(value));

  if (n === 0) {
    return 'صفر ريال لا غير';
  }

  const ones = [
    '',
    'واحد',
    'اثنان',
    'ثلاثة',
    'أربعة',
    'خمسة',
    'ستة',
    'سبعة',
    'ثمانية',
    'تسعة',
  ];

  const teens = [
    'عشرة',
    'أحد عشر',
    'اثنا عشر',
    'ثلاثة عشر',
    'أربعة عشر',
    'خمسة عشر',
    'ستة عشر',
    'سبعة عشر',
    'ثمانية عشر',
    'تسعة عشر',
  ];

  const tens = [
    '',
    '',
    'عشرون',
    'ثلاثون',
    'أربعون',
    'خمسون',
    'ستون',
    'سبعون',
    'ثمانون',
    'تسعون',
  ];

  const hundreds = [
    '',
    'مائة',
    'مائتان',
    'ثلاثمائة',
    'أربعمائة',
    'خمسمائة',
    'ستمائة',
    'سبعمائة',
    'ثمانمائة',
    'تسعمائة',
  ];

  function under100(num: number): string {
    if (num < 10) {
      return ones[num];
    }

    if (num < 20) {
      return teens[num - 10];
    }

    const t = Math.floor(num / 10);
    const o = num % 10;

    if (o === 0) {
      return tens[t];
    }

    return `${ones[o]} و${tens[t]}`;
  }

  function under1000(num: number): string {
    if (num < 100) {
      return under100(num);
    }

    const h = Math.floor(num / 100);
    const rest = num % 100;

    if (rest === 0) {
      return hundreds[h];
    }

    return `${hundreds[h]} و${under100(rest)}`;
  }

  function convert(num: number): string {
    if (num < 1000) {
      return under1000(num);
    }

    if (num < 1000000) {
      const thousands = Math.floor(num / 1000);
      const rest = num % 1000;

      let thousandText = '';

      if (thousands === 1) {
        thousandText = 'ألف';
      } else if (thousands === 2) {
        thousandText = 'ألفان';
      } else if (
        thousands >= 3 &&
        thousands <= 10
      ) {
        thousandText =
          `${under1000(thousands)} آلاف`;
      } else {
        thousandText =
          `${under1000(thousands)} ألف`;
      }

      if (rest === 0) {
        return thousandText;
      }

      return `${thousandText} و${under1000(rest)}`;
    }

    return String(num);
  }

  return `${convert(n)} ريال لا غير`;
}

export function WorkInvoicePage() {
  const navigate = useNavigate();

  const invoiceRef =
    useRef<HTMLDivElement | null>(null);

  const [data, setData] =
    useState<InvoiceData>(createEmptyInvoice());

  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    /*
      تحميل الخط العربي من public.
      هذا هو التغيير المهم:
      لا نعتمد على Tahoma أو خط الهاتف.
    */
    const styleId = 'invoice-arabic-font-style';

    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');

      style.id = styleId;

      style.textContent = `
        @font-face {
          font-family: '${ARABIC_FONT_NAME}';
          src: url('/NotoNaskhArabic-Bold.ttf') format('truetype');
          font-style: normal;
          font-weight: 700 900;
          font-display: block;
        }
      `;

      document.head.appendChild(style);
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) return;

      const parsed = JSON.parse(raw);
      const fresh = createEmptyInvoice();

      const savedRows = Array.isArray(parsed?.rows)
        ? parsed.rows
        : [];

      setData({
        ...fresh,
        ...parsed,

        rows: Array.from(
          { length: 4 },
          (_, index) => ({
            ...fresh.rows[index],
            ...(savedRows[index] || {}),
          })
        ),
      });
    } catch (error) {
      console.error(
        'Invoice load error:',
        error
      );
    }
  }, []);

  const totals = useMemo(
    () =>
      data.rows.map((row) =>
        rowTotal(row)
      ),
    [data.rows]
  );

  const grandTotal = useMemo(
    () =>
      totals.reduce(
        (sum, value) => sum + value,
        0
      ),
    [totals]
  );

  const totalWords = useMemo(
    () =>
      grandTotal > 0
        ? numberToArabicWords(grandTotal)
        : '',
    [grandTotal]
  );

  function setField<K extends keyof InvoiceData>(
    key: K,
    value: InvoiceData[K]
  ) {
    setData((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function setRow(
    index: number,
    field: keyof InvoiceRow,
    value: string
  ) {
    setData((current) => ({
      ...current,

      rows: current.rows.map(
        (row, rowIndex) =>
          rowIndex === index
            ? {
                ...row,
                [field]: value,
              }
            : row
      ),
    }));
  }

  function saveData(showMessage = true) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
      );

      if (showMessage) {
        alert('تم حفظ بيانات الفاتورة');
      }
    } catch (error) {
      console.error(error);

      alert('تعذر حفظ بيانات الفاتورة');
    }
  }

  function resetInvoice() {
    const accepted = window.confirm(
      'هل تريد إنشاء فاتورة جديدة؟'
    );

    if (!accepted) return;

    const fresh = createEmptyInvoice();

    setData(fresh);
    setPreview(false);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(fresh)
    );
  }

  async function waitForTemplate() {
    const element = invoiceRef.current;

    if (!element) return;

    const images = Array.from(
      element.querySelectorAll('img')
    );

    await Promise.all(
      images.map(
        (image) =>
          new Promise<void>((resolve) => {
            if (image.complete) {
              resolve();
              return;
            }

            image.onload = () => resolve();
            image.onerror = () => resolve();
          })
      )
    );
  }

  async function waitForArabicFont() {
    try {
      await document.fonts.load(
        `900 32px "${ARABIC_FONT_NAME}"`
      );

      await document.fonts.ready;
    } catch (error) {
      console.warn(
        'Arabic font load warning:',
        error
      );
    }
  }

  async function createCanvas() {
    if (!invoiceRef.current) {
      throw new Error(
        'Invoice preview not found'
      );
    }

    await waitForArabicFont();
    await waitForTemplate();

    await new Promise<void>((resolve) =>
      setTimeout(resolve, 250)
    );

    return html2canvas(
      invoiceRef.current,
      {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      }
    );
  }

  async function createPdfBlob() {
    const canvas = await createCanvas();

    const image = canvas.toDataURL(
      'image/jpeg',
      0.98
    );

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth =
      pdf.internal.pageSize.getWidth();

    const pageHeight =
      pdf.internal.pageSize.getHeight();

    const ratio =
      canvas.width / canvas.height;

    let width = pageWidth;
    let height = width / ratio;

    if (height > pageHeight) {
      height = pageHeight;
      width = height * ratio;
    }

    const x = (pageWidth - width) / 2;
    const y = (pageHeight - height) / 2;

    pdf.addImage(
      image,
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
        const reader = new FileReader();

        reader.onloadend = () => {
          const result = String(
            reader.result || ''
          );

          const commaIndex =
            result.indexOf(',');

          resolve(
            commaIndex >= 0
              ? result.slice(commaIndex + 1)
              : result
          );
        };

        reader.onerror = () =>
          reject(reader.error);

        reader.readAsDataURL(blob);
      }
    );
  }

  function getFileName() {
    const number = data.invoiceNo
      .trim()
      .replace(/[\\/:*?"<>|]/g, '-');

    return number
      ? `invoice-${number}.pdf`
      : `invoice-${Date.now()}.pdf`;
  }

  async function savePDF() {
    if (busy) return;

    try {
      setBusy(true);

      saveData(false);

      const blob = await createPdfBlob();
      const base64 = await blobToBase64(blob);
      const fileName = getFileName();

      try {
        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Documents,
          recursive: true,
        });

        alert('تم حفظ PDF بنجاح');
      } catch {
        const url = URL.createObjectURL(blob);

        const anchor =
          document.createElement('a');

        anchor.href = url;
        anchor.download = fileName;

        document.body.appendChild(anchor);

        anchor.click();
        anchor.remove();

        setTimeout(
          () => URL.revokeObjectURL(url),
          1500
        );
      }
    } catch (error) {
      console.error(error);

      alert('حدث خطأ أثناء حفظ PDF');
    } finally {
      setBusy(false);
    }
  }

  async function sharePDF() {
    if (busy) return;

    try {
      setBusy(true);

      saveData(false);

      const blob = await createPdfBlob();
      const base64 = await blobToBase64(blob);

      const result =
        await Filesystem.writeFile({
          path: getFileName(),
          data: base64,
          directory: Directory.Cache,
          recursive: true,
        });

      await Share.share({
        title: 'فاتورة عمل',
        text: 'فاتورة عمل',
        url: result.uri,
        dialogTitle: 'مشاركة الفاتورة',
      });
    } catch (error) {
      console.error(error);

      alert('تعذرت مشاركة الفاتورة');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppLayout>
      <div
        dir="rtl"
        className="pb-24"
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
              تعديل ثم معاينة
            </p>
          </div>

          <button
            type="button"
            onClick={resetInvoice}
            className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center"
          >
            <RotateCcw className="w-5 h-5 text-red-400" />
          </button>
        </div>

        {!preview ? (
          <>
            <Section title="بيانات الفاتورة">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="رقم الفاتورة"
                  value={data.invoiceNo}
                  inputMode="numeric"
                  onChange={(value) =>
                    setField('invoiceNo', value)
                  }
                />

                <DateField
                  label="التاريخ"
                  value={data.date}
                  onChange={(value) =>
                    setField('date', value)
                  }
                />
              </div>

              <Field
                label="المطلوب من السيد / السادة"
                value={data.customer}
                placeholder="مثال: شركة المياه الوطنية"
                onChange={(value) =>
                  setField('customer', value)
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
                        <span className="text-white text-sm font-black">
                          السطر {index + 1}
                        </span>

                        <span className="text-emerald-400 text-xs font-black">
                          {formatMoney(
                            totals[index]
                          ) || '0'}{' '}
                          ر.س
                        </span>
                      </div>

                      <Field
                        label="البيان"
                        value={row.description}
                        placeholder="مثال: إيجار كرين رفع حديد"
                        onChange={(value) =>
                          setRow(
                            index,
                            'description',
                            value
                          )
                        }
                      />

                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <Field
                          label="الكمية"
                          value={row.qty}
                          inputMode="decimal"
                          onChange={(value) =>
                            setRow(
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
                            setRow(
                              index,
                              'unitPrice',
                              value
                            )
                          }
                        />
                      </div>
                    </div>
                  )
                )}
              </div>

              <div className="mt-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold">
                    المجموع النهائي
                  </span>

                  <span className="text-2xl text-emerald-400 font-black">
                    {formatMoney(grandTotal) || '0'} ر.س
                  </span>
                </div>

                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="text-[11px] text-slate-400 mb-1">
                    المبلغ كتابةً تلقائيًا
                  </div>

                  <div className="text-white text-sm font-black leading-7">
                    {totalWords ||
                      'سيظهر هنا تلقائيًا بعد إدخال الأسعار'}
                  </div>
                </div>
              </div>
            </Section>

            <Section title="التوقيع">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="المستلم"
                  value={data.receivedBy}
                  onChange={(value) =>
                    setField('receivedBy', value)
                  }
                />

                <Field
                  label="البائع"
                  value={data.salesman}
                  onChange={(value) =>
                    setField('salesman', value)
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
                onClick={async () => {
                  saveData(false);

                  await waitForArabicFont();

                  setPreview(true);

                  setTimeout(() => {
                    window.scrollTo({
                      top: 0,
                      behavior: 'smooth',
                    });
                  }, 50);
                }}
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
                <div className="text-white text-sm font-black">
                  معاينة الفاتورة
                </div>

                <div className="text-slate-400 text-[11px] mt-1">
                  تأكد من البيانات قبل الحفظ
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
              totalWords={totalWords}
            />

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                type="button"
                disabled={busy}
                onClick={savePDF}
                className="h-14 rounded-2xl bg-emerald-600 text-white font-black flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <FileDown className="w-5 h-5" />
                حفظ PDF
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={sharePDF}
                className="h-14 rounded-2xl bg-blue-600 text-white font-black flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Share2 className="w-5 h-5" />
                مشاركة
              </button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function InvoicePreview({
  invoiceRef,
  data,
  totals,
  grandTotal,
  totalWords,
}: {
  invoiceRef:
    React.RefObject<HTMLDivElement | null>;

  data: InvoiceData;
  totals: number[];
  grandTotal: number;
  totalWords: string;
}) {
  const rowY = [
    687,
    727,
    767,
    807,
  ];

  return (
    <div className="w-full">
      <div
        ref={invoiceRef}
        className="relative w-full bg-white overflow-hidden"
        style={{
          aspectRatio: `${TEMPLATE_WIDTH} / ${TEMPLATE_HEIGHT}`,
        }}
      >
        <img
          src="/work-invoice-template.png"
          alt="فاتورة"
          draggable={false}
          className="absolute inset-0 w-full h-full object-fill select-none pointer-events-none"
        />

        <svg
          viewBox={`0 0 ${TEMPLATE_WIDTH} ${TEMPLATE_HEIGHT}`}
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
        >
          {/* رقم الفاتورة */}
          <SvgEnglishText
            x={170}
            y={430}
            size={23}
            weight={900}
            fill="#000000"
          >
            {data.invoiceNo}
          </SvgEnglishText>

          {/* التاريخ */}
          <SvgEnglishText
            x={884}
            y={430}
            size={22}
            weight={900}
            fill="#000000"
          >
            {formatDate(data.date)}
          </SvgEnglishText>

          {/* المطلوب من السيد / شركة المياه */}
          <SvgArabicText
            x={410}
            y={493}
            size={28}
            weight={900}
            fill="#000000"
          >
            {data.customer}
          </SvgArabicText>

          {/* البنود */}
          {data.rows.map(
            (row, index) => (
              <React.Fragment key={index}>
                {/* البيان */}
                <SvgArabicText
                  x={265}
                  y={rowY[index]}
                  size={28}
                  weight={900}
                  fill="#000000"
                >
                  {row.description}
                </SvgArabicText>

                {/* الكمية */}
                <SvgEnglishText
                  x={533}
                  y={rowY[index]}
                  size={24}
                  weight={900}
                  fill="#000000"
                >
                  {row.qty}
                </SvgEnglishText>

                {/* سعر الوحدة */}
                <SvgEnglishText
                  x={682}
                  y={rowY[index]}
                  size={24}
                  weight={900}
                  fill="#000000"
                >
                  {formatMoney(
                    toNumber(row.unitPrice)
                  )}
                </SvgEnglishText>

                {/* إجمالي السطر */}
                <SvgEnglishText
                  x={874}
                  y={rowY[index]}
                  size={24}
                  weight={900}
                  fill="#000000"
                >
                  {formatMoney(totals[index])}
                </SvgEnglishText>
              </React.Fragment>
            )
          )}

          {/* المبلغ كتابةً */}
          <SvgArabicText
            x={355}
            y={1250}
            size={28}
            weight={900}
            fill="#000000"
          >
            {totalWords}
          </SvgArabicText>

          {/* الإجمالي الرقمي */}
          <SvgEnglishText
            x={902}
            y={1250}
            size={42}
            weight={900}
            fill="#000000"
          >
            {formatMoney(grandTotal)}
          </SvgEnglishText>

          {/* المستلم */}
          <SvgArabicText
            x={180}
            y={1398}
            size={20}
            weight={900}
            fill="#000000"
          >
            {data.receivedBy}
          </SvgArabicText>

          {/* البائع */}
          <SvgArabicText
            x={886}
            y={1398}
            size={20}
            weight={900}
            fill="#000000"
          >
            {data.salesman}
          </SvgArabicText>
        </svg>
      </div>
    </div>
  );
}

function SvgArabicText({
  children,
  x,
  y,
  size,
  weight,
  fill,
}: {
  children: React.ReactNode;
  x: number;
  y: number;
  size: number;
  weight: number;
  fill: string;
}) {
  return (
    <text
      x={x}
      y={y}
      fill={fill}
      fontSize={size}
      fontWeight={weight}
      textAnchor="middle"
      dominantBaseline="middle"
      direction="rtl"
      unicodeBidi="plaintext"
      style={{
        /*
          مهم:
          نستخدم الخط المرفوع داخل public
          وليس Tahoma من الجهاز.
        */
        fontFamily: `'${ARABIC_FONT_NAME}'`,
        fontWeight: 900,
        fontStyle: 'normal',
      }}
    >
      {children}
    </text>
  );
}

function SvgEnglishText({
  children,
  x,
  y,
  size,
  weight,
  fill,
}: {
  children: React.ReactNode;
  x: number;
  y: number;
  size: number;
  weight: number;
  fill: string;
}) {
  return (
    <text
      x={x}
      y={y}
      fill={fill}
      fontSize={size}
      fontWeight={weight}
      textAnchor="middle"
      dominantBaseline="middle"
      direction="ltr"
      style={{
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {children}
    </text>
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
        type="text"
        dir={dir}
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

function DateField({
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
      <span className="block mb-2 text-[12px] font-bold text-slate-400">
        {label}
      </span>

      <input
        type="date"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full h-12 px-3 rounded-xl bg-[#07111d] border border-white/10 text-white text-sm font-bold outline-none focus:border-blue-500/60"
      />
    </label>
  );
}
