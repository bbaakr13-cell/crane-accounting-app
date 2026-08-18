import React, { useEffect, useMemo, useState } from 'react';

type Driver = {
  id: number;
  name: string;
  phone: string;
  equipment: string;
  salary: number;
  workDays: number;
  absentDays: number;
  extraAmount: number;
  withdrawals: number;
};

const STORAGE_KEY = 'crane_drivers_v1';

export function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [equipment, setEquipment] = useState('');
  const [salary, setSalary] = useState('');
  const [workDays, setWorkDays] = useState('');
  const [absentDays, setAbsentDays] = useState('');
  const [extraAmount, setExtraAmount] = useState('');
  const [withdrawals, setWithdrawals] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drivers));
  }, [drivers]);

  const totals = useMemo(() => {
    return drivers.reduce(
      (result, driver) => {
        result.salaries += driver.salary;
        result.extra += driver.extraAmount;
        result.withdrawals += driver.withdrawals;
        result.remaining +=
          driver.salary + driver.extraAmount - driver.withdrawals;

        return result;
      },
      {
        salaries: 0,
        extra: 0,
        withdrawals: 0,
        remaining: 0,
      }
    );
  }, [drivers]);

  function addDriver() {
    if (!name.trim()) {
      alert('اكتب اسم السائق');
      return;
    }

    if (!salary || Number(salary) <= 0) {
      alert('اكتب راتب السائق');
      return;
    }

    const driver: Driver = {
      id: Date.now(),
      name: name.trim(),
      phone: phone.trim(),
      equipment: equipment.trim(),
      salary: Number(salary),
      workDays: Number(workDays || 0),
      absentDays: Number(absentDays || 0),
      extraAmount: Number(extraAmount || 0),
      withdrawals: Number(withdrawals || 0),
    };

    setDrivers((old) => [driver, ...old]);

    setName('');
    setPhone('');
    setEquipment('');
    setSalary('');
    setWorkDays('');
    setAbsentDays('');
    setExtraAmount('');
    setWithdrawals('');
  }

  function deleteDriver(id: number) {
    const ok = confirm('هل تريد حذف هذا السائق؟');

    if (!ok) return;

    setDrivers((old) => old.filter((driver) => driver.id !== id));
  }

  function updateDriver(
    id: number,
    field: keyof Driver,
    value: string
  ) {
    setDrivers((old) =>
      old.map((driver) =>
        driver.id === id
          ? {
              ...driver,
              [field]:
                field === 'name' ||
                field === 'phone' ||
                field === 'equipment'
                  ? value
                  : Number(value || 0),
            }
          : driver
      )
    );
  }


  function getRemaining(driver: Driver) {
    return driver.salary + driver.extraAmount - driver.withdrawals;
  }

  function getDriverSummaryText(driver: Driver) {
    const remaining = getRemaining(driver);

    return [
      'ملخص حساب السائق / المشغل',
      `الاسم: ${driver.name}`,
      `رقم الجوال: ${driver.phone || '-'}`,
      `المعدة: ${driver.equipment || '-'}`,
      `الراتب الشهري: ${driver.salary.toLocaleString()} ر.س`,
      `أيام العمل: ${driver.workDays}`,
      `أيام الغياب: ${driver.absentDays}`,
      `العمل الإضافي: ${driver.extraAmount.toLocaleString()} ر.س`,
      `السحوبات / السلف: ${driver.withdrawals.toLocaleString()} ر.س`,
      `صافي المتبقي: ${remaining.toLocaleString()} ر.س`,
    ].join('\n');
  }

  function buildDriverPdfHtml(driver: Driver) {
    const remaining = getRemaining(driver);
    const issueDate = new Date().toLocaleDateString('ar-SA');

    return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>ملخص حساب ${driver.name}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#eef2f6;font-family:Arial,Tahoma,sans-serif;color:#111827}
  .page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:13mm}
  .top-line{height:8px;border-radius:999px;background:#123e78;margin-bottom:18px}
  .header{text-align:center}
  .header h1{margin:0;color:#123e78;font-size:28px}
  .header p{margin:7px 0 0;color:#64748b;font-size:13px}
  .info{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:22px}
  .box{border:1.4px solid #cbd5e1;border-radius:12px;padding:13px}
  .label{font-size:12px;color:#64748b;margin-bottom:5px}
  .value{font-size:16px;font-weight:700}
  .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:18px 0}
  .metric{border:1px solid #dbe3ec;border-radius:12px;padding:12px;text-align:center}
  .metric span{display:block;color:#64748b;font-size:12px}
  .metric b{display:block;margin-top:7px;font-size:19px}
  .green{color:#168a55}.orange{color:#c97700}.blue{color:#123e78}.red{color:#c83232}
  table{width:100%;border-collapse:collapse;margin-top:15px}
  th{background:#123e78;color:#fff;padding:11px 8px;font-size:13px}
  td{border:1px solid #d8dee8;padding:11px 8px;text-align:center;font-size:13px}
  .net{margin-top:18px;border:2px solid #2e9b65;background:#effaf4;border-radius:13px;padding:15px;display:flex;align-items:center;justify-content:space-between}
  .net strong{font-size:26px;color:#168a55}
  .note{margin-top:12px;color:#64748b;font-size:12px;text-align:center}
  .signatures{display:grid;grid-template-columns:1fr 1fr;gap:70px;margin-top:55px;text-align:center}
  .sign-line{border-top:1px dashed #64748b;padding-top:8px}
  footer{margin-top:48px;border-top:2px solid #123e78;padding-top:10px;display:flex;justify-content:space-between;color:#64748b;font-size:11px}
  @media print{
    body{background:#fff}
    .page{width:auto;min-height:auto;margin:0;padding:10mm}
    @page{size:A4;margin:0}
  }
</style>
</head>
<body>
<div class="page">
  <div class="top-line"></div>
  <div class="header">
    <h1>ملخص حساب السائق / المشغل</h1>
    <p>كشف حساب الرواتب والسحوبات والعمل الإضافي</p>
  </div>

  <div class="info">
    <div class="box"><div class="label">اسم السائق / المشغل</div><div class="value">${driver.name}</div></div>
    <div class="box"><div class="label">رقم الجوال</div><div class="value">${driver.phone || '-'}</div></div>
    <div class="box"><div class="label">المعدة</div><div class="value">${driver.equipment || '-'}</div></div>
    <div class="box"><div class="label">تاريخ إصدار الكشف</div><div class="value">${issueDate}</div></div>
  </div>

  <div class="metrics">
    <div class="metric"><span>الراتب الشهري</span><b class="blue">${driver.salary.toLocaleString()} ر.س</b></div>
    <div class="metric"><span>العمل الإضافي</span><b class="green">${driver.extraAmount.toLocaleString()} ر.س</b></div>
    <div class="metric"><span>السحوبات / السلف</span><b class="orange">${driver.withdrawals.toLocaleString()} ر.س</b></div>
    <div class="metric"><span>أيام الغياب</span><b class="red">${driver.absentDays} يوم</b></div>
  </div>

  <table>
    <thead>
      <tr><th>البيان</th><th>القيمة</th><th>التفاصيل</th></tr>
    </thead>
    <tbody>
      <tr><td>الراتب الشهري</td><td>${driver.salary.toLocaleString()} ر.س</td><td>أيام العمل: ${driver.workDays}</td></tr>
      <tr><td>العمل الإضافي</td><td>${driver.extraAmount.toLocaleString()} ر.س</td><td>إضافة على الراتب</td></tr>
      <tr><td>السحوبات / السلف</td><td>${driver.withdrawals.toLocaleString()} ر.س</td><td>تخصم من المستحق</td></tr>
      <tr><td>أيام الغياب</td><td>${driver.absentDays} يوم</td><td>للمتابعة</td></tr>
    </tbody>
  </table>

  <div class="net">
    <span>صافي المبلغ المتبقي</span>
    <strong>${remaining.toLocaleString()} ر.س</strong>
  </div>

  <div class="note">صافي المتبقي = الراتب + العمل الإضافي - السحوبات / السلف</div>

  <div class="signatures">
    <div class="sign-line">توقيع السائق / المشغل</div>
    <div class="sign-line">توقيع الإدارة</div>
  </div>

  <footer>
    <span>تاريخ الإصدار: ${issueDate}</span>
    <span>ملخص حساب السائقين والمشغلين</span>
  </footer>
</div>
<script>
  window.onload = () => setTimeout(() => window.print(), 300);
</script>
</body>
</html>`;
  }

  function openDriverStatement(driver: Driver) {
    const win = window.open('', '_blank');

    if (!win) {
      alert('تعذر فتح كشف الحساب. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.');
      return;
    }

    win.document.open();
    win.document.write(buildDriverPdfHtml(driver));
    win.document.close();
  }

  function shareDriverOnWhatsApp(driver: Driver) {
    const text = encodeURIComponent(getDriverSummaryText(driver));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  async function shareDriver(driver: Driver) {
    const text = getDriverSummaryText(driver);

    try {
      if (navigator.share) {
        await navigator.share({
          title: `ملخص حساب ${driver.name}`,
          text,
        });
        return;
      }

      await navigator.clipboard.writeText(text);
      alert('تم نسخ ملخص الحساب. يمكنك لصقه في التطبيق الذي تريد.');
    } catch {
      // المستخدم أغلق نافذة المشاركة
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid #26364d',
    background: '#0d1728',
    color: '#ffffff',
    boxSizing: 'border-box',
    fontSize: '14px',
  };

  const cardStyle: React.CSSProperties = {
    background: '#0c1526',
    border: '1px solid #1f2e46',
    borderRadius: '18px',
    padding: '16px',
  };

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: '#050b16',
        color: '#ffffff',
        padding: '18px',
        paddingBottom: '60px',
      }}
    >
      <div style={{ maxWidth: 900, margin: 'auto' }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ margin: 0, fontSize: 27 }}>
            👷 رواتب السائقين
          </h1>

          <p
            style={{
              color: '#94a3b8',
              marginTop: 7,
              fontSize: 14,
            }}
          >
            حساب مستقل لكل سائق ومتابعة الراتب والعمل والغياب والسحوبات
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
            marginBottom: 18,
          }}
        >
          <div style={cardStyle}>
            <small style={{ color: '#94a3b8' }}>إجمالي الرواتب</small>
            <h3>{totals.salaries.toLocaleString()} ر.س</h3>
          </div>

          <div style={cardStyle}>
            <small style={{ color: '#94a3b8' }}>إجمالي الإضافي</small>
            <h3>{totals.extra.toLocaleString()} ر.س</h3>
          </div>

          <div style={cardStyle}>
            <small style={{ color: '#94a3b8' }}>إجمالي السحوبات</small>
            <h3>{totals.withdrawals.toLocaleString()} ر.س</h3>
          </div>

          <div style={cardStyle}>
            <small style={{ color: '#94a3b8' }}>إجمالي المتبقي</small>
            <h3>{totals.remaining.toLocaleString()} ر.س</h3>
          </div>
        </div>

        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <h2 style={{ marginTop: 0, fontSize: 19 }}>
            ➕ إضافة سائق
          </h2>

          <div style={{ display: 'grid', gap: 10 }}>
            <input
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم السائق"
            />

            <input
              style={inputStyle}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="رقم الجوال"
              inputMode="tel"
            />

            <input
              style={inputStyle}
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              placeholder="المعدة التي يعمل عليها"
            />

            <input
              style={inputStyle}
              type="number"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              placeholder="الراتب الشهري"
            />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}
            >
              <input
                style={inputStyle}
                type="number"
                value={workDays}
                onChange={(e) => setWorkDays(e.target.value)}
                placeholder="أيام العمل"
              />

              <input
                style={inputStyle}
                type="number"
                value={absentDays}
                onChange={(e) => setAbsentDays(e.target.value)}
                placeholder="أيام الغياب"
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}
            >
              <input
                style={inputStyle}
                type="number"
                value={extraAmount}
                onChange={(e) => setExtraAmount(e.target.value)}
                placeholder="قيمة العمل الإضافي"
              />

              <input
                style={inputStyle}
                type="number"
                value={withdrawals}
                onChange={(e) => setWithdrawals(e.target.value)}
                placeholder="السحوبات / السلف"
              />
            </div>

            <button
              onClick={addDriver}
              style={{
                padding: 14,
                border: 0,
                borderRadius: 13,
                fontWeight: 'bold',
                fontSize: 16,
                background: '#f5a623',
                color: '#111827',
              }}
            >
              حفظ السائق
            </button>
          </div>
        </div>

        <h2 style={{ fontSize: 19 }}>السائقون المسجلون</h2>

        {drivers.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center' }}>
            <p style={{ color: '#94a3b8' }}>
              لا يوجد سائقون مسجلون حتى الآن
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 13 }}>
            {drivers.map((driver) => {
              const remaining =
                driver.salary +
                driver.extraAmount -
                driver.withdrawals;

              return (
                <div key={driver.id} style={cardStyle}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <h3 style={{ margin: 0 }}>{driver.name}</h3>

                      <small style={{ color: '#94a3b8' }}>
                        {driver.equipment || 'بدون معدة محددة'}
                      </small>
                    </div>

                    <button
                      onClick={() => deleteDriver(driver.id)}
                      style={{
                        border: 0,
                        borderRadius: 10,
                        padding: '8px 11px',
                        background: '#411827',
                        color: '#ff7b87',
                      }}
                    >
                      حذف
                    </button>
                  </div>

                  {driver.phone && (
                    <p style={{ color: '#cbd5e1' }}>
                      📱 {driver.phone}
                    </p>
                  )}

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                      marginTop: 12,
                    }}
                  >
                    <label>
                      <small>الراتب</small>
                      <input
                        style={inputStyle}
                        type="number"
                        value={driver.salary}
                        onChange={(e) =>
                          updateDriver(
                            driver.id,
                            'salary',
                            e.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      <small>أيام العمل</small>
                      <input
                        style={inputStyle}
                        type="number"
                        value={driver.workDays}
                        onChange={(e) =>
                          updateDriver(
                            driver.id,
                            'workDays',
                            e.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      <small>أيام الغياب</small>
                      <input
                        style={inputStyle}
                        type="number"
                        value={driver.absentDays}
                        onChange={(e) =>
                          updateDriver(
                            driver.id,
                            'absentDays',
                            e.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      <small>الإضافي</small>
                      <input
                        style={inputStyle}
                        type="number"
                        value={driver.extraAmount}
                        onChange={(e) =>
                          updateDriver(
                            driver.id,
                            'extraAmount',
                            e.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      <small>السحوبات</small>
                      <input
                        style={inputStyle}
                        type="number"
                        value={driver.withdrawals}
                        onChange={(e) =>
                          updateDriver(
                            driver.id,
                            'withdrawals',
                            e.target.value
                          )
                        }
                      />
                    </label>

                    <div
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        background: '#10251e',
                      }}
                    >
                      <small style={{ color: '#94a3b8' }}>
                        المتبقي للسائق
                      </small>

                      <strong
                        style={{
                          display: 'block',
                          marginTop: 8,
                          color: '#47d78a',
                        }}
                      >
                        {remaining.toLocaleString()} ر.س
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                      marginTop: 14,
                    }}
                  >
                    <button
                      onClick={() => openDriverStatement(driver)}
                      style={{
                        padding: '12px 8px',
                        border: '1px solid #315f9d',
                        borderRadius: 12,
                        background: '#10294a',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: 13,
                      }}
                    >
                      📄 ملخص الحساب / PDF
                    </button>

                    <button
                      onClick={() => shareDriverOnWhatsApp(driver)}
                      style={{
                        padding: '12px 8px',
                        border: '1px solid #1f8b57',
                        borderRadius: 12,
                        background: '#123a29',
                        color: '#67e59c',
                        fontWeight: 800,
                        fontSize: 13,
                      }}
                    >
                      🟢 إرسال واتساب
                    </button>

                    <button
                      onClick={() => shareDriver(driver)}
                      style={{
                        padding: '12px 8px',
                        border: '1px solid #475569',
                        borderRadius: 12,
                        background: '#172033',
                        color: '#dbeafe',
                        fontWeight: 800,
                        fontSize: 13,
                      }}
                    >
                      ↗ مشاركة
                    </button>

                    <button
                      onClick={() =>
                        alert('يمكنك تعديل بيانات السائق مباشرة من الخانات الموجودة أعلى هذه الأزرار، ويتم الحفظ تلقائيًا.')
                      }
                      style={{
                        padding: '12px 8px',
                        border: '1px solid #8a651d',
                        borderRadius: 12,
                        background: '#3b2d0e',
                        color: '#f8c85a',
                        fontWeight: 800,
                        fontSize: 13,
                      }}
                    >
                      ✏️ تعديل البيانات
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
