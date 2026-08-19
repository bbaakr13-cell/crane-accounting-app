import { useMemo, useState } from 'react';
import { FileDown, MessageCircle, Plus, Share2, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';

type QuoteRow = {
  id: number;
  equipment: string;
  monthly: string;
  daily: string;
};

const newRow = (id: number): QuoteRow => ({
  id,
  equipment: '',
  monthly: '',
  daily: '',
});

export function QuotationPage() {
  const [company, setCompany] = useState('شركة الجهاز للمقاولات');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [subject, setSubject] = useState('عرض سعر تأجير معدات');
  const [notes, setNotes] = useState('السعر غير شامل الديزل والضريبة.');

  const [rows, setRows] = useState<QuoteRow[]>([
    newRow(1),
    newRow(2),
    newRow(3),
    newRow(4),
  ]);

  const filledRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.equipment.trim() ||
          r.monthly.trim() ||
          r.daily.trim()
      ),
    [rows]
  );

  const updateRow = (
    id: number,
    key: keyof Omit<QuoteRow, 'id'>,
    value: string
  ) => {
    setRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, [key]: value } : row
      )
    );
  };

  const addRow = () => {
    setRows((current) => [
      ...current,
      newRow((current.at(-1)?.id ?? 0) + 1),
    ]);
  };

  const removeRow = (id: number) => {
    setRows((current) =>
      current.length <= 4
        ? current
        : current.filter((row) => row.id !== id)
    );
  };

  // إنشاء PDF بحجم A4 واضح وكبير
  const buildPdf = async () => {
    const el = document.getElementById('quotation-print');

    if (!el) {
      throw new Error('quotation preview not found');
    }

    const clone = el.cloneNode(true) as HTMLElement;

    clone.style.position = 'fixed';
    clone.style.left = '-10000px';
    clone.style.top = '0';

    clone.style.width = '794px';
    clone.style.minHeight = '1123px';
    clone.style.height = '1123px';

    clone.style.borderRadius = '0';
    clone.style.boxShadow = 'none';
    clone.style.margin = '0';
    clone.style.transform = 'none';
    clone.style.background = '#ffffff';

    document.body.appendChild(clone);

    const canvas = await html2canvas(clone, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      width: 794,
      height: 1123,
      windowWidth: 794,
      windowHeight: 1123,
    });

    document.body.removeChild(clone);

    const image = canvas.toDataURL('image/jpeg', 0.98);

    const pdf = new jsPDF('p', 'mm', 'a4');

    pdf.addImage(
      image,
      'JPEG',
      4,
      4,
      202,
      289
    );

    return pdf;
  };

  const savePdf = async () => {
    const pdf = await buildPdf();

    const base64 =
      pdf.output('datauristring').split(',')[1];

    const fileName =
      `quotation-${date}.pdf`;

    await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    });

    alert('تم إنشاء ملف عرض السعر PDF');
  };

  const sharePdf = async () => {
    const pdf = await buildPdf();

    const base64 =
      pdf.output('datauristring').split(',')[1];

    const fileName =
      `quotation-${date}.pdf`;

    const saved =
      await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      });

    await Share.share({
      title: 'عرض سعر',
      text: company
        ? `عرض سعر موجه إلى ${company}`
        : 'عرض سعر تأجير معدات',
      url: saved.uri,
      dialogTitle: 'مشاركة عرض السعر',
    });
  };

  const sendWhatsApp = () => {
    const lines = filledRows.map(
      (r, i) =>
        `${i + 1}- ${r.equipment || 'معدة'} | شهري: ${
          r.monthly || '-'
        } | يومي: ${r.daily || '-'}`
    );

    const text = [
      'عرض سعر',
      company ? `إلى: ${company}` : '',
      `التاريخ: ${date}`,
      ...lines,
      notes ? `ملاحظات: ${notes}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank'
    );
  };

  const displayRows =
    rows.length >= 4
      ? rows
      : [
          ...rows,
          ...Array.from(
            { length: 4 - rows.length },
            (_, i) => newRow(100 + i)
          ),
        ];

  return (
    <AppLayout>
      <section
        className="space-y-4 pb-8"
        dir="rtl"
      >

        <div className="pt-2">
          <h1 className="text-xl font-extrabold text-white">
            عرض سعر
          </h1>

          <p className="text-xs text-slate-400 mt-1">
            إنشاء عرض سعر رسمي للمؤسسات والشركات
          </p>
        </div>

        <Card className="p-4 space-y-4">

          <div>
            <label className="block text-xs text-slate-400 mb-2">
              موجه إلى
            </label>

            <input
              value={company}
              onChange={(e) =>
                setCompany(e.target.value)
              }
              placeholder="اسم الشركة أو المؤسسة"
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">

            <div>
              <label className="block text-xs text-slate-400 mb-2">
                التاريخ
              </label>

              <input
                type="date"
                value={date}
                onChange={(e) =>
                  setDate(e.target.value)
                }
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-2">
                الموضوع
              </label>

              <input
                value={subject}
                onChange={(e) =>
                  setSubject(e.target.value)
                }
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none"
              />
            </div>

          </div>

        </Card>

        <Card className="p-4">

          <div className="flex items-center justify-between mb-4">

            <div>
              <h2 className="text-sm font-bold text-white">
                المعدات والأسعار
              </h2>

              <p className="text-[11px] text-slate-500 mt-1">
                4 خانات أساسية ويمكن إضافة المزيد
              </p>
            </div>

            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 bg-emerald-500/15 text-emerald-300 text-xs font-bold"
            >
              <Plus className="w-4 h-4" />
              إضافة معدة
            </button>

          </div>

          <div className="space-y-3">

            {rows.map((row, index) => (

              <div
                key={row.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
              >

                <div className="flex justify-between items-center mb-2">

                  <span className="text-xs font-bold text-slate-300">
                    المعدة {index + 1}
                  </span>

                  {rows.length > 4 && (

                    <button
                      type="button"
                      onClick={() =>
                        removeRow(row.id)
                      }
                      className="text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                  )}

                </div>

                <input
                  value={row.equipment}
                  onChange={(e) =>
                    updateRow(
                      row.id,
                      'equipment',
                      e.target.value
                    )
                  }
                  placeholder="نوع المعدة"
                  className="w-full mb-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white outline-none"
                />

                <div className="grid grid-cols-2 gap-2">

                  <input
                    value={row.monthly}
                    onChange={(e) =>
                      updateRow(
                        row.id,
                        'monthly',
                        e.target.value
                      )
                    }
                    inputMode="decimal"
                    placeholder="الإيجار الشهري"
                    className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white outline-none"
                  />

                  <input
                    value={row.daily}
                    onChange={(e) =>
                      updateRow(
                        row.id,
                        'daily',
                        e.target.value
                      )
                    }
                    inputMode="decimal"
                    placeholder="الإيجار اليومي"
                    className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white outline-none"
                  />

                </div>

              </div>

            ))}

          </div>

        </Card>

        <Card className="p-4">

          <label className="block text-xs text-slate-400 mb-2">
            الشروط والملاحظات
          </label>

          <textarea
            value={notes}
            onChange={(e) =>
              setNotes(e.target.value)
            }
            rows={3}
            className="w-full resize-none rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-sm text-white outline-none"
          />

        </Card>

        {/* ورقة عرض السعر */}

        <div
          id="quotation-print"
          dir="rtl"
          style={{
            background: '#fff',
            color: '#111',
            padding: '18px 20px 16px',
            borderRadius: 18,
            fontFamily:
              'Arial, Tahoma, sans-serif',
            boxSizing: 'border-box',
          }}
        >

          {/* رأس المؤسسة */}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              alignItems: 'start',
              gap: 18,
              padding: '2px 14px 12px',
            }}
          >

            {/* English */}

            <div
              style={{
                direction: 'ltr',
                textAlign: 'center',
              }}
            >

              <div style={{ fontSize: 14 }}>
                Establishment of
              </div>

              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: '#173a85',
                  marginTop: 4,
                }}
              >
                Sultan Sorour Al-Qathami
              </div>

              <div
                style={{
                  fontSize: 14,
                  marginTop: 4,
                }}
              >
                For Equipment Rental
              </div>

            </div>

            {/* عربي */}

            <div style={{ textAlign: 'center' }}>

              <div
                style={{
                  fontSize: 15,
                  color: '#173a85',
                  fontWeight: 700,
                }}
              >
                مؤسسة
              </div>

              <div
                style={{
                  fontSize: 21,
                  color: '#173a85',
                  fontWeight: 900,
                  marginTop: 3,
                }}
              >
                سلطان سرور القثامي
              </div>

              <div
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  marginTop: 3,
                }}
              >
                لتأجير المعدات
              </div>

            </div>

          </div>

          {/* جسم الورقة */}

          <div
            style={{
              border: '2px solid #173a85',
              borderRadius: 18,
              padding: '14px 18px 12px',
              minHeight: 770,
            }}
          >

            {/* التاريخ */}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                direction: 'ltr',
                fontSize: 12,
                marginBottom: 28,
              }}
            >

              <div>
                Date&nbsp;&nbsp;:&nbsp;&nbsp;
                {date}
              </div>

              <div style={{ direction: 'rtl' }}>
                التاريخ&nbsp;&nbsp;:&nbsp;&nbsp;
                ____ / ____ / 1448 هـ
              </div>

            </div>

            {/* العنوان */}

            <div
              style={{
                textAlign: 'center',
                fontSize: 22,
                fontWeight: 900,
                textDecoration: 'underline',
                marginBottom: 20,
              }}
            >
              عرض سعر
            </div>

            {/* اسم العميل */}

            <div
              style={{
                fontSize: 17,
                fontWeight: 800,
                textAlign: 'center',
                marginBottom: 18,
              }}
            >
              السادة / {company || '________________'}
              &nbsp;&nbsp; المحترمين
            </div>

            {/* مقدمة */}

            <div
              style={{
                fontSize: 14,
                lineHeight: 2.05,
                textAlign: 'right',
              }}
            >
              السلام عليكم ورحمة الله وبركاته
              <br />

              نفيدكم نحن مؤسسة / سلطان سرور القثامي
              للمقاولات المعمارية

              <br />

              إليكم تسعيرتنا بخصوص المعدات التالية :
            </div>

            {/* الجدول */}

            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginTop: 14,
                fontSize: 12,
                tableLayout: 'fixed',
              }}
            >

              <thead>

                <tr
                  style={{
                    background: '#d9d9d9',
                  }}
                >

                  <th
                    style={{
                      border: '1px solid #666',
                      padding: 6,
                      width: '8%',
                    }}
                  >
                    م
                  </th>

                  <th
                    style={{
                      border: '1px solid #666',
                      padding: 6,
                      width: '42%',
                    }}
                  >
                    نوع المعدة
                  </th>

                  <th
                    style={{
                      border: '1px solid #666',
                      padding: 6,
                      width: '25%',
                    }}
                  >
                    الإيجار الشهري
                  </th>

                  <th
                    style={{
                      border: '1px solid #666',
                      padding: 6,
                      width: '25%',
                    }}
                  >
                    الإيجار اليومي
                  </th>

                </tr>

              </thead>

              <tbody>

                {displayRows.map((row, i) => (

                  <tr key={row.id}>

                    <td
                      style={{
                        border: '1px solid #888',
                        padding: 7,
                        textAlign: 'center',
                      }}
                    >
                      {i + 1}
                    </td>

                    <td
                      style={{
                        border: '1px solid #888',
                        padding: 7,
                        textAlign: 'center',
                      }}
                    >
                      {row.equipment || '—'}
                    </td>

                    <td
                      style={{
                        border: '1px solid #888',
                        padding: 7,
                        textAlign: 'center',
                      }}
                    >
                      {row.monthly
                        ? `${row.monthly} ريال`
                        : '—'}
                    </td>

                    <td
                      style={{
                        border: '1px solid #888',
                        padding: 7,
                        textAlign: 'center',
                      }}
                    >
                      {row.daily
                        ? `${row.daily} ريال`
                        : '—'}
                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

            {/* الملاحظات */}

            <div
              style={{
                marginTop: 10,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              • {notes || 'السعر غير شامل الديزل والضريبة.'}
            </div>

            <div
              style={{
                marginTop: 20,
                textAlign: 'center',
                fontSize: 15,
              }}
            >
              نأمل أن تحوز تسعيرتنا على رضاكم
            </div>

            {/* المؤسسة */}

            <div
              style={{
                width: '48%',
                minHeight: 170,
                border: '1.5px solid #333',
                borderRadius: 14,
                marginTop: 24,
                padding: '14px 12px',
                textAlign: 'center',
                fontSize: 13,
              }}
            >

              <div style={{ fontWeight: 800 }}>
                المؤسسة
              </div>

              <div
                style={{
                  marginTop: 18,
                  fontWeight: 700,
                }}
              >
                سلطان سرور القثامي للمقاولات المعمارية
              </div>

            </div>

            {/* بيانات أسفل الصفحة */}

            <div
              style={{
                marginTop: 18,
                borderTop:
                  '1.5px solid #173a85',
                paddingTop: 8,
                textAlign: 'center',
                fontSize: 10,
              }}
            >

              <div>
                المملكة العربية السعودية - مكة المكرمة -
                س.ت : ٤٠٣١٢٤٢٨٨٠ - جوال :
                ٠٥٠٩٦٩٧٧٢٠
              </div>

              <div
                dir="ltr"
                style={{ marginTop: 4 }}
              >
                Kingdom of Saudi Arabia - Makkah. -
                C.R.: 4031242880 - Mobile:
                0509697720
              </div>

            </div>

          </div>

        </div>

        {/* الأزرار */}

        <div className="grid grid-cols-3 gap-2">

          <button
            type="button"
            onClick={savePdf}
            className="rounded-xl py-3 bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5"
          >
            <FileDown className="w-4 h-4" />
            PDF
          </button>

          <button
            type="button"
            onClick={sharePdf}
            className="rounded-xl py-3 bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5"
          >
            <Share2 className="w-4 h-4" />
            مشاركة
          </button>

          <button
            type="button"
            onClick={sendWhatsApp}
            className="rounded-xl py-3 bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5"
          >
            <MessageCircle className="w-4 h-4" />
            واتساب
          </button>

        </div>

      </section>
    </AppLayout>
  );
    }
