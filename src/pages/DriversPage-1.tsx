import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import html2canvas from 'html2canvas';

import { jsPDF } from 'jspdf';

import {
  Filesystem,
  Directory,
} from '@capacitor/filesystem';

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
  driverImage?: string;
  equipmentImage?: string;
};

type ExpenseRecord = {
  id: number;
  date: string;

  driverId: string;
  driverName: string;

  equipmentId: string;
  equipmentName: string;

  category: string;
  amount: number;

  location: string;
  notes: string;

  affectsDriverBalance: boolean;

  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY =
  'crane_drivers_v1';

const EXPENSE_STORAGE_KEY =
  'crane_accounting_driver_equipment_expenses_v1';

type DriverSettlement = {
  id: string;
  driverId: number;
  driverName: string;
  equipment: string;
  period: string;
  createdAt: string;
  salary: number;
  extra: number;
  manualWithdrawals: number;
  automaticWithdrawals: number;
  previousPayments: number;
  previousAbsenceDeductions: number;
  workDays: number;
  absentDays: number;
  absenceDeduction: number;
  paidNow: number;
  balanceBefore: number;
  balanceAfter: number;
  note: string;
};

// New key only; legacy crane_drivers_v1 and expense records are never migrated/deleted.
const SETTLEMENTS_KEY = 'bakr_pro_driver_settlements_v1';
function safeMoney(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}
function currentPeriod() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; }
function periodText(period: string) {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('ar-SA-u-ca-gregory', { month: 'long', year: 'numeric' });
}
function safeText(text: unknown) {
  return String(text ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

export function DriversPage() {
  const [
    drivers,
    setDrivers,
  ] = useState<Driver[]>(() => {
    try {
      const saved =
        localStorage.getItem(
          STORAGE_KEY
        );

      return saved
        ? JSON.parse(saved)
        : [];
    } catch {
      return [];
    }
  });

  const [
    expenseRecords,
    setExpenseRecords,
  ] = useState<ExpenseRecord[]>([]);

  const [name, setName] =
    useState('');

  const [phone, setPhone] =
    useState('');

  const [
    equipment,
    setEquipment,
  ] = useState('');

  const [salary, setSalary] =
    useState('');

  const [
    workDays,
    setWorkDays,
  ] = useState('');

  const [
    absentDays,
    setAbsentDays,
  ] = useState('');

  const [
    extraAmount,
    setExtraAmount,
  ] = useState('');

  const [
    withdrawals,
    setWithdrawals,
  ] = useState('');

  const [
    driverImage,
    setDriverImage,
  ] = useState('');

  const [
    equipmentImage,
    setEquipmentImage,
  ] = useState('');

  const [settlements, setSettlements] = useState<DriverSettlement[]>(() => {
    try { const saved = JSON.parse(localStorage.getItem(SETTLEMENTS_KEY) || '[]'); return Array.isArray(saved) ? saved : []; }
    catch { return []; }
  });
  const [period, setPeriod] = useState(currentPeriod());
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [editingDriver, setEditingDriver] = useState<number | null>(null);
  const [openDriverId, setOpenDriverId] = useState<number | null>(null);
  const [settlingId, setSettlingId] = useState<number | null>(null);
  const [paidNow, setPaidNow] = useState('');
  const [absenceDeduction, setAbsenceDeduction] = useState('');
  const [settlementNote, setSettlementNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(SETTLEMENTS_KEY, JSON.stringify(settlements)); }
    catch (e) { console.error('تعذر حفظ التسويات:', e); alert('تعذر حفظ التسوية؛ تأكد من المساحة المتاحة'); }
  }, [settlements]);

  function getSettledPayments(driver: Driver) {
    return settlements.filter((s) => String(s.driverId) === String(driver.id))
      .reduce((n, s) => n + safeMoney(s.paidNow), 0);
  }
  function getAbsenceDeductions(driver: Driver) {
    return settlements.filter((s) => String(s.driverId) === String(driver.id))
      .reduce((n, s) => n + safeMoney(s.absenceDeduction), 0);
  }
  function openSettlement(driver: Driver) {
    setSettlingId(driver.id);
    setPaidNow(''); setAbsenceDeduction(''); setSettlementNote('');
  }
  function confirmSettlement(driver: Driver) {
    const balanceBefore = getRemaining(driver);
    const deduction = safeMoney(absenceDeduction);
    const paid = safeMoney(paidNow);
    if (!Number.isFinite(Number(absenceDeduction || 0)) || !Number.isFinite(Number(paidNow || 0)) || Number(absenceDeduction || 0) < 0 || Number(paidNow || 0) < 0) {
      alert('أدخل مبالغ صحيحة غير سالبة'); return;
    }
    if (deduction + paid <= 0) { alert('أدخل مبلغ الدفعة أو خصم الغياب'); return; }
    if (deduction + paid > Math.max(0, balanceBefore) + .001) { alert('إجمالي الدفعة والخصم أكبر من المتبقي الحالي'); return; }
    if (!window.confirm(`تأكيد حفظ التصفية للسائق ${driver.name}؟\nالدفعة: ${paid} ر.س\nخصم الغياب: ${deduction} ر.س`)) return;
    const settlement: DriverSettlement = {
      id: `settlement-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      driverId: driver.id, driverName: driver.name, equipment: driver.equipment,
      period: currentPeriod(), createdAt: new Date().toISOString(),
      salary: safeMoney(driver.salary), extra: safeMoney(driver.extraAmount),
      manualWithdrawals: safeMoney(driver.withdrawals), automaticWithdrawals: getAutomaticWithdrawals(driver),
      previousPayments: getSettledPayments(driver), previousAbsenceDeductions: getAbsenceDeductions(driver),
      workDays: safeMoney(driver.workDays), absentDays: safeMoney(driver.absentDays),
      absenceDeduction: deduction, paidNow: paid, balanceBefore,
      balanceAfter: balanceBefore - deduction - paid, note: settlementNote.trim(),
    };
    setSettlements(prev => [settlement, ...prev]);
    setSettlingId(null);
    alert('تم حفظ التصفية. أصبحت الدفعة والخصم ضمن رصيد السائق، وحُفظ كشف مستقل.');
  }
  async function saveSettlementPdf(entry: DriverSettlement) {
    setBusy(true);
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;z-index:-1;';
    const row = (label: string, value: string) => `<div style="display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding:15px 4px"><span>${safeText(label)}</span><strong>${safeText(value)}</strong></div>`;
    const amount = (n: number) => `${englishNumber(n)} ر.س`;
    host.innerHTML = `<div dir="rtl" style="box-sizing:border-box;width:794px;min-height:1122px;background:#fff;color:#112540;font:20px Tahoma,Arial,sans-serif;padding:36px">
       <div style="background:#071c35;color:#fff;border-bottom:7px solid #d5a84c;border-radius:18px;padding:33px"><div style="color:#e8ba61;font-size:23px;font-weight:900">BAKR PRO</div><h1 style="font-size:32px;margin:18px 0 8px">كشف تصفية حساب السائق</h1><div style="font-size:16px;color:#dbe3ec">كشف مالي محفوظ • ${safeText(periodText(entry.period))}</div></div>
       <div style="margin:28px 0;padding:22px;background:#f4f7fb;border-radius:16px">${row('اسم السائق',entry.driverName)}${row('المعدة',entry.equipment||'-')}${row('تاريخ التصفية',entry.createdAt.slice(0,10))}${row('الشهر',periodText(entry.period))}</div>
       ${row('الراتب الأساسي',amount(entry.salary))}${row('الإضافي',amount(entry.extra))}${row('السلف اليدوية السابقة',amount(entry.manualWithdrawals))}${row('السلف والحركات المرتبطة',amount(entry.automaticWithdrawals))}${row('دفعات تصفية سابقة',amount(entry.previousPayments))}${row('خصومات غياب سابقة',amount(entry.previousAbsenceDeductions))}
       <div style="background:#f2f6fb;border-radius:13px;padding:5px 20px;margin-top:15px">${row('المتبقي قبل هذه التصفية',amount(entry.balanceBefore))}${row('دفعة السائق الحالية',amount(entry.paidNow))}${row('خصم الغياب المعتمد',amount(entry.absenceDeduction))}</div>
       <div style="background:#0a392c;color:#fff;border-radius:13px;padding:20px;display:flex;justify-content:space-between;font-weight:bold;margin-top:25px"><span>المتبقي بعد التصفية</span><span>${amount(entry.balanceAfter)}</span></div>
       <p style="font-size:15px;margin-top:18px;line-height:1.8">ملاحظات: ${safeText(entry.note || 'لا توجد')}</p>
       <div style="display:flex;gap:45px;justify-content:space-between;margin-top:65px"><div>توقيع السائق<br/>____________________</div><div>توقيع المسؤول<br/>____________________</div></div>
       <div style="text-align:center;font-size:12px;color:#64748b;margin-top:52px">BAKR PRO • وثيقة إدارية داخلية لحساب السائق</div>
       </div>`;
    document.body.appendChild(host);
    try {
      const canvas = await html2canvas(host.firstElementChild as HTMLElement, {scale:2, backgroundColor:'#fff',useCORS:true});
      const doc = new jsPDF({unit:'mm',format:'a4',orientation:'portrait'});
      doc.addImage(canvas.toDataURL('image/jpeg',.96),'JPEG',0,0,210,297,undefined,'FAST');
      const fileName = `BAKR-PRO-Driver-${entry.driverName.replace(/[^\w\u0600-\u06FF-]+/g,'-')}-${entry.period}.pdf`;
      if (Capacitor.isNativePlatform()) {
        try {
          const uri = await Filesystem.writeFile({path:`BAKR_PRO/${fileName}`,data:doc.output('datauristring').split(',')[1],directory:Directory.Documents,recursive:true});
          alert('تم حفظ كشف التصفية في المستندات: BAKR_PRO');
          console.info('Saved settlement:',uri.uri);
        } catch {
          const fallback = await Filesystem.writeFile({path:fileName,data:doc.output('datauristring').split(',')[1],directory:Directory.Cache});
          await Share.share({title:'كشف تصفية السائق',files:[fallback.uri],dialogTitle:'حفظ أو مشاركة كشف التصفية'});
        }
      } else doc.save(fileName);
    } catch (e) { console.error(e); alert('تعذر حفظ الكشف، حاول مرة أخرى'); }
    finally { host.remove(); setBusy(false); }
  }

  /* =========================
     حفظ السائقين
  ========================= */

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(drivers)
      );
    } catch (error) {
      console.error(
        'تعذر حفظ السائقين:',
        error
      );
    }
  }, [drivers]);

  /* =========================
     قراءة مصاريف السواقين
     والمعدات
  ========================= */

  function loadExpenseRecords() {
    try {
      const raw =
        localStorage.getItem(
          EXPENSE_STORAGE_KEY
        );

      if (!raw) {
        setExpenseRecords([]);

        return;
      }

      const parsed =
        JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        setExpenseRecords([]);

        return;
      }

      setExpenseRecords(
        parsed as ExpenseRecord[]
      );
    } catch (error) {
      console.error(
        'تعذر تحميل حركات السائقين:',
        error
      );

      setExpenseRecords([]);
    }
  }

  useEffect(() => {
    loadExpenseRecords();

    const handleStorage = (
      event: StorageEvent
    ) => {
      if (
        !event.key ||
        event.key ===
          EXPENSE_STORAGE_KEY
      ) {
        loadExpenseRecords();
      }
    };

    const handleFocus = () => {
      loadExpenseRecords();
    };

    const handleUpdated = () => {
      loadExpenseRecords();
    };

    window.addEventListener(
      'storage',
      handleStorage
    );

    window.addEventListener(
      'focus',
      handleFocus
    );

    window.addEventListener(
      'driver-equipment-expenses-updated',
      handleUpdated
    );

    return () => {
      window.removeEventListener(
        'storage',
        handleStorage
      );

      window.removeEventListener(
        'focus',
        handleFocus
      );

      window.removeEventListener(
        'driver-equipment-expenses-updated',
        handleUpdated
      );
    };
  }, []);

  /* =========================
     تحديد الحركات الخاصة
     بالسائق
  ========================= */

  function getDriverExpenseRecords(
    driver: Driver
  ) {
    return expenseRecords.filter(
      (record) => {
        const idMatch =
          String(
            record.driverId ||
              ''
          ) ===
          String(driver.id);

        const nameMatch =
          !record.driverId &&
          String(
            record.driverName ||
              ''
          ).trim() ===
            String(
              driver.name ||
                ''
            ).trim();

        return (
          idMatch ||
          nameMatch
        );
      }
    );
  }

  /* =========================
     السلف والسحوبات
     التلقائية فقط
  ========================= */

  function getAutomaticWithdrawals(
    driver: Driver
  ) {
    return getDriverExpenseRecords(
      driver
    )
      .filter(
        (record) =>
          record.affectsDriverBalance ===
            true ||
          record.category ===
            'سلفة / سحب'
      )
      .reduce(
        (sum, record) =>
          sum +
          (Number(
            record.amount
          ) || 0),
        0
      );
  }

  function getTotalWithdrawals(
    driver: Driver
  ) {
    return (
      (Number(
        driver.withdrawals
      ) || 0) +
      getAutomaticWithdrawals(
        driver
      )
    );
  }

  function getRemaining(
    driver: Driver
  ) {
    return (
      (Number(driver.salary) ||
        0) +
      (Number(
        driver.extraAmount
      ) || 0) -
      getTotalWithdrawals(
        driver
      ) -
      getSettledPayments(driver) -
      getAbsenceDeductions(driver)
    );
  }

  /* =========================
     الإجماليات
  ========================= */

  const totals =
    useMemo(() => {
      return drivers.reduce(
        (result, driver) => {
          const automatic =
            getAutomaticWithdrawals(
              driver
            );

          const totalWithdrawal =
            (Number(
              driver.withdrawals
            ) || 0) +
            automatic;

          result.salaries +=
            Number(
              driver.salary
            ) || 0;

          result.extra +=
            Number(
              driver.extraAmount
            ) || 0;

          result.manualWithdrawals +=
            Number(
              driver.withdrawals
            ) || 0;

          result.autoWithdrawals +=
            automatic;

          result.withdrawals +=
            totalWithdrawal;

          result.remaining +=
            (Number(
              driver.salary
            ) || 0) +
            (Number(
              driver.extraAmount
            ) || 0) -
            totalWithdrawal -
            getSettledPayments(driver) -
            getAbsenceDeductions(driver);

          return result;
        },
        {
          salaries: 0,
          extra: 0,

          manualWithdrawals: 0,
          autoWithdrawals: 0,

          withdrawals: 0,
          remaining: 0,
        }
      );
    }, [
      drivers,
      expenseRecords,
      settlements,
    ]);

  function readImageFile(
    file: File | undefined,
    onDone: (value: string) => void
  ) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('اختر ملف صورة فقط');
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      onDone(String(reader.result || ''));
    };

    reader.onerror = () => {
      alert('تعذر قراءة الصورة');
    };

    reader.readAsDataURL(file);
  }

  function updateDriverImage(
    id: number,
    field: 'driverImage' | 'equipmentImage',
    file: File | undefined
  ) {
    readImageFile(file, (value) => {
      setDrivers((old) =>
        old.map((driver) =>
          driver.id === id
            ? { ...driver, [field]: value }
            : driver
        )
      );
    });
  }

  /* =========================
     إضافة سائق
  ========================= */

  function addDriver() {
    if (!name.trim()) {
      alert(
        'اكتب اسم السائق'
      );

      return;
    }

    if (
      !salary ||
      Number(salary) <= 0
    ) {
      alert(
        'اكتب راتب السائق'
      );

      return;
    }

    const driver: Driver = {
      id: Date.now(),

      name:
        name.trim(),

      phone:
        phone.trim(),

      equipment:
        equipment.trim(),

      salary:
        Number(salary),

      workDays:
        Number(
          workDays || 0
        ),

      absentDays:
        Number(
          absentDays || 0
        ),

      extraAmount:
        Number(
          extraAmount || 0
        ),

      withdrawals:
        Number(
          withdrawals || 0
        ),

      driverImage:
        driverImage || '',

      equipmentImage:
        equipmentImage || '',
    };

    setDrivers(
      (old) => [
        driver,
        ...old,
      ]
    );

    setName('');
    setPhone('');
    setEquipment('');
    setSalary('');
    setWorkDays('');
    setAbsentDays('');
    setExtraAmount('');
    setWithdrawals('');
    setDriverImage('');
    setEquipmentImage('');
  }

  /* =========================
     حذف سائق
  ========================= */

  function deleteDriver(
    id: number
  ) {
    const ok = confirm(
      'هل تريد حذف هذا السائق؟'
    );

    if (!ok) {
      return;
    }

    setDrivers((old) =>
      old.filter(
        (driver) =>
          driver.id !== id
      )
    );
  }

  /* =========================
     تعديل بيانات السائق
  ========================= */

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
                field ===
                  'name' ||
                field ===
                  'phone' ||
                field ===
                  'equipment' ||
                field ===
                  'driverImage' ||
                field ===
                  'equipmentImage'
                  ? value
                  : Number(
                      value ||
                        0
                    ),
            }
          : driver
      )
    );
  }

  /* =========================
     عرض الأرقام
  ========================= */

  function englishNumber(
    value: number
  ) {
    return Number(
      value || 0
    ).toLocaleString(
      'en-US'
    );
  }

  /* =========================
     ملخص نصي
  ========================= */

  function getDriverSummaryText(
    driver: Driver
  ) {
    const automatic =
      getAutomaticWithdrawals(
        driver
      );

    const totalWithdrawals =
      getTotalWithdrawals(
        driver
      );

    const remaining =
      getRemaining(driver);

    return [
      'ملخص حساب السائق / المشغل',
      '━━━━━━━━━━━━━━━━━━',

      `الاسم: ${driver.name}`,

      `رقم الجوال: ${
        driver.phone || '-'
      }`,

      `المعدة: ${
        driver.equipment || '-'
      }`,

      '',

      `الراتب الشهري: ${englishNumber(
        driver.salary
      )} ر.س`,

      `أيام العمل: ${englishNumber(
        driver.workDays
      )}`,

      `أيام الغياب: ${englishNumber(
        driver.absentDays
      )}`,

      `العمل الإضافي: ${englishNumber(
        driver.extraAmount
      )} ر.س`,

      `السحوبات اليدوية: ${englishNumber(
        driver.withdrawals
      )} ر.س`,

      `السلف / السحوبات التلقائية: ${englishNumber(
        automatic
      )} ر.س`,

      `إجمالي السحوبات: ${englishNumber(
        totalWithdrawals
      )} ر.س`,
      `دفعات تصفية الراتب: ${englishNumber(getSettledPayments(driver))} ر.س`,
      `خصومات الغياب المعتمدة: ${englishNumber(getAbsenceDeductions(driver))} ر.س`,

      '━━━━━━━━━━━━━━━━━━',

      `صافي المتبقي: ${englishNumber(
        remaining
      )} ر.س`,
    ].join('\n');
  }

  /* =========================
     تصميم كشف PDF
  ========================= */

  function buildStatementMarkup(
    driver: Driver
  ) {
    const automatic =
      getAutomaticWithdrawals(driver);

    const totalWithdrawals =
      getTotalWithdrawals(driver);

    const remaining =
      getRemaining(driver);

    const movements =
      getDriverExpenseRecords(driver);

    const now = new Date();

    const issueDate =
      now.toLocaleDateString('en-GB');

    const issueTime =
      now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

    const money = (value: number) =>
      `${englishNumber(value)} ر.س`;

    const esc = (value: unknown) =>
      String(value ?? '-')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const movementRows =
      movements.length === 0
        ? `
          <div style="padding:18px;text-align:center;color:#64748b;font-size:13px;">
            لا توجد حركات مرتبطة بهذا السائق
          </div>
        `
        : movements
            .slice(0, 10)
            .map(
              (movement, index) => `
                <div style="
                  display:grid;
                  grid-template-columns:105px 120px 1fr 105px;
                  border-top:1px solid #dce5ef;
                  background:${index % 2 ? '#f8fbff' : '#ffffff'};
                  font-size:12px;
                  min-height:37px;
                  align-items:center;
                ">
                  <div style="padding:8px;text-align:center;font-weight:700;">
                    ${esc(movement.date || '-')}
                  </div>
                  <div style="padding:8px;text-align:center;font-weight:800;color:#0b2f59;">
                    ${esc(movement.category || 'مصروف')}
                  </div>
                  <div style="padding:8px;text-align:center;color:#526273;">
                    ${esc(movement.notes || movement.location || '-')}
                  </div>
                  <div style="
                    padding:8px;
                    text-align:center;
                    font-weight:900;
                    color:${
                      movement.affectsDriverBalance ||
                      movement.category === 'سلفة / سحب'
                        ? '#a86500'
                        : '#334155'
                    };
                  ">
                    ${money(Number(movement.amount) || 0)}
                  </div>
                </div>
              `
            )
            .join('');

    return `
      <div
        dir="rtl"
        style="
          width:794px;
          min-height:1123px;
          background:#f7f9fc;
          color:#0f2745;
          font-family:Arial,Tahoma,sans-serif;
          box-sizing:border-box;
          position:relative;
          overflow:hidden;
          padding-bottom:0;
        "
      >
        <div style="
          background:linear-gradient(135deg,#031d38 0%,#073b6b 55%,#06294d 100%);
          color:#fff;
          min-height:146px;
          padding:18px 28px 20px;
          position:relative;
          box-sizing:border-box;
          border-bottom:5px solid #e6ad2e;
        ">
          <div style="
            position:absolute;
            left:-45px;
            top:-90px;
            width:240px;
            height:240px;
            border:5px solid rgba(230,173,46,.75);
            border-radius:50%;
          "></div>

          <div style="
            display:grid;
            grid-template-columns:155px 1fr 155px;
            align-items:center;
            position:relative;
            z-index:2;
          ">
            <div style="font-size:11px;line-height:1.75;color:#e6edf5;text-align:left;direction:ltr;">
              <div style="font-weight:800;color:#f2c65e;">DATE / TIME</div>
              <div>${issueDate}</div>
              <div>${issueTime}</div>
            </div>

            <div style="text-align:center;">
              <div style="
                font-size:38px;
                font-weight:900;
                letter-spacing:1px;
                color:#ffffff;
                direction:ltr;
              ">
                BAKR <span style="color:#f2c65e;">PRO</span>
              </div>
              <div style="font-size:25px;font-weight:900;margin-top:5px;">
                كشف حساب السائق / المشغل
              </div>
              <div style="font-size:12px;color:#d9e3ef;margin-top:6px;">
                الرواتب والمستحقات والسحوبات والحركات
              </div>
            </div>

            <div style="text-align:right;">
              <div style="
                display:inline-block;
                border:1px solid rgba(242,198,94,.65);
                color:#f2c65e;
                border-radius:12px;
                padding:9px 12px;
                font-size:11px;
                font-weight:800;
                line-height:1.6;
              ">
                إدارة المعدات<br/>
                والمشاريع باحترافية
              </div>
            </div>
          </div>
        </div>

        <div style="padding:18px 28px 0;">
          <div style="
            display:grid;
            grid-template-columns:1.02fr .98fr;
            gap:14px;
          ">
            <div style="
              background:#ffffff;
              border:1px solid #cbd8e6;
              border-radius:16px;
              overflow:hidden;
              box-shadow:0 3px 10px rgba(15,39,69,.08);
            ">
              ${
                driver.equipmentImage
                  ? `<img src="${driver.equipmentImage}" style="display:block;width:100%;height:174px;object-fit:cover;" />`
                  : `<div style="
                      height:174px;
                      display:flex;
                      align-items:center;
                      justify-content:center;
                      background:linear-gradient(135deg,#e8eef5,#f8fafc);
                      color:#75869a;
                      font-size:15px;
                      font-weight:800;
                    ">صورة الكرين / المعدة</div>`
              }
              <div style="text-align:center;padding:8px 12px 10px;">
                <div style="
                  display:inline-block;
                  background:#f2c65e;
                  color:#102d50;
                  border-radius:999px;
                  padding:4px 16px;
                  font-size:11px;
                  font-weight:900;
                  margin-top:-23px;
                  position:relative;
                ">المعدة</div>
                <div style="font-size:22px;font-weight:900;margin-top:4px;">
                  ${esc(driver.equipment || 'غير محددة')}
                </div>
              </div>
            </div>

            <div style="
              background:#ffffff;
              border:1px solid #cbd8e6;
              border-radius:16px;
              padding:16px;
              box-shadow:0 3px 10px rgba(15,39,69,.08);
              display:grid;
              grid-template-columns:1fr 132px;
              gap:14px;
              align-items:center;
            ">
              <div>
                <div style="font-size:12px;color:#64748b;font-weight:700;">
                  اسم السائق / المشغل
                </div>
                <div style="font-size:29px;font-weight:900;margin-top:5px;color:#092c54;">
                  ${esc(driver.name)}
                </div>
                <div style="
                  margin-top:12px;
                  font-size:17px;
                  font-weight:900;
                  direction:ltr;
                  text-align:right;
                  color:#102d50;
                ">
                  ☎ ${esc(driver.phone || '-')}
                </div>
                <div style="height:1px;background:#d5dee8;margin:15px 0 11px;"></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;">
                  <div>
                    <div style="color:#718096;">أيام العمل</div>
                    <strong style="font-size:15px;">${englishNumber(driver.workDays)}</strong>
                  </div>
                  <div>
                    <div style="color:#718096;">تاريخ الإصدار</div>
                    <strong style="font-size:12px;direction:ltr;display:block;">${issueDate}</strong>
                  </div>
                </div>
              </div>

              <div style="text-align:center;">
                ${
                  driver.driverImage
                    ? `<img src="${driver.driverImage}" style="
                        width:126px;
                        height:126px;
                        object-fit:cover;
                        border-radius:50%;
                        border:4px solid #e6ad2e;
                        box-shadow:0 3px 10px rgba(15,39,69,.18);
                      " />`
                    : `<div style="
                        width:126px;
                        height:126px;
                        border-radius:50%;
                        border:4px solid #e6ad2e;
                        background:#e9eff6;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        color:#718096;
                        font-weight:800;
                      ">صورة المشغل</div>`
                }
                <div style="
                  display:inline-block;
                  margin-top:8px;
                  padding:4px 10px;
                  border-radius:999px;
                  background:#edf3f9;
                  font-size:10px;
                  font-weight:800;
                  color:#24496f;
                ">
                  # ${String(driver.id).slice(-4)}
                </div>
              </div>
            </div>
          </div>

          <div style="
            display:grid;
            grid-template-columns:repeat(4,1fr);
            gap:10px;
            margin-top:14px;
          ">
            <div style="background:#eef5ff;border:1px solid #b9d3f2;border-radius:14px;padding:12px;text-align:center;">
              <div style="font-size:12px;color:#245a94;font-weight:900;">الراتب الشهري</div>
              <div style="font-size:28px;color:#0b4b91;font-weight:900;margin-top:5px;">${englishNumber(driver.salary)}</div>
              <div style="font-size:10px;">ر.س</div>
            </div>
            <div style="background:#eefaf3;border:1px solid #b9e0c9;border-radius:14px;padding:12px;text-align:center;">
              <div style="font-size:12px;color:#218451;font-weight:900;">العمل الإضافي</div>
              <div style="font-size:28px;color:#168152;font-weight:900;margin-top:5px;">${englishNumber(driver.extraAmount)}</div>
              <div style="font-size:10px;">ر.س</div>
            </div>
            <div style="background:#fff8e9;border:1px solid #ead39b;border-radius:14px;padding:12px;text-align:center;">
              <div style="font-size:12px;color:#9b6505;font-weight:900;">إجمالي السحوبات</div>
              <div style="font-size:28px;color:#a86500;font-weight:900;margin-top:5px;">${englishNumber(totalWithdrawals)}</div>
              <div style="font-size:10px;">ر.س</div>
            </div>
            <div style="background:#fff0f0;border:1px solid #efc0c0;border-radius:14px;padding:12px;text-align:center;">
              <div style="font-size:12px;color:#b52828;font-weight:900;">أيام الغياب</div>
              <div style="font-size:28px;color:#c22d2d;font-weight:900;margin-top:5px;">${englishNumber(driver.absentDays)}</div>
              <div style="font-size:10px;">يوم</div>
            </div>
          </div>

          <div style="
            margin-top:14px;
            border:1px solid #cbd8e6;
            border-radius:14px;
            overflow:hidden;
            background:#fff;
          ">
            <div style="
              background:#073b6b;
              color:#fff;
              padding:9px 14px;
              text-align:center;
              font-size:16px;
              font-weight:900;
              border-bottom:2px solid #e6ad2e;
            ">
              تفاصيل الحساب
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;font-size:12px;">
              <div style="padding:9px 14px;border-bottom:1px solid #e3e9f0;">الراتب الشهري</div>
              <div style="padding:9px 14px;border-bottom:1px solid #e3e9f0;font-weight:900;">${money(driver.salary)}</div>

              <div style="padding:9px 14px;border-bottom:1px solid #e3e9f0;">العمل الإضافي</div>
              <div style="padding:9px 14px;border-bottom:1px solid #e3e9f0;font-weight:900;">${money(driver.extraAmount)}</div>

              <div style="padding:9px 14px;border-bottom:1px solid #e3e9f0;">السحوبات اليدوية</div>
              <div style="padding:9px 14px;border-bottom:1px solid #e3e9f0;font-weight:900;">${money(driver.withdrawals)}</div>

              <div style="padding:9px 14px;border-bottom:1px solid #e3e9f0;">السلف / السحوبات التلقائية</div>
              <div style="padding:9px 14px;border-bottom:1px solid #e3e9f0;font-weight:900;color:#a86500;">${money(automatic)}</div>

              <div style="padding:9px 14px;background:#fff8e9;font-weight:900;">إجمالي السحوبات</div>
              <div style="padding:9px 14px;background:#fff8e9;font-weight:900;color:#a86500;">${money(totalWithdrawals)}</div>

              <div style="padding:9px 14px;border-top:1px solid #e3e9f0;">دفعات تصفية الراتب</div>
              <div style="padding:9px 14px;border-top:1px solid #e3e9f0;font-weight:900;">${money(getSettledPayments(driver))}</div>

              <div style="padding:9px 14px;border-top:1px solid #e3e9f0;">خصومات الغياب المعتمدة</div>
              <div style="padding:9px 14px;border-top:1px solid #e3e9f0;font-weight:900;">${money(getAbsenceDeductions(driver))}</div>
            </div>
          </div>

          <div style="
            margin-top:12px;
            background:linear-gradient(135deg,#052846,#083f70);
            border:2px solid #e6ad2e;
            border-radius:16px;
            color:#fff;
            padding:13px 18px;
            display:flex;
            align-items:center;
            justify-content:center;
            gap:22px;
            text-align:center;
          ">
            <div style="font-size:34px;">💰</div>
            <div>
              <div style="font-size:13px;color:#f2c65e;font-weight:900;">صافي المبلغ المتبقي</div>
              <div style="font-size:33px;color:#f2c65e;font-weight:900;margin-top:2px;direction:ltr;">
                ${englishNumber(remaining)} ر.س
              </div>
              <div style="font-size:10px;color:#dce6ef;">
                الراتب + الإضافي - السحوبات - دفعات التصفية - خصومات الغياب
              </div>
            </div>
          </div>

          <div style="
            margin-top:12px;
            border:1px solid #cbd8e6;
            border-radius:14px;
            overflow:hidden;
            background:#fff;
          ">
            <div style="
              background:#073b6b;
              color:#fff;
              padding:9px 14px;
              text-align:center;
              font-size:15px;
              font-weight:900;
            ">
              الحركات المرتبطة بالسائق
            </div>

            <div style="
              display:grid;
              grid-template-columns:105px 120px 1fr 105px;
              background:#e8f0f8;
              color:#0f2745;
              font-size:11px;
              font-weight:900;
            ">
              <div style="padding:8px;text-align:center;">التاريخ</div>
              <div style="padding:8px;text-align:center;">النوع</div>
              <div style="padding:8px;text-align:center;">البيان</div>
              <div style="padding:8px;text-align:center;">المبلغ</div>
            </div>

            ${movementRows}
          </div>

          <div style="
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:14px;
            margin-top:13px;
            margin-bottom:16px;
          ">
            <div style="
              height:65px;
              background:#fff;
              border:1px solid #cbd8e6;
              border-radius:13px;
              padding:11px 18px;
              text-align:center;
              box-sizing:border-box;
            ">
              <div style="font-size:12px;font-weight:900;">توقيع السائق / المشغل</div>
              <div style="border-top:1px dashed #8291a3;margin-top:27px;"></div>
            </div>

            <div style="
              height:65px;
              background:#fff;
              border:1px solid #cbd8e6;
              border-radius:13px;
              padding:11px 18px;
              text-align:center;
              box-sizing:border-box;
            ">
              <div style="font-size:12px;font-weight:900;">توقيع الإدارة</div>
              <div style="border-top:1px dashed #8291a3;margin-top:27px;"></div>
            </div>
          </div>
        </div>

        <div style="
          background:#052846;
          border-top:4px solid #e6ad2e;
          color:#fff;
          text-align:center;
          padding:10px;
          font-size:12px;
          font-weight:900;
        ">
          تم إعداد هذا الكشف بواسطة BAKR PRO
        </div>
      </div>
    `;
  }

  /* =========================
     إنشاء PDF
  ========================= */

  async function createDriverPdf(
    driver: Driver
  ) {
    const host =
      document.createElement(
        'div'
      );

    host.style.position =
      'fixed';

    host.style.left =
      '-10000px';

    host.style.top =
      '0';

    host.style.width =
      '794px';

    host.style.background =
      '#fff';

    host.innerHTML =
      buildStatementMarkup(
        driver
      );

    document.body.appendChild(
      host
    );

    try {
      const canvas =
        await html2canvas(
          host.firstElementChild as HTMLElement,
          {
            scale: 2,

            backgroundColor:
              '#ffffff',

            useCORS: true,
          }
        );

      const pdf =
        new jsPDF({
          orientation:
            'portrait',

          unit:
            'mm',

          format:
            'a4',
        });

      const imgData =
        canvas.toDataURL(
          'image/jpeg',
          0.95
        );

      const pageWidth =
        210;

      const pageHeight =
        297;

      const imgHeight =
        (canvas.height *
          pageWidth) /
        canvas.width;

      const finalHeight =
        Math.min(
          imgHeight,
          pageHeight
        );

      pdf.addImage(
        imgData,
        'JPEG',
        0,
        0,
        pageWidth,
        finalHeight,
        undefined,
        'FAST'
      );

      return pdf;
    } finally {
      document.body.removeChild(
        host
      );
    }
  }

  function blobToBase64(
    blob: Blob
  ): Promise<string> {
    return new Promise(
      (resolve, reject) => {
        const reader =
          new FileReader();

        reader.onloadend =
          () => {
            const result =
              String(
                reader.result ||
                  ''
              );

            resolve(
              result.includes(
                ','
              )
                ? result.split(
                    ','
                  )[1]
                : result
            );
          };

        reader.onerror =
          reject;

        reader.readAsDataURL(
          blob
        );
      }
    );
  }

  async function saveOrSharePdf(
    driver: Driver,
    shareAfterSave = false
  ) {
    try {
      const pdf =
        await createDriverPdf(
          driver
        );

      const safeName =
        driver.name.replace(
          /[^\w\u0600-\u06FF-]+/g,
          '-'
        );

      const fileName =
        `ملخص-حساب-${
          safeName ||
          'سائق'
        }.pdf`;

      if (
        Capacitor.isNativePlatform()
      ) {
        const blob =
          pdf.output(
            'blob'
          );

        const base64 =
          await blobToBase64(
            blob
          );

        const result =
          await Filesystem.writeFile(
            {
              path:
                fileName,

              data:
                base64,

              directory:
                Directory.Cache,

              recursive:
                true,
            }
          );

        if (
          shareAfterSave
        ) {
          await Share.share({
            title:
              `ملخص حساب ${driver.name}`,

            text:
              getDriverSummaryText(
                driver
              ),

            files: [
              result.uri,
            ],

            dialogTitle:
              'مشاركة ملخص الحساب',
          });
        } else {
          try {
            await Filesystem.writeFile({
              path: `BAKR_PRO/${fileName}`,
              data: base64,
              directory: Directory.Documents,
              recursive: true,
            });
            alert('تم حفظ PDF في مجلد المستندات / BAKR_PRO');
          } catch (saveError) {
            console.warn('تعذر حفظ المستندات؛ فتح نافذة المشاركة',saveError);
            await Share.share({ title:fileName, files:[result.uri], dialogTitle:'حفظ PDF' });
          }
        }
      } else {
        pdf.save(
          fileName
        );
      }
    } catch (error) {
      console.error(
        error
      );

      alert(
        'تعذر إنشاء ملف PDF. حاول مرة أخرى.'
      );
    }
  }

  async function openDriverStatement(
    driver: Driver
  ) {
    await saveOrSharePdf(
      driver,
      false
    );
  }

  async function shareDriverOnWhatsApp(
    driver: Driver
  ) {
    const text =
      encodeURIComponent(
        getDriverSummaryText(
          driver
        )
      );

    try {
      if (
        Capacitor.isNativePlatform()
      ) {
        window.location.href =
          `whatsapp://send?text=${text}`;

        return;
      }

      window.open(
        `https://wa.me/?text=${text}`,
        '_blank'
      );
    } catch {
      try {
        await Share.share({
          title:
            `ملخص حساب ${driver.name}`,

          text:
            getDriverSummaryText(
              driver
            ),

          dialogTitle:
            'اختر واتساب',
        });
      } catch {
        alert(
          'تعذر فتح واتساب. استخدم زر المشاركة واختر واتساب.'
        );
      }
    }
  }

  async function shareDriver(
    driver: Driver
  ) {
    try {
      if (
        Capacitor.isNativePlatform()
      ) {
        await saveOrSharePdf(
          driver,
          true
        );

        return;
      }

      if (
        navigator.share
      ) {
        await navigator.share({
          title:
            `ملخص حساب ${driver.name}`,

          text:
            getDriverSummaryText(
              driver
            ),
        });
      } else {
        await navigator.clipboard.writeText(
          getDriverSummaryText(
            driver
          )
        );

        alert(
          'تم نسخ ملخص الحساب.'
        );
      }
    } catch (error) {
      console.error(
        error
      );
    }
  }

  /* BAKR PRO - premium drivers dashboard: legacy storage remains untouched. */
  const panel: React.CSSProperties = {
    background: 'linear-gradient(145deg,#102943,#081629 85%)',
    border: '1px solid rgba(227,184,94,.29)', borderRadius: 21,
    padding: 16, boxShadow: '0 12px 30px rgba(0,0,0,.24)',
  };
  const field: React.CSSProperties = {
    width:'100%', background:'#061426',color:'#f8fafc', border:'1px solid #294460',
    borderRadius:13, padding:'12px 10px',fontSize:15,boxSizing:'border-box',outline:'none',
  };
  const button: React.CSSProperties = {
    minHeight:46,borderRadius:13,padding:'10px 12px',fontSize:13,fontWeight:800,
    cursor:'pointer', border:'1px solid #4e6982',background:'#102a47',color:'#e8f0ff',
  };
  const moneyText = (n: number) => `${englishNumber(n)} ر.س`;
  const monthSettlements = settlements.filter(s => s.period === period);

  return (
    <div dir="rtl" style={{minHeight:'100vh',background:'linear-gradient(180deg,#071320,#020915)',color:'#f8fafc',padding:'18px 13px 100px',fontFamily:'Tahoma,Arial,sans-serif'}}>
      <div style={{maxWidth:980,margin:'0 auto'}}>
        <header style={{...panel,background:'linear-gradient(125deg,#102a4d,#07172b)',marginBottom:14,borderColor:'#c19a4d'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <div>
              <div style={{color:'#f1c972',fontWeight:950,letterSpacing:'.07em',fontSize:12}}>BAKR PRO</div>
              <h1 style={{margin:'7px 0 5px',fontSize:23,color:'#fff'}}>👷 حسابات السواقين والمشغلين</h1>
              <div style={{fontSize:11,color:'#aabdd2'}}>رواتب • سلف • أيام العمل • تسويات • كشف حساب</div>
            </div>
            <button style={{...button,background:'linear-gradient(130deg,#f8d778,#b88b34)',border:0,color:'#162033'}} onClick={()=>setShowAddDriver(!showAddDriver)}>
              {showAddDriver?'إغلاق الإضافة':'＋ إضافة سائق'}
            </button>
          </div>
        </header>

        <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10,marginBottom:15}}>
          {([
            ['إجمالي الرواتب',totals.salaries,'#f4d28b','💼'],
            ['إجمالي السلف',totals.withdrawals,'#f5b768','💰'],
            ['إجمالي المتبقي',totals.remaining,'#6fe6ad','💚'],
            ['إجمالي الإضافي',totals.extra,'#70baff','⚡'],
          ] as const).map(([label,value,color,icon])=>(
            <div key={label} style={{...panel,padding:13,borderColor:`${color}46`}}>
              <div style={{fontSize:12,color:'#aebdd0',display:'flex',justifyContent:'space-between'}}><span>{label}</span><span>{icon}</span></div>
              <div style={{fontSize:21,fontWeight:950,color,marginTop:12,direction:'ltr',textAlign:'right'}}>{moneyText(value)}</div>
            </div>
          ))}
        </div>

        <section style={{...panel,marginBottom:15}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
            <div><div style={{fontWeight:900,fontSize:16}}>📅 أرشيف تصفيات السائقين</div><div style={{fontSize:11,color:'#a9b9cd',marginTop:6}}>اختيار الشهر يعرض التصفيات المحفوظة؛ الأرصدة أعلاه جارية وليست محصورة بالشهر.</div></div>
            <input aria-label="شهر أرشيف التسويات" type="month" value={period} onChange={e=>setPeriod(e.target.value)} style={{...field,width:173,colorScheme:'dark'}}/>
          </div>
          <div style={{fontSize:12,color:'#e6bc71',marginTop:11}}>المحفوظ في {periodText(period)}: {monthSettlements.length} تصفية</div>
        </section>

        {showAddDriver && <section style={{...panel,marginBottom:17}}>
          <h2 style={{fontSize:19,margin:'0 0 15px',color:'#f2cf7d'}}>➕ إضافة سائق جديد</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>
            <label style={{gridColumn:'1 / -1'}}>اسم السائق<input style={field} value={name} onChange={e=>setName(e.target.value)} placeholder="اسم السائق"/></label>
            <label>رقم الجوال<input style={field} inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="05..."/></label>
            <label>المعدة<input style={field} value={equipment} onChange={e=>setEquipment(e.target.value)} placeholder="كرين / بوم ترك"/></label>
            <label>الراتب الأساسي<input style={field} type="number" min="0" value={salary} onChange={e=>setSalary(e.target.value)}/></label>
            <label>أيام العمل<input style={field} type="number" min="0" value={workDays} onChange={e=>setWorkDays(e.target.value)}/></label>
            <label>أيام الغياب<input style={field} type="number" min="0" value={absentDays} onChange={e=>setAbsentDays(e.target.value)}/></label>
            <label>الإضافي<input style={field} type="number" min="0" value={extraAmount} onChange={e=>setExtraAmount(e.target.value)}/></label>
            <label style={{gridColumn:'1 / -1'}}>سحوبات يدوية قديمة<input style={field} type="number" min="0" value={withdrawals} onChange={e=>setWithdrawals(e.target.value)}/></label>
            <label style={{...panel,textAlign:'center',borderStyle:'dashed',fontSize:12}}>📷 صورة السائق (اختياري)
              {driverImage && <img src={driverImage} alt="السائق" style={{width:'100%',height:85,objectFit:'cover',borderRadius:10}}/>}
              <input type="file" accept="image/*" style={{width:'100%',fontSize:9,marginTop:9}} onChange={e=>readImageFile(e.target.files?.[0],setDriverImage)}/>
            </label>
            <label style={{...panel,textAlign:'center',borderStyle:'dashed',fontSize:12}}>🏗️ صورة المعدة (اختياري)
              {equipmentImage && <img src={equipmentImage} alt="المعدة" style={{width:'100%',height:85,objectFit:'cover',borderRadius:10}}/>}
              <input type="file" accept="image/*" style={{width:'100%',fontSize:9,marginTop:9}} onChange={e=>readImageFile(e.target.files?.[0],setEquipmentImage)}/>
            </label>
          </div>
          <button style={{...button,width:'100%',background:'#ecc56f',color:'#0b1a2c',border:0,marginTop:14}} onClick={()=>{addDriver(); if(name.trim() && Number(salary)>0) setShowAddDriver(false)}}>💾 حفظ السائق</button>
        </section>}

        <h2 style={{fontSize:18,margin:'20px 4px 14px'}}>👥 السائقون المسجلون ({drivers.length})</h2>
        {drivers.length === 0 && <div style={panel}>لا يوجد سائقون. أضف أول سائق من الزر بالأعلى.</div>}
        <div style={{display:'grid',gap:15}}>
          {drivers.map(driver=>{
            const automatic = getAutomaticWithdrawals(driver);
            const withdrawalsTotal = getTotalWithdrawals(driver);
            const paid = getSettledPayments(driver);
            const deductions = getAbsenceDeductions(driver);
            const remaining = getRemaining(driver);
            const movements = getDriverExpenseRecords(driver);
            const isEditing = editingDriver === driver.id;
            const isOpen = openDriverId === driver.id;
            const driverSettlements = monthSettlements.filter(s=>String(s.driverId)===String(driver.id));
            const summaryCards: Array<[string,string,string,string]> = [
              ['الراتب الأساسي',moneyText(safeMoney(driver.salary)),'#f4d27b','💼'],
              ['إجمالي السلف',moneyText(withdrawalsTotal),'#f6ba71','💰'],
              ['المتبقي للسائق',moneyText(remaining),'#6cf0ad','💚'],
              ['أيام العمل',`${englishNumber(driver.workDays)} يوم`,'#75c4ff','📆'],
              ['أيام الغياب',`${englishNumber(driver.absentDays)} يوم`,'#f397b9','🕒'],
              ['العمل الإضافي',moneyText(safeMoney(driver.extraAmount)),'#8bd7ff','⚡'],
            ];
            return <article key={driver.id} style={{...panel,padding:16,borderColor:'rgba(228,180,87,.42)'}}>
              <div style={{display:'flex',alignItems:'center',gap:12,justifyContent:'space-between',flexWrap:'wrap'}}>
                <div style={{display:'flex',alignItems:'center',gap:10,flex:1,minWidth:185}}>
                  <label title="تغيير صورة السائق" style={{cursor:'pointer'}}>
                    {driver.driverImage ? <img src={driver.driverImage} alt={driver.name} style={{width:66,height:66,objectFit:'cover',borderRadius:18,border:'2px solid #d9b063'}}/>:
                      <div style={{width:66,height:66,border:'2px solid #d9b063',borderRadius:18,background:'#152f4b',display:'grid',placeItems:'center',fontSize:26}}>👤</div>}
                    <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>updateDriverImage(driver.id,'driverImage',e.target.files?.[0])}/>
                  </label>
                  <div><div style={{fontSize:20,fontWeight:950,color:'#fff'}}>{driver.name}</div>
                    <div style={{color:'#62e9a5',fontSize:11,marginTop:5}}>● نشط</div>
                    <div style={{fontSize:11,color:'#b9cce0',marginTop:5}}>📱 {driver.phone || 'لم يُسجل رقم الجوال'}</div>
                  </div>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center',minWidth:130}}>
                  <label title="تغيير صورة المعدة" style={{cursor:'pointer'}}>
                    {driver.equipmentImage ? <img src={driver.equipmentImage} alt="المعدة" style={{width:70,height:62,objectFit:'cover',borderRadius:13,border:'1px solid #deb064'}}/>:
                      <span style={{display:'inline-grid',width:60,height:60,placeItems:'center',border:'1px solid #a37e46',borderRadius:13,background:'#332714',fontSize:23}}>🏗️</span>}
                    <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>updateDriverImage(driver.id,'equipmentImage',e.target.files?.[0])}/>
                  </label>
                  <div style={{fontSize:12,color:'#ebd69d'}}>{driver.equipment || 'بدون معدة محددة'}</div>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:9,marginTop:18}}>
                {summaryCards.map(([label,value,color,icon])=><div key={label} style={{background:`linear-gradient(130deg,${color}13,#07172b)`,border:`1px solid ${color}58`,padding:'13px 11px',borderRadius:16,minWidth:0}}>
                  <div style={{fontSize:11,color:'#aebfd1',display:'flex',justifyContent:'space-between',gap:4}}><span>{label}</span><span>{icon}</span></div>
                  <div style={{fontWeight:950,fontSize:19,marginTop:12,color,overflowWrap:'anywhere'}}>{value}</div>
                </div>)}
              </div>
              {(paid>0||deductions>0||automatic>0) && <p style={{fontSize:11,color:'#b5c4d6',margin:'11px 3px 0'}}>
                سلف تلقائية: {moneyText(automatic)} • دفعات تصفية محفوظة: {moneyText(paid)} • خصومات غياب معتمدة: {moneyText(deductions)}
              </p>}
              <button type="button" style={{...button,width:'100%',marginTop:14,background:'linear-gradient(90deg,#ffe497,#d4a13e)',border:0,color:'#111b2b',fontSize:16,minHeight:53}} onClick={()=>openSettlement(driver)}>💰 تصفية حساب السائق</button>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,marginTop:9}}>
                <button style={{...button,background:'#092746',borderColor:'#2d74b7'}} onClick={()=>openDriverStatement(driver)}>📄 حفظ PDF</button>
                <button style={{...button,background:'#07392c',borderColor:'#158451',color:'#9ef7bd'}} onClick={()=>shareDriverOnWhatsApp(driver)}>🟢 واتساب</button>
                <button style={{...button,background:'#0a223c',borderColor:'#507ca7'}} onClick={()=>shareDriver(driver)}>↗ مشاركة كشف PDF</button>
                <button style={button} onClick={()=>{setEditingDriver(isEditing?null:driver.id);setOpenDriverId(null)}}>✏️ {isEditing?'إغلاق التعديل':'تعديل البيانات'}</button>
                <button style={button} onClick={()=>{setOpenDriverId(isOpen?null:driver.id);setEditingDriver(null)}}>☰ {isOpen?'إخفاء الحركات':'الحركات المرتبطة'} ({movements.length})</button>
              </div>
              {isEditing && <div style={{...panel,marginTop:12,borderColor:'#7e662b'}}>
                <div style={{fontSize:12,color:'#f6c969',marginBottom:9}}>تُحفظ التعديلات تلقائيًا. السلف التلقائية تأتي من قسم مصاريف السائقين.</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>
                  {([['الاسم','name'],['رقم الجوال','phone'],['المعدة','equipment'],['الراتب','salary'],['أيام العمل','workDays'],['أيام الغياب','absentDays'],['الإضافي','extraAmount'],['سحوبات يدوية قديمة','withdrawals']] as Array<[string, keyof Driver]>).map(([label,key])=><label key={key} style={{fontSize:12,color:'#d6e2ed'}}>{label}<input style={{...field,marginTop:5}} type={['salary','workDays','absentDays','extraAmount','withdrawals'].includes(key)?'number':'text'} min="0" value={String(driver[key]??'')} onChange={e=>updateDriver(driver.id,key,e.target.value)}/></label>)}
                </div>
                <button style={{...button,marginTop:16,color:'#ff9b9b',borderColor:'#a24b54'}} onClick={()=>deleteDriver(driver.id)}>حذف السائق (بعد التأكيد)</button>
              </div>}
              {isOpen && <section style={{...panel,marginTop:13}}>
                <h3 style={{margin:'0 0 9px',fontSize:16}}>📋 الحركات المرتبطة ({movements.length})</h3>
                {movements.length===0?<p style={{color:'#8da4bd',fontSize:12}}>لا توجد حركات مرتبطة.</p>:<div style={{display:'grid',gap:7}}>{movements.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,30).map(m=><div key={m.id} style={{padding:10,background:'#07172a',border:'1px solid #28415a',borderRadius:12,display:'flex',justifyContent:'space-between',gap:10}}>
                  <div><div style={{fontSize:12,fontWeight:900,color:'#eac77e'}}>{m.category || 'مصروف'}</div><div style={{fontSize:10,color:'#9baec2',marginTop:5}}>{m.date || '-'} • {m.notes||m.location||'-'}</div></div>
                  <strong style={{color:'#f6cd7c',fontSize:13,whiteSpace:'nowrap'}}>{moneyText(safeMoney(m.amount))}</strong>
                </div>)}</div>}
                {movements.length>30&&<p style={{fontSize:11,color:'#a4b2c4'}}>آخر 30 حركة؛ سجل جميع الحركات في قسم المصاريف.</p>}
              </section>}
              <div style={{marginTop:13,background:'#091a2d',border:'1px solid #263e59',borderRadius:13,padding:12}}>
                <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}><strong style={{fontSize:13}}>📆 تصفيات {periodText(period)}</strong><span style={{color:'#f0ca7d',fontSize:11}}>{driverSettlements.length} محفوظة</span></div>
                {driverSettlements.length===0 && <p style={{fontSize:11,color:'#8194ac',margin:'8px 0 0'}}>لا يوجد كشف تصفية محفوظ للسائق في هذا الشهر.</p>}
                {driverSettlements.map(entry=><div key={entry.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,borderTop:'1px solid #243c56',marginTop:10,paddingTop:10}}>
                  <div style={{fontSize:11}}>{new Date(entry.createdAt).toLocaleDateString('en-GB')}<br/><b style={{color:'#7fe1ad'}}>مدفوع: {moneyText(entry.paidNow)}</b> • خصم: {moneyText(entry.absenceDeduction)}<br/><span style={{color:'#dbe5ef'}}>بعد التصفية: {moneyText(entry.balanceAfter)}</span></div>
                  <button disabled={busy} style={{...button,fontSize:11}} onClick={()=>saveSettlementPdf(entry)}>📄 PDF</button>
                </div>)}
              </div>
            </article>;
          })}
        </div>
        <p style={{fontSize:11,lineHeight:1.9,color:'#8fa6bb',marginTop:20}}>تنبيه محاسبي: الأرصدة القديمة من بيانات السائق السابقة، وتشمل السلف اليدوية والحركات المرتبطة مهما كان تاريخها. اختيار الشهر هنا مخصص لأرشفة تصفيات الراتب الجديدة؛ لا ننقل السجلات القديمة تلقائيًا إلى شهر معين حتى لا تتغير حساباتك.</p>
      </div>
      {settlingId !== null && (()=>{
        const d=drivers.find(x=>x.id===settlingId); if(!d) return null;
        const before=getRemaining(d), deduction=safeMoney(absenceDeduction), payout=safeMoney(paidNow);
        return <div style={{position:'fixed',inset:0,zIndex:10000,background:'rgba(0,0,0,.78)',overflowY:'auto',padding:'25px 10px',display:'grid',placeItems:'start center'}}>
          <section dir="rtl" style={{...panel,maxWidth:540,width:'100%',boxSizing:'border-box',border:'2px solid #d4a94b',background:'#0c2038',margin:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:9}}><h2 style={{fontSize:21,margin:'0 0 12px',color:'#f6d079'}}>💰 تصفية حساب السائق</h2><button style={{...button,minHeight:35}} onClick={()=>setSettlingId(null)}>✕</button></div>
            <p style={{fontSize:13,color:'#cbd5e1'}}>{d.name} • {d.equipment || 'بدون معدة'} • {periodText(currentPeriod())}</p>
            <div style={{background:'#071728',padding:13,borderRadius:14,lineHeight:2.4,fontSize:13}}>
              <div>الراتب الأساسي: <strong>{moneyText(safeMoney(d.salary))}</strong></div>
              <div>الإضافي: <strong>{moneyText(safeMoney(d.extraAmount))}</strong></div>
              <div>إجمالي السلف والحركات المحسوبة: <strong>{moneyText(getTotalWithdrawals(d))}</strong></div>
              <div>دفعات تسوية سابقة: <strong>{moneyText(getSettledPayments(d))}</strong></div>
              <div>خصومات غياب سابقة: <strong>{moneyText(getAbsenceDeductions(d))}</strong></div>
              <div style={{color:'#66e0a3',fontWeight:900,fontSize:17}}>المتبقي الحالي: {moneyText(before)}</div>
            </div>
            <p style={{fontSize:11,color:'#f6c77c',lineHeight:1.8}}>لن نخصم أيام الغياب تلقائيًا. أدخل قيمة الخصم بنفسك عند الموافقة على تسوية الغياب.</p>
            <label style={{display:'block',marginTop:12,fontSize:13}}>مبلغ دفعة الراتب الآن<input style={{...field,marginTop:6}} inputMode="decimal" type="number" min="0" value={paidNow} placeholder="0" onChange={e=>setPaidNow(e.target.value)}/></label>
            <label style={{display:'block',marginTop:12,fontSize:13}}>خصم غياب متفق عليه (اختياري)<input style={{...field,marginTop:6}} inputMode="decimal" type="number" min="0" value={absenceDeduction} placeholder="0" onChange={e=>setAbsenceDeduction(e.target.value)}/></label>
            <label style={{display:'block',marginTop:12,fontSize:13}}>ملاحظات التصفية<textarea style={{...field,marginTop:6,minHeight:65}} value={settlementNote} onChange={e=>setSettlementNote(e.target.value)} placeholder="سبب الدفعة أو ملاحظة"/></label>
            <div style={{background:'#063a2d',color:'#abf9ce',borderRadius:13,padding:14,fontWeight:900,margin:'14px 0'}}>المتبقي بعد التصفية: {moneyText(before-payout-deduction)}</div>
            <button style={{...button,width:'100%',background:'linear-gradient(130deg,#f9dd88,#be8b34)',border:0,color:'#122035',fontSize:16}} onClick={()=>confirmSettlement(d)}>💾 تأكيد وحفظ التصفية</button>
            <button style={{...button,width:'100%',marginTop:8}} onClick={()=>setSettlingId(null)}>إلغاء</button>
          </section>
        </div>;
      })()}
    </div>
  );
}
