import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Wallet, Plus, Trash2, Pencil, Save, X, Fuel, Wrench, UserRound,
  Utensils, Plane, Receipt, Search, ChevronRight, ChevronLeft,
  Image as ImageIcon, FileDown, Share2, Banknote, Building2, Truck,
} from 'lucide-react';
import jsPDF from 'jspdf';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

import { AppLayout } from '@/components/layout/AppLayout';
import { fetchEquipment, type Equipment } from '@/lib/equipment';

const EXPENSE_STORAGE_KEY = 'crane_accounting_driver_equipment_expenses_v1';
const DRIVER_STORAGE_KEY = 'crane_drivers_v1';

type RelationType = 'general' | 'equipment' | 'driver';
type PaymentMethod = 'كاش' | 'تحويل' | 'بطاقة';

type DriverRecord = {
  id: string | number;
  name: string;
};

type ExpenseRecord = {
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
  paymentMethod?: PaymentMethod;
  receiptImage?: string;
  relationType?: RelationType;
};

const monthNames = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
];

const categories = [
  'ديزل','بترول','قطع غيار','صيانة','مصروف سائق',
  'أكل وشرب','تحويل لليمن','إيجار','غسيل','زيوت وفلاتر','أخرى'
];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function safeNumber(value: string | number) {
  const n = Number(String(value ?? '').replace(/,/g,''));
  return Number.isFinite(n) ? n : 0;
}

function money(value: number) {
  return `${value.toLocaleString('en-US')} ر.س`;
}

function getDateParts(value: string) {
  const [y,m,d] = String(value || '').split('-').map(Number);
  return y && m && d ? {year:y, month:m, day:d} : null;
}

function loadExpenses(): ExpenseRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(EXPENSE_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function loadDrivers(): DriverRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(DRIVER_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map((x:any,i:number)=>({
      id: x?.id ?? i+1,
      name: String(x?.name || x?.driverName || `سائق ${i+1}`)
    }));
  } catch { return []; }
}

