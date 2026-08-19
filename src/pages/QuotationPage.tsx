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
  const [company, setCompany] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [subject, setSubject] = useState('عرض سعر تأجير معدات');
  const [notes, setNotes] = useState('الأسعار حسب الاتفاق، ويمكن تعديل مدة الإيجار حسب حاجة العميل.');
  const [rows, setRows] = useState<QuoteRow[]>([
    newRow(1), newRow(2), newRow(3), newRow(4),
  ]);

  const filledRows = useMemo(
    () => rows.filter((r) => r.equipment.trim() || r.monthly.trim() || r.daily.trim()),
    [rows]
  );

  const updateRow = (id: number, key: keyof Omit<QuoteRow, 'id'>, value: string) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [key]: value } : row));
  };

  const addRow = () => {
    setRows((current) => [...current, newRow((current.at(-1)?.id ?? 0) + 1)]);
  };

  const removeRow = (id: number) => {
    setRows((current) => current.length <= 4 ? current : current.filter((row) => row.id !== id));
  };

  const buildPdf = async () => {
    const el = document.getElementById('quotation-print');
    if (!el) throw new Error('quotation preview not found');

    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
    });
    const image = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const width = 190;
    const height = canvas.height * width / canvas.width;
    pdf.addImage(image, 'JPEG', 10, 10, width, Math.min(height, 277));
    return pdf;
  };

  const savePdf = async () => {
    const pdf = await buildPdf();
    const base64 = pdf.output('datauristring').split(',')[1];
    const fileName = `quotation-${date}.pdf`;
    await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    });
    alert('تم إنشاء ملف عرض السعر PDF');
  };

  const sharePdf = async () => {
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
  };

  const sendWhatsApp = () => {
    const lines = filledRows.map((r, i) =>
      `${i + 1}- ${r.equipment || 'معدة'} | شهري: ${r.monthly || '-'} | يومي: ${r.daily || '-'}`
    );
    const text = [
      'عرض سعر تأجير معدات',
      company ? `إلى: ${company}` : '',
      `التاريخ: ${date}`,
      ...lines,
      notes ? `ملاحظات: ${notes}` : '',
    ].filter(Boolean).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <AppLayout>
      <section className="space-y-4 pb-8" dir="rtl">
        <div className="pt-2 text-center">
          <h1 className="text-xl font-extrabold text-white">عرض سعر</h1>
          <p className="text-xs text-slate-400 mt-1">Quotation</p>
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
              <label className="block text-xs text-slate-400 mb-2">التاريخ</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-2">الموضوع</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none"
              />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white">المعدات والأسعار</h2>
              <p className="text-[11px] text-slate-500 mt-1">4 خانات أساسية ويمكن إضافة المزيد</p>
            </div>
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 bg-emerald-500/15 text-emerald-300 text-xs font-bold"
            >
              <Plus className="w-4 h-4" /> إضافة معدة
            </button>
          </div>

          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-300">المعدة {index + 1}</span>
                  {rows.length > 4 && (
                    <button type="button" onClick={() => removeRow(row.id)} className="text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <input
                  value={row.equipment}
                  onChange={(e) => updateRow(row.id, 'equipment', e.target.value)}
                  placeholder="نوع المعدة"
                  className="w-full mb-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={row.monthly}
                    onChange={(e) => updateRow(row.id, 'monthly', e.target.value)}
                    inputMode="decimal"
                    placeholder="الإيجار الشهري"
                    className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white outline-none"
                  />
                  <input
                    value={row.daily}
                    onChange={(e) => updateRow(row.id, 'daily', e.target.value)}
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
          <label className="block text-xs text-slate-400 mb-2">الشروط والملاحظات</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-sm text-white outline-none"
          />
        </Card>

        {/* Official quotation sheet: this exact area is exported to PDF */}
        <div
          id="quotation-print"
          dir="rtl"
          style={{
            background: '#ffffff',
            color: '#111827',
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow: '0 14px 38px rgba(0,0,0,.28)',
            fontFamily: 'Arial, Tahoma, sans-serif',
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg,#075c34,#0b7a45)',
              color: '#ffffff',
              padding: '18px 22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 900 }}>عرض سعر</div>
              <div style={{ fontSize: 11, opacity: .9, marginTop: 3 }}>لتأجير المعدات والرافعات</div>
            </div>
            <div style={{ textAlign: 'left', direction: 'ltr' }}>
              <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: .3 }}>QUOTATION</div>
              <div style={{ fontSize: 9, opacity: .9, marginTop: 3 }}>EQUIPMENT RENTAL</div>
            </div>
          </div>

          <div style={{ padding: '20px 22px 24px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: 12,
                fontSize: 12,
              }}
            >
              <div><b>موجه إلى:</b> {company || '________________________'}</div>
              <div style={{ textAlign: 'left' }}><b>التاريخ:</b> {date}</div>
            </div>

            <div style={{ marginTop: 16, fontSize: 13, fontWeight: 800 }}>
              الموضوع: {subject}
            </div>

            <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.9 }}>
              السلام عليكم ورحمة الله وبركاته،،
              <br />
              يسرنا أن نقدم لكم عرض السعر التالي لتأجير المعدات، آملين أن ينال رضاكم.
            </div>

            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginTop: 16,
                fontSize: 11,
                tableLayout: 'fixed',
              }}
            >
              <thead>
                <tr style={{ background: '#075c34', color: '#ffffff' }}>
                  <th style={{ border: '1px solid #075c34', padding: 9, width: '9%' }}>م</th>
                  <th style={{ border: '1px solid #075c34', padding: 9, width: '43%' }}>نوع المعدة</th>
                  <th style={{ border: '1px solid #075c34', padding: 9, width: '24%' }}>الإيجار الشهري</th>
                  <th style={{ border: '1px solid #075c34', padding: 9, width: '24%' }}>الإيجار اليومي</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td style={{ border: '1px solid #cbd5e1', padding: 9, textAlign: 'center', fontWeight: 700 }}>
                      {i + 1}
                    </td>
                    <td style={{ border: '1px solid #cbd5e1', padding: 9 }}>
                      {row.equipment || '—'}
                    </td>
                    <td style={{ border: '1px solid #cbd5e1', padding: 9, textAlign: 'center' }}>
                      {row.monthly ? `${row.monthly} ريال` : '—'}
                    </td>
                    <td style={{ border: '1px solid #cbd5e1', padding: 9, textAlign: 'center' }}>
                      {row.daily ? `${row.daily} ريال` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div
              style={{
                marginTop: 16,
                borderRight: '4px solid #d9a928',
                background: '#fffbeb',
                padding: '10px 12px',
                fontSize: 11,
                lineHeight: 1.9,
              }}
            >
              <b>الشروط والملاحظات:</b>
              <div style={{ whiteSpace: 'pre-wrap' }}>{notes || '—'}</div>
            </div>

            <div style={{ marginTop: 24, fontSize: 12, lineHeight: 1.8 }}>
              شاكرين لكم حسن تعاونكم، وتفضلوا بقبول فائق الاحترام والتقدير.
            </div>

            <div style={{ marginTop: 28, display: 'flex', justifyContent: 'space-between', gap: 20, fontSize: 11 }}>
              <div style={{ minWidth: 130 }}>
                <b>التوقيع</b>
                <div style={{ borderBottom: '1px solid #94a3b8', marginTop: 24 }} />
              </div>
              <div style={{ minWidth: 130, textAlign: 'left' }}>
                <b>الختم</b>
                <div style={{ borderBottom: '1px solid #94a3b8', marginTop: 24 }} />
              </div>
            </div>
          </div>

          <div
            style={{
              background: '#075c34',
              color: '#ffffff',
              textAlign: 'center',
              padding: '9px 12px',
              fontSize: 9,
              letterSpacing: .2,
            }}
          >
            QUOTATION • EQUIPMENT RENTAL
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={savePdf}
            className="rounded-xl py-3 bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5"
          >
            <FileDown className="w-4 h-4" /> PDF
          </button>
          <button
            type="button"
            onClick={sharePdf}
            className="rounded-xl py-3 bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5"
          >
            <Share2 className="w-4 h-4" /> مشاركة
          </button>
          <button
            type="button"
            onClick={sendWhatsApp}
            className="rounded-xl py-3 bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5"
          >
            <MessageCircle className="w-4 h-4" /> واتساب
          </button>
        </div>
      </section>
    </AppLayout>
  );
              }
