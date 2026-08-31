import React, { useMemo, useRef, useState } from 'react';
import {
  Eye,
  Save,
  FileDown,
  Printer,
  Share2,
  Plus,
  X,
  ArrowRight,
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/* =========================================================
   TYPES
========================================================= */

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

/* =========================================================
   SETTINGS
========================================================= */

const STORAGE_KEY = 'baakr-work-invoice-v3';

const EQUIPMENT_IMAGE =
  '/file_00000000bf2c820aa62b57dd4de5b46c.png';

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

const today = new Date().toISOString().slice(0, 10);

function makeEmptyRows(): InvoiceRow[] {
  return Array.from({ length: 7 }, () => ({
    description: '',
    qty: '',
    unitPrice: '',
    totalPrice: '',
  }));
}

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

  rows: makeEmptyRows(),

  totalWords: '',
  notes: '',
};

/* =========================================================
   HELPERS
========================================================= */

function safeNumber(value: string | number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function loadInvoice(): WorkInvoiceData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return initialData;
    }

    const parsed = JSON.parse(saved);

    return {
      ...initialData,
      ...parsed,

      rows: Array.from({ length: 7 }, (_, index) => ({
        description: parsed?.rows?.[index]?.description ?? '',
        qty: parsed?.rows?.[index]?.qty ?? '',
        unitPrice: parsed?.rows?.[index]?.unitPrice ?? '',
        totalPrice: parsed?.rows?.[index]?.totalPrice ?? '',
      })),
    };
  } catch {
    return initialData;
  }
}

/* =========================================================
   PAGE
========================================================= */