function categoryIcon(category:string) {
  if (category.includes('ديزل') || category.includes('بترول')) return Fuel;
  if (category.includes('صيانة') || category.includes('غيار') || category.includes('زيوت')) return Wrench;
  if (category.includes('سائق')) return UserRound;
  if (category.includes('أكل')) return Utensils;
  if (category.includes('اليمن') || category.includes('تحويل')) return Plane;
  return Receipt;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function ExpensesPage() {
  const now = new Date();
  const receiptRef = useRef<HTMLInputElement>(null);

  const [expenses,setExpenses] = useState<ExpenseRecord[]>([]);
  const [equipmentList,setEquipmentList] = useState<Equipment[]>([]);
  const [drivers,setDrivers] = useState<DriverRecord[]>([]);
  const [year,setYear] = useState(now.getFullYear());
  const [month,setMonth] = useState(now.getMonth());
  const [search,setSearch] = useState('');

  const [editingId,setEditingId] = useState<number|null>(null);
  const [date,setDate] = useState(todayIso());
  const [category,setCategory] = useState('ديزل');
  const [amount,setAmount] = useState('');
  const [relationType,setRelationType] = useState<RelationType>('general');
  const [equipmentId,setEquipmentId] = useState('');
  const [driverId,setDriverId] = useState('');
  const [paymentMethod,setPaymentMethod] = useState<PaymentMethod>('كاش');
  const [location,setLocation] = useState('');
  const [notes,setNotes] = useState('');
  const [receiptImage,setReceiptImage] = useState('');

  useEffect(()=>{
    const reload = () => {
      setExpenses(loadExpenses());
      setDrivers(loadDrivers());
    };
    reload();
    fetchEquipment().then(setEquipmentList).catch(()=>setEquipmentList([]));
    window.addEventListener('storage',reload);
    window.addEventListener('focus',reload);
    window.addEventListener('driver-equipment-expenses-updated',reload);
    return ()=>{
      window.removeEventListener('storage',reload);
      window.removeEventListener('focus',reload);
      window.removeEventListener('driver-equipment-expenses-updated',reload);
    };
  },[]);

  function persist(next:ExpenseRecord[]) {
    setExpenses(next);
    localStorage.setItem(EXPENSE_STORAGE_KEY,JSON.stringify(next));
    window.dispatchEvent(new Event('driver-equipment-expenses-updated'));
  }

  function resetForm() {
    setEditingId(null);
    setDate(todayIso());
    setCategory('ديزل');
    setAmount('');
    setRelationType('general');
    setEquipmentId('');
    setDriverId('');
    setPaymentMethod('كاش');
    setLocation('');
    setNotes('');
    setReceiptImage('');
    if (receiptRef.current) receiptRef.current.value = '';
  }

  function saveExpense() {
    const numericAmount = safeNumber(amount);
    if (!date) return alert('اختر التاريخ');
    if (numericAmount <= 0) return alert('اكتب مبلغ المصروف');
    if (relationType === 'equipment' && !equipmentId) return alert('اختر الكرين / المعدة');
    if (relationType === 'driver' && !driverId) return alert('اختر السائق / المشغل');

    const selectedEquipment = equipmentList.find(x=>String(x.id)===String(equipmentId));
    const selectedDriver = drivers.find(x=>String(x.id)===String(driverId));
    const stamp = new Date().toISOString();

    const values = {
      date,
      category,
      amount:numericAmount,
      relationType,
      equipmentId: relationType === 'equipment' ? String(equipmentId) : '',
      equipmentName: relationType === 'equipment' ? selectedEquipment?.name || '' : '',
      driverId: relationType === 'driver' ? String(driverId) : '',
      driverName: relationType === 'driver' ? selectedDriver?.name || '' : '',
      affectsDriverBalance: relationType === 'driver',
      paymentMethod,
      location:location.trim(),
      notes:notes.trim(),
      receiptImage,
      updatedAt:stamp,
    };

    if (editingId !== null) {
      persist(expenses.map(item=>item.id===editingId ? {...item,...values} : item));
    } else {
      persist([{id:Date.now(),createdAt:stamp,...values},...expenses]);
    }
    resetForm();
  }

  function editExpense(item:ExpenseRecord) {
    setEditingId(item.id);
    setDate(item.date);
    setCategory(item.category || 'أخرى');
    setAmount(String(item.amount || ''));
    setPaymentMethod(item.paymentMethod || 'كاش');
    setLocation(item.location || '');
    setNotes(item.notes || '');
    setReceiptImage(item.receiptImage || '');
    if (item.equipmentId) {
      setRelationType('equipment'); setEquipmentId(String(item.equipmentId)); setDriverId('');
    } else if (item.driverId) {
      setRelationType('driver'); setDriverId(String(item.driverId)); setEquipmentId('');
    } else {
      setRelationType('general'); setEquipmentId(''); setDriverId('');
    }
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function removeExpense(id:number) {
    if (!window.confirm('حذف هذا المصروف؟')) return;
    persist(expenses.filter(x=>x.id!==id));
    if (editingId===id) resetForm();
  }

  function handleReceipt(e:React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('اختر صورة فقط');
    const reader = new FileReader();
    reader.onload = ()=>setReceiptImage(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  const monthExpenses = useMemo(()=>{
    const q = search.trim().toLowerCase();
    return expenses.filter(item=>{
      const p = getDateParts(item.date);
      return !!p && p.year===year && p.month===month+1;
    }).filter(item=>{
      if (!q) return true;
      return [
        item.category,item.equipmentName,item.driverName,item.paymentMethod,
        item.location,item.notes,String(item.amount),item.date
      ].join(' ').toLowerCase().includes(q);
    }).sort((a,b)=>b.date.localeCompare(a.date) || b.id-a.id);
  },[expenses,year,month,search]);

  const monthlyRows = useMemo(()=>{
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const rows: Array<{ day:number; item:ExpenseRecord | null }> = [];

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dayItems = monthExpenses
        .filter(item => getDateParts(item.date)?.day === day)
        .sort((a,b)=>a.id-b.id);

      if (dayItems.length === 0) {
        rows.push({day,item:null});
      } else {
        dayItems.forEach(item=>rows.push({day,item}));
      }
    }

    return rows;
  },[monthExpenses,year,month]);

  const totals = useMemo(()=>{
    let equipment=0, driversTotal=0, general=0;
    monthExpenses.forEach(item=>{
      if (item.equipmentId) equipment += safeNumber(item.amount);
      else if (item.driverId) driversTotal += safeNumber(item.amount);
      else general += safeNumber(item.amount);
    });
    return {
      total:equipment+driversTotal+general,
      equipment,drivers:driversTotal,general,count:monthExpenses.length
    };
  },[monthExpenses]);

  function previousMonth() {
    if (month===0) { setMonth(11); setYear(v=>v-1); }
    else setMonth(v=>v-1);
  }

  function nextMonth() {
    if (month===11) { setMonth(0); setYear(v=>v+1); }
    else setMonth(v=>v+1);
  }

  function linkedLabel(item:ExpenseRecord) {
    if (item.equipmentName) return item.equipmentName;
    if (item.driverName) return `السائق: ${item.driverName}`;
    return 'مصروف عام';
  }

  function makePdf() {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
      compress: true,
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const canvas = document.createElement('canvas');
    canvas.width = 1240;
    canvas.height = 1754;

    const ctx = canvas.getContext('2d');
    if (!ctx) return doc;

    const rowsPerPage = 18;
    const dataRows = monthExpenses.length > 0 ? monthExpenses : [];
    const pageCount = Math.max(1, Math.ceil(Math.max(dataRows.length, 1) / rowsPerPage));

    const navy = '#071827';
    const navy2 = '#0c2740';
    const gold = '#f4b62c';
    const softGold = '#fff4d6';
    const green = '#16a36a';
    const blue = '#2d7ff9';
    const purple = '#8b5cf6';
    const light = '#f7f9fc';
    const border = '#d8e1eb';
    const text = '#0f172a';
    const muted = '#64748b';

    const roundRect = (
      x: number,
      y: number,
      w: number,
      h: number,
      r: number,
      fill: string,
      stroke?: string
    ) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };

    const drawText = (
      value: string,
      x: number,
      y: number,
      size: number,
      weight: 'normal' | 'bold' = 'normal',
      color = text,
      align: CanvasTextAlign = 'right'
    ) => {
      ctx.save();
      ctx.direction = 'rtl';
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      ctx.font = `${weight === 'bold' ? '700' : '400'} ${size}px Arial, sans-serif`;
      ctx.fillStyle = color;
      ctx.fillText(String(value || ''), x, y);
      ctx.restore();
    };

    const drawEnglish = (
      value: string,
      x: number,
      y: number,
      size: number,
      weight: 'normal' | 'bold' = 'normal',
      color = text,
      align: CanvasTextAlign = 'left'
    ) => {
      ctx.save();
      ctx.direction = 'ltr';
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      ctx.font = `${weight === 'bold' ? '700' : '400'} ${size}px Arial, sans-serif`;
      ctx.fillStyle = color;
      ctx.fillText(String(value || ''), x, y);
      ctx.restore();
    };

    const fitArabic = (
      value: string,
      x: number,
      y: number,
      maxWidth: number,
      startSize: number,
      color = text
    ) => {
      let size = startSize;
      ctx.save();
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      while (size > 14) {
        ctx.font = `700 ${size}px Arial, sans-serif`;
        if (ctx.measureText(value).width <= maxWidth) break;
        size -= 1;
      }
      ctx.fillStyle = color;
      ctx.fillText(value, x, y);
      ctx.restore();
    };

    const drawSummaryCard = (
      x: number,
      y: number,
      w: number,
      title: string,
      value: number,
      accent: string,
      pale: string
    ) => {
      roundRect(x, y, w, 118, 18, pale, `${accent}33`);
      roundRect(x + 16, y + 18, 54, 54, 14, `${accent}20`);
      drawText('●', x + 43, y + 45, 34, 'bold', accent, 'center');
      drawText(title, x + w - 18, y + 36, 23, 'bold', text);
      drawEnglish(value.toLocaleString('en-US'), x + w - 18, y + 77, 34, 'bold', accent, 'right');
      drawText('ر.س', x + w - 18, y + 102, 18, 'bold', muted);
    };

    const drawFooter = (pageNumber: number, totalPages: number) => {
      ctx.fillStyle = navy;
      ctx.fillRect(0, 1572, 1240, 182);

      drawEnglish('BAKR PRO', 62, 1620, 31, 'bold', '#ffffff');
      drawText('إدارة حسابات الكرينات', 62, 1657, 20, 'bold', '#ffffff', 'left');
      drawText('خميس مشيط - أبها ومنطقة عسير', 618, 1624, 20, 'bold', '#ffffff', 'center');
      drawEnglish('0558995962', 618, 1664, 30, 'bold', gold, 'center');
      drawText('معًا نحو إدارة أفضل ومستقبل أعلى', 1172, 1624, 21, 'bold', '#ffffff');
      drawEnglish(`Page ${pageNumber} / ${totalPages}`, 1172, 1665, 18, 'normal', '#cbd5e1', 'right');
    };

    for (let page = 0; page < pageCount; page += 1) {
      if (page > 0) doc.addPage();

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Header
      ctx.fillStyle = navy;
      ctx.fillRect(0, 0, 1240, 270);

      // gold diagonal accent
      ctx.fillStyle = gold;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(250, 0);
      ctx.lineTo(175, 270);
      ctx.lineTo(0, 270);
      ctx.closePath();
      ctx.fill();

      // subtle crane-like silhouette
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(930, 220);
      ctx.lineTo(1055, 86);
      ctx.lineTo(1180, 86);
      ctx.moveTo(1055, 86);
      ctx.lineTo(1055, 222);
      ctx.stroke();
      ctx.restore();

      drawEnglish('BAKR PRO', 46, 60, 48, 'bold', navy, 'left');
      drawText('إدارة حسابات الكرينات', 46, 114, 24, 'bold', navy, 'left');
      drawEnglish('CRANES ACCOUNTS MANAGEMENT', 46, 150, 17, 'bold', navy, 'left');

      drawText('كشف حساب المصاريف الشهري', 1162, 76, 46, 'bold', '#ffffff');
      drawEnglish('MONTHLY EXPENSES STATEMENT', 1162, 130, 19, 'normal', '#cbd5e1', 'right');
      drawText('دقة في الحساب .. وضوح في الإدارة .. نجاح في العمل', 1162, 180, 21, 'normal', '#e2e8f0');

      roundRect(946, 205, 216, 48, 12, '#0f2a43', '#f4b62c66');
      drawText(`${monthNames[month]} ${year}`, 1142, 229, 23, 'bold', gold);

      // Meta
      drawText('خميس مشيط - أبها ومنطقة عسير', 78, 316, 20, 'bold', text, 'left');
      drawText(`تاريخ الإصدار: ${new Date().toLocaleDateString('en-CA')}`, 1162, 316, 19, 'bold', text);
      drawText(`وقت الإصدار: ${new Date().toLocaleTimeString('ar-SA', {hour:'2-digit',minute:'2-digit'})}`, 1162, 350, 18, 'normal', muted);

      // Summary cards
      const cardGap = 18;
      const cardW = (1130 - cardGap * 3) / 4;
      const cardsY = 390;
      drawSummaryCard(55, cardsY, cardW, 'إجمالي المصاريف', totals.total, navy2, '#eef5fb');
      drawSummaryCard(55 + (cardW + cardGap), cardsY, cardW, 'مصاريف الكرينات', totals.equipment, gold, softGold);
      drawSummaryCard(55 + (cardW + cardGap) * 2, cardsY, cardW, 'مصاريف السائقين', totals.drivers, green, '#e9fbf4');
      drawSummaryCard(55 + (cardW + cardGap) * 3, cardsY, cardW, 'مصاريف عامة', totals.general, purple, '#f4efff');

      // Table title
      drawText('تفاصيل المصاريف', 1162, 548, 24, 'bold', text);
      drawText(`عدد العمليات: ${totals.count}`, 1162, 580, 17, 'normal', muted);

      const tableX = 55;
      const tableY = 610;
      const tableW = 1130;
      const headerH = 56;
      const rowH = 46;
      const cols = [
        { key: 'no', label: '#', w: 60 },
        { key: 'date', label: 'التاريخ', w: 150 },
        { key: 'category', label: 'نوع المصروف', w: 190 },
        { key: 'linked', label: 'الكرين / السائق', w: 230 },
        { key: 'amount', label: 'المبلغ (ر.س)', w: 150 },
        { key: 'payment', label: 'طريقة الدفع', w: 140 },
        { key: 'notes', label: 'الملاحظات', w: 210 },
      ];

      // RTL columns
      const colXs: number[] = [];
      let cursor = tableX + tableW;
      cols.forEach((col) => {
        cursor -= col.w;
        colXs.push(cursor);
      });

      roundRect(tableX, tableY, tableW, headerH, 14, navy, navy);
      cols.forEach((col, i) => {
        drawText(col.label, colXs[i] + col.w - 12, tableY + headerH / 2, 17, 'bold', '#ffffff');
      });

      const rows = dataRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

      if (rows.length === 0) {
        roundRect(tableX, tableY + headerH + 4, tableW, rowH * 4, 12, '#ffffff', border);
        drawText('لا توجد مصاريف مسجلة لهذا الشهر', tableX + tableW / 2, tableY + headerH + rowH * 2, 23, 'bold', muted, 'center');
      } else {
        rows.forEach((item, index) => {
          const y = tableY + headerH + index * rowH;
          ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#f8fafc';
          ctx.fillRect(tableX, y, tableW, rowH);
          ctx.strokeStyle = border;
          ctx.lineWidth = 1;
          ctx.strokeRect(tableX, y, tableW, rowH);

          const values = [
            String(page * rowsPerPage + index + 1),
            item.date,
            item.category || '—',
            linkedLabel(item),
            safeNumber(item.amount).toLocaleString('en-US'),
            item.paymentMethod || '—',
            item.notes || '—',
          ];

          values.forEach((value, i) => {
            if (i === 4) {
              drawEnglish(value, colXs[i] + cols[i].w - 12, y + rowH / 2, 17, 'bold', text, 'right');
            } else {
              fitArabic(String(value).slice(0, i === 6 ? 28 : 24), colXs[i] + cols[i].w - 12, y + rowH / 2, cols[i].w - 24, 16, text);
            }
          });
        });
      }

      // Only first page gets dashboard widgets
      if (page === 0) {
        const bottomY = 610 + headerH + Math.min(rowsPerPage, Math.max(rows.length, 10)) * rowH + 26;

        // Distribution card
        roundRect(55, bottomY, 530, 220, 18, '#fbfcfe', border);
        drawText('توزيع المصاريف', 555, bottomY + 34, 23, 'bold', text);

        const total = Math.max(totals.total, 1);
        const eqPct = totals.equipment / total;
        const drPct = totals.drivers / total;
        const gePct = totals.general / total;

        const cx = 160;
        const cy = bottomY + 126;
        const r = 70;
        ctx.lineWidth = 26;
        let angle = -Math.PI / 2;

        const drawArc = (pct: number, color: string) => {
          if (pct <= 0) return;
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.arc(cx, cy, r, angle, angle + pct * Math.PI * 2);
          ctx.stroke();
          angle += pct * Math.PI * 2;
        };

        drawArc(eqPct, gold);
        drawArc(drPct, green);
        drawArc(gePct, purple);

        drawEnglish(totals.total.toLocaleString('en-US'), cx, cy - 2, 30, 'bold', text, 'center');
        drawText('ر.س', cx, cy + 28, 16, 'bold', muted, 'center');

        drawText(`مصاريف الكرينات  ${totals.equipment.toLocaleString('en-US')} ر.س`, 545, bottomY + 86, 18, 'bold', text);
        drawText(`مصاريف السائقين  ${totals.drivers.toLocaleString('en-US')} ر.س`, 545, bottomY + 126, 18, 'bold', text);
        drawText(`مصاريف عامة  ${totals.general.toLocaleString('en-US')} ر.س`, 545, bottomY + 166, 18, 'bold', text);

        // Daily bars
        roundRect(610, bottomY, 575, 220, 18, '#fbfcfe', border);
        drawText('المصاريف اليومية', 1150, bottomY + 34, 23, 'bold', text);

        const dailyMap = new Map<number, number>();
        monthExpenses.forEach((item) => {
          const day = getDateParts(item.date)?.day || 0;
          dailyMap.set(day, (dailyMap.get(day) || 0) + safeNumber(item.amount));
        });

        const dailyEntries = Array.from(dailyMap.entries()).sort((a,b)=>a[0]-b[0]).slice(0, 10);
        const maxDaily = Math.max(...dailyEntries.map(([,v])=>v), 1);
        const chartX = 650;
        const chartY = bottomY + 72;
        const chartW = 500;
        const chartH = 112;
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(chartX, chartY + chartH);
        ctx.lineTo(chartX + chartW, chartY + chartH);
        ctx.stroke();

        const gap = 10;
        const barW = dailyEntries.length ? (chartW - gap * (dailyEntries.length - 1)) / dailyEntries.length : 30;
        dailyEntries.forEach(([day, value], i) => {
          const h = (value / maxDaily) * 88;
          const x = chartX + i * (barW + gap);
          ctx.fillStyle = gold;
          roundRect(x, chartY + chartH - h, barW, h, 5, gold);
          drawEnglish(String(day).padStart(2,'0'), x + barW / 2, chartY + chartH + 19, 14, 'bold', muted, 'center');
        });

        // Notes / approval
        const infoY = bottomY + 244;
        roundRect(55, infoY, 730, 150, 18, '#fbfcfe', border);
        drawText('ملاحظات', 755, infoY + 34, 23, 'bold', text);
        drawText('• هذا الكشف تم إنشاؤه تلقائيًا من نظام BAKR PRO.', 755, infoY + 72, 17, 'normal', text);
        drawText('• يشمل جميع المصاريف المسجلة خلال الشهر المحدد.', 755, infoY + 103, 17, 'normal', text);
        drawText('• يمكن اعتماد الكشف ومشاركته مع الجهات المعنية.', 755, infoY + 132, 17, 'normal', text);

        roundRect(810, infoY, 375, 150, 18, '#fbfcfe', border);
        drawText('اعتماد الإدارة', 1150, infoY + 34, 23, 'bold', text);
        drawText('مدير النظام', 1150, infoY + 74, 18, 'normal', muted);
        drawEnglish('BAKR PRO', 990, infoY + 116, 28, 'bold', navy2, 'center');
      } else {
        // continuation note
        roundRect(55, 1490, 1130, 54, 14, '#f8fafc', border);
        drawText('تابع كشف حساب المصاريف الشهري', 1160, 1517, 18, 'bold', muted);
      }

      drawFooter(page + 1, pageCount);

      const imageData = canvas.toDataURL('image/jpeg', 0.92);
      doc.addImage(imageData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    }

    return doc;
  }

  function pdfFileName() {
    return `BAKR-PRO-Expenses-${year}-${String(month+1).padStart(2,'0')}.pdf`;
  }

  function downloadBlob(blob:Blob, fileName:string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  async function exportPdf() {
    try {
      const doc = makePdf();
      const blob = doc.output('blob');
      const base64 = await blobToBase64(blob);
      const fileName = pdfFileName();

      try {
        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Documents,
          recursive: true,
        });
        alert(`تم حفظ PDF بنجاح\n${fileName}`);
      } catch (nativeError) {
        console.warn('Native PDF save fallback:', nativeError);
        downloadBlob(blob, fileName);
      }
    } catch (error) {
      console.error('PDF export error:', error);
      alert('تعذر حفظ ملف PDF');
    }
  }

  async function sharePdf() {
    try {
      const doc = makePdf();
      const blob = doc.output('blob');
      const base64 = await blobToBase64(blob);
      const fileName = pdfFileName();

      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
        recursive: true,
      });

      await Share.share({
        title: 'كشف حساب المصاريف',
        text: `كشف مصاريف ${monthNames[month]} ${year} - الإجمالي ${money(totals.total)}`,
        url: result.uri,
        dialogTitle: 'مشاركة كشف المصاريف',
      });
    } catch (error: any) {
      if (error?.message?.toLowerCase?.().includes('cancel')) return;
      console.error('PDF share error:', error);
      alert('تعذرت مشاركة ملف PDF');
    }
  }

  return (
    <AppLayout>
      <div dir="rtl" className="w-full pb-8">
        <section className="rounded-[24px] p-4 mb-4" style={{
          background:'linear-gradient(145deg,rgba(14,31,53,.98),rgba(6,16,29,.98))',
          border:'1px solid rgba(245,158,11,.24)'
        }}>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-[18px] bg-amber-500/10 flex items-center justify-center">
              <Wallet className="w-7 h-7 text-amber-400"/>
            </div>
            <div>
              <h1 className="text-[21px] font-black text-white">حساب المصاريف</h1>
              <p className="text-[10px] text-slate-400 mt-1">
                جدول شهري وربط تلقائي بالكرينات والسائقين
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center gap-2 mb-4">
          <button onClick={previousMonth} className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <ChevronRight className="w-5 h-5 text-slate-300"/>
          </button>
          <div className="flex-1 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <span className="font-black text-white text-sm">{monthNames[month]} {year}</span>
          </div>
          <button onClick={nextMonth} className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <ChevronLeft className="w-5 h-5 text-slate-300"/>
          </button>
        </section>

        <section className="grid grid-cols-2 gap-2.5 mb-4">
          <SummaryCard label="إجمالي المصاريف" value={money(totals.total)} icon={Wallet} accent="#f59e0b"/>
          <SummaryCard label="مصاريف الكرينات" value={money(totals.equipment)} icon={Truck} accent="#22c55e"/>
          <SummaryCard label="مصاريف السائقين" value={money(totals.drivers)} icon={UserRound} accent="#60a5fa"/>
          <SummaryCard label="مصاريف عامة" value={money(totals.general)} icon={Receipt} accent="#c084fc"/>
        </section>

        <section className="rounded-[24px] p-4 mb-5" style={{
          background:'linear-gradient(145deg,rgba(14,29,49,.96),rgba(7,17,31,.98))',
          border:editingId ? '1px solid rgba(96,165,250,.32)' : '1px solid rgba(255,255,255,.07)'
        }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                {editingId ? <Pencil className="w-4 h-4 text-blue-400"/> : <Plus className="w-5 h-5 text-amber-400"/>}
              </div>
              <div>
                <h2 className="text-[15px] font-black text-white">{editingId ? 'تعديل المصروف' : 'إضافة مصروف جديد'}</h2>
                <p className="text-[9px] text-slate-500">يحفظ مرة واحدة ويظهر في الحساب المرتبط</p>
              </div>
            </div>
            {editingId && <button onClick={resetForm} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><X className="w-4 h-4 text-slate-400"/></button>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="التاريخ">
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="expense-input"/>
            </Field>
            <Field label="نوع المصروف">
              <select value={category} onChange={e=>setCategory(e.target.value)} className="expense-input">
                {categories.map(x=><option key={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="المبلغ (ريال)">
              <input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="مثال: 650" className="expense-input"/>
            </Field>
            <Field label="طريقة الدفع">
              <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value as PaymentMethod)} className="expense-input">
                <option>كاش</option><option>تحويل</option><option>بطاقة</option>
              </select>
            </Field>
          </div>

          <p className="text-[10px] font-bold text-slate-400 mt-4 mb-2">مرتبط بـ</p>
          <div className="grid grid-cols-3 gap-2">
            <RelationButton active={relationType==='general'} label="مصروف عام" icon={Building2} onClick={()=>{setRelationType('general');setEquipmentId('');setDriverId('')}}/>
            <RelationButton active={relationType==='equipment'} label="كرين / معدة" icon={Truck} onClick={()=>{setRelationType('equipment');setDriverId('')}}/>
            <RelationButton active={relationType==='driver'} label="سائق" icon={UserRound} onClick={()=>{setRelationType('driver');setEquipmentId('')}}/>
          </div>

          {relationType==='equipment' && <div className="mt-3">
            <Field label="اختر الكرين / المعدة">
              <select value={equipmentId} onChange={e=>setEquipmentId(e.target.value)} className="expense-input">
                <option value="">اختر المعدة</option>
                {equipmentList.map(x=><option key={String(x.id)} value={String(x.id)}>{x.name}</option>)}
              </select>
            </Field>
            <p className="text-[9px] text-green-400 mt-1.5">✓ سيظهر تلقائيًا في الحساب الشهري للمعدة.</p>
          </div>}

          {relationType==='driver' && <div className="mt-3">
            <Field label="اختر السائق / المشغل">
              <select value={driverId} onChange={e=>setDriverId(e.target.value)} className="expense-input">
                <option value="">اختر السائق</option>
                {drivers.map(x=><option key={String(x.id)} value={String(x.id)}>{x.name}</option>)}
              </select>
            </Field>
            <p className="text-[9px] text-blue-400 mt-1.5">✓ سيظهر تلقائيًا في حساب السائق.</p>
          </div>}

          <div className="mt-3">
            <Field label="الموقع / الجهة (اختياري)">
              <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="مثال: أبها - ورشة - محطة" className="expense-input"/>
            </Field>
          </div>
          <div className="mt-3">
            <Field label="الملاحظات">
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="مثال: تعبئة ديزل لكرين 50 طن أثناء العمل في أبها" className="expense-input resize-none"/>
            </Field>
          </div>

          <div className="mt-3">
            <p className="text-[10px] font-bold text-slate-400 mb-2">صورة الفاتورة / الإيصال (اختياري)</p>
            <input ref={receiptRef} type="file" accept="image/*" className="hidden" onChange={handleReceipt}/>
            <button onClick={()=>receiptRef.current?.click()} className="w-full min-h-[64px] rounded-[16px] border border-dashed border-white/15 bg-white/[.025] flex items-center justify-center gap-2 text-[11px] text-slate-300">
              <ImageIcon className="w-5 h-5 text-amber-400"/>
              {receiptImage ? 'تغيير صورة الإيصال' : 'إضافة صورة إيصال'}
            </button>
            {receiptImage && <div className="relative mt-2 overflow-hidden rounded-[16px] border border-white/10">
              <img src={receiptImage} alt="الإيصال" className="w-full max-h-52 object-contain bg-black/20"/>
              <button onClick={()=>setReceiptImage('')} className="absolute top-2 left-2 w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center"><X className="w-4 h-4"/></button>
            </div>}
          </div>

          <button onClick={saveExpense} className="w-full mt-4 h-[52px] rounded-[16px] bg-gradient-to-l from-amber-400 to-orange-500 text-slate-950 font-black text-[13px] flex items-center justify-center gap-2 active:scale-[.98]">
            <Save className="w-5 h-5"/>{editingId ? 'حفظ التعديل' : 'حفظ المصروف'}
          </button>
        </section>

        <section>
          <div className="flex items-end justify-between mb-3 gap-3">
            <div>
              <h2 className="text-[16px] font-black text-white">جدول المصاريف لشهر {monthNames[month]}</h2>
              <p className="text-[9px] text-slate-500 mt-1">الشهر كامل • {new Date(year, month + 1, 0).getDate()} يوم • {totals.count} عملية مسجلة</p>
            </div>
            <div className="relative flex-1 max-w-[180px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="بحث..." className="w-full h-10 rounded-xl bg-white/5 border border-white/10 pr-9 pl-3 text-[10px] text-white outline-none"/>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[22px]" style={{border:'1px solid rgba(255,255,255,.07)',background:'rgba(7,17,31,.88)'}}>
            <table className="w-full min-w-[940px] text-right">
              <thead><tr className="bg-white/[.045] text-[10px] text-slate-300">
                <th className="p-3">#</th><th className="p-3">التاريخ</th><th className="p-3">نوع المصروف</th>
                <th className="p-3">المبلغ</th><th className="p-3">مرتبط بـ</th><th className="p-3">طريقة الدفع</th>
                <th className="p-3">الملاحظات</th><th className="p-3">الإيصال</th><th className="p-3">الإجراءات</th>
              </tr></thead>
              <tbody>
                {monthlyRows.map((row,index)=>{
                  const item = row.item;
                  const Icon = item ? categoryIcon(item.category) : Receipt;
                  return <tr key={item ? `expense-${item.id}` : `day-${row.day}`} className="border-t border-white/5 text-[10px] text-slate-300">
                    <td className="p-3 font-black text-slate-400">{row.day}</td>
                    <td className="p-3 whitespace-nowrap">{`${year}-${String(month+1).padStart(2,'0')}-${String(row.day).padStart(2,'0')}`}</td>
                    <td className="p-3">{item ? <div className="flex items-center gap-2"><Icon className="w-4 h-4 text-amber-400"/><span className="font-bold text-white">{item.category}</span></div> : <span className="text-slate-600">—</span>}</td>
                    <td className="p-3 font-black text-amber-300 whitespace-nowrap">{item ? money(item.amount) : '—'}</td>
                    <td className="p-3 whitespace-nowrap">{item ? linkedLabel(item) : '—'}</td>
                    <td className="p-3">{item?.paymentMethod || '—'}</td>
                    <td className="p-3 max-w-[220px]">{item?.notes || '—'}</td>
                    <td className="p-3">{item?.receiptImage ? <button onClick={()=>window.open(item.receiptImage,'_blank')} className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20">عرض</button> : '—'}</td>
                    <td className="p-3">{item ? <div className="flex items-center gap-1.5">
                      <button onClick={()=>editExpense(item)} className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center"><Pencil className="w-4 h-4 text-blue-300"/></button>
                      <button onClick={()=>removeExpense(item.id)} className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center"><Trash2 className="w-4 h-4 text-red-300"/></button>
                    </div> : <span className="text-slate-700">—</span>}</td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[22px] p-4 mt-4" style={{
          background:'linear-gradient(145deg,rgba(14,31,53,.95),rgba(7,17,31,.98))',
          border:'1px solid rgba(245,158,11,.18)'
        }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] text-slate-500">إجمالي المصاريف لشهر {monthNames[month]} {year}</p>
              <p className="text-[23px] font-black text-amber-400 mt-1">{money(totals.total)}</p>
            </div>
            <Banknote className="w-9 h-9 text-amber-400/70"/>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={sharePdf} className="h-12 rounded-[14px] bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-bold text-[11px] flex items-center justify-center gap-2"><Share2 className="w-4 h-4"/>مشاركة</button>
            <button onClick={exportPdf} className="h-12 rounded-[14px] bg-red-500/10 border border-red-500/25 text-red-300 font-bold text-[11px] flex items-center justify-center gap-2"><FileDown className="w-4 h-4"/>تصدير PDF</button>
          </div>
        </section>

        <style>{`
          .expense-input{width:100%;min-height:46px;border-radius:13px;padding:10px 12px;background:rgba(3,12,23,.72);border:1px solid rgba(255,255,255,.09);color:#f8fafc;font-size:12px;outline:none}
          .expense-input:focus{border-color:rgba(245,158,11,.42)}
          .expense-input option{background:#0b1728;color:white}
        `}</style>
      </div>
    </AppLayout>
  );
}

function Field({label,children}:{label:string;children:React.ReactNode}) {
  return <label className="block"><span className="block text-[10px] font-bold text-slate-400 mb-1.5">{label}</span>{children}</label>;
}

function RelationButton({active,label,icon:Icon,onClick}:{active:boolean;label:string;icon:any;onClick:()=>void}) {
  return <button type="button" onClick={onClick} className="min-h-[64px] rounded-[14px] flex flex-col items-center justify-center gap-1.5 text-[9px] font-bold" style={{
    background:active?'rgba(245,158,11,.13)':'rgba(255,255,255,.025)',
    border:active?'1px solid rgba(245,158,11,.38)':'1px solid rgba(255,255,255,.07)',
    color:active?'#fbbf24':'#94a3b8'
  }}><Icon className="w-5 h-5"/>{label}</button>;
}

function SummaryCard({label,value,icon:Icon,accent}:{label:string;value:string;icon:any;accent:string}) {
  return <div className="min-h-[92px] rounded-[18px] p-3" style={{
    background:'linear-gradient(145deg,rgba(14,29,49,.94),rgba(7,17,31,.98))',
    border:`1px solid ${accent}33`
  }}>
    <div className="flex items-start justify-between gap-2">
      <div><p className="text-[9px] text-slate-500">{label}</p><p className="text-[14px] font-black mt-3" style={{color:accent}}>{value}</p></div>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:`${accent}16`}}><Icon className="w-4 h-4" style={{color:accent}}/></div>
    </div>
  </div>;
        }
