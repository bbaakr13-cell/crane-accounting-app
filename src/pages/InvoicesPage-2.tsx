import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Eye,
  FileDown,
  MapPin,
  MessageCircle,
  Pencil,
  Printer,
  ReceiptText,
  Settings,
  Share2,
  Truck,
  UserRound,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

type Item = {
  description: string;
  qty: number;
  price: number;
};

type InvoiceData = {
  invoiceNo: string;
  date: string;
  customer: string;
  phone: string;
  location: string;
  equipment: string;
  workType: string;
  notes: string;
  paid: number;
  logoDataUrl: string;
  theme: string;
  items: Item[];
};

const initialData: InvoiceData = {
  invoiceNo: '00125',
  date: new Date().toISOString().slice(0, 10),
  customer: '',
  phone: '',
  location: '',
  equipment: 'كرين 25 طن',
  workType: 'مشوار',
  notes: '',
  paid: 0,
  logoDataUrl: '',
  theme: '#123b7a',
  items: [
    {
      description: 'تأجير كرين',
      qty: 1,
      price: 0,
    },
  ],
};

export default function InvoicesPage2() {
  const [data, setData] = useState<InvoiceData>(initialData);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  const invoiceRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const total = useMemo(() => {
    return data.items.reduce(
      (sum, item) =>
        sum + Number(item.qty || 0) * Number(item.price || 0),
      0
    );
  }, [data.items]);

  const remaining = Math.max(total - Number(data.paid || 0), 0);

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
    setData((old) => ({
      ...old,
      items: old.items.map((item, i) =>
        i === index
          ? {
              ...item,
              [key]:
                key === 'description'
                  ? String(value)
                  : Number(value),
            }
          : item
      ),
    }));
  }

  function addItem() {
    setData((old) => ({
      ...old,
      items: [
        ...old.items,
        {
          description: '',
          qty: 1,
          price: 0,
        },
      ],
    }));
  }

  function removeItem(index: number) {
    setData((old) => ({
      ...old,
      items:
        old.items.length > 1
          ? old.items.filter((_, i) => i !== index)
          : old.items,
    }));
  }

  function handleLogo(file?: File) {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      updateData('logoDataUrl', String(reader.result || ''));
    };

    reader.readAsDataURL(file);
  }

  async function createPdf() {
    if (!invoiceRef.current) {
      throw new Error('Invoice element not found');
    }

    const canvas = await html2canvas(invoiceRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
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

    const margin = 5;

    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2;

    const ratio = Math.min(
      maxWidth / canvas.width,
      maxHeight / canvas.height
    );

    const imageWidth = canvas.width * ratio;
    const imageHeight = canvas.height * ratio;

    const x = (pageWidth - imageWidth) / 2;
    const y = (pageHeight - imageHeight) / 2;

    pdf.addImage(
      image,
      'JPEG',
      x,
      y,
      imageWidth,
      imageHeight,
      undefined,
      'FAST'
    );

    return pdf;
  }

  async function savePdf() {
    try {
      const pdf = await createPdf();

      pdf.save(`invoice-${data.invoiceNo || 'invoice'}.pdf`);
    } catch (error) {
      console.error(error);
      alert('تعذر حفظ ملف PDF');
    }
  }

  async function sharePdf() {
    try {
      const pdf = await createPdf();

      const blob = pdf.output('blob');

      const file = new File(
        [blob],
        `invoice-${data.invoiceNo || 'invoice'}.pdf`,
        {
          type: 'application/pdf',
        }
      );

      if (
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        await navigator.share({
          title: `فاتورة رقم ${data.invoiceNo}`,
          text: `فاتورة رقم ${data.invoiceNo}`,
          files: [file],
        });
      } else {
        pdf.save(`invoice-${data.invoiceNo || 'invoice'}.pdf`);
      }
    } catch (error) {
      console.error(error);
    }
  }

  function openWhatsApp() {
    const text = [
      `فاتورة رقم: ${data.invoiceNo}`,
      `العميل: ${data.customer || '-'}`,
      `المعدة: ${data.equipment}`,
      `الإجمالي: ${total.toLocaleString()} ريال`,
      `المدفوع: ${Number(data.paid || 0).toLocaleString()} ريال`,
      `المتبقي: ${remaining.toLocaleString()} ريال`,
    ].join('\n');

    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank'
    );
  }

  function printInvoice() {
    window.print();
  }

  return (
    <AppLayout>
      <div
        dir="rtl"
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: 16,
          fontFamily: 'Arial, sans-serif',
        }}
      >
        {mode === 'edit' ? (
          <>
            <div style={pageHeader}>
              <div>
                <div style={headerIcon(data.theme)}>
                  <ReceiptText size={25} />
                </div>

                <div>
                  <h1 style={{ margin: 0, fontSize: 24 }}>
                    إنشاء فاتورة
                  </h1>

                  <div
                    style={{
                      color: '#64748b',
                      marginTop: 5,
                      fontSize: 13,
                    }}
                  >
                    أدخل بيانات الفاتورة ثم اضغط معاينة
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMode('preview')}
                style={primaryButton(data.theme)}
              >
                <Eye size={18} />
                معاينة الفاتورة
              </button>
            </div>

            <SectionCard
              title="بيانات الفاتورة"
              icon={<ReceiptText size={19} />}
            >
              <div style={twoColumns}>
                <Field
                  label="رقم الفاتورة"
                  value={data.invoiceNo}
                  onChange={(v) => updateData('invoiceNo', v)}
                />

                <Field
                  label="التاريخ"
                  type="date"
                  value={data.date}
                  onChange={(v) => updateData('date', v)}
                />

                <Field
                  label="اسم العميل"
                  value={data.customer}
                  placeholder="اكتب اسم العميل"
                  onChange={(v) => updateData('customer', v)}
                />

                <Field
                  label="رقم الجوال"
                  value={data.phone}
                  placeholder="05xxxxxxxx"
                  onChange={(v) => updateData('phone', v)}
                />

                <Field
                  label="الموقع"
                  value={data.location}
                  placeholder="خميس مشيط / أبها"
                  onChange={(v) => updateData('location', v)}
                />

                <SelectField
                  label="المعدة"
                  value={data.equipment}
                  onChange={(v) => updateData('equipment', v)}
                  options={[
                    'كرين 25 طن',
                    'كرين 25 طن ساني',
                    'كرين 25 طن أصفر بكر',
                    'كرين 25 طن كاتو',
                    'كرين 25 طن أصفر مستبيشي',
                    'كرين 50 طن',
                    'بوم ترك الأخضر',
                    'بوم ترك الأحمر',
                  ]}
                />

                <SelectField
                  label="نوع الشغل"
                  value={data.workType}
                  onChange={(v) => updateData('workType', v)}
                  options={[
                    'مشوار',
                    'ساعة',
                    'يومية',
                    'أسبوع',
                    'شهري',
                  ]}
                />

                <Field
                  label="المبلغ المدفوع"
                  type="number"
                  value={String(data.paid)}
                  onChange={(v) =>
                    updateData('paid', Number(v || 0))
                  }
                />
              </div>
            </SectionCard>

            <SectionCard
              title="تفاصيل الخدمات"
              icon={<Truck size={19} />}
            >
              {data.items.map((item, index) => (
                <div key={index} style={itemRow}>
                  <div style={{ flex: 2, minWidth: 180 }}>
                    <Field
                      label={`الخدمة ${index + 1}`}
                      value={item.description}
                      placeholder="وصف الخدمة"
                      onChange={(v) =>
                        updateItem(index, 'description', v)
                      }
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: 100 }}>
                    <Field
                      label="الكمية"
                      type="number"
                      value={String(item.qty)}
                      onChange={(v) =>
                        updateItem(index, 'qty', Number(v || 0))
                      }
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: 120 }}>
                    <Field
                      label="السعر"
                      type="number"
                      value={String(item.price)}
                      onChange={(v) =>
                        updateItem(index, 'price', Number(v || 0))
                      }
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    style={deleteButton}
                  >
                    حذف
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addItem}
                style={secondaryButton}
              >
                + إضافة خدمة
              </button>
            </SectionCard>

            <SectionCard
              title="ملاحظات"
              icon={<Pencil size={19} />}
            >
              <textarea
                value={data.notes}
                onChange={(e) =>
                  updateData('notes', e.target.value)
                }
                placeholder="أضف أي ملاحظات..."
                style={{
                  ...inputStyle,
                  minHeight: 100,
                  resize: 'vertical',
                }}
              />
            </SectionCard>

            <SectionCard
              title="إعدادات الفاتورة"
              icon={<Settings size={19} />}
            >
              <div style={settingBox}>
                <strong>شعار المؤسسة</strong>

                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) =>
                    handleLogo(e.target.files?.[0])
                  }
                />

                <button
                  type="button"
                  style={secondaryButton}
                  onClick={() => logoInputRef.current?.click()}
                >
                  اختيار شعار
                </button>

                {data.logoDataUrl && (
                  <img
                    src={data.logoDataUrl}
                    alt="logo"
                    style={{
                      width: 100,
                      height: 70,
                      objectFit: 'contain',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: 5,
                    }}
                  />
                )}
              </div>

              <div style={{ ...settingBox, marginTop: 15 }}>
                <strong>لون الفاتورة</strong>

                <input
                  type="color"
                  value={data.theme}
                  onChange={(e) =>
                    updateData('theme', e.target.value)
                  }
                  style={{
                    width: 65,
                    height: 45,
                    border: 0,
                    cursor: 'pointer',
                  }}
                />
              </div>
            </SectionCard>

            <button
              type="button"
              onClick={() => setMode('preview')}
              style={{
                ...primaryButton(data.theme),
                width: '100%',
                justifyContent: 'center',
                padding: 15,
                marginBottom: 25,
              }}
            >
              <Eye size={19} />
              معاينة الفاتورة
            </button>
          </>
        ) : (
          <>
            <div style={previewTopBar}>
              <button
                type="button"
                onClick={() => setMode('edit')}
                style={secondaryButton}
              >
                <ArrowRight size={18} />
                رجوع للتعديل
              </button>

              <strong>معاينة الفاتورة</strong>
            </div>

            <InvoicePreview
              ref={invoiceRef}
              data={data}
              total={total}
              remaining={remaining}
            />

            <div style={actionBar}>
              <button
                type="button"
                onClick={savePdf}
                style={actionButton(data.theme)}
              >
                <FileDown size={18} />
                حفظ PDF
              </button>

              <button
                type="button"
                onClick={sharePdf}
                style={actionButton(data.theme)}
              >
                <Share2 size={18} />
                مشاركة
              </button>

              <button
                type="button"
                onClick={openWhatsApp}
                style={whatsappButton}
              >
                <MessageCircle size={18} />
                واتساب
              </button>

              <button
                type="button"
                onClick={printInvoice}
                style={actionButton(data.theme)}
              >
                <Printer size={18} />
                طباعة
              </button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

const InvoicePreview = React.forwardRef<
  HTMLDivElement,
  {
    data: InvoiceData;
    total: number;
    remaining: number;
  }
>(({ data, total, remaining }, ref) => {
  return (
    <div
      ref={ref}
      dir="rtl"
      style={{
        width: '100%',
        maxWidth: 794,
        minHeight: 1123,
        margin: '20px auto',
        background: '#ffffff',
        color: '#0f172a',
        padding: 35,
        boxSizing: 'border-box',
        borderRadius: 8,
        boxShadow: '0 15px 45px rgba(0,0,0,.12)',
      }}
    >
      <div
        style={{
          height: 8,
          background: data.theme,
          borderRadius: 10,
          marginBottom: 25,
        }}
      />

      <div style={invoiceHeader}>
        <div style={invoiceBrand}>
          {data.logoDataUrl ? (
            <img
              src={data.logoDataUrl}
              alt="logo"
              style={{
                width: 110,
                height: 85,
                objectFit: 'contain',
              }}
            />
          ) : (
            <div style={craneVisual(data.theme)}>
              <Truck size={45} />
            </div>
          )}

          <div>
            <div
              style={{
                color: data.theme,
                fontSize: 26,
                fontWeight: 900,
              }}
            >
              تأجير كرينات
            </div>

            <div
              style={{
                color: '#64748b',
                marginTop: 5,
                fontSize: 13,
              }}
            >
              خدمات الرفع وتأجير المعدات
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'left' }}>
          <div
            style={{
              color: data.theme,
              fontSize: 27,
              fontWeight: 900,
            }}
          >
            فاتورة
          </div>

          <div
            style={{
              fontSize: 13,
              marginTop: 5,
              color: '#64748b',
            }}
          >
            CASH INVOICE
          </div>
        </div>
      </div>

      <div style={invoiceMeta}>
        <div>
          <CalendarDays size={17} />
          <span>التاريخ: {data.date}</span>
        </div>

        <div>
          <ReceiptText size={17} />
          <span>رقم الفاتورة: {data.invoiceNo}</span>
        </div>
      </div>

      <div style={infoCards}>
        <div
          style={{
            ...invoiceInfoCard,
            borderTop: `4px solid ${data.theme}`,
          }}
        >
          <div style={cardTitle}>
            <UserRound size={18} />
            بيانات العميل
          </div>

          <DetailRow
            label="الاسم"
            value={data.customer || '—'}
          />

          <DetailRow
            label="الجوال"
            value={data.phone || '—'}
          />

          <DetailRow
            label="الموقع"
            value={data.location || '—'}
          />
        </div>

        <div
          style={{
            ...invoiceInfoCard,
            borderTop: `4px solid ${data.theme}`,
          }}
        >
          <div style={cardTitle}>
            <Building2 size={18} />
            بيانات الخدمة
          </div>

          <DetailRow
            label="المعدة"
            value={data.equipment}
          />

          <DetailRow
            label="نوع الشغل"
            value={data.workType}
          />

          <DetailRow
            label="الحالة"
            value={remaining <= 0 ? 'مدفوع' : 'متبقي'}
          />
        </div>
      </div>

      <div
        style={{
          overflow: 'hidden',
          border: '1px solid #dbe3ee',
          borderRadius: 10,
          marginTop: 20,
        }}
      >
        <table style={invoiceTable}>
          <thead>
            <tr>
              <th style={invoiceTh(data.theme)}>م</th>
              <th style={invoiceTh(data.theme)}>البيان</th>
              <th style={invoiceTh(data.theme)}>الكمية</th>
              <th style={invoiceTh(data.theme)}>السعر</th>
              <th style={invoiceTh(data.theme)}>الإجمالي</th>
            </tr>
          </thead>

          <tbody>
            {data.items.map((item, index) => (
              <tr key={index}>
                <td style={invoiceTd}>{index + 1}</td>

                <td style={invoiceTd}>
                  {item.description || '—'}
                </td>

                <td style={invoiceTd}>
                  {item.qty}
                </td>

                <td style={invoiceTd}>
                  {Number(item.price).toLocaleString()}
                </td>

                <td style={invoiceTd}>
                  {(
                    Number(item.qty) *
                    Number(item.price)
                  ).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={invoiceBottomGrid}>
        <div style={notesBox}>
          <strong
            style={{
              color: data.theme,
              display: 'block',
              marginBottom: 10,
            }}
          >
            ملاحظات
          </strong>

          <div
            style={{
              whiteSpace: 'pre-wrap',
              color: '#475569',
              lineHeight: 1.8,
            }}
          >
            {data.notes || 'لا توجد ملاحظات'}
          </div>
        </div>

        <div style={summaryBox}>
          <SummaryRow
            label="الإجمالي"
            value={`${total.toLocaleString()} ريال`}
          />

          <SummaryRow
            label="المدفوع"
            value={`${Number(data.paid).toLocaleString()} ريال`}
          />

          <div
            style={{
              marginTop: 10,
              padding: 12,
              borderRadius: 8,
              background:
                remaining <= 0 ? '#ecfdf5' : '#fff7ed',
              fontWeight: 900,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>المتبقي</span>

            <span>
              {remaining.toLocaleString()} ريال
            </span>
          </div>
        </div>
      </div>

      <div style={invoiceSignatures}>
        <div>
          <strong>توقيع المستلم</strong>
          <div style={signatureLine} />
        </div>

        <div>
          <strong>توقيع المسؤول</strong>
          <div style={signatureLine} />
        </div>
      </div>

      <div
        style={{
          marginTop: 40,
          borderTop: '1px dashed #cbd5e1',
          paddingTop: 15,
          textAlign: 'center',
          color: data.theme,
          fontWeight: 800,
        }}
      >
        شكراً لتعاملكم معنا
      </div>
    </div>
  );
});

InvoicePreview.displayName = 'InvoicePreview';

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={sectionCard}>
      <div style={sectionTitle}>
        {icon}
        <strong>{title}</strong>
      </div>

      {children}
    </section>
  );
}

function Field({
  label,
  value,
  placeholder,
  type = 'text',
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={fieldWrap}>
      <span style={fieldLabel}>{label}</span>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label style={fieldWrap}>
      <span style={fieldLabel}>{label}</span>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={detailRow}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={summaryRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/* =========================
   STYLES
========================= */

const pageHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 15,
  flexWrap: 'wrap',
  marginBottom: 20,
};

const headerIcon = (theme: string): React.CSSProperties => ({
  width: 48,
  height: 48,
  borderRadius: 14,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: `${theme}15`,
  color: theme,
  marginLeft: 12,
  verticalAlign: 'middle',
});

const sectionCard: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  padding: 18,
  marginBottom: 18,
  boxShadow: '0 5px 20px rgba(15,23,42,.04)',
};

const sectionTitle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 18,
  fontSize: 17,
};

const twoColumns: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns:
    'repeat(auto-fit,minmax(220px,1fr))',
  gap: 15,
};

const fieldWrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
};

const fieldLabel: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: '#334155',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 13px',
  borderRadius: 10,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  fontSize: 14,
  outline: 'none',
};

