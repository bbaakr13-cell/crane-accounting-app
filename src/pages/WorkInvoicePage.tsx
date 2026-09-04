import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ArrowRight,
  Save,
  FileDown,
  RotateCcw,
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import { AppLayout } from '@/components/layout/AppLayout';

const STORAGE_KEY = 'baakr-work-invoice-v3';

type InvoiceData = {
  invoiceNo: string;
  date: string;
  customer: string;
  description: string;
  qty: string;
  unitPrice: string;
  totalPrice: string;
  totalWords: string;
};

const emptyInvoice: InvoiceData = {
  invoiceNo: '',
  date: '',
  customer: '',
  description: '',
  qty: '1',
  unitPrice: '',
  totalPrice: '',
  totalWords: '',
};

export function WorkInvoicePage() {
  const navigate = useNavigate();

  const invoiceRef =
    useRef<HTMLDivElement>(null);

  const [data, setData] =
    useState<InvoiceData>(emptyInvoice);

  const [exporting, setExporting] =
    useState(false);

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY);

      if (saved) {
        setData({
          ...emptyInvoice,
          ...JSON.parse(saved),
        });
      }
    } catch (error) {
      console.error(
        'Invoice load error:',
        error
      );
    }
  }, []);

  function update(
    field: keyof InvoiceData,
    value: string
  ) {
    const next = {
      ...data,
      [field]: value,
    };

    if (
      field === 'qty' ||
      field === 'unitPrice'
    ) {
      const qty =
        Number(
          field === 'qty'
            ? value
            : next.qty
        ) || 0;

      const price =
        Number(
          field === 'unitPrice'
            ? value
            : next.unitPrice
        ) || 0;

      next.totalPrice =
        qty && price
          ? String(qty * price)
          : '';
    }

    setData(next);

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(next)
      );
    } catch (error) {
      console.error(
        'Invoice save error:',
        error
      );
    }
  }

  function saveInvoice() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
      );

      alert('تم حفظ الفاتورة');
    } catch {
      alert('تعذر حفظ الفاتورة');
    }
  }

  function clearInvoice() {
    const ok = window.confirm(
      'هل تريد مسح بيانات الفاتورة؟'
    );

    if (!ok) return;

    setData(emptyInvoice);

    localStorage.removeItem(
      STORAGE_KEY
    );
  }

  async function exportPDF() {
    if (!invoiceRef.current) return;

    try {
      setExporting(true);

      await new Promise((resolve) =>
        setTimeout(resolve, 150)
      );

      const canvas =
        await html2canvas(
          invoiceRef.current,
          {
            scale: 2.5,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
          }
        );

      const image =
        canvas.toDataURL(
          'image/jpeg',
          0.96
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

      pdf.addImage(
        image,
        'JPEG',
        0,
        0,
        pageWidth,
        pageHeight
      );

      pdf.save(
        `فاتورة-${data.invoiceNo || 'عمل'}.pdf`
      );
    } catch (error) {
      console.error(
        'PDF error:',
        error
      );

      alert(
        'حدث خطأ أثناء إنشاء PDF'
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <AppLayout>
      <div
        dir="rtl"
        className="w-full pb-8"
      >
        {/* رأس الصفحة */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-11 h-11 rounded-[15px] bg-white/5 border border-white/10 flex items-center justify-center"
          >
            <ArrowRight className="w-5 h-5 text-white" />
          </button>

          <div className="text-center">
            <h1 className="text-[18px] font-black text-white">
              فاتورة عمل
            </h1>

            <p className="text-[10px] text-slate-500 mt-1">
              قالب الفاتورة الأصلية
            </p>
          </div>

          <button
            type="button"
            onClick={clearInvoice}
            className="w-11 h-11 rounded-[15px] bg-red-500/10 border border-red-500/20 flex items-center justify-center"
          >
            <RotateCcw className="w-5 h-5 text-red-400" />
          </button>
        </div>

        {/* الفاتورة */}
        <div className="w-full overflow-x-auto">
          <div
            ref={invoiceRef}
            id="work-invoice"
            dir="rtl"
            className="relative bg-white mx-auto overflow-hidden"
            style={{
              width: '794px',
              height: '1123px',
              fontFamily:
                'Arial, Tahoma, sans-serif',
            }}
          >
            {/* الصورة الأصلية */}
            <img
              src="/work-invoice-template.png"
              alt=""
              draggable={false}
              className="absolute inset-0 w-full h-full object-fill select-none pointer-events-none"
            />

            {/* رقم الفاتورة */}
            <InvoiceInput
              value={data.invoiceNo}
              onChange={(value) =>
                update(
                  'invoiceNo',
                  value
                )
              }
              placeholder="001"
              exporting={exporting}
              style={{
                left: '73px',
                top: '276px',
                width: '130px',
                height: '38px',
                textAlign: 'center',
                fontSize: '18px',
              }}
            />

            {/* التاريخ */}
            <InvoiceInput
              value={data.date}
              onChange={(value) =>
                update('date', value)
              }
              placeholder="13 / 9 / 2026"
              exporting={exporting}
              style={{
                left: '590px',
                top: '285px',
                width: '155px',
                height: '35px',
                textAlign: 'center',
                fontSize: '16px',
              }}
            />

            {/* اسم العميل */}
            <InvoiceInput
              value={data.customer}
              onChange={(value) =>
                update(
                  'customer',
                  value
                )
              }
              placeholder="اسم العميل"
              exporting={exporting}
              style={{
                left: '195px',
                top: '326px',
                width: '370px',
                height: '35px',
                textAlign: 'center',
                fontSize: '18px',
                fontWeight: '700',
              }}
            />

            {/* البيان */}
            <InvoiceInput
              value={data.description}
              onChange={(value) =>
                update(
                  'description',
                  value
                )
              }
              placeholder="مثال: إيجار كرين 25 طن شهر يوليو"
              exporting={exporting}
              style={{
                left: '38px',
                top: '500px',
                width: '335px',
                height: '50px',
                textAlign: 'center',
                fontSize: '20px',
                fontWeight: '700',
              }}
            />

            {/* الكمية */}
            <InvoiceInput
              value={data.qty}
              onChange={(value) =>
                update('qty', value)
              }
              placeholder="1"
              inputMode="decimal"
              exporting={exporting}
              style={{
                left: '379px',
                top: '500px',
                width: '57px',
                height: '50px',
                textAlign: 'center',
                fontSize: '21px',
                fontWeight: '700',
              }}
            />

            {/* سعر الوحدة */}
            <InvoiceInput
              value={data.unitPrice}
              onChange={(value) =>
                update(
                  'unitPrice',
                  value
                )
              }
              placeholder="18000"
              inputMode="decimal"
              exporting={exporting}
              style={{
                left: '442px',
                top: '500px',
                width: '108px',
                height: '50px',
                textAlign: 'center',
                fontSize: '21px',
                fontWeight: '700',
              }}
            />

            {/* السعر الإجمالي */}
            <InvoiceInput
              value={data.totalPrice}
              onChange={(value) =>
                update(
                  'totalPrice',
                  value
                )
              }
              placeholder="18000"
              inputMode="decimal"
              exporting={exporting}
              style={{
                left: '598px',
                top: '500px',
                width: '110px',
                height: '50px',
                textAlign: 'center',
                fontSize: '21px',
                fontWeight: '800',
              }}
            />

            {/* المجموع كتابة */}
            <InvoiceInput
              value={data.totalWords}
              onChange={(value) =>
                update(
                  'totalWords',
                  value
                )
              }
              placeholder="ثمانية عشر ألف ريال لا غير"
              exporting={exporting}
              style={{
                left: '130px',
                top: '985px',
                width: '440px',
                height: '42px',
                textAlign: 'center',
                fontSize: '18px',
                fontWeight: '700',
              }}
            />

            {/* المجموع النهائي */}
            <div
              className="absolute flex items-center justify-center text-black font-black"
              style={{
                left: '615px',
                top: '985px',
                width: '135px',
                height: '43px',
                fontSize: '23px',
              }}
            >
              {data.totalPrice}
            </div>
          </div>
        </div>

        {/* أزرار التحكم */}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <button
            type="button"
            onClick={saveInvoice}
            className="h-[55px] rounded-[17px] flex items-center justify-center gap-2 text-[13px] font-black text-white active:scale-[0.98]"
            style={{
              background:
                'linear-gradient(135deg,#15803d,#22c55e)',
            }}
          >
            <Save className="w-5 h-5" />

            حفظ البيانات
          </button>

          <button
            type="button"
            onClick={exportPDF}
            disabled={exporting}
            className="h-[55px] rounded-[17px] flex items-center justify-center gap-2 text-[13px] font-black text-white active:scale-[0.98] disabled:opacity-50"
            style={{
              background:
                'linear-gradient(135deg,#1d4ed8,#2563eb)',
            }}
          >
            <FileDown className="w-5 h-5" />

            {exporting
              ? 'جاري إنشاء PDF...'
              : 'حفظ PDF'}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}

type InvoiceInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?:
    | 'text'
    | 'decimal'
    | 'numeric';
  exporting: boolean;
  style: React.CSSProperties;
};

function InvoiceInput({
  value,
  onChange,
  placeholder,
  inputMode = 'text',
  exporting,
  style,
}: InvoiceInputProps) {
  return (
    <input
      value={value}
      onChange={(event) =>
        onChange(event.target.value)
      }
      placeholder={
        exporting ? '' : placeholder
      }
      inputMode={inputMode}
      className="absolute outline-none text-black"
      style={{
        ...style,
        direction: 'rtl',
        padding: '2px 5px',
        color: '#050505',
        background: exporting
          ? 'transparent'
          : 'rgba(255,255,255,0.10)',
        border: exporting
          ? 'none'
          : '1px dashed rgba(37,99,235,0.22)',
        borderRadius: exporting
          ? '0'
          : '4px',
      }}
    />
  );
            }
