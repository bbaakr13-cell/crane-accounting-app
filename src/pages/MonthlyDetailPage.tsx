import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useParams } from 'react-router-dom';

import {
  Download,
  Share2,
  MessageCircle,
} from 'lucide-react';

import jsPDF from 'jspdf';

import {
  Filesystem,
  Directory,
} from '@capacitor/filesystem';

import { Share } from '@capacitor/share';

import { AppLayout } from '@/components/layout/AppLayout';

import {
  fetchEquipment,
  type Equipment,
} from '@/lib/equipment';

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

const EXPENSE_STORAGE_KEY =
  'crane_accounting_driver_equipment_expenses_v1';

const HACEN_FONT_NAME = 'HacenEgypt';
const HACEN_FONT_URL = '/hacen-egypt.ttf';

const PDF_WIDTH = 794;
const PDF_HEIGHT = 1123;

// دقة عالية جداً للحفظ والطباعة
const PDF_SCALE = 4;

const monthNames = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

function normalizeArabicNumbers(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) =>
      String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))
    )
    .replace(/[۰-۹]/g, (digit) =>
      String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))
    )
    .replace(/٬/g, '')
    .replace(/,/g, '');
}

function formatEquipmentName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/كرين\s*(\d+)/g, 'كرين $1')
    .replace(/(\d+)\s*طن/g, '$1 طن')
    .replace(/طن([^\s])/g, 'طن $1')
    .trim();
}