const itemRow: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'flex-end',
  flexWrap: 'wrap',
  paddingBottom: 15,
  marginBottom: 15,
  borderBottom: '1px solid #eef2f7',
};

const primaryButton = (
  theme: string
): React.CSSProperties => ({
  border: 0,
  borderRadius: 11,
  background: theme,
  color: '#ffffff',
  padding: '11px 16px',
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  fontWeight: 800,
  cursor: 'pointer',
});

const secondaryButton: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  background: '#ffffff',
  padding: '10px 14px',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontWeight: 800,
  cursor: 'pointer',
};

const deleteButton: React.CSSProperties = {
  border: '1px solid #fecaca',
  background: '#fff1f2',
  color: '#be123c',
  borderRadius: 9,
  padding: '11px 14px',
  fontWeight: 800,
  cursor: 'pointer',
};

const settingBox: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 15,
  flexWrap: 'wrap',
};

const previewTopBar: React.CSSProperties = {
  maxWidth: 794,
  margin: '0 auto 15px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 15,
};

const invoiceHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 20,
  borderBottom: '1px solid #e2e8f0',
  paddingBottom: 20,
};

const invoiceBrand: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 15,
};

const craneVisual = (
  theme: string
): React.CSSProperties => ({
  width: 80,
  height: 70,
  borderRadius: 15,
  background: `${theme}12`,
  color: theme,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const invoiceMeta: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  padding: '17px 0',
  color: '#475569',
};

const infoCards: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 15,
};

