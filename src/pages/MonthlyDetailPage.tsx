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

export function MonthlyDetailPage() {
  const { id } = useParams<{ id: string }>();

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

  useEffect(() => {
    let cancelled = false;

    async function loadEquipment() {
      setEquipmentLoading(true);

      try {
        const list = await fetchEquipment();

        if (cancelled) return;

        setEquipmentList(list);

        if (
          id &&
          list.some(
            (item) =>
              String(item.id) === String(id)
          )
        ) {
          setEquipmentId(String(id));
        } else if (list.length > 0) {
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
    formatEquipmentName(equipmentName);

  const daysInMonth =
    useMemo(() => {
      return new Date(
        year,
        month + 1,
        0
      ).getDate();
    }, [year, month]);

  const storageKey =
    equipmentId
      ? `monthly-ledger-v3-${equipmentId}-${year}-${month}`
      : `monthly-ledger-v3-no-equipment-${year}-${month}`;

  function createEmptyRows(): DayRow[] {
    return Array.from(
      { length: daysInMonth },
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
    useState<DayRow[]>(createEmptyRows());

  useEffect(() => {
    setRowsLoaded(false);

    if (!equipmentId) {
      setRows(createEmptyRows());
      setRowsLoaded(true);
      return;
    }

    try {
      const saved =
        localStorage.getItem(storageKey);

      if (!saved) {
        setRows(createEmptyRows());
        setRowsLoaded(true);
        return;
      }

      const parsed =
        JSON.parse(saved) as DayRow[];

      const prepared =
        createEmptyRows().map((row) => {
          const found = parsed.find(
            (item) => item.day === row.day
          );

          return found
            ? { ...row, ...found }
            : row;
        });

      setRows(prepared);
    } catch (error) {
      console.error(
        'تعذر قراءة الحساب الشهري:',
        error
      );

      setRows(createEmptyRows());
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

  useEffect(() => {
    if (!equipmentId || !rowsLoaded) {
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

      const parsed = JSON.parse(raw);

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
        event.key === EXPENSE_STORAGE_KEY
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

  const monthlyExternalExpenses =
    useMemo(() => {
      if (!equipmentId) return [];

      return externalExpenses.filter(
        (expense) => {
          if (
            String(
              expense.equipmentId || ''
            ) !== String(equipmentId)
          ) {
            return false;
          }

          const date =
            getDateParts(expense.date);

          if (!date) return false;

          return (
            date.year === year &&
            date.month === month + 1
          );
        }
      );
    }, [
      externalExpenses,
      equipmentId,
      year,
      month,
    ]);

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
            getDateParts(expense.date);

          if (!date) return;

          const current =
            map.get(date.day) || [];

          current.push(expense);
          map.set(date.day, current);
        }
      );

      return map;
    }, [monthlyExternalExpenses]);

  function getDayExternalExpenses(
    day: number
  ) {
    return (
      externalExpensesByDay.get(day) || []
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
        (Number(expense.amount) || 0),
      0
    );
  }

  function getDayExternalCategories(
    day: number
  ) {
    const records =
      getDayExternalExpenses(day);

    return Array.from(
      new Set(
        records
          .map((expense) => expense.category)
          .filter(Boolean)
      )
    ).join(' + ');
  }

  function getDayExternalNotes(
    day: number
  ) {
    const records =
      getDayExternalExpenses(day);

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
      normalizeArabicNumbers(value);

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
              (expenseSum, expense) =>
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
            linkedExpenses.length > 0;

          if (hasWork) {
            sum.registeredDays += 1;
          }

          if (
            row.tripType.trim() ||
            row.tripPrice > 0
          ) {
            sum.trips += 1;
          }

          sum.income +=
            Number(row.tripPrice) || 0;

          sum.manualExpense +=
            Number(row.expenseAmount) || 0;

          sum.linkedExpense += linkedTotal;

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
    totals.income - totalExpense;

  const inputStyle:
    React.CSSProperties = {
    width: '100%',
    minWidth: 120,
    padding: '10px 8px',
    borderRadius: 10,
    border: '1px solid #26364f',
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
    border: '1px solid #1d2d47',
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
    justifyContent: 'center',
    gap: 6,
    color: '#ffffff',
  };

  /*
   * بيانات الجدول = 20px
   */
  const pdfCell:
    React.CSSProperties = {
    border: '1px solid #b8c6d8',
    padding: '4px 2px',
    height: 25,
    fontSize: 20,
    lineHeight: 1,
    fontWeight: 400,
    verticalAlign: 'middle',
  };

  /*
   * عناوين الجدول = 21px
   */
  function pdfHeaderCell(
    width: string
  ): React.CSSProperties {
    return {
      width,
      padding: '7px 2px',
      border: '1px solid #d1d5db',
      fontSize: 21,
      lineHeight: 1,
      fontWeight: 400,
      verticalAlign: 'middle',
    };
  }

  function getFileName() {
    const cleanEquipment =
      displayEquipmentName.replace(
        /[\\/:*?"<>|]/g,
        '-'
      );

    return (
      `BAKR-PRO-${cleanEquipment}-` +
      `${monthNames[month]}-${year}.pdf`
    );
  }

  async function blobToBase64(
    blob: Blob
  ): Promise<string> {
    return new Promise(
      (resolve, reject) => {
        const reader = new FileReader();

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

        reader.readAsDataURL(blob);
      }
    );
  }

  async function ensureHacenFont() {
    try {
      const response =
        await fetch(
          HACEN_FONT_URL,
          {
            cache: 'no-store',
          }
        );

      if (!response.ok) {
        throw new Error(
          'تعذر تحميل خط Hacen Egypt'
        );
      }

      const buffer =
        await response.arrayBuffer();

      const fontFace =
        new FontFace(
          HACEN_FONT_NAME,
          buffer,
          {
            style: 'normal',
            weight: '400',
          }
        );

      const loadedFont =
        await fontFace.load();

      document.fonts.add(loadedFont);

      await document.fonts.load(
        `400 30px "${HACEN_FONT_NAME}"`
      );

      await document.fonts.ready;
    } catch (error) {
      console.error(
        'Hacen Egypt font error:',
        error
      );
    }
  }

  /*
   * إنشاء PDF بنسبة أقرب إلى A4
   * بدون ضغط التقرير القديم بعرض 1000px.
   */
  async function createPdfBlob() {
    if (!reportRef.current) {
      throw new Error(
        'تعذر العثور على التقرير'
      );
    }

    await ensureHacenFont();

    await new Promise<void>((resolve) => {
      window.setTimeout(
        () => resolve(),
        300
      );
    });

    const report =
      reportRef.current;

    const canvas =
      await html2canvas(report, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,

        width: report.scrollWidth,
        height: report.scrollHeight,

        onclone: async (
          clonedDocument
        ) => {
          const clonedReport =
            clonedDocument.querySelector(
              '.monthly-pdf-report'
            ) as HTMLElement | null;

          if (clonedReport) {
            clonedReport.style.fontFamily =
              `"${HACEN_FONT_NAME}", Arial, Tahoma, sans-serif`;

            clonedReport.style.width =
              '794px';

            clonedReport.style.minHeight =
              '1123px';

            clonedReport.style.padding =
              '14px';
          }

          try {
            await clonedDocument.fonts.load(
              `400 30px "${HACEN_FONT_NAME}"`
            );

            await clonedDocument.fonts.ready;
          } catch (error) {
            console.error(
              'Clone font error:',
              error
            );
          }
        },
      });

    const imageData =
      canvas.toDataURL(
        'image/jpeg',
        0.98
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

    const margin = 3;

    const availableWidth =
      pageWidth - margin * 2;

    const availableHeight =
      pageHeight - margin * 2;

    const canvasRatio =
      canvas.width / canvas.height;

    const pageRatio =
      availableWidth /
      availableHeight;

    let imageWidth: number;
    let imageHeight: number;

    if (
      canvasRatio >
      pageRatio
    ) {
      imageWidth =
        availableWidth;

      imageHeight =
        imageWidth /
        canvasRatio;
    } else {
      imageHeight =
        availableHeight;

      imageWidth =
        imageHeight *
        canvasRatio;
    }

    const x =
      (pageWidth -
        imageWidth) /
      2;

    const y =
      (pageHeight -
        imageHeight) /
      2;

    pdf.addImage(
      imageData,
      'JPEG',
      x,
      y,
      imageWidth,
      imageHeight,
      undefined,
      'FAST'
    );

    return pdf.output('blob');
  }

  async function createPdfFile() {
    const blob =
      await createPdfBlob();

    const base64 =
      await blobToBase64(blob);

    const result =
      await Filesystem.writeFile({
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

      const fileUri =
        await createPdfFile();

      await Share.share({
        title:
          'حفظ الحساب الشهري',

        text:
          `${displayEquipmentName} - ` +
          `${monthNames[month]} ${year}`,

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

    window.open(
      `https://wa.me/?text=${encodeURIComponent(
        text
      )}`,
      '_blank'
    );
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

          .monthly-pdf-report,
          .monthly-pdf-report * {
            font-family:
              '${HACEN_FONT_NAME}',
              Arial,
              Tahoma,
              sans-serif !important;
          }

          .monthly-pdf-report .bakr-title {
            font-family:
              Arial,
              sans-serif !important;
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

        <div
          style={{
            background: '#0b1527',
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
                color: '#94a3b8',
              }}
            >
              المعدة
            </small>

            <select
              value={equipmentId}
              onChange={(e) =>
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
                      key={item.id}
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
              style={selectStyle}
            >
              {monthNames.map(
                (name, index) => (
                  <option
                    key={name}
                    value={index}
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
              style={selectStyle}
            >
              {Array.from(
                { length: 7 },
                (_, index) => {
                  const y =
                    now.getFullYear() -
                    2 +
                    index;

                  return (
                    <option
                      key={y}
                      value={y}
                    >
                      {y}
                    </option>
                  );
                }
              )}
            </select>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(2, 1fr)',
            gap: 10,
            marginBottom: 18,
          }}
        >
          <div style={summaryCard}>
            إجمالي المشاوير
            <h2>{totals.trips}</h2>
          </div>

          <div style={summaryCard}>
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

          <div style={summaryCard}>
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

          <div style={summaryCard}>
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

        <div
          style={{
            overflowX: 'auto',
            border:
              '1px solid #1d2d47',
            borderRadius: 18,
          }}
        >
          <table
            style={{
              width: '100%',
              minWidth: 1050,
              borderCollapse: 'collapse',
              textAlign: 'center',
            }}
          >
            <thead>
              <tr
                style={{
                  background: '#101b2e',
                }}
              >
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
                    key={row.day}
                    style={{
                      borderTop:
                        '1px solid #1d2d47',
                    }}
                  >
                    <td>{row.day}</td>

                    <td>
                      <input
                        value={row.workType}
                        onChange={(e) =>
                          updateTextRow(
                            row.day,
                            'workType',
                            e.target.value
                          )
                        }
                        style={inputStyle}
                      />
                    </td>

                    <td>
                      <input
                        value={row.tripType}
                        onChange={(e) =>
                          updateTextRow(
                            row.day,
                            'tripType',
                            e.target.value
                          )
                        }
                        style={inputStyle}
                      />
                    </td>

                    <td>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={
                          row.tripPrice || ''
                        }
                        onChange={(e) =>
                          updateNumberRow(
                            row.day,
                            'tripPrice',
                            e.target.value
                          )
                        }
                        style={inputStyle}
                      />
                    </td>

                    <td>
                      <div
                        style={{
                          display: 'grid',
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            gap: 5,
                          }}
                        >
                          <input
                            value={
                              row.expenseType
                            }
                            onChange={(e) =>
                              updateTextRow(
                                row.day,
                                'expenseType',
                                e.target.value
                              )
                            }
                            placeholder="مصروف يدوي"
                            style={inputStyle}
                          />

                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              row.expenseAmount ||
                              ''
                            }
                            onChange={(e) =>
                              updateNumberRow(
                                row.day,
                                'expenseAmount',
                                e.target.value
                              )
                            }
                            style={{
                              ...inputStyle,
                              minWidth: 80,
                            }}
                          />
                        </div>

                        {linked.length > 0 && (
                          <div
                            style={{
                              background:
                                'rgba(239,68,68,0.10)',
                              border:
                                '1px solid rgba(239,68,68,0.25)',
                              borderRadius: 10,
                              padding: '7px 8px',
                              textAlign: 'right',
                            }}
                          >
                            <div
                              style={{
                                fontSize: 10,
                                color: '#fca5a5',
                                fontWeight: 800,
                              }}
                            >
                              مصاريف السواقين والمعدات
                            </div>

                            {linked.map(
                              (expense) => (
                                <div
                                  key={
                                    expense.id
                                  }
                                  style={{
                                    marginTop: 4,
                                    fontSize: 10,
                                    color:
                                      '#e2e8f0',
                                  }}
                                >
                                  {expense.category ||
                                    'مصروف'}{' '}
                                  —{' '}
                                  {Number(
                                    expense.amount ||
                                      0
                                  ).toLocaleString(
                                    'en-US'
                                  )}{' '}
                                  ر.س
                                </div>
                              )
                            )}

                            <div
                              style={{
                                marginTop: 5,
                                fontSize: 11,
                                color: '#fb7185',
                                fontWeight: 900,
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
                        value={row.notes}
                        onChange={(e) =>
                          updateTextRow(
                            row.day,
                            'notes',
                            e.target.value
                          )
                        }
                        style={inputStyle}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

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
            onClick={handleSavePdf}
            disabled={creatingPdf}
            style={{
              ...buttonStyle,
              background: '#2563eb',
            }}
          >
            <Download size={18} />

            {creatingPdf
              ? 'جاري...'
              : 'حفظ PDF'}
          </button>

          <button
            onClick={handleShare}
            disabled={creatingPdf}
            style={{
              ...buttonStyle,
              background: '#7c3aed',
            }}
          >
            <Share2 size={18} />
            مشاركة
          </button>

          <button
            onClick={handleWhatsApp}
            style={{
              ...buttonStyle,
              background: '#16a34a',
            }}
          >
            <MessageCircle size={18} />
            واتساب
          </button>
        </div>

        {/* تقرير PDF */}
        <div
          ref={reportRef}
          className="monthly-pdf-report"
          dir="rtl"
          style={{
            position: 'fixed',
            left: '-10000px',
            top: 0,

            /*
             * عرض قريب من A4.
             */
            width: 794,
            minHeight: 1123,

            background: '#ffffff',
            color: '#111827',
            padding: 14,
            boxSizing: 'border-box',

            fontFamily:
              `"${HACEN_FONT_NAME}", Arial, Tahoma, sans-serif`,

            fontWeight: 400,
          }}
        >
          <div
            style={{
              textAlign: 'center',
              marginBottom: 10,
            }}
          >
            {/* BAKR PRO = 29 */}
            <div
              className="bakr-title"
              style={{
                fontSize: 29,
                lineHeight: 1,
                fontWeight: 900,
                color: '#0b3b82',
              }}
            >
              BAKR PRO
            </div>

            {/* كشف الحساب الشهري = 30 */}
            <div
              style={{
                fontSize: 30,
                lineHeight: 1.05,
                fontWeight: 400,
                color: '#102f61',
                marginTop: 6,
              }}
            >
              كشف الحساب الشهري
            </div>

            {/* السطر الصغير = 22 */}
            <div
              style={{
                fontSize: 22,
                lineHeight: 1.05,
                color: '#475569',
                marginTop: 4,
              }}
            >
              تقرير شامل للأعمال والمشاوير والمصاريف
            </div>
          </div>

          {/* المعدة / الشهر / السنة */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                '1.4fr 1fr 1fr',
              border:
                '1px solid #b8c6d8',
              borderRadius: 8,
              marginBottom: 8,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '7px 8px',
                textAlign: 'center',
                borderLeft:
                  '1px solid #d6dfeb',
              }}
            >
              <div
                style={{
                  color: '#0b3b82',
                  fontSize: 25,
                  fontWeight: 400,
                  lineHeight: 1,
                }}
              >
                المعدة
              </div>

              <div
                style={{
                  fontSize: 30,
                  lineHeight: 1,
                  fontWeight: 400,
                  marginTop: 3,
                }}
              >
                {displayEquipmentName}
              </div>
            </div>

            <div
              style={{
                padding: '7px 8px',
                textAlign: 'center',
                borderLeft:
                  '1px solid #d6dfeb',
              }}
            >
              <div
                style={{
                  color: '#0b3b82',
                  fontSize: 25,
                  fontWeight: 400,
                  lineHeight: 1,
                }}
              >
                الشهر
              </div>

              <div
                style={{
                  fontSize: 30,
                  lineHeight: 1,
                  fontWeight: 400,
                  marginTop: 3,
                }}
              >
                {monthNames[month]}
              </div>
            </div>

            <div
              style={{
                padding: '7px 8px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  color: '#0b3b82',
                  fontSize: 25,
                  fontWeight: 400,
                  lineHeight: 1,
                }}
              >
                السنة
              </div>

              <div
                style={{
                  fontSize: 30,
                  lineHeight: 1,
                  fontWeight: 400,
                  marginTop: 3,
                }}
              >
                {year}
              </div>
            </div>
          </div>

          {/* الجدول */}
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              fontSize: 20,
              textAlign: 'center',
            }}
          >
            <thead>
              <tr
                style={{
                  background: '#073b7a',
                  color: '#ffffff',
                }}
              >
                <th style={pdfHeaderCell('7%')}>
                  اليوم
                </th>

                <th style={pdfHeaderCell('15%')}>
                  نوع العمل
                </th>

                <th style={pdfHeaderCell('16%')}>
                  موقع العمل
                </th>

                <th style={pdfHeaderCell('14%')}>
                  سعر المشوار
                </th>

                <th style={pdfHeaderCell('18%')}>
                  بيان المصروف
                </th>

                <th style={pdfHeaderCell('13%')}>
                  المبلغ
                </th>

                <th style={pdfHeaderCell('17%')}>
                  ملاحظات
                </th>
              </tr>
            </thead>

            <tbody>
              {Array.from(
                { length: 31 },
                (_, index) => {
                  const day = index + 1;

                  const row =
                    rows.find(
                      (item) =>
                        item.day === day
                    ) || {
                      day,
                      workType: '',
                      tripType: '',
                      tripPrice: 0,
                      expenseType: '',
                      expenseAmount: 0,
                      notes: '',
                    };

                  const linkedTotal =
                    getDayExternalTotal(day);

                  const linkedCategories =
                    getDayExternalCategories(
                      day
                    );

                  const linkedNotes =
                    getDayExternalNotes(day);

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
                      .filter(Boolean)
                      .join(' + ');

                  const combinedNotes =
                    [
                      row.notes,
                      linkedNotes,
                    ]
                      .filter(Boolean)
                      .join(' | ');

                  return (
                    <tr key={day}>
                      {/* رقم اليوم = 20 */}
                      <td
                        style={{
                          ...pdfCell,
                          fontSize: 20,
                        }}
                      >
                        {day}
                      </td>

                      {/* البيانات = 20 */}
                      <td
                        style={{
                          ...pdfCell,
                          fontSize: 20,
                        }}
                      >
                        {row.workType}
                      </td>

                      <td
                        style={{
                          ...pdfCell,
                          fontSize: 20,
                        }}
                      >
                        {row.tripType}
                      </td>

                      <td
                        style={{
                          ...pdfCell,
                          fontSize: 20,
                        }}
                      >
                        {row.tripPrice > 0
                          ? `${row.tripPrice.toLocaleString(
                              'en-US'
                            )} ر.س`
                          : ''}
                      </td>

                      <td
                        style={{
                          ...pdfCell,
                          fontSize: 20,
                        }}
                      >
                        {expenseDescription}
                      </td>

                      <td
                        style={{
                          ...pdfCell,
                          fontSize: 20,
                          color:
                            combinedExpense > 0
                              ? '#dc2626'
                              : '#111827',
                        }}
                      >
                        {combinedExpense > 0
                          ? `${combinedExpense.toLocaleString(
                              'en-US'
                            )} ر.س`
                          : ''}
                      </td>

                      {/* الملاحظات = 20 */}
                      <td
                        style={{
                          ...pdfCell,
                          fontSize: 20,
                        }}
                      >
                        {combinedNotes}
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
              display: 'grid',
              gridTemplateColumns:
                'repeat(5, 1fr)',
              gap: 5,
              marginTop: 7,
            }}
          >
            <PdfSummary
              border="#16a34a"
              label="إجمالي الدخل"
              value={`${totals.income.toLocaleString(
                'en-US'
              )} ر.س`}
              valueColor="#15803d"
            />

            <PdfSummary
              border="#ef4444"
              label="إجمالي المصروفات"
              value={`${totalExpense.toLocaleString(
                'en-US'
              )} ر.س`}
              valueColor="#dc2626"
            />

            <PdfSummary
              border="#2563eb"
              label="صافي الشهر"
              value={`${net.toLocaleString(
                'en-US'
              )} ر.س`}
              valueColor={
                net >= 0
                  ? '#2563eb'
                  : '#dc2626'
              }
            />

            <PdfSummary
              border="#f59e0b"
              label="أيام مسجلة"
              value={String(
                totals.registeredDays
              )}
            />

            <PdfSummary
              border="#7c3aed"
              label="المشاوير"
              value={String(
                totals.trips
              )}
            />
          </div>

          {/* السطر الأحمر = 24 */}
          {totals.linkedExpense > 0 && (
            <div
              style={{
                marginTop: 6,
                border:
                  '1px solid #fecaca',
                borderRadius: 6,
                padding: 6,
                textAlign: 'center',
                background: '#fff1f2',
                color: '#dc2626',
                fontSize: 24,
                lineHeight: 1,
                fontWeight: 400,
              }}
            >
              مصاريف السواقين والمعدات:{' '}
              {totals.linkedExpense.toLocaleString(
                'en-US'
              )}{' '}
              ر.س
            </div>
          )}

          {/* السطر الأزرق = 20 */}
          <div
            style={{
              marginTop: 6,
              background: '#073b7a',
              color: '#ffffff',
              borderRadius: 4,
              padding: 6,
              textAlign: 'center',
              fontSize: 20,
              lineHeight: 1,
              fontWeight: 400,
            }}
          >
            تم إعداد هذا الكشف بواسطة BAKR PRO
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function PdfSummary({
  border,
  label,
  value,
  valueColor,
}: {
  border: string;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: 7,
        padding: '6px 3px',
        textAlign: 'center',
        minHeight: 57,
        boxSizing: 'border-box',
      }}
    >
      {/* عنوان المربع = 21 */}
      <div
        style={{
          fontSize: 21,
          lineHeight: 1,
          marginBottom: 4,
          fontWeight: 400,
        }}
      >
        {label}
      </div>

      {/* الرقم = 22 */}
      <strong
        style={{
          display: 'block',
          fontSize: 22,
          lineHeight: 1,
          color: valueColor,
          fontWeight: 400,
        }}
      >
        {value}
      </strong>
    </div>
  );
    }
