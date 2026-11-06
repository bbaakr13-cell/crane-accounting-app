import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { fetchEquipment, type Equipment } from '@/lib/equipment';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

type WorkDay = { date: string; worked: boolean; notes: string };
type WorkRecord = {
  id: string;
  equipmentId: string;
  equipmentName: string;
  client: string;
  driver: string;
  site: string;
  rate: number;
  paid: number;
  days: WorkDay[];
  createdAt: string;
};

type ReportRow = {
  date: string;
  notes: string;
  number: number;
  continued: boolean;
};

type ReportData = {
  client: string;
  equipmentName: string;
  driver: string;
  site: string;
  dailyRate: number;
  paid: number;
  workedDays: WorkDay[];
};

// مهم: لا تغيّر المفتاح. الكشوف المسجلة سابقاً ستظل متاحة.
const KEY = 'bakr_pro_daily_crane_work_v1';
const CONTACT_PHONE = '0558995962';

// اسم PDF هو اسم العميل، مع حذف الرموز الممنوعة في أسماء ملفات أندرويد.
const pdfFileName = (name: string): string => {
  const safe = name.normalize('NFC').trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ').replace(/[. ]+$/g, '').slice(0, 100).trim();
  return `${safe || 'كشف شغل اليوميات'}.pdf`;
};

const NAVY = '#132b46';
const GOLD = '#c69c50';
const INK = '#17263c';
const SOFT = '#f5f7fa';

