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

  const [year, setYear] = useState(
    now.getFullYear()
  );

  const [month, setMonth] = useState(
    now.getMonth()
  );

  const [
    creatingPdf,
    setCreatingPdf,
  ] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadEquipment() {
      setEquipmentLoading(true);

      try {
        const list =
          await fetchEquipment();

        if (cancelled) return;

        setEquipmentList(list);

        if (
          id &&
          list.some(
            (item) =>
              String(item.id) ===
              String(id)
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
    useState<DayRow[]>(
      createEmptyRows()
    );

  useEffect(() => {
    if (!equipmentId) {
      setRows(createEmptyRows());
      return;
    }

    try {
      const saved =
        localStorage.getItem(
          storageKey
        );

      if (!saved) {
        setRows(createEmptyRows());
        return;
      }

      const parsed =
        JSON.parse(saved) as DayRow[];

      const prepared =
        createEmptyRows().map(
          (row) => {
            const found =
              parsed.find(
                (item) =>
                  item.day === row.day
              );

            if (!found) return row;

            return {
              ...row,
              ...found,
            };
          }
        );

      setRows(prepared);
    } catch {
      setRows(createEmptyRows());
    }
  }, [
    equipmentId,
    year,
    month,
    daysInMonth,
    storageKey,
  ]);

  useEffect(() => {
    if (!equipmentId) return;

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(rows)
      );
    } catch {
      // تجاهل
    }
  }, [
    rows,
    storageKey,
    equipmentId,
  ]);

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

  const totals = useMemo(() => {
    return rows.reduce(
      (sum, row) => {
        const hasWork =
          row.workType.trim() ||
          row.tripType.trim() ||
          row.tripPrice > 0 ||
          row.expenseType.trim() ||
          row.expenseAmount > 0 ||
          row.notes.trim();

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
          row.tripPrice;

        sum.expense +=
          row.expenseAmount;

        return sum;
      },
      {
        trips: 0,
        income: 0,
        expense: 0,
        registeredDays: 0,
      }
    );
  }, [rows]);

  const activeRows =
    useMemo(() => {
      return rows.filter((row) => {
        return (
          row.workType.trim() ||
          row.tripType.trim() ||
          row.tripPrice > 0 ||
          row.expenseType.trim() ||
          row.expenseAmount > 0 ||
          row.notes.trim()
        );
      });
    }, [rows]);

  const net =
    totals.income -
    totals.expense;

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
    justifyContent: 'center',
    gap: 6,
    color: '#ffffff',
  };

  function getFileName() {
    const cleanEquipment =
      equipmentName.replace(
        /[\\/:*?"<>|]/g,
        '-'
      );

    return (
      `BAAKR-PRO-${cleanEquipment}-` +
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

        reader.readAsDataURL(blob);
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

    const pdf = new jsPDF(
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
      pageWidth - margin * 2;

    const imageHeight =
      (canvas.height *
        imageWidth) /
      canvas.width;

    const printableHeight =
      pageHeight - margin * 2;

    let position = margin;

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

    while (heightLeft > 0) {
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
        directory:
          Directory.Cache,
      });

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
      setCreatingPdf(true);

      const fileUri =
        await createPdfFile();

      await Share.share({
        title:
          'حفظ الحساب الشهري',
        text:
          `${equipmentName} - ${monthNames[month]} ${year}`,
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
      alert(
        'اختر المعدة أولاً'
      );
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
          `المعدة: ${equipmentName}\n` +
          `الشهر: ${monthNames[month]} ${year}\n` +
          `إجمالي الدخل: ${totals.income.toLocaleString('en-US')} ر.س\n` +
          `إجمالي المصروفات: ${totals.expense.toLocaleString('en-US')} ر.س\n` +
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
      alert(
        'اختر المعدة أولاً'
      );
      return;
    }

    const text =
      `📊 BAAKR PRO\n` +
      `الحساب الشهري\n\n` +
      `🏗️ المعدة: ${equipmentName}\n` +
      `📅 الشهر: ${monthNames[month]} ${year}\n\n` +
      `🚚 عدد المشاوير: ${totals.trips}\n` +
      `💰 إجمالي الدخل: ${totals.income.toLocaleString('en-US')} ر.س\n` +
      `💸 إجمالي المصروفات: ${totals.expense.toLocaleString('en-US')} ر.س\n` +
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
          {equipmentName}
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
                      key={item.id}
                      value={String(
                        item.id
                      )}
                    >
                      {item.name}
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
              {totals.expense.toLocaleString(
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
              borderCollapse:
                'collapse',
              textAlign: 'center',
            }}
          >
            <thead>
              <tr
                style={{
                  background:
                    '#101b2e',
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
              {rows.map((row) => (
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
                      value={
                        row.workType
                      }
                      onChange={(e) =>
                        updateTextRow(
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
                      value={
                        row.tripType
                      }
                      onChange={(e) =>
                        updateTextRow(
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
                      type="text"
                      inputMode="decimal"
                      value={
                        row.tripPrice ||
                        ''
                      }
                      onChange={(e) =>
                        updateNumberRow(
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
                          'flex',
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
                      style={
                        inputStyle
                      }
                    />
                  </td>
                </tr>
              ))}
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
            <Download size={18} />
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
            <Share2 size={18} />
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

        {/* تقرير PDF المخفي */}
        <div
          ref={reportRef}
          dir="rtl"
          style={{
            position: 'fixed',
            left: '-10000px',
            top: 0,
            width: 900,
            background: '#ffffff',
            color: '#111827',
            padding: 35,
            boxSizing: 'border-box',
            fontFamily:
              'Arial, sans-serif',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              borderBottom:
                '4px solid #1d4ed8',
              paddingBottom: 20,
              marginBottom: 25,
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: '#1d4ed8',
              }}
            >
              BAAKR PRO
            </div>

            <div
              style={{
                fontSize: 34,
                fontWeight: 900,
                marginTop: 8,
              }}
            >
              كشف الحساب الشهري
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                '1fr 1fr 1fr',
              gap: 12,
              marginBottom: 25,
            }}
          >
            {[
              [
                'المعدة',
                equipmentName,
              ],
              [
                'الشهر',
                monthNames[month],
              ],
              [
                'السنة',
                year,
              ],
            ].map(
              ([label, value]) => (
                <div
                  key={String(label)}
                  style={{
                    border:
                      '1px solid #d1d5db',
                    borderRadius: 10,
                    padding: 12,
                    textAlign:
                      'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      color:
                        '#6b7280',
                    }}
                  >
                    {label}
                  </div>

                  <div
                    style={{
                      fontSize: 19,
                      fontWeight: 800,
                      marginTop: 5,
                    }}
                  >
                    {value}
                  </div>
                </div>
              )
            )}
          </div>

          <table
            style={{
              width: '100%',
              borderCollapse:
                'collapse',
              fontSize: 14,
              textAlign: 'center',
            }}
          >
            <thead>
              <tr
                style={{
                  background:
                    '#1d4ed8',
                  color: '#ffffff',
                }}
              >
                {[
                  'اليوم',
                  'نوع الشغل',
                  'نوع المشاوير',
                  'سعر المشوار',
                  'المصروفات',
                  'ملاحظات',
                ].map((title) => (
                  <th
                    key={title}
                    style={{
                      padding:
                        '12px 7px',
                      border:
                        '1px solid #d1d5db',
                    }}
                  >
                    {title}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {activeRows.length >
              0 ? (
                activeRows.map(
                  (row) => (
                    <tr
                      key={row.day}
                    >
                      <td
                        style={{
                          padding: 10,
                          border:
                            '1px solid #d1d5db',
                          fontWeight:
                            800,
                        }}
                      >
                        {row.day}
                      </td>

                      <td
                        style={{
                          padding: 10,
                          border:
                            '1px solid #d1d5db',
                        }}
                      >
                        {row.workType ||
                          '-'}
                      </td>

                      <td
                        style={{
                          padding: 10,
                          border:
                            '1px solid #d1d5db',
                        }}
                      >
                        {row.tripType ||
                          '-'}
                      </td>

                      <td
                        style={{
                          padding: 10,
                          border:
                            '1px solid #d1d5db',
                        }}
                      >
                        {row.tripPrice
                          ? `${row.tripPrice.toLocaleString('en-US')} ر.س`
                          : '-'}
                      </td>

                      <td
                        style={{
                          padding: 10,
                          border:
                            '1px solid #d1d5db',
                        }}
                      >
                        {row.expenseType ||
                          '-'}
                        {row.expenseAmount >
                          0 &&
                          ` - ${row.expenseAmount.toLocaleString('en-US')} ر.س`}
                      </td>

                      <td
                        style={{
                          padding: 10,
                          border:
                            '1px solid #d1d5db',
                        }}
                      >
                        {row.notes ||
                          '-'}
                      </td>
                    </tr>
                  )
                )
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: 30,
                      border:
                        '1px solid #d1d5db',
                      color:
                        '#6b7280',
                    }}
                  >
                    لا توجد بيانات
                    مسجلة لهذا الشهر
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(4,1fr)',
              gap: 10,
              marginTop: 25,
            }}
          >
            <div
              style={{
                padding: 14,
                border:
                  '1px solid #d1d5db',
                borderRadius: 10,
                textAlign: 'center',
              }}
            >
              <small>
                المشاوير
              </small>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                }}
              >
                {totals.trips}
              </div>
            </div>

            <div
              style={{
                padding: 14,
                border:
                  '1px solid #d1d5db',
                borderRadius: 10,
                textAlign: 'center',
              }}
            >
              <small>
                إجمالي الدخل
              </small>
              <div
                style={{
                  fontSize: 19,
                  fontWeight: 900,
                  color: '#15803d',
                }}
              >
                {totals.income.toLocaleString(
                  'en-US'
                )}{' '}
                ر.س
              </div>
            </div>

            <div
              style={{
                padding: 14,
                border:
                  '1px solid #d1d5db',
                borderRadius: 10,
                textAlign: 'center',
              }}
            >
              <small>
                المصروفات
              </small>
              <div
                style={{
                  fontSize: 19,
                  fontWeight: 900,
                  color: '#dc2626',
                }}
              >
                {totals.expense.toLocaleString(
                  'en-US'
                )}{' '}
                ر.س
              </div>
            </div>

            <div
              style={{
                padding: 14,
                border:
                  '2px solid #1d4ed8',
                borderRadius: 10,
                textAlign: 'center',
              }}
            >
              <small>
                صافي الشهر
              </small>
              <div
                style={{
                  fontSize: 19,
                  fontWeight: 900,
                  color:
                    net >= 0
                      ? '#1d4ed8'
                      : '#dc2626',
                }}
              >
                {net.toLocaleString(
                  'en-US'
                )}{' '}
                ر.س
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 30,
              textAlign: 'center',
              fontSize: 12,
              color: '#9ca3af',
            }}
          >
            تم إنشاء كشف الحساب بواسطة
            BAAKR PRO
          </div>
        </div>
      </div>
    </AppLayout>
  );
                   }
