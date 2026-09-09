import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Save, Eye, RotateCcw } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';

type InvoiceRow = {
  description: string;
  qty: string;
  unitPrice: string;
};

type RentalInvoiceData = {
  invoiceNo: string;
  date: string;
  customer: string;
  location: string;
  rows: InvoiceRow[];
  receivedBy: string;
  salesman: string;
};

const STORAGE_KEY = 'baakr-rental-invoice-v1';

const createEmptyInvoice = (): RentalInvoiceData => ({
  invoiceNo: '',
  date: '',
  customer: '',
  location: 'خميس مشيط - أبها',
  rows: Array.from({ length: 7 }, (_, i) => ({
    description: '',
    qty: i === 0 ? '1' : '',
    unitPrice: '',
  })),
  receivedBy: '',
  salesman: '',
});

function toNumber(value: string) {
  const cleaned = String(value || '').replace(/,/g, '').replace(/[^\d.-]/g, '');
  const result = Number(cleaned);
  return Number.isFinite(result) ? result : 0;
}

function formatMoney(value: number) {
  if (!value) return '';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

export function RentalInvoicePage() {
  const navigate = useNavigate();
  const [data, setData] = useState<RentalInvoiceData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return createEmptyInvoice();
      return { ...createEmptyInvoice(), ...JSON.parse(saved) };
    } catch {
      return createEmptyInvoice();
    }
  });

  const totals = useMemo(
    () => data.rows.map(row => toNumber(row.qty) * toNumber(row.unitPrice)),
    [data.rows],
  );

  const grandTotal = useMemo(
    () => totals.reduce((sum, value) => sum + value, 0),
    [totals],
  );

  function setField<K extends keyof RentalInvoiceData>(
    key: K,
    value: RentalInvoiceData[K],
  ) {
    setData(current => ({ ...current, [key]: value }));
  }

  function setRow(index: number, field: keyof InvoiceRow, value: string) {
    setData(current => ({
      ...current,
      rows: current.rows.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    }));
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    alert('تم حفظ فاتورة التأجير');
  }

  function resetInvoice() {
    if (!window.confirm('هل تريد إنشاء فاتورة تأجير جديدة؟')) return;
    const fresh = createEmptyInvoice();
    setData(fresh);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  }

  return (
    <AppLayout>
      <div dir="rtl" className="pb-24">
        <div className="flex items-center justify-between mb-5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center"
          >
            <ArrowRight className="w-5 h-5 text-white" />
          </button>

          <div className="text-center">
            <h1 className="text-lg font-black text-white">فاتورة تأجير</h1>
            <p className="text-[11px] text-slate-500 mt-1">فاتورة مستقلة جديدة</p>
          </div>

          <button
            type="button"
            onClick={resetInvoice}
            className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center"
          >
            <RotateCcw className="w-5 h-5 text-red-400" />
          </button>
        </div>

        <Section title="بيانات الفاتورة">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="رقم الفاتورة"
              value={data.invoiceNo}
              inputMode="numeric"
              onChange={v => setField('invoiceNo', v)}
            />
            <DateField
              label="التاريخ"
              value={data.date}
              onChange={v => setField('date', v)}
            />
          </div>

          <Field
            label="المطلوب من السيد / السادة"
            value={data.customer}
            placeholder="اسم العميل أو الجهة"
            onChange={v => setField('customer', v)}
          />

          <Field
            label="الموقع"
            value={data.location}
            placeholder="خميس مشيط - أبها"
            onChange={v => setField('location', v)}
          />
        </Section>

        <Section title="البيان والأسعار">
          <div className="space-y-4">
            {data.rows.map((row, index) => (
              <div
                key={index}
                className="rounded-2xl border border-white/10 bg-black/20 p-3"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white text-sm font-black">
                    السطر {index + 1}
                  </span>
                  <span className="text-emerald-400 text-xs font-black">
                    {formatMoney(totals[index]) || '0'} ر.س
                  </span>
                </div>

                <Field
                  label="البيان"
                  value={row.description}
                  placeholder="مثال: إيجار كرين 50 طن"
                  onChange={v => setRow(index, 'description', v)}
                />

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Field
                    label="الكمية"
                    value={row.qty}
                    inputMode="decimal"
                    onChange={v => setRow(index, 'qty', v)}
                  />

                  <Field
                    label="سعر الوحدة"
                    value={row.unitPrice}
                    inputMode="decimal"
                    onChange={v => setRow(index, 'unitPrice', v)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-bold">المجموع النهائي</span>
              <span className="text-2xl text-emerald-400 font-black">
                {formatMoney(grandTotal) || '0'} ر.س
              </span>
            </div>
          </div>
        </Section>

        <Section title="التوقيع">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="المستلم"
              value={data.receivedBy}
              onChange={v => setField('receivedBy', v)}
            />
            <Field
              label="البائع"
              value={data.salesman}
              onChange={v => setField('salesman', v)}
            />
          </div>
        </Section>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <button
            type="button"
            onClick={saveData}
            className="h-14 rounded-2xl bg-slate-800 border border-white/10 text-white font-black flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            حفظ
          </button>

          <button
            type="button"
            onClick={() => alert('المعاينة وPDF نضيفها في الخطوة التالية بعد ربط الصفحة بالتطبيق')}
            className="h-14 rounded-2xl bg-blue-600 text-white font-black flex items-center justify-center gap-2"
          >
            <Eye className="w-5 h-5" />
            معاينة
          </button>
        </div>
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
      <h2 className="text-white text-base font-black mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder = '',
  inputMode = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'decimal';
}) {
  return (
    <label className="block">
      <span className="block mb-2 text-[12px] font-bold text-slate-400">
        {label}
      </span>

      <input
        type="text"
        dir="rtl"
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
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
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block mb-2 text-[12px] font-bold text-slate-400">
        {label}
      </span>

      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-12 px-3 rounded-xl bg-[#07111d] border border-white/10 text-white text-sm font-bold outline-none focus:border-blue-500/60"
      />
    </label>
  );
}
