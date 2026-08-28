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
import { Filesystem, Directory } from '@capacitor/filesystem';
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

  const reportRef = useRef<HTMLDivElement>(null);

  const [equipmentList, setEquipmentList] =
    useState<Equipment[]>([]);

  const [equipmentId, setEquipmentId] =
    useState(id || '');

  const [equipmentLoading, setEquipmentLoading] =
    useState(true);

  const [year, setYear] =
    useState(now.getFullYear());

  const [month, setMonth] =
    useState(now.getMonth());

  const [creatingPdf, setCreatingPdf] =
    useState(false);

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

  const selectedEquipment = useMemo(() => {
    return (
      equipmentList.find(
        (item) =>
          String(item.id) ===
          String(equipmentId)
      ) || null
    );
  }, [equipmentList, equipmentId]);

  const equipmentName =
    selectedEquipment?.name ||
    'لا توجد معدة محددة';

  const daysInMonth = useMemo(() => {
    return new Date(
      year,
      month + 1,
      0
    ).getDate();
  }, [year, month]);

  const storageKey = equipmentId
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
    if (!equipmentId) {
      setRows(createEmptyRows());
      return;
    }

    try {
      const saved =
        localStorage.getItem(storageKey);

      if (!saved) {
        setRows(createEmptyRows());
        return;
      }

      const parsed =
        JSON.parse(saved) as DayRow[];

      const prepared =
        createEmptyRows().map((row) => {
          const found = parsed.find(
            (item) =>
              item.day === row.day
          );

          if (!found) return row;

          return {
            ...row,
            ...found,
          };
        });

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
      // تجاهل خطأ الحفظ
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
                Number.isFinite(numberValue)
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

        sum.income += row.tripPrice;
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

  const net =
    totals.income - totals.expense;

  const inputStyle: React.CSSProperties =
    {
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

  const selectStyle: React.CSSProperties =
    {
      ...inputStyle,
      minWidth: 0,
      padding: 12,
    };

  const summaryCard: React.CSSProperties =
    {
      background: '#0b1527',
      border:
        '1px solid #1d2d47',
      borderRadius: 16,
      padding: 14,
      textAlign: 'center',
    };

  const buttonStyle: React.CSSProperties =
    {
      border: 'none',
      borderRadius: 14,
      padding: '14px 12px',
      fontSize: 15,
      fontWeight: 800,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      color: '#ffffff',
    };

  function getFileName() {
    const cleanEquipment =
      equipmentName.replace(
        /[\\/:*?"<>|]/g,
        '-'
      );

    return `حساب-${cleanEquipment}-${monthNames[month]}-${year}.pdf`;
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
          scale: 2,
          useCORS: true,
          backgroundColor: '#07111f',
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

    const margin = 6;

    const imageWidth =
      pageWidth - margin * 2;

    const imageHeight =
      (canvas.height *
        imageWidth) /
      canvas.width;

    let heightLeft = imageHeight;
    let position = margin;

    pdf.addImage(
      imageData,
      'JPEG',
      margin,
      position,
      imageWidth,
      imageHeight
    );

    heightLeft -=
      pageHeight - margin * 2;

    while (heightLeft > 0) {
      position =
        heightLeft -
        imageHeight +
        margin;

      pdf.addPage();

      pdf.addImage(
        imageData,
        'JPEG',
        margin,
        position,
        imageWidth,
        imageHeight
      );

      heightLeft -=
        pageHeight - margin * 2;
    }

    return pdf.output('blob');
  }

  async function handleSavePdf() {
  if (!equipmentId) {
    alert('اختر المعدة أولاً');
    return;
  }

  try {
    setCreatingPdf(true);

    const blob = await createPdfBlob();

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = () => {
        const result = reader.result as string;

        const data = result.includes(',')
          ? result.split(',')[1]
          : result;

        resolve(data);
      };

      reader.onerror = () => {
        reject(new Error('تعذر قراءة ملف PDF'));
      };

      reader.readAsDataURL(blob);
    });

    const fileName = getFileName();

    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    });

    await Share.share({
      title: 'الحساب الشهري',
      text: `${equipmentName} - ${monthNames[month]} ${year}`,
      url: result.uri,
      dialogTitle: 'حفظ أو مشاركة كشف الحساب',
    });
  } catch (error) {
    console.error('PDF ERROR:', error);

    alert('تعذر إنشاء أو حفظ ملف PDF');
  } finally {
    setCreatingPdf(false);
  }
}
    if (!equipmentId) {
      alert(
        'اختر المعدة أولاً'
      );
      return;
    }

    try {
      setCreatingPdf(true);

      const blob =
        await createPdfBlob();

      const file = new File(
        [blob],
        getFileName(),
        {
          type: 'application/pdf',
        }
      );

      const shareData = {
        title: 'الحساب الشهري',
        text:
          `الحساب الشهري\n` +
          `${equipmentName}\n` +
          `${monthNames[month]} ${year}`,
        files: [file],
      };

      const nav =
        navigator as Navigator & {
          canShare?: (
            data?: ShareData
          ) => boolean;
        };

      if (
        navigator.share &&
        (!nav.canShare ||
          nav.canShare(shareData))
      ) {
        await navigator.share(
          shareData
        );
        return;
      }

      const text =
        `الحساب الشهري\n` +
        `المعدة: ${equipmentName}\n` +
        `الشهر: ${monthNames[month]} ${year}\n` +
        `إجمالي الدخل: ${totals.income.toLocaleString('en-US')} ر.س\n` +
        `إجمالي المصروفات: ${totals.expense.toLocaleString('en-US')} ر.س\n` +
        `صافي الشهر: ${net.toLocaleString('en-US')} ر.س`;

      if (navigator.share) {
        await navigator.share({
          title:
            'الحساب الشهري',
          text,
        });
      } else {
        await navigator.clipboard.writeText(
          text
        );

        alert(
          'تم نسخ ملخص الحساب'
        );
      }
    } catch (error) {
      const maybeError =
        error as Error;

      if (
        maybeError?.name !==
        'AbortError'
      ) {
        console.error(error);

        alert(
          'تعذر فتح المشاركة'
        );
      }
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
      `📊 الحساب الشهري\n\n` +
      `🏗️ المعدة: ${equipmentName}\n` +
      `📅 الشهر: ${monthNames[month]} ${year}\n\n` +
      `🚚 عدد المشاوير: ${totals.trips}\n` +
      `💰 إجمالي الدخل: ${totals.income.toLocaleString('en-US')} ر.س\n` +
      `💸 إجمالي المصروفات: ${totals.expense.toLocaleString('en-US')} ر.س\n` +
      `✅ صافي الشهر: ${net.toLocaleString('en-US')} ر.س\n` +
      `📝 أيام مسجلة: ${totals.registeredDays}`;

    const url =
      `https://wa.me/?text=${encodeURIComponent(
        text
      )}`;

    window.open(
      url,
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
        <div ref={reportRef}>
          <div
            style={{
              marginBottom: 20,
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
                fontSize: 14,
              }}
            >
              سجل أعمال ومشاوير ومصاريف{' '}
              {equipmentName}
            </p>
          </div>

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
                    لا توجد معدات — أضف معدة
                    أولاً
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
              <label>
                <small
                  style={{
                    color: '#94a3b8',
                  }}
                >
                  الشهر
                </small>

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
              </label>

              <label>
                <small
                  style={{
                    color: '#94a3b8',
                  }}
                >
                  السنة
                </small>

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
              </label>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(2, minmax(0, 1fr))',
              gap: 10,
              marginBottom: 10,
            }}
          >
            <div style={summaryCard}>
              <small
                style={{
                  color: '#94a3b8',
                }}
              >
                إجمالي المشاوير
              </small>

              <h2
                style={{
                  marginBottom: 0,
                  color: '#f5a623',
                }}
              >
                {totals.trips}
              </h2>
            </div>

            <div style={summaryCard}>
              <small
                style={{
                  color: '#94a3b8',
                }}
              >
                إجمالي الدخل
              </small>

              <h2
                style={{
                  marginBottom: 0,
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
              <small
                style={{
                  color: '#94a3b8',
                }}
              >
                إجمالي المصروفات
              </small>

              <h2
                style={{
                  marginBottom: 0,
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
              <small
                style={{
                  color: '#94a3b8',
                }}
              >
                صافي الشهر
              </small>

              <h2
                style={{
                  marginBottom: 0,
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
              ...summaryCard,
              marginBottom: 18,
            }}
          >
            <small
              style={{
                color: '#94a3b8',
              }}
            >
              أيام مسجلة
            </small>

            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                marginTop: 5,
                color: '#a78bfa',
              }}
            >
              {totals.registeredDays}
            </div>
          </div>

          <div
            style={{
              marginBottom: 12,
              fontWeight: 800,
              fontSize: 18,
            }}
          >
            {equipmentName} —{' '}
            {monthNames[month]} {year}
          </div>

          <div
            style={{
              overflowX: 'auto',
              borderRadius: 18,
              border:
                '1px solid #1d2d47',
              background: '#07111f',
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
                  <th
                    style={{
                      padding: 13,
                    }}
                  >
                    اليوم
                  </th>

                  <th
                    style={{
                      padding: 13,
                    }}
                  >
                    نوع الشغل
                  </th>

                  <th
                    style={{
                      padding: 13,
                    }}
                  >
                    نوع المشاوير
                  </th>

                  <th
                    style={{
                      padding: 13,
                    }}
                  >
                    سعر المشوار
                  </th>

                  <th
                    style={{
                      padding: 13,
                    }}
                  >
                    مصاريف أخرى
                  </th>

                  <th
                    style={{
                      padding: 13,
                    }}
                  >
                    ملاحظات
                  </th>
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
                    <td
                      style={{
                        padding: 11,
                        fontWeight: 800,
                        color:
                          '#f5a623',
                      }}
                    >
                      {row.day}
                    </td>

                    <td
                      style={{
                        padding: 6,
                      }}
                    >
                      <input
                        type="text"
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
                        placeholder="مثال: رفع معدات"
                        disabled={
                          !equipmentId
                        }
                      />
                    </td>

                    <td
                      style={{
                        padding: 6,
                      }}
                    >
                      <input
                        type="text"
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
                        placeholder="مثال: خميس - أبها"
                        disabled={
                          !equipmentId
                        }
                      />
                    </td>

                    <td
                      style={{
                        padding: 6,
                      }}
                    >
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
                        placeholder="0"
                        disabled={
                          !equipmentId
                        }
                      />
                    </td>

                    <td
                      style={{
                        padding: 6,
                      }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            '1.3fr 0.8fr',
                          gap: 5,
                          minWidth: 240,
                        }}
                      >
                        <input
                          type="text"
                          value={
                            row.expenseType
                          }
                          onChange={(e) =>
                            updateTextRow(
                              row.day,
                              'expenseType',
                              e.target
                                .value
                            )
                          }
                          style={{
                            ...inputStyle,
                            minWidth: 130,
                          }}
                          placeholder="ديزل / صيانة"
                          disabled={
                            !equipmentId
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
                              e.target
                                .value
                            )
                          }
                          style={{
                            ...inputStyle,
                            minWidth: 90,
                          }}
                          placeholder="المبلغ"
                          disabled={
                            !equipmentId
                          }
                        />
                      </div>
                    </td>

                    <td
                      style={{
                        padding: 6,
                      }}
                    >
                      <input
                        type="text"
                        value={row.notes}
                        onChange={(e) =>
                          updateTextRow(
                            row.day,
                            'notes',
                            e.target.value
                          )
                        }
                        style={{
                          ...inputStyle,
                          minWidth: 170,
                        }}
                        placeholder="اكتب ملاحظة"
                        disabled={
                          !equipmentId
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
              padding: 16,
              borderRadius: 18,
              background: '#0b1527',
              border:
                '1px solid #1d2d47',
            }}
          >
            <strong
              style={{
                fontSize: 17,
              }}
            >
              ملخص الشهر
            </strong>

            <div
              style={{
                marginTop: 10,
                lineHeight: 2.1,
              }}
            >
              <div>
                عدد المشاوير:{' '}
                <b>{totals.trips}</b>
              </div>

              <div>
                إجمالي الدخل:{' '}
                <b
                  style={{
                    color:
                      '#22c55e',
                  }}
                >
                  {totals.income.toLocaleString(
                    'en-US'
                  )}{' '}
                  ر.س
                </b>
              </div>

              <div>
                إجمالي المصروفات:{' '}
                <b
                  style={{
                    color:
                      '#ef4444',
                  }}
                >
                  {totals.expense.toLocaleString(
                    'en-US'
                  )}{' '}
                  ر.س
                </b>
              </div>

              <div>
                صافي الشهر:{' '}
                <b
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
                </b>
              </div>

              <div>
                أيام مسجلة:{' '}
                <b
                  style={{
                    color:
                      '#a78bfa',
                  }}
                >
                  {
                    totals.registeredDays
                  }
                </b>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            display: 'grid',
            gridTemplateColumns:
              'repeat(3, 1fr)',
            gap: 8,
          }}
        >
          <button
            onClick={handleSavePdf}
            disabled={creatingPdf}
            style={{
              ...buttonStyle,
              background: '#2563eb',
              opacity:
                creatingPdf
                  ? 0.6
                  : 1,
            }}
          >
            <Download size={19} />
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
              opacity:
                creatingPdf
                  ? 0.6
                  : 1,
            }}
          >
            <Share2 size={19} />
            مشاركة
          </button>

          <button
            onClick={handleWhatsApp}
            style={{
              ...buttonStyle,
              background: '#16a34a',
            }}
          >
            <MessageCircle
              size={19}
            />
            واتساب
          </button>
        </div>

        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 14,
            background:
              'rgba(34, 197, 94, 0.08)',
            border:
              '1px solid rgba(34, 197, 94, 0.20)',
            color: '#86efac',
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          ✓ يتم حفظ البيانات تلقائيًا على
          الجهاز
        </div>
      </div>
    </AppLayout>
  );
            }
