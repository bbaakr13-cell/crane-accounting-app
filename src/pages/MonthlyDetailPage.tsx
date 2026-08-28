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

        {/* تقرير PDF الاحترافي */}
<div
  ref={reportRef}
  dir="rtl"
  style={{
    position: 'fixed',
    left: '-10000px',
    top: 0,
    width: 1000,
    height: 1414,
    background: '#ffffff',
    color: '#111827',
    padding: '18px',
    boxSizing: 'border-box',
    fontFamily: 'Arial, Tahoma, sans-serif',
  }}
>
  {/* رأس الكشف */}
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '220px 1fr 245px',
      alignItems: 'center',
      gap: 18,
      marginBottom: 14,
    }}
  >
    {/* الشعار */}
    <div
      style={{
        textAlign: 'center',
        color: '#0b3b82',
      }}
    >
      <div
        style={{
          width: 90,
          height: 90,
          margin: '0 auto 5px',
          borderRadius: '50%',
          border: '8px solid #0b3b82',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 42,
          fontWeight: 900,
        }}
      >
        🏗️
      </div>

      <div
        style={{
          fontSize: 24,
          fontWeight: 900,
        }}
      >
        BAAKR PRO
      </div>

      <div
        style={{
          fontSize: 12,
          color: '#334155',
          marginTop: 3,
        }}
      >
        إدارة معدات النقل والمشاريع
      </div>
    </div>

    {/* العنوان */}
    <div
      style={{
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 40,
          fontWeight: 900,
          color: '#0b3b82',
          letterSpacing: 1,
        }}
      >
        BAAKR PRO
      </div>

      <div
        style={{
          fontSize: 37,
          fontWeight: 900,
          color: '#102f61',
          marginTop: 6,
        }}
      >
        كشف الحساب الشهري
      </div>

      <div
        style={{
          width: '72%',
          height: 3,
          background: '#0b3b82',
          margin: '10px auto',
        }}
      />

      <div
        style={{
          fontSize: 15,
          color: '#334155',
        }}
      >
        تقرير شامل للأعمال والمشاوير والمصاريف
      </div>
    </div>

    {/* بيانات الكشف */}
    <div
      style={{
        border: '1px solid #cbd5e1',
        borderRadius: 10,
        padding: 12,
        fontSize: 13,
        lineHeight: 2.1,
      }}
    >
      <div>
        <b>رقم الكشف:</b>{' '}
        {`${year}${String(month + 1).padStart(2, '0')}`}
      </div>

      <div>
        <b>تاريخ الإصدار:</b>{' '}
        {new Date().toLocaleDateString('en-GB')}
      </div>

      <div>
        <b>وقت الإصدار:</b>{' '}
        {new Date().toLocaleTimeString('ar-SA', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>

      <div>
        <b>إصدار بواسطة:</b> BAAKR PRO
      </div>
    </div>
  </div>

  {/* المعدة والشهر والسنة */}
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '1.4fr 1fr 1fr',
      border: '1px solid #cbd5e1',
      borderRadius: 10,
      marginBottom: 12,
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        padding: 12,
        textAlign: 'center',
        borderLeft: '1px solid #e2e8f0',
      }}
    >
      <div
        style={{
          color: '#0b3b82',
          fontWeight: 800,
          fontSize: 14,
        }}
      >
        المعدة
      </div>

      <div
        style={{
          fontSize: 19,
          fontWeight: 900,
          marginTop: 4,
        }}
      >
        {equipmentName}
      </div>
    </div>

    <div
      style={{
        padding: 12,
        textAlign: 'center',
        borderLeft: '1px solid #e2e8f0',
      }}
    >
      <div
        style={{
          color: '#0b3b82',
          fontWeight: 800,
          fontSize: 14,
        }}
      >
        الشهر
      </div>

      <div
        style={{
          fontSize: 19,
          fontWeight: 900,
          marginTop: 4,
        }}
      >
        {monthNames[month]}
      </div>
    </div>

    <div
      style={{
        padding: 12,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          color: '#0b3b82',
          fontWeight: 800,
          fontSize: 14,
        }}
      >
        السنة
      </div>

      <div
        style={{
          fontSize: 19,
          fontWeight: 900,
          marginTop: 4,
        }}
      >
        {year}
      </div>
    </div>
  </div>

  {/* جدول الأيام */}
  <table
    style={{
      width: '100%',
      borderCollapse: 'collapse',
      tableLayout: 'fixed',
      fontSize: 11,
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
        <th
          style={{
            width: '6%',
            padding: '8px 3px',
            border: '1px solid #d1d5db',
          }}
        >
          اليوم
        </th>

        <th
          style={{
            width: '17%',
            padding: '8px 3px',
            border: '1px solid #d1d5db',
          }}
        >
          نوع العمل
        </th>

        <th
          style={{
            width: '18%',
            padding: '8px 3px',
            border: '1px solid #d1d5db',
          }}
        >
          موقع العمل
        </th>

        <th
          style={{
            width: '14%',
            padding: '8px 3px',
            border: '1px solid #d1d5db',
          }}
        >
          سعر المشوار
        </th>

        <th
          style={{
            width: '14%',
            padding: '8px 3px',
            border: '1px solid #d1d5db',
          }}
        >
          بيان المصروف
        </th>

        <th
          style={{
            width: '12%',
            padding: '8px 3px',
            border: '1px solid #d1d5db',
          }}
        >
          المبلغ
        </th>

        <th
          style={{
            width: '19%',
            padding: '8px 3px',
            border: '1px solid #d1d5db',
          }}
        >
          ملاحظات
        </th>
      </tr>
    </thead>

    <tbody>
      {Array.from({ length: 31 }, (_, index) => {
        const day = index + 1;

        const row =
          rows.find((item) => item.day === day) || {
            day,
            workType: '',
            tripType: '',
            tripPrice: 0,
            expenseType: '',
            expenseAmount: 0,
            notes: '',
          };

        return (
          <tr key={day}>
            <td
              style={{
                height: 25,
                padding: '2px 3px',
                border: '1px solid #d1d5db',
                fontWeight: 900,
                fontSize: 12,
              }}
            >
              {day}
            </td>

            <td
              style={{
                padding: '2px 4px',
                border: '1px solid #d1d5db',
              }}
            >
              {row.workType || ''}
            </td>

            <td
              style={{
                padding: '2px 4px',
                border: '1px solid #d1d5db',
              }}
            >
              {row.tripType || ''}
            </td>

            <td
              style={{
                padding: '2px 4px',
                border: '1px solid #d1d5db',
                fontWeight: row.tripPrice ? 700 : 400,
              }}
            >
              {row.tripPrice > 0
                ? `${row.tripPrice.toLocaleString('en-US')} ر.س`
                : ''}
            </td>

            <td
              style={{
                padding: '2px 4px',
                border: '1px solid #d1d5db',
              }}
            >
              {row.expenseType || ''}
            </td>

            <td
              style={{
                padding: '2px 4px',
                border: '1px solid #d1d5db',
              }}
            >
              {row.expenseAmount > 0
                ? `${row.expenseAmount.toLocaleString('en-US')} ر.س`
                : ''}
            </td>

            <td
              style={{
                padding: '2px 4px',
                border: '1px solid #d1d5db',
              }}
            >
              {row.notes || ''}
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>

  {/* الملخص */}
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: 8,
      marginTop: 12,
    }}
  >
    <div
      style={{
        border: '1.5px solid #16a34a',
        borderRadius: 9,
        padding: 9,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          color: '#15803d',
          fontWeight: 800,
        }}
      >
        إجمالي الدخل
      </div>

      <div
        style={{
          fontSize: 21,
          fontWeight: 900,
          color: '#15803d',
          marginTop: 5,
        }}
      >
        {totals.income.toLocaleString('en-US')}
      </div>

      <small>ر.س</small>
    </div>

    <div
      style={{
        border: '1.5px solid #ef4444',
        borderRadius: 9,
        padding: 9,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          color: '#dc2626',
          fontWeight: 800,
        }}
      >
        إجمالي المصروفات
      </div>

      <div
        style={{
          fontSize: 21,
          fontWeight: 900,
          color: '#dc2626',
          marginTop: 5,
        }}
      >
        {totals.expense.toLocaleString('en-US')}
      </div>

      <small>ر.س</small>
    </div>

    <div
      style={{
        border: '1.5px solid #2563eb',
        borderRadius: 9,
        padding: 9,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          color: '#1d4ed8',
          fontWeight: 800,
        }}
      >
        صافي الشهر
      </div>

      <div
        style={{
          fontSize: 21,
          fontWeight: 900,
          color:
            net >= 0
              ? '#1d4ed8'
              : '#dc2626',
          marginTop: 5,
        }}
      >
        {net.toLocaleString('en-US')}
      </div>

      <small>ر.س</small>
    </div>

    <div
      style={{
        border: '1.5px solid #f59e0b',
        borderRadius: 9,
        padding: 9,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          color: '#b45309',
          fontWeight: 800,
        }}
      >
        أيام مسجلة
      </div>

      <div
        style={{
          fontSize: 21,
          fontWeight: 900,
          color: '#b45309',
          marginTop: 5,
        }}
      >
        {totals.registeredDays}
      </div>

      <small>يوم</small>
    </div>

    <div
      style={{
        border: '1.5px solid #7c3aed',
        borderRadius: 9,
        padding: 9,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          color: '#6d28d9',
          fontWeight: 800,
        }}
      >
        إجمالي المشاوير
      </div>

      <div
        style={{
          fontSize: 21,
          fontWeight: 900,
          color: '#6d28d9',
          marginTop: 5,
        }}
      >
        {totals.trips}
      </div>

      <small>مشاوير</small>
    </div>
  </div>

  {/* الملاحظات والاعتماد */}
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '1fr 180px 1fr',
      gap: 10,
      marginTop: 12,
    }}
  >
    <div
      style={{
        border: '1px solid #cbd5e1',
        borderRadius: 9,
        padding: 10,
        minHeight: 80,
      }}
    >
      <div
        style={{
          fontWeight: 900,
          textAlign: 'center',
          marginBottom: 8,
          color: '#102f61',
        }}
      >
        ملاحظات عامة
      </div>

      <div
        style={{
          borderBottom: '1px dotted #94a3b8',
          height: 20,
        }}
      />

      <div
        style={{
          borderBottom: '1px dotted #94a3b8',
          height: 20,
        }}
      />
    </div>

    <div
      style={{
        border: '1px solid #cbd5e1',
        borderRadius: 9,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#0b3b82',
      }}
    >
      <div
        style={{
          fontSize: 30,
        }}
      >
        ▦
      </div>

      <strong>
        BAAKR PRO
      </strong>
    </div>

    <div
      style={{
        border: '1px solid #cbd5e1',
        borderRadius: 9,
        padding: 10,
        minHeight: 80,
      }}
    >
      <div
        style={{
          fontWeight: 900,
          textAlign: 'center',
          marginBottom: 10,
          color: '#102f61',
        }}
      >
        اعتماد
      </div>

      <div
        style={{
          marginBottom: 14,
        }}
      >
        الاسم:
        ______________________
      </div>

      <div>
        التوقيع:
        ____________________
      </div>
    </div>
  </div>

  {/* التذييل */}
  <div
    style={{
      position: 'absolute',
      bottom: 8,
      right: 18,
      left: 18,
      height: 28,
      background: '#073b7a',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 12,
      fontWeight: 700,
      borderRadius: '3px 3px 0 0',
    }}
  >
    ◆　تم إعداد هذا الكشف بواسطة BAAKR PRO　◆
  </div>
</div>
