import React, { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { fetchEquipment, type Equipment } from '@/lib/equipment';

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

export function MonthlyPage() {
  const now = new Date();

  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [equipment, setEquipment] = useState('');
  const [equipmentLoading, setEquipmentLoading] = useState(true);

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  useEffect(() => {
    let cancelled = false;

    async function loadEquipment() {
      setEquipmentLoading(true);

      try {
        const list = await fetchEquipment();

        if (cancelled) return;

        setEquipmentList(list);

        setEquipment((current) => {
          if (current && list.some((item) => item.name === current)) {
            return current;
          }

          return list[0]?.name ?? '';
        });
      } catch (error) {
        console.error('تعذر تحميل المعدات:', error);

        if (!cancelled) {
          setEquipmentList([]);
          setEquipment('');
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
  }, []);

  const daysInMonth = useMemo(
    () => new Date(year, month + 1, 0).getDate(),
    [year, month]
  );

  const storageKey = equipment
    ? `monthly-ledger-${equipment}-${year}-${month}`
    : `monthly-ledger-no-equipment-${year}-${month}`;

  const emptyRows = (): DayRow[] =>
    Array.from({ length: daysInMonth }, (_, index) => ({
      day: index + 1,
      workType: '',
      trips: 0,
      income: 0,
      expense: 0,
      notes: '',
    }));

  const [rows, setRows] = useState<DayRow[]>(emptyRows());

  useEffect(() => {
    if (!equipment) {
      setRows(emptyRows());
      return;
    }

    try {
      const saved = localStorage.getItem(storageKey);

      if (saved) {
        const parsed = JSON.parse(saved) as DayRow[];

        const newRows = emptyRows().map((row) => {
          const found = parsed.find((item) => item.day === row.day);
          return found || row;
        });

        setRows(newRows);
      } else {
        setRows(emptyRows());
      }
    } catch {
      setRows(emptyRows());
    }
  }, [equipment, year, month, daysInMonth, storageKey]);

  useEffect(() => {
    if (!equipment) return;

    localStorage.setItem(storageKey, JSON.stringify(rows));
  }, [rows, storageKey, equipment]);

  function updateRow(
    day: number,
    field: keyof DayRow,
    value: string
  ) {
    setRows((old) =>
      old.map((row) => {
        if (row.day !== day) return row;

        return {
          ...row,
          [field]:
            field === 'workType' || field === 'notes'
              ? value
              : Number(value || 0),
        };
      })
    );
  }

  const totals = useMemo(() => {
    return rows.reduce(
      (sum, row) => {
        sum.trips += row.trips;
        sum.income += row.income;
        sum.expense += row.expense;
        sum.net += row.income - row.expense;
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    minWidth: 85,
    padding: '10px 8px',
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
          padding: '18px',
          paddingBottom: 100,
          maxWidth: 1100,
          margin: 'auto',
          color: '#ffffff',
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 27 }}>
            الحساب الشهري
          </h1>

          <p
            style={{
              color: '#94a3b8',
              marginTop: 7,
              fontSize: 14,
            }}
          >
            سجل يومي من اليوم 1 حتى نهاية الشهر
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
              disabled={equipmentLoading || equipmentList.length === 0}
            >
              {equipmentLoading ? (
                <option value="">جاري تحميل المعدات...</option>
              ) : equipmentList.length === 0 ? (
                <option value="">لا توجد معدات — أضف معدة أولاً</option>
              ) : (
                equipmentList.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))
              )}
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
                {Array.from({ length: 7 }, (_, index) => {
                  const y = now.getFullYear() - 2 + index;

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
              إجمالي المشاوير
            </small>
            <h2 style={{ color: '#f5a623' }}>
              {totals.trips}
            </h2>
          </div>

          <div style={summaryCard}>
            <small style={{ color: '#94a3b8' }}>
              إجمالي الدخل
            </small>
            <h2 style={{ color: '#22c55e' }}>
              {totals.income.toLocaleString()} ر.س
            </h2>
          </div>

          <div style={summaryCard}>
            <small style={{ color: '#94a3b8' }}>
              إجمالي المصروفات
            </small>
            <h2 style={{ color: '#ef4444' }}>
              {totals.expense.toLocaleString()} ر.س
            </h2>
          </div>

          <div style={summaryCard}>
            <small style={{ color: '#94a3b8' }}>
              صافي الشهر
            </small>
            <h2 style={{ color: '#3b82f6' }}>
              {totals.net.toLocaleString()} ر.س
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
          {equipment || 'لا توجد معدة محددة'} — {monthNames[month]} {year}
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
              minWidth: 900,
              borderCollapse: 'collapse',
              textAlign: 'center',
            }}
          >
            <thead>
              <tr style={{ background: '#101b2e' }}>
                <th style={{ padding: 13 }}>اليوم</th>
                <th style={{ padding: 13 }}>نوع الشغل</th>
                <th style={{ padding: 13 }}>المشاوير</th>
                <th style={{ padding: 13 }}>الدخل</th>
                <th style={{ padding: 13 }}>المصروف</th>
                <th style={{ padding: 13 }}>الصافي</th>
                <th style={{ padding: 13 }}>ملاحظات</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const net = row.income - row.expense;

                return (
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
                        disabled={!equipment}
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
                        type="number"
                        min="0"
                        value={row.trips || ''}
                        onChange={(e) =>
                          updateRow(
                            row.day,
                            'trips',
                            e.target.value
                          )
                        }
                        style={inputStyle}
                        placeholder="0"
                        disabled={!equipment}
                      />
                    </td>

                    <td style={{ padding: 6 }}>
                      <input
                        type="number"
                        min="0"
                        value={row.income || ''}
                        onChange={(e) =>
                          updateRow(
                            row.day,
                            'income',
                            e.target.value
                          )
                        }
                        style={inputStyle}
                        placeholder="0"
                        disabled={!equipment}
                      />
                    </td>

                    <td style={{ padding: 6 }}>
                      <input
                        type="number"
                        min="0"
                        value={row.expense || ''}
                        onChange={(e) =>
                          updateRow(
                            row.day,
                            'expense',
                            e.target.value
                          )
                        }
                        style={inputStyle}
                        placeholder="0"
                        disabled={!equipment}
                      />
                    </td>

                    <td
                      style={{
                        padding: 10,
                        fontWeight: 'bold',
                        color:
                          net >= 0 ? '#22c55e' : '#ef4444',
                      }}
                    >
                      {net.toLocaleString()}
                    </td>

                    <td style={{ padding: 6 }}>
                      <input
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
                          minWidth: 150,
                        }}
                        placeholder="ملاحظات"
                        disabled={!equipment}
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
            padding: 16,
            borderRadius: 18,
            background: '#0b1527',
            border: '1px solid #1d2d47',
          }}
        >
          <strong>ملخص الشهر</strong>

          <div style={{ marginTop: 10, lineHeight: 2 }}>
            <div>
              عدد المشاوير: <b>{totals.trips}</b>
            </div>

            <div>
              إجمالي الدخل:{' '}
              <b style={{ color: '#22c55e' }}>
                {totals.income.toLocaleString()} ر.س
              </b>
            </div>

            <div>
              إجمالي المصروف:{' '}
              <b style={{ color: '#ef4444' }}>
                {totals.expense.toLocaleString()} ر.س
              </b>
            </div>

            <div>
              صافي الشهر:{' '}
              <b style={{ color: '#3b82f6' }}>
                {totals.net.toLocaleString()} ر.س
              </b>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
    }    
