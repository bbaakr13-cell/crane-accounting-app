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
    const now = new Date();
    const issueDate = now.toLocaleDateString('ar-SA');
    const issueTime = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

    const row = (label: string, value: string, detail: string, index: number) => `
      <div style="display:grid;grid-template-columns:1.25fr .8fr 1.05fr;background:${index % 2 ? '#fbfcfe' : '#ffffff'};border-top:1px solid #e7ebf1;font-size:14px;">
        <div style="padding:14px 12px;text-align:center;font-weight:800;color:#10233f;">${label}</div>
        <div style="padding:14px 12px;text-align:center;font-weight:800;color:#172033;">${value}</div>
        <div style="padding:14px 12px;text-align:center;color:#667085;">${detail}</div>
      </div>`;

    return `
      <div dir="rtl" style="width:794px;min-height:1123px;background:#ffffff;color:#111827;font-family:Arial,Tahoma,sans-serif;box-sizing:border-box;position:relative;overflow:hidden;padding:0 30px 28px;">
        <div style="height:18px;background:#062c57;margin:0 -30px 0;"></div>
        <div style="height:4px;background:#d3a43b;margin:0 -30px 0;"></div>

        <div style="display:flex;justify-content:center;margin-top:-1px;">
          <div style="background:#062c57;color:#e9bd57;border-radius:0 0 28px 28px;padding:12px 42px 13px;font-size:18px;font-weight:900;border-bottom:3px solid #d3a43b;">كشف حساب</div>
        </div>

        <div style="display:grid;grid-template-columns:170px 1fr 190px;gap:18px;align-items:start;margin-top:14px;">
          <div style="border:1px solid #dce2ea;border-radius:16px;padding:15px 16px;background:#fff;box-shadow:0 4px 14px rgba(15,35,65,.04);font-size:12px;">
            <div style="color:#667085;margin-bottom:5px;">تاريخ الإصدار</div><div style="font-weight:900;color:#10233f;font-size:15px;">${issueDate}</div>
            <div style="height:1px;background:#edf0f4;margin:12px 0;"></div>
            <div style="color:#667085;margin-bottom:5px;">وقت الإصدار</div><div style="font-weight:900;color:#10233f;font-size:15px;">${issueTime}</div>
          </div>

          <div style="text-align:center;padding-top:16px;">
            <h1 style="margin:0;color:#082f5d;font-size:31px;line-height:1.35;font-weight:900;">ملخص حساب السائق / المشغل</h1>
            <div style="margin-top:8px;color:#53657a;font-size:14px;">ملخص المستحقات والسحوبات</div>
            <div style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:15px;"><span style="height:1px;width:70px;background:#d3a43b;"></span><span style="width:7px;height:7px;border-radius:50%;background:#d3a43b;"></span><span style="height:1px;width:70px;background:#d3a43b;"></span></div>
          </div>

          <div style="border:1px solid #dce2ea;border-radius:16px;padding:15px 16px;background:#fff;box-shadow:0 4px 14px rgba(15,35,65,.04);font-size:12px;">
            <div style="color:#667085;margin-bottom:5px;">اسم السائق / المشغل</div><div style="font-weight:900;color:#10233f;font-size:17px;">${driver.name}</div>
            <div style="height:1px;background:#edf0f4;margin:12px 0;"></div>
            <div style="color:#667085;margin-bottom:5px;">رقم الجوال</div><div style="font-weight:900;color:#10233f;font-size:15px;">${driver.phone || '-'}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #dce2ea;border-radius:16px;background:#fbfcfe;margin-top:18px;overflow:hidden;">
          <div style="padding:16px 22px;border-left:1px solid #e5e9ef;"><div style="font-size:12px;color:#667085;">المعدة</div><div style="font-size:20px;font-weight:900;color:#10233f;margin-top:5px;">${driver.equipment || '-'}</div></div>
          <div style="padding:16px 22px;"><div style="font-size:12px;color:#667085;">تاريخ إصدار الملخص</div><div style="font-size:20px;font-weight:900;color:#10233f;margin-top:5px;">${issueDate}</div></div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:18px;">
          <div style="border-radius:16px;padding:16px 10px;text-align:center;background:#f3f7ff;border:1px solid #cfdcf1;"><div style="font-size:13px;font-weight:800;color:#174d96;">الراتب الشهري</div><div style="font-size:27px;font-weight:900;color:#174d96;margin-top:14px;">${driver.salary.toLocaleString()}</div><div style="font-size:13px;font-weight:800;color:#174d96;margin-top:4px;">ر.س</div></div>
          <div style="border-radius:16px;padding:16px 10px;text-align:center;background:#f2fbf6;border:1px solid #cce8d8;"><div style="font-size:13px;font-weight:800;color:#168152;">العمل الإضافي</div><div style="font-size:27px;font-weight:900;color:#168152;margin-top:14px;">${driver.extraAmount.toLocaleString()}</div><div style="font-size:13px;font-weight:800;color:#168152;margin-top:4px;">ر.س</div></div>
          <div style="border-radius:16px;padding:16px 10px;text-align:center;background:#fff9ed;border:1px solid #ead9ad;"><div style="font-size:13px;font-weight:800;color:#b47b13;">السحوبات / السلف</div><div style="font-size:27px;font-weight:900;color:#b47b13;margin-top:14px;">${driver.withdrawals.toLocaleString()}</div><div style="font-size:13px;font-weight:800;color:#b47b13;margin-top:4px;">ر.س</div></div>
          <div style="border-radius:16px;padding:16px 10px;text-align:center;background:#fff5f5;border:1px solid #efcccc;"><div style="font-size:13px;font-weight:800;color:#c12b2b;">أيام الغياب</div><div style="font-size:27px;font-weight:900;color:#c12b2b;margin-top:14px;">${driver.absentDays}</div><div style="font-size:13px;font-weight:800;color:#c12b2b;margin-top:4px;">يوم</div></div>
        </div>

        <div style="border:1px solid #d8dee8;border-radius:16px;overflow:hidden;margin-top:18px;box-shadow:0 4px 14px rgba(15,35,65,.035);">
          <div style="background:#062c57;color:#fff;text-align:center;font-size:18px;font-weight:900;padding:12px;border-bottom:2px solid #d3a43b;">تفاصيل الحساب</div>
          <div style="display:grid;grid-template-columns:1.25fr .8fr 1.05fr;background:#0b3c70;color:white;font-weight:900;font-size:14px;"><div style="padding:12px;text-align:center;">البيان</div><div style="padding:12px;text-align:center;border-right:1px solid rgba(255,255,255,.16);border-left:1px solid rgba(255,255,255,.16);">القيمة</div><div style="padding:12px;text-align:center;">التفاصيل</div></div>
          ${row('الراتب الشهري', `${driver.salary.toLocaleString()} ر.س`, `أيام العمل: ${driver.workDays}`, 0)}
          ${row('العمل الإضافي', `${driver.extraAmount.toLocaleString()} ر.س`, 'إضافة على المستحق', 1)}
          ${row('السحوبات / السلف', `${driver.withdrawals.toLocaleString()} ر.س`, 'خصم من المستحق', 2)}
          ${row('أيام الغياب', `${driver.absentDays} يوم`, 'للمتابعة', 3)}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1.25fr;align-items:center;background:#062c57;border:1px solid #062c57;border-radius:17px;margin-top:18px;overflow:hidden;box-shadow:0 8px 20px rgba(6,44,87,.12);">
          <div style="padding:18px 24px;text-align:center;border-left:1px solid rgba(255,255,255,.18);"><div style="font-size:13px;color:#e9bd57;font-weight:800;">صافي المبلغ المتبقي</div><div style="font-size:34px;color:#e9bd57;font-weight:900;margin-top:4px;">${remaining.toLocaleString()} <span style="font-size:18px;">ر.س</span></div></div>
          <div style="padding:18px 24px;text-align:center;"><div style="font-size:17px;color:#fff;font-weight:900;">صافي المبلغ المتبقي</div><div style="font-size:12px;color:#d5dfeb;margin-top:7px;">الراتب + الإضافي - السحوبات</div></div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:28px;border:1px solid #e1e6ed;border-radius:16px;padding:22px 28px 18px;text-align:center;color:#24364d;font-size:13px;">
          <div><div style="font-weight:800;margin-bottom:28px;">توقيع السائق / المشغل</div><div style="border-top:1px dashed #8793a3;"></div></div>
          <div><div style="font-weight:800;margin-bottom:28px;">توقيع الإدارة</div><div style="border-top:1px dashed #8793a3;"></div></div>
        </div>

        <div style="margin-top:20px;display:flex;justify-content:space-between;color:#718096;font-size:10px;padding:0 4px;"><span>تاريخ الإصدار: ${issueDate}</span><span>ملخص حساب السائق / المشغل</span></div>
        <div style="margin:12px -30px -28px;background:#062c57;border-top:3px solid #d3a43b;color:#fff;text-align:center;padding:13px;font-size:14px;font-weight:800;">شكراً لتعاملكم معنا</div>
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
