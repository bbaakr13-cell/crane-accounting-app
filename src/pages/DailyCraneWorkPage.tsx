import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { fetchEquipment, type Equipment } from '@/lib/equipment';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

type WorkDay = { date: string; worked: boolean; notes: string };
type Trip = { id: string; date: string; price: number; notes: string };
type WorkMode = 'daily' | 'trips';
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

type TripRecord = {
  id: string;
  equipmentId: string;
  equipmentName: string;
  client: string;
  driver: string;
  site: string;
  paid: number;
  trips: Trip[];
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
  mode: WorkMode;
  trips: Trip[];
};

// مهم: لا تغيّر المفتاح. الكشوف المسجلة سابقاً ستظل متاحة.
const KEY = 'bakr_pro_daily_crane_work_v1';
const TRIPS_KEY = 'bakr_pro_crane_trips_v1';
const CONTACT_PHONE = '0558995962';

// اسم PDF هو اسم العميل، مع حذف الرموز الممنوعة في أسماء ملفات أندرويد.
const pdfFileName = (name: string, mode: WorkMode): string => {
  const safe = name.normalize('NFC').trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ').replace(/[. ]+$/g, '').slice(0, 100).trim();
  return mode === 'trips' ? `${safe || 'عميل'} - كشف شغل مشاوير.pdf` : `${safe || 'كشف شغل اليوميات'}.pdf`;
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
const parseTrips = (): TripRecord[] => {
  try { const value = JSON.parse(localStorage.getItem(TRIPS_KEY) || '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
};
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
  const isTrips = data.mode === 'trips';
  const rows: ReportRow[] = isTrips
    ? data.trips.flatMap((t, index) => noteSegments(t.notes).map((part, at) => ({
        date: t.date, notes: part, number: index + 1, continued: at > 0,
      })))
    : makeRows(data.workedDays);
  const pages = paginateRows(rows);
  const total = isTrips ? data.trips.reduce((sum, t) => sum + t.price, 0) : data.workedDays.length * data.dailyRate;
  const balance = total - data.paid;
  const sourceDates = isTrips ? data.trips.map(t => t.date) : data.workedDays.map(d => d.date);
  const dates = [...sourceDates].sort();
  const first = dates[0] || today();
  const last = dates[dates.length - 1] || first;

  const info = [
    ['العميل / المشروع', data.client], ['المعدة', data.equipmentName], ['موقع العمل', data.site || '—'],
    ['اسم السائق', data.driver || '—'], isTrips ? ['نوع التشغيل', 'مشاوير'] : ['سعر التشغيل اليومي', amount(data.dailyRate)],
    isTrips ? ['عدد المشاوير', `${data.trips.length} مشوار`] : ['عدد أيام العمل', `${data.workedDays.length} يوم`],
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
            <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.35 }}>{isTrips ? 'كشف شغل مشاوير' : 'كشف شغل اليوميات'}</div>
            <div style={{ color: '#cbd6e4', fontSize: 10, marginTop: 5 }}>{isTrips ? 'بيان تفصيلي بالمشاوير وقيمتها والمبالغ المستحقة' : 'بيان تفصيلي بأيام تشغيل الكرين والمبالغ المستحقة'}</div>
          </div>
          <div dir="ltr" style={{ textAlign: 'left', borderLeft: '1px solid #37506c', paddingLeft: 18 }}>
            <div style={{ fontSize: 9, letterSpacing: 1.4, color: '#d7b677', fontWeight: 900 }}>WORK STATEMENT</div>
            <div style={{ fontSize: 10, marginTop: 7, lineHeight: 1.7 }}>{isTrips ? <>CRANE TRIPS<br />WORK REPORT</> : <>DAILY CRANE<br />WORK REPORT</>}</div>
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
            <h3 style={{ ...headingStyle, marginBottom: 12 }}>{isTrips ? 'تفاصيل المشاوير' : 'تفاصيل أيام العمل'}</h3>
            <span style={{ fontSize: 10, color: '#9aa5b3' }}>{isTrips ? 'سجل المشاوير' : 'سجل التشغيل اليومي'} {pages.length > 1 ? `• صفحة ${pageIndex + 1} من ${pages.length}` : ''}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', fontSize: 12, textAlign: 'right' }}>
            <colgroup>
              <col style={{ width: '7%' }} /><col style={{ width: '30%' }} />
              <col style={{ width: '15%' }} /><col style={{ width: '18%' }} /><col style={{ width: '30%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: NAVY, color: '#fff' }}>
                {['م', 'اليوم والتاريخ', isTrips ? 'النوع' : 'الحالة', 'المبلغ', 'ملاحظات'].map((label, i) => <th key={label} style={{
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
                }}>{isTrips ? 'مشوار' : 'اشتغل'}</span>}</td>
                <td style={{ ...pdfCell, whiteSpace: 'nowrap', fontSize: 11 }}>{r.continued ? '—' : amount(isTrips ? (data.trips[r.number - 1]?.price || 0) : data.dailyRate)}</td>
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
              {isTrips ? <>إجمالي المشاوير: <b>{data.trips.length} مشوار</b></> : <>إجمالي أيام العمل: <b>{data.workedDays.length} يوم</b>　 •　 السعر اليومي: <b>{amount(data.dailyRate)}</b></>}
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
        </> : <div style={{ marginTop: 23, fontSize: 11, color: '#8693a3' }}>يتبع {isTrips ? 'كشف شغل مشاوير' : 'كشف شغل اليوميات'} في الصفحة التالية...</div>}

        {/* تذييل مستقل لكل صفحة */}
        <footer style={{
          position: 'absolute', bottom: 28, right: 46, left: 46, borderTop: '1px solid #e7ebf1',
          paddingTop: 11, display: 'flex', justifyContent: 'space-between',
          fontSize: 9, color: '#9aa5b3',
        }}>
          <span>BAKR PRO • {isTrips ? 'كشف شغل مشاوير' : 'كشف شغل اليوميات'} • {CONTACT_PHONE}</span>
          <span dir="ltr">{isTrips ? 'CRANE TRIPS STATEMENT' : 'DAILY CRANE WORK STATEMENT'}　|　{String(pageIndex + 1).padStart(2, '0')} / {String(pages.length).padStart(2, '0')}</span>
        </footer>
      </section>;
    })}
  </div>;
}

