import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Share2, MessageCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { AppLayout } from '@/components/layout/AppLayout';
import { fetchEquipment, type Equipment } from '@/lib/equipment';

type DayRow = {
  day: number;
  workType: string;
  tripType: string;
  tripPrice: number;
  expenseType: string;
  expenseAmount: number;
  notes: string;
};

type ExternalExpenseRecord = {
  id: number;
  date: string;
  driverId: string;
  driverName: string;
  equipmentId: string;
  equipmentName: string;
  category: string;
  amount: number;
  location: string;
  notes: string;
  affectsDriverBalance: boolean;
  createdAt: string;
  updatedAt: string;
};

const EXPENSE_STORAGE_KEY = 'crane_accounting_driver_equipment_expenses_v1';
const HACEN_FONT_NAME = 'HacenEgypt';
const PUBLIC_BASE = import.meta.env.BASE_URL || '/';
const HACEN_FONT_URL = `${PUBLIC_BASE}hacen-egypt.ttf`;
const MONTHLY_HEADER_URL = `${PUBLIC_BASE}monthly-header.png`;
const PDF_WIDTH = 794;
const PDF_HEIGHT = 1123;
const PDF_SCALE = 4;

const monthNames = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
];

function normalizeArabicNumbers(value: string) {
  return value
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/٬/g, '')
    .replace(/,/g, '');
}

function formatEquipmentName(value: string) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/كرين\s*(\d+)/g, 'كرين $1')
    .replace(/(\d+)\s*طن/g, '$1 طن')
    .replace(/طن([^\s])/g, 'طن $1')
    .trim();
}

function getDateParts(value: string) {
  const p = String(value || '').split('-');
  if (p.length < 3) return null;
  const year = Number(p[0]);
  const month = Number(p[1]);
  const day = Number(p[2]);
  if (![year, month, day].every(Number.isFinite)) return null;
  return { year, month, day };
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`تعذر تحميل الصورة: ${src}`));
    img.src = src;
  });
}

