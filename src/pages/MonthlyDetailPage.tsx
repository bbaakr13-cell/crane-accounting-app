import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Download,
  Share2,
  MessageCircle,
  Lock,
  Unlock,
  Camera,
  ImagePlus,
  FileText,
  X,
  Check,
  Trash2,
  Plus,
  Loader2,
} from 'lucide-react';
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

type MonthLockRecord = {
  locked: boolean;
  lockedAt: string;
  rows: DayRow[];
  externalExpenses: ExternalExpenseRecord[];
};

const EXPENSE_STORAGE_KEY =
  'crane_accounting_driver_equipment_expenses_v1';

const HACEN_FONT_NAME = 'HacenEgypt';

const PUBLIC_BASE = import.meta.env.BASE_URL || '/';

const HACEN_FONT_URL =
  `${PUBLIC_BASE}hacen-egypt.ttf`;

const MONTHLY_HEADER_URL =
  `${PUBLIC_BASE}monthly-header.png`;

const PDF_WIDTH = 794;
const PDF_HEIGHT = 1123;
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
    .replace(/[٠-٩]/g, d =>
      String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    )
    .replace(/[۰-۹]/g, d =>
      String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    )
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

  if (![year, month, day].every(Number.isFinite)) {
    return null;
  }

  return {
    year,
    month,
    day,
  };
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius =
    Math.min(r, w / 2, h / 2);

  ctx.beginPath();

  ctx.moveTo(
    x + radius,
    y
  );

  ctx.lineTo(
    x + w - radius,
    y
  );

  ctx.quadraticCurveTo(
    x + w,
    y,
    x + w,
    y + radius
  );

  ctx.lineTo(
    x + w,
    y + h - radius
  );

  ctx.quadraticCurveTo(
    x + w,
    y + h,
    x + w - radius,
    y + h
  );

  ctx.lineTo(
    x + radius,
    y + h
  );

  ctx.quadraticCurveTo(
    x,
    y + h,
    x,
    y + h - radius
  );

  ctx.lineTo(
    x,
    y + radius
  );

  ctx.quadraticCurveTo(
    x,
    y,
    x + radius,
    y
  );

  ctx.closePath();
}

function loadImage(
  src: string
): Promise<HTMLImageElement> {
  return new Promise(
    (resolve, reject) => {
      const img = new Image();

      img.onload = () =>
        resolve(img);

      img.onerror = () =>
        reject(
          new Error(
            `تعذر تحميل الصورة: ${src}`
          )
        );

      img.src = src;
    }
  );
}

/* =========================================================
   ضغط الصورة قبل إرسالها للتحليل
========================================================= */

async function compressImage(
  file: File,
  maxSize = 1800,
  quality = 0.82
): Promise<string> {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onerror = () =>
        reject(
          new Error(
            'تعذر قراءة الصورة'
          )
        );

      reader.onload = () => {
        const image =
          new Image();

        image.onerror = () =>
          reject(
            new Error(
              'تعذر فتح الصورة'
            )
          );

        image.onload = () => {
          let width =
            image.width;

          let height =
            image.height;

          if (
            width > maxSize ||
            height > maxSize
          ) {
            const ratio =
              Math.min(
                maxSize / width,
                maxSize / height
              );

            width =
              Math.round(
                width * ratio
              );

            height =
              Math.round(
                height * ratio
              );
          }

          const canvas =
            document.createElement(
              'canvas'
            );

          canvas.width =
            width;

          canvas.height =
            height;

          const ctx =
            canvas.getContext(
              '2d'
            );

          if (!ctx) {
            reject(
              new Error(
                'تعذر معالجة الصورة'
              )
            );
            return;
          }

          ctx.drawImage(
            image,
            0,
            0,
            width,
            height
          );

          const result =
            canvas.toDataURL(
              'image/jpeg',
              quality
            );

          resolve(result);
        };

        image.src =
          String(
            reader.result || ''
          );
      };

      reader.readAsDataURL(
        file
      );
    }
  );
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

/* =========================================================
   الصفحة
========================================================= */

