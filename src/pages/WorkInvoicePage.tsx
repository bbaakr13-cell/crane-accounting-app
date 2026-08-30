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
import {
  Directory,
  Filesystem,
} from '@capacitor/filesystem';

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

const today = new Date()
  .toISOString()
  .slice(0, 10);

function makeEmptyRows(): InvoiceRow[] {
  return Array.from(
    { length: 7 },
    () => ({
      description: '',
      qty: '',
      unitPrice: '',
      totalPrice: '',
    })
  );
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
  const n = Number(value);

  return Number.isFinite(n) ? n : 0;
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

      rows: Array.from(
        { length: 7 },
        (_, index) => ({
          description:
            parsed?.rows?.[index]?.description ?? '',

          qty:
            parsed?.rows?.[index]?.qty ?? '',

          unitPrice:
            parsed?.rows?.[index]?.unitPrice ?? '',

          totalPrice:
            parsed?.rows?.[index]?.totalPrice ?? '',
        })
      ),
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

  const invoiceRef =
    useRef<HTMLDivElement>(null);

  const [data, setData] =
    useState<WorkInvoiceData>(
      () => loadInvoice()
    );

  const [busy, setBusy] =
    useState(false);

  const [previewOpen, setPreviewOpen] =
    useState(false);

  /* =======================================================
     TOTAL
  ======================================================= */

  const grandTotal = useMemo(() => {
    return data.rows.reduce(
      (sum, row) =>
        sum + safeNumber(row.totalPrice),
      0
    );
  }, [data.rows]);

  /* =======================================================
     UPDATE FIELD
  ======================================================= */

  function updateField<
    K extends keyof WorkInvoiceData
  >(
    key: K,
    value: WorkInvoiceData[K]
  ) {
    setData((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  /* =======================================================
     UPDATE ROW
  ======================================================= */

  function updateRow(
    index: number,
    key: keyof InvoiceRow,
    value: string
  ) {
    setData((previous) => {
      const rows = previous.rows.map(
        (row) => ({
          ...row,
        })
      );

      const current = {
        ...rows[index],
        [key]: value,
      };

      if (
        key === 'qty' ||
        key === 'unitPrice'
      ) {
        const qty =
          key === 'qty'
            ? safeNumber(value)
            : safeNumber(current.qty);

        const unitPrice =
          key === 'unitPrice'
            ? safeNumber(value)
            : safeNumber(current.unitPrice);

        if (
          current.qty ||
          current.unitPrice
        ) {
          current.totalPrice =
            String(qty * unitPrice);
        } else {
          current.totalPrice = '';
        }
      }

      rows[index] = current;

      return {
        ...previous,
        rows,
      };
    });
  }

  /* =======================================================
     NEW INVOICE
  ======================================================= */

  function createNewInvoice() {
    const ok = window.confirm(
      'هل تريد إنشاء فاتورة عمل جديدة؟'
    );

    if (!ok) {
      return;
    }

    setData({
      ...initialData,

      invoiceNo:
        String(Date.now()).slice(-6),

      date:
        new Date()
          .toISOString()
          .slice(0, 10),

      customer: '',

      rows: makeEmptyRows(),

      totalWords: '',
      notes: '',
    });
  }

  /* =======================================================
     SAVE
  ======================================================= */

  function saveInvoice() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
      );

      window.alert(
        'تم حفظ فاتورة العمل'
      );
    } catch (error) {
      console.error(error);

      window.alert(
        'تعذر حفظ الفاتورة'
      );
    }
  }

  /* =======================================================
     CAPTURE INVOICE
  ======================================================= */

  async function captureInvoice() {
    if (!invoiceRef.current) {
      return null;
    }

    const element = invoiceRef.current;

    const oldWidth = element.style.width;
    const oldMinWidth =
      element.style.minWidth;
    const oldMaxWidth =
      element.style.maxWidth;

    try {
      element.style.width = '794px';
      element.style.minWidth = '794px';
      element.style.maxWidth = '794px';

      await new Promise<void>(
        (resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve();
            });
          });
        }
      );

      const canvas =
        await html2canvas(
          element,
          {
            scale: 2,

            backgroundColor:
              '#ffffff',

            useCORS: true,

            logging: false,

            width: 794,
            windowWidth: 794,

            scrollX: 0,
            scrollY: 0,
          }
        );

      return canvas;
    } finally {
      element.style.width = oldWidth;

      element.style.minWidth =
        oldMinWidth;

      element.style.maxWidth =
        oldMaxWidth;
    }
  }

  /* =======================================================
     CREATE PDF
  ======================================================= */

  async function createPdf() {
    const canvas =
      await captureInvoice();

    if (!canvas) {
      return null;
    }

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
        compress: true,
      });

    const pageWidth =
      pdf.internal.pageSize.getWidth();

    const pageHeight =
      pdf.internal.pageSize.getHeight();

    const marginX = 4;
    const marginY = 4;

    const maxWidth =
      pageWidth - marginX * 2;

    const maxHeight =
      pageHeight - marginY * 2;

    const ratio =
      canvas.width / canvas.height;

    let width = maxWidth;

    let height =
      width / ratio;

    if (height > maxHeight) {
      height = maxHeight;

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
      height,
      undefined,
      'FAST'
    );

    return pdf;
  }

  /* =======================================================
     SAVE PDF
  ======================================================= */

  async function savePdf() {
    try {
      setBusy(true);

      const pdf =
        await createPdf();

      if (!pdf) {
        return;
      }

      const fileName =
        `work-invoice-${
          data.invoiceNo ||
          'invoice'
        }.pdf`;

      if (
        Capacitor.isNativePlatform()
      ) {
        const dataUri =
          pdf.output(
            'datauristring'
          );

        const base64 =
          dataUri.split(',')[1];

        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory:
            Directory.Documents,
        });

        window.alert(
          'تم حفظ ملف PDF'
        );
      } else {
        pdf.save(fileName);
      }
    } catch (error) {
      console.error(error);

      window.alert(
        'تعذر حفظ ملف PDF'
      );
    } finally {
      setBusy(false);
    }
  }

  /* =======================================================
     SHARE
  ======================================================= */

  async function shareInvoice() {
    try {
      setBusy(true);

      const pdf =
        await createPdf();

      if (!pdf) {
        return;
      }

      const fileName =
        `work-invoice-${
          data.invoiceNo ||
          'invoice'
        }.pdf`;

      if (
        Capacitor.isNativePlatform()
      ) {
        const base64 =
          pdf
            .output(
              'datauristring'
            )
            .split(',')[1];

        const saved =
          await Filesystem.writeFile({
            path: fileName,
            data: base64,
            directory:
              Directory.Cache,
          });

        await Share.share({
          title: 'فاتورة عمل',

          text:
            `فاتورة عمل رقم ${data.invoiceNo}`,

          url: saved.uri,

          dialogTitle:
            'مشاركة فاتورة العمل',
        });
      } else {
        pdf.save(fileName);
      }
    } catch (error) {
      console.error(error);

      window.alert(
        'تعذر مشاركة الفاتورة'
      );
    } finally {
      setBusy(false);
    }
  }

  /* =======================================================
     PRINT
  ======================================================= */

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

          {/* PAGE HEADER */}

          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                navigate(-1)
              }
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-[#0c1728]"
            >
              <ArrowRight size={22} />
            </button>

            <div className="text-center">
              <h1 className="text-xl font-black">
                فاتورة عمل
              </h1>

              <p className="mt-1 text-xs text-slate-400">
                إنشاء وتعديل ومعاينة
                الفاتورة
              </p>
            </div>

            <button
              type="button"
              onClick={
                createNewInvoice
              }
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600"
            >
              <Plus size={23} />
            </button>
          </div>

          {/* BUTTONS */}

          <div className="mb-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() =>
                setPreviewOpen(true)
              }
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

          {/* EDIT FORM */}

          <div className="rounded-[22px] border border-slate-700 bg-[#0a1525] p-3">

            <h2 className="mb-4 text-sm font-black text-white">
              بيانات الفاتورة
            </h2>

            <div className="grid grid-cols-2 gap-2">
              <Field
                label="رقم الفاتورة"
                value={data.invoiceNo}
                onChange={(value) =>
                  updateField(
                    'invoiceNo',
                    value
                  )
                }
              />

              <Field
                label="التاريخ"
                type="date"
                value={data.date}
                onChange={(value) =>
                  updateField(
                    'date',
                    value
                  )
                }
              />
            </div>

            <Field
              label="اسم العميل"
              value={data.customer}
              placeholder="اكتب اسم العميل"
              onChange={(value) =>
                updateField(
                  'customer',
                  value
                )
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
                  updateField(
                    'rightTitle',
                    value
                  )
                }
              />

              <Field
                label="بوم ترك"
                value={data.leftTitle}
                onChange={(value) =>
                  updateField(
                    'leftTitle',
                    value
                  )
                }
              />
            </div>

            <Field
              label="اسم المؤسسة بالعربي"
              value={
                data.companyArabic
              }
              onChange={(value) =>
                updateField(
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
              onChange={(value) =>
                updateField(
                  'companyEnglish',
                  value
                )
              }
            />

            <Field
              label="النشاط"
              value={data.activity}
              onChange={(value) =>
                updateField(
                  'activity',
                  value
                )
              }
            />

            <Field
              label="الموقع"
              value={data.location}
              onChange={(value) =>
                updateField(
                  'location',
                  value
                )
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

            {data.rows.map(
              (row, index) => (
                <div
                  key={index}
                  className="mb-3 rounded-[18px] border border-slate-700 bg-[#07111f] p-3"
                >
                  <div className="mb-3 text-xs font-black text-slate-300">
                    السطر {index + 1}
                  </div>

                  <Field
                    label="البيان"
                    value={
                      row.description
                    }
                    placeholder="اكتب بيان العمل"
                    onChange={(value) =>
                      updateRow(
                        index,
                        'description',
                        value
                      )
                    }
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <MiniField
                      label="الكمية"
                      value={row.qty}
                      onChange={(value) =>
                        updateRow(
                          index,
                          'qty',
                          value
                        )
                      }
                    />

                    <MiniField
                      label="سعر الوحدة"
                      value={
                        row.unitPrice
                      }
                      onChange={(value) =>
                        updateRow(
                          index,
                          'unitPrice',
                          value
                        )
                      }
                    />

                    <MiniField
                      label="الإجمالي"
                      value={
                        row.totalPrice
                      }
                      onChange={(value) =>
                        updateRow(
                          index,
                          'totalPrice',
                          value
                        )
                      }
                    />
                  </div>
                </div>
              )
            )}

            <Field
              label="المبلغ كتابة"
              value={data.totalWords}
              placeholder="مثال: ثمانية عشر ألف ريال فقط لا غير"
              onChange={(value) =>
                updateField(
                  'totalWords',
                  value
                )
              }
            />

            <Field
              label="ملاحظات"
              value={data.notes}
              placeholder="ملاحظات اختيارية"
              onChange={(value) =>
                updateField(
                  'notes',
                  value
                )
              }
            />

            <button
              type="button"
              onClick={() =>
                setPreviewOpen(true)
              }
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
                onClick={() =>
                  setPreviewOpen(false)
                }
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
   INVOICE DOCUMENT
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
      className="mx-auto w-[794px] min-w-[794px] overflow-hidden bg-white text-[#25256f]"
      style={{
        minHeight: 1123,
        fontFamily:
          'Arial, Tahoma, sans-serif',
      }}
    >
      {/* HEADER */}

      <div
        className="relative overflow-hidden px-6 pb-7 pt-5"
        style={{
          background: '#292878',
        }}
      >
        {/* TOP ROW */}

        <div
          className="grid items-start gap-4"
          style={{
            gridTemplateColumns:
              '1fr 2.15fr 1fr',
          }}
        >
          {/* LEFT - BOOM TRUCK */}

          <div className="flex justify-center pt-1">
            <div
              dir="rtl"
              className="flex min-h-[58px] w-full items-center justify-center rounded-[17px] bg-white px-3 text-center text-[27px] font-black"
              style={{
                color: '#292878',
              }}
            >
              {data.leftTitle}
            </div>
          </div>

          {/* CENTER */}

          <div
            className="rounded-[27px] bg-white px-5 py-2 text-center"
            style={{
              color: '#292878',
            }}
          >
            <div
              dir="rtl"
              className="flex items-center justify-center gap-3"
            >
              <span className="text-[23px]">
                ✦
              </span>

              <span className="text-[30px] font-black leading-none">
                {data.companyArabic}
              </span>

              <span className="text-[23px]">
                ✦
              </span>
            </div>

            <div
              dir="ltr"
              className="mt-1 text-[17px] font-black tracking-[0.05em]"
            >
              {data.companyEnglish}
            </div>
          </div>

          {/* RIGHT - CRANES */}

          <div className="flex justify-center pt-1">
            <div
              dir="rtl"
              className="flex min-h-[58px] w-full items-center justify-center rounded-[17px] bg-white px-3 text-center text-[27px] font-black"
              style={{
                color: '#292878',
              }}
            >
              {data.rightTitle}
            </div>
          </div>
        </div>

        {/* SECOND ROW */}

        <div className="mx-auto mt-4 grid max-w-[570px] grid-cols-2 gap-5">
          <div
            dir="rtl"
            className="rounded-[18px] bg-white px-4 py-2 text-center text-[21px] font-black"
            style={{
              color: '#292878',
            }}
          >
            {data.location}
          </div>

          <div
            dir="rtl"
            className="rounded-[18px] bg-white px-4 py-2 text-center text-[21px] font-black"
            style={{
              color: '#292878',
            }}
          >
            {data.activity}
          </div>
        </div>

        {/* CRANE + BOOM TRUCK DRAWING */}

        <EquipmentArtwork />

        {/* CURVE */}

        <div
          className="absolute -bottom-[63px] left-[-5%] h-[92px] w-[110%] rounded-[50%] bg-white"
          style={{
            borderTop:
              '5px solid #292878',
          }}
        />
      </div>

      {/* BODY */}

      <div className="px-7 pb-5 pt-6">

        {/* CASH LEFT / DATE RIGHT */}

        <div
          dir="ltr"
          className="grid items-start gap-4"
          style={{
            gridTemplateColumns:
              '1fr 1.35fr 1fr',
          }}
        >
          {/* LEFT */}

          <div className="text-left">
            <div
              dir="rtl"
              className="text-left text-[25px] font-black"
            >
              فاتورة نقداً
            </div>

            <div
              dir="ltr"
              className="text-[17px] font-bold"
            >
              Cash Invoice
            </div>

            <div
              dir="ltr"
              className="mt-5 text-[28px]"
            >
              No
            </div>

            <div
              dir="ltr"
              className="mt-1 text-[18px] font-black"
            >
              {data.invoiceNo}
            </div>
          </div>

          <div />

          {/* RIGHT DATE */}

          <div className="pt-2 text-right">
            <div
              dir="rtl"
              className="text-right text-[19px] font-black"
            >
              التاريخ
            </div>

            <div
              dir="ltr"
              className="mt-2 text-right text-[18px] font-black"
            >
              {data.date}
            </div>
          </div>
        </div>

        {/* CUSTOMER */}

        <div
          dir="ltr"
          className="mt-3 grid grid-cols-[auto_1fr_auto] items-end gap-3 border-b-2 border-[#292878] pb-2"
        >
          <div
            dir="ltr"
            className="text-[17px]"
          >
            Mr. / Messrs
          </div>

          <div
            dir="rtl"
            className="min-h-[34px] text-center text-[22px] font-black text-black"
          >
            {data.customer ||
              'اسم العميل'}
          </div>

          <div
            dir="rtl"
            className="text-[18px] font-black"
          >
            المطلوب من السيد / السادة
          </div>
        </div>

        {/* TABLE */}

        <div
          dir="ltr"
          className="mt-5 overflow-hidden rounded-[17px] border-[3px] border-[#292878]"
        >
          {/* HEADER */}

          <div
            className="grid bg-[#f5f5fb]"
            style={{
              gridTemplateColumns:
                '2.35fr .75fr 1.15fr 1.15fr',
            }}
          >
            <InvoiceHeaderCell>
              <span dir="rtl">
                البيان
              </span>

              <small dir="ltr">
                Description
              </small>
            </InvoiceHeaderCell>

            <InvoiceHeaderCell>
              <span dir="rtl">
                الكمية
              </span>

              <small dir="ltr">
                Qty.
              </small>
            </InvoiceHeaderCell>

            <InvoiceHeaderCell>
              <span dir="rtl">
                سعر الوحدة
              </span>

              <small dir="ltr">
                Unit Price
              </small>
            </InvoiceHeaderCell>

            <InvoiceHeaderCell>
              <span dir="rtl">
                السعر الإجمالي
              </span>

              <small dir="ltr">
                Total Price
              </small>
            </InvoiceHeaderCell>
          </div>

          {/* EXACTLY 7 ROWS */}

          {data.rows.map(
            (row, index) => (
              <div
                key={index}
                dir="ltr"
                className="grid min-h-[74px] border-t border-dotted border-slate-400"
                style={{
                  gridTemplateColumns:
                    '2.35fr .75fr 1.15fr 1.15fr',
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
                  <span dir="ltr">
                    {row.totalPrice}
                  </span>
                </InvoiceCell>
              </div>
            )
          )}

          {/* TOTAL */}

          <div
            dir="ltr"
            className="grid border-t-[3px] border-[#292878]"
            style={{
              gridTemplateColumns:
                '1fr 2.25fr .8fr 1fr',
            }}
          >
            <div
              dir="ltr"
              className="flex min-h-[62px] items-center justify-center px-2 text-[15px] font-black"
            >
              Total S.R.
            </div>

            <div
              dir="rtl"
              className="flex items-center justify-center border-l-2 border-[#292878] px-3 text-center text-[17px] font-black text-black"
            >
              {data.totalWords ||
                'فقط لا غير'}
            </div>

            <div
              dir="rtl"
              className="flex items-center justify-center border-l-2 border-[#292878] px-2 text-[16px] font-black"
            >
              المجموع
            </div>

            <div
              dir="ltr"
              className="flex items-center justify-center border-l-2 border-[#292878] px-2 text-[27px] font-black text-black"
            >
              {grandTotal.toLocaleString(
                'en-US'
              )}
            </div>
          </div>
        </div>

        {/* SIGNATURE */}

        <div
          dir="ltr"
          className="grid grid-cols-2 gap-20 px-16 py-6"
        >
          {/* LEFT RECEIVED */}

          <div className="text-center">
            <div
              dir="rtl"
              className="text-[17px] font-black"
            >
              توقيع المستلم
            </div>

            <div
              dir="ltr"
              className="text-[13px] font-bold"
            >
              Received
            </div>

            <div className="mx-auto mt-7 w-[120px] border-b-2 border-dotted border-slate-400" />
          </div>

          {/* RIGHT SALESMAN */}

          <div className="text-center">
            <div
              dir="rtl"
              className="text-[17px] font-black"
            >
              توقيع البائع
            </div>

            <div
              dir="ltr"
              className="text-[13px] font-bold"
            >
              Salesman Sig.
            </div>

            <div className="mx-auto mt-7 w-[120px] border-b-2 border-dotted border-slate-400" />
          </div>
        </div>

        {/* NOTES */}

        {data.notes && (
          <div
            dir="rtl"
            className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center text-[13px] font-bold text-black"
          >
            {data.notes}
          </div>
        )}

        {/* THANKS */}

        <div className="border-t border-slate-200 pt-3 text-center">
          <div
            dir="rtl"
            className="text-[17px] font-black"
          >
            شكراً لتعاملكم معنا
          </div>

          <div
            dir="ltr"
            className="mt-1 text-[13px] font-bold"
          >
            Thank you for dealing with us
          </div>
        </div>

        <div
          dir="ltr"
          className="mt-2 text-[11px] font-bold text-black"
        >
          1/1
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   EQUIPMENT ARTWORK
========================================================= */

function EquipmentArtwork() {
  return (
    <div className="relative mx-auto mt-2 h-[118px] w-[520px]">

      <svg
        viewBox="0 0 520 118"
        className="h-full w-full"
        aria-hidden="true"
      >
        {/* BOOM TRUCK - LEFT */}

        <g
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* truck chassis */}
          <path d="M34 91 H180" />

          {/* truck body */}
          <path d="M48 68 H127 L145 89 H48 Z" />

          {/* cabin */}
          <path d="M48 68 L62 48 H94 L110 68" />

          {/* window */}
          <path d="M64 52 H88 L98 66 H57 Z" />

          {/* rear body */}
          <path d="M112 67 H154 V88 H143" />

          {/* wheels */}
          <circle
            cx="72"
            cy="92"
            r="10"
          />

          <circle
            cx="136"
            cy="92"
            r="10"
          />

          {/* boom base */}
          <path d="M127 65 L147 54" />

          {/* boom */}
          <path d="M143 57 L310 15" />

          <path d="M147 63 L313 21" />

          {/* hook line */}
          <path d="M310 18 V46" />

          <path d="M310 46 q0 10 8 10" />
        </g>

        {/* CRANE - RIGHT */}

        <g
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* crane lower chassis */}
          <path d="M332 90 H491" />

          {/* crane body */}
          <path d="M352 66 H438 L458 89 H347 Z" />

          {/* cabin */}
          <path d="M402 49 H434 L447 66 H397 Z" />

          {/* window */}
          <path d="M407 53 H430 L439 64 H401 Z" />

          {/* wheels */}
          <circle
            cx="371"
            cy="92"
            r="10"
          />

          <circle
            cx="419"
            cy="92"
            r="10"
          />

          <circle
            cx="459"
            cy="92"
            r="10"
          />

          {/* rotating base */}
          <path d="M350 65 L368 53 H393" />

          {/* main boom */}
          <path d="M371 53 L243 14" />

          <path d="M375 58 L241 20" />

          {/* boom tip */}
          <path d="M242 16 L229 14" />

          {/* hook */}
          <path d="M232 16 V49" />

          <path d="M232 49 q0 9 -8 9" />
        </g>

        {/* small center decorative line */}
        <g
          stroke="white"
          strokeWidth="1.5"
          opacity="0.45"
        >
          <path d="M190 105 H330" />
        </g>
      </svg>
    </div>
  );
}

/* =========================================================
   FIELD
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

  onChange:
    (value: string) => void;

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
          onChange(
            event.target.value
          )
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

  onChange:
    (value: string) => void;
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
          onChange(
            event.target.value
          )
        }
        className="w-full rounded-lg border border-slate-700 bg-[#0a1525] px-2 py-2.5 text-center text-xs font-bold text-white outline-none focus:border-violet-500"
      />
    </label>
  );
}

/* =========================================================
   TABLE HEADER CELL
========================================================= */

function InvoiceHeaderCell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[72px] flex-col items-center justify-center border-r-2 border-[#292878] px-2 text-center text-[17px] font-black first:border-r-0">
      {children}
    </div>
  );
}

/* =========================================================
   TABLE CELL
========================================================= */

function InvoiceCell({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-center border-r-2 border-[#292878] px-2 text-center text-[16px] font-bold text-black first:border-r-0">
      {children}
    </div>
  );
                  }
