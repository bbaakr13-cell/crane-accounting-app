// Updated MonthlyDetailPage.tsx
// NOTE: Replace your current file with this one.

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
const HACEN_FONT_URL = '/hacen-egypt.ttf';
const MONTHLY_HEADER_URL = '/monthly-header.png';
const MONTHLY_FOOTER_URL = '/monthly-footer.png';
const PDF_WIDTH = 794;
const PDF_HEIGHT = 1123;
const PDF_SCALE = 4;

const monthNames = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
];

function normalizeArabicNumbers(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
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
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { year, month, day };
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
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

function fitFontSize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number, minSize: number, family: string, weight = 400) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px "${family}"`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  return size;
}


function loadCanvasImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`تعذر تحميل الصورة: ${src}`));
    image.src = src;
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
    let cancelled = false;
    async function loadEquipment() {
      setEquipmentLoading(true);
      try {
        const list = await fetchEquipment();
        if (cancelled) return;
        setEquipmentList(list);
        if (id && list.some((item) => String(item.id) === String(id))) setEquipmentId(String(id));
        else if (list.length > 0) setEquipmentId(String(list[0].id));
        else setEquipmentId('');
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
    return () => { cancelled = true; };
  }, [id]);

  const selectedEquipment = useMemo(() => {
    return equipmentList.find((item) => String(item.id) === String(equipmentId)) || null;
  }, [equipmentList, equipmentId]);

  const equipmentName = selectedEquipment?.name || 'لا توجد معدة محددة';
  const displayEquipmentName = formatEquipmentName(equipmentName);

  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);

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

  function updateTextRow(day: number, field: 'workType' | 'tripType' | 'expenseType' | 'notes', value: string) {
    setRows((oldRows) => oldRows.map((row) => row.day === day ? { ...row, [field]: value } : row));
  }

  function updateNumberRow(day: number, field: 'tripPrice' | 'expenseAmount', value: string) {
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

  function drawArabic(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color = '#111827') {
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

  function drawEnglish(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color = '#111827', weight = 900) {
    setEnglishFont(ctx, size, weight);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawInfoBox(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, label: string, value: string) {
    roundedRect(ctx, x, y, width, height, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#c9def2';
    ctx.lineWidth = 1;
    ctx.stroke();
    drawArabic(ctx, label, x + width / 2, y + 16, 13, '#0b3b82');
    const valueSize = fitFontSize(ctx, value, width - 14, 18, 11, HACEN_FONT_NAME);
    drawArabic(ctx, value, x + width / 2, y + 38, valueSize, '#111827');
  }

  function getPdfRow(day: number): DayRow {
    return rows.find((item) => item.day === day) || {
      day, workType: '', tripType: '', tripPrice: 0,
      expenseType: '', expenseAmount: 0, notes: '',
    };
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

    const NAVY = '#082c5f';
    const BLUE = '#0f5fb7';
    const GREEN = '#129c70';
    const RED = '#d32f2f';
    const BORDER = '#bcd4ea';
    const TEXT = '#0f172a';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PDF_WIDTH, PDF_HEIGHT);

    // =========================================================
    // 1) الهيدر المصمم كصورة ثابتة
    // ضع monthly-header.png داخل public
    // =========================================================
    const headerH = 240;

    try {
      const headerImage = await loadCanvasImage(MONTHLY_HEADER_URL);
      ctx.drawImage(headerImage, 0, 0, PDF_WIDTH, headerH);
    } catch (error) {
      console.error(error);
      ctx.fillStyle = '#eef7ff';
      ctx.fillRect(0, 0, PDF_WIDTH, headerH);
      drawEnglish(ctx, 'BAKR PRO', 175, 56, 38, '#041b3d', 900);
      drawArabic(ctx, 'ملف الحساب الشهري', PDF_WIDTH / 2, 130, 28, NAVY);
    }

    // قيم الشهر والسنة داخل الهيدر
    roundedRect(ctx, 643, 151, 48, 25, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    drawArabic(ctx, monthNames[month], 667, 163, 10.5, TEXT);

    roundedRect(ctx, 708, 151, 48, 25, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    drawEnglish(ctx, String(year), 732, 163, 10, TEXT, 800);

    // القيم داخل الخانات السفلية للهيدر
    const headerValueY = 226;

    roundedRect(ctx, 28, 214, 168, 20, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    drawArabic(
      ctx,
      displayEquipmentName,
      112,
      headerValueY,
      fitFontSize(ctx, displayEquipmentName, 158, 12, 8, HACEN_FONT_NAME),
      TEXT
    );

    roundedRect(ctx, 227, 214, 160, 20, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    drawArabic(ctx, 'خميس مشيط - أبها', 307, headerValueY, 10.5, TEXT);

    roundedRect(ctx, 405, 214, 175, 20, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    // السائق/المشغل متروك فارغاً لأن الصفحة الحالية لا تحتوي حقل اسم سائق

    roundedRect(ctx, 611, 214, 157, 20, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    // الملاحظات العامة متروكة فارغة

    // =========================================================
    // 2) جدول الحساب الشهري الديناميكي
    // اليوم | نوع العمل | موقع العمل | سعر المشوار | مصاريف أخرى | المبلغ
    // =========================================================
    const tableX = 18;
    const tableY = 247;
    const tableWidth = PDF_WIDTH - 36;
    const tableHeaderH = 38;

    // مكان بداية الفوتر المصور
    const footerY = 852;
    const footerH = PDF_HEIGHT - footerY;

    const rowHeight =
      (footerY - tableY - tableHeaderH - 6) / 31;

    const columns = [
      { key: 'day', label: 'اليوم', ratio: 0.07 },
      { key: 'work', label: 'نوع العمل', ratio: 0.20 },
      { key: 'location', label: 'موقع العمل', ratio: 0.20 },
      { key: 'trip', label: 'سعر المشوار', ratio: 0.18 },
      { key: 'expense', label: 'مصاريف أخرى', ratio: 0.20 },
      { key: 'amount', label: 'المبلغ', ratio: 0.15 },
    ];

    let cursorX = tableX + tableWidth;

    const columnRects = columns.map((column) => {
      const width = tableWidth * column.ratio;
      cursorX -= width;
      return {
        ...column,
        x: cursorX,
        width,
      };
    });

    columnRects.forEach((column) => {
      const gradient = ctx.createLinearGradient(
        column.x,
        tableY,
        column.x,
        tableY + tableHeaderH
      );

      gradient.addColorStop(0, '#0f5fb7');
      gradient.addColorStop(1, '#063a78');

      ctx.fillStyle = gradient;
      ctx.fillRect(
        column.x,
        tableY,
        column.width,
        tableHeaderH
      );

      ctx.strokeStyle = '#ffffff66';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(
        column.x,
        tableY,
        column.width,
        tableHeaderH
      );

      const size = fitFontSize(
        ctx,
        column.label,
        column.width - 10,
        17,
        12,
        HACEN_FONT_NAME
      );

      drawArabic(
        ctx,
        column.label,
        column.x + column.width / 2,
        tableY + tableHeaderH / 2,
        size,
        '#ffffff'
      );
    });

    for (let day = 1; day <= 31; day += 1) {
      const row = getPdfRow(day);

      const rowY =
        tableY +
        tableHeaderH +
        (day - 1) * rowHeight;

      const linkedTotal =
        getDayExternalTotal(day);

      const linkedCategories =
        getDayExternalCategories(day);

      const manualExpense =
        Number(row.expenseAmount) || 0;

      const combinedExpense =
        manualExpense + linkedTotal;

      const expenseText = [
        row.expenseType,
        linkedCategories,
      ]
        .filter(Boolean)
        .join(' + ');

      const values: Record<string, string> = {
        day: String(day),
        work: row.workType,
        location: row.tripType,
        trip:
          row.tripPrice > 0
            ? row.tripPrice.toLocaleString('en-US')
            : '',
        expense: expenseText,
        amount:
          combinedExpense > 0
            ? combinedExpense.toLocaleString('en-US')
            : '',
      };

      columnRects.forEach((column) => {
        ctx.fillStyle =
          day % 2 === 0
            ? '#eef7ff'
            : '#ffffff';

        ctx.fillRect(
          column.x,
          rowY,
          column.width,
          rowHeight
        );

        ctx.strokeStyle = BORDER;
        ctx.lineWidth = 0.55;

        ctx.strokeRect(
          column.x,
          rowY,
          column.width,
          rowHeight
        );

        const value = values[column.key] || '';
        if (!value) return;

        const size = fitFontSize(
          ctx,
          value,
          column.width - 6,
          9.4,
          6.2,
          HACEN_FONT_NAME
        );

        let color = TEXT;

        if (
          column.key === 'amount' &&
          combinedExpense > 0
        ) {
          color = RED;
        }

        if (
          column.key === 'trip' &&
          row.tripPrice > 0
        ) {
          color = GREEN;
        }

        drawArabic(
          ctx,
          value,
          column.x + column.width / 2,
          rowY + rowHeight / 2,
          size,
          color
        );
      });
    }

    // =========================================================
    // 3) الفوتر المصمم كصورة ثابتة
    // ضع monthly-footer.png داخل public
    // =========================================================
    try {
      const footerImage = await loadCanvasImage(MONTHLY_FOOTER_URL);
      ctx.drawImage(
        footerImage,
        0,
        footerY,
        PDF_WIDTH,
        footerH
      );
    } catch (error) {
      console.error(error);

      const footerGradient = ctx.createLinearGradient(
        0,
        footerY,
        PDF_WIDTH,
        footerY
      );

      footerGradient.addColorStop(0, '#0a4d91');
      footerGradient.addColorStop(1, '#041f48');

      ctx.fillStyle = footerGradient;
      ctx.fillRect(
        0,
        footerY,
        PDF_WIDTH,
        footerH
      );
    }

    // =========================================================
    // 4) تعبئة بطاقات الفوتر بقيم الحساب الحقيقية
    // ترتيب الصورة من اليسار:
    // المصروفات | الإيرادات | عدد الرحلات | الصافي
    // =========================================================
    const footerValueY = footerY + 61;

    const footerValues = [
      {
        x: 111,
        value: `${totalExpense.toLocaleString('en-US')} ر.س`,
        color: RED,
      },
      {
        x: 303,
        value: `${totals.income.toLocaleString('en-US')} ر.س`,
        color: GREEN,
      },
      {
        x: 495,
        value: String(totals.trips),
        color: BLUE,
      },
      {
        x: 686,
        value: `${net.toLocaleString('en-US')} ر.س`,
        color: net >= 0 ? NAVY : RED,
      },
    ];

    footerValues.forEach((item) => {
      roundedRect(
        ctx,
        item.x - 72,
        footerY + 43,
        144,
        34,
        7
      );

      ctx.fillStyle = 'rgba(255,255,255,0.97)';
      ctx.fill();

      drawArabic(
        ctx,
        item.value,
        item.x,
        footerValueY,
        13.5,
        item.color
      );
    });

    return canvas;
  }


  async function createPdfBlob() {
    const canvas = await createPdfCanvas();
    const imageData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: false });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(imageData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'NONE');
    return pdf.output('blob');
  }

  async function createPdfFile() {
    const blob = await createPdfBlob();
    const base64 = await blobToBase64(blob);
    const result = await Filesystem.writeFile({ path: getFileName(), data: base64, directory: Directory.Cache });
    return result.uri;
  }

  async function handleSavePdf() {
    if (!equipmentId) { alert('اختر المعدة أولاً'); return; }
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
    if (!equipmentId) { alert('اختر المعدة أولاً'); return; }
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
    if (!equipmentId) { alert('اختر المعدة أولاً'); return; }
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
      <style>{`
        @font-face {
          font-family: '${HACEN_FONT_NAME}';
          src: url('${HACEN_FONT_URL}') format('truetype');
          font-style: normal;
          font-weight: 400;
          font-display: block;
        }
      `}</style>

      <div dir="rtl" style={{ padding: 18, paddingBottom: 110, maxWidth: 1100, margin: 'auto', color: '#ffffff' }}>
        <h1 style={{ margin: 0, fontSize: 27, fontWeight: 800 }}>الحساب الشهري</h1>
        <p style={{ color: '#94a3b8', marginTop: 7 }}>سجل أعمال ومشاوير ومصاريف {displayEquipmentName}</p>

        <div style={{ background: '#0b1527', border: '1px solid #1d2d47', borderRadius: 18, padding: 14, marginBottom: 18, display: 'grid', gap: 10 }}>
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
                  <option key={item.id} value={String(item.id)}>{formatEquipmentName(item.name)}</option>
                ))
              )}
            </select>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={selectStyle}>
              {monthNames.map((name, index) => <option key={name} value={index}>{name}</option>)}
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

        <div style={{ overflowX: 'auto', border: '1px solid #2b5b92', borderRadius: 18, boxShadow: '0 10px 30px rgba(2, 12, 27, 0.18)' }}>
          <table style={{ width: '100%', minWidth: 1050, borderCollapse: 'collapse', textAlign: 'center' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(180deg, #0f5fb7 0%, #063a78 100%)' }}>
                <th style={{ padding: '15px 10px', fontSize: 16, fontWeight: 900, color: '#ffffff', whiteSpace: 'nowrap' }}>اليوم</th>
                <th style={{ padding: '15px 10px', fontSize: 17, fontWeight: 900, color: '#ffffff', whiteSpace: 'nowrap' }}>نوع العمل</th>
                <th style={{ padding: '15px 10px', fontSize: 17, fontWeight: 900, color: '#ffffff', whiteSpace: 'nowrap' }}>موقع العمل</th>
                <th style={{ padding: '15px 10px', fontSize: 17, fontWeight: 900, color: '#ffffff', whiteSpace: 'nowrap' }}>سعر المشوار</th>
                <th style={{ padding: '15px 10px', fontSize: 17, fontWeight: 900, color: '#ffffff', whiteSpace: 'nowrap' }}>مصاريف أخرى</th>
                <th style={{ padding: '15px 10px', fontSize: 17, fontWeight: 900, color: '#ffffff', whiteSpace: 'nowrap' }}>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const linked = getDayExternalExpenses(row.day);
                const linkedTotal = getDayExternalTotal(row.day);
                return (
                  <tr key={row.day} style={{ borderTop: '1px solid #1d2d47', background: row.day % 2 === 0 ? 'rgba(30, 64, 175, 0.05)' : 'transparent' }}>
                    <td>{row.day}</td>
                    <td><input value={row.workType} onChange={(e) => updateTextRow(row.day, 'workType', e.target.value)} style={inputStyle} /></td>
                    <td><input value={row.tripType} onChange={(e) => updateTextRow(row.day, 'tripType', e.target.value)} style={inputStyle} /></td>
                    <td><input type="text" inputMode="decimal" value={row.tripPrice || ''} onChange={(e) => updateNumberRow(row.day, 'tripPrice', e.target.value)} style={inputStyle} /></td>
                    <td>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <input value={row.expenseType} onChange={(e) => updateTextRow(row.day, 'expenseType', e.target.value)} placeholder="مثال: ديزل" style={inputStyle} />
                        {linked.length > 0 && (
                          <div style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '7px 8px', textAlign: 'right' }}>
                            <div style={{ fontSize: 10, color: '#fca5a5', fontWeight: 800 }}>مصاريف السواقين والمعدات</div>
                            {linked.map((expense) => (
                              <div key={expense.id} style={{ marginTop: 4, fontSize: 10, color: '#e2e8f0' }}>
                                {expense.category || 'مصروف'} — {Number(expense.amount || 0).toLocaleString('en-US')} ر.س
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.expenseAmount || ''}
                        onChange={(e) => updateNumberRow(row.day, 'expenseAmount', e.target.value)}
                        placeholder={linkedTotal > 0 ? `مرتبط: ${linkedTotal.toLocaleString('en-US')}` : '0'}
                        style={{ ...inputStyle, minWidth: 90 }}
                      />
                    </td>
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
