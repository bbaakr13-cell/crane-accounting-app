import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import {
  Capacitor,
} from '@capacitor/core';

import {
  Directory,
  Filesystem,
} from '@capacitor/filesystem';

import { Share } from '@capacitor/share';

import {
  Eye,
  FileDown,
  FileImage,
  FileText,
  Plus,
  Save,
  Share2,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';

type QuotationItem = {
  id: string;
  equipment: string;
  monthly: string;
  daily: string;
};

type QuotationForm = {
  quoteNo: string;
  date: string;
  hijriDate: string;
  customer: string;
  greeting: string;
  intro: string;
  phone: string;
  region: string;
  workDays: string;
  workHours: string;
  housingDiesel: string;
  vatNote: string;
  extraNote: string;
  items: QuotationItem[];
};

const STORAGE_KEY =
  'bakr_pro_professional_quotation_v1';

const PAPER_WIDTH = 794;
const PAPER_HEIGHT = 1123;

function uid() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(
    2,
    '0'
  );
  const day = String(now.getDate()).padStart(
    2,
    '0'
  );
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string) {
  if (!value) return '—';
  const parts = value.split('-');
  if (parts.length !== 3) return value;
  return `${parts[2]} / ${parts[1]} / ${parts[0]}`;
}

function hijriForDate(value: string) {
  try {
    const date = value
      ? new Date(`${value}T12:00:00`)
      : new Date();

    return new Intl.DateTimeFormat(
      'ar-SA-u-ca-islamic-umalqura',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }
    ).format(date);
  } catch {
    return '';
  }
}

function makeQuoteNo(value: string) {
  const date = value || todayIso();
  return `Q-${date.replace(/-/g, '')}-01`;
}

function defaultForm(): QuotationForm {
  const date = todayIso();

  return {
    quoteNo: makeQuoteNo(date),
    date,
    hijriDate: hijriForDate(date),
    customer:
      'شركة مور سيف للمقاولات المحترمين',
    greeting:
      'السلام عليكم ورحمة الله وبركاته، وبعد...',
    intro:
      'بالإشارة إلى طلبكم استئجار المعدات، يسعدنا أن نقدّم لكم عرض الأسعار التالي:',
    phone: '0558995962',
    region: 'خميس مشيط • أبها • المنطقة الجنوبية',
    workDays: 'الدوام الشهري: 26 يوم عمل',
    workHours: 'ساعات العمل: 8 ساعات يوميًا',
    housingDiesel:
      'السكن والديزل على الجهة المستأجرة',
    vatNote:
      'الأسعار لا تشمل ضريبة القيمة المضافة',
    extraNote:
      'يمكن إضافة أي شروط أخرى من داخل التطبيق قبل الحفظ.',
    items: [
      {
        id: uid(),
        equipment: 'كرين 25 طن',
        monthly: '17000',
        daily: '',
      },
      {
        id: uid(),
        equipment: 'بوم ترك 5 طن',
        monthly: '14000',
        daily: '',
      },
      {
        id: uid(),
        equipment: 'جي سي بي',
        monthly: '12000',
        daily: '',
      },
    ],
  };
}

function normalizeNumber(value: string) {
  return String(value || '')
    .replace(/[٠-٩]/g, (digit) =>
      String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))
    )
    .replace(/[۰-۹]/g, (digit) =>
      String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))
    )
    .replace(/[^0-9.]/g, '');
}

