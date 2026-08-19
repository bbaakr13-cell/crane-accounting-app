import React, { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { fetchEquipment, type Equipment } from '@/lib/equipment';

type Rental = {
  id: number;
  customer: string;
  equipment: string;
  month: string;
  amount: number;
  paid: number;
};

const STORAGE_KEY = 'monthly-rentals';

export function MonthlyRentalPage() {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [equipmentLoading, setEquipmentLoading] = useState(true);

  const [customer, setCustomer] = useState('');
  const [equipment, setEquipment] = useState('');
  const [month, setMonth] = useState('');
  const [amount, setAmount] = useState('');
  const [paid, setPaid] = useState('');

  const [rentals, setRentals] = useState<Rental[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as Rental[]) : [];
    } catch {
      return [];
    }
  });

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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rentals));
  }, [rentals]);

  const totals = useMemo(() => {
    const total = rentals.reduce((sum, item) => sum + item.amount, 0);
    const totalPaid = rentals.reduce((sum, item) => sum + item.paid, 0);

    return {
      total,
      paid: totalPaid,
      remaining: total - totalPaid,
    };
  }, [rentals]);

  function addRental() {
    if (!customer || !equipment || !month || !amount) {
      alert('يرجى تعبئة البيانات المطلوبة');
      return;
    }

    const newRental: Rental = {
      id: Date.now(),
      customer,
      equipment,
      month,
      amount: Number(amount),
      paid: Number(paid || 0),
    };

    setRentals((prev) => [newRental, ...prev]);

    setCustomer('');
    setMonth('');
    setAmount('');
    setPaid('');
  }

  function deleteRental(id: number) {
    setRentals((prev) => prev.filter((item) => item.id !== id));
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: 12,
    borderRadius: 12,
    border: '1px solid #26364f',
    background: '#0a1424',
    color: '#ffffff',
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
          padding: '20px',
          paddingBottom: 100,
          maxWidth: 900,
          margin: 'auto',
          color: '#ffffff',
        }}
      >
        <h1>الإيجارات الشهرية</h1>
        <p style={{ color: '#94a3b8' }}>
          إدارة ومتابعة المعدات المؤجرة بالشهر
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 10,
            marginTop: 20,
          }}
        >
          <div style={cardStyle}>
            <strong>إجمالي العقود</strong>
            <h2>{rentals.length}</h2>
          </div>

          <div style={cardStyle}>
            <strong>إجمالي الإيجارات</strong>
            <h2>{totals.total.toLocaleString()} ر.س</h2>
          </div>

          <div style={cardStyle}>
            <strong>المبلغ المستلم</strong>
            <h2>{totals.paid.toLocaleString()} ر.س</h2>
          </div>

          <div style={cardStyle}>
            <strong>المتبقي</strong>
            <h2>{totals.remaining.toLocaleString()} ر.س</h2>
          </div>
        </div>

        <div style={{ ...cardStyle, marginTop: 24 }}>
          <h2 style={{ marginTop: 0 }}>إضافة إيجار شهري</h2>

          <div style={{ display: 'grid', gap: 12 }}>
            <input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="اسم العميل"
              style={fieldStyle}
            />

            <select
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              style={fieldStyle}
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

            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={fieldStyle}
            />

            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="قيمة الإيجار الشهري"
              style={fieldStyle}
            />

            <input
              type="number"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              placeholder="المبلغ المستلم"
              style={fieldStyle}
            />

            <button
              onClick={addRental}
              style={{
                padding: 14,
                border: 0,
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 'bold',
                cursor: 'pointer',
                background: '#f5a623',
                color: '#111827',
              }}
            >
              + حفظ الإيجار
            </button>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <h2>الإيجارات المسجلة</h2>

          {rentals.length === 0 ? (
            <div style={cardStyle}>
              لا توجد إيجارات شهرية مسجلة حتى الآن.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {rentals.map((item) => (
                <div key={item.id} style={cardStyle}>
                  <strong>{item.customer}</strong>

                  <p>المعدة: {item.equipment}</p>
                  <p>الشهر: {item.month}</p>
                  <p>الإيجار: {item.amount.toLocaleString()} ر.س</p>
                  <p>المستلم: {item.paid.toLocaleString()} ر.س</p>
                  <p>
                    المتبقي: {(item.amount - item.paid).toLocaleString()} ر.س
                  </p>

                  <button
                    onClick={() => deleteRental(item.id)}
                    style={{
                      padding: '9px 14px',
                      borderRadius: 10,
                      border: '1px solid #7f1d1d',
                      background: '#3f1117',
                      color: '#fecaca',
                      cursor: 'pointer',
                    }}
                  >
                    حذف
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
        }
