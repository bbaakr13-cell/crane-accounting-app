  import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';

type DayRow = {
  day: number;
  workType: string;
  workDetails: string;
  amount: number;
  expenseText: string;
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

export function MonthlyDetailPage() {
  const { id } = useParams();
  const now = new Date();

  const [equipmentName] = useState(() => {
    try {
      const saved = localStorage.getItem('equipment');
      const list = saved ? JSON.parse(saved) : [];
      const found = Array.isArray(list)
        ? list.find((item: any) => String(item.id) === String(id))
        : null;

      return found?.name || found?.title || `المعدة ${id || ''}`;
    } catch {
      return `المعدة ${id || ''}`;
    }
  });

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const daysInMonth = useMemo(
    () => new Date(year, month + 1, 0).getDate(),
    [year, month]
  );

  const storageKey = `monthly-detail-v3-${id}-${year}-${month}`;

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

      setRows(
        createEmptyRows().map((row) => {
          const found = parsed.find((item) => item.day === row.day);
          return found || row;
        })
      );
    } catch {
      setRows(createEmptyRows());
    }
  }, [storageKey, daysInMonth]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(rows));
    } catch {
      // ignore
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

  const totalAmount = useMemo(
    () => rows.reduce((sum, row) => sum + row.amount, 0),
    [rows]
  );

  const activeDays = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.workType ||
          row.workDetails ||
          row.amount > 0 ||
          row.expenseText ||
          row.notes
      ).length,
    [rows]
  );

  const inputStyle: React.CSSProperties = {
    width: '100%',
    minWidth: 120,
    padding: '10px',
    borderRadius: 10,
    border: '1px solid #26364f',
    background: '#0a1424',
    color: '#fff',
    fontSize: 13,
    boxSizing: 'border-box',
  };

  const cardStyle: React.CSSProperties = {
    background: '#0b1527',
    border: '1px solid #1d2d47',
    borderRadius: 16,
    padding: 14,
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
          color: '#fff',
        }}
      >
        <h1 style={{ marginBottom: 4 }}>الحساب الشهري</h1>

        <div style={{ color: '#94a3b8', marginBottom: 18 }}>
          {equipmentName}
        </div>

        <div
          style={{
            ...cardStyle,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <label>
            <small style={{ color: '#94a3b8' }}>الشهر</small>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              style={inputStyle}
            >
              {monthNames.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <small style={{ color: '#94a3b8' }}>السنة</small>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              style={inputStyle}
            >
              {Array.from({ length: 9 }, (_, i) => {
                const y = now.getFullYear() - 3 + i;
                return (
                  <option key={y} value={y}>
                    {y}
                  </option>
                );
              })}
            </select>
          </label>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div style={cardStyle}>
            <small style={{ color: '#94a3b8' }}>
              الأيام المسجلة
            </small>
            <h2 style={{ color: '#f5a623' }}>{activeDays}</h2>
          </div>

          <div style={cardStyle}>
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
                <th style={{ padding: 12 }}>اليوم</th>
                <th style={{ padding: 12 }}>نوع الشغل</th>
                <th style={{ padding: 12 }}>تفصيل العمل</th>
                <th style={{ padding: 12 }}>المبلغ</th>
                <th style={{ padding: 12 }}>مصروف / خرج</th>
                <th style={{ padding: 12 }}>ملاحظات</th>
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
                      padding: 10,
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
                      placeholder="اكتب تفصيل العمل"
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
                      placeholder="اكتب المصروف / الخرج"
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
                      placeholder="اكتب ملاحظات"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          style={{
            ...cardStyle,
            marginTop: 16,
            lineHeight: 2,
          }}
        >
          <strong>طريقة الإدخال</strong>
          <div style={{ color: '#cbd5e1', marginTop: 8 }}>
            <div>• تفصيل العمل: حروف.</div>
            <div>• المبلغ: أرقام فقط.</div>
            <div>• مصروف / خرج: حروف.</div>
            <div>• ملاحظات: حروف.</div>
            <div>• الأيام تظهر تلقائيًا من 1 إلى نهاية الشهر.</div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
