import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useParams } from 'react-router-dom';

import {
  Download,
  Share2,
  MessageCircle,
} from 'lucide-react';

import html2canvas from 'html2canvas';
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

/* =========================
   الحساب الشهري الأساسي
========================= */

type DayRow = {
  day: number;
  workType: string;
  tripType: string;
  tripPrice: number;
  expenseType: string;
  expenseAmount: number;
  notes: string;
};

/* =========================
   مصاريف السواقين والمعدات
========================= */

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

/* =========================
   ترتيب اسم المعدة
========================= */

function formatEquipmentName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/كرين\s*(\d+)/g, 'كرين $1')
    .replace(/(\d+)\s*طن/g, '$1 طن')
    .replace(/طن([^\s])/g, 'طن $1')
    .trim();
}

/* =========================
   قراءة التاريخ بأمان
========================= */

function getDateParts(dateValue: string) {
  const parts =
    String(dateValue || '').split('-');

  if (parts.length < 3) {
    return null;
  }

  const year =
    Number(parts[0]);

  const month =
    Number(parts[1]);

  const day =
    Number(parts[2]);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
  };
}

export function MonthlyDetailPage() {
  const { id } =
    useParams<{ id: string }>();

  const now = new Date();

  const reportRef =
    useRef<HTMLDivElement>(null);

  const [
    equipmentList,
    setEquipmentList,
  ] = useState<Equipment[]>([]);

  const [
    equipmentId,
    setEquipmentId,
  ] = useState(id || '');

  const [
    equipmentLoading,
    setEquipmentLoading,
  ] = useState(true);

  const [year, setYear] =
    useState(now.getFullYear());

  const [month, setMonth] =
    useState(now.getMonth());

  const [
    creatingPdf,
    setCreatingPdf,
  ] = useState(false);

  const [
    externalExpenses,
    setExternalExpenses,
  ] = useState<ExternalExpenseRecord[]>([]);

  const [
    rowsLoaded,
    setRowsLoaded,
  ] = useState(false);

  /* =========================
     تحميل المعدات
  ========================= */

  useEffect(() => {
    let cancelled = false;

    async function loadEquipment() {
      setEquipmentLoading(true);

      try {
        const list =
          await fetchEquipment();

        if (cancelled) {
          return;
        }

        setEquipmentList(list);

        if (
          id &&
          list.some(
            (item) =>
              String(item.id) ===
              String(id)
          )
        ) {
          setEquipmentId(
            String(id)
          );
        } else if (
          list.length > 0
        ) {
          setEquipmentId(
            String(list[0].id)
          );
        } else {
          setEquipmentId('');
        }
      } catch (error) {
        console.error(
          'تعذر تحميل المعدات:',
          error
        );

        if (!cancelled) {
          setEquipmentList([]);
          setEquipmentId('');
        }
      } finally {
        if (!cancelled) {
          setEquipmentLoading(false);
        }
      }
    }

    loadEquipment();

    return () => {
      cancelled = true;
    };
  }, [id]);

  /* =========================
     المعدة المختارة
  ========================= */

  const selectedEquipment =
    useMemo(() => {
      return (
        equipmentList.find(
          (item) =>
            String(item.id) ===
            String(equipmentId)
        ) || null
      );
    }, [
      equipmentList,
      equipmentId,
    ]);

  const equipmentName =
    selectedEquipment?.name ||
    'لا توجد معدة محددة';

  const displayEquipmentName =
    formatEquipmentName(
      equipmentName
    );

  /* =========================
     عدد أيام الشهر
  ========================= */

  const daysInMonth =
    useMemo(() => {
      return new Date(
        year,
        month + 1,
        0
      ).getDate();
    }, [year, month]);

  /* =========================
     مفتاح الحساب الشهري
  ========================= */

  const storageKey =
    equipmentId
      ? `monthly-ledger-v3-${equipmentId}-${year}-${month}`
      : `monthly-ledger-v3-no-equipment-${year}-${month}`;

  function createEmptyRows(): DayRow[] {
    return Array.from(
      {
        length: daysInMonth,
      },
      (_, index) => ({
        day: index + 1,
        workType: '',
        tripType: '',
        tripPrice: 0,
        expenseType: '',
        expenseAmount: 0,
        notes: '',
      })
    );
  }

  const [rows, setRows] =
    useState<DayRow[]>(
      createEmptyRows()
    );

  /* =========================
     تحميل الحساب الشهري
  ========================= */

  useEffect(() => {
    setRowsLoaded(false);

    if (!equipmentId) {
      setRows(
        createEmptyRows()
      );

      setRowsLoaded(true);

      return;
    }

    try {
      const saved =
        localStorage.getItem(
          storageKey
        );

      if (!saved) {
        setRows(
          createEmptyRows()
        );

        setRowsLoaded(true);

        return;
      }

      const parsed =
        JSON.parse(
          saved
        ) as DayRow[];

      const prepared =
        createEmptyRows().map(
          (row) => {
            const found =
              parsed.find(
                (item) =>
                  item.day ===
                  row.day
              );

            if (!found) {
              return row;
            }

            return {
              ...row,
              ...found,
            };
          }
        );

      setRows(prepared);
    } catch (error) {
      console.error(
        'تعذر قراءة الحساب الشهري:',
        error
      );

      setRows(
        createEmptyRows()
      );
    } finally {
      setRowsLoaded(true);
    }
  }, [
    equipmentId,
    year,
    month,
    daysInMonth,
    storageKey,
  ]);

  /* =========================
     حفظ الحساب الشهري
  ========================= */

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
        JSON.stringify(rows)
      );
    } catch (error) {
      console.error(
        'تعذر حفظ الحساب الشهري:',
        error
      );
    }
  }, [
    rows,
    storageKey,
    equipmentId,
    rowsLoaded,
  ]);

  /* =========================
     تحميل مصاريف
     السواقين والمعدات
  ========================= */

  function loadExternalExpenses() {
    try {
      const raw =
        localStorage.getItem(
          EXPENSE_STORAGE_KEY
        );

      if (!raw) {
        setExternalExpenses([]);

        return;
      }

      const parsed =
        JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        setExternalExpenses([]);

        return;
      }

      setExternalExpenses(
        parsed as ExternalExpenseRecord[]
      );
    } catch (error) {
      console.error(
        'تعذر تحميل مصاريف السواقين والمعدات:',
        error
      );

      setExternalExpenses([]);
    }
  }

  useEffect(() => {
    loadExternalExpenses();

    const handleStorage = (
      event: StorageEvent
    ) => {
      if (
        !event.key ||
        event.key ===
          EXPENSE_STORAGE_KEY
      ) {
        loadExternalExpenses();
      }
    };

    const handleFocus = () => {
      loadExternalExpenses();
    };

    const handleUpdated = () => {
      loadExternalExpenses();
    };

    window.addEventListener(
      'storage',
      handleStorage
    );

    window.addEventListener(
      'focus',
      handleFocus
    );

    window.addEventListener(
      'driver-equipment-expenses-updated',
      handleUpdated
    );

    return () => {
      window.removeEventListener(
        'storage',
        handleStorage
      );

      window.removeEventListener(
        'focus',
        handleFocus
      );

      window.removeEventListener(
        'driver-equipment-expenses-updated',
        handleUpdated
      );
    };
  }, []);

  /* =========================
     مصاريف المعدة للشهر الحالي
  ========================= */

  const monthlyExternalExpenses =
    useMemo(() => {
      if (!equipmentId) {
        return [];
      }

      return externalExpenses.filter(
        (expense) => {
          if (
            String(
              expense.equipmentId ||
                ''
            ) !==
            String(equipmentId)
          ) {
            return false;
          }

          const date =
            getDateParts(
              expense.date
            );

          if (!date) {
            return false;
          }

          return (
            date.year === year &&
            date.month ===
              month + 1
          );
        }
      );
    }, [
      externalExpenses,
      equipmentId,
      year,
      month,
    ]);

  /* =========================
     تجميع المصاريف حسب اليوم
  ========================= */

  const externalExpensesByDay =
    useMemo(() => {
      const map =
        new Map<
          number,
          ExternalExpenseRecord[]
        >();

      monthlyExternalExpenses.forEach(
        (expense) => {
          const date =
            getDateParts(
              expense.date
            );

          if (!date) {
            return;
          }

          const current =
            map.get(date.day) ||
            [];

          current.push(expense);

          map.set(
            date.day,
            current
          );
        }
      );

      return map;
    }, [
      monthlyExternalExpenses,
    ]);

  function getDayExternalExpenses(
    day: number
  ) {
    return (
      externalExpensesByDay.get(
        day
      ) || []
    );
  }

  function getDayExternalTotal(
    day: number
  ) {
    return getDayExternalExpenses(
      day
    ).reduce(
      (sum, expense) =>
        sum +
        (Number(
          expense.amount
        ) || 0),
      0
    );
  }

  function getDayExternalCategories(
    day: number
  ) {
    const records =
      getDayExternalExpenses(
        day
      );

    return Array.from(
      new Set(
        records
          .map(
            (expense) =>
              expense.category
          )
          .filter(Boolean)
      )
    ).join(' + ');
  }

  function getDayExternalNotes(
    day: number
  ) {
    const records =
      getDayExternalExpenses(
        day
      );

    return records
      .map((expense) => {
        const parts = [
          expense.driverName
            ? `السائق: ${expense.driverName}`
            : '',
          expense.location
            ? `الموقع: ${expense.location}`
            : '',
          expense.notes || '',
        ].filter(Boolean);

        return parts.join(' - ');
      })
      .filter(Boolean)
      .join(' | ');
  }

  /* =========================
     تعديل الصفوف اليدوية
  ========================= */

  function updateTextRow(
    day: number,
    field:
      | 'workType'
      | 'tripType'
      | 'expenseType'
      | 'notes',
    value: string
  ) {
    setRows((oldRows) =>
      oldRows.map((row) =>
        row.day === day
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    );
  }

  function updateNumberRow(
    day: number,
    field:
      | 'tripPrice'
      | 'expenseAmount',
    value: string
  ) {
    const normalized =
      normalizeArabicNumbers(
        value
      );

    const numberValue =
      normalized.trim() === ''
        ? 0
        : Number(normalized);

    setRows((oldRows) =>
      oldRows.map((row) =>
        row.day === day
          ? {
              ...row,

              [field]:
                Number.isFinite(
                  numberValue
                )
                  ? numberValue
                  : 0,
            }
          : row
      )
    );
  }

  /* =========================
     الإجماليات
  ========================= */

  const totals =
    useMemo(() => {
      return rows.reduce(
        (sum, row) => {
          const linkedExpenses =
            externalExpensesByDay.get(
              row.day
            ) || [];

          const linkedTotal =
            linkedExpenses.reduce(
              (
                expenseSum,
                expense
              ) =>
                expenseSum +
                (Number(
                  expense.amount
                ) || 0),
              0
            );

          const hasWork =
            row.workType.trim() ||
            row.tripType.trim() ||
            row.tripPrice > 0 ||
            row.expenseType.trim() ||
            row.expenseAmount > 0 ||
            row.notes.trim() ||
            linkedExpenses.length >
              0;

          if (hasWork) {
            sum.registeredDays +=
              1;
          }

          if (
            row.tripType.trim() ||
            row.tripPrice > 0
          ) {
            sum.trips += 1;
          }

          sum.income +=
            Number(
              row.tripPrice
            ) || 0;

          sum.manualExpense +=
            Number(
              row.expenseAmount
            ) || 0;

          sum.linkedExpense +=
            linkedTotal;

          return sum;
        },
        {
          trips: 0,
          income: 0,
          manualExpense: 0,
          linkedExpense: 0,
          registeredDays: 0,
        }
      );
    }, [
      rows,
      externalExpensesByDay,
    ]);

  const totalExpense =
    totals.manualExpense +
    totals.linkedExpense;

  const net =
    totals.income -
    totalExpense;

  /* =========================
     الأنماط
  ========================= */

  const inputStyle:
    React.CSSProperties = {
    width: '100%',
    minWidth: 120,
    padding: '10px 8px',
    borderRadius: 10,
    border:
      '1px solid #26364f',
    background: '#0a1424',
    color: '#ffffff',
    fontSize: 13,
    boxSizing: 'border-box',
    outline: 'none',
  };

  const selectStyle:
    React.CSSProperties = {
    ...inputStyle,
    minWidth: 0,
    padding: 12,
  };

  const summaryCard:
    React.CSSProperties = {
    background: '#0b1527',
    border:
      '1px solid #1d2d47',
    borderRadius: 16,
    padding: 14,
    textAlign: 'center',
  };

  const buttonStyle:
    React.CSSProperties = {
    border: 'none',
    borderRadius: 14,
    padding: '14px 10px',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'center',
    gap: 6,
    color: '#ffffff',
  };

  /* =========================
     PDF
  ========================= */

  function getFileName() {
    const cleanEquipment =
      displayEquipmentName.replace(
        /[\\/:*?"<>|]/g,
        '-'
      );

    return (
      `BAKR-PRO-${cleanEquipment}-` +
      `${monthNames[month]}-` +
      `${year}.pdf`
    );
  }

  async function blobToBase64(
    blob: Blob
  ): Promise<string> {
    return new Promise(
      (resolve, reject) => {
        const reader =
          new FileReader();

        reader.onloadend = () => {
          const result =
            reader.result as string;

          const base64 =
            result.includes(',')
              ? result.split(',')[1]
              : result;

          resolve(base64);
        };

        reader.onerror = () =>
          reject(
            new Error(
              'تعذر قراءة ملف PDF'
            )
          );

        reader.readAsDataURL(
          blob
        );
      }
    );
  }

  async function createPdfBlob() {
    if (!reportRef.current) {
      throw new Error(
        'تعذر العثور على التقرير'
      );
    }

    const canvas =
      await html2canvas(
        reportRef.current,
        {
          scale: 1.7,
          useCORS: true,
          backgroundColor:
            '#ffffff',
          logging: false,
        }
      );

    const imageData =
      canvas.toDataURL(
        'image/jpeg',
        0.95
      );

    const pdf =
      new jsPDF(
        'p',
        'mm',
        'a4'
      );

    const pageWidth =
      pdf.internal.pageSize.getWidth();

    const pageHeight =
      pdf.internal.pageSize.getHeight();

    const margin = 8;

    const imageWidth =
      pageWidth -
      margin * 2;

    const imageHeight =
      (canvas.height *
        imageWidth) /
      canvas.width;

    const printableHeight =
      pageHeight -
      margin * 2;

    let position =
      margin;

    pdf.addImage(
      imageData,
      'JPEG',
      margin,
      position,
      imageWidth,
      imageHeight
    );

    let heightLeft =
      imageHeight -
      printableHeight;

    while (
      heightLeft > 0
    ) {
      pdf.addPage();

      position =
        margin -
        (imageHeight -
          heightLeft);

      pdf.addImage(
        imageData,
        'JPEG',
        margin,
        position,
        imageWidth,
        imageHeight
      );

      heightLeft -=
        printableHeight;
    }

    return pdf.output(
      'blob'
    );
  }

  async function createPdfFile() {
    const blob =
      await createPdfBlob();

    const base64 =
      await blobToBase64(
        blob
      );

    const result =
      await Filesystem.writeFile(
        {
          path:
            getFileName(),

          data: base64,

          directory:
            Directory.Cache,
        }
      );

    return result.uri;
  }

  async function handleSavePdf() {
    if (!equipmentId) {
      alert(
        'اختر المعدة أولاً'
      );

      return;
    }

    try {
      setCreatingPdf(
        true
      );

      const fileUri =
        await createPdfFile();

      await Share.share({
        title:
          'حفظ الحساب الشهري',

        text:
          `${displayEquipmentName} - ${monthNames[month]} ${year}`,

        url: fileUri,

        dialogTitle:
          'حفظ أو مشاركة كشف الحساب',
      });
    } catch (error) {
      console.error(
        'PDF ERROR:',
        error
      );

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
      alert(
        'اختر المعدة أولاً'
      );

      return;
    }

    try {
      setCreatingPdf(
        true
      );

      const fileUri =
        await createPdfFile();

      await Share.share({
        title:
          'الحساب الشهري',

        text:
          `المعدة: ${displayEquipmentName}\n` +
          `الشهر: ${monthNames[month]} ${year}\n` +
          `إجمالي الدخل: ${totals.income.toLocaleString('en-US')} ر.س\n` +
          `إجمالي المصروفات: ${totalExpense.toLocaleString('en-US')} ر.س\n` +
          `مصاريف السواقين والمعدات: ${totals.linkedExpense.toLocaleString('en-US')} ر.س\n` +
          `صافي الشهر: ${net.toLocaleString('en-US')} ر.س`,

        url: fileUri,

        dialogTitle:
          'مشاركة كشف الحساب',
      });
    } catch (error) {
      console.error(
        'SHARE ERROR:',
        error
      );

      alert(
        'تعذر مشاركة كشف الحساب'
      );
    } finally {
      setCreatingPdf(
        false
      );
    }
  }

  function handleWhatsApp() {
    if (!equipmentId) {
      alert(
        'اختر المعدة أولاً'
      );

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

    window.open(
      `https://wa.me/?text=${encodeURIComponent(
        text
      )}`,
      '_blank'
    );
  }

  return (
    <AppLayout>
      <div
        dir="rtl"
        style={{
          padding: 18,
          paddingBottom:
            110,
          maxWidth: 1100,
          margin: 'auto',
          color:
            '#ffffff',
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
            color:
              '#94a3b8',
            marginTop: 7,
          }}
        >
          سجل أعمال ومشاوير ومصاريف{' '}
          {displayEquipmentName}
        </p>

        {/* اختيار المعدة والشهر */}

        <div
          style={{
            background:
              '#0b1527',
            border:
              '1px solid #1d2d47',
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
                color:
                  '#94a3b8',
              }}
            >
              المعدة
            </small>

            <select
              value={
                equipmentId
              }
              onChange={(e) =>
                setEquipmentId(
                  e.target.value
                )
              }
              style={
                selectStyle
              }
              disabled={
                equipmentLoading ||
                equipmentList.length ===
                  0
              }
            >
              {equipmentLoading ? (
                <option value="">
                  جاري تحميل المعدات...
                </option>
              ) : equipmentList.length ===
                0 ? (
                <option value="">
                  لا توجد معدات
                </option>
              ) : (
                equipmentList.map(
                  (item) => (
                    <option
                      key={
                        item.id
                      }
                      value={String(
                        item.id
                      )}
                    >
                      {formatEquipmentName(
                        item.name
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
              onChange={(e) =>
                setMonth(
                  Number(
                    e.target.value
                  )
                )
              }
              style={
                selectStyle
              }
            >
              {monthNames.map(
                (
                  name,
                  index
                ) => (
                  <option
                    key={
                      name
                    }
                    value={
                      index
                    }
                  >
                    {name}
                  </option>
                )
              )}
            </select>

            <select
              value={year}
              onChange={(e) =>
                setYear(
                  Number(
                    e.target.value
                  )
                )
              }
              style={
                selectStyle
              }
            >
              {Array.from(
                {
                  length: 7,
                },
                (
                  _,
                  index
                ) => {
                  const y =
                    now.getFullYear() -
                    2 +
                    index;

                  return (
                    <option
                      key={
                        y
                      }
                      value={
                        y
                      }
                    >
                      {y}
                    </option>
                  );
                }
              )}
            </select>
          </div>
        </div>

        {/* ملخص الحساب */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(2, 1fr)',
            gap: 10,
            marginBottom:
              18,
          }}
        >
          <div
            style={
              summaryCard
            }
          >
            إجمالي المشاوير

            <h2>
              {totals.trips}
            </h2>
          </div>

          <div
            style={
              summaryCard
            }
          >
            إجمالي الدخل

            <h2
              style={{
                color:
                  '#22c55e',
              }}
            >
              {totals.income.toLocaleString(
                'en-US'
              )}{' '}
              ر.س
            </h2>
          </div>

          <div
            style={
              summaryCard
            }
          >
            إجمالي المصروفات

            <h2
              style={{
                color:
                  '#ef4444',
              }}
            >
              {totalExpense.toLocaleString(
                'en-US'
              )}{' '}
              ر.س
            </h2>

            {totals.linkedExpense >
              0 && (
              <div
                style={{
                  marginTop: 5,
                  fontSize: 10,
                  color:
                    '#fca5a5',
                }}
              >
                منها مصاريف السواقين والمعدات:{' '}
                {totals.linkedExpense.toLocaleString(
                  'en-US'
                )}{' '}
                ر.س
              </div>
            )}
          </div>

          <div
            style={
              summaryCard
            }
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
            overflowX:
              'auto',
            border:
              '1px solid #1d2d47',
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
                    '#101b2e',
                }}
              >
                <th>
                  اليوم
                </th>

                <th>
                  نوع العمل
                </th>

                <th>
                  موقع العمل
                </th>

                <th>
                  سعر المشوار
                </th>

                <th>
                  مصاريف أخرى
                </th>

                <th>
                  ملاحظات
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map(
                (row) => {
                  const linked =
                    getDayExternalExpenses(
                      row.day
                    );

                  const linkedTotal =
                    getDayExternalTotal(
                      row.day
                    );

                  return (
                    <tr
                      key={
                        row.day
                      }
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
                          value={
                            row.workType
                          }
                          onChange={(
                            e
                          ) =>
                            updateTextRow(
                              row.day,
                              'workType',
                              e.target
                                .value
                            )
                          }
                          style={
                            inputStyle
                          }
                        />
                      </td>

                      <td>
                        <input
                          value={
                            row.tripType
                          }
                          onChange={(
                            e
                          ) =>
                            updateTextRow(
                              row.day,
                              'tripType',
                              e.target
                                .value
                            )
                          }
                          style={
                            inputStyle
                          }
                        />
                      </td>

                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={
                            row.tripPrice ||
                            ''
                          }
                          onChange={(
                            e
                          ) =>
                            updateNumberRow(
                              row.day,
                              'tripPrice',
                              e.target
                                .value
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
                          <div
                            style={{
                              display:
                                'flex',
                              gap: 5,
                            }}
                          >
                            <input
                              value={
                                row.expenseType
                              }
                              onChange={(
                                e
                              ) =>
                                updateTextRow(
                                  row.day,
                                  'expenseType',
                                  e.target
                                    .value
                                )
                              }
                              placeholder="مصروف يدوي"
                              style={
                                inputStyle
                              }
                            />

                            <input
                              type="text"
                              inputMode="decimal"
                              value={
                                row.expenseAmount ||
                                ''
                              }
                              onChange={(
                                e
                              ) =>
                                updateNumberRow(
                                  row.day,
                                  'expenseAmount',
                                  e.target
                                    .value
                                )
                              }
                              style={{
                                ...inputStyle,
                                minWidth:
                                  80,
                              }}
                            />
                          </div>

                          {linked.length >
                            0 && (
                            <div
                              style={{
                                background:
                                  'rgba(239,68,68,0.10)',
                                border:
                                  '1px solid rgba(239,68,68,0.25)',
                                borderRadius:
                                  10,
                                padding:
                                  '7px 8px',
                                textAlign:
                                  'right',
                              }}
                            >
                              <div
                                style={{
                                  fontSize:
                                    10,
                                  color:
                                    '#fca5a5',
                                  fontWeight:
                                    800,
                                }}
                              >
                                مصاريف السواقين والمعدات
                              </div>

                              {linked.map(
                                (
                                  expense
                                ) => (
                                  <div
                                    key={
                                      expense.id
                                    }
                                    style={{
                                      marginTop:
                                        4,
                                      fontSize:
                                        10,
                                      color:
                                        '#e2e8f0',
                                      lineHeight:
                                        1.5,
                                    }}
                                  >
                                    {expense.category ||
                                      'مصروف'}{' '}
                                    —{' '}
                                    <b
                                      style={{
                                        color:
                                          '#fb7185',
                                      }}
                                    >
                                      {Number(
                                        expense.amount ||
                                          0
                                      ).toLocaleString(
                                        'en-US'
                                      )}{' '}
                                      ر.س
                                    </b>

                                    {expense.driverName
                                      ? ` • ${expense.driverName}`
                                      : ''}
                                  </div>
                                )
                              )}

                              <div
                                style={{
                                  marginTop:
                                    5,
                                  paddingTop:
                                    5,
                                  borderTop:
                                    '1px solid rgba(239,68,68,0.18)',
                                  fontSize:
                                    11,
                                  color:
                                    '#fb7185',
                                  fontWeight:
                                    900,
                                }}
                              >
                                الإجمالي:{' '}
                                {linkedTotal.toLocaleString(
                                  'en-US'
                                )}{' '}
                                ر.س
                              </div>
                            </div>
                          )}
                        </div>
                      </td>

                      <td>
                        <input
                          value={
                            row.notes
                          }
                          onChange={(
                            e
                          ) =>
                            updateTextRow(
                              row.day,
                              'notes',
                              e.target
                                .value
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

        {/* أزرار PDF والمشاركة */}

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
              handleSavePdf
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

        {/* تقرير PDF */}

        <div
          ref={reportRef}
          dir="rtl"
          style={{
            position:
              'fixed',
            left:
              '-10000px',
            top: 0,
            width: 1000,
            minHeight: 1414,
            background:
              '#ffffff',
            color:
              '#111827',
            padding:
              '18px',
            boxSizing:
              'border-box',
            fontFamily:
              'Arial, Tahoma, sans-serif',
          }}
        >
          {/* رأس الكشف */}

          <div
            style={{
              display:
                'grid',
              gridTemplateColumns:
                '220px 1fr 245px',
              alignItems:
                'center',
              gap: 18,
              marginBottom:
                14,
            }}
          >
            <div
              style={{
                textAlign:
                  'center',
                color:
                  '#0b3b82',
              }}
            >
              <div
                style={{
                  width: 90,
                  height: 90,
                  margin:
                    '0 auto 5px',
                  borderRadius:
                    '50%',
                  border:
                    '8px solid #0b3b82',
                  display:
                    'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                  fontSize: 42,
                  fontWeight:
                    900,
                }}
              >
                🏗️
              </div>

              <div
                style={{
                  fontSize:
                    24,
                  fontWeight:
                    900,
                }}
              >
                BAKR PRO
              </div>

              <div
                style={{
                  fontSize:
                    12,
                  color:
                    '#334155',
                  marginTop:
                    3,
                }}
              >
                إدارة معدات النقل والمشاريع
              </div>
            </div>

            <div
              style={{
                textAlign:
                  'center',
              }}
            >
              <div
                style={{
                  fontSize:
                    40,
                  fontWeight:
                    900,
                  color:
                    '#0b3b82',
                  letterSpacing:
                    1,
                }}
              >
                BAKR PRO
              </div>

              <div
                style={{
                  fontSize:
                    37,
                  fontWeight:
                    900,
                  color:
                    '#102f61',
                  marginTop:
                    6,
                }}
              >
                كشف الحساب الشهري
              </div>

              <div
                style={{
                  width:
                    '72%',
                  height: 3,
                  background:
                    '#0b3b82',
                  margin:
                    '10px auto',
                }}
              />

              <div
                style={{
                  fontSize:
                    15,
                  color:
                    '#334155',
                }}
              >
                تقرير شامل للأعمال والمشاوير والمصاريف
              </div>
            </div>

            <div
              style={{
                border:
                  '1px solid #cbd5e1',
                borderRadius:
                  10,
                padding: 12,
                fontSize:
                  13,
                lineHeight:
                  2.1,
              }}
            >
              <div>
                <b>
                  رقم الكشف:
                </b>{' '}

                {`${year}${String(
                  month + 1
                ).padStart(
                  2,
                  '0'
                )}`}
              </div>

              <div>
                <b>
                  تاريخ الإصدار:
                </b>{' '}

                {new Date().toLocaleDateString(
                  'en-GB'
                )}
              </div>

              <div>
                <b>
                  وقت الإصدار:
                </b>{' '}

                {new Date().toLocaleTimeString(
                  'ar-SA',
                  {
                    hour:
                      '2-digit',
                    minute:
                      '2-digit',
                  }
                )}
              </div>

              <div>
                <b>
                  إصدار بواسطة:
                </b>{' '}
                BAKR PRO
              </div>
            </div>
          </div>

          {/* بيانات المعدة */}

          <div
            style={{
              display:
                'grid',
              gridTemplateColumns:
                '1.4fr 1fr 1fr',
              border:
                '1px solid #cbd5e1',
              borderRadius:
                10,
              marginBottom:
                12,
              overflow:
                'hidden',
            }}
          >
            <div
              style={{
                padding:
                  12,
                textAlign:
                  'center',
                borderLeft:
                  '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  color:
                    '#0b3b82',
                  fontWeight:
                    800,
                  fontSize:
                    14,
                }}
              >
                المعدة
              </div>

              <div
                dir="rtl"
                style={{
                  fontSize:
                    19,
                  fontWeight:
                    900,
                  marginTop:
                    4,
                  direction:
                    'rtl',
                  unicodeBidi:
                    'plaintext',
                  whiteSpace:
                    'nowrap',
                }}
              >
                {
                  displayEquipmentName
                }
              </div>
            </div>

            <div
              style={{
                padding:
                  12,
                textAlign:
                  'center',
                borderLeft:
                  '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  color:
                    '#0b3b82',
                  fontWeight:
                    800,
                  fontSize:
                    14,
                }}
              >
                الشهر
              </div>

              <div
                style={{
                  fontSize:
                    19,
                  fontWeight:
                    900,
                  marginTop:
                    4,
                }}
              >
                {
                  monthNames[
                    month
                  ]
                }
              </div>
            </div>

            <div
              style={{
                padding:
                  12,
                textAlign:
                  'center',
              }}
            >
              <div
                style={{
                  color:
                    '#0b3b82',
                  fontWeight:
                    800,
                  fontSize:
                    14,
                }}
              >
                السنة
              </div>

              <div
                style={{
                  fontSize:
                    19,
                  fontWeight:
                    900,
                  marginTop:
                    4,
                }}
              >
                {year}
              </div>
            </div>
          </div>

          {/* جدول PDF */}

          <table
            style={{
              width:
                '100%',
              borderCollapse:
                'collapse',
              tableLayout:
                'fixed',
              fontSize:
                10,
              textAlign:
                'center',
            }}
          >
            <thead>
              <tr
                style={{
                  background:
                    '#073b7a',
                  color:
                    '#ffffff',
                }}
              >
                <th
                  style={{
                    width:
                      '6%',
                    padding:
                      '7px 3px',
                    border:
                      '1px solid #d1d5db',
                  }}
                >
                  اليوم
                </th>

                <th
                  style={{
                    width:
                      '15%',
                    padding:
                      '7px 3px',
                    border:
                      '1px solid #d1d5db',
                  }}
                >
                  نوع العمل
                </th>

                <th
                  style={{
                    width:
                      '16%',
                    padding:
                      '7px 3px',
                    border:
                      '1px solid #d1d5db',
                  }}
                >
                  موقع العمل
                </th>

                <th
                  style={{
                    width:
                      '13%',
                    padding:
                      '7px 3px',
                    border:
                      '1px solid #d1d5db',
                  }}
                >
                  سعر المشوار
                </th>

                <th
                  style={{
                    width:
                      '18%',
                    padding:
                      '7px 3px',
                    border:
                      '1px solid #d1d5db',
                  }}
                >
                  بيان المصروف
                </th>

                <th
                  style={{
                    width:
                      '12%',
                    padding:
                      '7px 3px',
                    border:
                      '1px solid #d1d5db',
                  }}
                >
                  المبلغ
                </th>

                <th
                  style={{
                    width:
                      '20%',
                    padding:
                      '7px 3px',
                    border:
                      '1px solid #d1d5db',
                  }}
                >
                  ملاحظات
                </th>
              </tr>
            </thead>

            <tbody>
              {Array.from(
                {
                  length: 31,
                },
                (
                  _,
                  index
                ) => {
                  const day =
                    index + 1;

                  const row =
                    rows.find(
                      (
                        item
                      ) =>
                        item.day ===
                        day
                    ) || {
                      day,
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
                    };

                  const linkedTotal =
                    getDayExternalTotal(
                      day
                    );

                  const linkedCategories =
                    getDayExternalCategories(
                      day
                    );

                  const linkedNotes =
                    getDayExternalNotes(
                      day
                    );

                  const combinedExpense =
                    (Number(
                      row.expenseAmount
                    ) || 0) +
                    linkedTotal;

                  const expenseDescription =
                    [
                      row.expenseType,
                      linkedCategories,
                    ]
                      .filter(
                        Boolean
                      )
                      .join(' + ');

                  const combinedNotes =
                    [
                      row.notes,
                      linkedNotes,
                    ]
                      .filter(
                        Boolean
                      )
                      .join(' | ');

                  return (
                    <tr
                      key={
                        day
                      }
                    >
                      <td
                        style={{
                          minHeight:
                            25,
                          padding:
                            '2px 3px',
                          border:
                            '1px solid #d1d5db',
                          fontWeight:
                            900,
                          fontSize:
                            12,
                        }}
                      >
                        {day}
                      </td>

                      <td
                        style={{
                          padding:
                            '2px 4px',
                          border:
                            '1px solid #d1d5db',
                        }}
                      >
                        {row.workType ||
                          ''}
                      </td>

                      <td
                        style={{
                          padding:
                            '2px 4px',
                          border:
                            '1px solid #d1d5db',
                        }}
                      >
                        {row.tripType ||
                          ''}
                      </td>

                      <td
                        style={{
                          padding:
                            '2px 4px',
                          border:
                            '1px solid #d1d5db',
                          fontWeight:
                            row.tripPrice
                              ? 700
                              : 400,
                        }}
                      >
                        {row.tripPrice >
                        0
                          ? `${row.tripPrice.toLocaleString(
                              'en-US'
                            )} ر.س`
                          : ''}
                      </td>

                      <td
                        style={{
                          padding:
                            '2px 4px',
                          border:
                            '1px solid #d1d5db',
                          color:
                            linkedTotal >
                            0
                              ? '#b91c1c'
                              : '#111827',
                          fontWeight:
                            linkedTotal >
                            0
                              ? 700
                              : 400,
                        }}
                      >
                        {
                          expenseDescription
                        }
                      </td>

                      <td
                        style={{
                          padding:
                            '2px 4px',
                          border:
                            '1px solid #d1d5db',
                          color:
                            combinedExpense >
                            0
                              ? '#b91c1c'
                              : '#111827',
                          fontWeight:
                            combinedExpense >
                            0
                              ? 700
                              : 400,
                        }}
                      >
                        {combinedExpense >
                        0
                          ? `${combinedExpense.toLocaleString(
                              'en-US'
                            )} ر.س`
                          : ''}
                      </td>

                      <td
                        style={{
                          padding:
                            '2px 4px',
                          border:
                            '1px solid #d1d5db',
                          fontSize:
                            9,
                        }}
                      >
                        {
                          combinedNotes
                        }
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>

          {/* الملخص */}

          <div
            style={{
              display:
                'grid',
              gridTemplateColumns:
                'repeat(5, 1fr)',
              gap: 8,
              marginTop:
                12,
            }}
          >
            <div
              style={{
                border:
                  '1.5px solid #16a34a',
                borderRadius:
                  9,
                padding: 9,
                textAlign:
                  'center',
              }}
            >
              <div
                style={{
                  color:
                    '#15803d',
                  fontWeight:
                    800,
                }}
              >
                إجمالي الدخل
              </div>

              <div
                style={{
                  fontSize:
                    21,
                  fontWeight:
                    900,
                  color:
                    '#15803d',
                  marginTop:
                    5,
                }}
              >
                {totals.income.toLocaleString(
                  'en-US'
                )}
              </div>

              <small