export function MonthlyDetailPage() {

  const { id } =
    useParams<{ id: string }>();

  const now =
    new Date();

  const [
    equipmentList,
    setEquipmentList
  ] =
    useState<Equipment[]>([]);

  const [
    equipmentId,
    setEquipmentId
  ] =
    useState(id || '');

  const [
    equipmentLoading,
    setEquipmentLoading
  ] =
    useState(true);

  const [
    year,
    setYear
  ] =
    useState(
      now.getFullYear()
    );

  const [
    month,
    setMonth
  ] =
    useState(
      now.getMonth()
    );

  const [
    creatingPdf,
    setCreatingPdf
  ] =
    useState(false);

  const [
    externalExpenses,
    setExternalExpenses
  ] =
    useState<
      ExternalExpenseRecord[]
    >([]);

  const [
    rowsLoaded,
    setRowsLoaded
  ] =
    useState(false);

  const [
    monthLock,
    setMonthLock
  ] =
    useState<
      MonthLockRecord | null
    >(null);

  /* =========================================================
     استيراد الصورة
  ========================================================= */

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const cameraInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const pdfInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const [
    importFileType,
    setImportFileType
  ] = useState<'image' | 'pdf' | null>(null);

  const [
    importOpen,
    setImportOpen
  ] =
    useState(false);

  const [
    importFile,
    setImportFile
  ] =
    useState<File | null>(
      null
    );

  const [
    importPreview,
    setImportPreview
  ] =
    useState('');

  const [
    importing,
    setImporting
  ] =
    useState(false);

  const [
    importRows,
    setImportRows
  ] =
    useState<DayRow[]>([]);

  const [
    importError,
    setImportError
  ] =
    useState('');

  /* =========================================================
     تحميل المعدات
  ========================================================= */

  useEffect(() => {

    let alive = true;

    setEquipmentLoading(
      true
    );

    const equipmentTimeout =
      new Promise<Equipment[]>(
        resolve => {
          window.setTimeout(
            () =>
              resolve([]),
            5000
          );
        }
      );

    Promise.race([
      fetchEquipment(),
      equipmentTimeout,
    ])
      .then(list => {

        if (!alive) return;

        const safe =
          Array.isArray(list)
            ? list
            : [];

        setEquipmentList(
          safe
        );

        setEquipmentId(
          current => {

            if (
              id &&
              safe.some(
                x =>
                  String(x.id) ===
                  String(id)
              )
            ) {
              return String(id);
            }

            if (
              safe.some(
                x =>
                  String(x.id) ===
                  String(current)
              )
            ) {
              return current;
            }

            return safe.length
              ? String(
                  safe[0].id
                )
              : (
                  id ||
                  current ||
                  ''
                );
          }
        );
      })
      .catch(error => {

        console.error(
          'EQUIPMENT LOAD ERROR:',
          error
        );

        if (alive) {
          setEquipmentList(
            []
          );
        }
      })
      .finally(() => {

        if (alive) {
          setEquipmentLoading(
            false
          );
        }
      });

    return () => {
      alive = false;
    };

  }, [id]);

  const selectedEquipment =
    useMemo(
      () =>
        equipmentList.find(
          x =>
            String(x.id) ===
            String(equipmentId)
        ) || null,
      [
        equipmentList,
        equipmentId,
      ]
    );

  const displayEquipmentName =
    formatEquipmentName(
      selectedEquipment?.name ||
        'لا توجد معدة محددة'
    );

  const daysInMonth =
    useMemo(
      () =>
        new Date(
          year,
          month + 1,
          0
        ).getDate(),
      [
        year,
        month,
      ]
    );

  const storageKey =
    equipmentId
      ? `monthly-ledger-v3-${equipmentId}-${year}-${month}`
      : `monthly-ledger-v3-no-equipment-${year}-${month}`;

  const monthLockKey =
    equipmentId
      ? `monthly-ledger-lock-v1-${equipmentId}-${year}-${month}`
      : `monthly-ledger-lock-v1-no-equipment-${year}-${month}`;

  const isMonthLocked =
    Boolean(
      monthLock?.locked
    );

  /* =========================================================
     القفل
  ========================================================= */

  useEffect(() => {

    if (!equipmentId) {
      setMonthLock(
        null
      );
      return;
    }

    try {

      const raw =
        localStorage.getItem(
          monthLockKey
        );

      const parsed =
        raw
          ? JSON.parse(
              raw
            ) as MonthLockRecord
          : null;

      setMonthLock(
        parsed?.locked
          ? parsed
          : null
      );

    } catch {

      setMonthLock(
        null
      );

    }

  }, [
    monthLockKey,
    equipmentId,
  ]);

  const emptyRows =
    () =>
      Array.from(
        {
          length:
            daysInMonth,
        },
        (_, i): DayRow => ({
          day: i + 1,
          workType: '',
          tripType: '',
          tripPrice: 0,
          expenseType: '',
          expenseAmount: 0,
          notes: '',
        })
      );

  const [
    rows,
    setRows
  ] =
    useState<DayRow[]>(
      emptyRows()
    );

  /* =========================================================
     قراءة الشهر
  ========================================================= */

  useEffect(() => {

    setRowsLoaded(
      false
    );

    try {

      if (!equipmentId) {

        setRows(
          emptyRows()
        );

        return;
      }

      const raw =
        localStorage.getItem(
          storageKey
        );

      if (!raw) {

        setRows(
          emptyRows()
        );

        return;
      }

      const saved =
        JSON.parse(
          raw
        ) as DayRow[];

      setRows(
        emptyRows().map(
          r => ({
            ...r,
            ...(
              saved.find(
                x =>
                  x.day ===
                  r.day
              ) || {}
            ),
          })
        )
      );

    } catch (e) {

      console.error(
        'MONTHLY READ ERROR:',
        e
      );

      setRows(
        emptyRows()
      );

    } finally {

      setRowsLoaded(
        true
      );

    }

  }, [
    equipmentId,
    year,
    month,
    daysInMonth,
    storageKey,
  ]);

  /* =========================================================
     حفظ الشهر
  ========================================================= */

  useEffect(() => {

    if (
      !equipmentId ||
      !rowsLoaded
    ) {
      return;
    }

    try {

      localStorage.setItem(
        storageKey,
        JSON.stringify(
          rows
        )
      );

    } catch (e) {

      console.error(
        'MONTHLY SAVE ERROR:',
        e
      );

    }

  }, [
    rows,
    storageKey,
    equipmentId,
    rowsLoaded,
  ]);

  /* =========================================================
     المصروفات المرتبطة
  ========================================================= */

  const loadExternalExpenses =
    () => {

      try {

        const raw =
          localStorage.getItem(
            EXPENSE_STORAGE_KEY
          );

        const parsed =
          raw
            ? JSON.parse(
                raw
              )
            : [];

        setExternalExpenses(
          Array.isArray(
            parsed
          )
            ? parsed
            : []
        );

      } catch {

        setExternalExpenses(
          []
        );

      }
    };

  useEffect(() => {

    loadExternalExpenses();

    const focus =
      () =>
        loadExternalExpenses();

    const updated =
      () =>
        loadExternalExpenses();

    const storage =
      (e: StorageEvent) => {

        if (
          !e.key ||
          e.key ===
            EXPENSE_STORAGE_KEY
        ) {
          loadExternalExpenses();
        }

      };

    window.addEventListener(
      'focus',
      focus
    );

    window.addEventListener(
      'storage',
      storage
    );

    window.addEventListener(
      'driver-equipment-expenses-updated',
      updated
    );

    return () => {

      window.removeEventListener(
        'focus',
        focus
      );

      window.removeEventListener(
        'storage',
        storage
      );

      window.removeEventListener(
        'driver-equipment-expenses-updated',
        updated
      );

    };

  }, []);

  const externalByDay =
    useMemo(() => {

      const map =
        new Map<
          number,
          ExternalExpenseRecord[]
        >();

      if (!equipmentId) {
        return map;
      }

      const sourceExpenses =
        isMonthLocked &&
        monthLock
          ? monthLock.externalExpenses
          : externalExpenses;

      sourceExpenses.forEach(
        expense => {

          if (
            String(
              expense.equipmentId ||
                ''
            ) !==
            String(
              equipmentId
            )
          ) {
            return;
          }

          const d =
            getDateParts(
              expense.date
            );

          if (
            !d ||
            d.year !== year ||
            d.month !==
              month + 1
          ) {
            return;
          }

          const arr =
            map.get(
              d.day
            ) || [];

          arr.push(
            expense
          );

          map.set(
            d.day,
            arr
          );

        }
      );

      return map;

    }, [
      externalExpenses,
      equipmentId,
      year,
      month,
      isMonthLocked,
      monthLock,
    ]);

  const linkedTotal =
    (day: number) =>
      (
        externalByDay.get(
          day
        ) || []
      ).reduce(
        (s, x) =>
          s +
          (
            Number(
              x.amount
            ) || 0
          ),
        0
      );

  const linkedCategories =
    (day: number) =>
      Array.from(
        new Set(
          (
            externalByDay.get(
              day
            ) || []
          )
            .map(
              x =>
                x.category
            )
            .filter(
              Boolean
            )
        )
      ).join(' + ');

  /* =========================================================
     تعديل الصفوف
  ========================================================= */

  const updateText =
    (
      day: number,
      field:
        | 'workType'
        | 'tripType'
        | 'expenseType'
        | 'notes',
      value: string
    ) => {

      if (
        isMonthLocked
      ) {
        return;
      }

      setRows(
        old =>
          old.map(
            r =>
              r.day === day
                ? {
                    ...r,
                    [field]:
                      value,
                  }
                : r
          )
      );
    };

  const updateNumber =
    (
      day: number,
      field:
        | 'tripPrice'
        | 'expenseAmount',
      value: string
    ) => {

      if (
        isMonthLocked
      ) {
        return;
      }

      const valueNumber =
        Number(
          normalizeArabicNumbers(
            value
          )
        );

      setRows(
        old =>
          old.map(
            r =>
              r.day === day
                ? {
                    ...r,
                    [field]:
                      Number.isFinite(
                        valueNumber
                      )
                        ? valueNumber
                        : 0,
                  }
                : r
          )
      );
    };

  /* =========================================================
     إجماليات
  ========================================================= */

  const totals =
    useMemo(
      () =>
        rows.reduce(
          (s, r) => {

            const linked =
              linkedTotal(
                r.day
              );

            const hasWork =
              r.workType.trim() ||
              r.tripType.trim() ||
              r.tripPrice > 0 ||
              r.expenseType.trim() ||
              r.expenseAmount > 0 ||
              r.notes.trim() ||
              linked > 0;

            if (hasWork) {
              s.registeredDays++;
            }

            if (
              r.tripType.trim() ||
              r.tripPrice > 0
            ) {
              s.trips++;
            }

            s.income +=
              Number(
                r.tripPrice
              ) || 0;

            s.manualExpense +=
              Number(
                r.expenseAmount
              ) || 0;

            s.linkedExpense +=
              linked;

            return s;

          },
          {
            trips: 0,
            income: 0,
            manualExpense: 0,
            linkedExpense: 0,
            registeredDays: 0,
          }
        ),
      [
        rows,
        externalByDay,
      ]
    );

  const totalExpense =
    totals.manualExpense +
    totals.linkedExpense;

  const net =
    totals.income -
    totalExpense;

  /* =========================================================
     استيراد الصورة
  ========================================================= */

  function clearImport() {

    if (
      importPreview
    ) {
      URL.revokeObjectURL(
        importPreview
      );
    }

    setImportFile(
      null
    );

    setImportFileType(null);

    setImportPreview(
      ''
    );

    setImportRows(
      []
    );

    setImportError(
      ''
    );

    setImportOpen(
      false
    );
  }

  function handleImportFile(
    file?: File
  ) {
    if (!file) return;

    if (isMonthLocked) {
      alert('الشهر مقفل. افتح الشهر للتعديل أولاً.');
      return;
    }

    const isImage = file.type.startsWith('image/');
    const isPdf =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf');

    if (!isImage && !isPdf) {
      alert('اختر صورة أو ملف PDF فقط');
      return;
    }

    if (importPreview) {
      URL.revokeObjectURL(importPreview);
    }

    setImportFile(file);
    setImportFileType(isPdf ? 'pdf' : 'image');
    setImportPreview(
      isImage ? URL.createObjectURL(file) : ''
    );
    setImportRows([]);
    setImportError('');
    setImportOpen(true);
  }

  async function analyzeMonthlyImage() {
    if (!importFile) {
      setImportError('اختر صورة أو ملف PDF أولاً');
      return;
    }

    if (isMonthLocked) {
      alert('افتح الشهر للتعديل أولاً');
      return;
    }

    try {
      setImporting(true);
      setImportError('');

      const isPdf = importFileType === 'pdf';
      const fileDataUrl = isPdf
        ? await fileToDataUrl(importFile)
        : await compressImage(importFile);

      const response = await fetch(
        'https://crane-accounting-app.onrender.com/api/monthly-image-import',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageDataUrl: isPdf ? undefined : fileDataUrl,
            pdfDataUrl: isPdf ? fileDataUrl : undefined,
            fileName: importFile.name,
            year,
            month: month + 1,
            daysInMonth,
            equipmentName: displayEquipmentName,
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            (isPdf
              ? 'تعذر تحليل ملف PDF'
              : 'تعذر تحليل الصورة')
        );
      }

      const source = Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data?.data?.rows)
          ? data.data.rows
          : Array.isArray(data?.data)
            ? data.data
            : [];

      const parsedRows: DayRow[] = source
        .map((r: any): DayRow | null => {
          const parsedDay = Number(
            normalizeArabicNumbers(String(r.day ?? r['اليوم'] ?? ''))
          );

          if (
            !Number.isFinite(parsedDay) ||
            parsedDay < 1 ||
            parsedDay > daysInMonth
          ) {
            return null;
          }

          const parsedTripPrice = Number(
            normalizeArabicNumbers(
              String(
                r.tripPrice ??
                r.income ??
                r.amount ??
                r['الدخل'] ??
                r['المبلغ'] ??
                0
              )
            )
          );

          const parsedExpense = Number(
            normalizeArabicNumbers(
              String(
                r.expenseAmount ??
                r.outgoing ??
                r['الخرج'] ??
                0
              )
            )
          );

          return {
            day: parsedDay,
            workType: String(
              r.workType ??
              r.details ??
              r.work ??
              r['تفاصيل'] ??
              r['نوع العمل'] ??
              ''
            ).trim(),
            tripType: String(
              r.tripType ??
              r.location ??
              r['موقع العمل'] ??
              r['الموقع'] ??
              ''
            ).trim(),
            tripPrice: Number.isFinite(parsedTripPrice)
              ? Math.abs(parsedTripPrice)
              : 0,
            expenseType: String(
              r.expenseType ??
              r['نوع المصروف'] ??
              ''
            ).trim(),
            expenseAmount: Number.isFinite(parsedExpense)
              ? Math.abs(parsedExpense)
              : 0,
            notes: String(
              r.notes ??
              r['ملاحظات'] ??
              ''
            ).trim(),
          };
        })
        .filter((r: DayRow | null): r is DayRow => Boolean(r));

      const joinDistinct = (a: string, b: string) => {
        const values = [...a.split(' / '), ...b.split(' / ')]
          .map(x => x.trim())
          .filter(Boolean);

        return Array.from(new Set(values)).join(' / ');
      };

      const mergedByDay = new Map<number, DayRow>();

      parsedRows.forEach(row => {
        const current = mergedByDay.get(row.day);

        if (!current) {
          mergedByDay.set(row.day, { ...row });
          return;
        }

        mergedByDay.set(row.day, {
          day: row.day,
          workType: joinDistinct(current.workType, row.workType),
          tripType: joinDistinct(current.tripType, row.tripType),
          tripPrice:
            (Number(current.tripPrice) || 0) +
            (Number(row.tripPrice) || 0),
          expenseType: joinDistinct(
            current.expenseType,
            row.expenseType
          ),
          expenseAmount:
            (Number(current.expenseAmount) || 0) +
            (Number(row.expenseAmount) || 0),
          notes: joinDistinct(current.notes, row.notes),
        });
      });

      const clean: DayRow[] = Array.from(mergedByDay.values())
        .filter(row =>
          Boolean(
            row.workType ||
            row.tripType ||
            row.tripPrice ||
            row.expenseType ||
            row.expenseAmount ||
            row.notes
          )
        )
        .sort((a, b) => a.day - b.day);

      if (!clean.length) {
        const serverMessage =
          String(
            data?.error ||
            data?.message ||
            data?.detail ||
            ''
          ).trim();

        throw new Error(
          serverMessage ||
          (isPdf
            ? 'لم يتم العثور على بيانات واضحة في ملف PDF'
            : 'لم يتم العثور على بيانات واضحة في الصورة')
        );
      }

      setImportRows(clean);
    } catch (e: any) {
      console.error('MONTHLY IMPORT ERROR:', e);
      setImportError(e?.message || 'تعذر تحليل الملف');
    } finally {
      setImporting(false);
    }
  }

  function updateImportRow(
    index: number,
    field: keyof DayRow,
    value: string
  ) {

    setImportRows(
      old =>
        old.map(
          (row, i) => {

            if (
              i !== index
            ) {
              return row;
            }

            if (
              field === 'day' ||
              field ===
                'tripPrice' ||
              field ===
                'expenseAmount'
            ) {

              const numberValue =
                Number(
                  normalizeArabicNumbers(
                    value
                  )
                );

              return {
                ...row,
                [field]:
                  Number.isFinite(
                    numberValue
                  )
                    ? numberValue
                    : 0,
              };
            }

            return {
              ...row,
              [field]:
                value,
            };
          }
        )
    );
  }

  function deleteImportRow(
    index: number
  ) {

    setImportRows(
      old =>
        old.filter(
          (_, i) =>
            i !== index
        )
    );
  }

  function addImportRow() {

    const usedDays =
      new Set(
        importRows.map(
          r => r.day
        )
      );

    let nextDay = 1;

    while (
      usedDays.has(
        nextDay
      ) &&
      nextDay <=
        daysInMonth
    ) {
      nextDay++;
    }

    if (
      nextDay >
      daysInMonth
    ) {

      alert(
        'كل أيام الشهر موجودة'
      );

      return;
    }

    setImportRows(
      old => [
        ...old,
        {
          day:
            nextDay,
          workType:
            '',
          tripType:
            '',
          tripPrice:
            0,
          expenseType:
            '',
          expenseAmount:
            0,
          notes:
            '',
        },
      ]
    );
  }

  function rowHasData(
    row: DayRow
  ) {

    return Boolean(
      row.workType.trim() ||
      row.tripType.trim() ||
      row.tripPrice > 0 ||
      row.expenseType.trim() ||
      row.expenseAmount > 0 ||
      row.notes.trim()
    );
  }

  function applyImportedRows() {

    if (
      isMonthLocked
    ) {

      alert(
        'افتح الشهر للتعديل أولاً'
      );

      return;
    }

    const valid =
      importRows.filter(
        r =>
          r.day >= 1 &&
          r.day <=
            daysInMonth
      );

    if (
      !valid.length
    ) {

      alert(
        'لا توجد بيانات لاعتمادها'
      );

      return;
    }

    const duplicateDays =
      valid.filter(
        imported => {

          const current =
            rows.find(
              row =>
                row.day ===
                imported.day
            );

          return (
            current &&
            rowHasData(
              current
            )
          );
        }
      );

    if (
      duplicateDays.length >
      0
    ) {

      const ok =
        window.confirm(
          `يوجد بيانات محفوظة مسبقاً في ${duplicateDays.length} يوم.\n\nعند المتابعة سيتم استبدال بيانات هذه الأيام بالبيانات المستوردة من الملف.\n\nمتابعة؟`
        );

      if (!ok) {
        return;
      }
    }

    setRows(
      old =>
        old.map(
          current => {

            const imported =
              valid.find(
                r =>
                  r.day ===
                  current.day
              );

            if (
              !imported
            ) {
              return current;
            }

            return {
              ...current,
              ...imported,
              day:
                current.day,
            };
          }
        )
    );

    const importedCount =
      valid.length;

    clearImport();

    window.setTimeout(
      () => {
        alert(
          `تم استيراد ${importedCount} صف إلى ${monthNames[month]} ${year}`
        );
      },
      100
    );
  }

  /* =========================================================
     الأنماط
  ========================================================= */

  const inputStyle:
    React.CSSProperties =
  {
    width: '100%',
    minWidth: 120,
    padding: '10px 8px',
    borderRadius: 10,
    border:
      '1px solid #26364f',
    background:
      '#0a1424',
    color: '#fff',
    fontSize: 13,
    boxSizing:
      'border-box',
    outline: 'none',
    opacity:
      isMonthLocked
        ? 0.72
        : 1,
  };

  const selectStyle:
    React.CSSProperties =
  {
    ...inputStyle,
    minWidth: 0,
    padding: 12,
  };

  const summaryCard:
    React.CSSProperties =
  {
    background:
      '#0b1527',
    border:
      '1px solid #1d2d47',
    borderRadius: 16,
    padding: 14,
    textAlign:
      'center',
  };

  const buttonStyle:
    React.CSSProperties =
  {
    border: 'none',
    borderRadius: 14,
    padding:
      '14px 10px',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'flex',
    alignItems:
      'center',
    justifyContent:
      'center',
    gap: 6,
    color: '#fff',
  };

  /* =========================================================
     قفل الشهر
  ========================================================= */

  function handleLockMonth() {

    if (!equipmentId) {
      return alert(
        'اختر المعدة أولاً'
      );
    }

    if (
      isMonthLocked
    ) {
      return;
    }

    const ok =
      window.confirm(
        `هل أنت متأكد من تقفيل حساب ${displayEquipmentName} لشهر ${monthNames[month]} ${year}؟\n\nبعد التقفيل لن يمكن تعديل بيانات هذا الشهر إلا بعد فتحه للتعديل.`
      );

    if (!ok) return;

    const record:
      MonthLockRecord =
    {
      locked: true,

      lockedAt:
        new Date().toISOString(),

      rows:
        rows.map(
          r => ({
            ...r,
          })
        ),

      externalExpenses:
        externalExpenses
          .filter(
            expense => {

              if (
                String(
                  expense.equipmentId ||
                    ''
                ) !==
                String(
                  equipmentId
                )
              ) {
                return false;
              }

              const d =
                getDateParts(
                  expense.date
                );

              return Boolean(
                d &&
                d.year ===
                  year &&
                d.month ===
                  month + 1
              );
            }
          )
          .map(
            expense => ({
              ...expense,
            })
          ),
    };

    try {

      localStorage.setItem(
        storageKey,
        JSON.stringify(
          record.rows
        )
      );

      localStorage.setItem(
        monthLockKey,
        JSON.stringify(
          record
        )
      );

      setRows(
        record.rows
      );

      setMonthLock(
        record
      );

    } catch (e) {

      console.error(
        'MONTH LOCK ERROR:',
        e
      );

      alert(
        'تعذر تقفيل الشهر'
      );

    }
  }

  function handleUnlockMonth() {

    if (
      !isMonthLocked
    ) {
      return;
    }

    const ok =
      window.confirm(
        `فتح ${monthNames[month]} ${year} للتعديل؟\n\nبعد الفتح ستعود إمكانية تعديل البيانات وسيتم احتساب المصروفات المرتبطة الحالية.`
      );

    if (!ok) return;

    try {

      localStorage.removeItem(
        monthLockKey
      );

      setMonthLock(
        null
      );

      loadExternalExpenses();

    } catch (e) {

      console.error(
        'MONTH UNLOCK ERROR:',
        e
      );

      alert(
        'تعذر فتح الشهر'
      );

    }
  }

  /* =========================================================
     PDF
  ========================================================= */

  async function createPdfBlob() {

    try {
      await document.fonts.load(
        `400 20px "${HACEN_FONT_NAME}"`
      );
    } catch {}

    const canvas =
      document.createElement(
        'canvas'
      );

    canvas.width =
      PDF_WIDTH *
      PDF_SCALE;

    canvas.height =
      PDF_HEIGHT *
      PDF_SCALE;

    const ctx =
      canvas.getContext(
        '2d'
      );

    if (!ctx) {
      throw new Error(
        'تعذر إنشاء PDF'
      );
    }

    ctx.scale(
      PDF_SCALE,
      PDF_SCALE
    );

    ctx.fillStyle =
      '#fff';

    ctx.fillRect(
      0,
      0,
      PDF_WIDTH,
      PDF_HEIGHT
    );

    try {

      const img =
        await loadImage(
          MONTHLY_HEADER_URL
        );

      ctx.drawImage(
        img,
        0,
        0,
        PDF_WIDTH,
        281
      );

    } catch {

      ctx.fillStyle =
        '#eef7ff';

      ctx.fillRect(
        0,
        0,
        PDF_WIDTH,
        304
      );

      ctx.fillStyle =
        '#082c5f';

      ctx.textAlign =
        'center';

      ctx.font =
        'bold 38px Arial';

      ctx.fillText(
        'BAKR PRO',
        PDF_WIDTH / 2,
        70
      );

    }

    const arabic =
      (
        text: string,
        x: number,
        y: number,
        size: number,
        color =
          '#0f172a',
        weight = 400
      ) => {

        ctx.direction =
          'rtl';

        ctx.textAlign =
          'center';

        ctx.textBaseline =
          'middle';

        ctx.font =
          `${weight} ${size}px "${HACEN_FONT_NAME}", Arial`;

        ctx.fillStyle =
          color;

        ctx.fillText(
          String(
            text || ''
          ),
          x,
          y
        );
      };

    const valueY =
      256;

    arabic(
      String(year),
      137,
      valueY,
      19,
      '#082c5f',
      700
    );

    arabic(
      monthNames[month],
      397,
      valueY,
      19,
      '#082c5f',
      700
    );

    arabic(
      displayEquipmentName,
      652,
      valueY,
      19,
      '#082c5f',
      700
    );

    const tableX = 18;
    const tableY = 310;
    const tableW =
      PDF_WIDTH - 36;
    const headH = 36;
    const summaryY = 1000;

    const rowH =
      (
        summaryY -
        tableY -
        headH -
        6
      ) / 31;

    const cols = [
      [
        'day',
        'اليوم',
        0.07,
      ],
      [
        'work',
        'نوع العمل',
        0.20,
      ],
      [
        'location',
        'موقع العمل',
        0.20,
      ],
      [
        'trip',
        'سعر المشوار',
        0.18,
      ],
      [
        'expense',
        'مصاريف أخرى',
        0.20,
      ],
      [
        'amount',
        'المبلغ',
        0.15,
      ],
    ] as const;

    let cx =
      tableX +
      tableW;

    const rects =
      cols.map(
        (
          [
            key,
            label,
            ratio,
          ]
        ) => {

          const w =
            tableW *
            ratio;

          cx -= w;

          return {
            key,
            label,
            w,
            x: cx,
          };
        }
      );

    rects.forEach(
      c => {

        ctx.fillStyle =
          '#0b4f99';

        ctx.fillRect(
          c.x,
          tableY,
          c.w,
          headH
        );

        ctx.strokeStyle =
          '#ffffff66';

        ctx.strokeRect(
          c.x,
          tableY,
          c.w,
          headH
        );

        arabic(
          c.label,
          c.x +
            c.w / 2,
          tableY +
            headH / 2,
          16,
          '#fff',
          700
        );

      }
    );

    for (
      let day = 1;
      day <= 31;
      day++
    ) {

      const r =
        rows.find(
          x =>
            x.day ===
            day
        ) || {
          day,
          workType: '',
          tripType: '',
          tripPrice: 0,
          expenseType: '',
          expenseAmount: 0,
          notes: '',
        };

      const linked =
        linkedTotal(
          day
        );

      const amount =
        (
          Number(
            r.expenseAmount
          ) || 0
        ) + linked;

      const vals:
        Record<
          string,
          string
        > =
      {
        day:
          String(day),

        work:
          r.workType,

        location:
          r.tripType,

        trip:
          r.tripPrice > 0
            ? r.tripPrice.toLocaleString(
                'en-US'
              )
            : '',

        expense:
          [
            r.expenseType,
            linkedCategories(
              day
            ),
          ]
            .filter(
              Boolean
            )
            .join(' + '),

        amount:
          amount > 0
            ? amount.toLocaleString(
                'en-US'
              )
            : '',
      };

      const y =
        tableY +
        headH +
        (
          day - 1
        ) *
          rowH;

      rects.forEach(
        c => {

          ctx.fillStyle =
            day % 2 === 0
              ? '#eef7ff'
              : '#fff';

          ctx.fillRect(
            c.x,
            y,
            c.w,
            rowH
          );

          ctx.strokeStyle =
            '#bcd4ea';

          ctx.lineWidth =
            0.55;

          ctx.strokeRect(
            c.x,
            y,
            c.w,
            rowH
          );

          const value =
            vals[c.key] ||
            '';

          if (value) {

            const rowFontSize =
              c.key ===
              'day'
                ? 12
                : 17;

            arabic(
              value,
              c.x +
                c.w / 2,
              y +
                rowH / 2,
              rowFontSize,
              c.key ===
                'amount'
                ? '#d32f2f'
                : c.key ===
                    'trip'
                  ? '#129c70'
                  : '#0f172a',
              700
            );

          }
        }
      );
    }

    const cards = [
      [
        'إجمالي المشاوير',
        String(
          totals.trips
        ),
        '#5b21b6',
        '#f7f3ff',
      ],
      [
        'إجمالي الدخل',
        `${totals.income.toLocaleString('en-US')} ر.س`,
        '#129c70',
        '#eefcf4',
      ],
      [
        'إجمالي المصروفات',
        `${totalExpense.toLocaleString('en-US')} ر.س`,
        '#d32f2f',
        '#fff3f3',
      ],
      [
        'صافي الشهر',
        `${net.toLocaleString('en-US')} ر.س`,
        net >= 0
          ? '#082c5f'
          : '#d32f2f',
        '#fff8ee',
      ],
    ];

    const sg = 8;

    const sw =
      (
        PDF_WIDTH -
        36 -
        sg * 3
      ) / 4;

    const sh = 64;

    cards.forEach(
      (c, i) => {

        const x =
          PDF_WIDTH -
          18 -
          sw -
          i *
            (
              sw +
              sg
            );

        roundedRect(
          ctx,
          x,
          1003,
          sw,
          sh,
          9
        );

        ctx.fillStyle =
          c[3];

        ctx.fill();

        ctx.strokeStyle =
          `${c[2]}55`;

        ctx.stroke();

        arabic(
          c[0],
          x +
            sw / 2,
          1022,
          18,
          '#0f172a',
          700
        );

        arabic(
          c[1],
          x +
            sw / 2,
          1050,
          20,
          c[2],
          700
        );
      }
    );

    const footerX = 18;
    const footerY = 1077;

    const footerW =
      PDF_WIDTH - 36;

    const footerH = 32;

    roundedRect(
      ctx,
      footerX,
      footerY,
      footerW,
      footerH,
      7
    );

    ctx.fillStyle =
      '#062b55';

    ctx.fill();

    ctx.fillStyle =
      '#d9a62e';

    ctx.fillRect(
      footerX + 8,
      footerY,
      footerW - 16,
      2
    );

    ctx.direction =
      'ltr';

    ctx.textBaseline =
      'middle';

    ctx.textAlign =
      'left';

    ctx.fillStyle =
      '#ffffff';

    ctx.font =
      '900 12px Arial';

    ctx.fillText(
      '0558995962',
      footerX + 18,
      footerY +
        footerH / 2 +
        1
    );

    ctx.textAlign =
      'center';

    ctx.fillStyle =
      '#ffffff';

    ctx.font =
      '700 10px Arial';

    ctx.fillText(
      'BAKR ALMASBHI @ 2026 - All Rights Reserved.',
      PDF_WIDTH / 2,
      footerY +
        footerH / 2 +
        1
    );

    ctx.textAlign =
      'right';

    ctx.fillStyle =
      '#f2c14e';

    ctx.font =
      '900 11px Arial';

    ctx.fillText(
      'BAKR PRO',
      footerX +
        footerW -
        18,
      footerY +
        footerH / 2 +
        1
    );

    const imageData =
      canvas.toDataURL(
        'image/png'
      );

    const pdf =
      new jsPDF({
        orientation:
          'portrait',
        unit: 'mm',
        format: 'a4',
        compress:
          false,
      });

    pdf.addImage(
      imageData,
      'PNG',
      0,
      0,
      pdf.internal.pageSize.getWidth(),
      pdf.internal.pageSize.getHeight(),
      undefined,
      'NONE'
    );

    return pdf.output(
      'blob'
    );
  }

  async function blobToBase64(
    blob: Blob
  ): Promise<string> {

    return new Promise(
      (
        resolve,
        reject
      ) => {

        const reader =
          new FileReader();

        reader.onloadend =
          () => {

            const s =
              String(
                reader.result ||
                  ''
              );

            resolve(
              s.includes(',')
                ? s.split(
                    ','
                  )[1]
                : s
            );
          };

        reader.onerror =
          () =>
            reject(
              new Error(
                'تعذر قراءة PDF'
              )
            );

        reader.readAsDataURL(
          blob
        );
      }
    );
  }

  async function createPdfFile() {

    const blob =
      await createPdfBlob();

    const data =
      await blobToBase64(
        blob
      );

    const clean =
      displayEquipmentName.replace(
        /[\\/:*?"<>|]/g,
        '-'
      );

    const result =
      await Filesystem.writeFile(
        {
          path:
            `BAKR-PRO-${clean}-${monthNames[month]}-${year}.pdf`,

          data,

          directory:
            Directory.Cache,
        }
      );

    return result.uri;
  }

  async function handlePdf() {

    if (!equipmentId) {
      return alert(
        'اختر المعدة أولاً'
      );
    }

    try {

      setCreatingPdf(
        true
      );

      const url =
        await createPdfFile();

      await Share.share({
        title:
          'الحساب الشهري',
        url,
        dialogTitle:
          'حفظ أو مشاركة كشف الحساب',
      });

    } catch (e) {

      console.error(e);

      alert(
        'تعذر إنشاء ملف PDF'
      );

    } finally {

      setCreatingPdf(
        false
      );

    }
  }

  async function handleShare() {

    if (!equipmentId) {
      return alert(
        'اختر المعدة أولاً'
      );
    }

    try {

      setCreatingPdf(
        true
      );

      const url =
        await createPdfFile();

      await Share.share({
        title:
          'الحساب الشهري',

        text:
          `${displayEquipmentName} - ${monthNames[month]} ${year}`,

        url,

        dialogTitle:
          'مشاركة كشف الحساب',
      });

    } finally {

      setCreatingPdf(
        false
      );

    }
  }

  function handleWhatsApp() {

    if (!equipmentId) {
      return alert(
        'اختر المعدة أولاً'
      );
    }

    const text =
      `📊 BAKR PRO\nالحساب الشهري\n\n🏗️ المعدة: ${displayEquipmentName}\n📅 الشهر: ${monthNames[month]} ${year}\n\n🚚 عدد المشاوير: ${totals.trips}\n💰 إجمالي الدخل: ${totals.income.toLocaleString('en-US')} ر.س\n💸 إجمالي المصروفات: ${totalExpense.toLocaleString('en-US')} ر.س\n✅ صافي الشهر: ${net.toLocaleString('en-US')} ر.س`;

    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank'
    );
  }

  /* =========================================================
     الواجهة
  ========================================================= */

  return (
    <AppLayout>

      <style>
        {`
        @font-face{
          font-family:'${HACEN_FONT_NAME}';
          src:url('${HACEN_FONT_URL}') format('truetype');
          font-style:normal;
          font-weight:400;
          font-display:block;
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
          color: '#fff',
        }}
      >

        <h1
          style={{
            margin: 0,
            fontSize: 27,
            fontWeight: 800,
          }}
        >
          الحساب الشهري
        </h1>

        <p
          style={{
            color: '#94a3b8',
            marginTop: 7,
          }}
        >
          سجل أعمال ومشاوير ومصاريف{' '}
          {displayEquipmentName}
        </p>

        {/* اختيار المعدة والشهر */}

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

            <small
              style={{
                color: '#94a3b8',
              }}
            >
              المعدة
            </small>

            <select
              value={equipmentId}
              onChange={e =>
                setEquipmentId(
                  e.target.value
                )
              }
              style={selectStyle}
              disabled={
                equipmentLoading ||
                equipmentList.length === 0
              }
            >

              {equipmentLoading ? (

                <option
                  value={equipmentId}
                >
                  جاري تحميل المعدات...
                </option>

              ) : equipmentList.length === 0 ? (

                <option
                  value={equipmentId}
                >
                  {equipmentId
                    ? `المعدة ${equipmentId}`
                    : 'لا توجد معدات'}
                </option>

              ) : (

                equipmentList.map(
                  x => (
                    <option
                      key={x.id}
                      value={String(
                        x.id
                      )}
                    >
                      {formatEquipmentName(
                        x.name
                      )}
                    </option>
                  )
                )

              )}

            </select>

          </label>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                '1fr 1fr',
              gap: 10,
            }}
          >

            <select
              value={month}
              onChange={e =>
                setMonth(
                  Number(
                    e.target.value
                  )
                )
              }
              style={selectStyle}
            >

              {monthNames.map(
                (x, i) => (
                  <option
                    key={x}
                    value={i}
                  >
                    {x}
                  </option>
                )
              )}

            </select>

            <select
              value={year}
              onChange={e =>
                setYear(
                  Number(
                    e.target.value
                  )
                )
              }
              style={selectStyle}
            >

              {Array.from(
                {
                  length: 7,
                },
                (_, i) =>
                  now.getFullYear() -
                  2 +
                  i
              ).map(
                y => (
                  <option
                    key={y}
                    value={y}
                  >
                    {y}
                  </option>
                )
              )}

            </select>

          </div>

        </div>

        {/* =====================================================
            استيراد من صورة
        ===================================================== */}

        <div
          style={{
            marginBottom: 18,
            padding: 16,
            borderRadius: 18,
            border: '1px solid #d9a62e',
            background:
              'linear-gradient(135deg,#0b1527,#10213a)',
          }}
        >

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 6,
            }}
          >

            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 13,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  'linear-gradient(135deg,#d9a62e,#f5c84b)',
                color: '#111827',
              }}
            >
              <ImagePlus
                size={24}
              />
            </div>

            <div>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 18,
                }}
              >
                استيراد جدول
              </div>

              <div
                style={{
                  color: '#94a3b8',
                  fontSize: 12,
                  marginTop: 3,
                }}
              >
                صوّر الحساب أو اختر صورة أو ملف PDF من الجوال
              </div>
            </div>

          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{
              display: 'none',
            }}
            onChange={e => {
              handleImportFile(
                e.target.files?.[0]
              );

              e.currentTarget.value =
                '';
            }}
          />

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{
              display: 'none',
            }}
            onChange={e => {
              handleImportFile(
                e.target.files?.[0]
              );

              e.currentTarget.value =
                '';
            }}
          />

          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf,.pdf"
            style={{
              display: 'none',
            }}
            onChange={e => {
              handleImportFile(
                e.target.files?.[0]
              );
              e.currentTarget.value = '';
            }}
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(3, 1fr)',
              gap: 8,
              marginTop: 14,
            }}
          >

            <button
              disabled={
                isMonthLocked
              }
              onClick={() =>
                fileInputRef.current?.click()
              }
              style={{
                ...buttonStyle,
                background:
                  '#2563eb',
                opacity:
                  isMonthLocked
                    ? 0.5
                    : 1,
              }}
            >
              <ImagePlus
                size={18}
              />
              اختيار صورة
            </button>

            <button
              disabled={
                isMonthLocked
              }
              onClick={() =>
                cameraInputRef.current?.click()
              }
              style={{
                ...buttonStyle,
                background:
                  '#0f766e',
                opacity:
                  isMonthLocked
                    ? 0.5
                    : 1,
              }}
            >
              <Camera
                size={18}
              />
              تصوير الجدول
            </button>

            <button
              disabled={isMonthLocked}
              onClick={() =>
                pdfInputRef.current?.click()
              }
              style={{
                ...buttonStyle,
                background: '#dc2626',
                opacity: isMonthLocked ? 0.5 : 1,
              }}
            >
              <FileText size={18} />
              اختيار PDF
            </button>

          </div>

          {isMonthLocked && (
            <div
              style={{
                color: '#fca5a5',
                textAlign: 'center',
                fontSize: 12,
                marginTop: 10,
              }}
            >
              افتح الشهر للتعديل حتى تستطيع استيراد البيانات
            </div>
          )}

        </div>

        {/* قفل الشهر */}

        <div
          style={{
            marginBottom: 18,
          }}
        >

          {isMonthLocked ? (

            <div
              style={{
                background:
                  'linear-gradient(135deg,#052e16,#064e3b)',
                border:
                  '1px solid #22c55e',
                borderRadius: 18,
                padding: 16,
                textAlign: 'center',
              }}
            >

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  color: '#4ade80',
                  fontSize: 20,
                  fontWeight: 900,
                }}
              >
                <Lock
                  size={22}
                />
                الشهر مقفل
              </div>

              <div
                style={{
                  color: '#d1fae5',
                  fontSize: 13,
                  marginTop: 6,
                }}
              >
                تم التقفيل{' '}
                {monthLock?.lockedAt
                  ? new Date(
                      monthLock.lockedAt
                    ).toLocaleString(
                      'ar-SA'
                    )
                  : ''}
              </div>

              <button
                onClick={
                  handleUnlockMonth
                }
                style={{
                  ...buttonStyle,
                  background:
                    '#2563eb',
                  margin:
                    '12px auto 0',
                  minWidth: 190,
                }}
              >
                <Unlock
                  size={18}
                />
                فتح الشهر للتعديل
              </button>

            </div>

          ) : (

            <button
              onClick={
                handleLockMonth
              }
              style={{
                ...buttonStyle,
                background:
                  'linear-gradient(135deg,#f59e0b,#eab308)',
                color: '#111827',
                width: '100%',
                fontSize: 17,
              }}
            >
              <Lock
                size={20}
              />
              تقفيل الشهر
            </button>

          )}

        </div>

        {/* الإجماليات */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(2,1fr)',
            gap: 10,
            marginBottom: 18,
          }}
        >

          <div
            style={summaryCard}
          >
            إجمالي المشاوير
            <h2>
              {totals.trips}
            </h2>
          </div>

          <div
            style={summaryCard}
          >
            إجمالي الدخل
            <h2
              style={{
                color: '#22c55e',
              }}
            >
              {totals.income.toLocaleString(
                'en-US'
              )}{' '}
              ر.س
            </h2>
          </div>

          <div
            style={summaryCard}
          >
            إجمالي المصروفات
            <h2
              style={{
                color: '#ef4444',
              }}
            >
              {totalExpense.toLocaleString(
                'en-US'
              )}{' '}
              ر.س
            </h2>
          </div>

          <div
            style={summaryCard}
          >
            صافي الشهر
            <h2
              style={{
                color:
                  net >= 0
                    ? '#3b82f6'
                    : '#ef4444',
              }}
            >
              {net.toLocaleString(
                'en-US'
              )}{' '}
              ر.س
            </h2>
          </div>

        </div>

        {/* الجدول */}

        <div
          style={{
            overflowX: 'auto',
            border:
              '1px solid #2b5b92',
            borderRadius: 18,
          }}
        >

          <table
            style={{
              width: '100%',
              minWidth: 1050,
              borderCollapse:
                'collapse',
              textAlign:
                'center',
            }}
          >

            <thead>
              <tr
                style={{
                  background:
                    'linear-gradient(180deg,#0f5fb7,#063a78)',
                }}
              >

                {[
                  'اليوم',
                  'نوع العمل',
                  'موقع العمل',
                  'سعر المشوار',
                  'مصاريف أخرى',
                  'المبلغ',
                ].map(
                  x => (
                    <th
                      key={x}
                      style={{
                        padding:
                          '15px 10px',
                        fontSize: 17,
                        fontWeight: 900,
                        color: '#fff',
                        whiteSpace:
                          'nowrap',
                      }}
                    >
                      {x}
                    </th>
                  )
                )}

              </tr>
            </thead>

            <tbody>

              {rows.map(
                row => {

                  const linked =
                    externalByDay.get(
                      row.day
                    ) || [];

                  const linkedAmount =
                    linkedTotal(
                      row.day
                    );

                  return (
                    <tr
                      key={row.day}
                      style={{
                        borderTop:
                          '1px solid #1d2d47',
                      }}
                    >

                      <td>
                        {row.day}
                      </td>

                      <td>
                        <input
                          disabled={
                            isMonthLocked
                          }
                          value={
                            row.workType
                          }
                          onChange={e =>
                            updateText(
                              row.day,
                              'workType',
                              e.target.value
                            )
                          }
                          style={
                            inputStyle
                          }
                        />
                      </td>

                      <td>
                        <input
                          disabled={
                            isMonthLocked
                          }
                          value={
                            row.tripType
                          }
                          onChange={e =>
                            updateText(
                              row.day,
                              'tripType',
                              e.target.value
                            )
                          }
                          style={
                            inputStyle
                          }
                        />
                      </td>

                      <td>
                        <input
                          disabled={
                            isMonthLocked
                          }
                          inputMode="decimal"
                          value={
                            row.tripPrice ||
                            ''
                          }
                          onChange={e =>
                            updateNumber(
                              row.day,
                              'tripPrice',
                              e.target.value
                            )
                          }
                          style={
                            inputStyle
                          }
                        />
                      </td>

                      <td>

                        <div
                          style={{
                            display:
                              'grid',
                            gap: 6,
                          }}
                        >

                          <input
                            disabled={
                              isMonthLocked
                            }
                            value={
                              row.expenseType
                            }
                            onChange={e =>
                              updateText(
                                row.day,
                                'expenseType',
                                e.target.value
                              )
                            }
                            placeholder="مثال: ديزل"
                            style={
                              inputStyle
                            }
                          />

                          {linked.length >
                            0 && (
                            <small
                              style={{
                                color:
                                  '#fca5a5',
                              }}
                            >
                              مرتبط:{' '}
                              {linkedAmount.toLocaleString(
                                'en-US'
                              )}{' '}
                              ر.س
                            </small>
                          )}

                        </div>

                      </td>

                      <td>
                        <input
                          disabled={
                            isMonthLocked
                          }
                          inputMode="decimal"
                          value={
                            row.expenseAmount ||
                            ''
                          }
                          onChange={e =>
                            updateNumber(
                              row.day,
                              'expenseAmount',
                              e.target.value
                            )
                          }
                          style={
                            inputStyle
                          }
                        />
                      </td>

                    </tr>
                  );
                }
              )}

            </tbody>

          </table>

        </div>

        {/* أزرار PDF */}

        <div
          style={{
            marginTop: 18,
            display: 'grid',
            gridTemplateColumns:
              'repeat(3,1fr)',
            gap: 8,
          }}
        >

          <button
            onClick={
              handlePdf
            }
            disabled={
              creatingPdf
            }
            style={{
              ...buttonStyle,
              background:
                '#2563eb',
            }}
          >
            <Download
              size={18}
            />
            {creatingPdf
              ? 'جاري...'
              : 'حفظ PDF'}
          </button>

          <button
            onClick={
              handleShare
            }
            disabled={
              creatingPdf
            }
            style={{
              ...buttonStyle,
              background:
                '#7c3aed',
            }}
          >
            <Share2
              size={18}
            />
            مشاركة
          </button>

          <button
            onClick={
              handleWhatsApp
            }
            style={{
              ...buttonStyle,
              background:
                '#16a34a',
            }}
          >
            <MessageCircle
              size={18}
            />
            واتساب
          </button>

        </div>

      </div>

      {/* =====================================================
          نافذة الاستيراد والمراجعة
      ===================================================== */}

      {importOpen && (

        <div
          dir="rtl"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background:
              'rgba(2,6,23,.88)',
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'center',
            padding: 12,
          }}
        >

          <div
            style={{
              width: '100%',
              maxWidth: 900,
              maxHeight:
                '94vh',
              overflowY:
                'auto',
              background:
                '#07111f',
              border:
                '1px solid #26364f',
              borderRadius: 22,
              padding: 16,
              color: '#fff',
              boxShadow:
                '0 20px 70px rgba(0,0,0,.5)',
            }}
          >

            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems:
                  'center',
                gap: 10,
                marginBottom: 14,
              }}
            >

              <div>
                <div
                  style={{
                    fontSize: 21,
                    fontWeight: 900,
                  }}
                >
                  استيراد الحساب
                </div>

                <div
                  style={{
                    color: '#94a3b8',
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  {displayEquipmentName}{' '}
                  •{' '}
                  {monthNames[month]}{' '}
                  {year}
                </div>
              </div>

              <button
                onClick={
                  clearImport
                }
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  border:
                    '1px solid #334155',
                  background:
                    '#111c2e',
                  color: '#fff',
                  display: 'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                  cursor: 'pointer',
                }}
              >
                <X
                  size={20}
                />
              </button>

            </div>

            {importFileType === 'pdf' && importFile && (
              <div
                style={{
                  border: '1px solid #7f1d1d',
                  background: '#1f1015',
                  borderRadius: 16,
                  padding: 20,
                  marginBottom: 14,
                  textAlign: 'center',
                }}
              >
                <FileText
                  size={52}
                  style={{
                    margin: '0 auto 10px',
                    color: '#ef4444',
                  }}
                />
                <div style={{ fontWeight: 900 }}>
                  ملف PDF جاهز للتحليل
                </div>
                <div
                  style={{
                    color: '#94a3b8',
                    fontSize: 12,
                    marginTop: 5,
                    wordBreak: 'break-all',
                  }}
                >
                  {importFile.name}
                </div>
              </div>
            )}

            {importPreview && (

              <div
                style={{
                  borderRadius: 16,
                  overflow: 'hidden',
                  border:
                    '1px solid #26364f',
                  background:
                    '#020617',
                  marginBottom: 14,
                }}
              >

                <img
                  src={
                    importPreview
                  }
                  alt="معاينة الجدول"
                  style={{
                    width: '100%',
                    maxHeight: 320,
                    objectFit:
                      'contain',
                    display:
                      'block',
                  }}
                />

              </div>

            )}

            {importRows.length ===
              0 && (

              <button
                onClick={
                  analyzeMonthlyImage
                }
                disabled={
                  importing
                }
                style={{
                  ...buttonStyle,
                  width: '100%',
                  background:
                    'linear-gradient(135deg,#d9a62e,#f59e0b)',
                  color:
                    '#111827',
                  fontSize: 17,
                  opacity:
                    importing
                      ? 0.7
                      : 1,
                }}
              >

                {importing ? (
                  <Loader2
                    size={20}
                    style={{
                      animation:
                        'spin 1s linear infinite',
                    }}
                  />
                ) : (
                  <Camera
                    size={20}
                  />
                )}

                {importing
                  ? 'جاري قراءة الجدول...'
                  : importFileType === 'pdf'
                    ? 'تحليل PDF واستخراج البيانات'
                    : 'تحليل الصورة واستخراج البيانات'}

              </button>

            )}

            {importError && (

              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 12,
                  background:
                    '#450a0a',
                  border:
                    '1px solid #dc2626',
                  color:
                    '#fecaca',
                  fontSize: 13,
                }}
              >
                {importError}
              </div>

            )}

            {importRows.length >
              0 && (

              <>

                <div
                  style={{
                    margin:
                      '16px 0 10px',
                    display: 'flex',
                    alignItems:
                      'center',
                    justifyContent:
                      'space-between',
                    gap: 10,
                  }}
                >

                  <div>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 17,
                      }}
                    >
                      مراجعة البيانات
                    </div>

                    <div
                      style={{
                        color:
                          '#94a3b8',
                        fontSize: 12,
                      }}
                    >
                      راجع البيانات وعدّل أي خانة قبل الاعتماد
                    </div>
                  </div>

                  <button
                    onClick={
                      addImportRow
                    }
                    style={{
                      ...buttonStyle,
                      padding:
                        '10px 13px',
                      background:
                        '#1e3a5f',
                    }}
                  >
                    <Plus
                      size={17}
                    />
                    صف
                  </button>

                </div>

                <div
                  style={{
                    overflowX:
                      'auto',
                    border:
                      '1px solid #26364f',
                    borderRadius: 15,
                  }}
                >

                  <table
                    style={{
                      width: '100%',
                      minWidth: 850,
                      borderCollapse:
                        'collapse',
                      textAlign:
                        'center',
                    }}
                  >

                    <thead>

                      <tr
                        style={{
                          background:
                            '#0b4f99',
                        }}
                      >

                        {[
                          'اليوم',
                          'نوع العمل',
                          'الموقع',
                          'سعر المشوار',
                          'نوع المصروف',
                          'المصروف',
                          '',
                        ].map(
                          (
                            title,
                            index
                          ) => (
                            <th
                              key={
                                `${title}-${index}`
                              }
                              style={{
                                padding: 10,
                                fontSize: 13,
                                whiteSpace:
                                  'nowrap',
                              }}
                            >
                              {title}
                            </th>
                          )
                        )}

                      </tr>

                    </thead>

                    <tbody>

                      {importRows.map(
                        (
                          row,
                          index
                        ) => (

                          <tr
                            key={
                              `${row.day}-${index}`
                            }
                            style={{
                              borderTop:
                                '1px solid #26364f',
                            }}
                          >

                            <td
                              style={{
                                padding: 5,
                              }}
                            >
                              <input
                                inputMode="numeric"
                                value={
                                  row.day
                                }
                                onChange={e =>
                                  updateImportRow(
                                    index,
                                    'day',
                                    e.target.value
                                  )
                                }
                                style={{
                                  ...inputStyle,
                                  minWidth: 65,
                                  width: 65,
                                }}
                              />
                            </td>

                            <td
                              style={{
                                padding: 5,
                              }}
                            >
                              <input
                                value={
                                  row.workType
                                }
                                onChange={e =>
                                  updateImportRow(
                                    index,
                                    'workType',
                                    e.target.value
                                  )
                                }
                                style={
                                  inputStyle
                                }
                              />
                            </td>

                            <td
                              style={{
                                padding: 5,
                              }}
                            >
                              <input
                                value={
                                  row.tripType
                                }
                                onChange={e =>
                                  updateImportRow(
                                    index,
                                    'tripType',
                                    e.target.value
                                  )
                                }
                                style={
                                  inputStyle
                                }
                              />
                            </td>

                            <td
                              style={{
                                padding: 5,
                              }}
                            >
                              <input
                                inputMode="decimal"
                                value={
                                  row.tripPrice ||
                                  ''
                                }
                                onChange={e =>
                                  updateImportRow(
                                    index,
                                    'tripPrice',
                                    e.target.value
                                  )
                                }
                                style={
                                  inputStyle
                                }
                              />
                            </td>

                            <td
                              style={{
                                padding: 5,
                              }}
                            >
                              <input
                                value={
                                  row.expenseType
                                }
                                onChange={e =>
                                  updateImportRow(
                                    index,
                                    'expenseType',
                                    e.target.value
                                  )
                                }
                                style={
                                  inputStyle
                                }
                              />
                            </td>

                            <td
                              style={{
                                padding: 5,
                              }}
                            >
                              <input
                                inputMode="decimal"
                                value={
                                  row.expenseAmount ||
                                  ''
                                }
                                onChange={e =>
                                  updateImportRow(
                                    index,
                                    'expenseAmount',
                                    e.target.value
                                  )
                                }
                                style={
                                  inputStyle
                                }
                              />
                            </td>

                            <td
                              style={{
                                padding: 5,
                              }}
                            >

                              <button
                                onClick={() =>
                                  deleteImportRow(
                                    index
                                  )
                                }
                                style={{
                                  width: 40,
                                  height: 40,
                                  border:
                                    'none',
                                  borderRadius: 10,
                                  background:
                                    '#7f1d1d',
                                  color:
                                    '#fff',
                                  cursor:
                                    'pointer',
                                  display:
                                    'flex',
                                  alignItems:
                                    'center',
                                  justifyContent:
                                    'center',
                                }}
                              >
                                <Trash2
                                  size={17}
                                />
                              </button>

                            </td>

                          </tr>

                        )
                      )}

                    </tbody>

                  </table>

                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      '1fr 1fr',
                    gap: 8,
                    marginTop: 14,
                  }}
                >

                  <button
                    onClick={
                      clearImport
                    }
                    style={{
                      ...buttonStyle,
                      background:
                        '#334155',
                    }}
                  >
                    <X
                      size={18}
                    />
                    إلغاء
                  </button>

                  <button
                    onClick={
                      applyImportedRows
                    }
                    style={{
                      ...buttonStyle,
                      background:
                        'linear-gradient(135deg,#16a34a,#15803d)',
                      fontSize: 16,
                    }}
                  >
                    <Check
                      size={19}
                    />
                    اعتماد البيانات
                  </button>

                </div>

              </>

            )}

          </div>

        </div>

      )}

    </AppLayout>
  );
}
