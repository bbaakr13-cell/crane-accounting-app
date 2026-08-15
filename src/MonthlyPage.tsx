import React, { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';

type DayRow = {
  day: number;
  workType: string;
  workDetails: string;
  amount: number;
  expenseText: string;
  notes: string;
};

const equipmentList = [
  'كرين 50 طن',
  'كرين 25 طن',
  'كرين 25 طن ساني',
  'كرين 25 طن أصفر بكر',
  'كرين 25 طن كاتو',
  'كرين 25 طن أصفر مستبيشي',
  'بوم ترك الأخضر',
  'بوم ترك الأحمر',
];

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

export function MonthlyPage() {
  const now = new Date();

  const [equipment, setEquipment] = useState(equipmentList[0]);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const daysInMonth = useMemo(
    () => new Date(year, month + 1, 0).getDate(),
    [year, month]
  );

  const storageKey = `monthly-ledger-v2-${equipment}-${year}-${month}`;

  function createEmptyRows(): DayRow[] {
    return Array.from({ length: daysInMonth }, (_, index) => ({
      day: index + 1,
      workType: '',
      workDetails: '',
      amount: 0,
      expenseText: '',
      notes: '',
    }));
  }

  const [rows, setRows] = useState<DayRow[]>(createEmptyRows());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);

      if (!saved) {
        setRows(createEmptyRows());
        return;
      }

      const parsed = JSON.parse(saved) as DayRow[];

      const prepared = createEmptyRows().map((row) => {
        const found = parsed.find((item) => item.day === row.day);
        return found || row;
      });

      setRows(prepared);
    } catch {
      setRows(createEmptyRows());
    }
  }, [equipment, year, month, daysInMonth]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(rows));
    } catch {
      // تجاهل خطأ الحفظ
    }
  }, [rows, storageKey]);

  function updateRow(
    day: number,
    field: keyof DayRow,
    value: string
  ) {
    setRows((old) =>
      old.map((row) => {
        if (row.day !== day) return row;

        if (field === 'amount') {
          return {
            ...row,
            amount: Number(value || 0),
          };
        }

        return {
          ...row,
          [field]: value,
        };
      })
    );
  }

  const totalAmount = useMemo(() => {
    return rows.reduce((sum, row) => sum + row.amount, 0);
  }, [rows]);

  const workedDays = useMemo(() => {
    return rows.filter(
      (row) =>
        row.workType ||
        row.workDetails ||
        row.amount > 0 ||
        row.expenseText ||
        row.notes
    ).length;
  }, [rows]);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    minWidth: 120,
    padding: '11px 9px',
    borderRadius: 10,
    border: '1px solid #26364f',
    background: '#0a1424',
    color: '#ffffff',
    fontSize: 13,
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    minWidth: 0,
    padding: 12,
  };

  const summaryCard: React.CSSProperties = {
    background: '#0b1527',
    border: '1px solid #1d2d47',
    borderRadius: 16,
    padding: 14,
    textAlign: 'center',
  };

  return (
    <AppLayout>
      <div
        dir="rtl"
        style={{
          padding: 18,
          paddingBottom: 100,
          maxWidth: 1200,
          margin: 'auto',
          color: '#ffffff',
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 28 }}>
            الحساب الشهري
          </h1>

          <p
            style={{
              color: '#94a3b8',
              marginTop: 7,
              fontSize: 14,
            }}
          >
            سجل يومي من اليوم 1 إلى نهاية الشهر
          </p>
        </div>

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
            <small style={{ color: '#94a3b8' }}>
              اختر المعدة
            </small>

            <select
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              style={selectStyle}
            >
              {equipmentList.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            <label>
              <small style={{ color: '#94a3b8' }}>
                الشهر
              </small>

              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                style={selectStyle}
              >
                {monthNames.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <small style={{ color: '#94a3b8' }}>
                السنة
              </small>

              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                style={selectStyle}
              >
                {Array.from({ length: 9 }, (_, index) => {
                  const y = now.getFullYear() - 3 + index;

                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
            marginBottom: 18,
          }}
        >
          <div style={summaryCard}>
            <small style={{ color: '#94a3b8' }}>
              الأيام المسجلة
            </small>
            <h2 style={{ color: '#f5a623' }}>
              {workedDays}
            </h2>
          </div>

          <div style={summaryCard}>
            <small style={{ color: '#94a3b8' }}>
              إجمالي المبلغ
            </small>
            <h2 style={{ color: '#22c55e' }}>
              {totalAmount.toLocaleString()} ر.س
            </h2>
          </div>
        </div>

        <div
          style={{
            marginBottom: 12,
            fontWeight: 'bold',
            fontSize: 18,
          }}
        >
          {equipment} — {monthNames[month]} {year}
        </div>

        <div
          style={{
            overflowX: 'auto',
            borderRadius: 18,
            border: '1px solid #1d2d47',
            background: '#07111f',
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
              <tr style={{ background: '#101b2e' }}>
                <th style={{ padding: 13 }}>اليوم</th>

                <th style={{ padding: 13 }}>
                  نوع الشغل
                </th>

                <th style={{ padding: 13 }}>
                  تفصيل العمل
                  <div
                    style={{
                      fontSize: 10,
                      color: '#94a3b8',
                      marginTop: 3,
                    }}
                  >
                    يكتب بحروف
                  </div>
                </th>

                <th style={{ padding: 13 }}>
                  المبلغ
                  <div
                    style={{
                      fontSize: 10,
                      color: '#94a3b8',
                      marginTop: 3,
                    }}
                  >
                    يكتب بالأرقام
                  </div>
                </th>

                <th style={{ padding: 13 }}>
                  مصروف / خرج
                  <div
                    style={{
                      fontSize: 10,
                      color: '#94a3b8',
                      marginTop: 3,
                    }}
                  >
                    يكتب بحروف
                  </div>
                </th>

                <th style={{ padding: 13 }}>
                  ملاحظات
                  <div
                    style={{
                      fontSize: 10,
                      color: '#94a3b8',
                      marginTop: 3,
                    }}
                  >
                    يكتب بحروف
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.day}
                  style={{
                    borderTop: '1px solid #1d2d47',
                  }}
                >
                  <td
                    style={{
                      padding: 11,
                      fontWeight: 'bold',
                      color: '#f5a623',
                    }}
                  >
                    {row.day}
                  </td>

                  <td style={{ padding: 6 }}>
                    <select
                      value={row.workType}
                      onChange={(e) =>
                        updateRow(
                          row.day,
                          'workType',
                          e.target.value
                        )
                      }
                      style={inputStyle}
                    >
                      <option value="">لا يوجد شغل</option>
                      <option value="مشوار">مشوار</option>
                      <option value="يومية">يومية</option>
                      <option value="ساعة">ساعة</option>
                      <option value="أسبوع">أسبوع</option>
                      <option value="شهري">شهري</option>
                    </select>
                  </td>

                  <td style={{ padding: 6 }}>
                    <input
                      type="text"
                      value={row.workDetails}
                      onChange={(e) =>
                        updateRow(
                          row.day,
                          'workDetails',
                          e.target.value
                        )
                      }
                      style={{
                        ...inputStyle,
                        minWidth: 190,
                      }}
                      placeholder="مثال: نقل حديد للموقع"
                    />
                  </td>

                  <td style={{ padding: 6 }}>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={row.amount || ''}
                      onChange={(e) =>
                        updateRow(
                          row.day,
                          'amount',
                          e.target.value
                        )
                      }
                      style={{
                        ...inputStyle,
                        minWidth: 110,
                      }}
                      placeholder="0"
                    />
                  </td>

                  <td style={{ padding: 6 }}>
                    <input
                      type="text"
                      value={row.expenseText}
                      onChange={(e) =>
                        updateRow(
                          row.day,
                          'expenseText',
                          e.target.value
                        )
                      }
                      style={{
                        ...inputStyle,
                        minWidth: 170,
                      }}
                      placeholder="مثال: ديزل، أجرة عامل"
                    />
                  </td>

                  <td style={{ padding: 6 }}>
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(e) =>
                        updateRow(
                          row.day,
                          'notes',
                          e.target.value
                        )
                      }
                      style={{
                        ...inputStyle,
                        minWidth: 180,
                      }}
                      placeholder="اكتب ملاحظة"
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
            border: '1px solid #1d2d47',
          }}
        >
          <strong>ملاحظات مهمة</strong>

          <div
            style={{
              color: '#cbd5e1',
              marginTop: 10,
              lineHeight: 2,
              fontSize: 14,
            }}
          >
            <div>
              • تفصيل العمل يكتب بحروف.
            </div>

            <div>
              • المبلغ يكتب بالأرقام فقط.
            </div>

            <div>
              • مصروف / خرج يكتب بحروف.
            </div>

            <div>
              • الملاحظات تكتب بحروف.
            </div>

            <div>
              • البيانات تحفظ تلقائيًا على الجهاز.
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
            }