function getDateParts(dateValue: string) {
  const parts = String(dateValue || '').split('-');

  if (parts.length < 3) return null;

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }

  return { year, month, day };
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
  family: string,
  weight = 400
) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px "${family}"`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  return size;
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
    let cancelled = false;
    async function loadEquipment() {
      setEquipmentLoading(true);
      try {
        const list = await fetchEquipment();
        if (cancelled) return;
        setEquipmentList(list);
        if (id && list.some((item) => String(item.id) === String(id))) {
          setEquipmentId(String(id));
        } else if (list.length > 0) {
          setEquipmentId(String(list[0].id));
        } else {
          setEquipmentId('');
        }
      } catch (error) {
        console.error('تعذر تحميل المعدات:', error);
        if (!cancelled) {
          setEquipmentList([]);
          setEquipmentId('');
        }
      } finally {
        if (!cancelled) setEquipmentLoading(false);
      }
    }
    loadEquipment();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const selectedEquipment = useMemo(() => {
    return equipmentList.find((item) => String(item.id) === String(equipmentId)) || null;
  }, [equipmentList, equipmentId]);

  const equipmentName = selectedEquipment?.name || 'لا توجد معدة محددة';
  const displayEquipmentName = formatEquipmentName(equipmentName);

  const daysInMonth = useMemo(() => {
    return new Date(year, month + 1, 0).getDate();
  }, [year, month]);

  const storageKey = equipmentId
    ? `monthly-ledger-v3-${equipmentId}-${year}-${month}`
    : `monthly-ledger-v3-no-equipment-${year}-${month}`;

  function createEmptyRows(): DayRow[] {
    return Array.from({ length: daysInMonth }, (_, index) => ({
      day: index + 1,
      workType: '',
      tripType: '',
      tripPrice: 0,
      expenseType: '',
      expenseAmount: 0,
      notes: '',
    }));
  }

  const [rows, setRows] = useState<DayRow[]>(createEmptyRows());

  useEffect(() => {
    setRowsLoaded(false);
    if (!equipmentId) {
      setRows(createEmptyRows());
      setRowsLoaded(true);
      return;
    }
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) {
        setRows(createEmptyRows());
        setRowsLoaded(true);
        return;
      }
      const parsed = JSON.parse(saved) as DayRow[];
      const prepared = createEmptyRows().map((row) => {
        const found = parsed.find((item) => item.day === row.day);
        return found ? { ...row, ...found } : row;
      });
      setRows(prepared);
    } catch (error) {
      console.error('تعذر قراءة الحساب الشهري:', error);
      setRows(createEmptyRows());
    } finally {
      setRowsLoaded(true);
    }
  }, [equipmentId, year, month, daysInMonth, storageKey]);

  useEffect(() => {
    if (!equipmentId || !rowsLoaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(rows));
    } catch (error) {
      console.error('تعذر حفظ الحساب الشهري:', error);
    }
  }, [rows, storageKey, equipmentId, rowsLoaded]);

  function loadExternalExpenses() {
    try {
      const raw = localStorage.getItem(EXPENSE_STORAGE_KEY);
      if (!raw) {
        setExternalExpenses([]);
        return;
      }
      const parsed = JSON.parse(raw);
      setExternalExpenses(Array.isArray(parsed) ? parsed as ExternalExpenseRecord[] : []);
    } catch (error) {
      console.error('تعذر تحميل مصاريف السواقين والمعدات:', error);
      setExternalExpenses([]);
    }
  }

  useEffect(() => {
    loadExternalExpenses();
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === EXPENSE_STORAGE_KEY) loadExternalExpenses();
    };
    const handleFocus = () => loadExternalExpenses();
    const handleUpdated = () => loadExternalExpenses();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('driver-equipment-expenses-updated', handleUpdated);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('driver-equipment-expenses-updated', handleUpdated);
    };
  }, []);

  const monthlyExternalExpenses = useMemo(() => {
    if (!equipmentId) return [];
    return externalExpenses.filter((expense) => {
      if (String(expense.equipmentId || '') !== String(equipmentId)) return false;
      const date = getDateParts(expense.date);
      return !!date && date.year === year && date.month === month + 1;
    });
  }, [externalExpenses, equipmentId, year, month]);

  const externalExpensesByDay = useMemo(() => {
    const map = new Map<number, ExternalExpenseRecord[]>();
    monthlyExternalExpenses.forEach((expense) => {
      const date = getDateParts(expense.date);
      if (!date) return;
      const current = map.get(date.day) || [];
      current.push(expense);
      map.set(date.day, current);
    });
    return map;
  }, [monthlyExternalExpenses]);

  function getDayExternalExpenses(day: number) {
    return externalExpensesByDay.get(day) || [];
  }

  function getDayExternalTotal(day: number) {
    return getDayExternalExpenses(day).reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  }

  function getDayExternalCategories(day: number) {
    const records = getDayExternalExpenses(day);
    return Array.from(new Set(records.map((expense) => expense.category).filter(Boolean))).join(' + ');
  }

  function getDayExternalNotes(day: number) {
    const records = getDayExternalExpenses(day);
    return records.map((expense) => {
      const parts = [
        expense.driverName ? `السائق: ${expense.driverName}` : '',
        expense.location ? `الموقع: ${expense.location}` : '',
        expense.notes || '',
      ].filter(Boolean);
      return parts.join(' - ');
    }).filter(Boolean).join(' | ');
  }

  function updateTextRow(
    day: number,
    field: 'workType' | 'tripType' | 'expenseType' | 'notes',
    value: string
  ) {
    setRows((oldRows) => oldRows.map((row) => row.day === day ? { ...row, [field]: value } : row));
  }

  function updateNumberRow(
    day: number,
    field: 'tripPrice' | 'expenseAmount',
    value: string
  ) {
    const normalized = normalizeArabicNumbers(value);
    const numberValue = normalized.trim() === '' ? 0 : Number(normalized);
    setRows((oldRows) => oldRows.map((row) => row.day === day ? {
      ...row,
      [field]: Number.isFinite(numberValue) ? numberValue : 0,
    } : row));
  }

  const totals = useMemo(() => {
    return rows.reduce((sum, row) => {
      const linkedExpenses = externalExpensesByDay.get(row.day) || [];
      const linkedTotal = linkedExpenses.reduce((expenseSum, expense) => expenseSum + (Number(expense.amount) || 0), 0);
      const hasWork = row.workType.trim() || row.tripType.trim() || row.tripPrice > 0 || row.expenseType.trim() || row.expenseAmount > 0 || row.notes.trim() || linkedExpenses.length > 0;
      if (hasWork) sum.registeredDays += 1;
      if (row.tripType.trim() || row.tripPrice > 0) sum.trips += 1;
      sum.income += Number(row.tripPrice) || 0;
      sum.manualExpense += Number(row.expenseAmount) || 0;
      sum.linkedExpense += linkedTotal;
      return sum;
    }, {
      trips: 0,
      income: 0,
      manualExpense: 0,
      linkedExpense: 0,
      registeredDays: 0,
    });
  }, [rows, externalExpensesByDay]);

  const totalExpense = totals.manualExpense + totals.linkedExpense;
  const net = totals.income - totalExpense;

  const inputStyle: React.CSSProperties = {
    width: '100%', minWidth: 120, padding: '10px 8px', borderRadius: 10,
    border: '1px solid #26364f', background: '#0a1424', color: '#ffffff',
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
    justifyContent: 'center', gap: 6, color: '#ffffff',
  };

  function getFileName() {
    const cleanEquipment = displayEquipmentName.replace(/[\\/:*?"<>|]/g, '-');
    return `BAKR-PRO-${cleanEquipment}-${monthNames[month]}-${year}.pdf`;
  }

  async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = () => reject(new Error('تعذر قراءة ملف PDF'));
      reader.readAsDataURL(blob);
    });
  }

  async function ensureHacenFont() {
    try {
      await document.fonts.load(`400 30px "${HACEN_FONT_NAME}"`);
      if (document.fonts.check(`400 30px "${HACEN_FONT_NAME}"`)) return;
    } catch {}

    const response = await fetch(HACEN_FONT_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('تعذر تحميل خط Hacen Egypt');
    const buffer = await response.arrayBuffer();
    const fontFace = new FontFace(HACEN_FONT_NAME, buffer, { style: 'normal', weight: '400' });
    const loadedFont = await fontFace.load();
    document.fonts.add(loadedFont);
    await document.fonts.load(`400 30px "${HACEN_FONT_NAME}"`);
    await document.fonts.ready;
  }

  function setArabicFont(ctx: CanvasRenderingContext2D, size: number) {
    ctx.font = `400 ${size}px "${HACEN_FONT_NAME}"`;
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
  }

  function setEnglishFont(ctx: CanvasRenderingContext2D, size: number, weight = 900) {
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  }

  function drawArabic(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    size: number,
    color = '#111827'
  ) {
    const value = String(text || '');
    setArabicFont(ctx, size);
    const metrics = ctx.measureText(value);
    const ascent = metrics.actualBoundingBoxAscent || size * 0.75;
    const descent = metrics.actualBoundingBoxDescent || size * 0.25;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color;
    const baselineY = y + (ascent - descent) / 2;
    ctx.fillText(value, x, baselineY);
  }

  function drawEnglish(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    size: number,
    color = '#111827',
    weight = 900
  ) {
    setEnglishFont(ctx, size, weight);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawInfoBox(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: string
  ) {
    roundedRect(ctx, x, y, width, height, 9);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#d7e1eb';
    ctx.lineWidth = 1;
    ctx.stroke();

    drawArabic(ctx, label, x + width / 2, y + 19, 20, '#0b3b82');
    const valueSize = fitFontSize(ctx, value, width - 14, 24, 14, HACEN_FONT_NAME);
    drawArabic(ctx, value, x + width / 2, y + 46, valueSize, '#111827');
  }

  function getPdfRow(day: number): DayRow {
    return rows.find((item) => item.day === day) || {
      day, workType: '', tripType: '', tripPrice: 0,
      expenseType: '', expenseAmount: 0, notes: '',
    };
  }

  function drawMoneyCard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    title: string,
    value: string,
    accent: string,
    bg: string
  ) {
    roundedRect(ctx, x, y, width, 72, 11);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = `${accent}55`;
    ctx.lineWidth = 1;
    ctx.stroke();

    roundedRect(ctx, x + 10, y + 13, 44, 44, 10);
    ctx.fillStyle = `${accent}1f`;
    ctx.fill();

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x + 32, y + 35, 8, 0, Math.PI * 2);
    ctx.fill();

    drawArabic(ctx, title, x + width - 12, y + 23, 17, '#102f61');
    drawArabic(ctx, value, x + width - 12, y + 51, 23, accent);
  }

  async function createPdfCanvas() {
    await ensureHacenFont();

    const canvas = document.createElement('canvas');
    canvas.width = PDF_WIDTH * PDF_SCALE;
    canvas.height = PDF_HEIGHT * PDF_SCALE;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('تعذر إنشاء Canvas');

    ctx.scale(PDF_SCALE, PDF_SCALE);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const NAVY = '#061827';
    const NAVY_2 = '#0b2742';
    const GOLD = '#f4b62c';
    const BLUE = '#0b3b82';
    const GREEN = '#15803d';
    const RED = '#dc2626';
    const BORDER = '#cfe0ef';
    const TEXT = '#0f172a';
    const MUTED = '#64748b';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PDF_WIDTH, PDF_HEIGHT);

    // ===== الهيدر المعتمد بالصورة =====
    const heroH = 160;
    try {
      const headerImage = new Image();
      headerImage.src = '/crane-header.png';
      await new Promise<void>((resolve, reject) => {
        headerImage.onload = () => resolve();
        headerImage.onerror = () => reject(new Error('تعذر تحميل صورة الهيدر'));
      });
      ctx.drawImage(headerImage, 0, 0, PDF_WIDTH, heroH);
    } catch (error) {
      console.warn('تعذر تحميل crane-header.png، تم استخدام خلفية بديلة', error);
      ctx.fillStyle = NAVY;
      ctx.fillRect(0, 0, PDF_WIDTH, heroH);
      drawEnglish(ctx, 'BAKR PRO', PDF_WIDTH / 2, 50, 38, GOLD, 900);
      drawArabic(ctx, 'إدارة حسابات الكرينات', PDF_WIDTH / 2, 92, 25, '#ffffff');
      drawEnglish(ctx, 'CRANE ACCOUNTING MANAGEMENT', PDF_WIDTH / 2, 124, 13, '#dbe7f2', 700);
    }

    // ===== شريط عنوان الحساب الشهري =====
    const titleY = heroH + 4;
    const titleH = 38;
    roundedRect(ctx, 18, titleY, PDF_WIDTH - 36, titleH, 8);
    ctx.fillStyle = NAVY;
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    drawArabic(ctx, 'ملف الحساب الشهري', PDF_WIDTH / 2 + 55, titleY + titleH / 2, 24, '#ffffff');
    drawEnglish(ctx, 'MONTHLY ACCOUNT SUMMARY', 125, titleY + titleH / 2, 12, '#ffffff', 800);

    // ===== معلومات الشهر: بدون تكرار الإجماليات =====
    const infoY = titleY + titleH + 8;
    const infoGap = 8;
    const infoWidth = (PDF_WIDTH - 36 - infoGap * 3) / 4;
    const infoH = 50;

    drawInfoBox(ctx, 18, infoY, infoWidth, infoH, 'المعدة', displayEquipmentName);
    drawInfoBox(ctx, 18 + (infoWidth + infoGap), infoY, infoWidth, infoH, 'الشهر', monthNames[month]);
    drawInfoBox(ctx, 18 + (infoWidth + infoGap) * 2, infoY, infoWidth, infoH, 'السنة', String(year));
    drawInfoBox(ctx, 18 + (infoWidth + infoGap) * 3, infoY, infoWidth, infoH, 'الموقع', 'خميس مشيط - أبها');

    // ===== الجدول الكبير 31 يوم =====
    const tableX = 18;
    const tableY = infoY + infoH + 8;
    const tableWidth = PDF_WIDTH - 36;
    const headerHeight = 28;
    const rowHeight = 18.6;

    const columns = [
      { key: 'day', label: '#', ratio: 0.07 },
      { key: 'date', label: 'التاريخ', ratio: 0.16 },
      { key: 'work', label: 'نوع العمل', ratio: 0.18 },
      { key: 'location', label: 'موقع العمل', ratio: 0.18 },
      { key: 'trip', label: 'سعر المشوار', ratio: 0.15 },
      { key: 'expense', label: 'بيان الصرف', ratio: 0.15 },
      { key: 'amount', label: 'المبلغ', ratio: 0.11 },
    ];

    let cursorX = tableX + tableWidth;
    const columnRects = columns.map((column) => {
      const width = tableWidth * column.ratio;
      cursorX -= width;
      return { ...column, x: cursorX, width };
    });

    columnRects.forEach((column) => {
      ctx.fillStyle = NAVY;
      ctx.fillRect(column.x, tableY, column.width, headerHeight);
      ctx.strokeStyle = '#ffffff44';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(column.x, tableY, column.width, headerHeight);
      const size = fitFontSize(ctx, column.label, column.width - 6, 13, 9, HACEN_FONT_NAME);
      drawArabic(ctx, column.label, column.x + column.width / 2, tableY + headerHeight / 2, size, '#ffffff');
    });

    for (let day = 1; day <= 31; day += 1) {
      const row = getPdfRow(day);
      const rowY = tableY + headerHeight + (day - 1) * rowHeight;
      const linkedTotal = getDayExternalTotal(day);
      const linkedCategories = getDayExternalCategories(day);

      const combinedExpense = (Number(row.expenseAmount) || 0) + linkedTotal;
      const expenseDescription = [row.expenseType, linkedCategories].filter(Boolean).join(' + ');
      const dateText = day <= daysInMonth
        ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        : '';

      const values: Record<string, string> = {
        day: String(day),
        date: dateText,
        work: row.workType,
        location: row.tripType,
        trip: row.tripPrice > 0 ? row.tripPrice.toLocaleString('en-US') : '',
        expense: expenseDescription,
        amount: combinedExpense > 0 ? combinedExpense.toLocaleString('en-US') : '',
      };

      columnRects.forEach((column) => {
        ctx.fillStyle = day % 2 === 0 ? '#edf7ff' : '#ffffff';
        ctx.fillRect(column.x, rowY, column.width, rowHeight);
        ctx.strokeStyle = BORDER;
        ctx.lineWidth = 0.55;
        ctx.strokeRect(column.x, rowY, column.width, rowHeight);

        const text = values[column.key] || '';
        if (!text) {
          drawArabic(ctx, '—', column.x + column.width / 2, rowY + rowHeight / 2, 7.5, '#94a3b8');
          return;
        }

        const size = fitFontSize(ctx, text, column.width - 6, 9.5, 6.2, HACEN_FONT_NAME);
        drawArabic(
          ctx,
          text,
          column.x + column.width / 2,
          rowY + rowHeight / 2,
          size,
          column.key === 'amount' && combinedExpense > 0 ? RED : TEXT
        );
      });
    }

    // ===== الملخص السفلي فقط =====
    const summaryY = tableY + headerHeight + 31 * rowHeight + 10;
    const sumGap = 9;
    const sumWidth = (PDF_WIDTH - 36 - sumGap * 3) / 4;
    const summaryItems = [
      { label: 'إجمالي الدخل', value: `${totals.income.toLocaleString('en-US')} ر.س`, color: GREEN, bg: '#effcf5' },
      { label: 'إجمالي المصروفات', value: `${totalExpense.toLocaleString('en-US')} ر.س`, color: RED, bg: '#fff4f4' },
      { label: 'صافي الشهر', value: `${net.toLocaleString('en-US')} ر.س`, color: net >= 0 ? BLUE : RED, bg: '#eef6ff' },
      { label: 'عدد المشاوير', value: String(totals.trips), color: NAVY_2, bg: '#fff9e9' },
    ];

    summaryItems.forEach((item, index) => {
      const x = 18 + index * (sumWidth + sumGap);
      roundedRect(ctx, x, summaryY, sumWidth, 58, 8);
      ctx.fillStyle = item.bg;
      ctx.fill();
      ctx.strokeStyle = `${item.color}55`;
      ctx.lineWidth = 1;
      ctx.stroke();
      drawArabic(ctx, item.label, x + sumWidth / 2, summaryY + 20, 12.5, TEXT);
      drawArabic(ctx, item.value, x + sumWidth / 2, summaryY + 42, 15, item.color);
    });

    // ===== فوتر نحيف كما في النموذج المعتمد =====
    const footerY = summaryY + 68;
    ctx.fillStyle = NAVY;
    ctx.fillRect(0, footerY, PDF_WIDTH, PDF_HEIGHT - footerY);

    // خطوط ذهبية أعلى وأسفل
    ctx.fillStyle = GOLD;
    ctx.fillRect(0, footerY, PDF_WIDTH, 2);
    ctx.fillRect(0, PDF_HEIGHT - 8, PDF_WIDTH, 8);

    // يمين: هوية التطبيق
    drawEnglish(ctx, 'BAKR PRO', 88, footerY + 28, 21, '#ffffff', 900);
    drawArabic(ctx, 'إدارة حسابات الكرينات', 88, footerY + 52, 11, '#ffffff');
    drawEnglish(ctx, 'CRANE ACCOUNTING MANAGEMENT', 88, footerY + 70, 7.5, '#dbe7f2', 700);

    // الوسط: التواصل
    drawArabic(ctx, 'للتواصل معنا', PDF_WIDTH / 2, footerY + 20, 11, '#ffffff');
    drawEnglish(ctx, '0558995962', PDF_WIDTH / 2, footerY + 47, 22, GOLD, 900);
    drawArabic(ctx, 'خميس مشيط - أبها وجميع مناطق عسير', PDF_WIDTH / 2, footerY + 70, 9, '#ffffff');

    // يسار: حقوق التصميم
    drawArabic(ctx, 'حقوق التصميم', PDF_WIDTH - 96, footerY + 22, 10, '#ffffff');
    drawEnglish(ctx, 'BAKR_ALMASBHI', PDF_WIDTH - 96, footerY + 49, 14, GOLD, 900);
    drawArabic(ctx, 'تصميم احترافي', PDF_WIDTH - 96, footerY + 70, 8.5, '#dbe7f2');

    return canvas;
  }

  async function createPdfBlob() {
    const canvas = await createPdfCanvas();

    // PNG للحفاظ على حدة النصوص والجداول
    const imageData = canvas.toDataURL('image/png');

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: false,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // بدون ضغط سريع حتى تبقى الجودة عالية جداً
    pdf.addImage(
      imageData,
      'PNG',
      0,
      0,
      pageWidth,
      pageHeight,
      undefined,
      'NONE'
    );

    return pdf.output('blob');
  }

  async function createPdfFile() {
    const blob = await createPdfBlob();
    const base64 = await blobToBase64(blob);
    const result = await Filesystem.writeFile({
      path: getFileName(),
      data: base64,
      directory: Directory.Cache,
    });
    return result.uri;
  }

  async function handleSavePdf() {
    if (!equipmentId) {
      alert('اختر المعدة أولاً');
      return;
    }
    try {
      setCreatingPdf(true);
      const fileUri = await createPdfFile();
      await Share.share({
        title: 'حفظ الحساب الشهري',
        text: `${displayEquipmentName} - ${monthNames[month]} ${year}`,
        url: fileUri,
        dialogTitle: 'حفظ أو مشاركة كشف الحساب',
      });
    } catch (error) {
      console.error('PDF ERROR:', error);
      alert('تعذر إنشاء ملف PDF');
    } finally {
      setCreatingPdf(false);
    }
  }

  async function handleShare() {
    if (!equipmentId) {
      alert('اختر المعدة أولاً');
      return;
    }
    try {
      setCreatingPdf(true);
      const fileUri = await createPdfFile();
      await Share.share({
        title: 'الحساب الشهري',
        text:
          `المعدة: ${displayEquipmentName}\n` +
          `الشهر: ${monthNames[month]} ${year}\n` +
          `إجمالي الدخل: ${totals.income.toLocaleString('en-US')} ر.س\n` +
          `إجمالي المصروفات: ${totalExpense.toLocaleString('en-US')} ر.س\n` +
          `مصاريف السواقين والمعدات: ${totals.linkedExpense.toLocaleString('en-US')} ر.س\n` +
          `صافي الشهر: ${net.toLocaleString('en-US')} ر.س`,
        url: fileUri,
        dialogTitle: 'مشاركة كشف الحساب',
      });
    } catch (error) {
      console.error('SHARE ERROR:', error);
      alert('تعذر مشاركة كشف الحساب');
    } finally {
      setCreatingPdf(false);
    }
  }

  function handleWhatsApp() {
    if (!equipmentId) {
      alert('اختر المعدة أولاً');
      return;
    }

    const text =
      `📊 BAKR PRO\n` +
      `الحساب الشهري\n\n` +
      `🏗️ المعدة: ${displayEquipmentName}\n` +
      `📅 الشهر: ${monthNames[month]} ${year}\n\n` +
      `🚚 عدد المشاوير: ${totals.trips}\n` +
      `💰 إجمالي الدخل: ${totals.income.toLocaleString('en-US')} ر.س\n` +
      `💸 إجمالي المصروفات: ${totalExpense.toLocaleString('en-US')} ر.س\n` +
      `👷 مصاريف السواقين والمعدات: ${totals.linkedExpense.toLocaleString('en-US')} ر.س\n` +
      `✅ صافي الشهر: ${net.toLocaleString('en-US')} ر.س\n` +
      `📝 أيام مسجلة: ${totals.registeredDays}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  return (
    <AppLayout>
      <style>
        {`
          @font-face {
            font-family: '${HACEN_FONT_NAME}';
            src: url('${HACEN_FONT_URL}') format('truetype');
            font-style: normal;
            font-weight: 400;
            font-display: block;
          }
        `}
      </style>

      <div
        dir="rtl"
        style={{
          padding: 18,
          paddingBottom: 110,
          maxWidth: 1100,
          margin: 'auto',
          color: '#ffffff',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 27, fontWeight: 800 }}>
          الحساب الشهري
        </h1>

        <p style={{ color: '#94a3b8', marginTop: 7 }}>
          سجل أعمال ومشاوير ومصاريف {displayEquipmentName}
        </p>

        <div
          style={{
            background: '#0b1527',
            border: '1px solid #1d2d47',
            borderRadius: 18,
            padding: 14,
            marginBottom: 18,
            display: 'grid',
            gap: 10,
          }}
        >
          <label>
            <small style={{ color: '#94a3b8' }}>المعدة</small>
            <select
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              style={selectStyle}
              disabled={equipmentLoading || equipmentList.length === 0}
            >
              {equipmentLoading ? (
                <option value="">جاري تحميل المعدات...</option>
              ) : equipmentList.length === 0 ? (
                <option value="">لا توجد معدات</option>
              ) : (
                equipmentList.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {formatEquipmentName(item.name)}
                  </option>
                ))
              )}
            </select>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={selectStyle}>
              {monthNames.map((name, index) => (
                <option key={name} value={index}>{name}</option>
              ))}
            </select>

            <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={selectStyle}>
              {Array.from({ length: 7 }, (_, index) => {
                const y = now.getFullYear() - 2 + index;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 18 }}>
          <div style={summaryCard}>إجمالي المشاوير<h2>{totals.trips}</h2></div>
          <div style={summaryCard}>إجمالي الدخل<h2 style={{ color: '#22c55e' }}>{totals.income.toLocaleString('en-US')} ر.س</h2></div>
          <div style={summaryCard}>إجمالي المصروفات<h2 style={{ color: '#ef4444' }}>{totalExpense.toLocaleString('en-US')} ر.س</h2></div>
          <div style={summaryCard}>صافي الشهر<h2 style={{ color: net >= 0 ? '#3b82f6' : '#ef4444' }}>{net.toLocaleString('en-US')} ر.س</h2></div>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #1d2d47', borderRadius: 18 }}>
          <table style={{ width: '100%', minWidth: 1050, borderCollapse: 'collapse', textAlign: 'center' }}>
            <thead>
              <tr style={{ background: '#101b2e' }}>
                <th>اليوم</th>
                <th>نوع العمل</th>
                <th>موقع العمل</th>
                <th>سعر المشوار</th>
                <th>مصاريف أخرى</th>
                <th>ملاحظات</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const linked = getDayExternalExpenses(row.day);
                const linkedTotal = getDayExternalTotal(row.day);

                return (
                  <tr key={row.day} style={{ borderTop: '1px solid #1d2d47' }}>
                    <td>{row.day}</td>
                    <td><input value={row.workType} onChange={(e) => updateTextRow(row.day, 'workType', e.target.value)} style={inputStyle} /></td>
                    <td><input value={row.tripType} onChange={(e) => updateTextRow(row.day, 'tripType', e.target.value)} style={inputStyle} /></td>
                    <td><input type="text" inputMode="decimal" value={row.tripPrice || ''} onChange={(e) => updateNumberRow(row.day, 'tripPrice', e.target.value)} style={inputStyle} /></td>
                    <td>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <input value={row.expenseType} onChange={(e) => updateTextRow(row.day, 'expenseType', e.target.value)} placeholder="مصروف يدوي" style={inputStyle} />
                          <input type="text" inputMode="decimal" value={row.expenseAmount || ''} onChange={(e) => updateNumberRow(row.day, 'expenseAmount', e.target.value)} style={{ ...inputStyle, minWidth: 80 }} />
                        </div>

                        {linked.length > 0 && (
                          <div style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '7px 8px', textAlign: 'right' }}>
                            <div style={{ fontSize: 10, color: '#fca5a5', fontWeight: 800 }}>مصاريف السواقين والمعدات</div>
                            {linked.map((expense) => (
                              <div key={expense.id} style={{ marginTop: 4, fontSize: 10, color: '#e2e8f0' }}>
                                {expense.category || 'مصروف'} — {Number(expense.amount || 0).toLocaleString('en-US')} ر.س
                              </div>
                            ))}
                            <div style={{ marginTop: 5, fontSize: 11, color: '#fb7185', fontWeight: 900 }}>
                              الإجمالي: {linkedTotal.toLocaleString('en-US')} ر.س
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td><input value={row.notes} onChange={(e) => updateTextRow(row.day, 'notes', e.target.value)} style={inputStyle} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          <button onClick={handleSavePdf} disabled={creatingPdf} style={{ ...buttonStyle, background: '#2563eb' }}>
            <Download size={18} />{creatingPdf ? 'جاري...' : 'حفظ PDF'}
          </button>
          <button onClick={handleShare} disabled={creatingPdf} style={{ ...buttonStyle, background: '#7c3aed' }}>
            <Share2 size={18} />مشاركة
          </button>
          <button onClick={handleWhatsApp} style={{ ...buttonStyle, background: '#16a34a' }}>
            <MessageCircle size={18} />واتساب
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
