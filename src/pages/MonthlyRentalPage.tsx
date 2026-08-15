import React, { useMemo, useState } from 'react';

type Rental = {
  id: number;
  customer: string;
  equipment: string;
  month: string;
  amount: number;
  paid: number;
};

export function MonthlyRentalPage() {
  const [customer, setCustomer] = useState('');
  const [equipment, setEquipment] = useState('');
  const [month, setMonth] = useState('');
  const [amount, setAmount] = useState('');
  const [paid, setPaid] = useState('');

  const [rentals, setRentals] = useState<Rental[]>([]);

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
    setEquipment('');
    setMonth('');
    setAmount('');
    setPaid('');
  }

  function deleteRental(id: number) {
    setRentals((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <div dir="rtl" style={{ padding: '20px', maxWidth: 900, margin: 'auto' }}>
      <h1>الإيجارات الشهرية</h1>
      <p>إدارة ومتابعة المعدات المؤجرة بالشهر</p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 10,
          marginTop: 20,
        }}
      >
        <div>
          <strong>إجمالي العقود</strong>
          <h2>{rentals.length}</h2>
        </div>

        <div>
          <strong>إجمالي الإيجارات</strong>
          <h2>{totals.total} ر.س</h2>
        </div>

        <div>
          <strong>المبلغ المستلم</strong>
          <h2>{totals.paid} ر.س</h2>
        </div>

        <div>
          <strong>المتبقي</strong>
          <h2>{totals.remaining} ر.س</h2>
        </div>
      </div>

      <hr style={{ margin: '25px 0' }} />

      <h2>إضافة إيجار شهري</h2>

      <div style={{ display: 'grid', gap: 12 }}>
        <input
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          placeholder="اسم العميل"
          style={{ padding: 12 }}
        />

        <input
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
          placeholder="اسم المعدة / الكرين"
          style={{ padding: 12 }}
        />

        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          style={{ padding: 12 }}
        />

        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="قيمة الإيجار الشهري"
          style={{ padding: 12 }}
        />

        <input
          type="number"
          value={paid}
          onChange={(e) => setPaid(e.target.value)}
          placeholder="المبلغ المستلم"
          style={{ padding: 12 }}
        />

        <button
          onClick={addRental}
          style={{
            padding: 14,
            fontSize: 16,
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          + حفظ الإيجار
        </button>
      </div>

      <hr style={{ margin: '25px 0' }} />

      <h2>الإيجارات المسجلة</h2>

      {rentals.length === 0 ? (
        <p>لا توجد إيجارات شهرية مسجلة حتى الآن.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {rentals.map((item) => (
            <div
              key={item.id}
              style={{
                border: '1px solid #555',
                borderRadius: 12,
                padding: 15,
              }}
            >
              <strong>{item.customer}</strong>

              <p>المعدة: {item.equipment}</p>
              <p>الشهر: {item.month}</p>
              <p>الإيجار: {item.amount} ر.س</p>
              <p>المستلم: {item.paid} ر.س</p>
              <p>المتبقي: {item.amount - item.paid} ر.س</p>

              <button onClick={() => deleteRental(item.id)}>
                حذف
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