const invoiceInfoCard: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: 15,
};

const cardTitle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  fontWeight: 900,
  marginBottom: 12,
};

const detailRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '100px 1fr',
  gap: 10,
  padding: '6px 0',
  fontSize: 13,
};

const invoiceTable: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  textAlign: 'center',
};

const invoiceTh = (
  theme: string
): React.CSSProperties => ({
  background: theme,
  color: '#ffffff',
  padding: 11,
  fontSize: 13,
});

const invoiceTd: React.CSSProperties = {
  borderBottom: '1px solid #e2e8f0',
  padding: 11,
  fontSize: 13,
};

const invoiceBottomGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.2fr .8fr',
  gap: 15,
  marginTop: 20,
};

const notesBox: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: 15,
  minHeight: 120,
};

const summaryBox: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: 15,
};

const summaryRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '9px 0',
  borderBottom: '1px solid #eef2f7',
};

const invoiceSignatures: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 50,
  marginTop: 45,
  textAlign: 'center',
};

const signatureLine: React.CSSProperties = {
  borderBottom: '1px solid #94a3b8',
  marginTop: 35,
};

const actionBar: React.CSSProperties = {
  maxWidth: 794,
  margin: '15px auto 30px',
  display: 'grid',
  gridTemplateColumns:
    'repeat(auto-fit,minmax(130px,1fr))',
  gap: 10,
};

const actionButton = (
  theme: string
): React.CSSProperties => ({
  border: `1px solid ${theme}`,
  background: theme,
  color: '#ffffff',
  borderRadius: 11,
  padding: '12px 8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
});

const whatsappButton: React.CSSProperties = {
  border: '1px solid #16a34a',
  background: '#16a34a',
  color: '#ffffff',
  borderRadius: 11,
  padding: '12px 8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
};