const inputStyle: CSSProperties = {
  display: 'block', width: '100%', minWidth: 0, boxSizing: 'border-box', height: 48,
  borderRadius: 12, padding: '0 12px', background: '#f8fafc', color: INK,
  border: '1px solid #cbd5e1', fontSize: 16, outline: 'none',
};
const card: CSSProperties = {
  background: '#fff', borderRadius: 17, padding: 15, marginBottom: 14,
  border: '1px solid #e2e8f0', boxShadow: '0 3px 14px #0000000a', minWidth: 0,
};
const btn: CSSProperties = {
  minHeight: 48, border: 0, borderRadius: 12, background: NAVY,
  color: '#fff', fontSize: 14, fontWeight: 800, padding: '10px 14px', cursor: 'pointer',
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const money = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const amount = (n: number) => `${money(n)} ر.س`;
const dayName = (s: string) => new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(new Date(`${s}T12:00:00`));
const clean = (s: string) => s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
const validNumber = (s: string) => s.trim() !== '' && Number.isFinite(Number(clean(s))) && Number(clean(s)) >= 0;
const parseRecords = (): WorkRecord[] => {
  try { const value = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
};

// الملاحظات الطويلة تُقسّم إلى صفوف متابعة، فلا تضيع عند فصل صفحات PDF.
function noteSegments(text: string, limit = 56): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ['—'];
  const chunks: string[] = [];
  let current = '';
  const add = () => { if (current) chunks.push(current); current = ''; };
  for (const word of words) {
    if (word.length > limit) {
      add();
      for (let at = 0; at < word.length; at += limit) chunks.push(word.slice(at, at + limit));
      continue;
    }
    if (current && current.length + word.length + 1 > limit) add();
    current = current ? `${current} ${word}` : word;
  }
  add();
  return chunks.length ? chunks : ['—'];
}
function makeRows(days: WorkDay[]): ReportRow[] {
  return days.flatMap((d, index) => noteSegments(d.notes || '').map((part, at) => ({
    date: d.date, notes: part, number: index + 1, continued: at > 0,
  })));
}
function paginateRows(rows: ReportRow[]): ReportRow[][] {
  // الصفحات المتوسطة تسع 7 صفوف، والصفحة النهائية 4 صفوف لإبقاء مساحة الملخص والتوقيعات.
  if (!rows.length) return [[]];
  const result: ReportRow[][] = [];
  let start = 0;
  while (rows.length - start > 4) {
    const remaining = rows.length - start;
    const count = Math.min(7, remaining - 1);
    result.push(rows.slice(start, start + count));
    start += count;
  }
  result.push(rows.slice(start));
  return result;
}

const reportFont = 'Tahoma, "Noto Sans Arabic", Arial, sans-serif';
const headingStyle: CSSProperties = {
  margin: '0 0 13px', fontWeight: 900, color: NAVY, fontSize: 17,
  borderRight: `3px solid ${GOLD}`, paddingRight: 9,
};
const boxLabel: CSSProperties = { fontSize: 11, color: '#8792a3', marginBottom: 8, fontWeight: 700 };
const boxValue: CSSProperties = { fontSize: 15, fontWeight: 900, color: NAVY, overflowWrap: 'anywhere' };

function WorkReportA4({ data }: { data: ReportData }) {
  const rows = makeRows(data.workedDays);
  const pages = paginateRows(rows);
  const total = data.workedDays.length * data.dailyRate;
  const balance = total - data.paid;
  const first = data.workedDays[0]?.date || today();
  const last = data.workedDays[data.workedDays.length - 1]?.date || first;

  const info = [
    ['العميل / المشروع', data.client], ['المعدة', data.equipmentName], ['موقع العمل', data.site || '—'],
    ['اسم السائق', data.driver || '—'], ['سعر التشغيل اليومي', amount(data.dailyRate)],
    ['عدد أيام العمل', `${data.workedDays.length} يوم`],
  ];

  return <div dir="rtl" style={{ width: 794, fontFamily: reportFont, color: NAVY, background: '#fff' }}>
    {pages.map((pageRows, pageIndex) => {
      const lastPage = pageIndex === pages.length - 1;
      return <section
        key={pageIndex}
        data-report-page="true"
        style={{
          width: 794, height: 1123, boxSizing: 'border-box', position: 'relative',
          padding: '43px 46px 53px', background: '#fff', overflow: 'hidden',
          direction: 'rtl',
        }}
      >
        {/* رأس الصفحة */}
        <div style={{
          background: NAVY, color: '#fff', minHeight: 117, borderRadius: 10,
          padding: '22px 29px', boxSizing: 'border-box', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', gap: 18,
        }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>BAKR <span style={{ color: '#f0c777' }}>PRO</span></div>
            <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.35 }}>كشف شغل اليوميات</div>
            <div style={{ color: '#cbd6e4', fontSize: 10, marginTop: 5 }}>بيان تفصيلي بأيام تشغيل الكرين والمبالغ المستحقة</div>
          </div>
          <div dir="ltr" style={{ textAlign: 'left', borderLeft: '1px solid #37506c', paddingLeft: 18 }}>
            <div style={{ fontSize: 9, letterSpacing: 1.4, color: '#d7b677', fontWeight: 900 }}>WORK STATEMENT</div>
            <div style={{ fontSize: 10, marginTop: 7, lineHeight: 1.7 }}>DAILY CRANE<br />WORK REPORT</div>
            <div dir="ltr" style={{ display: 'inline-block', marginTop: 6, color: '#f4cb81', fontSize: 15, fontWeight: 900, letterSpacing: 0.4 }}>{CONTACT_PHONE}</div>
            <div style={{ fontSize: 9, color: '#b9c6d6', marginTop: 7 }}>{first} — {last}</div>
          </div>
        </div>

        {/* بيانات التشغيل */}
        <div style={{ marginTop: 25 }}>
          <h3 style={headingStyle}>بيانات التشغيل</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 9 }}>
            {info.map(([label, value]) => <div key={label} style={{
              minHeight: 67, padding: '12px 14px', boxSizing: 'border-box', background: SOFT,
              border: '1px solid #ebeff4', borderRadius: 7,
            }}>
              <div style={boxLabel}>{label}</div>
              <div style={boxValue}>{value}</div>
            </div>)}
          </div>
        </div>

        {/* تفاصيل الأيام - صفوف حقيقية، لا قص للصورة */}
        <div style={{ marginTop: 25 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ ...headingStyle, marginBottom: 12 }}>تفاصيل أيام العمل</h3>
            <span style={{ fontSize: 10, color: '#9aa5b3' }}>سجل التشغيل اليومي {pages.length > 1 ? `• صفحة ${pageIndex + 1} من ${pages.length}` : ''}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', fontSize: 12, textAlign: 'right' }}>
            <colgroup>
              <col style={{ width: '7%' }} /><col style={{ width: '30%' }} />
              <col style={{ width: '15%' }} /><col style={{ width: '18%' }} /><col style={{ width: '30%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: NAVY, color: '#fff' }}>
                {['م', 'اليوم والتاريخ', 'الحالة', 'المبلغ', 'ملاحظات'].map((label, i) => <th key={label} style={{
                  padding: '12px 8px', fontSize: 12, textAlign: 'right',
                  borderTopRightRadius: i === 0 ? 7 : 0, borderTopLeftRadius: i === 4 ? 7 : 0,
                }}>{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, index) => <tr key={`${r.date}-${r.number}-${index}`} style={{ background: index % 2 ? '#f6f8fa' : '#fff' }}>
                <td style={pdfCell}>{r.continued ? '—' : r.number}</td>
                <td style={pdfCell}>
                  {r.continued ? <span style={{ color: '#7f8b9b' }}>تابع ملاحظات {r.date}</span> : <>
                    <div style={{ fontWeight: 800 }}>{dayName(r.date)}</div>
                    <div dir="ltr" style={{ textAlign: 'right', color: '#8190a1', fontSize: 10, marginTop: 4 }}>{r.date}</div>
                  </>}
                </td>
                <td style={pdfCell}>{r.continued ? '—' : <span style={{
                  display: 'inline-block', background: '#e9f5ec', border: '1px solid #d6e9dc',
                  padding: '5px 8px', borderRadius: 15, color: '#237349', fontWeight: 800, fontSize: 11,
                }}>اشتغل</span>}</td>
                <td style={{ ...pdfCell, whiteSpace: 'nowrap', fontSize: 11 }}>{r.continued ? '—' : amount(data.dailyRate)}</td>
                <td style={{ ...pdfCell, overflowWrap: 'anywhere', whiteSpace: 'normal', lineHeight: 1.5, fontSize: 11 }}>{r.notes}</td>
              </tr>)}
            </tbody>
          </table>
        </div>

        {lastPage ? <>
          {/* الإجمالي يخص جميع الأيام وليس الصفحة الحالية فقط */}
          <div style={{ marginTop: 26 }}>
            <h3 style={headingStyle}>الملخص المالي</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {[
                ['إجمالي قيمة الأعمال', total, false],
                ['المبلغ المستلم', data.paid, false],
                ['المبلغ المتبقي', balance, true],
              ].map(([label, value, emphasized]) => <div key={String(label)} style={{
                minHeight: 88, boxSizing: 'border-box', borderRadius: 7, padding: '15px 13px',
                background: emphasized ? NAVY : SOFT, border: emphasized ? 'none' : '1px solid #e7ebf1',
              }}>
                <div style={{ fontSize: 11, marginBottom: 10, color: emphasized ? '#c7d2df' : '#8491a1' }}>{String(label)}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: emphasized ? '#fff' : NAVY, direction: 'ltr', textAlign: 'right' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, marginRight: 5 }}>ر.س</span>{money(Number(value))}
                </div>
              </div>)}
            </div>
            <div style={{ fontSize: 11, color: '#7d8998', marginTop: 11 }}>
              إجمالي أيام العمل: <b>{data.workedDays.length} يوم</b>　 •　 السعر اليومي: <b>{amount(data.dailyRate)}</b>
            </div>
          </div>
          <div style={{ marginTop: 25 }}>
            <h3 style={headingStyle}>الاعتماد والتوقيع</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
              {['توقيع مسؤول العمل', 'توقيع العميل'].map(name => <div key={name} style={{
                height: 73, border: '1px solid #e5e9ef', borderRadius: 7,
                padding: '10px 15px', boxSizing: 'border-box', position: 'relative',
              }}>
                <div style={{ fontSize: 12, fontWeight: 900 }}>{name}</div>
                <div style={{ position: 'absolute', bottom: 13, left: 13, right: 13, borderBottom: '1px solid #c7ccd3' }} />
              </div>)}
            </div>
          </div>
        </> : <div style={{ marginTop: 23, fontSize: 11, color: '#8693a3' }}>يتبع كشف شغل اليوميات في الصفحة التالية...</div>}

        {/* تذييل مستقل لكل صفحة */}
        <footer style={{
          position: 'absolute', bottom: 28, right: 46, left: 46, borderTop: '1px solid #e7ebf1',
          paddingTop: 11, display: 'flex', justifyContent: 'space-between',
          fontSize: 9, color: '#9aa5b3',
        }}>
          <span>BAKR PRO • كشف شغل اليوميات • {CONTACT_PHONE}</span>
          <span dir="ltr">DAILY CRANE WORK STATEMENT　|　{String(pageIndex + 1).padStart(2, '0')} / {String(pages.length).padStart(2, '0')}</span>
        </footer>
      </section>;
    })}
  </div>;
}

