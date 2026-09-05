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

const TEMPLATE_WIDTH = 1052;
const TEMPLATE_HEIGHT = 1438;

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

function toNumber(value: string) {
  const cleaned = String(value || '')
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '');

  const result = Number(cleaned);

  return Number.isFinite(result)
    ? result
    : 0;
}

function rowTotal(row: InvoiceRow) {
  return (
    toNumber(row.qty) *
    toNumber(row.unitPrice)
  );
}

function formatMoney(value: number) {
  if (!value) return '';

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  if (!value) return '';

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    const [year, month, day] =
      value.split('-');

    return `${Number(day)} / ${Number(month)} / ${year}`;
  }

  return value;
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
      const raw =
        localStorage.getItem(STORAGE_KEY);

      if (!raw) return;

      const parsed =
        JSON.parse(raw);

      const fresh =
        createEmptyInvoice();

      const savedRows =
        Array.isArray(parsed?.rows)
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
      data.rows.map(
        (row) => rowTotal(row)
      ),
    [data.rows]
  );

  const grandTotal = useMemo(
    () =>
      totals.reduce(
        (sum, value) =>
          sum + value,
        0
      ),
    [totals]
  );

  function setField<
    K extends keyof InvoiceData
  >(
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

  function saveData(
    showMessage = true
  ) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
      );

      if (showMessage) {
        alert(
          'تم حفظ بيانات الفاتورة'
        );
      }
    } catch (error) {
      console.error(error);

      alert(
        'تعذر حفظ بيانات الفاتورة'
      );
    }
  }

  function resetInvoice() {
    const accepted =
      window.confirm(
        'هل تريد إنشاء فاتورة جديدة؟'
      );

    if (!accepted) return;

    const fresh =
      createEmptyInvoice();

    setData(fresh);
    setPreview(false);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(fresh)
    );
  }

  async function waitForTemplate() {
    const element =
      invoiceRef.current;

    if (!element) return;

    const images =
      Array.from(
        element.querySelectorAll('img')
      );

    await Promise.all(
      images.map(
        (image) =>
          new Promise<void>(
            (resolve) => {
              if (image.complete) {
                resolve();
                return;
              }

              image.onload =
                () => resolve();

              image.onerror =
                () => resolve();
            }
          )
      )
    );
  }

  async function createCanvas() {
    if (!invoiceRef.current) {
      throw new Error(
        'Invoice preview not found'
      );
    }

    try {
      await document.fonts?.ready;
    } catch {
      // ignore
    }

    await waitForTemplate();

    await new Promise<void>(
      (resolve) =>
        setTimeout(resolve, 150)
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
    const canvas =
      await createCanvas();

    const image =
      canvas.toDataURL(
        'image/jpeg',
        0.98
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

    const ratio =
      canvas.width /
      canvas.height;

    let width =
      pageWidth;

    let height =
      width / ratio;

    if (height > pageHeight) {
      height =
        pageHeight;

      width =
        height * ratio;
    }

    const x =
      (pageWidth - width) / 2;

    const y =
      (pageHeight - height) / 2;

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
        const reader =
          new FileReader();

        reader.onloadend = () => {
          const result =
            String(
              reader.result || ''
            );

          const commaIndex =
            result.indexOf(',');

          resolve(
            commaIndex >= 0
              ? result.slice(
                  commaIndex + 1
                )
              : result
          );
        };

        reader.onerror =
          () =>
            reject(
              reader.error
            );

        reader.readAsDataURL(
          blob
        );
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

    return number
      ? `invoice-${number}.pdf`
      : `invoice-${Date.now()}.pdf`;
  }

  async function savePDF() {
    if (busy) return;

    try {
      setBusy(true);

      saveData(false);

      const blob =
        await createPdfBlob();

      const base64 =
        await blobToBase64(
          blob
        );

      const fileName =
        getFileName();

      try {
        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory:
            Directory.Documents,
          recursive: true,
        });

        alert(
          'تم حفظ PDF بنجاح'
        );
      } catch {
        const url =
          URL.createObjectURL(
            blob
          );

        const anchor =
          document.createElement(
            'a'
          );

        anchor.href = url;
        anchor.download =
          fileName;

        document.body.appendChild(
          anchor
        );

        anchor.click();
        anchor.remove();

        setTimeout(
          () =>
            URL.revokeObjectURL(
              url
            ),
          1500
        );
      }
    } catch (error) {
      console.error(error);

      alert(
        'حدث خطأ أثناء حفظ PDF'
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
        await blobToBase64(
          blob
        );

      const result =
        await Filesystem.writeFile({
          path: getFileName(),
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
      console.error(error);

      alert(
        'تعذرت مشاركة الفاتورة'
      );
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
            onClick={() =>
              navigate(-1)
            }
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
            onClick={
              resetInvoice
            }
            className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center"
          >
            <RotateCcw className="w-5 h-5 text-red-400" />
          </button>
        </div>

        {!preview ? (
          <>
            <Section title="رأس الفاتورة">
              <Field
                label="اسم المؤسسة بالعربي"
                value={
                  data.companyArabic
                }
                onChange={(value) =>
                  setField(
                    'companyArabic',
                    value
                  )
                }
              />

              <Field
                label="اسم المؤسسة بالإنجليزي"
                value={
                  data.companyEnglish
                }
                dir="ltr"
                onChange={(value) =>
                  setField(
                    'companyEnglish',
                    value
                  )
                }
              />

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="بوم تراك"
                  value={
                    data.boomTruckText
                  }
                  onChange={(value) =>
                    setField(
                      'boomTruckText',
                      value
                    )
                  }
                />

                <Field
                  label="كرينات"
                  value={
                    data.cranesText
                  }
                  onChange={(value) =>
                    setField(
                      'cranesText',
                      value
                    )
                  }
                />
              </div>

              <Field
                label="الموقع"
                value={
                  data.locationText
                }
                onChange={(value) =>
                  setField(
                    'locationText',
                    value
                  )
                }
              />

              <Field
                label="النشاط"
                value={
                  data.activityText
                }
                onChange={(value) =>
                  setField(
                    'activityText',
                    value
                  )
                }
              />
            </Section>

            <Section title="بيانات الفاتورة">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="رقم الفاتورة"
                  value={
                    data.invoiceNo
                  }
                  inputMode="numeric"
                  onChange={(value) =>
                    setField(
                      'invoiceNo',
                      value
                    )
                  }
                />

                <DateField
                  label="التاريخ"
                  value={
                    data.date
                  }
                  onChange={(value) =>
                    setField(
                      'date',
                      value
                    )
                  }
                />
              </div>

              <Field
                label="المطلوب من السيد / السادة"
                value={
                  data.customer
                }
                placeholder="مثال: شركة المياه الوطنية"
                onChange={(value) =>
                  setField(
                    'customer',
                    value
                  )
                }
              />
            </Section>

            <Section title="البيان والأسعار">
              <div className="space-y-4">
                {data.rows.map(
                  (
                    row,
                    index
                  ) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-white/10 bg-black/20 p-3"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-white text-sm font-black">
                          السطر{' '}
                          {index +
                            1}
                        </span>

                        <span className="text-emerald-400 text-xs font-black">
                          {formatMoney(
                            totals[
                              index
                            ]
                          ) ||
                            '0'}{' '}
                          ر.س
                        </span>
                      </div>

                      <Field
                        label="البيان"
                        value={
                          row.description
                        }
                        placeholder="مثال: إيجار كرين 50 طن شهر سبتمبر"
                        onChange={(
                          value
                        ) =>
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
                          value={
                            row.qty
                          }
                          inputMode="decimal"
                          onChange={(
                            value
                          ) =>
                            setRow(
                              index,
                              'qty',
                              value
                            )
                          }
                        />

                        <Field
                          label="سعر الوحدة"
                          value={
                            row.unitPrice
                          }
                          inputMode="decimal"
                          onChange={(
                            value
                          ) =>
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

              <div className="mt-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center justify-between">
                <span className="text-slate-300 font-bold">
                  المجموع النهائي
                </span>

                <span className="text-xl text-emerald-400 font-black">
                  {formatMoney(
                    grandTotal
                  ) || '0'}{' '}
                  ر.س
                </span>
              </div>

              <div className="mt-3">
                <Field
                  label="المبلغ كتابةً"
                  value={
                    data.totalWords
                  }
                  placeholder="مثال: ثمانية عشر ألف ريال لا غير"
                  onChange={(value) =>
                    setField(
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
                  value={
                    data.receivedBy
                  }
                  onChange={(value) =>
                    setField(
                      'receivedBy',
                      value
                    )
                  }
                />

                <Field
                  label="البائع"
                  value={
                    data.salesman
                  }
                  onChange={(value) =>
                    setField(
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
                onClick={() =>
                  saveData(true)
                }
                className="h-14 rounded-2xl bg-slate-800 border border-white/10 text-white font-black flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                حفظ البيانات
              </button>

              <button
                type="button"
                onClick={() => {
                  saveData(false);
                  setPreview(
                    true
                  );
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
                  تأكد أن النص داخل الخانات
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setPreview(
                    false
                  )
                }
                className="h-10 px-4 rounded-xl bg-white/10 text-white font-bold flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                تعديل
              </button>
            </div>

            <InvoicePreview
              invoiceRef={
                invoiceRef
              }
              data={data}
              totals={totals}
              grandTotal={
                grandTotal
              }
            />

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                type="button"
                disabled={busy}
                onClick={
                  savePDF
                }
                className="h-14 rounded-2xl bg-emerald-600 text-white font-black flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <FileDown className="w-5 h-5" />
                حفظ PDF
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={
                  sharePDF
                }
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
}: {
  invoiceRef:
    React.RefObject<HTMLDivElement | null>;

  data: InvoiceData;

  totals: number[];

  grandTotal: number;
}) {
  const rowY = [
    731,
    774,
    817,
    860,
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
          {/* بوم تراك */}
          <SvgArabicText
            x={145}
            y={72}
            size={31}
            weight={900}
            fill="#24277a"
          >
            {data.boomTruckText}
          </SvgArabicText>

          {/* اسم المؤسسة */}
          <SvgArabicText
            x={526}
            y={62}
            size={39}
            weight={900}
            fill="#24277a"
          >
            {data.companyArabic}
          </SvgArabicText>

          <SvgEnglishText
            x={526}
            y={102}
            size={23}
            weight={900}
            fill="#24277a"
          >
            {data.companyEnglish}
          </SvgEnglishText>

          {/* كرينات */}
          <SvgArabicText
            x={910}
            y={72}
            size={31}
            weight={900}
            fill="#24277a"
          >
            {data.cranesText}
          </SvgArabicText>

          {/* الموقع */}
          <SvgArabicText
            x={334}
            y={169}
            size={28}
            weight={900}
            fill="#24277a"
          >
            {data.locationText}
          </SvgArabicText>

          {/* النشاط */}
          <SvgArabicText
            x={735}
            y={169}
            size={28}
            weight={900}
            fill="#24277a"
          >
            {data.activityText}
          </SvgArabicText>

          {/* فاتورة نقداً */}
          <SvgArabicText
            x={278}
            y={314}
            size={25}
            weight={900}
            fill="#24277a"
          >
            {data.invoiceTypeArabic}
          </SvgArabicText>

          <SvgEnglishText
            x={278}
            y={350}
            size={22}
            weight={900}
            fill="#24277a"
          >
            {data.invoiceTypeEnglish}
          </SvgEnglishText>

          {/* رقم الفاتورة */}
          <SvgEnglishText
            x={140}
            y={420}
            size={24}
            weight={900}
            fill="#111111"
          >
            {data.invoiceNo}
          </SvgEnglishText>

          {/* التاريخ */}
          <SvgEnglishText
            x={864}
            y={422}
            size={23}
            weight={900}
            fill="#111111"
          >
            {formatDate(
              data.date
            )}
          </SvgEnglishText>

          {/* اسم العميل */}
          <SvgArabicText
            x={520}
            y={467}
            size={27}
            weight={900}
            fill="#111111"
          >
            {data.customer}
          </SvgArabicText>

          {/* البنود الأربعة */}
          {data.rows.map(
            (
              row,
              index
            ) => (
              <React.Fragment
                key={index}
              >
                <SvgArabicText
                  x={275}
                  y={
                    rowY[
                      index
                    ]
                  }
                  size={23}
                  weight={900}
                  fill="#111111"
                >
                  {
                    row.description
                  }
                </SvgArabicText>

                <SvgEnglishText
                  x={540}
                  y={
                    rowY[
                      index
                    ]
                  }
                  size={23}
                  weight={900}
                  fill="#111111"
                >
                  {row.qty}
                </SvgEnglishText>

                <SvgEnglishText
                  x={666}
                  y={
                    rowY[
                      index
                    ]
                  }
                  size={23}
                  weight={900}
                  fill="#111111"
                >
                  {formatMoney(
                    toNumber(
                      row.unitPrice
                    )
                  )}
                </SvgEnglishText>

                <SvgEnglishText
                  x={868}
                  y={
                    rowY[
                      index
                    ]
                  }
                  size={23}
                  weight={900}
                  fill="#111111"
                >
                  {formatMoney(
                    totals[
                      index
                    ]
                  )}
                </SvgEnglishText>
              </React.Fragment>
            )
          )}

          {/* المبلغ كتابة */}
          <SvgArabicText
            x={382}
            y={1304}
            size={25}
            weight={900}
            fill="#111111"
          >
            {data.totalWords}
          </SvgArabicText>

          {/* الإجمالي */}
          <SvgEnglishText
            x={894}
            y={1308}
            size={30}
            weight={900}
            fill="#111111"
          >
            {formatMoney(
              grandTotal
            )}
          </SvgEnglishText>

          {/* المستلم */}
          <SvgArabicText
            x={180}
            y={1392}
            size={19}
            weight={800}
            fill="#111111"
          >
            {data.receivedBy}
          </SvgArabicText>

          {/* البائع */}
          <SvgArabicText
            x={873}
            y={1392}
            size={19}
            weight={800}
            fill="#111111"
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
        fontFamily:
          'Tahoma, Arial, sans-serif',
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
        fontFamily:
          'Arial, Tahoma, sans-serif',
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
  children:
    React.ReactNode;
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

  onChange:
    (value: string) =>
      void;

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
        inputMode={
          inputMode
        }
        placeholder={
          placeholder
        }
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
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

  onChange:
    (value: string) =>
      void;
}) {
  return (
    <label className="block">
      <span className="block mb-2 text-[12px] font-bold text-slate-400">
        {label}
      </span>

      <input
        type="date"
        value={value}
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }
        className="w-full h-12 px-3 rounded-xl bg-[#07111d] border border-white/10 text-white text-sm font-bold outline-none focus:border-blue-500/60"
      />
    </label>
  );
        }