export function WorkInvoicePage() {
  const navigate = useNavigate();

  const invoiceRef = useRef<HTMLDivElement>(null);

  const [data, setData] =
    useState<WorkInvoiceData>(() => loadInvoice());

  const [busy, setBusy] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);

  const grandTotal = useMemo(() => {
    return data.rows.reduce(
      (sum, row) => sum + safeNumber(row.totalPrice),
      0
    );
  }, [data.rows]);

  function updateField<K extends keyof WorkInvoiceData>(
    key: K,
    value: WorkInvoiceData[K]
  ) {
    setData((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function updateRow(
    index: number,
    key: keyof InvoiceRow,
    value: string
  ) {
    setData((previous) => {
      const rows = previous.rows.map((row) => ({ ...row }));

      const current = {
        ...rows[index],
        [key]: value,
      };

      if (key === 'qty' || key === 'unitPrice') {
        const qtyText =
          key === 'qty'
            ? value
            : current.qty;

        const priceText =
          key === 'unitPrice'
            ? value
            : current.unitPrice;

        const price = safeNumber(priceText);

        const qty =
          qtyText.trim() === ''
            ? priceText.trim() !== ''
              ? 1
              : 0
            : safeNumber(qtyText);

        current.totalPrice =
          priceText.trim() !== ''
            ? String(qty * price)
            : '';
      }

      rows[index] = current;

      return {
        ...previous,
        rows,
      };
    });
  }

  function createNewInvoice() {
    const ok = window.confirm(
      'هل تريد إنشاء فاتورة عمل جديدة؟'
    );

    if (!ok) return;

    setData({
      ...initialData,
      invoiceNo: String(Date.now()).slice(-6),
      date: new Date().toISOString().slice(0, 10),
      customer: '',
      rows: makeEmptyRows(),
      totalWords: '',
      notes: '',
    });
  }

  function saveInvoice() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
      );

      window.alert('تم حفظ فاتورة العمل');
    } catch (error) {
      console.error(error);

      window.alert('تعذر حفظ الفاتورة');
    }
  }

  async function waitForImages(element: HTMLElement) {
    const images = Array.from(
      element.querySelectorAll('img')
    );

    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }

            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
      )
    );
  }

  /* =========================================================
     CAPTURE A4
  ========================================================= */

  async function captureInvoice() {
    if (!invoiceRef.current) {
      return null;
    }

    const element = invoiceRef.current;

    await waitForImages(element);

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    return await html2canvas(element, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,

      width: A4_WIDTH,
      height: A4_HEIGHT,

      windowWidth: A4_WIDTH,
      windowHeight: A4_HEIGHT,

      scrollX: 0,
      scrollY: 0,
    });
  }

  /* =========================================================
     PDF
  ========================================================= */

  async function createPdf() {
    const canvas = await captureInvoice();

    if (!canvas) return null;

    const image = canvas.toDataURL(
      'image/jpeg',
      0.99
    );

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth =
      pdf.internal.pageSize.getWidth();

    const pageHeight =
      pdf.internal.pageSize.getHeight();

    /*
      الصورة A4 بنفس النسبة،
      لذلك نملأ الورقة تقريباً بالكامل.
    */

    const margin = 1;

    pdf.addImage(
      image,
      'JPEG',
      margin,
      margin,
      pageWidth - margin * 2,
      pageHeight - margin * 2,
      undefined,
      'FAST'
    );

    return pdf;
  }

  async function savePdf() {
    try {
      setBusy(true);

      const pdf = await createPdf();

      if (!pdf) return;

      const fileName =
        `work-invoice-${data.invoiceNo || 'invoice'}.pdf`;

      if (Capacitor.isNativePlatform()) {
        const dataUri =
          pdf.output('datauristring');

        const base64 =
          dataUri.split(',')[1];

        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Documents,
        });

        window.alert('تم حفظ ملف PDF');
      } else {
        pdf.save(fileName);
      }
    } catch (error) {
      console.error(error);

      window.alert('تعذر حفظ ملف PDF');
    } finally {
      setBusy(false);
    }
  }

  async function shareInvoice() {
    try {
      setBusy(true);

      const pdf = await createPdf();

      if (!pdf) return;

      const fileName =
        `work-invoice-${data.invoiceNo || 'invoice'}.pdf`;

      if (Capacitor.isNativePlatform()) {
        const base64 =
          pdf.output('datauristring').split(',')[1];

        const saved =
          await Filesystem.writeFile({
            path: fileName,
            data: base64,
            directory: Directory.Cache,
          });

        await Share.share({
          title: 'فاتورة عمل',
          text: `فاتورة عمل رقم ${data.invoiceNo}`,
          url: saved.uri,
          dialogTitle: 'مشاركة فاتورة العمل',
        });
      } else {
        pdf.save(fileName);
      }
    } catch (error) {
      console.error(error);

      window.alert('تعذر مشاركة الفاتورة');
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

          {/* APP HEADER */}

          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-[#0c1728]"
            >
              <ArrowRight size={22} />
            </button>

            <div className="text-center">
              <h1 className="text-xl font-black">
                فاتورة عمل
              </h1>

              <p className="mt-1 text-xs text-slate-400">
                إنشاء وتعديل ومعاينة الفاتورة
              </p>
            </div>

            <button
              type="button"
              onClick={createNewInvoice}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600"
            >
              <Plus size={23} />
            </button>
          </div>

          {/* ACTIONS */}

          <div className="mb-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-2 py-3 text-xs font-bold"
            >
              <Eye size={17} />
              معاينة
            </button>

            <button
              type="button"
              onClick={saveInvoice}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-2 py-3 text-xs font-bold"
            >
              <Save size={17} />
              حفظ
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={savePdf}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-2 py-3 text-xs font-bold disabled:opacity-50"
            >
              <FileDown size={17} />
              PDF
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={shareInvoice}
              className="flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-2 py-3 text-xs font-bold disabled:opacity-50"
            >
              <Share2 size={17} />
              مشاركة
            </button>

            <button
              type="button"
              onClick={printInvoice}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-700 px-2 py-3 text-xs font-bold"
            >
              <Printer size={17} />
              طباعة
            </button>
          </div>

          {/* FORM */}

          <div className="rounded-[22px] border border-slate-700 bg-[#0a1525] p-3">

            <h2 className="mb-4 text-sm font-black">
              بيانات الفاتورة
            </h2>

            <div className="grid grid-cols-2 gap-2">

              <Field
                label="رقم الفاتورة"
                value={data.invoiceNo}
                onChange={(value) =>
                  updateField('invoiceNo', value)
                }
              />

              <Field
                label="التاريخ"
                type="date"
                value={data.date}
                onChange={(value) =>
                  updateField('date', value)
                }
              />

            </div>

            <Field
              label="اسم العميل"
              value={data.customer}
              placeholder="اكتب اسم العميل"
              onChange={(value) =>
                updateField('customer', value)
              }
            />

            <div className="my-4 border-t border-slate-700" />

            <h3 className="mb-3 text-sm font-black text-violet-300">
              تعديل واجهة الفاتورة
            </h3>

            <div className="grid grid-cols-2 gap-2">

              <Field
                label="كرينات"
                value={data.rightTitle}
                onChange={(value) =>
                  updateField('rightTitle', value)
                }
              />

              <Field
                label="بوم ترك"
                value={data.leftTitle}
                onChange={(value) =>
                  updateField('leftTitle', value)
                }
              />

            </div>

            <Field
              label="اسم المؤسسة بالعربي"
              value={data.companyArabic}
              onChange={(value) =>
                updateField('companyArabic', value)
              }
            />

            <Field
              label="اسم المؤسسة بالإنجليزي"
              value={data.companyEnglish}
              onChange={(value) =>
                updateField('companyEnglish', value)
              }
            />

            <Field
              label="النشاط"
              value={data.activity}
              onChange={(value) =>
                updateField('activity', value)
              }
            />

            <Field
              label="الموقع"
              value={data.location}
              onChange={(value) =>
                updateField('location', value)
              }
            />

            <div className="my-4 border-t border-slate-700" />

            <div className="mb-3 flex items-center justify-between">

              <h3 className="text-sm font-black text-violet-300">
                تفاصيل العمل
              </h3>

              <span className="rounded-full bg-violet-500/10 px-3 py-1 text-[10px] font-bold text-violet-300">
                7 سطور
              </span>

            </div>

            {data.rows.map((row, index) => (
              <div
                key={index}
                className="mb-3 rounded-[18px] border border-slate-700 bg-[#07111f] p-3"
              >

                <div className="mb-3 text-xs font-black text-slate-300">
                  السطر {index + 1}
                </div>

                <Field
                  label="البيان"
                  value={row.description}
                  placeholder="اكتب بيان العمل"
                  onChange={(value) =>
                    updateRow(index, 'description', value)
                  }
                />

                <div className="grid grid-cols-3 gap-2">

                  <MiniField
                    label="الكمية"
                    value={row.qty}
                    onChange={(value) =>
                      updateRow(index, 'qty', value)
                    }
                  />

                  <MiniField
                    label="سعر الوحدة"
                    value={row.unitPrice}
                    onChange={(value) =>
                      updateRow(index, 'unitPrice', value)
                    }
                  />

                  <MiniField
                    label="الإجمالي"
                    value={row.totalPrice}
                    onChange={(value) =>
                      updateRow(index, 'totalPrice', value)
                    }
                  />

                </div>
              </div>
            ))}

            <Field
              label="المبلغ كتابة"
              value={data.totalWords}
              placeholder="مثال: ألف ريال فقط لا غير"
              onChange={(value) =>
                updateField('totalWords', value)
              }
            />

            <Field
              label="ملاحظات"
              value={data.notes}
              placeholder="ملاحظات اختيارية"
              onChange={(value) =>
                updateField('notes', value)
              }
            />

            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-[16px] bg-violet-600 py-3.5 text-sm font-black"
            >
              <Eye size={19} />
              معاينة الفاتورة قبل الحفظ
            </button>
          </div>

          {/* SMALL PREVIEW */}

          <div className="mt-5 overflow-auto rounded-[22px] border border-slate-700 bg-[#0a1525] p-2">

            <div className="mb-2 text-center text-xs font-bold text-slate-400">
              معاينة مصغرة
            </div>

            <InvoiceDocument
              invoiceRef={invoiceRef}
              data={data}
              grandTotal={grandTotal}
            />

          </div>
        </div>

        {/* FULL PREVIEW */}

        {previewOpen && (
          <div className="fixed inset-0 z-[20000] flex flex-col bg-[#020817]">

            <div className="flex items-center justify-between border-b border-white/10 bg-[#07111f] px-3 py-3">

              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5"
              >
                <X size={21} />
              </button>

              <div className="text-center">

                <div className="text-sm font-black">
                  معاينة فاتورة العمل
                </div>

                <div className="text-[10px] text-slate-400">
                  راجع الفاتورة قبل الحفظ
                </div>

              </div>

              <button
                type="button"
                disabled={busy}
                onClick={savePdf}
                className="flex h-10 items-center gap-1 rounded-xl bg-blue-600 px-3 text-xs font-bold disabled:opacity-50"
              >
                <FileDown size={15} />
                PDF
              </button>

            </div>

            <div className="flex-1 overflow-auto p-3">

              <InvoiceDocument
                data={data}
                grandTotal={grandTotal}
              />

            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-white/10 bg-[#07111f] p-3">

              <button
                type="button"
                onClick={saveInvoice}
                className="rounded-xl bg-emerald-600 py-3 text-xs font-black"
              >
                حفظ
              </button>

              <button
                type="button"
                onClick={shareInvoice}
                disabled={busy}
                className="rounded-xl bg-sky-600 py-3 text-xs font-black disabled:opacity-50"
              >
                مشاركة
              </button>

              <button
                type="button"
                onClick={printInvoice}
                className="rounded-xl bg-slate-700 py-3 text-xs font-black"
              >
                طباعة
              </button>

            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

/* =========================================================
   A4 INVOICE
========================================================= */

function InvoiceDocument({
  invoiceRef,
  data,
  grandTotal,
}: {
  invoiceRef?: React.RefObject<HTMLDivElement>;
  data: WorkInvoiceData;
  grandTotal: number;
}) {
  return (
    <div
      ref={invoiceRef}
      dir="ltr"
      className="relative mx-auto overflow-hidden bg-white text-[#292878]"
      style={{
        width: A4_WIDTH,
        minWidth: A4_WIDTH,
        maxWidth: A4_WIDTH,

        height: A4_HEIGHT,
        minHeight: A4_HEIGHT,
        maxHeight: A4_HEIGHT,

        fontFamily:
          'Arial, Tahoma, sans-serif',
      }}
    >

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div
        className="relative h-[265px] overflow-hidden px-6 pt-4"
        style={{
          background: '#292878',
        }}
      >

        {/* FIRST ROW */}

        <div
          className="relative z-30 grid items-start gap-4"
          style={{
            gridTemplateColumns:
              '1fr 2.25fr 1fr',
          }}
        >

          {/* BOOM */}

          <div
            dir="rtl"
            className="flex h-[63px] items-center justify-center rounded-[18px] bg-white px-2 text-center text-[30px] font-black leading-none"
          >
            {data.leftTitle}
          </div>

          {/* COMPANY */}

          <div className="flex h-[72px] flex-col items-center justify-center rounded-[25px] bg-white px-3 text-center">

            <div
              dir="rtl"
              className="flex items-center justify-center gap-2"
            >

              <span className="text-[13px]">
                ●
              </span>

              <span className="whitespace-nowrap text-[32px] font-black leading-none">
                {data.companyArabic}
              </span>

              <span className="text-[13px]">
                ●
              </span>

            </div>

            <div
              dir="ltr"
              className="mt-1 whitespace-nowrap text-[18px] font-black leading-none"
            >
              {data.companyEnglish}
            </div>

          </div>

          {/* CRANES */}

          <div
            dir="rtl"
            className="flex h-[63px] items-center justify-center rounded-[18px] bg-white px-2 text-center text-[30px] font-black leading-none"
          >
            {data.rightTitle}
          </div>

        </div>

        {/* SECOND ROW */}

        <div className="relative z-30 mx-auto mt-3 grid max-w-[620px] grid-cols-2 gap-5">

          <div
            dir="rtl"
            className="flex h-[48px] items-center justify-center rounded-[17px] bg-white px-4 text-center text-[22px] font-black leading-none"
          >
            {data.location}
          </div>

          <div
            dir="rtl"
            className="flex h-[48px] items-center justify-center rounded-[17px] bg-white px-4 text-center text-[22px] font-black leading-none"
          >
            {data.activity}
          </div>

        </div>

        {/* WHITE CURVE */}

        <div
          className="absolute left-[-5%] top-[157px] z-10 h-[170px] w-[110%] rounded-[50%] bg-white"
          style={{
            borderTop:
              '5px solid #292878',
          }}
        />

        {/* =====================================================
            EQUIPMENT - ثابت
        ===================================================== */}

        <img
          src={EQUIPMENT_IMAGE}
          alt="كرين وبوم ترك"
          style={{
            position: 'absolute',

            left: '50%',

            'top: '150px

            'width: '510px 

            height: '170px',

            transform:
              'translateX(-50%)',

            objectFit: 'contain',

            zIndex: 25,
          }}
        />

      </div>

      {/* =====================================================
          BODY
      ===================================================== */}

      <div className="px-6 pb-3 pt-2">

        {/* INVOICE INFO */}

        <div
          className="grid"
          style={{
            gridTemplateColumns:
              '1fr 1.35fr 1fr',
          }}
        >

          {/* LEFT CASH */}

          <div className="text-left">

            <div
              dir="rtl"
              className="text-left text-[23px] font-black leading-tight"
            >
              فاتورة نقداً
            </div>

            <div className="text-[15px] font-bold">
              Cash Invoice
            </div>

            <div className="mt-1 text-[24px] leading-none">
              No
            </div>

            <div className="mt-1 text-[17px] font-black text-black">
              {data.invoiceNo}
            </div>

          </div>

          <div />

          {/* DATE RIGHT */}

          <div className="pt-1 text-right">

            <div
              dir="rtl"
              className="text-right text-[18px] font-black"
            >
              التاريخ
            </div>

            <div
              dir="ltr"
              className="mt-1 text-right text-[17px] font-black text-black"
            >
              {data.date}
            </div>

          </div>

        </div>

        {/* CUSTOMER */}

        <div
          className="mt-2 grid grid-cols-[auto_1fr_auto] items-end gap-3 border-b-2 border-[#292878] pb-1"
        >

          <div className="text-[15px]">
            Mr. / Messrs
          </div>

          <div
            dir="rtl"
            className="min-h-[27px] text-center text-[19px] font-black text-black"
          >
            {data.customer || 'اسم العميل'}
          </div>

          <div
            dir="rtl"
            className="text-[16px] font-black"
          >
            المطلوب من السيد / السادة
          </div>

        </div>

        {/* =====================================================
            TABLE
        ===================================================== */}

        <div
          className="relative mt-3 overflow-hidden rounded-[14px] border-[3px] border-[#292878]"
        >

          {/* HEADER */}

          <div
            className="grid bg-[#f6f6fb]"
            style={{
              gridTemplateColumns:
                '3fr .75fr 1fr .58fr 1fr .58fr',

              gridTemplateRows:
                '38px 27px',
            }}
          >

            <HeaderBox
              style={{
                gridColumn: '1',
                gridRow: '1 / 3',
              }}
            >
              <span
                dir="rtl"
                className="text-[16px]"
              >
                البيان
              </span>

              <small>
                Description
              </small>
            </HeaderBox>

            <HeaderBox
              style={{
                gridColumn: '2',
                gridRow: '1 / 3',
              }}
            >
              <span
                dir="rtl"
                className="text-[14px]"
              >
                الكمية
              </span>

              <small>
                Qty.
              </small>
            </HeaderBox>

            <HeaderBox
              style={{
                gridColumn: '3 / 5',
                gridRow: '1',
              }}
            >
              <span
                dir="rtl"
                className="text-[14px]"
              >
                سعر الوحدة
              </span>

              <small>
                Unit Price
              </small>
            </HeaderBox>

            <HeaderBox
              style={{
                gridColumn: '5 / 7',
                gridRow: '1',
              }}
            >
              <span
                dir="rtl"
                className="text-[14px]"
              >
                السعر الإجمالي
              </span>

              <small>
                Total Price
              </small>
            </HeaderBox>

            <HeaderBox
              style={{
                gridColumn: '3',
                gridRow: '2',
              }}
            >
              <small>
                S.R. ريال
              </small>
            </HeaderBox>

            <HeaderBox
              style={{
                gridColumn: '4',
                gridRow: '2',
              }}
            >
              <small>
                H. هـ
              </small>
            </HeaderBox>

            <HeaderBox
              style={{
                gridColumn: '5',
                gridRow: '2',
              }}
            >
              <small>
                S.R. ريال
              </small>
            </HeaderBox>

            <HeaderBox
              style={{
                gridColumn: '6',
                gridRow: '2',
              }}
            >
              <small>
                H. هـ
              </small>
            </HeaderBox>

          </div>

          {/* WATERMARK */}

          <img
            src={EQUIPMENT_IMAGE}
            alt=""
            className="pointer-events-none absolute left-1/2 top-[53%] z-0 w-[390px] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.035]"
          />

          {/* EXACTLY 7 ROWS */}

          {data.rows.map((row, index) => (
            <div
              key={index}
              className="relative z-10 grid h-[57px] border-t border-dotted border-slate-400"
              style={{
                gridTemplateColumns:
                  '3fr .75fr 1fr .58fr 1fr .58fr',
              }}
            >

              <InvoiceCell>
                <span dir="rtl">
                  {row.description}
                </span>
              </InvoiceCell>

              <InvoiceCell>
                <span dir="ltr">
                  {row.qty}
                </span>
              </InvoiceCell>

              <InvoiceCell>
                <span dir="ltr">
                  {row.unitPrice}
                </span>
              </InvoiceCell>

              <InvoiceCell>
                -
              </InvoiceCell>

              <InvoiceCell>
                <span dir="ltr">
                  {row.totalPrice}
                </span>
              </InvoiceCell>

              <InvoiceCell last>
                -
              </InvoiceCell>

            </div>
          ))}

          {/* TOTAL */}

          <div
            className="relative z-20 grid h-[55px] border-t-[3px] border-[#292878] bg-white"
            style={{
              gridTemplateColumns:
                '1.05fr 2.7fr 1.05fr',
            }}
          >

            <div className="flex items-center justify-center border-r-2 border-[#292878] px-2 text-[14px] font-black">
              Total S.R.
            </div>

            <div
              dir="rtl"
              className="flex items-center justify-center border-r-2 border-[#292878] px-3 text-center text-[15px] font-black text-black"
            >
              المجموع :{' '}
              {data.totalWords || 'فقط لا غير'}
            </div>

            <div
              dir="ltr"
              className="flex items-center justify-center px-2 text-[25px] font-black text-black"
            >
              {grandTotal.toLocaleString('en-US')}
            </div>

          </div>
        </div>

        {/* =====================================================
            SIGNATURES
        ===================================================== */}

        <div
          className="grid grid-cols-2 gap-24 px-16 py-3"
        >

          {/* LEFT */}

          <div className="text-center">

            <div
              dir="rtl"
              className="text-[16px] font-black"
            >
              توقيع المستلم
            </div>

            <div className="text-[12px] font-bold">
              Received
            </div>

            <div className="mx-auto mt-4 w-[125px] border-b-2 border-dotted border-slate-400" />

          </div>

          {/* RIGHT */}

          <div className="text-center">

            <div
              dir="rtl"
              className="text-[16px] font-black"
            >
              توقيع البائع
            </div>

            <div className="text-[12px] font-bold">
              Salesman Sig.
            </div>

            <div className="mx-auto mt-4 w-[125px] border-b-2 border-dotted border-slate-400" />

          </div>

        </div>

        {/* NOTES */}

        {data.notes && (
          <div
            dir="rtl"
            className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-center text-[12px] font-bold text-black"
          >
            {data.notes}
          </div>
        )}

        {/* FOOTER */}

        <div className="flex items-center justify-center gap-3 pt-1">

          <div className="h-px w-[145px] bg-[#292878]" />

          <div className="h-[7px] w-[7px] rounded-full bg-[#292878]" />

          <div
            dir="rtl"
            className="text-[17px] font-black"
          >
            شكراً لتعاملكم معنا
          </div>

          <div className="h-[7px] w-[7px] rounded-full bg-[#292878]" />

          <div className="h-px w-[145px] bg-[#292878]" />

        </div>

        <div
          dir="ltr"
          className="mt-2 text-[10px] font-bold text-black"
        >
          1/1
        </div>

      </div>
    </div>
  );
}

/* =========================================================
   FORM FIELD
========================================================= */

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

      <span className="mb-1.5 block text-[11px] font-bold text-slate-400">
        {label}
      </span>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-xl border border-slate-700 bg-[#07111f] px-3 py-3 text-sm text-white outline-none transition-colors focus:border-violet-500"
      />

    </label>
  );
}

/* =========================================================
   MINI FIELD
========================================================= */

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

      <span className="mb-1.5 block text-[10px] font-bold text-slate-400">
        {label}
      </span>

      <input
        inputMode="decimal"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-lg border border-slate-700 bg-[#0a1525] px-2 py-2.5 text-center text-xs font-bold text-white outline-none focus:border-violet-500"
      />

    </label>
  );
}

/* =========================================================
   TABLE HEADER
========================================================= */

function HeaderBox({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className="flex flex-col items-center justify-center border-b border-r-2 border-[#292878] px-1 text-center text-[13px] font-black"
    >
      {children}
    </div>
  );
}

/* =========================================================
   TABLE CELL
========================================================= */

function InvoiceCell({
  children,
  last = false,
}: {
  children?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-center px-2 text-center text-[15px] font-bold text-black ${
        last
          ? ''
          : 'border-r-2 border-[#292878]'
      }`}
    >
      {children}
    </div>
  );
      }