type ClientLine = {
  id: string;
  recordId: string;
  date: string;
  equipmentId: string;
  equipmentName: string;
  driver: string;
  notes: string;
  price: number;
};

function ClientAccountA4({ client, mode, items, paid }: {
  client: string; mode: WorkMode; items: ClientLine[]; paid: number | null;
}) {
  const isTrips = mode === 'trips';
  const ordered = [...items].sort((a, b) => a.date.localeCompare(b.date));
  const total = ordered.reduce((sum, item) => sum + item.price, 0);
  // اترك مساحة كافية للملخص والتوقيع في الصفحة الأخيرة.
  const pages: ClientLine[][] = [];
  let rest = ordered;
  while (rest.length > 5) {
    const take = Math.min(8, rest.length - 1);
    pages.push(rest.slice(0, take));
    rest = rest.slice(take);
  }
  pages.push(rest);
  const firstDate = ordered[0]?.date || '—';
  const lastDate = ordered[ordered.length - 1]?.date || '—';
  const reportTitle = isTrips ? 'كشف حساب شغل مشاوير' : 'كشف حساب شغل اليوميات';
  return <div dir="rtl" style={{ width: 794, color: NAVY, fontFamily: reportFont, background: '#fff' }}>
    {pages.map((pageRows, pageIndex) => {
      const lastPage = pageIndex === pages.length - 1;
      return <section key={pageIndex} data-report-page="true" style={{
        width: 794, height: 1123, padding: '43px 46px 53px', boxSizing: 'border-box',
        background: '#fff', position: 'relative', overflow: 'hidden', direction: 'rtl',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
          minHeight: 112, padding: '18px 24px', borderRadius: 10, background: NAVY, color: '#fff', boxSizing: 'border-box' }}>
          <div>
            <div style={{ fontSize: 21, fontWeight: 900 }}>BAKR <span style={{ color: '#e9c078' }}>PRO</span></div>
            <div style={{ fontSize: 19, fontWeight: 900, marginTop: 7 }}>{reportTitle}</div>
            <div style={{ color: '#d6e0ec', fontSize: 11, marginTop: 5 }}>بيان الأعمال المسجلة للعميل</div>
          </div>
          <div dir="ltr" style={{ textAlign: 'left', fontSize: 11, lineHeight: 2 }}>
            <b>{CONTACT_PHONE}</b>
            <div>{firstDate} — {lastDate}</div>
            <div>PAGE {pageIndex + 1} / {pages.length}</div>
          </div>
        </div>
        <div style={{ marginTop: 22, background: SOFT, border: '1px solid #e7ebf1', padding: 16, borderRadius: 9 }}>
          <div style={{ fontSize: 11, color: '#67778a' }}>اسم العميل / المشروع</div>
          <div style={{ fontSize: 19, fontWeight: 900, marginTop: 6, overflowWrap: 'anywhere' }}>{client}</div>
          <div style={{ fontSize: 12, marginTop: 12 }}>نوع الشغل: <b>{isTrips ? 'مشاوير' : 'يوميات'}</b>　|　عدد {isTrips ? 'المشاوير' : 'الأيام'}: <b>{ordered.length}</b></div>
        </div>
        <div style={{ marginTop: 23 }}>
          <h3 style={headingStyle}>{isTrips ? 'تفاصيل المشاوير' : 'تفاصيل أيام العمل'}</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, tableLayout: 'fixed', textAlign: 'right' }}>
            <colgroup><col style={{ width: '7%' }}/><col style={{ width: '20%' }}/><col style={{ width: '24%' }}/><col style={{ width: '19%' }}/><col style={{ width: '30%' }}/></colgroup>
            <thead><tr style={{ background: NAVY, color: '#fff' }}>
              {['م','التاريخ','الكرين / المعدة','المبلغ','البيان / ملاحظات'].map(col => <th key={col} style={{ padding: '11px 8px', textAlign: 'right', fontWeight: 900 }}>{col}</th>)}
            </tr></thead>
            <tbody>{pageRows.map((item, idx) => <tr key={item.id} style={{ background: idx % 2 ? '#f5f7fa' : '#fff' }}>
              <td style={pdfCell}>{ordered.indexOf(item) + 1}</td>
              <td style={pdfCell}><div dir="ltr" style={{ textAlign: 'right' }}>{item.date}</div></td>
              <td style={{ ...pdfCell, overflowWrap: 'anywhere' }}>{item.equipmentName}</td>
              <td style={{ ...pdfCell, whiteSpace: 'nowrap' }}>{amount(item.price)}</td>
              <td style={{ ...pdfCell, overflowWrap: 'anywhere', whiteSpace: 'normal', fontSize: 10.5 }}>{item.notes || (isTrips ? 'مشوار' : 'يومية')}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {lastPage ? <>
          <div style={{ marginTop: 25 }}>
            <h3 style={headingStyle}>الملخص المالي</h3>
            <div style={{ display: 'grid', gridTemplateColumns: paid === null ? '1fr' : 'repeat(3,1fr)', gap: 9 }}>
              {([['إجمالي قيمة الأعمال', total], ...(paid === null ? [] : [['المبلغ المستلم', paid], ['المتبقي', total - paid]])] as [string, number][]).map(([label, value]) =>
                <div key={label} style={{ background: label === 'المتبقي' ? NAVY : SOFT, color: label === 'المتبقي' ? '#fff' : NAVY,
                  borderRadius: 8, padding: 15, boxSizing: 'border-box' }}>
                  <div style={{ fontSize: 11, marginBottom: 10 }}>{label}</div>
                  <div style={{ fontWeight: 900, fontSize: 20 }}>{amount(value)}</div>
                </div>)}
            </div>
            {paid === null && <div style={{ fontSize: 11, color: '#8b5b18', marginTop: 12 }}>
              كشف أعمال جزئي: لم يتم احتساب المستلم أو الرصيد؛ لأن الدفعات المسجلة تخص كشوفاً قد تحتوي أعمالاً خارج هذا الاختيار.
            </div>}
          </div>
          <div style={{ marginTop: 26 }}>
            <h3 style={headingStyle}>الاعتماد والتوقيع</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {['توقيع المسؤول','توقيع العميل'].map(label => <div key={label} style={{ height: 75, border: '1px solid #e4e8ed', borderRadius: 8, padding: 12, boxSizing: 'border-box', fontSize: 12, fontWeight: 800 }}>
                {label}<div style={{ borderBottom: '1px solid #bfc9d4', marginTop: 29 }}/>
              </div>)}
            </div>
          </div>
        </> : <div style={{ fontSize: 11, color: '#8190a1', marginTop: 25 }}>يتبع {reportTitle} في الصفحة التالية...</div>}
        <footer style={{ position: 'absolute', bottom: 29, left: 46, right: 46, borderTop: '1px solid #e6ebf1', paddingTop: 10,
          display: 'flex', justifyContent: 'space-between', color: '#8997a6', fontSize: 10 }}>
          <span>BAKR PRO • {reportTitle}</span><span>{pageIndex + 1} / {pages.length}</span>
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
  const [tripRecords, setTripRecords] = useState<TripRecord[]>(parseTrips);
  const [mode, setMode] = useState<WorkMode>('daily');
  const [editing, setEditing] = useState<string | null>(null);
  const [equipmentId, setEquipmentId] = useState('');
  const [client, setClient] = useState('');
  const [driver, setDriver] = useState('');
  const [site, setSite] = useState('');
  const [rate, setRate] = useState('');
  const [paid, setPaid] = useState('0');
  const [newDate, setNewDate] = useState(today());
  const [days, setDays] = useState<WorkDay[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripPrice, setTripPrice] = useState('');
  const [tripNotes, setTripNotes] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);
  const clientReportRef = useRef<HTMLDivElement>(null);
  const [statementOpen, setStatementOpen] = useState(false);
  const [statementClient, setStatementClient] = useState('');
  const [statementEquipment, setStatementEquipment] = useState('');
  const [statementFrom, setStatementFrom] = useState('');
  const [statementTo, setStatementTo] = useState('');
  const [excludedStatementRows, setExcludedStatementRows] = useState<string[]>([]);
  const [previewTitle, setPreviewTitle] = useState('');

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
  const total = mode === 'trips' ? trips.reduce((sum, t) => sum + t.price, 0) : workDays.length * dailyRate;
  const title = mode === 'trips' ? 'كشف شغل مشاوير' : 'كشف شغل اليوميات';
  const balance = total - received;

  // تُقرأ بيانات كشف العميل من السجلات المحفوظة فقط؛ لا نضيف أياماً أو مشاوير جديدة.
  const customerNames = useMemo(() => [...new Set((mode === 'daily' ? records : tripRecords)
    .map(r => r.client.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar')), [mode, records, tripRecords]);
  const customerEquipment = useMemo(() => {
    const list = mode === 'daily' ? records : tripRecords;
    return [...new Map(list.filter(r => r.client.trim() === statementClient)
      .map(r => [String(r.equipmentId), { id: String(r.equipmentId), name: r.equipmentName }])).values()];
  }, [mode, records, tripRecords, statementClient]);
  const availableStatementRows = useMemo<ClientLine[]>(() => {
    if (!statementClient || (statementFrom && statementTo && statementFrom > statementTo)) return [];
    const inPeriod = (date: string) => (!statementFrom || date >= statementFrom) && (!statementTo || date <= statementTo);
    if (mode === 'daily') return records.filter(r => r.client.trim() === statementClient &&
      (!statementEquipment || String(r.equipmentId) === statementEquipment)).flatMap(r =>
      (r.days || []).filter(d => d.worked && inPeriod(d.date)).map(d => ({
        id: `daily:${r.id}:${d.date}`, recordId: r.id, date: d.date, equipmentId: String(r.equipmentId),
        equipmentName: r.equipmentName, driver: r.driver, notes: d.notes, price: Number(r.rate) || 0,
      })) ).sort((a, b) => a.date.localeCompare(b.date));
    return tripRecords.filter(r => r.client.trim() === statementClient &&
      (!statementEquipment || String(r.equipmentId) === statementEquipment)).flatMap(r =>
      (r.trips || []).filter(t => inPeriod(t.date)).map((t, i) => ({
        id: `trips:${r.id}:${t.id || i}`, recordId: r.id, date: t.date, equipmentId: String(r.equipmentId),
        equipmentName: r.equipmentName, driver: r.driver, notes: t.notes, price: Number(t.price) || 0,
      })) ).sort((a, b) => a.date.localeCompare(b.date));
  }, [mode, records, tripRecords, statementClient, statementEquipment, statementFrom, statementTo]);
  const statementRows = useMemo(() => availableStatementRows.filter(r => !excludedStatementRows.includes(r.id)),
    [availableStatementRows, excludedStatementRows]);
  const statementTotal = statementRows.reduce((sum, r) => sum + r.price, 0);
  const statementPaid = useMemo<number | null>(() => {
    if (!statementRows.length) return null;
    const selectedRecordIds = new Set(statementRows.map(row => row.recordId));
    const sourceRecords = mode === 'daily' ? records : tripRecords;
    let sum = 0;
    for (const r of sourceRecords) {
      if (!selectedRecordIds.has(r.id)) continue;
      const fullCount = mode === 'daily'
        ? (r as WorkRecord).days.filter(d => d.worked).length
        : (r as TripRecord).trips.length;
      const chosenCount = statementRows.filter(row => row.recordId === r.id).length;
      // لا ننسب دفعة كشف كامل إلى بعض أيامه أو بعض مشاويره فقط.
      if (chosenCount !== fullCount) return null;
      sum += Number(r.paid) || 0;
    }
    return sum;
  }, [mode, records, tripRecords, statementRows]);
  const statementReportName = `كشف حساب ${mode === 'daily' ? 'شغل اليوميات' : 'شغل مشاوير'}`;
  const statementFilename = () => {
    const safe = statementClient.normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').trim().slice(0, 75) || 'عميل';
    return `${safe} - ${statementReportName}.pdf`;
  };
  const changeStatementFilter = () => setExcludedStatementRows([]);


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
  const addTrip = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate) || Number.isNaN(new Date(`${newDate}T12:00:00`).getTime())) {
      setNotice('اختر تاريخ مشوار صحيحاً'); return;
    }
    if (!validNumber(tripPrice)) { setNotice('أدخل قيمة المشوار بشكل صحيح'); return; }
    setTrips(old => [...old, { id: `trip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, date: newDate, price: Number(clean(tripPrice)), notes: tripNotes.trim() }]);
    setTripPrice(''); setTripNotes(''); setNotice('تمت إضافة المشوار');
  };
  const switchMode = (next: WorkMode) => {
    if (next === mode) return;
    setMode(next); setEditing(null); setEquipmentId(''); setClient(''); setDriver(''); setSite('');
    setRate(''); setPaid('0'); setNewDate(today()); setDays([]); setTrips([]); setTripPrice(''); setTripNotes('');
    setNotice(''); setPreviewImages([]);
  };
  const reset = () => {
    setEditing(null); setEquipmentId(''); setClient(''); setDriver(''); setSite(''); setRate('');
    setPaid('0'); setNewDate(today()); setDays([]); setTrips([]); setTripPrice(''); setTripNotes(''); setPreviewImages([]); setNotice('كشف جديد');
  };
  const load = (r: WorkRecord) => {
    setEditing(r.id); setEquipmentId(String(r.equipmentId)); setClient(r.client);
    setDriver(r.driver); setSite(r.site); setRate(String(r.rate)); setPaid(String(r.paid));
    setDays((r.days || []).map(d => ({ ...d })));
    setNewDate(today()); setNotice('تم فتح الكشف للتعديل. أيام التوقف القديمة لا تدخل في الحساب.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const loadTrip = (r: TripRecord) => {
    setEditing(r.id); setEquipmentId(String(r.equipmentId)); setClient(r.client);
    setDriver(r.driver); setSite(r.site); setPaid(String(r.paid));
    setTrips((r.trips || []).map(t => ({ ...t }))); setNewDate(today());
    setNotice('تم فتح كشف المشاوير للتعديل.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const check = () => {
    if (!selected || !client.trim() || (mode === 'trips' ? trips.length === 0 : workDays.length === 0) || (mode === 'daily' && !validNumber(rate)) || !validNumber(paid)) {
      setNotice(mode === 'trips'
        ? 'اختر الكرين والعميل وأضف مشواراً واحداً على الأقل وأدخل المستلم بشكل صحيح.'
        : 'اختر الكرين والعميل وأضف يوم عمل واحداً على الأقل وأدخل السعر والمستلم بشكل صحيح.');
      return false;
    }
    return true;
  };
  const save = () => {
    if (!check()) return;
    if (mode === 'trips') {
      const entry: TripRecord = {
        id: editing || `tr-${Date.now()}`, equipmentId: String(selected!.id), equipmentName: selected!.name,
        client: client.trim(), driver: driver.trim(), site: site.trim(), paid: received,
        trips: trips.map(t => ({ ...t })),
        createdAt: editing ? (tripRecords.find(r => r.id === editing)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      };
      const next = editing ? tripRecords.map(r => r.id === editing ? entry : r) : [entry, ...tripRecords];
      try {
        localStorage.setItem(TRIPS_KEY, JSON.stringify(next)); setTripRecords(next); setEditing(entry.id);
        setNotice('تم حفظ كشف شغل مشاوير على الجهاز.');
      } catch { setNotice('تعذر حفظ المشاوير؛ تحقق من المساحة المتاحة.'); }
      return;
    }
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
  const makePdf = async (withPreview = false, source: 'current' | 'client' = 'current'): Promise<{ base64: string; filename: string } | null> => {
    if (busy) return null;
    if (source === 'current' && !check()) return null;
    if (source === 'client' && (!statementClient || !statementRows.length)) {
      setNotice('اختر العميل وحدد يوماً أو مشواراً واحداً على الأقل.'); return null;
    }
    const target = source === 'client' ? clientReportRef.current : reportRef.current;
    if (!target) return null;
    setBusy(true); setNotice('جار إعداد كشف PDF الاحترافي...');
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const pages = Array.from(target.querySelectorAll<HTMLElement>('[data-report-page]'));
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
        setPreviewTitle(source === 'client' ? statementReportName : title);
        setNotice('تم تجهيز المعاينة. راجع الصفحات ثم احفظ ملف PDF.');
      }
      return { base64: pdf.output('datauristring').split(',')[1], filename: source === 'client' ? statementFilename() : pdfFileName(client, mode) };
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

  const exportPdf = async (source: 'current' | 'client' = 'current') => {
    const result = await makePdf(false, source); if (!result) return;
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
  const sharePdf = async (source: 'current' | 'client' = 'current') => {
    const result = await makePdf(false, source); if (!result) return;
    try {
      const saved = await Filesystem.writeFile({
        path: `BAKR-PDF/${result.filename}`, data: result.base64, directory: Directory.Cache, recursive: true,
      });
      await Share.share({ title: `${source === 'client' ? statementReportName : title} - BAKR PRO`, text: source === 'client' ? statementReportName : title, url: saved.uri, dialogTitle: 'مشاركة PDF عبر واتساب' });
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
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: '5px 0' }}>شغل اليوميات والمشاوير</h1>
        <div style={{ fontSize: 12, color: '#dbe3ec' }}>كشوف مستقلة لليوميات والمشاوير • معاينة وحفظ ومشاركة PDF</div>
      </header>

      <section style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
        {([['daily', 'شغل اليوميات'], ['trips', 'شغل المشاوير']] as const).map(([value, label]) => <button
          type="button" key={value} onClick={() => switchMode(value)}
          style={{ ...btn, background: mode === value ? NAVY : '#e9eef4', color: mode === value ? '#fff' : NAVY,
            border: mode === value ? `2px solid ${GOLD}` : '2px solid transparent', minWidth: 0 }}>
          {label}
        </button>)}
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 17, fontWeight: 900, margin: '0 0 14px' }}>بيانات العمل — {mode === 'trips' ? 'مشاوير' : 'يوميات'}</h2>
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

      {mode === 'daily' ? <section style={card}>
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
      </section> : <section style={card}>
        <h2 style={{ fontSize: 17, fontWeight: 900, margin: '0 0 8px' }}>تفاصيل شغل المشاوير</h2>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>
          أضف كل مشوار بتاريخ وقيمة مستقلة، حتى لو تكرر التاريخ في نفس اليوم.
        </p>
        {field('تاريخ المشوار', newDate, setNewDate, 'date')}
        <div style={{ marginTop: 12 }}>{field('قيمة المشوار (ريال)', tripPrice, setTripPrice)}</div>
        <div style={{ marginTop: 12 }}>{field('وصف / ملاحظات المشوار (اختياري)', tripNotes, setTripNotes)}</div>
        <button type="button" style={{ ...btn, width: '100%', marginTop: 12, background: '#157347' }} onClick={addTrip}>+ إضافة مشوار</button>
        <div style={{ marginTop: 12 }}>
          {trips.length === 0 ? <p style={{ fontSize: 13, color: '#64748b' }}>لم تضف مشاوير بعد.</p> : trips.map((t, index) => <div key={t.id} style={{ padding: '10px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
              <b>{index + 1}. {dayName(t.date)} — {t.date}</b>
              <div style={{ color: '#166534', fontWeight: 900 }}>{amount(t.price)}</div>
              {t.notes && <div style={{ overflowWrap: 'anywhere' }}>{t.notes}</div>}
            </div>
            <button type="button" style={{ ...btn, background: '#fee2e2', color: '#991b1b', padding: '8px 10px', fontSize: 12, flexShrink: 0 }} onClick={() => setTrips(old => old.filter(x => x.id !== t.id))}>حذف</button>
          </div>)}
        </div>
      </section>}

      <section style={card}>
        <h2 style={{ fontSize: 17, fontWeight: 900, margin: '0 0 14px' }}>الحساب المالي</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 12 }}>
          {mode === 'daily' && field('سعر اليوم (ريال)', rate, setRate, 'text')}
          {field('المبلغ المستلم (ريال)', paid, setPaid, 'text')}
        </div>
        <div style={{ marginTop: 14, background: '#f1f5f9', borderRadius: 12, padding: 13, lineHeight: 2, fontSize: 14 }}>
          <div>{mode === 'trips' ? 'عدد المشاوير' : 'أيام العمل'}: <b>{mode === 'trips' ? trips.length : workDays.length}</b></div>
          <div>الإجمالي: <b>{amount(total)}</b></div>
          <div>المستلم: <b>{amount(received)}</b></div>
          <div style={{ fontSize: 19, fontWeight: 900, color: balance > 0 ? '#9a3412' : '#166534' }}>المتبقي: {amount(balance)}</div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 9, marginBottom: 14 }}>
        <button type="button" style={{ ...btn, background: '#15803d' }} onClick={save}>حفظ الكشف</button>
        <button type="button" style={{ ...btn, background: '#475569' }} disabled={busy} onClick={() => { void makePdf(true); }}>{busy ? 'جار التجهيز...' : 'معاينة PDF'}</button>
        <button type="button" style={{ ...btn, background: '#98712b' }} disabled={busy} onClick={() => { void exportPdf(); }}>{busy ? 'جار التجهيز...' : 'حفظ PDF'}</button>
        <button type="button" style={{ ...btn, background: '#0b7a4b' }} disabled={busy} onClick={() => { void sharePdf(); }}>مشاركة PDF عبر واتساب</button>
        <button type="button" style={{ ...btn, background: '#475569' }} onClick={reset}>كشف جديد</button>
      </div>
      {notice && <p role="status" style={{ background: '#fef3c7', color: '#78350f', padding: 12, borderRadius: 12, fontSize: 13 }}>{notice}</p>}

      <section style={{ ...card, border: `1px solid ${GOLD}` }}>
        <button type="button" style={{ ...btn, width: '100%', background: NAVY, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          onClick={() => { setStatementOpen(v => !v); setNotice(''); }}>
          <span>استخراج كشف حساب العميل</span><span>{statementOpen ? '−' : '+'}</span>
        </button>
        {statementOpen && <div style={{ marginTop: 15 }}>
          <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 14px' }}>يجمع أعمال العميل المسجلة سابقاً، ويمكنك اختيار الفترة أو استبعاد أيام ومشاوير محددة.</p>
          <label style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 6 }}>اختر العميل من الكشوف المحفوظة</label>
          <select style={inputStyle} value={statementClient} onChange={e => {
            setStatementClient(e.target.value); setStatementEquipment(''); changeStatementFilter();
          }}>
            <option value="">اختر العميل</option>
            {customerNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <label style={{ display: 'block', marginTop: 12, fontWeight: 800, fontSize: 13, marginBottom: 6 }}>الكرين / المعدة</label>
          <select style={inputStyle} value={statementEquipment} onChange={e => { setStatementEquipment(e.target.value); changeStatementFilter(); }}>
            <option value="">جميع كرينات العميل</option>
            {customerEquipment.map(e => <option value={e.id} key={e.id}>{e.name}</option>)}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 9, marginTop: 12 }}>
            <label style={{ minWidth: 0 }}><span style={{ fontSize: 12, fontWeight: 800 }}>من تاريخ</span>
              <input style={{ ...inputStyle, marginTop: 6 }} type="date" value={statementFrom} onChange={e => { setStatementFrom(e.target.value); changeStatementFilter(); }}/></label>
            <label style={{ minWidth: 0 }}><span style={{ fontSize: 12, fontWeight: 800 }}>إلى تاريخ</span>
              <input style={{ ...inputStyle, marginTop: 6 }} type="date" value={statementTo} onChange={e => { setStatementTo(e.target.value); changeStatementFilter(); }}/></label>
          </div>
          <button type="button" style={{ ...btn, marginTop: 10, width: '100%', background: '#64748b' }}
            onClick={() => { setStatementFrom(''); setStatementTo(''); setStatementEquipment(''); changeStatementFilter(); }}>عرض جميع الأيام / المشاوير</button>
          {statementFrom && statementTo && statementFrom > statementTo &&
            <p style={{ fontSize: 12, color: '#b91c1c' }}>تاريخ البداية يجب أن يسبق تاريخ النهاية.</p>}
          <div style={{ marginTop: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <b style={{ fontSize: 14 }}>الأعمال المحددة ({statementRows.length})</b>
            <button type="button" onClick={() => setExcludedStatementRows([])}
              style={{ ...btn, background: '#e9eef4', color: NAVY, minHeight: 36, fontSize: 12 }}>تحديد الكل</button>
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 8 }}>
            {!availableStatementRows.length ? <p style={{ fontSize: 12, color: '#64748b' }}>لا توجد أعمال محفوظة مطابقة للاختيار.</p> :
              availableStatementRows.map(item => <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 5px', borderBottom: '1px solid #edf0f4', fontSize: 12 }}>
                <input type="checkbox" checked={!excludedStatementRows.includes(item.id)}
                  onChange={e => setExcludedStatementRows(old => e.target.checked ? old.filter(x => x !== item.id) : [...old, item.id])}
                  style={{ width: 19, height: 19, flexShrink: 0 }}/>
                <span style={{ flex: 1, minWidth: 0 }}><b>{item.date}</b> — {item.equipmentName}</span>
                <b style={{ whiteSpace: 'nowrap' }}>{amount(item.price)}</b>
              </label>)}
          </div>
          <div style={{ background: SOFT, borderRadius: 12, marginTop: 12, padding: 13, lineHeight: 2 }}>
            <div>إجمالي الأعمال المحددة: <b>{amount(statementTotal)}</b></div>
            <div>المستلم: <b>{statementPaid === null ? 'غير محتسب لكشف جزئي' : amount(statementPaid)}</b></div>
            {statementPaid !== null && <div>المتبقي: <b>{amount(statementTotal - statementPaid)}</b></div>}
          </div>
          {statementPaid === null && statementRows.length > 0 && <p style={{ fontSize: 12, color: '#92400e' }}>
            عند اختيار بعض أيام كشف سابق فقط، لا نخصم دفعاته بالكامل حتى لا يظهر رصيد غير صحيح.
          </p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 8, marginTop: 12 }}>
            <button type="button" style={{ ...btn, background: '#475569' }} disabled={busy || !statementRows.length}
              onClick={() => { void makePdf(true, 'client'); }}>معاينة كشف حساب العميل PDF</button>
            <button type="button" style={{ ...btn, background: '#98712b' }} disabled={busy || !statementRows.length}
              onClick={() => { void exportPdf('client'); }}>حفظ كشف الحساب PDF</button>
            <button type="button" style={{ ...btn, background: '#0b7a4b' }} disabled={busy || !statementRows.length}
              onClick={() => { void sharePdf('client'); }}>إرسال كشف الحساب عبر واتساب</button>
          </div>
        </div>}
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 12px' }}>الكشوف المحفوظة — {mode === 'trips' ? 'المشاوير' : 'اليوميات'}</h2>
        {(mode === 'trips' ? tripRecords : records).length === 0 ? <p style={{ fontSize: 13 }}>لا توجد كشوف محفوظة بعد.</p> : mode === 'daily' ? records.map(r => <button type="button" key={r.id} onClick={() => load(r)} style={{ ...inputStyle, height: 'auto', textAlign: 'right', marginBottom: 8, padding: 12, cursor: 'pointer' }}>
          <b>{r.client}</b>
          <div style={{ fontSize: 12 }}>{r.equipmentName} — {(r.days || []).filter(x => x.worked).length} أيام — {amount((r.days || []).filter(x => x.worked).length * r.rate)}</div>
        </button>) : tripRecords.map(r => <button type="button" key={r.id} onClick={() => loadTrip(r)} style={{ ...inputStyle, height: 'auto', textAlign: 'right', marginBottom: 8, padding: 12, cursor: 'pointer' }}>
          <b>{r.client}</b>
          <div style={{ fontSize: 12 }}>{r.equipmentName} — {(r.trips || []).length} مشوار — {amount((r.trips || []).reduce((sum, t) => sum + t.price, 0))}</div>
        </button>)}
      </section>

      {/* html2canvas يحتاج HTML فعلياً موجوداً في الصفحة، ولا يظهر للمستخدم. */}
      <div aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0, width: 794, pointerEvents: 'none' }}>
        <div ref={reportRef}>
          <WorkReportA4 data={{ client, equipmentName: selected?.name || '', driver, site, dailyRate, paid: received, workedDays: workDays, mode, trips }} />
        </div>
        <div ref={clientReportRef}>
          <ClientAccountA4 client={statementClient} mode={mode} items={statementRows} paid={statementPaid}/>
        </div>
      </div>

      {previewImages.length > 0 && <div role="dialog" aria-modal="true" aria-label={`معاينة ${previewTitle || title}`} style={{
        position: 'fixed', zIndex: 9999, inset: 0, background: '#071323ec', padding: '18px 10px 25px',
        overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <div style={{ width: '100%', maxWidth: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
          <b>معاينة كشف PDF — {previewImages.length} صفحة</b>
          <button type="button" onClick={() => setPreviewImages([])} style={{ ...btn, background: '#b63e3e' }}>إغلاق ✕</button>
        </div>
        {previewImages.map((src, index) => <img key={index} alt={`صفحة ${index + 1} من ${previewTitle || title}`} src={src} style={{ width: '100%', maxWidth: 600, height: 'auto', display: 'block', boxShadow: '0 8px 24px #0005' }} />)}
      </div>}
    </div>
  </AppLayout>;
}

export default DailyCraneWorkPage;
