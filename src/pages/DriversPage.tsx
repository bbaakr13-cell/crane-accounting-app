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

    return `
      <div dir="rtl" style="width:794px;background:#ffffff;color:#111827;font-family:Arial,Tahoma,sans-serif;padding:42px;box-sizing:border-box;">
        <div style="height:10px;border-radius:99px;background:linear-gradient(90deg,#0f3f78,#1d5fa8);margin-bottom:24px;"></div>

        <div style="text-align:center;margin-bottom:26px;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:58px;height:58px;border-radius:18px;background:#edf4ff;color:#0f3f78;font-size:28px;margin-bottom:12px;">👷</div>
          <h1 style="margin:0;color:#0f3f78;font-size:30px;line-height:1.4;">ملخص حساب السائق / المشغل</h1>
          <div style="margin-top:7px;color:#64748b;font-size:14px;">كشف حساب مختصر وواضح للمستحقات والسحوبات</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;">
          <div style="border:1px solid #d9e2ee;border-radius:15px;padding:15px;background:#fbfdff;">
            <div style="font-size:12px;color:#64748b;margin-bottom:6px;">اسم السائق / المشغل</div>
            <div style="font-size:19px;font-weight:800;color:#0f172a;">${driver.name}</div>
          </div>
          <div style="border:1px solid #d9e2ee;border-radius:15px;padding:15px;background:#fbfdff;">
            <div style="font-size:12px;color:#64748b;margin-bottom:6px;">رقم الجوال</div>
            <div style="font-size:18px;font-weight:800;color:#0f172a;">${driver.phone || '-'}</div>
          </div>
          <div style="border:1px solid #d9e2ee;border-radius:15px;padding:15px;background:#fbfdff;">
            <div style="font-size:12px;color:#64748b;margin-bottom:6px;">المعدة</div>
            <div style="font-size:18px;font-weight:800;color:#0f172a;">${driver.equipment || '-'}</div>
          </div>
          <div style="border:1px solid #d9e2ee;border-radius:15px;padding:15px;background:#fbfdff;">
            <div style="font-size:12px;color:#64748b;margin-bottom:6px;">تاريخ إصدار الملخص</div>
            <div style="font-size:18px;font-weight:800;color:#0f172a;">${issueDate}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;">
          <div style="border-radius:15px;padding:15px;text-align:center;background:#eef5ff;border:1px solid #cddff8;">
            <div style="font-size:12px;color:#5b6b82;">الراتب الشهري</div>
            <div style="font-size:20px;font-weight:900;color:#0f3f78;margin-top:8px;">${driver.salary.toLocaleString()} ر.س</div>
          </div>
          <div style="border-radius:15px;padding:15px;text-align:center;background:#eefbf4;border:1px solid #c8ead7;">
            <div style="font-size:12px;color:#5b6b82;">العمل الإضافي</div>
            <div style="font-size:20px;font-weight:900;color:#15824f;margin-top:8px;">${driver.extraAmount.toLocaleString()} ر.س</div>
          </div>
          <div style="border-radius:15px;padding:15px;text-align:center;background:#fff7e8;border:1px solid #f0ddb2;">
            <div style="font-size:12px;color:#5b6b82;">السحوبات / السلف</div>
            <div style="font-size:20px;font-weight:900;color:#b66a00;margin-top:8px;">${driver.withdrawals.toLocaleString()} ر.س</div>
          </div>
          <div style="border-radius:15px;padding:15px;text-align:center;background:#fff0f0;border:1px solid #f1cccc;">
            <div style="font-size:12px;color:#5b6b82;">أيام الغياب</div>
            <div style="font-size:20px;font-weight:900;color:#b83232;margin-top:8px;">${driver.absentDays} يوم</div>
          </div>
        </div>

        <div style="border:1px solid #d9e2ee;border-radius:16px;overflow:hidden;margin-bottom:18px;">
          <div style="display:grid;grid-template-columns:1.3fr .8fr 1fr;background:#0f3f78;color:white;font-weight:800;font-size:14px;">
            <div style="padding:13px;text-align:center;">البيان</div><div style="padding:13px;text-align:center;">القيمة</div><div style="padding:13px;text-align:center;">التفاصيل</div>
          </div>
          ${[
            ['الراتب الشهري', `${driver.salary.toLocaleString()} ر.س`, `أيام العمل: ${driver.workDays}`],
            ['العمل الإضافي', `${driver.extraAmount.toLocaleString()} ر.س`, 'إضافة على المستحق'],
            ['السحوبات / السلف', `${driver.withdrawals.toLocaleString()} ر.س`, 'تخصم من المستحق'],
            ['أيام الغياب', `${driver.absentDays} يوم`, 'للمتابعة'],
          ].map((r, i) => `<div style="display:grid;grid-template-columns:1.3fr .8fr 1fr;background:${i % 2 ? '#fbfdff' : '#ffffff'};border-top:1px solid #e5eaf0;font-size:14px;"><div style="padding:13px;text-align:center;font-weight:700;">${r[0]}</div><div style="padding:13px;text-align:center;">${r[1]}</div><div style="padding:13px;text-align:center;color:#64748b;">${r[2]}</div></div>`).join('')}
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;border:2px solid #28a36a;background:#edfaf3;border-radius:18px;padding:20px 22px;margin-bottom:10px;">
          <div>
            <div style="font-size:14px;color:#4b6358;margin-bottom:5px;">صافي المبلغ المتبقي</div>
            <div style="font-size:12px;color:#718177;">الراتب + الإضافي - السحوبات</div>
          </div>
          <div style="font-size:30px;font-weight:900;color:#168754;">${remaining.toLocaleString()} ر.س</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:70px;margin-top:58px;text-align:center;color:#334155;font-size:14px;">
          <div><div style="border-top:1px dashed #64748b;padding-top:10px;">توقيع السائق / المشغل</div></div>
          <div><div style="border-top:1px dashed #64748b;padding-top:10px;">توقيع الإدارة</div></div>
        </div>

        <div style="margin-top:46px;border-top:2px solid #0f3f78;padding-top:12px;display:flex;justify-content:space-between;color:#64748b;font-size:11px;">
          <span>تاريخ الإصدار: ${issueDate}</span>
          <span>ملخص حساب السائقين والمشغلين</span>
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
