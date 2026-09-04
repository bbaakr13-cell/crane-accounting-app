import { useEffect, useMemo, useRef, useState } from 'react';
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

import { Filesystem, Directory } from '@capacitor/filesystem';
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

  invoiceNo: string;
  date: string;
  customer: string;

  rows: InvoiceRow[];

  totalWords: string;

  receivedBy: string;
  salesman: string;
};

const createEmptyInvoice = (): InvoiceData => ({
  companyArabic: 'الرافعات الحديثة',
  companyEnglish: 'RAFIEAT AL-HADITHA',

  cranesText: 'كرينات',
  boomTruckText: 'بوم تراك',

  activityText: 'تأجير المعدات الثقيلة',
  locationText: 'خميس مشيط - أبها',

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
  const cleaned = value
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '');

  const result = Number(cleaned);

  return Number.isFinite(result)
    ? result
    : 0;
}

function formatMoney(value: number) {
  if (!value) return '';

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value);
}

function rowTotal(row: InvoiceRow) {
  return (
    numberValue(row.qty) *
    numberValue(row.unitPrice)
  );
}

export function WorkInvoicePage() {
  const navigate = useNavigate();

  const invoiceRef =
    useRef<HTMLDivElement>(null);

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

      setData({
        ...empty,
        ...parsed,

        rows: Array.from(
          { length: 4 },
          (_, index) => ({
            ...empty.rows[index],
            ...(parsed.rows?.[index] || {}),
          })
        ),
      });
    } catch (error) {
      console.error(
        'Work invoice load error',
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
        (sum, value) =>
          sum + value,
        0
      ),
    [totals]
  );

  function changeField<
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

  function changeRow(
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

  function saveData(showMessage = true) {
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
    const confirmed =
      window.confirm(
        'هل تريد إنشاء فاتورة جديدة ومسح البيانات الحالية؟'
      );

    if (!confirmed) return;

    const next =
      createEmptyInvoice();

    setData(next);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(next)
    );
  }

  async function createCanvas() {
    if (!invoiceRef.current) {
      throw new Error(
        'Invoice element not found'
      );
    }

    if (
      'fonts' in document
    ) {
      await document.fonts.ready;
    }

    await new Promise(
      (resolve) =>
        setTimeout(resolve, 150)
    );

    return html2canvas(
      invoiceRef.current,
      {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor:
          '#ffffff',
      }
    );
  }

  async function createPdfBlob() {
    const canvas =
      await createCanvas();

    const imageData =
      canvas.toDataURL(
        'image/jpeg',
        0.98
      );

    const pdf = new jsPDF(
      'p',
      'mm',
      'a4'
    );

    const pageWidth =
      pdf.internal.pageSize.getWidth();

    const pageHeight =
      pdf.internal.pageSize.getHeight();

    const imageRatio =
      canvas.width /
      canvas.height;

    let width = pageWidth;
    let height =
      width / imageRatio;

    if (height > pageHeight) {
      height = pageHeight;
      width =
        height * imageRatio;
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

        reader.onloadend =
          () => {
            const result =
              String(
                reader.result || ''
              );

            resolve(
              result.includes(',')
                ? result.split(',')[1]
                : result
            );
          };

        reader.onerror =
          reject;

        reader.readAsDataURL(
          blob
        );
      }
    );
  }

  function fileName() {
    const number =
      data.invoiceNo.trim();

    return number
      ? `work-invoice-${number}.pdf`
      : `work-invoice-${Date.now()}.pdf`;
  }

  async function savePDF() {
    try {
      setBusy(true);

      saveData(false);

      const blob =
        await createPdfBlob();

      const name =
        fileName();

      try {
        const base64 =
          await blobToBase64(
            blob
          );

        const result =
          await Filesystem.writeFile(
            {
              path: name,
              data: base64,
              directory:
                Directory.Documents,
              recursive: true,
            }
          );

        alert(
          `تم حفظ PDF بنجاح\n${result.uri}`
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
          name;

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
    try {
      setBusy(true);

      saveData(false);

      const blob =
        await createPdfBlob();

      const base64 =
        await blobToBase64(
          blob
        );

      const name =
        fileName();

      const result =
        await Filesystem.writeFile(
          {
            path: name,
            data: base64,
            directory:
              Directory.Cache,
            recursive: true,
          }
        );

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
            <ArrowRight className="w-5 h-5" />
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
            onClick={
              resetInvoice
            }
            className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center"
          >
            <RotateCcw className="w-5 h-5 text-red-400" />
          </button>
        </div>

        {!preview && (
          <>
            <Section title="بيانات رأس الفاتورة">
              <Field
                label="اسم المؤسسة بالعربي"
                value={
                  data.companyArabic
                }
                onChange={(value) =>
                  changeField(
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
                  changeField(
                    'companyEnglish',
                    value
                  )
                }
              />

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="كرينات"
                  value={
                    data.cranesText
                  }
                  onChange={(value) =>
                    changeField(
                      'cranesText',
                      value
                    )
                  }
                />

                <Field
                  label="بوم تراك"
                  value={
                    data.boomTruckText
                  }
                  onChange={(value) =>
                    changeField(
                      'boomTruckText',
                      value
                    )
                  }
                />
              </div>

              <Field
                label="النشاط"
                value={
                  data.activityText
                }
                onChange={(value) =>
                  changeField(
                    'activityText',
                    value
                  )
                }
              />

              <Field
                label="الموقع"
                value={
                  data.locationText
                }
                onChange={(value) =>
                  changeField(
                    'locationText',
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
                  onChange={(value) =>
                    changeField(
                      'invoiceNo',
                      value
                    )
                  }
                />

                <Field
                  label="التاريخ"
                  value={
                    data.date
                  }
                  placeholder="13 / 9 / 2026"
                  onChange={(value) =>
                    changeField(
                      'date',
                      value
                    )
                  }
                />
              </div>

              <Field
                label="المطلوب من السيد / الشركة"
                value={
                  data.customer
                }
                placeholder="مثال: شركة أركان الحفر المحدودة"
                onChange={(value) =>
                  changeField(
                    'customer',
                    value
                  )
                }
              />
            </Section>

            <Section title="تفاصيل الأعمال">
              <div className="space-y-4">
                {data.rows.map(
                  (
                    row,
                    index
                  ) => (
                    <div
                      key={
                        index
                      }
                      className="rounded-2xl border border-white/10 bg-black/20 p-3"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-white font-black text-sm">
                          البيان{' '}
                          {index +
                            1}
                        </span>

                        <span className="text-emerald-400 text-xs font-bold">
                          الإجمالي:{' '}
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
                        placeholder={
                          index ===
                          0
                            ? 'مثال: إيجار كرين 50 طن شهر سبتمبر'
                            : 'اكتب البيان'
                        }
                        onChange={(
                          value
                        ) =>
                          changeRow(
                            index,
                            'description',
                            value
                          )
                        }
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <Field
                          label="الكمية"
                          value={
                            row.qty
                          }
                          inputMode="decimal"
                          onChange={(
                            value
                          ) =>
                            changeRow(
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
                            changeRow(
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

              <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-300">
                  المجموع النهائي
                </span>

                <span className="text-xl font-black text-emerald-400">
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
                  placeholder="مثال: ثمانية عشر ألف ريال فقط لا غير"
                  onChange={(value) =>
                    changeField(
                      'totalWords',
                      value
                    )
                  }
                />
              </div>
            </Section>

            <Section title="التوقيع والاستلام">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="المستلم"
                  value={
                    data.receivedBy
                  }
                  onChange={(value) =>
                    changeField(
                      'receivedBy',
                      value
                    )
                  }
                />

                <Field
                  label="المندوب"
                  value={
                    data.salesman
                  }
                  onChange={(value) =>
                    changeField(
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
                  saveData()
                }
                className="h-14 rounded-2xl bg-slate-800 border border-white/10 text-white font-black flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                حفظ البيانات
              </button>

              <button
                type="button"
                onClick={() => {
                  saveData(
                    false
                  );
                  setPreview(
                    true
                  );
                }}
                className="h-14 rounded-2xl bg-blue-600 text-white font-black flex items-center justify-center gap-2 shadow-lg"
              >
                <Eye className="w-5 h-5" />
                معاينة الفاتورة
              </button>
            </div>
          </>
        )}

        {preview && (
          <>
            <div className="mb-4 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 flex items-center justify-between">
              <div>
                <div className="text-white font-black text-sm">
                  معاينة الفاتورة
                </div>

                <div className="text-slate-400 text-[11px] mt-1">
                  تأكد من البيانات قبل الحفظ أو المشاركة
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setPreview(
                    false
                  )
                }
                className="px-4 h-10 rounded-xl bg-white/10 text-white font-bold flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                تعديل
              </button>
            </div>

            <InvoicePreview
              ref={invoiceRef}
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

            <button
              type="button"
              onClick={() =>
                setPreview(
                  false
                )
              }
              className="w-full h-12 rounded-2xl mt-3 bg-white/5 border border-white/10 text-slate-300 font-bold"
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
  children:
    React.ReactNode;
}) {
  return (
    <section className="mb-4 rounded-[22px] border border-white/10 bg-[#0b1524] p-4">
      <h2 className="text-white text-sm font-black mb-4">
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
  onChange: (
    value: string
  ) => void;
  placeholder?: string;
  dir?: 'rtl' | 'ltr';
  inputMode?:
    | 'text'
    | 'decimal'
    | 'numeric';
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold text-slate-400 mb-2">
        {label}
      </span>

      <input
        dir={dir}
        value={value}
        inputMode={
          inputMode
        }
        placeholder={
          placeholder
        }
        onChange={(event) =>
          onChange(
            event.target
              .value
          )
        }
        className="w-full h-12 px-3 rounded-xl bg-[#07111d] border border-white/10 text-white text-sm font-bold outline-none focus:border-blue-500/60"
      />
    </label>
  );
}

const InvoicePreview =
  React.forwardRef<
    HTMLDivElement,
    {
      data: InvoiceData;
      totals: number[];
      grandTotal: number;
    }
  >(function InvoicePreview(
    {
      data,
      totals,
      grandTotal,
    },
    ref
  ) {
    return (
      <div className="w-full overflow-x-auto rounded-xl">
        <div
          ref={ref}
          className="relative mx-auto bg-white overflow-hidden"
          style={{
            width: 794,
            height: 1085,
            fontFamily:
              'Arial, Tahoma, sans-serif',
          }}
        >
          {/* الصورة الأصلية كما هي */}
          <img
            src="/work-invoice-template.png"
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
          />

          {/* اسم المؤسسة */}
          <Text
            top={48}
            left={230}
            width={335}
            size={34}
            weight={900}
          >
            {data.companyArabic}
          </Text>

          <Text
            top={90}
            left={230}
            width={335}
            size={18}
            weight={800}
            dir="ltr"
          >
            {data.companyEnglish}
          </Text>

          {/* كرينات */}
          <Text
            top={150}
            left={485}
            width={135}
            size={27}
            weight={900}
          >
            {data.cranesText}
          </Text>

          {/* بوم تراك */}
          <Text
            top={150}
            left={125}
            width={160}
            size={27}
            weight={900}
          >
            {data.boomTruckText}
          </Text>

          {/* النشاط */}
          <Text
            top={209}
            left={438}
            width={260}
            size={21}
            weight={900}
          >
            {data.activityText}
          </Text>

          {/* الموقع */}
          <Text
            top={209}
            left={100}
            width={235}
            size={21}
            weight={900}
          >
            {data.locationText}
          </Text>

          {/* رقم الفاتورة */}
          <Text
            top={272}
            left={92}
            width={120}
            size={19}
            weight={800}
            dir="ltr"
          >
            {data.invoiceNo}
          </Text>

          {/* التاريخ */}
          <Text
            top={282}
            left={575}
            width={160}
            size={17}
            weight={700}
            dir="ltr"
          >
            {data.date}
          </Text>

          {/* العميل */}
          <Text
            top={325}
            left={190}
            width={390}
            size={19}
            weight={800}
          >
            {data.customer}
          </Text>

          {/* تفاصيل الجدول */}
          {data.rows.map(
            (row, index) => {
              const top =
                485 +
                index * 42;

              return (
                <React.Fragment
                  key={
                    index
                  }
                >
                  <Text
                    top={
                      top
                    }
                    left={
                      38
                    }
                    width={
                      335
                    }
                    size={
                      17
                    }
                    weight={
                      700
                    }
                  >
                    {
                      row.description
                    }
                  </Text>

                  <Text
                    top={
                      top
                    }
                    left={
                      378
                    }
                    width={
                      62
                    }
                    size={
                      17
                    }
                    weight={
                      700
                    }
                    dir="ltr"
                  >
                    {
                      row.qty
                    }
                  </Text>

                  <Text
                    top={
                      top
                    }
                    left={
                      445
                    }
                    width={
                      105
                    }
                    size={
                      17
                    }
                    weight={
                      700
                    }
                    dir="ltr"
                  >
                    {formatMoney(
                      numberValue(
                        row.unitPrice
                      )
                    )}
                  </Text>

                  <Text
                    top={
                      top
                    }
                    left={
                      600
                    }
                    width={
                      110
                    }
                    size={
                      17
                    }
                    weight={
                      800
                    }
                    dir="ltr"
                  >
                    {formatMoney(
                      totals[
                        index
                      ]
                    )}
                  </Text>
                </React.Fragment>
              );
            }
          )}

          {/* المجموع */}
          <Text
            top={954}
            left={610}
            width={125}
            size={21}
            weight={900}
            dir="ltr"
          >
            {formatMoney(
              grandTotal
            )}
          </Text>

          {/* المبلغ كتابة */}
          <Text
            top={954}
            left={125}
            width={430}
            size={17}
            weight={800}
          >
            {data.totalWords}
          </Text>

          {/* المستلم */}
          <Text
            top={1010}
            left={90}
            width={210}
            size={15}
            weight={700}
          >
            {data.receivedBy}
          </Text>

          {/* المندوب */}
          <Text
            top={1010}
            left={500}
            width={210}
            size={15}
            weight={700}
          >
            {data.salesman}
          </Text>
        </div>
      </div>
    );
  });

function Text({
  children,
  top,
  left,
  width,
  size,
  weight,
  dir = 'rtl',
}: {
  children:
    React.ReactNode;
  top: number;
  left: number;
  width: number;
  size: number;
  weight: number;
  dir?: 'rtl' | 'ltr';
}) {
  return (
    <div
      dir={dir}
      className="absolute text-black flex items-center justify-center text-center leading-tight"
      style={{
        top,
        left,
        width,
        minHeight: 30,
        fontSize: size,
        fontWeight:
          weight,
      }}
    >
      {children}
    </div>
  );
}
