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
  const [hijriDate, setHijriDate] = useState('1448 /  /  هـ');
  const [subject, setSubject] = useState('عرض سعر تأجير معدات');

  const [headerEn1, setHeaderEn1] = useState('Establishment of');
  const [headerEn2, setHeaderEn2] = useState('Sultan Sorour Al-Qathami');
  const [headerEn3, setHeaderEn3] = useState('For Equipment Rental');

  const [headerAr1, setHeaderAr1] = useState('مؤسسة');
  const [headerAr2, setHeaderAr2] = useState('سلطان سرور القثامي');
  const [headerAr3, setHeaderAr3] = useState('لتأجير المعدات');

  const [intro1, setIntro1] = useState('السلام عليكم ورحمة الله وبركاته');
  const [intro2, setIntro2] = useState('نفيدكم نحن مؤسسة / سلطان سرور القثامي للمقاولات المعمارية');
  const [intro3, setIntro3] = useState('إليكم تسعيرتنا بخصوص المعدات التالية :');
  const [intro4, setIntro4] = useState('');

  const [closingText, setClosingText] = useState('نأمل أن تحوز تسعيرتنا على رضاكم');
  const [notes, setNotes] = useState('السعر غير شامل الديزل والضريبة.');

  const [signatureTitle, setSignatureTitle] = useState('المؤسسة');
  const [signatureName, setSignatureName] = useState('سلطان سرور القثامي للمقاولات المعمارية');

  const [footerAr, setFooterAr] = useState(
    'المملكة العربية السعودية - مكة المكرمة - س.ت : ٤٠٣١٢٤٢٨٨٠ - جوال : ٠٥٠٩٦٩٧٧٢٠'
  );
  const [footerEn, setFooterEn] = useState(
    'Kingdom of Saudi Arabia - Makkah. - C.R.: 4031242880 - Mobile: 0509697720'
  );

  const [rows, setRows] = useState<QuoteRow[]>([
    newRow(1),
    newRow(2),
    newRow(3),
    newRow(4),
  ]);

  const filledRows = useMemo(
    () =>
      rows.filter(
        (r) => r.equipment.trim() || r.monthly.trim() || r.daily.trim()
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

  const buildPdf = async () => {
    const el = document.getElementById('quotation-print');
    if (!el) throw new Error('quotation preview not found');

    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.position = 'fixed';
    clone.style.left = '-10000px';
    clone.style.top = '0';
    clone.style.width = '794px';
    clone.style.height = '1123px';
    clone.style.minHeight = '1123px';
    clone.style.maxHeight = '1123px';
    clone.style.margin = '0';
    clone.style.borderRadius = '0';
    clone.style.boxShadow = 'none';
    clone.style.transform = 'none';
    clone.style.background = '#ffffff';
    clone.style.overflow = 'hidden';

    document.body.appendChild(clone);

    try {
      const canvas = await html2canvas(clone, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        width: 794,
        height: 1123,
        windowWidth: 794,
        windowHeight: 1123,
        scrollX: 0,
        scrollY: 0,
      });

      const image = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(image, 'JPEG', 0, 0, 210, 297);
      return pdf;
    } finally {
      clone.remove();
    }
  };

  const savePdf = async () => {
    try {
      const pdf = await buildPdf();
      const base64 = pdf.output('datauristring').split(',')[1];
      const fileName = `quotation-${date}.pdf`;

      await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      });

      alert('تم إنشاء ملف عرض السعر PDF');
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء إنشاء PDF');
    }
  };

  const sharePdf = async () => {
    try {
      const pdf = await buildPdf();
      const base64 = pdf.output('datauristring').split(',')[1];
      const fileName = `quotation-${date}.pdf`;

      const saved = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      });

      await Share.share({
        title: 'عرض سعر',
        text: company ? `عرض سعر موجه إلى ${company}` : 'عرض سعر تأجير معدات',
        url: saved.uri,
        dialogTitle: 'مشاركة عرض السعر',
      });
    } catch (error) {
      console.error(error);
      alert('تعذر مشاركة عرض السعر');
    }
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
      hijriDate ? `التاريخ الهجري: ${hijriDate}` : '',
      ...lines,
      notes ? `ملاحظات: ${notes}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
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
      <section className="space-y-4 pb-8" dir="rtl">
        <div className="pt-2">
          <h1 className="text-xl font-extrabold text-white">عرض سعر</h1>
          <p className="text-xs text-slate-400 mt-1">
            جميع عبارات عرض السعر قابلة للتعديل
          </p>
        </div>

        <Card className="p-4 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-2">موجه إلى</label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="اسم الشركة أو المؤسسة"
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-2">التاريخ الميلادي</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-2">التاريخ الهجري</label>
              <input
                value={hijriDate}
                onChange={(e) => setHijriDate(e.target.value)}
                placeholder="1448 / 02 / 25 هـ"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-2">الموضوع</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none"
            />
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="text-sm font-bold text-white">تعديل ترويسة عرض السعر</h2>

          <input
            value={headerAr1}
            onChange={(e) => setHeaderAr1(e.target.value)}
            placeholder="السطر العربي الأول"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none"
          />

          <input
            value={headerAr2}
            onChange={(e) => setHeaderAr2(e.target.value)}
            placeholder="السطر العربي الثاني"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none"
          />

          <input
            value={headerAr3}
            onChange={(e) => setHeaderAr3(e.target.value)}
            placeholder="السطر العربي الثالث"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none"
          />

          <input
            value={headerEn1}
            onChange={(e) => setHeaderEn1(e.target.value)}
            placeholder="Establishment of"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none"
            dir="ltr"
          />

          <input
            value={headerEn2}
            onChange={(e) => setHeaderEn2(e.target.value)}
            placeholder="Sultan Sorour Al-Qathami"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none"
            dir="ltr"
          />

          <input
            value={headerEn3}
            onChange={(e) => setHeaderEn3(e.target.value)}
            placeholder="For Equipment Rental"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none"
            dir="ltr"
          />
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="text-sm font-bold text-white">تعديل نص الخطاب</h2>

          <input
            value={intro1}
            onChange={(e) => setIntro1(e.target.value)}
            placeholder="السطر 1"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none"
          />

          <input
            value={intro2}
            onChange={(e) => setIntro2(e.target.value)}
            placeholder="السطر 2"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none"
          />

          <input
            value={intro3}
            onChange={(e) => setIntro3(e.target.value)}
            placeholder="السطر 3"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none"
          />

          <input
            value={intro4}
            onChange={(e) => setIntro4(e.target.value)}
            placeholder="السطر 4 - اكتب أي عبارة تريدها"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none"
          />
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white">المعدات والأسعار</h2>
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
                      onClick={() => removeRow(row.id)}
                      className="text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <input
                  value={row.equipment}
                  onChange={(e) =>
                    updateRow(row.id, 'equipment', e.target.value)
                  }
                  placeholder="نوع المعدة"
                  className="w-full mb-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white outline-none"
                />

                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={row.monthly}
                    onChange={(e) =>
                      updateRow(row.id, 'monthly', e.target.value)
                    }
                    inputMode="decimal"
                    placeholder="الإيجار الشهري"
                    className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white outline-none"
                  />

                  <input
                    value={row.daily}
                    onChange={(e) =>
                      updateRow(row.id, 'daily', e.target.value)
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

        <Card className="p-4 space-y-3">
          <h2 className="text-sm font-bold text-white">تعديل العبارات السفلية</h2>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="الشروط والملاحظات"
            className="w-full resize-none rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-sm text-white outline-none"
          />

          <input
            value={closingText}
            onChange={(e) => setClosingText(e.target.value)}
            placeholder="نأمل أن تحوز تسعيرتنا على رضاكم"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none"
          />

          <input
            value={signatureTitle}
            onChange={(e) => setSignatureTitle(e.target.value)}
            placeholder="المؤسسة"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none"
          />

          <input
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
            placeholder="اسم المؤسسة أسفل العرض"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none"
          />

          <textarea
            value={footerAr}
            onChange={(e) => setFooterAr(e.target.value)}
            rows={2}
            placeholder="بيانات أسفل الصفحة بالعربي"
            className="w-full resize-none rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-sm text-white outline-none"
          />

          <textarea
            value={footerEn}
            onChange={(e) => setFooterEn(e.target.value)}
            rows={2}
            placeholder="Footer English"
            className="w-full resize-none rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-sm text-white outline-none"
            dir="ltr"
          />
        </Card>

        <div
          id="quotation-print"
          dir="rtl"
          style={{
            width: '100%',
            minHeight: '1123px',
            background: '#ffffff',
            color: '#111111',
            padding: '28px 30px 24px',
            borderRadius: 18,
            fontFamily: 'Arial, Tahoma, sans-serif',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 30,
              alignItems: 'start',
              padding: '6px 18px 14px',
            }}
          >
            <div style={{ direction: 'ltr', textAlign: 'center' }}>
              <div style={{ fontSize: 17 }}>{headerEn1}</div>
              <div
                style={{
                  fontSize: 23,
                  fontWeight: 800,
                  color: '#173a85',
                  marginTop: 5,
                }}
              >
                {headerEn2}
              </div>
              <div style={{ fontSize: 17, marginTop: 5 }}>{headerEn3}</div>
            </div>

            <div
              style={{
                textAlign: 'center',
                color: '#173a85',
                lineHeight: 1.45,
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 700 }}>{headerAr1}</div>
              <div style={{ fontSize: 23, fontWeight: 900, marginTop: 4 }}>{headerAr2}</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{headerAr3}</div>
            </div>
          </div>

          <div
            style={{
              border: '2px solid #173a85',
              borderRadius: 20,
              padding: '20px 24px 18px',
              minHeight: '980px',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                direction: 'ltr',
                fontSize: 15,
              }}
            >
              <div>Date : {date}</div>
              <div style={{ direction: 'rtl' }}>التاريخ : {hijriDate}</div>
            </div>

            <div
              style={{
                textAlign: 'center',
                fontSize: 30,
                fontWeight: 900,
                textDecoration: 'underline',
                marginTop: 44,
              }}
            >
              عرض سعر
            </div>

            <div
              style={{
                fontSize: 21,
                fontWeight: 800,
                textAlign: 'center',
                marginTop: 28,
              }}
            >
              السادة / {company || '________________'} &nbsp;&nbsp; المحترمين
            </div>

            <div
              style={{
                fontSize: 18,
                lineHeight: 2.1,
                textAlign: 'right',
                marginTop: 26,
              }}
            >
              <div>{intro1}</div>
              <div>{intro2}</div>
              <div>{intro3}</div>
              {intro4.trim() && <div>{intro4}</div>}
            </div>

            <div
              style={{
                marginTop: 18,
                fontSize: 17,
                fontWeight: 700,
              }}
            >
              الموضوع: {subject}
            </div>

            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginTop: 18,
                fontSize: 15,
                tableLayout: 'fixed',
              }}
            >
              <thead>
                <tr style={{ background: '#d9d9d9' }}>
                  <th style={{ border: '1px solid #666', padding: 9, width: '8%' }}>م</th>
                  <th style={{ border: '1px solid #666', padding: 9, width: '42%' }}>نوع المعدة</th>
                  <th style={{ border: '1px solid #666', padding: 9, width: '25%' }}>الإيجار الشهري</th>
                  <th style={{ border: '1px solid #666', padding: 9, width: '25%' }}>الإيجار اليومي</th>
                </tr>
              </thead>

              <tbody>
                {displayRows.map((row, i) => (
                  <tr key={row.id}>
                    <td style={{ border: '1px solid #888', padding: 10, textAlign: 'center' }}>
                      {i + 1}
                    </td>

                    <td style={{ border: '1px solid #888', padding: 10, textAlign: 'center' }}>
                      {row.equipment || '—'}
                    </td>

                    <td style={{ border: '1px solid #888', padding: 10, textAlign: 'center' }}>
                      {row.monthly ? `${row.monthly} ريال` : '—'}
                    </td>

                    <td style={{ border: '1px solid #888', padding: 10, textAlign: 'center' }}>
                      {row.daily ? `${row.daily} ريال` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div
              style={{
                marginTop: 16,
                fontSize: 16,
                fontWeight: 700,
                whiteSpace: 'pre-wrap',
              }}
            >
              • {notes}
            </div>

            <div
              style={{
                marginTop: 28,
                textAlign: 'center',
                fontSize: 19,
              }}
            >
              {closingText}
            </div>

            <div
              style={{
                marginTop: 34,
                width: '48%',
                textAlign: 'center',
                alignSelf: 'flex-start',
                fontSize: 17,
                lineHeight: 1.8,
              }}
            >
              <div style={{ fontWeight: 800 }}>{signatureTitle}</div>
              <div style={{ marginTop: 12, fontWeight: 700 }}>{signatureName}</div>
            </div>

            <div
              style={{
                marginTop: 'auto',
                borderTop: '1.5px solid #173a85',
                paddingTop: 10,
                textAlign: 'center',
                fontSize: 12,
                lineHeight: 1.7,
              }}
            >
              <div>{footerAr}</div>
              <div dir="ltr" style={{ marginTop: 4 }}>{footerEn}</div>
            </div>
          </div>
        </div>

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
