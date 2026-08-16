import React, { useMemo, useState } from 'react';
import {
  FileText,
  Plus,
  Printer,
  Trash2,
  Search,
  Pencil,
  Share2,
  X,
  Save,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

type Invoice = {
  id: number;
  number: string;
  date: string;
  customer: string;
  phone: string;
  equipment: string;
  description: string;
  amount: number;
  status: 'مدفوع' | 'غير مدفوع';
  notes: string;
};

const equipmentList = [
  'كرين 50 طن',
  'كرين 25 طن',
  'كرين 25 طن ساني',
  'كرين 25 طن أصفر بكر',
  'كرين 25 طن كاتو',
  'كرين 25 طن أصفر مستبيشي',
  'بوم ترك الأخضر',
  'بوم ترك الأحمر',
];

const STORAGE_KEY = 'crane-invoices-v1';

function getInvoices(): Invoice[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>(getInvoices);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const emptyForm = {
    customer: '',
    phone: '',
    equipment: equipmentList[0],
    description: '',
    amount: '',
    status: 'غير مدفوع' as 'مدفوع' | 'غير مدفوع',
    notes: '',
  };

  const [form, setForm] = useState(emptyForm);

  function saveAll(list: Invoice[]) {
    setInvoices(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function editInvoice(invoice: Invoice) {
    setEditingId(invoice.id);
    setForm({
      customer: invoice.customer,
      phone: invoice.phone,
      equipment: invoice.equipment,
      description: invoice.description,
      amount: String(invoice.amount),
      status: invoice.status,
      notes: invoice.notes,
    });
    setShowForm(true);
  }

  function saveInvoice() {
    if (!form.customer.trim()) {
      alert('اكتب اسم العميل');
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      alert('اكتب مبلغ الفاتورة');
      return;
    }

    if (editingId !== null) {
      const updated = invoices.map((inv) =>
        inv.id === editingId
          ? {
              ...inv,
              customer: form.customer,
              phone: form.phone,
              equipment: form.equipment,
              description: form.description,
              amount: Number(form.amount),
              status: form.status,
              notes: form.notes,
            }
          : inv
      );

      saveAll(updated);
    } else {
      const id = Date.now();

      const invoice: Invoice = {
        id,
        number: `INV-${String(invoices.length + 1).padStart(4, '0')}`,
        date: new Date().toISOString().slice(0, 10),
        customer: form.customer,
        phone: form.phone,
        equipment: form.equipment,
        description: form.description,
        amount: Number(form.amount),
        status: form.status,
        notes: form.notes,
      };

      saveAll([invoice, ...invoices]);
    }

    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function deleteInvoice(id: number) {
    if (!confirm('هل تريد حذف هذه الفاتورة؟')) return;
    saveAll(invoices.filter((inv) => inv.id !== id));
  }

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return invoices;

    return invoices.filter(
      (inv) =>
        inv.customer.toLowerCase().includes(q) ||
        inv.phone.includes(q) ||
        inv.number.toLowerCase().includes(q) ||
        inv.equipment.toLowerCase().includes(q)
    );
  }, [invoices, search]);

  const totals = useMemo(() => {
    return invoices.reduce(
      (sum, inv) => {
        sum.total += inv.amount;

        if (inv.status === 'مدفوع') {
          sum.paid += inv.amount;
        } else {
          sum.unpaid += inv.amount;
        }

        return sum;
      },
      { total: 0, paid: 0, unpaid: 0 }
    );
  }, [invoices]);

  function printInvoice(invoice: Invoice) {
    const html = `
      <html dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <title>${invoice.number}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 35px;
            direction: rtl;
            color: #111;
          }
          h1 { text-align:center; }
          .box {
            border:1px solid #bbb;
            border-radius:12px;
            padding:16px;
            margin:14px 0;
          }
          .row {
            display:flex;
            justify-content:space-between;
            gap:20px;
            margin:10px 0;
          }
          .amount {
            font-size:24px;
            font-weight:bold;
            text-align:center;
            margin:20px 0;
          }
          .footer {
            text-align:center;
            margin-top:40px;
            color:#555;
          }
        </style>
      </head>
      <body>
        <h1>فاتورة تأجير معدات</h1>

        <div class="box">
          <div class="row">
            <span>رقم الفاتورة: ${invoice.number}</span>
            <span>التاريخ: ${invoice.date}</span>
          </div>

          <div class="row">
            <span>العميل: ${invoice.customer}</span>
            <span>الجوال: ${invoice.phone || '-'}</span>
          </div>

          <div class="row">
            <span>المعدة: ${invoice.equipment}</span>
            <span>الحالة: ${invoice.status}</span>
          </div>
        </div>

        <div class="box">
          <strong>تفاصيل العمل</strong>
          <p>${invoice.description || '-'}</p>
        </div>

        <div class="amount">
          الإجمالي: ${invoice.amount.toLocaleString()} ر.س
        </div>

        <div class="box">
          <strong>ملاحظات</strong>
          <p>${invoice.notes || '-'}</p>
        </div>

        <div class="footer">
          شكراً لتعاملكم معنا
        </div>
      </body>
      </html>
    `;

    const win = window.open('', '_blank');

    if (!win) {
      alert('تعذر فتح نافذة الطباعة');
      return;
    }

    win.document.write(html);
    win.document.close();

    setTimeout(() => {
      win.print();
    }, 400);
  }

  async function shareInvoice(invoice: Invoice) {
    const text =
      `فاتورة ${invoice.number}\n` +
      `العميل: ${invoice.customer}\n` +
      `المعدة: ${invoice.equipment}\n` +
      `المبلغ: ${invoice.amount.toLocaleString()} ر.س\n` +
      `الحالة: ${invoice.status}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: invoice.number,
          text,
        });
      } else {
        await navigator.clipboard.writeText(text);
        alert('تم نسخ بيانات الفاتورة');
      }
    } catch {
      // المستخدم ألغى المشاركة
    }
  }

  const cardStyle: React.CSSProperties = {
    background: '#0b1527',
    border: '1px solid #1d2d47',
    borderRadius: 18,
    padding: 16,
  };

 async function createInvoicePDF(invoice: Invoice) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  pdf.setFontSize(20);
  pdf.text('INVOICE', 105, 20, { align: 'center' });

  pdf.setFontSize(12);
  pdf.text(`Invoice: ${invoice.number}`, 20, 40);
  pdf.text(`Date: ${invoice.date}`, 20, 50);
  pdf.text(`Customer: ${invoice.customer}`, 20, 60);
  pdf.text(`Phone: ${invoice.phone || '-'}`, 20, 70);
  pdf.text(`Equipment: ${invoice.equipment}`, 20, 80);
  pdf.text(`Description: ${invoice.description || '-'}`, 20, 90);
  pdf.text(`Amount: ${invoice.amount.toLocaleString()} SAR`, 20, 100);
  pdf.text(`Status: ${invoice.status}`, 20, 110);
  pdf.text(`Notes: ${invoice.notes || '-'}`, 20, 120);

  return pdf;
}

async function printInvoice(invoice: Invoice) {
  try {
    const pdf = await createInvoicePDF(invoice);
    const fileName = `invoice-${invoice.number}.pdf`;

    if (Capacitor.isNativePlatform()) {
      const base64 = pdf.output('datauristring').split(',')[1];

      await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Documents,
      });

      alert('تم حفظ ملف PDF بنجاح');
    } else {
      pdf.save(fileName);
    }
  } catch (error) {
    console.error(error);
    alert('حدث خطأ أثناء حفظ PDF');
  }
}

async function shareInvoice(invoice: Invoice) {
  try {
    const pdf = await createInvoicePDF(invoice);
    const fileName = `invoice-${invoice.number}.pdf`;

    if (Capacitor.isNativePlatform()) {
      const base64 = pdf.output('datauristring').split(',')[1];

      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      });

      await Share.share({
        title: `فاتورة ${invoice.number}`,
        text: `فاتورة العميل ${invoice.customer}`,
        url: result.uri,
        dialogTitle: 'مشاركة الفاتورة PDF',
      });
    } else {
      pdf.save(fileName);
    }
  } catch (error) {
    console.error(error);
    alert('حدث خطأ أثناء مشاركة PDF');
  }
}

  
  
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 13px',
    borderRadius: 12,
    border: '1px solid #26364f',
    background: '#081322',
    color: '#fff',
    boxSizing: 'border-box',
    fontSize: 14,
  };

  return (
    <AppLayout>
      <div
        dir="rtl"
        style={{
          padding: 18,
          paddingBottom: 100,
          maxWidth: 1000,
          margin: 'auto',
          color: '#fff',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            marginBottom: 18,
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>الفواتير</h1>
            <div style={{ color: '#94a3b8', marginTop: 5 }}>
              إدارة وطباعة فواتير تأجير المعدات
            </div>
          </div>

          <button
            onClick={openNew}
            style={{
              border: 0,
              borderRadius: 14,
              padding: '12px 16px',
              background: '#f5a623',
              color: '#08111f',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
            }}
          >
            <Plus size={19} />
            فاتورة جديدة
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            marginBottom: 18,
          }}
        >
          <div style={cardStyle}>
            <small style={{ color: '#94a3b8' }}>
              إجمالي الفواتير
            </small>
            <h2>{totals.total.toLocaleString()} ر.س</h2>
          </div>

          <div style={cardStyle}>
            <small style={{ color: '#94a3b8' }}>المدفوع</small>
            <h2 style={{ color: '#22c55e' }}>
              {totals.paid.toLocaleString()} ر.س
            </h2>
          </div>

          <div style={cardStyle}>
            <small style={{ color: '#94a3b8' }}>
              غير المدفوع
            </small>
            <h2 style={{ color: '#ef4444' }}>
              {totals.unpaid.toLocaleString()} ر.س
            </h2>
          </div>
        </div>

        <div
          style={{
            ...cardStyle,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 18,
          }}
        >
          <Search size={20} color="#94a3b8" />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم العميل أو رقم الفاتورة..."
            style={{
              flex: 1,
              border: 0,
              outline: 0,
              background: 'transparent',
              color: '#fff',
              fontSize: 14,
            }}
          />
        </div>

        {filteredInvoices.length === 0 ? (
          <div
            style={{
              ...cardStyle,
              textAlign: 'center',
              padding: 35,
              color: '#94a3b8',
            }}
          >
            <FileText
              size={44}
              style={{ marginBottom: 10, opacity: 0.6 }}
            />

            <div>لا توجد فواتير بعد</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {filteredInvoices.map((invoice) => (
              <div key={invoice.id} style={cardStyle}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start',
                    gap: 10,
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: '#f5a623',
                        fontWeight: 'bold',
                        fontSize: 16,
                      }}
                    >
                      {invoice.number}
                    </div>

                    <h3 style={{ margin: '7px 0 4px' }}>
                      {invoice.customer}
                    </h3>

                    <div style={{ color: '#94a3b8' }}>
                      {invoice.equipment}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '7px 10px',
                      borderRadius: 10,
                      background:
                        invoice.status === 'مدفوع'
                          ? 'rgba(34,197,94,.12)'
                          : 'rgba(239,68,68,.12)',
                      color:
                        invoice.status === 'مدفوع'
                          ? '#22c55e'
                          : '#ef4444',
                    }}
                  >
                    {invoice.status}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 15,
                    paddingTop: 13,
                    borderTop: '1px solid #1d2d47',
                  }}
                >
                  <div>
                    <small style={{ color: '#94a3b8' }}>
                      المبلغ
                    </small>
                    <div
                      style={{
                        fontWeight: 'bold',
                        fontSize: 19,
                        marginTop: 3,
                      }}
                    >
                      {invoice.amount.toLocaleString()} ر.س
                    </div>
                  </div>

                  <div>
                    <small style={{ color: '#94a3b8' }}>
                      التاريخ
                    </small>
                    <div style={{ marginTop: 5 }}>{invoice.date}</div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginTop: 15,
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    onClick={() => printInvoice(invoice)}
                    style={actionButton}
                  >
                    <Printer size={17} />
                    PDF / طباعة
                  </button>

                  <button
                    onClick={() => shareInvoice(invoice)}
                    style={actionButton}
                  >
                    <Share2 size={17} />
                    مشاركة
                  </button>

                  <button
                    onClick={() => editInvoice(invoice)}
                    style={actionButton}
                  >
                    <Pencil size={17} />
                    تعديل
                  </button>

                  <button
                    onClick={() => deleteInvoice(invoice.id)}
                    style={{
                      ...actionButton,
                      color: '#ef4444',
                    }}
                  >
                    <Trash2 size={17} />
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(0,0,0,.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 15,
            }}
          >
            <div
              dir="rtl"
              style={{
                width: '100%',
                maxWidth: 600,
                maxHeight: '90vh',
                overflowY: 'auto',
                background: '#081322',
                border: '1px solid #26364f',
                borderRadius: 20,
                padding: 18,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 18,
                }}
              >
                <h2 style={{ margin: 0 }}>
                  {editingId !== null
                    ? 'تعديل الفاتورة'
                    : 'فاتورة جديدة'}
                </h2>

                <button
                  onClick={() => setShowForm(false)}
                  style={{
                    border: 0,
                    background: 'transparent',
                    color: '#fff',
                  }}
                >
                  <X size={24} />
                </button>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <input
                  value={form.customer}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      customer: e.target.value,
                    })
                  }
                  placeholder="اسم العميل"
                  style={inputStyle}
                />

                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      phone: e.target.value,
                    })
                  }
                  inputMode="tel"
                  placeholder="رقم الجوال"
                  style={inputStyle}
                />

                <select
                  value={form.equipment}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      equipment: e.target.value,
                    })
                  }
                  style={inputStyle}
                >
                  {equipmentList.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>

                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      description: e.target.value,
                    })
                  }
                  placeholder="تفاصيل العمل"
                  rows={3}
                  style={inputStyle}
                />

                <input
                  type="number"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      amount: e.target.value,
                    })
                  }
                  placeholder="المبلغ"
                  style={inputStyle}
                />

                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as
                        | 'مدفوع'
                        | 'غير مدفوع',
                    })
                  }
                  style={inputStyle}
                >
                  <option value="غير مدفوع">غير مدفوع</option>
                  <option value="مدفوع">مدفوع</option>
                </select>

                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      notes: e.target.value,
                    })
                  }
                  placeholder="ملاحظات"
                  rows={3}
                  style={inputStyle}
                />

                <button
                  onClick={saveInvoice}
                  style={{
                    border: 0,
                    borderRadius: 14,
                    padding: 14,
                    background: '#f5a623',
                    color: '#08111f',
                    fontWeight: 'bold',
                    fontSize: 16,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Save size={19} />
                  حفظ الفاتورة
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

const actionButton: React.CSSProperties = {
  border: '1px solid #26364f',
  borderRadius: 10,
  background: '#101b2e',
  color: '#fff',
  padding: '9px 11px',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
};
