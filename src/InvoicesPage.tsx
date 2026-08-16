import React, { useMemo, useRef, useState } from 'react';
import {
  Edit3,
  FileDown,
  MessageCircle,
  Printer,
  Save,
  Share2,
  Truck,
  X,
  Check,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

type Item = {
  description: string;
  qty: number;
  unitPrice: number;
};

type InvoiceData = {
  invoiceNo: string;
  date: string;
  customer: string;

  companyArabic: string;
  companyEnglish: string;
  activity: string;
  location: string;

  invoiceType: string;
  notes: string;
  paid: boolean;

  items: Item[];
};

const STORAGE_KEY = 'professional-crane-invoice-v1';

const initialData: InvoiceData = {
  invoiceNo: '00125',
  date: new Date().toISOString().slice(0, 10),

  customer: 'اسم العميل',

  companyArabic: 'رافعات الحديثة لتأجير المعدات الثقيلة',
  companyEnglish: 'RAFIEAT AL-HADITHA FOR HEAVY EQUIPMENT RENTAL',

  activity: 'لتأجير المعدات الثقيلة',
  location: 'خميس مشيط - أبها',

  invoiceType: 'نقداً',

  notes: 'يشمل السعر أجرة المعدات والسائق\nغير شامل ضريبة القيمة المضافة',

  paid: true,

  items: [
    { description: 'تركيب برج', qty: 1, unitPrice: 0 },
    { description: 'شغل في هناجر', qty: 1, unitPrice: 0 },
    { description: 'تحميل حديد', qty: 1, unitPrice: 0 },
    { description: 'رفع خشب', qty: 1, unitPrice: 0 },
    { description: '', qty: 1, unitPrice: 0 },
    { description: '', qty: 1, unitPrice: 0 },
    { description: '', qty: 1, unitPrice: 0 },
  ],
};

function loadInvoice(): InvoiceData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return initialData;

    const parsed = JSON.parse(saved);

    return {
      ...initialData,
      ...parsed,
      items:
        Array.isArray(parsed.items) && parsed.items.length === 7
          ? parsed.items
          : initialData.items,
    };
  } catch {
    return initialData;
  }
}

/* تحويل المبلغ إلى حروف عربية */

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

function under1000(num: number): string {
  const parts: string[] = [];

  const h = Math.floor(num / 100);
  const rest = num % 100;

  if (h) parts.push(hundreds[h]);

  if (rest) {
    if (rest < 20) {
      parts.push(ones[rest]);
    } else {
      const u = rest % 10;
      const t = Math.floor(rest / 10);

      if (u) {
        parts.push(`${ones[u]} و${tens[t]}`);
      } else {
        parts.push(tens[t]);
      }
    }
  }

  return parts.join(' و');
}