export function MonthlyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const now = new Date();
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState(id || '');
  const [equipmentLoading, setEquipmentLoading] = useState(true);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [creatingPdf, setCreatingPdf] = useState(false);
  const [externalExpenses, setExternalExpenses] = useState<ExternalExpenseRecord[]>([]);
  const [rowsLoaded, setRowsLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setEquipmentLoading(true);
    fetchEquipment()
      .then(list => {
        if (!alive) return;
        const safe = Array.isArray(list) ? list : [];
        setEquipmentList(safe);
        setEquipmentId(current => {
          if (id && safe.some(x => String(x.id) === String(id))) return String(id);
          if (safe.some(x => String(x.id) === String(current))) return current;
          return safe.length ? String(safe[0].id) : '';
        });
      })
      .catch(error => {
        console.error('EQUIPMENT LOAD ERROR:', error);
        if (alive) setEquipmentList([]);
      })
      .finally(() => { if (alive) setEquipmentLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const selectedEquipment = useMemo(
    () => equipmentList.find(x => String(x.id) === String(equipmentId)) || null,
    [equipmentList, equipmentId]
  );

  const displayEquipmentName = formatEquipmentName(selectedEquipment?.name || 'لا توجد معدة محددة');
  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);
  const storageKey = equipmentId
    ? `monthly-ledger-v3-${equipmentId}-${year}-${month}`
    : `monthly-ledger-v3-no-equipment-${year}-${month}`;

  const emptyRows = () => Array.from({ length: daysInMonth }, (_, i): DayRow => ({
    day: i + 1, workType: '', tripType: '', tripPrice: 0,
    expenseType: '', expenseAmount: 0, notes: '',
  }));

  const [rows, setRows] = useState<DayRow[]>(emptyRows());

  useEffect(() => {
    setRowsLoaded(false);
    try {
      if (!equipmentId) { setRows(emptyRows()); return; }
      const raw = localStorage.getItem(storageKey);
      if (!raw) { setRows(emptyRows()); return; }
      const saved = JSON.parse(raw) as DayRow[];
      setRows(emptyRows().map(r => ({ ...r, ...(saved.find(x => x.day === r.day) || {}) })));
    } catch (e) {
      console.error('MONTHLY READ ERROR:', e);
      setRows(emptyRows());
    } finally { setRowsLoaded(true); }
  }, [equipmentId, year, month, daysInMonth, storageKey]);

  useEffect(() => {
    if (!equipmentId || !rowsLoaded) return;
    try { localStorage.setItem(storageKey, JSON.stringify(rows)); }
    catch (e) { console.error('MONTHLY SAVE ERROR:', e); }
  }, [rows, storageKey, equipmentId, rowsLoaded]);

  const loadExternalExpenses = () => {
    try {
      const raw = localStorage.getItem(EXPENSE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setExternalExpenses(Array.isArray(parsed) ? parsed : []);
    } catch { setExternalExpenses([]); }
  };

  useEffect(() => {
    loadExternalExpenses();
    const focus = () => loadExternalExpenses();
    const updated = () => loadExternalExpenses();
    const storage = (e: StorageEvent) => {
      if (!e.key || e.key === EXPENSE_STORAGE_KEY) loadExternalExpenses();
    };
    window.addEventListener('focus', focus);
    window.addEventListener('storage', storage);
    window.addEventListener('driver-equipment-expenses-updated', updated);
    return () => {
      window.removeEventListener('focus', focus);
      window.removeEventListener('storage', storage);
      window.removeEventListener('driver-equipment-expenses-updated', updated);
    };
  }, []);

  const externalByDay = useMemo(() => {
    const map = new Map<number, ExternalExpenseRecord[]>();
    if (!equipmentId) return map;
    externalExpenses.forEach(expense => {
      if (String(expense.equipmentId || '') !== String(equipmentId)) return;
      const d = getDateParts(expense.date);
      if (!d || d.year !== year || d.month !== month + 1) return;
      const arr = map.get(d.day) || [];
      arr.push(expense);
      map.set(d.day, arr);
    });
    return map;
  }, [externalExpenses, equipmentId, year, month]);

  const linkedTotal = (day: number) => (externalByDay.get(day) || [])
    .reduce((s, x) => s + (Number(x.amount) || 0), 0);

  const linkedCategories = (day: number) => Array.from(new Set(
    (externalByDay.get(day) || []).map(x => x.category).filter(Boolean)
  )).join(' + ');

  const updateText = (day: number, field: 'workType'|'tripType'|'expenseType'|'notes', value: string) => {
    setRows(old => old.map(r => r.day === day ? { ...r, [field]: value } : r));
  };

  const updateNumber = (day: number, field: 'tripPrice'|'expenseAmount', value: string) => {
    const valueNumber = Number(normalizeArabicNumbers(value));
    setRows(old => old.map(r => r.day === day ? { ...r, [field]: Number.isFinite(valueNumber) ? valueNumber : 0 } : r));
  };

  const totals = useMemo(() => rows.reduce((s, r) => {
    const linked = linkedTotal(r.day);
    const hasWork = r.workType.trim() || r.tripType.trim() || r.tripPrice > 0 ||
      r.expenseType.trim() || r.expenseAmount > 0 || r.notes.trim() || linked > 0;
    if (hasWork) s.registeredDays++;
    if (r.tripType.trim() || r.tripPrice > 0) s.trips++;
    s.income += Number(r.tripPrice) || 0;
    s.manualExpense += Number(r.expenseAmount) || 0;
    s.linkedExpense += linked;
    return s;
  }, { trips: 0, income: 0, manualExpense: 0, linkedExpense: 0, registeredDays: 0 }), [rows, externalByDay]);

  const totalExpense = totals.manualExpense + totals.linkedExpense;
  const net = totals.income - totalExpense;

  const inputStyle: React.CSSProperties = {
    width: '100%', minWidth: 120, padding: '10px 8px', borderRadius: 10,
    border: '1px solid #26364f', background: '#0a1424', color: '#fff',
    fontSize: 13, boxSizing: 'border-box', outline: 'none',
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, minWidth: 0, padding: 12 };
  const summaryCard: React.CSSProperties = {
    background: '#0b1527', border: '1px solid #1d2d47', borderRadius: 16,
    padding: 14, textAlign: 'center',
  };
  const buttonStyle: React.CSSProperties = {
    border: 'none', borderRadius: 14, padding: '14px 10px', fontSize: 14,
    fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 6, color: '#fff',
  };

  async function createPdfBlob() {
    try { await document.fonts.load(`400 20px "${HACEN_FONT_NAME}"`); } catch {}
    const canvas = document.createElement('canvas');
    canvas.width = PDF_WIDTH * PDF_SCALE;
    canvas.height = PDF_HEIGHT * PDF_SCALE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('تعذر إنشاء PDF');
    ctx.scale(PDF_SCALE, PDF_SCALE);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, PDF_WIDTH, PDF_HEIGHT);

    try {
      const img = await loadImage(MONTHLY_HEADER_URL);
      ctx.drawImage(img, 0, 0, PDF_WIDTH, 304);
    } catch {
      ctx.fillStyle = '#eef7ff'; ctx.fillRect(0, 0, PDF_WIDTH, 304);
      ctx.fillStyle = '#082c5f'; ctx.textAlign = 'center'; ctx.font = 'bold 38px Arial';
      ctx.fillText('BAKR PRO', PDF_WIDTH / 2, 70);
    }

    const arabic = (text: string, x: number, y: number, size: number, color = '#0f172a', weight = 400) => {
      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${weight} ${size}px "${HACEN_FONT_NAME}", Arial`;
      ctx.fillStyle = color;
      ctx.fillText(String(text || ''), x, y);
    };

    // المعدة / الشهر / السنة: كل قيمة في منتصف خانتها بالضبط
    const fy = 267, fh = 30, gap = 10, yearW = 130, monthW = 160;
    const equipmentW = PDF_WIDTH - 36 - yearW - monthW - gap * 2;
    const boxes = [
      { x: 18, w: yearW, label: 'السنة', value: String(year) },
      { x: 18 + yearW + gap, w: monthW, label: 'الشهر', value: monthNames[month] },
      { x: 18 + yearW + gap + monthW + gap, w: equipmentW, label: 'المعدة', value: displayEquipmentName },
    ];
    boxes.forEach(b => {
      roundedRect(ctx, b.x, fy, b.w, fh, 8);
      ctx.fillStyle = 'rgba(255,255,255,.97)';
      ctx.fill();
      ctx.strokeStyle = '#bcd4ea';
      ctx.stroke();
      arabic(b.label, b.x + b.w / 2, fy + 8, 9, '#082c5f', 700);
      arabic(b.value, b.x + b.w / 2, fy + 21, 18, '#0f172a', 700);
    });

    const tableX = 18, tableY = 310, tableW = PDF_WIDTH - 36, headH = 36, summaryY = 1000;
    const rowH = (summaryY - tableY - headH - 6) / 31;
    const cols = [
      ['day','اليوم',.07], ['work','نوع العمل',.20], ['location','موقع العمل',.20],
      ['trip','سعر المشوار',.18], ['expense','مصاريف أخرى',.20], ['amount','المبلغ',.15],
    ] as const;
    let cx = tableX + tableW;
    const rects = cols.map(([key,label,ratio]) => {
      const w = tableW * ratio;
      cx -= w;
      return { key, label, w, x: cx };
    });

    rects.forEach(c => {
      ctx.fillStyle = '#0b4f99';
      ctx.fillRect(c.x, tableY, c.w, headH);
      ctx.strokeStyle = '#ffffff66';
      ctx.strokeRect(c.x, tableY, c.w, headH);
      arabic(c.label, c.x + c.w / 2, tableY + headH / 2, 16, '#fff', 700);
    });

    for (let day = 1; day <= 31; day++) {
      const r = rows.find(x => x.day === day) || {
        day, workType:'', tripType:'', tripPrice:0,
        expenseType:'', expenseAmount:0, notes:''
      };
      const linked = linkedTotal(day);
      const amount = (Number(r.expenseAmount) || 0) + linked;
      const vals: Record<string,string> = {
        day: String(day),
        work: r.workType,
        location: r.tripType,
        trip: r.tripPrice > 0 ? r.tripPrice.toLocaleString('en-US') : '',
        expense: [r.expenseType, linkedCategories(day)].filter(Boolean).join(' + '),
        amount: amount > 0 ? amount.toLocaleString('en-US') : '',
      };
      const y = tableY + headH + (day - 1) * rowH;
      rects.forEach(c => {
        ctx.fillStyle = day % 2 === 0 ? '#eef7ff' : '#fff';
        ctx.fillRect(c.x, y, c.w, rowH);
        ctx.strokeStyle = '#bcd4ea';
        ctx.lineWidth = .55;
        ctx.strokeRect(c.x, y, c.w, rowH);

        const value = vals[c.key] || '';
        if (value) {
          // المطلوب: خزان / ديزل / 50 وباقي بيانات الصفوف = 19px
          arabic(
            value,
            c.x + c.w / 2,
            y + rowH / 2,
            19,
            c.key === 'amount' ? '#d32f2f' : c.key === 'trip' ? '#129c70' : '#0f172a',
            700
          );
        }
      });
    }

    const cards = [
      ['إجمالي المشاوير', String(totals.trips), '#5b21b6', '#f7f3ff'],
      ['إجمالي الدخل', `${totals.income.toLocaleString('en-US')} ر.س`, '#129c70', '#eefcf4'],
      ['إجمالي المصروفات', `${totalExpense.toLocaleString('en-US')} ر.س`, '#d32f2f', '#fff3f3'],
      ['صافي الشهر', `${net.toLocaleString('en-US')} ر.س`, net >= 0 ? '#082c5f' : '#d32f2f', '#fff8ee'],
    ];
    const sg = 8, sw = (PDF_WIDTH - 36 - sg * 3) / 4, sh = 64;

    cards.forEach((c, i) => {
      const x = PDF_WIDTH - 18 - sw - i * (sw + sg);
      roundedRect(ctx, x, 1003, sw, sh, 9);
      ctx.fillStyle = c[3];
      ctx.fill();
      ctx.strokeStyle = `${c[2]}55`;
      ctx.stroke();

      // المطلوب: عناوين الإجماليات = 19px
      arabic(c[0], x + sw / 2, 1022, 19, '#0f172a', 700);

      // المطلوب: الأرقام مثل 2,000 و 2,550 = 20px
      arabic(c[1], x + sw / 2, 1050, 20, c[2], 700);
    });

    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#334155';
    ctx.font = '700 9px Arial';
    ctx.fillText('BAKR ALMASBHI © 2026 — All Rights Reserved.', PDF_WIDTH / 2, 1090);
    ctx.font = '900 12px Arial';
    ctx.fillStyle = '#082c5f';
    ctx.fillText('0558995962', 120, 1090);

    const imageData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4', compress:false });
    pdf.addImage(
      imageData, 'PNG', 0, 0,
      pdf.internal.pageSize.getWidth(),
      pdf.internal.pageSize.getHeight(),
      undefined, 'NONE'
    );
    return pdf.output('blob');
  }

  async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve,reject)=>{
      const reader = new FileReader();
      reader.onloadend = () => {
        const s = String(reader.result || '');
        resolve(s.includes(',') ? s.split(',')[1] : s);
      };
      reader.onerror = () => reject(new Error('تعذر قراءة PDF'));
      reader.readAsDataURL(blob);
    });
  }

  async function createPdfFile() {
    const blob = await createPdfBlob();
    const data = await blobToBase64(blob);
    const clean = displayEquipmentName.replace(/[\\/:*?"<>|]/g,'-');
    const result = await Filesystem.writeFile({
      path:`BAKR-PRO-${clean}-${monthNames[month]}-${year}.pdf`,
      data,
      directory:Directory.Cache,
    });
    return result.uri;
  }

  async function handlePdf() {
    if(!equipmentId) return alert('اختر المعدة أولاً');
    try {
      setCreatingPdf(true);
      const url = await createPdfFile();
      await Share.share({title:'الحساب الشهري',url,dialogTitle:'حفظ أو مشاركة كشف الحساب'});
    } catch(e) {
      console.error(e);
      alert('تعذر إنشاء ملف PDF');
    } finally {
      setCreatingPdf(false);
    }
  }

  async function handleShare() {
    if(!equipmentId) return alert('اختر المعدة أولاً');
    try {
      setCreatingPdf(true);
      const url = await createPdfFile();
      await Share.share({
        title:'الحساب الشهري',
        text:`${displayEquipmentName} - ${monthNames[month]} ${year}`,
        url,
        dialogTitle:'مشاركة كشف الحساب'
      });
    } finally {
      setCreatingPdf(false);
    }
  }

  function handleWhatsApp() {
    if(!equipmentId) return alert('اختر المعدة أولاً');
    const text=`📊 BAKR PRO\nالحساب الشهري\n\n🏗️ المعدة: ${displayEquipmentName}\n📅 الشهر: ${monthNames[month]} ${year}\n\n🚚 عدد المشاوير: ${totals.trips}\n💰 إجمالي الدخل: ${totals.income.toLocaleString('en-US')} ر.س\n💸 إجمالي المصروفات: ${totalExpense.toLocaleString('en-US')} ر.س\n✅ صافي الشهر: ${net.toLocaleString('en-US')} ر.س`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank');
  }

  return (
    <AppLayout>
      <style>{`@font-face{font-family:'${HACEN_FONT_NAME}';src:url('${HACEN_FONT_URL}') format('truetype');font-style:normal;font-weight:400;font-display:block;}`}</style>
      <div dir="rtl" style={{padding:18,paddingBottom:110,maxWidth:1100,margin:'auto',color:'#fff'}}>
        <h1 style={{margin:0,fontSize:27,fontWeight:800}}>الحساب الشهري</h1>
        <p style={{color:'#94a3b8',marginTop:7}}>سجل أعمال ومشاوير ومصاريف {displayEquipmentName}</p>

        <div style={{background:'#0b1527',border:'1px solid #1d2d47',borderRadius:18,padding:14,marginBottom:18,display:'grid',gap:10}}>
          <label>
            <small style={{color:'#94a3b8'}}>المعدة</small>
            <select value={equipmentId} onChange={e=>setEquipmentId(e.target.value)} style={selectStyle} disabled={equipmentLoading || equipmentList.length===0}>
              {equipmentLoading ? <option value="">جاري تحميل المعدات...</option> : equipmentList.length===0 ? <option value="">لا توجد معدات</option> : equipmentList.map(x=><option key={x.id} value={String(x.id)}>{formatEquipmentName(x.name)}</option>)}
            </select>
          </label>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <select value={month} onChange={e=>setMonth(Number(e.target.value))} style={selectStyle}>{monthNames.map((x,i)=><option key={x} value={i}>{x}</option>)}</select>
            <select value={year} onChange={e=>setYear(Number(e.target.value))} style={selectStyle}>{Array.from({length:7},(_,i)=>now.getFullYear()-2+i).map(y=><option key={y} value={y}>{y}</option>)}</select>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginBottom:18}}>
          <div style={summaryCard}>إجمالي المشاوير<h2>{totals.trips}</h2></div>
          <div style={summaryCard}>إجمالي الدخل<h2 style={{color:'#22c55e'}}>{totals.income.toLocaleString('en-US')} ر.س</h2></div>
          <div style={summaryCard}>إجمالي المصروفات<h2 style={{color:'#ef4444'}}>{totalExpense.toLocaleString('en-US')} ر.س</h2></div>
          <div style={summaryCard}>صافي الشهر<h2 style={{color:net>=0?'#3b82f6':'#ef4444'}}>{net.toLocaleString('en-US')} ر.س</h2></div>
        </div>

        <div style={{overflowX:'auto',border:'1px solid #2b5b92',borderRadius:18}}>
          <table style={{width:'100%',minWidth:1050,borderCollapse:'collapse',textAlign:'center'}}>
            <thead><tr style={{background:'linear-gradient(180deg,#0f5fb7,#063a78)'}}>
              {['اليوم','نوع العمل','موقع العمل','سعر المشوار','مصاريف أخرى','المبلغ'].map(x=><th key={x} style={{padding:'15px 10px',fontSize:17,fontWeight:900,color:'#fff',whiteSpace:'nowrap'}}>{x}</th>)}
            </tr></thead>
            <tbody>{rows.map(row=>{
              const linked=externalByDay.get(row.day)||[];
              const linkedAmount=linkedTotal(row.day);
              return <tr key={row.day} style={{borderTop:'1px solid #1d2d47'}}>
                <td>{row.day}</td>
                <td><input value={row.workType} onChange={e=>updateText(row.day,'workType',e.target.value)} style={inputStyle}/></td>
                <td><input value={row.tripType} onChange={e=>updateText(row.day,'tripType',e.target.value)} style={inputStyle}/></td>
                <td><input inputMode="decimal" value={row.tripPrice||''} onChange={e=>updateNumber(row.day,'tripPrice',e.target.value)} style={inputStyle}/></td>
                <td><div style={{display:'grid',gap:6}}><input value={row.expenseType} onChange={e=>updateText(row.day,'expenseType',e.target.value)} placeholder="مثال: ديزل" style={inputStyle}/>{linked.length>0&&<small style={{color:'#fca5a5'}}>مرتبط: {linkedAmount.toLocaleString('en-US')} ر.س</small>}</div></td>
                <td><input inputMode="decimal" value={row.expenseAmount||''} onChange={e=>updateNumber(row.day,'expenseAmount',e.target.value)} style={inputStyle}/></td>
              </tr>;
            })}</tbody>
          </table>
        </div>

        <div style={{marginTop:18,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
          <button onClick={handlePdf} disabled={creatingPdf} style={{...buttonStyle,background:'#2563eb'}}><Download size={18}/>{creatingPdf?'جاري...':'حفظ PDF'}</button>
          <button onClick={handleShare} disabled={creatingPdf} style={{...buttonStyle,background:'#7c3aed'}}><Share2 size={18}/>مشاركة</button>
          <button onClick={handleWhatsApp} style={{...buttonStyle,background:'#16a34a'}}><MessageCircle size={18}/>واتساب</button>
        </div>
      </div>
    </AppLayout>
  );
        }