const pdfCell: CSSProperties = {
  padding: '11px 8px', verticalAlign: 'middle',
  borderBottom: '1px solid #e8ecf1', lineHeight: 1.4,
};

export function DailyCraneWorkPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentError, setEquipmentError] = useState('');
  const [records, setRecords] = useState<WorkRecord[]>(parseRecords);
  const [editing, setEditing] = useState<string | null>(null);
  const [equipmentId, setEquipmentId] = useState('');
  const [client, setClient] = useState('');
  const [driver, setDriver] = useState('');
  const [site, setSite] = useState('');
  const [rate, setRate] = useState('');
  const [paid, setPaid] = useState('0');
  const [newDate, setNewDate] = useState(today());
  const [days, setDays] = useState<WorkDay[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetchEquipment().then(v => { if (active) setEquipment(v || []); })
      .catch(() => { if (active) setEquipmentError('تعذر تحميل المعدات'); });
    return () => { active = false; };
  }, []);

  const selected = useMemo(() => equipment.find(e => String(e.id) === equipmentId), [equipment, equipmentId]);
  const workDays = useMemo(() => days.filter(d => d.worked).sort((a, b) => a.date.localeCompare(b.date)), [days]);
  const dailyRate = validNumber(rate) ? Number(clean(rate)) : 0;
  const received = validNumber(paid) ? Number(clean(paid)) : 0;
  const total = workDays.length * dailyRate;
  const balance = total - received;

  const addDay = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate) || Number.isNaN(new Date(newDate + 'T12:00:00').getTime())) {
      setNotice('اختر تاريخاً صحيحاً'); return;
    }
    if (days.some(d => d.date === newDate && d.worked)) { setNotice('هذا اليوم مضاف بالفعل'); return; }
    setDays(old => [...old.filter(d => d.date !== newDate), { date: newDate, worked: true, notes: '' }]
      .sort((a, b) => a.date.localeCompare(b.date)));
    setNotice('تمت إضافة يوم العمل');
  };
  const removeDay = (date: string) => setDays(old => old.filter(d => d.date !== date));
  const reset = () => {
    setEditing(null); setEquipmentId(''); setClient(''); setDriver(''); setSite(''); setRate('');
    setPaid('0'); setNewDate(today()); setDays([]); setNotice('كشف جديد');
  };
  const load = (r: WorkRecord) => {
    setEditing(r.id); setEquipmentId(String(r.equipmentId)); setClient(r.client);
    setDriver(r.driver); setSite(r.site); setRate(String(r.rate)); setPaid(String(r.paid));
    setDays((r.days || []).map(d => ({ ...d })));
    setNewDate(today()); setNotice('تم فتح الكشف للتعديل. أيام التوقف القديمة لا تدخل في الحساب.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const check = () => {
    if (!selected || !client.trim() || workDays.length === 0 || !validNumber(rate) || !validNumber(paid)) {
      setNotice('اختر الكرين والعميل وأضف يوم عمل واحداً على الأقل وأدخل السعر والمستلم بشكل صحيح.');
      return false;
    }
    return true;
  };
  const save = () => {
    if (!check()) return;
    const entry: WorkRecord = {
      id: editing || `dw-${Date.now()}`, equipmentId: String(selected!.id), equipmentName: selected!.name,
      client: client.trim(), driver: driver.trim(), site: site.trim(), rate: dailyRate,
      paid: received, days: workDays,
      createdAt: editing ? (records.find(r => r.id === editing)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    };
    const next = editing ? records.map(r => r.id === editing ? entry : r) : [entry, ...records];
    try {
      localStorage.setItem(KEY, JSON.stringify(next)); setRecords(next); setEditing(entry.id);
      setNotice('تم حفظ الكشف بنجاح على الجهاز.');
    } catch { setNotice('تعذر الحفظ، تحقق من مساحة الجهاز.'); }
  };

  // كل ورقة تُحوّل لصورة مستقلة بالحجم الكامل A4؛ بدون قص الجدول وسط الصف.
  const makePdf = async (withPreview = false): Promise<{ base64: string; filename: string } | null> => {
    if (busy || !check() || !reportRef.current) return null;
    setBusy(true); setNotice('جار إعداد كشف PDF الاحترافي...');
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const pages = Array.from(reportRef.current.querySelectorAll<HTMLElement>('[data-report-page]'));
      if (!pages.length) throw new Error('No PDF pages');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const images: string[] = [];
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        if (page.scrollHeight > page.clientHeight + 2) {
          throw new Error('تجاوز محتوى الكشف حدود صفحة A4؛ يُرجى تقصير الملاحظات الطويلة.');
        }
        const canvas = await html2canvas(page, {
          // 794 × 1123 CSS pixels at 3.125x → approximately 300 DPI on A4.
          scale: withPreview ? 2 : 3.125, backgroundColor: '#ffffff', useCORS: true, logging: false,
          scrollX: 0, scrollY: 0, windowWidth: 1200,
        });
        // PNG lossless keeps Arabic letters and thin table rules sharp when printing.
        const png = canvas.toDataURL('image/png');
        if (i) pdf.addPage();
        pdf.addImage(png, 'PNG', 0, 0, 210, 297);
        if (withPreview) images.push(png);
        canvas.width = 0; canvas.height = 0;
      }
      if (withPreview) {
        setPreviewImages(images);
        setNotice('تم تجهيز المعاينة. راجع الصفحات ثم احفظ ملف PDF.');
      }
      return { base64: pdf.output('datauristring').split(',')[1], filename: pdfFileName(client) };
    } catch (error) {
      console.error(error);
      setNotice(error instanceof Error && error.message.startsWith('تجاوز') ? error.message : 'تعذر إنشاء PDF، حاول مرة أخرى.');
      return null;
    } finally { setBusy(false); }
  };
  // لا نكتب فوق كشف سابق لعميل متكرر: العميل.pdf، ثم العميل (2).pdf وهكذا.
  const availableFilename = async (preferred: string): Promise<string> => {
    const stem = preferred.replace(/\.pdf$/i, '');
    for (let i = 1; i <= 999; i++) {
      const candidate = i === 1 ? preferred : `${stem} (${i}).pdf`;
      try {
        await Filesystem.stat({ path: candidate, directory: Directory.Documents });
      } catch {
        return candidate;
      }
    }
    return `${stem}-${Date.now()}.pdf`;
  };

  const exportPdf = async () => {
    const result = await makePdf(); if (!result) return;
    try {
      const filename = await availableFilename(result.filename);
      await Filesystem.writeFile({ path: filename, data: result.base64, directory: Directory.Documents, recursive: true });
      setNotice(`تم حفظ PDF بجودة طباعة عالية باسم: ${filename}`);
    } catch (error) {
      console.warn(error);
      const a = document.createElement('a');
      a.href = `data:application/pdf;base64,${result.base64}`; a.download = result.filename;
      document.body.appendChild(a); a.click(); a.remove();
      setNotice('تم طلب تنزيل PDF. تحقق من التنزيلات.');
    }
  };
  const sharePdf = async () => {
    const result = await makePdf(); if (!result) return;
    try {
      const saved = await Filesystem.writeFile({
        path: `BAKR-PDF/${result.filename}`, data: result.base64, directory: Directory.Cache, recursive: true,
      });
      await Share.share({ title: 'كشف شغل اليوميات - BAKR PRO', text: 'كشف شغل اليوميات', url: saved.uri, dialogTitle: 'مشاركة PDF عبر واتساب' });
      setNotice('اختر واتساب من قائمة المشاركة.');
    } catch (error) {
      console.error(error);
      setNotice('تعذرت مشاركة PDF مباشرة. استخدم حفظ PDF ثم شاركه من ملفاتي.');
    }
  };
  const field = (label: string, value: string, onChange: (s: string) => void, type = 'text') => <label style={{ display: 'block', minWidth: 0 }}>
    <span style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 6 }}>{label}</span>
    <input style={inputStyle} type={type} value={value} onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} />
  </label>;

  return <AppLayout>
    <div dir="rtl" style={{ width: '100%', maxWidth: '100%', minWidth: 0, overflowX: 'clip', boxSizing: 'border-box', padding: '0 0 24px', color: NAVY }}>
      <header style={{ background: NAVY, color: '#fff', borderRadius: 17, padding: 18, marginBottom: 14 }}>
        <div style={{ color: '#e5bd65', fontSize: 12, fontWeight: 800 }}>BAKR PRO</div>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: '5px 0' }}>شغل اليوميات</h1>
        <div style={{ fontSize: 12, color: '#dbe3ec' }}>أضف أيام العمل الفعلية فقط • حفظ ومعاينة ومشاركة PDF</div>
      </header>

      <section style={card}>
        <h2 style={{ fontSize: 17, fontWeight: 900, margin: '0 0 14px' }}>بيانات العمل</h2>
        <label style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 6 }}>الكرين من المعدات المحفوظة</label>
        <select style={inputStyle} value={equipmentId} onChange={(e: ChangeEvent<HTMLSelectElement>) => setEquipmentId(e.target.value)}>
          <option value="">اختر الكرين</option>
          {equipment.map(e => <option key={e.id} value={String(e.id)}>{e.name}{e.capacity ? ` - ${e.capacity}` : ''}</option>)}
        </select>
        {equipmentError && <p style={{ color: '#b91c1c' }}>{equipmentError}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 12, marginTop: 12 }}>
          {field('اسم العميل', client, setClient)}
          {field('اسم السائق', driver, setDriver)}
          {field('موقع العمل', site, setSite)}
        </div>
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 17, fontWeight: 900, margin: '0 0 8px' }}>أيام الشغل الفعلية</h2>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>
          اختر تاريخ اليوم الذي اشتغل فيه الكرين ثم اضغط إضافة. الأيام التي لم يشتغل فيها لا تضيفها.
        </p>
        {field('تاريخ يوم العمل', newDate, setNewDate, 'date')}
        <button type="button" style={{ ...btn, width: '100%', marginTop: 10, background: '#157347' }} onClick={addDay}>+ إضافة يوم عمل</button>
        <div style={{ marginTop: 12 }}>
          {workDays.length === 0 ? <p style={{ fontSize: 13, color: '#64748b' }}>لم تضف أيام عمل بعد.</p> : workDays.map(d => <div key={d.date} style={{ padding: '10px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'block', fontSize: 13 }}>{dayName(d.date)} — {d.date}</b>
              <input aria-label={`ملاحظة ${d.date}`} value={d.notes} onChange={(e: ChangeEvent<HTMLInputElement>) => setDays(old => old.map(x => x.date === d.date ? { ...x, notes: e.target.value } : x))}
                placeholder="ملاحظة (اختياري)" style={{ ...inputStyle, height: 38, fontSize: 13, marginTop: 5 }} />
            </div>
            <button type="button" onClick={() => removeDay(d.date)} style={{ ...btn, background: '#fee2e2', color: '#991b1b', padding: '8px 10px', fontSize: 12, flexShrink: 0 }}>حذف</button>
          </div>)}
        </div>
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 17, fontWeight: 900, margin: '0 0 14px' }}>الحساب المالي</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 12 }}>
          {field('سعر اليوم (ريال)', rate, setRate, 'text')}
          {field('المبلغ المستلم (ريال)', paid, setPaid, 'text')}
        </div>
        <div style={{ marginTop: 14, background: '#f1f5f9', borderRadius: 12, padding: 13, lineHeight: 2, fontSize: 14 }}>
          <div>أيام العمل: <b>{workDays.length}</b></div>
          <div>الإجمالي: <b>{amount(total)}</b></div>
          <div>المستلم: <b>{amount(received)}</b></div>
          <div style={{ fontSize: 19, fontWeight: 900, color: balance > 0 ? '#9a3412' : '#166534' }}>المتبقي: {amount(balance)}</div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 9, marginBottom: 14 }}>
        <button type="button" style={{ ...btn, background: '#15803d' }} onClick={save}>حفظ الكشف</button>
        <button type="button" style={{ ...btn, background: '#475569' }} disabled={busy} onClick={() => { void makePdf(true); }}>{busy ? 'جار التجهيز...' : 'معاينة PDF'}</button>
        <button type="button" style={{ ...btn, background: '#98712b' }} disabled={busy} onClick={exportPdf}>{busy ? 'جار التجهيز...' : 'حفظ PDF'}</button>
        <button type="button" style={{ ...btn, background: '#0b7a4b' }} disabled={busy} onClick={sharePdf}>مشاركة PDF عبر واتساب</button>
        <button type="button" style={{ ...btn, background: '#475569' }} onClick={reset}>كشف جديد</button>
      </div>
      {notice && <p role="status" style={{ background: '#fef3c7', color: '#78350f', padding: 12, borderRadius: 12, fontSize: 13 }}>{notice}</p>}

      <section style={card}>
        <h2 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 12px' }}>الكشوف المحفوظة</h2>
        {records.length === 0 ? <p style={{ fontSize: 13 }}>لا توجد كشوف محفوظة بعد.</p> : records.map(r => <button type="button" key={r.id} onClick={() => load(r)} style={{ ...inputStyle, height: 'auto', textAlign: 'right', marginBottom: 8, padding: 12, cursor: 'pointer' }}>
          <b>{r.client}</b>
          <div style={{ fontSize: 12 }}>{r.equipmentName} — {(r.days || []).filter(x => x.worked).length} أيام — {amount((r.days || []).filter(x => x.worked).length * r.rate)}</div>
        </button>)}
      </section>

      {/* html2canvas يحتاج HTML فعلياً موجوداً في الصفحة، ولا يظهر للمستخدم. */}
      <div aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0, width: 794, pointerEvents: 'none' }}>
        <div ref={reportRef}>
          <WorkReportA4 data={{ client, equipmentName: selected?.name || '', driver, site, dailyRate, paid: received, workedDays: workDays }} />
        </div>
      </div>

      {previewImages.length > 0 && <div role="dialog" aria-modal="true" aria-label="معاينة كشف شغل اليوميات" style={{
        position: 'fixed', zIndex: 9999, inset: 0, background: '#071323ec', padding: '18px 10px 25px',
        overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <div style={{ width: '100%', maxWidth: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
          <b>معاينة كشف PDF — {previewImages.length} صفحة</b>
          <button type="button" onClick={() => setPreviewImages([])} style={{ ...btn, background: '#b63e3e' }}>إغلاق ✕</button>
        </div>
        {previewImages.map((src, index) => <img key={index} alt={`صفحة ${index + 1} من كشف شغل اليوميات`} src={src} style={{ width: '100%', maxWidth: 600, height: 'auto', display: 'block', boxShadow: '0 8px 24px #0005' }} />)}
      </div>}
    </div>
  </AppLayout>;
}

export default DailyCraneWorkPage;