function numberToArabicWords(value: number): string {
  const num = Math.round(value);

  if (num === 0) return 'صفر ريال لا غير';

  const parts: string[] = [];

  const millions = Math.floor(num / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const rest = num % 1000;

  if (millions) {
    if (millions === 1) {
      parts.push('مليون');
    } else if (millions === 2) {
      parts.push('مليونان');
    } else {
      parts.push(`${under1000(millions)} مليون`);
    }
  }

  if (thousands) {
    if (thousands === 1) {
      parts.push('ألف');
    } else if (thousands === 2) {
      parts.push('ألفان');
    } else if (thousands >= 3 && thousands <= 10) {
      parts.push(`${under1000(thousands)} آلاف`);
    } else {
      parts.push(`${under1000(thousands)} ألف`);
    }
  }

  if (rest) {
    parts.push(under1000(rest));
  }

  return `${parts.join(' و')} ريال لا غير`;
}

export function InvoicesPage() {
  const invoiceRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<InvoiceData>(() => loadInvoice());

  const [editing, setEditing] = useState<
    'company' | 'customer' | 'invoice' | 'items' | 'notes' | null
  >(null);

  const total = useMemo(() => {
    return data.items.reduce(
      (sum, item) =>
        sum + Number(item.qty || 0) * Number(item.unitPrice || 0),
      0
    );
  }, [data.items]);

  const totalWords = useMemo(
    () => numberToArabicWords(total),
    [total]
  );

  function updateData<K extends keyof InvoiceData>(
    key: K,
    value: InvoiceData[K]
  ) {
    setData((old) => ({
      ...old,
      [key]: value,
    }));
  }

  function updateItem(
    index: number,
    key: keyof Item,
    value: string | number
  ) {
    setData((old) => {
      const items = [...old.items];

      items[index] = {
        ...items[index],
        [key]: value,
      };

      return {
        ...old,
        items,
      };
    });
  }

  function saveInvoice() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setEditing(null);
    alert('تم حفظ الفاتورة');
  }

  async function createPdf() {
    if (!invoiceRef.current) {
      throw new Error('Invoice not found');
    }

    const canvas = await html2canvas(invoiceRef.current, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
    });

    const image = canvas.toDataURL('image/jpeg', 0.95);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const margin = 4;

    const width = pageWidth - margin * 2;

    const height =
      (canvas.height * width) / canvas.width;

    const finalHeight = Math.min(
      height,
      pageHeight - margin * 2
    );

    pdf.addImage(
      image,
      'JPEG',
      margin,
      margin,
      width,
      finalHeight,
      undefined,
      'FAST'
    );

    return pdf;
  }

  async function savePdf() {
    try {
      const pdf = await createPdf();

      const fileName =
        `invoice-${data.invoiceNo || Date.now()}.pdf`;

      if (Capacitor.isNativePlatform()) {
        const base64 =
          pdf.output('datauristring').split(',')[1];

        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Documents,
        });

        alert(`تم حفظ PDF\n${fileName}`);
      } else {
        pdf.save(fileName);
      }
    } catch (error) {
      console.error(error);
      alert('تعذر حفظ PDF');
    }
  }

  async function sharePdf() {
    try {
      const pdf = await createPdf();

      const fileName =
        `invoice-${data.invoiceNo || Date.now()}.pdf`;

      if (Capacitor.isNativePlatform()) {
        const base64 =
          pdf.output('datauristring').split(',')[1];

        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });

        await Share.share({
          title: `فاتورة ${data.invoiceNo}`,
          text: `فاتورة ${data.companyArabic}`,
          url: result.uri,
          dialogTitle: 'مشاركة الفاتورة',
        });
      } else {
        pdf.save(fileName);
      }
    } catch (error) {
      console.error(error);
      alert('تعذر مشاركة الفاتورة');
    }
  }

  function openWhatsApp() {
    const text = [
      `فاتورة رقم: ${data.invoiceNo}`,
      `العميل: ${data.customer}`,
      `المجموع: ${total.toLocaleString()} ريال`,
      data.companyArabic,
    ].join('\n');

    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank'
    );
  }

  function printInvoice() {
    if (!invoiceRef.current) return;

    const win = window.open('', '_blank');

    if (!win) {
      alert('تعذر فتح نافذة الطباعة');
      return;
    }

    win.document.write(`
      <!doctype html>
      <html dir="rtl">
        <head>
          <meta charset="UTF-8" />
          <title>فاتورة ${data.invoiceNo}</title>

          <style>
            body {
              margin: 0;
              background: white;
              font-family: Arial, Tahoma, sans-serif;
            }

            * {
              box-sizing: border-box;
            }

            @page {
              size: A4;
              margin: 5mm;
            }

            .no-print {
              display: none !important;
            }
          </style>
        </head>

        <body>
          ${invoiceRef.current.outerHTML}
        </body>
      </html>
    `);

    win.document.close();

    setTimeout(() => {
      win.print();
    }, 400);
  }

  const editButton = (
    section:
      | 'company'
      | 'customer'
      | 'invoice'
      | 'items'
      | 'notes'
  ) => (
    <button
      className="no-print"
      onClick={() =>
        setEditing(editing === section ? null : section)
      }
      style={smallEditButton}
    >
      <Edit3 size={13} />
      تعديل
    </button>
  );

  return (
    <AppLayout>
      <div
        dir="rtl"
        style={{
          padding: 12,
          maxWidth: 900,
          margin: '0 auto',
        }}
      >
        {/* أزرار التحكم */}

        <div
          className="no-print"
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          <button
            onClick={saveInvoice}
            style={mainButton}
          >
            <Save size={18} />
            حفظ البيانات
          </button>

          <button
            onClick={savePdf}
            style={mainButton}
          >
            <FileDown size={18} />
            حفظ PDF
          </button>

          <button
            onClick={sharePdf}
            style={mainButton}
          >
            <Share2 size={18} />
            مشاركة
          </button>

          <button
            onClick={openWhatsApp}
            style={whatsappButton}
          >
            <MessageCircle size={18} />
            واتساب
          </button>

          <button
            onClick={printInvoice}
            style={mainButton}
          >
            <Printer size={18} />
            طباعة
          </button>
        </div>

        {/* الفاتورة */}

        <div
          ref={invoiceRef}
          style={invoiceStyle}
        >
          {/* الرأس */}

          <div style={topArea}>
            <div style={craneBox}>
              <Truck size={70} strokeWidth={1.3} />
            </div>

            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={companyTitle}>
                رافعات الحديثة
              </div>

              <div style={companyEnglish}>
                RAFIEAT AL-HADITHA
              </div>

              <div style={activityBadge}>
                {data.activity}
              </div>

              <div style={locationText}>
                {data.location}
              </div>

              {editButton('company')}
            </div>

            <div style={craneBox}>
              <Truck size={70} strokeWidth={1.3} />
            </div>
          </div>

          {/* فاتورة نقداً */}

          <div style={cashInvoice}>
            <strong style={{ fontSize: 27 }}>
              فاتورة نقداً
            </strong>

            <span style={{ fontSize: 18 }}>
              CASH INVOICE
            </span>
          </div>

          {/* الرقم والتاريخ */}

          <div style={metaRow}>
            <div>
              <div style={metaLabel}>No</div>

              {editing === 'invoice' ? (
                <input
                  style={inputStyle}
                  value={data.invoiceNo}
                  onChange={(e) =>
                    updateData(
                      'invoiceNo',
                      e.target.value
                    )
                  }
                />
              ) : (
                <strong style={{ fontSize: 24 }}>
                  {data.invoiceNo}
                </strong>
              )}
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={metaLabel}>التاريخ</div>

              {editing === 'invoice' ? (
                <input
                  type="date"
                  style={inputStyle}
                  value={data.date}
                  onChange={(e) =>
                    updateData(
                      'date',
                      e.target.value
                    )
                  }
                />
              ) : (
                <strong>{data.date}</strong>
              )}

              <div style={{ marginTop: 7 }}>
                المطلوب من السيد / السادة
              </div>

              {editButton('invoice')}
            </div>
          </div>

          {/* البيانات */}

          <div style={infoGrid}>
            <div style={infoCard}>
              <div style={sectionTitle}>
                بيانات العميل
              </div>

              {editing === 'customer' ? (
                <input
                  style={inputStyle}
                  value={data.customer}
                  onChange={(e) =>
                    updateData(
                      'customer',
                      e.target.value
                    )
                  }
                />
              ) : (
                <strong>{data.customer}</strong>
              )}

              {editButton('customer')}
            </div>

            <div style={infoCard}>
              <div style={sectionTitle}>
                بيانات المؤسسة
              </div>

              {editing === 'company' ? (
                <>
                  <input
                    style={inputStyle}
                    value={data.companyArabic}
                    onChange={(e) =>
                      updateData(
                        'companyArabic',
                        e.target.value
                      )
                    }
                    placeholder="اسم المؤسسة بالعربي"
                  />

                  <input
                    style={inputStyle}
                    value={data.companyEnglish}
                    onChange={(e) =>
                      updateData(
                        'companyEnglish',
                        e.target.value
                      )
                    }
                    placeholder="Company English Name"
                  />

                  <input
                    style={inputStyle}
                    value={data.activity}
                    onChange={(e) =>
                      updateData(
                        'activity',
                        e.target.value
                      )
                    }
                    placeholder="النشاط"
                  />

                  <input
                    style={inputStyle}
                    value={data.location}
                    onChange={(e) =>
                      updateData(
                        'location',
                        e.target.value
                      )
                    }
                    placeholder="الموقع"
                  />
                </>
              ) : (
                <>
                  <strong>
                    {data.companyArabic}
                  </strong>

                  <div
                    dir="ltr"
                    style={{
                      marginTop: 5,
                      fontSize: 13,
                    }}
                  >
                    {data.companyEnglish}
                  </div>

                  <div style={{ marginTop: 5 }}>
                    {data.location}
                  </div>
                </>
              )}

              {editButton('company')}
            </div>
          </div>

          {/* الجدول */}

          <div
            style={{
              overflow: 'hidden',
              borderRadius: 10,
              border: '1.5px solid #082e73',
            }}
          >
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>م</th>

                  <th style={thStyle}>
                    البيان
                    <small style={englishSmall}>
                      Description
                    </small>
                  </th>

                  <th style={thStyle}>
                    الكمية
                    <small style={englishSmall}>
                      Qty.
                    </small>
                  </th>

                  <th style={thStyle}>
                    سعر الوحدة
                    <small style={englishSmall}>
                      Unit Price
                    </small>
                  </th>

                  <th style={thStyle}>
                    السعر الإجمالي
                    <small style={englishSmall}>
                      Total Price
                    </small>
                  </th>
                </tr>
              </thead>

              <tbody>
                {data.items.map((item, index) => {
                  const rowTotal =
                    Number(item.qty || 0) *
                    Number(item.unitPrice || 0);

                  return (
                    <tr key={index}>
                      <td style={tdStyle}>
                        {index + 1}
                      </td>

                      <td style={tdDescription}>
                        {editing === 'items' ? (
                          <input
                            style={tableInput}
                            value={item.description}
                            onChange={(e) =>
                              updateItem(
                                index,
                                'description',
                                e.target.value
                              )
                            }
                            placeholder={`العمل رقم ${
                              index + 1
                            }`}
                          />
                        ) : (
                          item.description || '—'
                        )}
                      </td>

                      <td style={tdStyle}>
                        {editing === 'items' ? (
                          <input
                            type="number"
                            min="0"
                            style={numberInput}
                            value={item.qty}
                            onChange={(e) =>
                              updateItem(
                                index,
                                'qty',
                                Number(e.target.value)
                              )
                            }
                          />
                        ) : (
                          item.qty
                        )}
                      </td>

                      <td style={tdStyle}>
                        {editing === 'items' ? (
                          <input
                            type="number"
                            min="0"
                            style={numberInput}
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateItem(
                                index,
                                'unitPrice',
                                Number(e.target.value)
                              )
                            }
                          />
                        ) : (
                          Number(
                            item.unitPrice
                          ).toLocaleString()
                        )}
                      </td>

                      <td style={tdStyle}>
                        {rowTotal.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            className="no-print"
            style={{
              marginTop: 6,
              textAlign: 'center',
            }}
          >
            {editButton('items')}
          </div>

          {/* المجموع */}

          <div style={bottomGrid}>
            <div style={summaryBox}>
              <div style={summaryRow}>
                <strong>المجموع</strong>

                <strong style={{ fontSize: 22 }}>
                  {total.toLocaleString()} ر.س
                </strong>
              </div>

              <div style={summaryRow}>
                <strong>المبلغ كتابة</strong>

                <span>{totalWords}</span>
              </div>

              <div style={summaryRow}>
                <strong>ملاحظات</strong>

                {editing === 'notes' ? (
                  <textarea
                    style={{
                      ...inputStyle,
                      minHeight: 70,
                    }}
                    value={data.notes}
                    onChange={(e) =>
                      updateData(
                        'notes',
                        e.target.value
                      )
                    }
                  />
                ) : (
                  <span
                    style={{
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {data.notes}
                  </span>
                )}
              </div>

              <div style={summaryRow}>
                <strong>حالة الدفع</strong>

                <button
                  className="no-print"
                  onClick={() =>
                    updateData(
                      'paid',
                      !data.paid
                    )
                  }
                  style={
                    data.paid
                      ? paidStyle
                      : unpaidStyle
                  }
                >
                  {data.paid
                    ? 'مدفوع'
                    : 'غير مدفوع'}
                </button>

                <span
                  className="print-status"
                  style={{
                    color: data.paid
                      ? '#138a44'
                      : '#c92a2a',
                    fontWeight: 800,
                  }}
                >
                  {data.paid
                    ? 'مدفوع'
                    : 'غير مدفوع'}
                </span>
              </div>

              {editButton('notes')}
            </div>

            <div style={detailsBox}>
              <div style={sectionTitle}>
                تفاصيل الفاتورة
              </div>

              <div>
                نوع الفاتورة : {data.invoiceType}
              </div>

              <div>
                رقم الفاتورة : {data.invoiceNo}
              </div>

              <div>
                تاريخ الفاتورة : {data.date}
              </div>

              <div>
                الموقع : {data.location}
              </div>
            </div>
          </div>

          {/* التوقيعات */}

          <div style={signatures}>
            <div>
              <strong>توقيع المستلم</strong>

              <div style={signatureLine} />
            </div>

            <div>
              <strong>توقيع البائع</strong>

              <div style={signatureLine} />
            </div>
          </div>

          <div style={thankYou}>
            • شكراً لتعاملكم معنا •
          </div>
        </div>

        {/* نهاية أزرار */}

        {editing && (
          <div
            className="no-print"
            style={floatingSave}
          >
            <button
              onClick={saveInvoice}
              style={saveFloatingButton}
            >
              <Check size={18} />
              حفظ التعديل
            </button>

            <button
              onClick={() => setEditing(null)}
              style={cancelFloatingButton}
            >
              <X size={18} />
              إلغاء
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

/* ===============================
   التصميم
================================ */

const navy = '#082e73';

const invoiceStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 794,
  minHeight: 1120,
  margin: '0 auto',
  background: '#ffffff',
  color: '#101827',
  padding: 18,
  fontFamily:
    'Arial, Tahoma, "Noto Sans Arabic", sans-serif',
  boxSizing: 'border-box',
};

const topArea: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  borderTop: `8px solid ${navy}`,
  paddingTop: 10,
};

const craneBox: React.CSSProperties = {
  width: 135,
  minWidth: 90,
  height: 115,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: navy,
  borderRadius: 18,
  background:
    'linear-gradient(145deg,#f7f9ff,#e8eef9)',
};

const companyTitle: React.CSSProperties = {
  color: navy,
  fontWeight: 900,
  fontSize: 38,
  lineHeight: 1.1,
};

const companyEnglish: React.CSSProperties = {
  color: navy,
  fontWeight: 800,
  fontSize: 20,
  marginTop: 5,
};

const activityBadge: React.CSSProperties = {
  display: 'inline-block',
  marginTop: 10,
  background: navy,
  color: '#fff',
  padding: '7px 25px',
  borderRadius: 8,
  fontWeight: 800,
};

const locationText: React.CSSProperties = {
  marginTop: 8,
  color: navy,
  fontWeight: 800,
};

const cashInvoice: React.CSSProperties = {
  width: 260,
  margin: '10px auto',
  padding: '12px 15px',
  color: '#fff',
  background: navy,
  borderRadius: 18,
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  border: '4px double #fff',
  outline: `2px solid ${navy}`,
};

const metaRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 15,
  margin: '18px 8px',
};

const metaLabel: React.CSSProperties = {
  color: navy,
  fontWeight: 800,
  marginBottom: 5,
};

const infoGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginBottom: 12,
};

const infoCard: React.CSSProperties = {
  border: `1.5px solid ${navy}`,
  borderRadius: 12,
  padding: 12,
  textAlign: 'center',
  minHeight: 105,
};

const sectionTitle: React.CSSProperties = {
  color: navy,
  fontWeight: 900,
  fontSize: 18,
  marginBottom: 10,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
};

const thStyle: React.CSSProperties = {
  background: navy,
  color: '#fff',
  padding: '10px 5px',
  borderLeft: '1px solid #fff',
  fontSize: 15,
};

const englishSmall: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  marginTop: 3,
  fontWeight: 500,
};

const tdStyle: React.CSSProperties = {
  border: '1px solid #c9cdd4',
  padding: '9px 4px',
  textAlign: 'center',
  height: 45,
  fontWeight: 700,
};

const tdDescription: React.CSSProperties = {
  ...tdStyle,
  width: '42%',
  textAlign: 'right',
  paddingRight: 12,
};

const bottomGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.4fr 1fr',
  gap: 10,
  marginTop: 12,
};

const summaryBox: React.CSSProperties = {
  border: `1.5px solid ${navy}`,
  borderRadius: 10,
  overflow: 'hidden',
};

const summaryRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '125px 1fr',
  gap: 10,
  alignItems: 'center',
  padding: '9px 10px',
  borderBottom: '1px solid #d5d8df',
};

const detailsBox: React.CSSProperties = {
  border: `1.5px solid ${navy}`,
  borderRadius: 10,
  padding: 12,
  lineHeight: 2,
};

const signatures: React.CSSProperties = {
  marginTop: 22,
  display: 'flex',
  justifyContent: 'space-around',
  textAlign: 'center',
  color: navy,
};

const signatureLine: React.CSSProperties = {
  width: 150,
  borderBottom: `2px dotted ${navy}`,
  marginTop: 35,
};

const thankYou: React.CSSProperties = {
  textAlign: 'center',
  marginTop: 18,
  color: navy,
  fontWeight: 900,
  fontSize: 22,
  borderBottom: `2px solid ${navy}`,
  paddingBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #a9b8d7',
  borderRadius: 8,
  padding: '8px 9px',
  marginBottom: 6,
  fontSize: 14,
  textAlign: 'right',
  boxSizing: 'border-box',
};

const tableInput: React.CSSProperties = {
  ...inputStyle,
  margin: 0,
  border: '1px solid #c2caDA',
};

const numberInput: React.CSSProperties = {
  width: '90%',
  border: '1px solid #c2cada',
  padding: 5,
  borderRadius: 5,
  textAlign: 'center',
};

const smallEditButton: React.CSSProperties = {
  marginTop: 5,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  background: '#17499b',
  color: '#fff',
  border: 0,
  borderRadius: 6,
  padding: '5px 8px',
  fontSize: 11,
  cursor: 'pointer',
};

const mainButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '10px 13px',
  borderRadius: 10,
  border: '1px solid #243f70',
  background: '#0b1f42',
  color: '#fff',
  fontWeight: 800,
};

const whatsappButton: React.CSSProperties = {
  ...mainButton,
  background: '#159447',
};

const paidStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 20,
  background: '#d8f3df',
  color: '#138a44',
  padding: '6px 20px',
  fontWeight: 900,
};

const unpaidStyle: React.CSSProperties = {
  ...paidStyle,
  background: '#ffe0e0',
  color: '#c92a2a',
};

const floatingSave: React.CSSProperties = {
  position: 'sticky',
  bottom: 15,
  marginTop: 15,
  display: 'flex',
  justifyContent: 'center',
  gap: 10,
  zIndex: 20,
};

const saveFloatingButton: React.CSSProperties = {
  ...mainButton,
  background: '#146c43',
};

const cancelFloatingButton: React.CSSProperties = {
  ...mainButton,
  background: '#9b2c2c',
};
