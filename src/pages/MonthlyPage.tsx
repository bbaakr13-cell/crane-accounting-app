import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useParams } from 'react-router-dom';

import { AppLayout } from '@/components/layout/AppLayout';

import {
  fetchEquipment,
  type Equipment,
} from '@/lib/equipment';

type DayRow = {
  day: number;
  workType: string;
  trips: number;
  income: number;
  expense: number;
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

function todayValue() {
  const date = new Date();

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function createEmptyRows(
  year: number,
  month: number
): DayRow[] {
  const days =
    new Date(
      year,
      month + 1,
      0
    ).getDate();

  return Array.from(
    { length: days },
    (_, index) => ({
      day: index + 1,
      workType: '',
      trips: 0,
      income: 0,
      expense: 0,
      notes: '',
    })
  );
}

function getMonthlyStorageKey(
  equipmentId: string,
  year: number,
  month: number
) {
  return `monthly-ledger-equipment-${equipmentId}-${year}-${month}`;
}

export function MonthlyPage() {
  const { id } =
    useParams<{ id: string }>();

  const now = new Date();

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
    useState(
      now.getFullYear()
    );

  const [month, setMonth] =
    useState(
      now.getMonth()
    );

  /* =========================
     التسجيل السريع
  ========================= */

  const [
    quickDate,
    setQuickDate,
  ] = useState(
    todayValue()
  );

  const [
    quickEquipmentId,
    setQuickEquipmentId,
  ] = useState('');

  const [
    quickWorkType,
    setQuickWorkType,
  ] = useState('مشوار');

  const [
    quickTrips,
    setQuickTrips,
  ] = useState('');

  const [
    quickIncome,
    setQuickIncome,
  ] = useState('');

  const [
    quickExpense,
    setQuickExpense,
  ] = useState('');

  const [
    quickNotes,
    setQuickNotes,
  ] = useState('');

  const [
    quickMessage,
    setQuickMessage,
  ] = useState('');

  const [
    quickError,
    setQuickError,
  ] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadEquipment() {
      setEquipmentLoading(
        true
      );

      try {
        const list =
          await fetchEquipment();

        if (cancelled) return;

        setEquipmentList(
          list
        );

        if (
          id &&
          list.some(
            (item) =>
              String(
                item.id
              ) ===
              String(id)
          )
        ) {
          setEquipmentId(
            String(id)
          );

          setQuickEquipmentId(
            String(id)
          );
        } else if (
          list.length > 0
        ) {
          const firstId =
            String(
              list[0].id
            );

          setEquipmentId(
            firstId
          );

          setQuickEquipmentId(
            firstId
          );
        } else {
          setEquipmentId(
            ''
          );

          setQuickEquipmentId(
            ''
          );
        }
      } catch (error) {
        console.error(
          'تعذر تحميل المعدات:',
          error
        );

        if (!cancelled) {
          setEquipmentList(
            []
          );

          setEquipmentId(
            ''
          );

          setQuickEquipmentId(
            ''
          );
        }
      } finally {
        if (!cancelled) {
          setEquipmentLoading(
            false
          );
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
            String(
              item.id
            ) ===
            String(
              equipmentId
            )
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
    useMemo(
      () =>
        new Date(
          year,
          month + 1,
          0
        ).getDate(),
      [year, month]
    );

  const storageKey =
    equipmentId
      ? getMonthlyStorageKey(
          equipmentId,
          year,
          month
        )
      : `monthly-ledger-no-equipment-${year}-${month}`;

  function emptyRows(): DayRow[] {
    return Array.from(
      {
        length:
          daysInMonth,
      },
      (_, index) => ({
        day:
          index + 1,
        workType: '',
        trips: 0,
        income: 0,
        expense: 0,
        notes: '',
      })
    );
  }

  const [
    rows,
    setRows,
  ] =
    useState<DayRow[]>(
      emptyRows()
    );

  useEffect(() => {
    if (!equipmentId) {
      setRows(
        emptyRows()
      );

      return;
    }

    try {
      const saved =
        localStorage.getItem(
          storageKey
        );

      if (saved) {
        const parsed =
          JSON.parse(
            saved
          ) as DayRow[];

        const prepared =
          emptyRows().map(
            (row) => {
              const found =
                parsed.find(
                  (item) =>
                    item.day ===
                    row.day
                );

              return (
                found ||
                row
              );
            }
          );

        setRows(
          prepared
        );
      } else {
        setRows(
          emptyRows()
        );
      }
    } catch {
      setRows(
        emptyRows()
      );
    }
  }, [
    equipmentId,
    year,
    month,
    daysInMonth,
    storageKey,
  ]);

  useEffect(() => {
    if (
      !equipmentId
    )
      return;

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(
          rows
        )
      );
    } catch {
      // تجاهل خطأ الحفظ
    }
  }, [
    rows,
    storageKey,
    equipmentId,
  ]);

  function updateRow(
    day: number,
    field: keyof DayRow,
    value: string
  ) {
    setRows((old) =>
      old.map((row) => {
        if (
          row.day !== day
        )
          return row;

        return {
          ...row,

          [field]:
            field ===
              'workType' ||
            field ===
              'notes'
              ? value
              : Number(
                  value ||
                    0
                ),
        };
      })
    );
  }

  /* =========================
     حفظ الشغل وتوزيعه
     تلقائياً على الكرين
  ========================= */

  function saveQuickWork() {
    setQuickMessage(
      ''
    );

    setQuickError(
      ''
    );

    if (
      !quickEquipmentId
    ) {
      setQuickError(
        'اختر الكرين أو المعدة أولاً.'
      );

      return;
    }

    if (!quickDate) {
      setQuickError(
        'حدد تاريخ الشغل.'
      );

      return;
    }

    const dateParts =
      quickDate.split(
        '-'
      );

    const targetYear =
      Number(
        dateParts[0]
      );

    const targetMonth =
      Number(
        dateParts[1]
      ) - 1;

    const targetDay =
      Number(
        dateParts[2]
      );

    if (
      !targetYear ||
      targetMonth < 0 ||
      targetMonth > 11 ||
      !targetDay
    ) {
      setQuickError(
        'التاريخ غير صحيح.'
      );

      return;
    }

    const targetKey =
      getMonthlyStorageKey(
        quickEquipmentId,
        targetYear,
        targetMonth
      );

    const baseRows =
      createEmptyRows(
        targetYear,
        targetMonth
      );

    let existingRows =
      baseRows;

    try {
      const saved =
        localStorage.getItem(
          targetKey
        );

      if (saved) {
        const parsed =
          JSON.parse(
            saved
          ) as DayRow[];

        existingRows =
          baseRows.map(
            (row) => {
              const found =
                parsed.find(
                  (item) =>
                    item.day ===
                    row.day
                );

              return (
                found ||
                row
              );
            }
          );
      }
    } catch {
      existingRows =
        baseRows;
    }

    const newTrips =
      Number(
        quickTrips ||
          0
      );

    const newIncome =
      Number(
        quickIncome ||
          0
      );

    const newExpense =
      Number(
        quickExpense ||
          0
      );

    const updatedRows =
      existingRows.map(
        (row) => {
          if (
            row.day !==
            targetDay
          ) {
            return row;
          }

          let newWorkType =
            row.workType;

          if (
            quickWorkType
          ) {
            if (
              !newWorkType
            ) {
              newWorkType =
                quickWorkType;
            } else if (
              !newWorkType.includes(
                quickWorkType
              )
            ) {
              newWorkType =
                `${newWorkType} + ${quickWorkType}`;
            }
          }

          let newNotes =
            row.notes;

          if (
            quickNotes.trim()
          ) {
            newNotes =
              newNotes
                ? `${newNotes} | ${quickNotes.trim()}`
                : quickNotes.trim();
          }

          return {
            ...row,

            workType:
              newWorkType,

            trips:
              Number(
                row.trips ||
                  0
              ) +
              newTrips,

            income:
              Number(
                row.income ||
                  0
              ) +
              newIncome,

            expense:
              Number(
                row.expense ||
                  0
              ) +
              newExpense,

            notes:
              newNotes,
          };
        }
      );

    try {
      localStorage.setItem(
        targetKey,
        JSON.stringify(
          updatedRows
        )
      );

      /* إذا المستخدم
         يشاهد نفس الكرين
         ونفس الشهر
         حدث الجدول فوراً
      */

      if (
        String(
          quickEquipmentId
        ) ===
          String(
            equipmentId
          ) &&
        targetYear ===
          year &&
        targetMonth ===
          month
      ) {
        setRows(
          updatedRows
        );
      }

      const targetEquipment =
        equipmentList.find(
          (item) =>
            String(
              item.id
            ) ===
            String(
              quickEquipmentId
            )
        );

      setQuickMessage(
        `تم تسجيل شغل ${targetEquipment?.name || 'المعدة'} بتاريخ ${targetDay} ${monthNames[targetMonth]} ${targetYear} ✅`
      );

      setQuickTrips(
        ''
      );

      setQuickIncome(
        ''
      );

      setQuickExpense(
        ''
      );

      setQuickNotes(
        ''
      );
    } catch (error) {
      console.error(
        'تعذر حفظ الشغل:',
        error
      );

      setQuickError(
        'تعذر حفظ الشغل.'
      );
    }
  }

  const totals =
    useMemo(() => {
      return rows.reduce(
        (sum, row) => {
          sum.trips +=
            row.trips;

          sum.income +=
            row.income;

          sum.expense +=
            row.expense;

          sum.net +=
            row.income -
            row.expense;

          return sum;
        },
        {
          trips: 0,
          income: 0,
          expense: 0,
          net: 0,
        }
      );
    }, [rows]);

  const inputStyle:
    React.CSSProperties =
    {
      width: '100%',
      minWidth: 85,
      padding:
        '10px 8px',
      borderRadius: 10,
      border:
        '1px solid #26364f',
      background:
        '#0a1424',
      color: '#ffffff',
      fontSize: 13,
      boxSizing:
        'border-box',
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

  const quickLabel:
    React.CSSProperties =
    {
      color:
        '#94a3b8',

      fontSize: 12,

      display:
        'block',

      marginBottom: 6,
    };

  return (
    <AppLayout>
      <div
        dir="rtl"
        style={{
          padding: 18,
          paddingBottom:
            100,
          maxWidth:
            1100,
          margin: 'auto',
          color:
            '#ffffff',
        }}
      >
        <div
          style={{
            marginBottom:
              20,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 27,
            }}
          >
            الحساب الشهري
          </h1>

          <p
            style={{
              color:
                '#94a3b8',

              marginTop: 7,

              fontSize: 14,
            }}
          >
            الحساب الشهري الخاص بـ{' '}
            {equipmentName}
          </p>
        </div>

        {/* =========================
            تسجيل الشغل اليومي
        ========================= */}

        <div
          style={{
            background:
              'linear-gradient(145deg,#0d1b2f,#07111f)',

            border:
              '1px solid #31435f',

            borderRadius: 22,

            padding: 16,

            marginBottom: 20,

            boxShadow:
              '0 12px 32px rgba(0,0,0,0.22)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems:
                'center',
              justifyContent:
                'space-between',
              gap: 10,
              marginBottom: 15,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 20,
                  color:
                    '#ffffff',
                }}
              >
                🏗️ تسجيل الشغل اليومي
              </h2>

              <p
                style={{
                  margin:
                    '6px 0 0',
                  color:
                    '#94a3b8',
                  fontSize: 12,
                }}
              >
                سجل الشغل مرة واحدة وسيتم توزيعه تلقائياً على الكرين المختار
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
            }}
          >
            <label>
              <span
                style={
                  quickLabel
                }
              >
                التاريخ
              </span>

              <input
                type="date"
                value={
                  quickDate
                }
                onChange={(
                  e
                ) =>
                  setQuickDate(
                    e.target
                      .value
                  )
                }
                style={
                  inputStyle
                }
              />
            </label>

            <label>
              <span
                style={
                  quickLabel
                }
              >
                الكرين / المعدة
              </span>

              <select
                value={
                  quickEquipmentId
                }
                onChange={(
                  e
                ) =>
                  setQuickEquipmentId(
                    e.target
                      .value
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
                    (
                      item
                    ) => (
                      <option
                        key={
                          item.id
                        }
                        value={String(
                          item.id
                        )}
                      >
                        {
                          item.name
                        }
                      </option>
                    )
                  )
                )}
              </select>
            </label>

            <label>
              <span
                style={
                  quickLabel
                }
              >
                نوع الشغل
              </span>

              <select
                value={
                  quickWorkType
                }
                onChange={(
                  e
                ) =>
                  setQuickWorkType(
                    e.target
                      .value
                  )
                }
                style={
                  selectStyle
                }
              >
                <option value="مشوار">
                  مشوار
                </option>

                <option value="يومية">
                  يومية
                </option>

                <option value="ساعة">
                  ساعة
                </option>

                <option value="أسبوع">
                  أسبوع
                </option>

                <option value="شهري">
                  شهري
                </option>
              </select>
            </label>

            <label>
              <span
                style={
                  quickLabel
                }
              >
                عدد المشاوير
              </span>

              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={
                  quickTrips
                }
                onChange={(
                  e
                ) =>
                  setQuickTrips(
                    e.target
                      .value
                  )
                }
                style={
                  inputStyle
                }
                placeholder="0"
              />
            </label>

            <label>
              <span
                style={
                  quickLabel
                }
              >
                الدخل
              </span>

              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={
                  quickIncome
                }
                onChange={(
                  e
                ) =>
                  setQuickIncome(
                    e.target
                      .value
                  )
                }
                style={
                  inputStyle
                }
                placeholder="0"
              />
            </label>

            <label>
              <span
                style={
                  quickLabel
                }
              >
                المصروف
              </span>

              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={
                  quickExpense
                }
                onChange={(
                  e
                ) =>
                  setQuickExpense(
                    e.target
                      .value
                  )
                }
                style={
                  inputStyle
                }
                placeholder="0"
              />
            </label>
          </div>

          <label
            style={{
              display:
                'block',
              marginTop: 12,
            }}
          >
            <span
              style={
                quickLabel
              }
            >
              ملاحظات / اسم العميل / تفاصيل الشغل
            </span>

            <input
              type="text"
              value={
                quickNotes
              }
              onChange={(
                e
              ) =>
                setQuickNotes(
                  e.target
                    .value
                )
              }
              style={{
                ...inputStyle,
                minWidth: 0,
              }}
              placeholder="مثال: شغل عند شركة النور - خميس مشيط"
            />
          </label>

          {quickMessage && (
            <div
              style={{
                marginTop: 12,
                padding: 11,
                borderRadius: 12,
                background:
                  'rgba(34,197,94,0.10)',
                border:
                  '1px solid rgba(34,197,94,0.30)',
                color:
                  '#4ade80',
                fontSize: 13,
                fontWeight:
                  'bold',
              }}
            >
              {quickMessage}
            </div>
          )}

          {quickError && (
            <div
              style={{
                marginTop: 12,
                padding: 11,
                borderRadius: 12,
                background:
                  'rgba(239,68,68,0.10)',
                border:
                  '1px solid rgba(239,68,68,0.30)',
                color:
                  '#fb7185',
                fontSize: 13,
                fontWeight:
                  'bold',
              }}
            >
              {quickError}
            </div>
          )}

          <button
            type="button"
            onClick={
              saveQuickWork
            }
            style={{
              width: '100%',
              marginTop: 14,
              padding:
                '14px 16px',
              border: 0,
              borderRadius: 14,
              background:
                'linear-gradient(135deg,#f59e0b,#f97316)',
              color:
                '#07111f',
              fontWeight:
                900,
              fontSize: 15,
              cursor:
                'pointer',
              boxShadow:
                '0 8px 24px rgba(245,158,11,0.18)',
            }}
          >
            حفظ وتوزيع على الكرين
          </button>
        </div>

        {/* =========================
            اختيار الحساب الشهري
        ========================= */}

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
              onChange={(
                e
              ) =>
                setEquipmentId(
                  e.target
                    .value
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
                  (
                    item
                  ) => (
                    <option
                      key={
                        item.id
                      }
                      value={String(
                        item.id
                      )}
                    >
                      {
                        item.name
                      }
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
                  color:
                    '#94a3b8',
                }}
              >
                الشهر
              </small>

              <select
                value={
                  month
                }
                onChange={(
                  e
                ) =>
                  setMonth(
                    Number(
                      e.target
                        .value
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
            </label>

            <label>
              <small
                style={{
                  color:
                    '#94a3b8',
                }}
              >
                السنة
              </small>

              <select
                value={
                  year
                }
                onChange={(
                  e
                ) =>
                  setYear(
                    Number(
                      e.target
                        .value
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
            </label>
          </div>
        </div>

        {/* =========================
            الملخص
        ========================= */}

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
            <small
              style={{
                color:
                  '#94a3b8',
              }}
            >
              إجمالي المشاوير
            </small>

            <h2
              style={{
                color:
                  '#f5a623',
              }}
            >
              {totals.trips}
            </h2>
          </div>

          <div
            style={
              summaryCard
            }
          >
            <small
              style={{
                color:
                  '#94a3b8',
              }}
            >
              إجمالي الدخل
            </small>

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
            <small
              style={{
                color:
                  '#94a3b8',
              }}
            >
              إجمالي المصروفات
            </small>

            <h2
              style={{
                color:
                  '#ef4444',
              }}
            >
              {totals.expense.toLocaleString(
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
            <small
              style={{
                color:
                  '#94a3b8',
              }}
            >
              صافي الشهر
            </small>

            <h2
              style={{
                color:
                  '#3b82f6',
              }}
            >
              {totals.net.toLocaleString(
                'en-US'
              )}{' '}
              ر.س
            </h2>
          </div>
        </div>

        <div
          style={{
            marginBottom:
              12,
            fontWeight:
              'bold',
            fontSize: 18,
          }}
        >
          {equipmentName} —{' '}
          {
            monthNames[
              month
            ]
          }{' '}
          {year}
        </div>

        {/* =========================
            الجدول الشهري
        ========================= */}

        <div
          style={{
            overflowX:
              'auto',

            borderRadius: 18,

            border:
              '1px solid #1d2d47',

            background:
              '#07111f',
          }}
        >
          <table
            style={{
              width: '100%',
              minWidth: 900,
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
                  المشاوير
                </th>

                <th
                  style={{
                    padding: 13,
                  }}
                >
                  الدخل
                </th>

                <th
                  style={{
                    padding: 13,
                  }}
                >
                  المصروف
                </th>

                <th
                  style={{
                    padding: 13,
                  }}
                >
                  الصافي
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
              {rows.map(
                (row) => {
                  const net =
                    row.income -
                    row.expense;

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
                      <td
                        style={{
                          padding: 11,

                          fontWeight:
                            'bold',

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
                        <select
                          value={
                            row.workType
                          }
                          onChange={(
                            e
                          ) =>
                            updateRow(
                              row.day,
                              'workType',
                              e
                                .target
                                .value
                            )
                          }
                          style={
                            inputStyle
                          }
                          disabled={
                            !equipmentId
                          }
                        >
                          <option value="">
                            لا يوجد شغل
                          </option>

                          <option value="مشوار">
                            مشوار
                          </option>

                          <option value="يومية">
                            يومية
                          </option>

                          <option value="ساعة">
                            ساعة
                          </option>

                          <option value="أسبوع">
                            أسبوع
                          </option>

                          <option value="شهري">
                            شهري
                          </option>
                        </select>
                      </td>

                      <td
                        style={{
                          padding: 6,
                        }}
                      >
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={
                            row.trips ||
                            ''
                          }
                          onChange={(
                            e
                          ) =>
                            updateRow(
                              row.day,
                              'trips',
                              e
                                .target
                                .value
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
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={
                            row.income ||
                            ''
                          }
                          onChange={(
                            e
                          ) =>
                            updateRow(
                              row.day,
                              'income',
                              e
                                .target
                                .value
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
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={
                            row.expense ||
                            ''
                          }
                          onChange={(
                            e
                          ) =>
                            updateRow(
                              row.day,
                              'expense',
                              e
                                .target
                                .value
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
                          padding: 10,

                          fontWeight:
                            'bold',

                          color:
                            net >=
                            0
                              ? '#22c55e'
                              : '#ef4444',
                        }}
                      >
                        {net.toLocaleString(
                          'en-US'
                        )}
                      </td>

                      <td
                        style={{
                          padding: 6,
                        }}
                      >
                        <input
                          type="text"
                          value={
                            row.notes
                          }
                          onChange={(
                            e
                          ) =>
                            updateRow(
                              row.day,
                              'notes',
                              e
                                .target
                                .value
                            )
                          }
                          style={{
                            ...inputStyle,

                            minWidth:
                              150,
                          }}
                          placeholder="ملاحظات"
                          disabled={
                            !equipmentId
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

        {/* =========================
            ملخص الشهر
        ========================= */}

        <div
          style={{
            marginTop: 18,

            padding: 16,

            borderRadius: 18,

            background:
              '#0b1527',

            border:
              '1px solid #1d2d47',
          }}
        >
          <strong>
            ملخص الشهر
          </strong>

          <div
            style={{
              marginTop: 10,
              lineHeight: 2,
            }}
          >
            <div>
              عدد المشاوير:{' '}
              <b>
                {
                  totals.trips
                }
              </b>
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
              إجمالي المصروف:{' '}
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
                    '#3b82f6',
                }}
              >
                {totals.net.toLocaleString(
                  'en-US'
                )}{' '}
                ر.س
              </b>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
    }
