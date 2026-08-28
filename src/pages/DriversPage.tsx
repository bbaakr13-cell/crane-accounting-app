import React, { useEffect, useMemo, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

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
      '━━━━━━━━━━━━━━━━━━',
      `الاسم: ${driver.name}`,
      `رقم الجوال: ${driver.phone || '-'}`,
      `المعدة: ${driver.equipment || '-'}`,
      '',
      `الراتب الشهري: ${driver.salary.toLocaleString()} ر.س`,
      `أيام العمل: ${driver.workDays}`,
      `أيام الغياب: ${driver.absentDays}`,
      `العمل الإضافي: ${driver.extraAmount.toLocaleString()} ر.س`,
      `السحوبات / السلف: ${driver.withdrawals.toLocaleString()} ر.س`,
      '━━━━━━━━━━━━━━━━━━',
      `صافي المتبقي: ${remaining.toLocaleString()} ر.س`,
    ].join('\n');
  }

  function buildStatementMarkup(driver: Driver) {
    const remaining = getRemaining(driver);
    const issueDate = new Date().toLocaleDateString('ar-SA');
    const money = (value: number) => `${value.toLocaleString()} ر.س`;

    return `
      <div dir="rtl" style="width:794px;min-height:1123px;background:#f6f8fb;color:#172033;font-family:Tahoma,Arial,sans-serif;padding:34px;box-sizing:border-box;">
        <div style="background:#ffffff;border:1px solid #e3e8f0;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(15,35,65,.08);">
          <div style="height:8px;background:#123f73;"></div>

          <div style="padding:28px 30px 20px;text-align:center;border-bottom:1px solid #edf0f5;">
            <div style="display:inline-block;background:#eef4fb;color:#123f73;border-radius:14px;padding:8px 16px;font-size:12px;font-weight:700;margin-bottom:10px;">كشف حساب</div>
            <h1 style="margin:0;color:#102f55;font-size:28px;line-height:1.5;font-weight:900;">ملخص حساب السائق / المشغل</h1>
            <div style="margin-top:5px;color:#8290a3;font-size:12px;">ملخص المستحقات والسحوبات</div>
          </div>

          <div style="padding:22px 30px 0;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;">
              ${[
                ['اسم السائق / المشغل', driver.name],
                ['رقم الجوال', driver.phone || '-'],
                ['المعدة', driver.equipment || '-'],
                ['تاريخ إصدار الملخص', issueDate],
              ].map(([label, value]) => `
                <div style="background:#fafbfd;border:1px solid #e3e8f0;border-radius:14px;padding:14px 16px;min-height:55px;box-sizing:border-box;">
                  <div style="font-size:11px;color:#8995a6;margin-bottom:5px;">${label}</div>
                  <div style="font-size:17px;font-weight:800;color:#172033;">${value}</div>
                </div>`).join('')}
            </div>
          </div>

          <div style="padding:16px 30px 0;display:grid;grid-template-columns:repeat(4,1fr);gap:9px;">
            <div style="background:#edf4fc;border:1px solid #d7e5f5;border-radius:14px;padding:14px 8px;text-align:center;">
              <div style="font-size:11px;color:#64748b;">الراتب الشهري</div>
              <div style="font-size:18px;font-weight:900;color:#174d86;margin-top:7px;">${money(driver.salary)}</div>
            </div>
            <div style="background:#edf9f3;border:1px solid #d5eddf;border-radius:14px;padding:14px 8px;text-align:center;">
              <div style="font-size:11px;color:#64748b;">العمل الإضافي</div>
              <div style="font-size:18px;font-weight:900;color:#16805a;margin-top:7px;">${money(driver.extraAmount)}</div>
            </div>
            <div style="background:#fff8eb;border:1px solid #f2e4c3;border-radius:14px;padding:14px 8px;text-align:center;">
              <div style="font-size:11px;color:#64748b;">السحوبات / السلف</div>
              <div style="font-size:18px;font-weight:900;color:#a96a08;margin-top:7px;">${money(driver.withdrawals)}</div>
            </div>
            <div style="background:#fff1f1;border:1px solid #f1d8d8;border-radius:14px;padding:14px 8px;text-align:center;">
              <div style="font-size:11px;color:#64748b;">أيام الغياب</div>
              <div style="font-size:18px;font-weight:900;color:#b13b3b;margin-top:7px;">${driver.absentDays} يوم</div>
            </div>
          </div>

          <div style="padding:18px 30px 0;">
            <div style="border:1px solid #dfe5ed;border-radius:14px;overflow:hidden;">
              <div style="display:grid;grid-template-columns:1.2fr .85fr 1.15fr;background:#123f73;color:#ffffff;font-size:13px;font-weight:800;">
                <div style="padding:12px;text-align:center;">البيان</div>
                <div style="padding:12px;text-align:center;border-right:1px solid rgba(255,255,255,.12);">القيمة</div>
                <div style="padding:12px;text-align:center;border-right:1px solid rgba(255,255,255,.12);">التفاصيل</div>
              </div>
              ${[
                ['الراتب الشهري', money(driver.salary), `أيام العمل: ${driver.workDays}`],
                ['العمل الإضافي', money(driver.extraAmount), 'إضافة على المستحق'],
                ['السحوبات / السلف', money(driver.withdrawals), 'تخصم من المستحق'],
                ['أيام الغياب', `${driver.absentDays} يوم`, 'للمتابعة'],
              ].map((r, i) => `<div style="display:grid;grid-template-columns:1.2fr .85fr 1.15fr;background:${i % 2 ? '#fafbfd' : '#ffffff'};border-top:1px solid #e7ebf1;font-size:13px;"><div style="padding:12px;text-align:center;font-weight:700;color:#25324a;">${r[0]}</div><div style="padding:12px;text-align:center;font-weight:700;color:#25324a;border-right:1px solid #edf0f4;">${r[1]}</div><div style="padding:12px;text-align:center;color:#7a8799;border-right:1px solid #edf0f4;">${r[2]}</div></div>`).join('')}
            </div>
          </div>

          <div style="padding:18px 30px 0;">
            <div style="display:flex;align-items:center;justify-content:space-between;background:#ecf8f2;border:1.5px solid #48a97d;border-radius:16px;padding:18px 20px;">
              <div>
                <div style="font-size:14px;font-weight:800;color:#2d5e49;">صافي المبلغ المتبقي</div>
                <div style="font-size:11px;color:#729080;margin-top:4px;">الراتب + الإضافي - السحوبات</div>
              </div>
              <div style="font-size:27px;font-weight:900;color:#16805a;">${money(remaining)}</div>
            </div>
          </div>

          <div style="padding:50px 30px 28px;display:grid;grid-template-columns:1fr 1fr;gap:70px;text-align:center;color:#566579;font-size:12px;">
            <div style="border-top:1px dashed #9aa6b5;padding-top:9px;">توقيع السائق / المشغل</div>
            <div style="border-top:1px dashed #9aa6b5;padding-top:9px;">توقيع الإدارة</div>
          </div>

          <div style="margin:0 30px;border-top:1px solid #e4e9ef;padding:13px 0 18px;display:flex;justify-content:space-between;color:#9aa5b4;font-size:10px;">
            <span>تاريخ الإصدار: ${issueDate}</span>
            <span>ملخص حساب السائقين والمشغلين</span>
          </div>
        </div>
      </div>`;
  }

  async function createDriverPdf(driver: Driver) {
    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-10000px';
    host.style.top = '0';
    host.style.width = '794px';
    host.style.background = '#fff';
    host.innerHTML = buildStatementMarkup(driver);
    document.body.appendChild(host);

    try {
      const canvas = await html2canvas(host.firstElementChild as HTMLElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pageWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      const finalHeight = Math.min(imgHeight, pageHeight);
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, finalHeight, undefined, 'FAST');

      return pdf;
    } finally {
      document.body.removeChild(host);
    }
  }

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = String(reader.result || '');
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function saveOrSharePdf(driver: Driver, shareAfterSave = false) {
    try {
      const pdf = await createDriverPdf(driver);
      const safeName = driver.name.replace(/[^\w\u0600-\u06FF-]+/g, '-');
      const fileName = `ملخص-حساب-${safeName || 'سائق'}.pdf`;

      if (Capacitor.isNativePlatform()) {
        const blob = pdf.output('blob');
        const base64 = await blobToBase64(blob);
        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
          recursive: true,
        });

        if (shareAfterSave) {
          await Share.share({
            title: `ملخص حساب ${driver.name}`,
            text: getDriverSummaryText(driver),
            files: [result.uri],
            dialogTitle: 'مشاركة ملخص الحساب',
          });
        } else {
          await Share.share({
            title: fileName,
            text: 'تم تجهيز ملف PDF، اختر التطبيق الذي تريد حفظه أو فتحه من خلاله.',
            files: [result.uri],
            dialogTitle: 'حفظ / فتح ملف PDF',
          });
        }
      } else {
        pdf.save(fileName);
      }
    } catch (error) {
      console.error(error);
      alert('تعذر إنشاء ملف PDF. حاول مرة أخرى.');
    }
  }

  async function openDriverStatement(driver: Driver) {
    await saveOrSharePdf(driver, false);
  }

  async function shareDriverOnWhatsApp(driver: Driver) {
    const text = encodeURIComponent(getDriverSummaryText(driver));

    try {
      if (Capacitor.isNativePlatform()) {
        window.location.href = `whatsapp://send?text=${text}`;
        return;
      }

      window.open(`https://wa.me/?text=${text}`, '_blank');
    } catch {
      try {
        await Share.share({
          title: `ملخص حساب ${driver.name}`,
          text: getDriverSummaryText(driver),
          dialogTitle: 'اختر واتساب',
        });
      } catch {
        alert('تعذر فتح واتساب. استخدم زر المشاركة واختر واتساب.');
      }
    }
  }

  async function shareDriver(driver: Driver) {
    try {
      if (Capacitor.isNativePlatform()) {
        await saveOrSharePdf(driver, true);
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: `ملخص حساب ${driver.name}`,
          text: getDriverSummaryText(driver),
        });
      } else {
        await navigator.clipboard.writeText(getDriverSummaryText(driver));
        alert('تم نسخ ملخص الحساب.');
      }
    } catch (error) {
      console.error(error);
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
function buildStatementMarkup(driver: Driver) {
  const remaining = getRemaining(driver);

  const now = new Date();

  const issueDate = now.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const issueTime = now.toLocaleTimeString('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const money = (value: number) =>
    `${Number(value || 0).toLocaleString('ar-SA')} ر.س`;

  return `
    <div
      dir="rtl"
      style="
        width:794px;
        height:1123px;
        background:#ffffff;
        color:#10233f;
        font-family:Tahoma,Arial,sans-serif;
        box-sizing:border-box;
        overflow:hidden;
        position:relative;
      "
    >

      <!-- الهيدر العلوي -->
      <div
        style="
          height:18px;
          background:#072b55;
        "
      ></div>

      <div
        style="
          position:absolute;
          top:18px;
          left:50%;
          transform:translateX(-50%);
          background:#082f5d;
          color:#d8a83e;
          padding:10px 42px 12px;
          border-radius:0 0 28px 28px;
          font-size:15px;
          font-weight:900;
          border-bottom:3px solid #d8a83e;
        "
      >
        كشف حساب
      </div>

      <!-- معلومات الإصدار + معلومات السائق -->
      <div
        style="
          display:grid;
          grid-template-columns:160px 1fr 190px;
          gap:18px;
          padding:52px 28px 0;
          align-items:start;
        "
      >

        <!-- الإصدار -->
        <div
          style="
            border:1px solid #dce3ec;
            border-radius:18px;
            padding:14px 16px;
            background:#ffffff;
          "
        >
          <div
            style="
              font-size:10px;
              color:#7b8799;
              margin-bottom:4px;
            "
          >
            رقم النسخ
          </div>

          <div
            style="
              font-size:16px;
              font-weight:900;
              color:#102e54;
              margin-bottom:12px;
            "
          >
            01
          </div>

          <div
            style="
              height:1px;
              background:#edf0f4;
              margin-bottom:10px;
            "
          ></div>

          <div
            style="
              font-size:10px;
              color:#7b8799;
              margin-bottom:4px;
            "
          >
            تاريخ الإصدار
          </div>

          <div
            style="
              font-size:13px;
              font-weight:800;
              color:#102e54;
              margin-bottom:12px;
            "
          >
            ${issueDate}
          </div>

          <div
            style="
              height:1px;
              background:#edf0f4;
              margin-bottom:10px;
            "
          ></div>

          <div
            style="
              font-size:10px;
              color:#7b8799;
              margin-bottom:4px;
            "
          >
            وقت الإصدار
          </div>

          <div
            style="
              font-size:13px;
              font-weight:800;
              color:#102e54;
            "
          >
            ${issueTime}
          </div>
        </div>

        <!-- العنوان -->
        <div
          style="
            text-align:center;
            padding-top:14px;
          "
        >
          <div
            style="
              font-size:30px;
              line-height:1.4;
              font-weight:900;
              color:#082f5d;
              margin-bottom:5px;
            "
          >
            ملخص حساب السائق / المشغل
          </div>

          <div
            style="
              font-size:13px;
              color:#607086;
              margin-bottom:18px;
            "
          >
            ملخص المستحقات والسحوبات
          </div>

          <div
            style="
              width:180px;
              height:2px;
              margin:auto;
              background:linear-gradient(
                90deg,
                transparent,
                #d3a13a,
                #d3a13a,
                transparent
              );
            "
          ></div>
        </div>

        <!-- بيانات السائق -->
        <div
          style="
            border:1px solid #dce3ec;
            border-radius:18px;
            padding:16px;
            background:#ffffff;
            min-height:136px;
          "
        >
          <div
            style="
              font-size:10px;
              color:#7b8799;
              margin-bottom:5px;
            "
          >
            اسم السائق / المشغل
          </div>

          <div
            style="
              font-size:18px;
              font-weight:900;
              color:#102e54;
              margin-bottom:18px;
              word-break:break-word;
            "
          >
            ${driver.name}
          </div>

          <div
            style="
              font-size:10px;
              color:#7b8799;
              margin-bottom:5px;
            "
          >
            رقم الجوال
          </div>

          <div
            style="
              font-size:14px;
              font-weight:800;
              color:#102e54;
            "
          >
            ${driver.phone || '-'}
          </div>
        </div>
      </div>

      <!-- المعدة والتاريخ -->
      <div
        style="
          margin:20px 28px 0;
          background:#f8fafc;
          border:1px solid #dce3ec;
          border-radius:17px;
          display:grid;
          grid-template-columns:1fr 1fr;
          min-height:76px;
          overflow:hidden;
        "
      >
        <div
          style="
            padding:15px 22px;
            border-left:1px solid #dfe5ec;
          "
        >
          <div
            style="
              font-size:10px;
              color:#7b8799;
              margin-bottom:5px;
            "
          >
            المعدة
          </div>

          <div
            style="
              font-size:19px;
              font-weight:900;
              color:#102e54;
              word-break:break-word;
            "
          >
            ${driver.equipment || '-'}
          </div>
        </div>

        <div
          style="
            padding:15px 22px;
          "
        >
          <div
            style="
              font-size:10px;
              color:#7b8799;
              margin-bottom:5px;
            "
          >
            تاريخ إصدار الملخص
          </div>

          <div
            style="
              font-size:19px;
              font-weight:900;
              color:#102e54;
            "
          >
            ${issueDate}
          </div>
        </div>
      </div>

      <!-- البطاقات -->
      <div
        style="
          margin:18px 28px 0;
          display:grid;
          grid-template-columns:repeat(4,1fr);
          gap:11px;
        "
      >

        <!-- الراتب -->
        <div
          style="
            min-height:135px;
            border:1px solid #cddcf1;
            border-radius:18px;
            background:linear-gradient(180deg,#ffffff,#f4f8fe);
            text-align:center;
            padding:15px 8px;
            box-sizing:border-box;
          "
        >
          <div
            style="
              color:#174f94;
              font-size:12px;
              font-weight:800;
            "
          >
            الراتب الشهري
          </div>

          <div
            style="
              width:43px;
              height:43px;
              border-radius:50%;
              background:#e2ecfa;
              margin:13px auto 9px;
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:22px;
            "
          >
            💼
          </div>

          <div
            style="
              color:#124e97;
              font-size:22px;
              font-weight:900;
            "
          >
            ${driver.salary.toLocaleString('ar-SA')}
          </div>

          <div
            style="
              color:#245a94;
              font-size:11px;
              font-weight:800;
              margin-top:3px;
            "
          >
            ر.س
          </div>
        </div>

        <!-- الإضافي -->
        <div
          style="
            min-height:135px;
            border:1px solid #cee6d8;
            border-radius:18px;
            background:linear-gradient(180deg,#ffffff,#f2fbf6);
            text-align:center;
            padding:15px 8px;
            box-sizing:border-box;
          "
        >
          <div
            style="
              color:#187449;
              font-size:12px;
              font-weight:800;
            "
          >
            العمل الإضافي
          </div>

          <div
            style="
              width:43px;
              height:43px;
              border-radius:50%;
              background:#e3f4eb;
              margin:13px auto 9px;
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:22px;
            "
          >
            ⏱
          </div>

          <div
            style="
              color:#0f7b49;
              font-size:22px;
              font-weight:900;
            "
          >
            ${driver.extraAmount.toLocaleString('ar-SA')}
          </div>

          <div
            style="
              color:#21754d;
              font-size:11px;
              font-weight:800;
              margin-top:3px;
            "
          >
            ر.س
          </div>
        </div>

        <!-- السحوبات -->
        <div
          style="
            min-height:135px;
            border:1px solid #ead9b5;
            border-radius:18px;
            background:linear-gradient(180deg,#ffffff,#fff9ed);
            text-align:center;
            padding:15px 8px;
            box-sizing:border-box;
          "
        >
          <div
            style="
              color:#9c660c;
              font-size:12px;
              font-weight:800;
            "
          >
            السحوبات / السلف
          </div>

          <div
            style="
              width:43px;
              height:43px;
              border-radius:50%;
              background:#f8edd4;
              margin:13px auto 9px;
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:22px;
            "
          >
            💵
          </div>

          <div
            style="
              color:#b47810;
              font-size:22px;
              font-weight:900;
            "
          >
            ${driver.withdrawals.toLocaleString('ar-SA')}
          </div>

          <div
            style="
              color:#9c660c;
              font-size:11px;
              font-weight:800;
              margin-top:3px;
            "
          >
            ر.س
          </div>
        </div>

        <!-- الغياب -->
        <div
          style="
            min-height:135px;
            border:1px solid #efd1d1;
            border-radius:18px;
            background:linear-gradient(180deg,#ffffff,#fff5f5);
            text-align:center;
            padding:15px 8px;
            box-sizing:border-box;
          "
        >
          <div
            style="
              color:#b43939;
              font-size:12px;
              font-weight:800;
            "
          >
            أيام الغياب
          </div>

          <div
            style="
              width:43px;
              height:43px;
              border-radius:50%;
              background:#fae3e3;
              margin:13px auto 9px;
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:22px;
            "
          >
            📅
          </div>

          <div
            style="
              color:#c22f2f;
              font-size:22px;
              font-weight:900;
            "
          >
            ${driver.absentDays}
          </div>

          <div
            style="
              color:#b43939;
              font-size:11px;
              font-weight:800;
              margin-top:3px;
            "
          >
            يوم
          </div>
        </div>
      </div>

      <!-- تفاصيل الحساب -->
      <div
        style="
          margin:18px 28px 0;
          border:1px solid #dce3ec;
          border-radius:17px;
          overflow:hidden;
        "
      >
        <div
          style="
            background:#082f5d;
            color:#ffffff;
            text-align:center;
            font-size:16px;
            font-weight:900;
            padding:11px;
          "
        >
          تفاصيل الحساب
        </div>

        <div
          style="
            display:grid;
            grid-template-columns:80px 1.2fr .9fr 1.25fr;
            background:#0d3f73;
            color:#ffffff;
            font-size:12px;
            font-weight:800;
          "
        >
          <div style="padding:10px;text-align:center;">م</div>
          <div style="padding:10px;text-align:center;">البيان</div>
          <div style="padding:10px;text-align:center;">القيمة</div>
          <div style="padding:10px;text-align:center;">التفاصيل</div>
        </div>

        ${[
          [
            '1',
            'الراتب الشهري',
            money(driver.salary),
            `أيام العمل: ${driver.workDays}`,
          ],
          [
            '2',
            'العمل الإضافي',
            money(driver.extraAmount),
            'إضافة على المستحق',
          ],
          [
            '3',
            'السحوبات / السلف',
            money(driver.withdrawals),
            'خصم من المستحق',
          ],
          [
            '4',
            'أيام الغياب',
            `${driver.absentDays} يوم`,
            'للمتابعة',
          ],
        ]
          .map(
            (row, index) => `
              <div
                style="
                  display:grid;
                  grid-template-columns:80px 1.2fr .9fr 1.25fr;
                  background:${index % 2 === 0 ? '#ffffff' : '#f8fafc'};
                  border-top:1px solid #e5e9ef;
                  color:#24344c;
                  font-size:12px;
                "
              >
                <div
                  style="
                    padding:11px 8px;
                    text-align:center;
                    font-weight:800;
                  "
                >
                  ${row[0]}
                </div>

                <div
                  style="
                    padding:11px 8px;
                    text-align:center;
                    font-weight:800;
                    border-right:1px solid #edf0f4;
                  "
                >
                  ${row[1]}
                </div>

                <div
                  style="
                    padding:11px 8px;
                    text-align:center;
                    font-weight:900;
                    border-right:1px solid #edf0f4;
                  "
                >
                  ${row[2]}
                </div>

                <div
                  style="
                    padding:11px 8px;
                    text-align:center;
                    color:#758296;
                    border-right:1px solid #edf0f4;
                  "
                >
                  ${row[3]}
                </div>
              </div>
            `
          )
          .join('')}
      </div>

      <!-- الصافي -->
      <div
        style="
          margin:18px 28px 0;
          background:linear-gradient(135deg,#062b55,#0b4078);
          border-radius:18px;
          min-height:88px;
          padding:16px 24px;
          box-sizing:border-box;
          display:flex;
          align-items:center;
          justify-content:space-between;
          color:#ffffff;
          border-bottom:4px solid #d4a13a;
        "
      >
        <div>
          <div
            style="
              font-size:15px;
              font-weight:900;
              margin-bottom:5px;
            "
          >
            صافي المبلغ المتبقي
          </div>

          <div
            style="
              font-size:10px;
              color:#cad7e5;
            "
          >
            الراتب + الإضافي - السحوبات
          </div>
        </div>

        <div
          style="
            font-size:31px;
            line-height:1;
            font-weight:900;
            color:#e2b34d;
          "
        >
          ${remaining.toLocaleString('ar-SA')}
          <span
            style="
              font-size:14px;
              color:#ffffff;
            "
          >
            ر.س
          </span>
        </div>
      </div>

      <!-- التوقيعات -->
      <div
        style="
          margin:22px 28px 0;
          border:1px solid #dce3ec;
          border-radius:16px;
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:40px;
          padding:20px 30px 18px;
          text-align:center;
          min-height:78px;
          box-sizing:border-box;
        "
      >
        <div>
          <div
            style="
              font-size:12px;
              font-weight:800;
              color:#30415a;
              margin-bottom:23px;
            "
          >
            توقيع السائق / المشغل
          </div>

          <div
            style="
              border-top:1px dashed #9da9b8;
            "
          ></div>
        </div>

        <div>
          <div
            style="
              font-size:12px;
              font-weight:800;
              color:#30415a;
              margin-bottom:23px;
            "
          >
            توقيع الإدارة
          </div>

          <div
            style="
              border-top:1px dashed #9da9b8;
            "
          ></div>
        </div>
      </div>

      <!-- الفوتر -->
      <div
        style="
          position:absolute;
          left:0;
          right:0;
          bottom:0;
        "
      >
        <div
          style="
            padding:0 30px 7px;
            display:flex;
            justify-content:space-between;
            color:#8b98a9;
            font-size:9px;
          "
        >
          <span>
            تاريخ الإصدار: ${issueDate}
          </span>

          <span>
            ملخص حساب السائق / المشغل
          </span>
        </div>

        <div
          style="
            background:#062b55;
            color:#ffffff;
            text-align:center;
            padding:13px;
            font-size:14px;
            font-weight:900;
            border-top:3px solid #d4a13a;
          "
        >
          <span style="color:#d4a13a;">—</span>
          &nbsp;&nbsp;
          شكراً لتعاملكم معنا
          &nbsp;&nbsp;
          <span style="color:#d4a13a;">—</span>
        </div>
      </div>

    </div>
  `;
}