function money(value: string) {
  const normalized = normalizeNumber(value);
  if (!normalized) return '—';

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return value;

  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(amount)} ريال`;
}

function safeFilePart(value: string) {
  return value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[\\/:*?"<>|]/g, '')
    .slice(0, 50);
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black text-slate-300">
        {label}
      </span>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-right text-sm font-bold text-white outline-none transition focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/10"
      />
    </label>
  );
}

function QuotationDocument({
  data,
}: {
  data: QuotationForm;
}) {
  const visibleItems = data.items.slice(0, 6);

  return (
    <div
      dir="rtl"
      style={{
        width: PAPER_WIDTH,
        height: PAPER_HEIGHT,
        position: 'relative',
        overflow: 'hidden',
        background: '#f3f6fa',
        color: '#102b4b',
        fontFamily:
          'Tajawal, "Noto Kufi Arabic", Arial, sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 18,
          overflow: 'hidden',
          borderRadius: 22,
          background: '#ffffff',
          border: '1px solid #dce5ef',
        }}
      >
        <header
          style={{
            height: 190,
            position: 'relative',
            overflow: 'hidden',
            background:
              'linear-gradient(135deg,#071426 0%,#0b2444 58%,#174c7b 100%)',
            color: '#ffffff',
            borderBottom: '7px solid #d7a936',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.08,
              backgroundImage:
                'radial-gradient(circle at 2px 2px,#fff 1.3px,transparent 0)',
              backgroundSize: '18px 18px',
            }}
          />

          <div
            style={{
              position: 'absolute',
              right: 42,
              top: 25,
              width: 102,
              height: 102,
              borderRadius: 26,
              border: '3px solid #e5b94f',
              background: '#091a30',
              color: '#edc55b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 51,
              fontWeight: 900,
              transform: 'rotate(-2deg)',
            }}
          >
            B
          </div>

          <div
            style={{
              position: 'absolute',
              right: 168,
              top: 28,
              textAlign: 'right',
            }}
          >
            <div
              dir="ltr"
              style={{
                fontSize: 34,
                fontWeight: 950,
                letterSpacing: 1,
              }}
            >
              BAKR{' '}
              <span style={{ color: '#e5b94f' }}>
                PRO
              </span>
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 18,
                fontWeight: 850,
              }}
            >
              إدارة وتأجير الكرينات والمعدات
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: '#bdcad9',
                fontWeight: 700,
              }}
            >
              احترافية في الرفع • دقة في التنفيذ • التزام بالمواعيد
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              right: 168,
              bottom: 18,
              borderRadius: 20,
              padding: '7px 16px',
              background: 'rgba(255,255,255,0.09)',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {data.region || 'خميس مشيط • أبها'}
          </div>

          <div
            style={{
              position: 'absolute',
              left: 40,
              top: 38,
              opacity: 0.16,
              width: 275,
              height: 100,
              borderBottom: '7px solid #e8c45d',
              transform: 'skewY(-16deg)',
            }}
          />
        </header>

        <section
          style={{
            position: 'absolute',
            top: 138,
            left: 45,
            right: 45,
            height: 105,
            borderRadius: 20,
            background: '#ffffff',
            boxShadow: '0 12px 30px rgba(5,19,36,0.16)',
            borderRight: '8px solid #d5a735',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            alignItems: 'center',
            padding: '18px 26px',
          }}
        >
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                color: '#728399',
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              عرض تجاري لتأجير المعدات
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 34,
                fontWeight: 950,
                color: '#0b2444',
              }}
            >
              عرض سعر احترافي
            </div>
          </div>

          <div
            dir="ltr"
            style={{
              textAlign: 'left',
              borderLeft: '1px solid #e2e8f0',
              paddingLeft: 20,
            }}
          >
            <div
              style={{
                color: '#718096',
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 0.6,
              }}
            >
              QUOTATION NO.
            </div>
            <div
              style={{
                marginTop: 3,
                color: '#0b2444',
                fontSize: 16,
                fontWeight: 900,
              }}
            >
              {data.quoteNo || '—'}
            </div>
            <div
              style={{
                width: 210,
                height: 1,
                margin: '8px 0 7px',
                background: '#dde5ee',
              }}
            />
            <div
              style={{
                color: '#718096',
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {formatDisplayDate(data.date)}
            </div>
            <div
              dir="rtl"
              style={{
                marginTop: 3,
                color: '#718096',
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {data.hijriDate}
            </div>
          </div>
        </section>

        <main
          style={{
            position: 'absolute',
            top: 265,
            left: 45,
            right: 45,
            bottom: 70,
          }}
        >
          <section
            style={{
              minHeight: 74,
              padding: '14px 20px',
              borderRadius: 17,
              background:
                'linear-gradient(135deg,#f7fbff,#eef4fa)',
              border: '1px solid #d8e4ef',
              borderRight: '54px solid #0b2444',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                color: '#b07e18',
              }}
            >
              موجّه إلى
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 18,
                fontWeight: 950,
                color: '#102b4b',
              }}
            >
              السادة / {data.customer || '—'}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: '#61758a',
                fontWeight: 650,
              }}
            >
              {data.greeting}
            </div>
          </section>

          <div
            style={{
              margin: '15px 4px 11px',
              fontSize: 13,
              fontWeight: 800,
              color: '#34495e',
            }}
          >
            {data.intro}
          </div>

          <section
            style={{
              overflow: 'hidden',
              borderRadius: 16,
              border: '1px solid #d8e2ec',
              boxShadow: '0 7px 20px rgba(7,20,38,0.08)',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
              }}
            >
              <thead>
                <tr
                  style={{
                    height: 48,
                    background: '#0b2444',
                    color: '#ffffff',
                    borderBottom: '3px solid #d6a737',
                  }}
                >
                  <th
                    style={{
                      width: 64,
                      fontSize: 12,
                      fontWeight: 900,
                      borderLeft:
                        '1px solid rgba(255,255,255,0.35)',
                    }}
                  >
                    م
                  </th>
                  <th
                    style={{
                      width: 280,
                      fontSize: 12,
                      fontWeight: 900,
                      borderLeft:
                        '1px solid rgba(255,255,255,0.35)',
                    }}
                  >
                    نوع المعدة
                  </th>
                  <th
                    style={{
                      width: 175,
                      fontSize: 12,
                      fontWeight: 900,
                      borderLeft:
                        '1px solid rgba(255,255,255,0.35)',
                    }}
                  >
                    الإيجار الشهري
                  </th>
                  <th
                    style={{
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    الإيجار اليومي
                  </th>
                </tr>
              </thead>

              <tbody>
                {visibleItems.map((item, index) => (
                  <tr
                    key={item.id}
                    style={{
                      height: 48,
                      background:
                        index % 2 === 0
                          ? '#ffffff'
                          : '#f5f9fc',
                    }}
                  >
                    <td
                      style={{
                        textAlign: 'center',
                        borderLeft: '1px solid #dce4ec',
                        borderTop: '1px solid #dce4ec',
                        fontSize: 13,
                        fontWeight: 900,
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          width: 27,
                          height: 27,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '50%',
                          background: '#edf3f9',
                        }}
                      >
                        {index + 1}
                      </span>
                    </td>
                    <td
                      style={{
                        textAlign: 'center',
                        borderLeft: '1px solid #dce4ec',
                        borderTop: '1px solid #dce4ec',
                        padding: '5px 8px',
                        fontSize: 14,
                        fontWeight: 850,
                      }}
                    >
                      {item.equipment || '—'}
                    </td>
                    <td
                      style={{
                        textAlign: 'center',
                        borderLeft: '1px solid #dce4ec',
                        borderTop: '1px solid #dce4ec',
                        padding: '5px 8px',
                        fontSize: 14,
                        fontWeight: 900,
                      }}
                    >
                      {money(item.monthly)}
                    </td>
                    <td
                      style={{
                        textAlign: 'center',
                        borderTop: '1px solid #dce4ec',
                        padding: '5px 8px',
                        color: item.daily
                          ? '#102b4b'
                          : '#91a0af',
                        fontSize: 14,
                        fontWeight: 850,
                      }}
                    >
                      {money(item.daily)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section style={{ marginTop: 16 }}>
            <div
              style={{
                marginBottom: 9,
                fontSize: 18,
                fontWeight: 950,
                color: '#0b2444',
              }}
            >
              الشروط والتفاصيل
            </div>

            <div
              style={{
                borderRadius: 16,
                border: '1px solid #dce5ee',
                background: '#f8fafc',
                padding: '13px 17px 10px',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  columnGap: 18,
                  rowGap: 10,
                }}
              >
                {[
                  data.workDays,
                  data.workHours,
                  data.housingDiesel,
                  data.vatNote,
                ].map((text, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 11,
                      color: '#354a60',
                      fontWeight: 800,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        width: 19,
                        height: 19,
                        flex: '0 0 19px',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        color: '#e8bd54',
                        background: '#0b2444',
                        fontSize: 12,
                        fontWeight: 950,
                      }}
                    >
                      ✓
                    </span>
                    <span>{text || '—'}</span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: 11,
                  borderRadius: 12,
                  padding: '6px 12px',
                  color: '#916612',
                  background: '#fff7e3',
                  fontSize: 9.5,
                  fontWeight: 800,
                }}
              >
                ملاحظة: {data.extraNote || '—'}
              </div>
            </div>
          </section>

          <section
            style={{
              marginTop: 16,
              height: 92,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              overflow: 'hidden',
              borderRadius: 16,
              border: '1px solid #dce5ee',
            }}
          >
            <div
              style={{
                padding: '13px 22px',
                borderLeft: '1px solid #dce5ee',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: '#64778c',
                  fontWeight: 900,
                }}
              >
                اعتماد الجهة المستأجرة
              </div>
              <div
                style={{
                  marginTop: 12,
                  color: '#94a3b3',
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                الاسم والتوقيع والختم
              </div>
              <div
                style={{
                  marginTop: 10,
                  borderTop: '1px dashed #b9c5d1',
                }}
              />
            </div>

            <div
              style={{
                padding: '13px 22px',
                position: 'relative',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: '#64778c',
                  fontWeight: 900,
                }}
              >
                مع خالص التحية والتقدير
              </div>
              <div
                dir="ltr"
                style={{
                  marginTop: 8,
                  fontSize: 23,
                  color: '#0b2444',
                  fontWeight: 950,
                }}
              >
                BAKR{' '}
                <span style={{ color: '#c8972a' }}>
                  PRO
                </span>
              </div>
              <div
                style={{
                  position: 'absolute',
                  left: 18,
                  top: 16,
                  width: 55,
                  height: 55,
                  borderRadius: '50%',
                  border: '3px solid #d3a33b',
                  color: '#b67d12',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  fontSize: 8,
                  fontWeight: 950,
                }}
              >
                BAKR
                <br />
                PRO
              </div>
            </div>
          </section>
        </main>

        <footer
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 52,
            borderTop: '5px solid #d7a936',
            background: '#071426',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 28px',
            fontSize: 11,
            fontWeight: 850,
          }}
        >
          <span>
            {data.phone} • خميس مشيط وأبها • جاهزون لخدمتكم
          </span>
          <span dir="ltr" style={{ color: '#bac8d7' }}>
            BAKR PRO • PROFESSIONAL CRANE SERVICES
          </span>
        </footer>
      </div>
    </div>
  );
}

export function QuotationProPage() {
  const [form, setForm] =
    useState<QuotationForm>(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return defaultForm();

        const parsed = JSON.parse(saved);
        return {
          ...defaultForm(),
          ...parsed,
          items:
            Array.isArray(parsed?.items) &&
            parsed.items.length
              ? parsed.items
              : defaultForm().items,
        };
      } catch {
        return defaultForm();
      }
    });

  const [previewOpen, setPreviewOpen] =
    useState(false);

  const [busy, setBusy] =
    useState<'pdf' | 'image' | 'share' | null>(
      null
    );

  const paperRef =
    useRef<HTMLDivElement | null>(null);

  const previewScale = useMemo(() => {
    if (typeof window === 'undefined') return 0.42;
    return Math.min(
      0.92,
      Math.max(0.34, (window.innerWidth - 34) / PAPER_WIDTH)
    );
  }, [previewOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(form)
      );
    } catch (error) {
      console.error(
        'Professional quotation save error:',
        error
      );
    }
  }, [form]);

  function update<K extends keyof QuotationForm>(
    key: K,
    value: QuotationForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateDate(value: string) {
    setForm((current) => ({
      ...current,
      date: value,
      hijriDate: hijriForDate(value),
      quoteNo:
        current.quoteNo === makeQuoteNo(current.date) ||
        !current.quoteNo
          ? makeQuoteNo(value)
          : current.quoteNo,
    }));
  }

  function updateItem(
    id: string,
    key: keyof Omit<QuotationItem, 'id'>,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id
          ? { ...item, [key]: value }
          : item
      ),
    }));
  }

  function addItem() {
    setForm((current) => {
      if (current.items.length >= 6) {
        window.alert(
          'الحد الأقصى 6 معدات في صفحة واحدة.'
        );
        return current;
      }

      return {
        ...current,
        items: [
          ...current.items,
          {
            id: uid(),
            equipment: '',
            monthly: '',
            daily: '',
          },
        ],
      };
    });
  }

  function removeItem(id: string) {
    setForm((current) => {
      if (current.items.length <= 1) return current;
      return {
        ...current,
        items: current.items.filter(
          (item) => item.id !== id
        ),
      };
    });
  }

  async function capturePaper() {
    if (!paperRef.current) {
      throw new Error('تعذر تجهيز عرض السعر');
    }

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    return html2canvas(paperRef.current, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#f3f6fa',
      logging: false,
      width: PAPER_WIDTH,
      height: PAPER_HEIGHT,
      windowWidth: PAPER_WIDTH,
      windowHeight: PAPER_HEIGHT,
    });
  }

  async function createPdf() {
    const canvas = await capturePaper();
    const image = canvas.toDataURL('image/jpeg', 0.97);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    pdf.addImage(
      image,
      'JPEG',
      0,
      0,
      210,
      297,
      undefined,
      'FAST'
    );

    return pdf;
  }

  function fileBase() {
    const customer =
      safeFilePart(form.customer) || 'عميل';
    return `عرض-سعر-احترافي-${customer}-${form.date}`;
  }

  async function savePdf() {
    try {
      setBusy('pdf');
      const pdf = await createPdf();
      const name = `${fileBase()}.pdf`;

      if (!Capacitor.isNativePlatform()) {
        pdf.save(name);
        return;
      }

      const base64 = pdf
        .output('datauristring')
        .split(',')[1];

      const result = await Filesystem.writeFile({
        path: name,
        data: base64,
        directory: Directory.Documents,
        recursive: true,
      });

      window.alert(
        `تم حفظ ملف PDF بنجاح\n${result.uri}`
      );
    } catch (error) {
      console.error(error);
      window.alert('تعذر حفظ ملف PDF. حاول مرة أخرى.');
    } finally {
      setBusy(null);
    }
  }

  async function saveImage() {
    try {
      setBusy('image');
      const canvas = await capturePaper();
      const name = `${fileBase()}.png`;
      const dataUrl = canvas.toDataURL('image/png');

      if (!Capacitor.isNativePlatform()) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = name;
        link.click();
        return;
      }

      const result = await Filesystem.writeFile({
        path: name,
        data: dataUrl.split(',')[1],
        directory: Directory.Documents,
        recursive: true,
      });

      window.alert(
        `تم حفظ الصورة بنجاح\n${result.uri}`
      );
    } catch (error) {
      console.error(error);
      window.alert('تعذر حفظ الصورة. حاول مرة أخرى.');
    } finally {
      setBusy(null);
    }
  }

  async function sharePdf() {
    try {
      setBusy('share');
      const pdf = await createPdf();
      const name = `${fileBase()}.pdf`;

      if (!Capacitor.isNativePlatform()) {
        pdf.save(name);
        window.alert(
          'تم تنزيل الملف. يمكنك مشاركته الآن عبر واتساب.'
        );
        return;
      }

      const base64 = pdf
        .output('datauristring')
        .split(',')[1];

      const file = await Filesystem.writeFile({
        path: name,
        data: base64,
        directory: Directory.Cache,
        recursive: true,
      });

      await Share.share({
        title: 'عرض سعر احترافي',
        text: `عرض سعر من BAKR PRO - ${form.customer}`,
        url: file.uri,
        dialogTitle: 'مشاركة عرض السعر',
      });
    } catch (error) {
      console.error(error);
      window.alert('تعذرت المشاركة. حاول مرة أخرى.');
    } finally {
      setBusy(null);
    }
  }

  function resetNewQuotation() {
    if (
      !window.confirm(
        'بدء عرض سعر احترافي جديد؟ سيتم مسح بيانات هذه الصفحة فقط، ولن يتأثر عرض السعر القديم.'
      )
    ) {
      return;
    }

    setForm(defaultForm());
  }

  return (
    <AppLayout showBottomNav={false}>
      <div
        dir="rtl"
        className="w-full pb-32 text-white"
      >
        <section
          className="relative mb-4 overflow-hidden rounded-[26px] border border-amber-400/20 p-5"
          style={{
            background:
              'linear-gradient(135deg,rgba(8,22,40,0.98),rgba(15,50,82,0.96))',
            boxShadow:
              '0 18px 45px rgba(0,0,0,0.24)',
          }}
        >
          <div className="absolute -left-10 -top-12 h-36 w-36 rounded-full bg-amber-400/10 blur-2xl" />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1.5 text-[10px] font-black text-amber-300">
                <ShieldCheck size={14} />
                صفحة جديدة مستقلة
              </div>

              <h1 className="text-[24px] font-black text-white">
                عرض سعر احترافي
              </h1>

              <p className="mt-2 max-w-[290px] text-[11px] leading-5 text-slate-300">
                تصميم A4 احترافي للحفظ كصورة أو PDF.
                عرض السعر القديم سيبقى كما هو بدون أي تغيير.
              </p>
            </div>

            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-400/10 text-amber-300">
              <FileText size={28} />
            </div>
          </div>
        </section>

        <section className="mb-4 rounded-[24px] border border-white/8 bg-slate-900/70 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-black text-white">
              بيانات العرض
            </h2>
            <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-[9px] font-bold text-emerald-300">
              حفظ تلقائي مستقل
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="رقم عرض السعر"
              value={form.quoteNo}
              onChange={(value) =>
                update('quoteNo', value)
              }
            />

            <Field
              label="التاريخ"
              type="date"
              value={form.date}
              onChange={updateDate}
            />

            <Field
              label="التاريخ الهجري"
              value={form.hijriDate}
              onChange={(value) =>
                update('hijriDate', value)
              }
            />

            <Field
              label="اسم العميل أو الشركة"
              value={form.customer}
              onChange={(value) =>
                update('customer', value)
              }
            />

            <Field
              label="رقم الجوال"
              value={form.phone}
              onChange={(value) =>
                update('phone', value)
              }
            />

            <Field
              label="منطقة الخدمة"
              value={form.region}
              onChange={(value) =>
                update('region', value)
              }
            />
          </div>
        </section>

        <section className="mb-4 rounded-[24px] border border-white/8 bg-slate-900/70 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-white">
                المعدات والأسعار
              </h2>
              <p className="mt-1 text-[9px] text-slate-500">
                حتى 6 معدات في عرض السعر الواحد
              </p>
            </div>

            <button
              type="button"
              onClick={addItem}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-amber-400 px-3 text-[11px] font-black text-slate-950 active:scale-95"
            >
              <Plus size={16} />
              إضافة معدة
            </button>
          </div>

          <div className="space-y-3">
            {form.items.map((item, index) => (
              <div
                key={item.id}
                className="rounded-2xl border border-white/8 bg-slate-950/40 p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-400/15 text-[11px] font-black text-amber-300">
                    {index + 1}
                  </span>

                  <button
                    type="button"
                    disabled={form.items.length <= 1}
                    onClick={() => removeItem(item.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-rose-400/10 text-rose-300 disabled:cursor-not-allowed disabled:opacity-25"
                    aria-label="حذف المعدة"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field
                    label="نوع المعدة"
                    value={item.equipment}
                    placeholder="مثال: كرين 25 طن"
                    onChange={(value) =>
                      updateItem(
                        item.id,
                        'equipment',
                        value
                      )
                    }
                  />

                  <Field
                    label="الإيجار الشهري"
                    value={item.monthly}
                    placeholder="17000"
                    onChange={(value) =>
                      updateItem(
                        item.id,
                        'monthly',
                        value
                      )
                    }
                  />

                  <Field
                    label="الإيجار اليومي"
                    value={item.daily}
                    placeholder="اختياري"
                    onChange={(value) =>
                      updateItem(
                        item.id,
                        'daily',
                        value
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-4 rounded-[24px] border border-white/8 bg-slate-900/70 p-4">
          <h2 className="mb-4 text-sm font-black text-white">
            الشروط والنصوص
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="الدوام الشهري"
              value={form.workDays}
              onChange={(value) =>
                update('workDays', value)
              }
            />
            <Field
              label="ساعات العمل"
              value={form.workHours}
              onChange={(value) =>
                update('workHours', value)
              }
            />
            <Field
              label="السكن والديزل"
              value={form.housingDiesel}
              onChange={(value) =>
                update('housingDiesel', value)
              }
            />
            <Field
              label="الضريبة"
              value={form.vatNote}
              onChange={(value) =>
                update('vatNote', value)
              }
            />
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-[11px] font-black text-slate-300">
              ملاحظة إضافية
            </span>
            <textarea
              value={form.extraNote}
              onChange={(event) =>
                update('extraNote', event.target.value)
              }
              rows={3}
              className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-right text-sm font-bold text-white outline-none focus:border-amber-400/60"
            />
          </label>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-3.5 text-xs font-black text-cyan-200 active:scale-[0.98]"
          >
            <Eye size={18} />
            معاينة
          </button>

          <button
            type="button"
            onClick={savePdf}
            disabled={busy !== null}
            className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-amber-400 px-3 py-3.5 text-xs font-black text-slate-950 active:scale-[0.98] disabled:opacity-60"
          >
            <FileDown size={18} />
            {busy === 'pdf' ? 'جاري الحفظ...' : 'حفظ PDF'}
          </button>

          <button
            type="button"
            onClick={saveImage}
            disabled={busy !== null}
            className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-3.5 text-xs font-black text-emerald-200 active:scale-[0.98] disabled:opacity-60"
          >
            <FileImage size={18} />
            {busy === 'image'
              ? 'جاري الحفظ...'
              : 'حفظ صورة'}
          </button>

          <button
            type="button"
            onClick={sharePdf}
            disabled={busy !== null}
            className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl border border-violet-300/20 bg-violet-400/10 px-3 py-3.5 text-xs font-black text-violet-200 active:scale-[0.98] disabled:opacity-60"
          >
            <Share2 size={18} />
            {busy === 'share'
              ? 'جاري التجهيز...'
              : 'مشاركة'}
          </button>
        </section>

        <button
          type="button"
          onClick={resetNewQuotation}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/8 bg-white/5 py-3 text-[11px] font-bold text-slate-400 active:scale-[0.99]"
        >
          <Save size={16} />
          بدء عرض سعر احترافي جديد
        </button>

        {/* نسخة ثابتة خارج الشاشة للحفظ بجودة عالية */}
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: -10000,
            top: 0,
            width: PAPER_WIDTH,
            height: PAPER_HEIGHT,
            pointerEvents: 'none',
          }}
        >
          <div ref={paperRef}>
            <QuotationDocument data={form} />
          </div>
        </div>

        {previewOpen && (
          <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/95 p-4 backdrop-blur-md">
            <div className="mx-auto max-w-lg">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-white">
                    معاينة عرض السعر الاحترافي
                  </h3>
                  <p className="mt-1 text-[10px] text-slate-400">
                    هذه هي الصورة التي ستُحفظ داخل PDF
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/8 text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div
                style={{
                  height: PAPER_HEIGHT * previewScale,
                  width: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 18,
                }}
              >
                <div
                  style={{
                    width: PAPER_WIDTH,
                    height: PAPER_HEIGHT,
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top right',
                    position: 'absolute',
                    top: 0,
                    right: 0,
                  }}
                >
                  <QuotationDocument data={form} />
                </div>
              </div>

              <button
                type="button"
                onClick={savePdf}
                disabled={busy !== null}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-4 text-sm font-black text-slate-950 disabled:opacity-60"
              >
                <FileDown size={19} />
                حفظ PDF بهذا التصميم
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

