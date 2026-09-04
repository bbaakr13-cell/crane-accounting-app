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
      )
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
            totalWithdrawal;

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
    ]);

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
                  'equipment'
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
      getAutomaticWithdrawals(
        driver
      );

    const totalWithdrawals =
      getTotalWithdrawals(
        driver
      );

    const remaining =
      getRemaining(
        driver
      );

    const movements =
      getDriverExpenseRecords(
        driver
      );

    const now =
      new Date();

    const issueDate =
      now.toLocaleDateString(
        'en-GB'
      );

    const issueTime =
      now.toLocaleTimeString(
        'en-US',
        {
          hour:
            '2-digit',

          minute:
            '2-digit',
        }
      );

    const money = (
      value: number
    ) =>
      `${englishNumber(
        value
      )} ر.س`;

    const movementRows =
      movements.length === 0
        ? `
          <div style="
            padding:18px;
            text-align:center;
            color:#64748b;
            font-size:13px;
          ">
            لا توجد حركات مرتبطة بهذا السائق
          </div>
        `
        : movements
            .slice(0, 12)
            .map(
              (
                movement,
                index
              ) => `
          <div style="
            display:grid;
            grid-template-columns:
              105px 120px 1fr 110px;
            border-top:
              1px solid #e5e7eb;
            background:
              ${
                index % 2
                  ? '#fbfcfe'
                  : '#ffffff'
              };
            font-size:12px;
          ">
            <div style="
              padding:10px 7px;
              text-align:center;
            ">
              ${
                movement.date ||
                '-'
              }
            </div>

            <div style="
              padding:10px 7px;
              text-align:center;
              font-weight:800;
              color:#10233f;
            ">
              ${
                movement.category ||
                'مصروف'
              }
            </div>

            <div style="
              padding:10px 7px;
              text-align:center;
              color:#64748b;
            ">
              ${
                movement.notes ||
                movement.location ||
                '-'
              }
            </div>

            <div style="
              padding:10px 7px;
              text-align:center;
              font-weight:900;
              color:
                ${
                  movement.affectsDriverBalance ||
                  movement.category ===
                    'سلفة / سحب'
                    ? '#b45309'
                    : '#475569'
                };
            ">
              ${money(
                Number(
                  movement.amount
                ) || 0
              )}
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

          background:#ffffff;
          color:#111827;

          font-family:
            Arial,
            Tahoma,
            sans-serif;

          box-sizing:border-box;

          position:relative;

          padding:
            0 30px 28px;
        "
      >
        <div
          style="
            height:18px;

            background:
              #062c57;

            margin:
              0 -30px;
          "
        ></div>

        <div
          style="
            height:4px;

            background:
              #d3a43b;

            margin:
              0 -30px;
          "
        ></div>

        <div
          style="
            display:flex;

            justify-content:
              center;
          "
        >
          <div
            style="
              background:
                #062c57;

              color:
                #e9bd57;

              border-radius:
                0 0 28px 28px;

              padding:
                12px 42px 13px;

              font-size:
                18px;

              font-weight:
                900;

              border-bottom:
                3px solid #d3a43b;
            "
          >
            كشف حساب
          </div>
        </div>

        <div
          style="
            text-align:center;

            margin-top:
              22px;
          "
        >
          <div
            style="
              color:
                #062c57;

              font-size:
                34px;

              font-weight:
                900;
            "
          >
            BAKR PRO
          </div>

          <h1
            style="
              margin:
                8px 0 0;

              color:
                #10233f;

              font-size:
                28px;

              font-weight:
                900;
            "
          >
            ملخص حساب السائق / المشغل
          </h1>

          <div
            style="
              margin-top:
                8px;

              color:
                #64748b;

              font-size:
                13px;
            "
          >
            الراتب والمستحقات والسحوبات والحركات
          </div>
        </div>

        <div
          style="
            display:grid;

            grid-template-columns:
              1fr 1fr;

            gap:
              12px;

            margin-top:
              22px;
          "
        >
          <div
            style="
              border:
                1px solid #dce2ea;

              border-radius:
                14px;

              padding:
                15px;
            "
          >
            <div
              style="
                color:
                  #64748b;

                font-size:
                  11px;
              "
            >
              اسم السائق / المشغل
            </div>

            <div
              style="
                color:
                  #10233f;

                font-size:
                  19px;

                font-weight:
                  900;

                margin-top:
                  5px;
              "
            >
              ${driver.name}
            </div>

            <div
              style="
                margin-top:
                  10px;

                color:
                  #64748b;

                font-size:
                  11px;
              "
            >
              رقم الجوال
            </div>

            <div
              style="
                color:
                  #10233f;

                font-weight:
                  800;

                margin-top:
                  4px;

                direction:
                  ltr;
              "
            >
              ${
                driver.phone ||
                '-'
              }
            </div>
          </div>

          <div
            style="
              border:
                1px solid #dce2ea;

              border-radius:
                14px;

              padding:
                15px;
            "
          >
            <div
              style="
                color:
                  #64748b;

                font-size:
                  11px;
              "
            >
              المعدة
            </div>

            <div
              style="
                color:
                  #10233f;

                font-size:
                  19px;

                font-weight:
                  900;

                margin-top:
                  5px;
              "
            >
              ${
                driver.equipment ||
                '-'
              }
            </div>

            <div
              style="
                margin-top:
                  10px;

                color:
                  #64748b;

                font-size:
                  11px;
              "
            >
              تاريخ ووقت الإصدار
            </div>

            <div
              style="
                color:
                  #10233f;

                font-weight:
                  800;

                margin-top:
                  4px;

                direction:
                  ltr;
              "
            >
              ${issueDate}
              -
              ${issueTime}
            </div>
          </div>
        </div>

        <div
          style="
            display:grid;

            grid-template-columns:
              repeat(4, 1fr);

            gap:
              10px;

            margin-top:
              18px;
          "
        >
          <div
            style="
              border:
                1px solid #cfdcf1;

              border-radius:
                14px;

              padding:
                14px 8px;

              text-align:
                center;

              background:
                #f3f7ff;
            "
          >
            <div
              style="
                color:
                  #174d96;

                font-size:
                  12px;

                font-weight:
                  800;
              "
            >
              الراتب
            </div>

            <div
              style="
                color:
                  #174d96;

                font-size:
                  25px;

                font-weight:
                  900;

                margin-top:
                  10px;
              "
            >
              ${englishNumber(
                driver.salary
              )}
            </div>

            <small>
              ر.س
            </small>
          </div>

          <div
            style="
              border:
                1px solid #cce8d8;

              border-radius:
                14px;

              padding:
                14px 8px;

              text-align:
                center;

              background:
                #f2fbf6;
            "
          >
            <div
              style="
                color:
                  #168152;

                font-size:
                  12px;

                font-weight:
                  800;
              "
            >
              الإضافي
            </div>

            <div
              style="
                color:
                  #168152;

                font-size:
                  25px;

                font-weight:
                  900;

                margin-top:
                  10px;
              "
            >
              ${englishNumber(
                driver.extraAmount
              )}
            </div>

            <small>
              ر.س
            </small>
          </div>

          <div
            style="
              border:
                1px solid #ead9ad;

              border-radius:
                14px;

              padding:
                14px 8px;

              text-align:
                center;

              background:
                #fff9ed;
            "
          >
            <div
              style="
                color:
                  #b47b13;

                font-size:
                  12px;

                font-weight:
                  800;
              "
            >
              إجمالي السحوبات
            </div>

            <div
              style="
                color:
                  #b47b13;

                font-size:
                  25px;

                font-weight:
                  900;

                margin-top:
                  10px;
              "
            >
              ${englishNumber(
                totalWithdrawals
              )}
            </div>

            <small>
              ر.س
            </small>
          </div>

          <div
            style="
              border:
                1px solid #efcccc;

              border-radius:
                14px;

              padding:
                14px 8px;

              text-align:
                center;

              background:
                #fff5f5;
            "
          >
            <div
              style="
                color:
                  #c12b2b;

                font-size:
                  12px;

                font-weight:
                  800;
              "
            >
              أيام الغياب
            </div>

            <div
              style="
                color:
                  #c12b2b;

                font-size:
                  25px;

                font-weight:
                  900;

                margin-top:
                  10px;
              "
            >
              ${englishNumber(
                driver.absentDays
              )}
            </div>

            <small>
              يوم
            </small>
          </div>
        </div>

        <div
          style="
            border:
              1px solid #d8dee8;

            border-radius:
              15px;

            overflow:
              hidden;

            margin-top:
              18px;
          "
        >
          <div
            style="
              background:
                #062c57;

              color:
                #ffffff;

              text-align:
                center;

              padding:
                11px;

              font-size:
                16px;

              font-weight:
                900;

              border-bottom:
                2px solid #d3a43b;
            "
          >
            تفاصيل الحساب
          </div>

          <div
            style="
              display:grid;

              grid-template-columns:
                1fr 1fr;

              font-size:
                13px;
            "
          >
            <div
              style="
                padding:
                  13px;

                border-bottom:
                  1px solid #e5e7eb;
              "
            >
              الراتب الشهري
            </div>

            <div
              style="
                padding:
                  13px;

                border-bottom:
                  1px solid #e5e7eb;

                font-weight:
                  900;
              "
            >
              ${money(
                driver.salary
              )}
            </div>

            <div
              style="
                padding:
                  13px;

                border-bottom:
                  1px solid #e5e7eb;
              "
            >
              العمل الإضافي
            </div>

            <div
              style="
                padding:
                  13px;

                border-bottom:
                  1px solid #e5e7eb;

                font-weight:
                  900;
              "
            >
              ${money(
                driver.extraAmount
              )}
            </div>

            <div
              style="
                padding:
                  13px;

                border-bottom:
                  1px solid #e5e7eb;
              "
            >
              السحوبات اليدوية
            </div>

            <div
              style="
                padding:
                  13px;

                border-bottom:
                  1px solid #e5e7eb;

                font-weight:
                  900;
              "
            >
              ${money(
                driver.withdrawals
              )}
            </div>

            <div
              style="
                padding:
                  13px;

                border-bottom:
                  1px solid #e5e7eb;
              "
            >
              السلف / السحوبات التلقائية
            </div>

            <div
              style="
                padding:
                  13px;

                border-bottom:
                  1px solid #e5e7eb;

                font-weight:
                  900;

                color:
                  #b45309;
              "
            >
              ${money(
                automatic
              )}
            </div>

            <div
              style="
                padding:
                  13px;

                font-weight:
                  900;
              "
            >
              إجمالي السحوبات
            </div>

            <div
              style="
                padding:
                  13px;

                font-weight:
                  900;

                color:
                  #b45309;
              "
            >
              ${money(
                totalWithdrawals
              )}
            </div>
          </div>
        </div>

        <div
          style="
            background:
              #062c57;

            border-radius:
              16px;

            color:
              #ffffff;

            margin-top:
              18px;

            padding:
              17px;

            text-align:
              center;
          "
        >
          <div
            style="
              color:
                #e9bd57;

              font-size:
                13px;

              font-weight:
                800;
            "
          >
            صافي المبلغ المتبقي
          </div>

          <div
            style="
              color:
                #e9bd57;

              font-size:
                34px;

              font-weight:
                900;

              margin-top:
                6px;

              direction:
                ltr;
            "
          >
            ${englishNumber(
              remaining
            )}
            ر.س
          </div>

          <div
            style="
              color:
                #d5dfeb;

              font-size:
                11px;

              margin-top:
                5px;
            "
          >
            الراتب + الإضافي - إجمالي السحوبات
          </div>
        </div>

        <div
          style="
            border:
              1px solid #d8dee8;

            border-radius:
              15px;

            overflow:
              hidden;

            margin-top:
              18px;
          "
        >
          <div
            style="
              background:
                #0b3c70;

              color:
                #ffffff;

              text-align:
                center;

              padding:
                10px;

              font-size:
                14px;

              font-weight:
                900;
            "
          >
            الحركات المرتبطة بالسائق
          </div>

          <div
            style="
              display:grid;

              grid-template-columns:
                105px 120px 1fr 110px;

              background:
                #edf2f7;

              font-size:
                11px;

              font-weight:
                900;

              color:
                #10233f;
            "
          >
            <div
              style="
                padding:
                  9px;

                text-align:
                  center;
              "
            >
              التاريخ
            </div>

            <div
              style="
                padding:
                  9px;

                text-align:
                  center;
              "
            >
              النوع
            </div>

            <div
              style="
                padding:
                  9px;

                text-align:
                  center;
              "
            >
              البيان
            </div>

            <div
              style="
                padding:
                  9px;

                text-align:
                  center;
              "
            >
              المبلغ
            </div>
          </div>

          ${movementRows}
        </div>

        <div
          style="
            display:grid;

            grid-template-columns:
              1fr 1fr;

            gap:
              60px;

            margin-top:
              24px;

            border:
              1px solid #e1e6ed;

            border-radius:
              15px;

            padding:
              20px;

            text-align:
              center;

            color:
              #24364d;

            font-size:
              12px;
          "
        >
          <div>
            <div
              style="
                font-weight:
                  800;

                margin-bottom:
                  26px;
              "
            >
              توقيع السائق / المشغل
            </div>

            <div
              style="
                border-top:
                  1px dashed #8793a3;
              "
            ></div>
          </div>

          <div>
            <div
              style="
                font-weight:
                  800;

                margin-bottom:
                  26px;
              "
            >
              توقيع الإدارة
            </div>

            <div
              style="
                border-top:
                  1px dashed #8793a3;
              "
            ></div>
          </div>
        </div>

        <div
          style="
            margin:
              18px -30px -28px;

            background:
              #062c57;

            border-top:
              3px solid #d3a43b;

            color:
              #ffffff;

            text-align:
              center;

            padding:
              12px;

            font-size:
              13px;

            font-weight:
              800;
          "
        >
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
          await Share.share({
            title:
              fileName,

            text:
              'تم تجهيز ملف PDF، اختر التطبيق الذي تريد حفظه أو فتحه من خلاله.',

            files: [
              result.uri,
            ],

            dialogTitle:
              'حفظ / فتح ملف PDF',
          });
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

  /* =========================
     تنسيقات
  ========================= */

  const inputStyle:
    React.CSSProperties = {
    width: '100%',

    padding:
      '12px',

    borderRadius:
      '12px',

    border:
      '1px solid #26364d',

    background:
      '#0d1728',

    color:
      '#ffffff',

    boxSizing:
      'border-box',

    fontSize:
      '14px',
  };

  const cardStyle:
    React.CSSProperties = {
    background:
      '#0c1526',

    border:
      '1px solid #1f2e46',

    borderRadius:
      '18px',

    padding:
      '16px',
  };

  /* =========================
     الواجهة
  ========================= */

  return (
    <div
      dir="rtl"
      style={{
        minHeight:
          '100vh',

        background:
          '#050b16',

        color:
          '#ffffff',

        padding:
          '18px',

        paddingBottom:
          '60px',
      }}
    >
      <div
        style={{
          maxWidth:
            900,

          margin:
            'auto',
        }}
      >
        <div
          style={{
            marginBottom:
              22,
          }}
        >
          <h1
            style={{
              margin:
                0,

              fontSize:
                27,
            }}
          >
            👷 رواتب السائقين
          </h1>

          <p
            style={{
              color:
                '#94a3b8',

              marginTop:
                7,

              fontSize:
                14,
            }}
          >
            حساب مستقل لكل سائق ومتابعة الراتب والعمل والغياب والسحوبات
          </p>
        </div>

        {/* =========================
            الإجماليات
        ========================= */}

        <div
          style={{
            display:
              'grid',

            gridTemplateColumns:
              'repeat(2, 1fr)',

            gap:
              10,

            marginBottom:
              18,
          }}
        >
          <div
            style={
              cardStyle
            }
          >
            <small
              style={{
                color:
                  '#94a3b8',
              }}
            >
              إجمالي الرواتب
            </small>

            <h3>
              {englishNumber(
                totals.salaries
              )}{' '}
              ر.س
            </h3>
          </div>

          <div
            style={
              cardStyle
            }
          >
            <small
              style={{
                color:
                  '#94a3b8',
              }}
            >
              إجمالي الإضافي
            </small>

            <h3>
              {englishNumber(
                totals.extra
              )}{' '}
              ر.س
            </h3>
          </div>

          <div
            style={
              cardStyle
            }
          >
            <small
              style={{
                color:
                  '#94a3b8',
              }}
            >
              إجمالي السحوبات
            </small>

            <h3>
              {englishNumber(
                totals.withdrawals
              )}{' '}
              ر.س
            </h3>

            {totals.autoWithdrawals >
              0 && (
              <div
                style={{
                  fontSize:
                    10,

                  color:
                    '#f8c85a',

                  marginTop:
                    5,
                }}
              >
                منها تلقائي:{' '}
                {englishNumber(
                  totals.autoWithdrawals
                )}{' '}
                ر.س
              </div>
            )}
          </div>

          <div
            style={
              cardStyle
            }
          >
            <small
              style={{
                color:
                  '#94a3b8',
              }}
            >
              إجمالي المتبقي
            </small>

            <h3>
              {englishNumber(
                totals.remaining
              )}{' '}
              ر.س
            </h3>
          </div>
        </div>

        {/* =========================
            إضافة سائق
        ========================= */}

        <div
          style={{
            ...cardStyle,

            marginBottom:
              20,
          }}
        >
          <h2
            style={{
              marginTop:
                0,

              fontSize:
                19,
            }}
          >
            ➕ إضافة سائق
          </h2>

          <div
            style={{
              display:
                'grid',

              gap:
                10,
            }}
          >
            <input
              style={
                inputStyle
              }
              value={
                name
              }
              onChange={(
                e
              ) =>
                setName(
                  e.target.value
                )
              }
              placeholder="اسم السائق"
            />

            <input
              style={
                inputStyle
              }
              value={
                phone
              }
              onChange={(
                e
              ) =>
                setPhone(
                  e.target.value
                )
              }
              placeholder="رقم الجوال"
              inputMode="tel"
            />

            <input
              style={
                inputStyle
              }
              value={
                equipment
              }
              onChange={(
                e
              ) =>
                setEquipment(
                  e.target.value
                )
              }
              placeholder="المعدة التي يعمل عليها"
            />

            <input
              style={
                inputStyle
              }
              type="number"
              value={
                salary
              }
              onChange={(
                e
              ) =>
                setSalary(
                  e.target.value
                )
              }
              placeholder="الراتب الشهري"
            />

            <div
              style={{
                display:
                  'grid',

                gridTemplateColumns:
                  '1fr 1fr',

                gap:
                  10,
              }}
            >
              <input
                style={
                  inputStyle
                }
                type="number"
                value={
                  workDays
                }
                onChange={(
                  e
                ) =>
                  setWorkDays(
                    e.target
                      .value
                  )
                }
                placeholder="أيام العمل"
              />

              <input
                style={
                  inputStyle
                }
                type="number"
                value={
                  absentDays
                }
                onChange={(
                  e
                ) =>
                  setAbsentDays(
                    e.target
                      .value
                  )
                }
                placeholder="أيام الغياب"
              />
            </div>

            <div
              style={{
                display:
                  'grid',

                gridTemplateColumns:
                  '1fr 1fr',

                gap:
                  10,
              }}
            >
              <input
                style={
                  inputStyle
                }
                type="number"
                value={
                  extraAmount
                }
                onChange={(
                  e
                ) =>
                  setExtraAmount(
                    e.target
                      .value
                  )
                }
                placeholder="قيمة العمل الإضافي"
              />

              <input
                style={
                  inputStyle
                }
                type="number"
                value={
                  withdrawals
                }
                onChange={(
                  e
                ) =>
                  setWithdrawals(
                    e.target
                      .value
                  )
                }
                placeholder="السحوبات اليدوية القديمة"
              />
            </div>

            <button
              onClick={
                addDriver
              }
              style={{
                padding:
                  14,

                border:
                  0,

                borderRadius:
                  13,

                fontWeight:
                  'bold',

                fontSize:
                  16,

                background:
                  '#f5a623',

                color:
                  '#111827',
              }}
            >
              حفظ السائق
            </button>
          </div>
        </div>

        <h2
          style={{
            fontSize:
              19,
          }}
        >
          السائقون المسجلون
        </h2>

        {drivers.length ===
        0 ? (
          <div
            style={{
              ...cardStyle,

              textAlign:
                'center',
            }}
          >
            <p
              style={{
                color:
                  '#94a3b8',
              }}
            >
              لا يوجد سائقون مسجلون حتى الآن
            </p>
          </div>
        ) : (
          <div
            style={{
              display:
                'grid',

              gap:
                13,
            }}
          >
            {drivers.map(
              (driver) => {
                const automatic =
                  getAutomaticWithdrawals(
                    driver
                  );

                const totalWithdrawals =
                  getTotalWithdrawals(
                    driver
                  );

                const remaining =
                  getRemaining(
                    driver
                  );

                const movements =
                  getDriverExpenseRecords(
                    driver
                  );

                return (
                  <div
                    key={
                      driver.id
                    }
                    style={
                      cardStyle
                    }
                  >
                    <div
                      style={{
                        display:
                          'flex',

                        justifyContent:
                          'space-between',

                        gap:
                          10,

                        alignItems:
                          'center',
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            margin:
                              0,
                          }}
                        >
                          {
                            driver.name
                          }
                        </h3>

                        <small
                          style={{
                            color:
                              '#94a3b8',
                          }}
                        >
                          {driver.equipment ||
                            'بدون معدة محددة'}
                        </small>
                      </div>

                      <button
                        onClick={() =>
                          deleteDriver(
                            driver.id
                          )
                        }
                        style={{
                          border:
                            0,

                          borderRadius:
                            10,

                          padding:
                            '8px 11px',

                          background:
                            '#411827',

                          color:
                            '#ff7b87',
                        }}
                      >
                        حذف
                      </button>
                    </div>

                    {driver.phone && (
                      <p
                        style={{
                          color:
                            '#cbd5e1',

                          direction:
                            'ltr',

                          textAlign:
                            'right',
                        }}
                      >
                        📱{' '}
                        {
                          driver.phone
                        }
                      </p>
                    )}

                    <div
                      style={{
                        display:
                          'grid',

                        gridTemplateColumns:
                          '1fr 1fr',

                        gap:
                          8,

                        marginTop:
                          12,
                      }}
                    >
                      <label>
                        <small>
                          الراتب
                        </small>

                        <input
                          style={
                            inputStyle
                          }
                          type="number"
                          value={
                            driver.salary
                          }
                          onChange={(
                            e
                          ) =>
                            updateDriver(
                              driver.id,
                              'salary',
                              e.target
                                .value
                            )
                          }
                        />
                      </label>

                      <label>
                        <small>
                          أيام العمل
                        </small>

                        <input
                          style={
                            inputStyle
                          }
                          type="number"
                          value={
                            driver.workDays
                          }
                          onChange={(
                            e
                          ) =>
                            updateDriver(
                              driver.id,
                              'workDays',
                              e.target
                                .value
                            )
                          }
                        />
                      </label>

                      <label>
                        <small>
                          أيام الغياب
                        </small>

                        <input
                          style={
                            inputStyle
                          }
                          type="number"
                          value={
                            driver.absentDays
                          }
                          onChange={(
                            e
                          ) =>
                            updateDriver(
                              driver.id,
                              'absentDays',
                              e.target
                                .value
                            )
                          }
                        />
                      </label>

                      <label>
                        <small>
                          الإضافي
                        </small>

                        <input
                          style={
                            inputStyle
                          }
                          type="number"
                          value={
                            driver.extraAmount
                          }
                          onChange={(
                            e
                          ) =>
                            updateDriver(
                              driver.id,
                              'extraAmount',
                              e.target
                                .value
                            )
                          }
                        />
                      </label>

                      <label>
                        <small>
                          سحوبات يدوية
                        </small>

                        <input
                          style={
                            inputStyle
                          }
                          type="number"
                          value={
                            driver.withdrawals
                          }
                          onChange={(
                            e
                          ) =>
                            updateDriver(
                              driver.id,
                              'withdrawals',
                              e.target
                                .value
                            )
                          }
                        />
                      </label>

                      <div
                        style={{
                          padding:
                            12,

                          borderRadius:
                            12,

                          background:
                            '#3b2d0e',

                          border:
                            '1px solid #8a651d',
                        }}
                      >
                        <small
                          style={{
                            color:
                              '#f8c85a',
                          }}
                        >
                          سلف / سحب تلقائي
                        </small>

                        <strong
                          style={{
                            display:
                              'block',

                            marginTop:
                              8,

                            color:
                              '#f8c85a',

                            direction:
                              'ltr',

                            textAlign:
                              'right',
                          }}
                        >
                          {englishNumber(
                            automatic
                          )}{' '}
                          ر.س
                        </strong>
                      </div>

                      <div
                        style={{
                          padding:
                            12,

                          borderRadius:
                            12,

                          background:
                            '#261d10',

                          border:
                            '1px solid #5f4821',
                        }}
                      >
                        <small
                          style={{
                            color:
                              '#94a3b8',
                          }}
                        >
                          إجمالي السحوبات
                        </small>

                        <strong
                          style={{
                            display:
                              'block',

                            marginTop:
                              8,

                            color:
                              '#f59e0b',

                            direction:
                              'ltr',

                            textAlign:
                              'right',
                          }}
                        >
                          {englishNumber(
                            totalWithdrawals
                          )}{' '}
                          ر.س
                        </strong>
                      </div>

                      <div
                        style={{
                          padding:
                            12,

                          borderRadius:
                            12,

                          background:
                            '#10251e',
                        }}
                      >
                        <small
                          style={{
                            color:
                              '#94a3b8',
                          }}
                        >
                          المتبقي للسائق
                        </small>

                        <strong
                          style={{
                            display:
                              'block',

                            marginTop:
                              8,

                            color:
                              remaining >=
                              0
                                ? '#47d78a'
                                : '#fb7185',

                            direction:
                              'ltr',

                            textAlign:
                              'right',
                          }}
                        >
                          {englishNumber(
                            remaining
                          )}{' '}
                          ر.س
                        </strong>
                      </div>
                    </div>

                    {/* سجل الحركات */}

                    {movements.length >
                      0 && (
                      <div
                        style={{
                          marginTop:
                            14,

                          padding:
                            12,

                          borderRadius:
                            13,

                          background:
                            '#091221',

                          border:
                            '1px solid #1f2e46',
                        }}
                      >
                        <div
                          style={{
                            display:
                              'flex',

                            justifyContent:
                              'space-between',

                            marginBottom:
                              9,
                          }}
                        >
                          <strong
                            style={{
                              fontSize:
                                13,
                            }}
                          >
                            الحركات المرتبطة
                          </strong>

                          <small
                            style={{
                              color:
                                '#94a3b8',
                            }}
                          >
                            {
                              movements.length
                            }{' '}
                            حركة
                          </small>
                        </div>

                        <div
                          style={{
                            display:
                              'grid',

                            gap:
                              7,
                          }}
                        >
                          {movements
                            .slice(
                              0,
                              10
                            )
                            .map(
                              (
                                movement
                              ) => {
                                const affects =
                                  movement.affectsDriverBalance ===
                                    true ||
                                  movement.category ===
                                    'سلفة / سحب';

                                return (
                                  <div
                                    key={
                                      movement.id
                                    }
                                    style={{
                                      display:
                                        'grid',

                                      gridTemplateColumns:
                                        '1fr auto',

                                      gap:
                                        10,

                                      padding:
                                        9,

                                      borderRadius:
                                        10,

                                      background:
                                        affects
                                          ? 'rgba(245,158,11,0.08)'
                                          : 'rgba(255,255,255,0.025)',

                                      border:
                                        affects
                                          ? '1px solid rgba(245,158,11,0.18)'
                                          : '1px solid rgba(255,255,255,0.05)',
                                    }}
                                  >
                                    <div>
                                      <div
                                        style={{
                                          fontSize:
                                            12,

                                          fontWeight:
                                            800,

                                          color:
                                            affects
                                              ? '#f8c85a'
                                              : '#e2e8f0',
                                        }}
                                      >
                                        {movement.category ||
                                          'مصروف'}
                                      </div>

                                      <div
                                        style={{
                                          marginTop:
                                            3,

                                          fontSize:
                                            10,

                                          color:
                                            '#64748b',
                                        }}
                                      >
                                        {movement.date ||
                                          '-'}

                                        {movement.notes
                                          ? ` • ${movement.notes}`
                                          : ''}
                                      </div>
                                    </div>

                                    <strong
                                      style={{
                                        color:
                                          affects
                                            ? '#f59e0b'
                                            : '#94a3b8',

                                        fontSize:
                                          13,

                                        direction:
                                          'ltr',
                                      }}
                                    >
                                      {englishNumber(
                                        Number(
                                          movement.amount
                                        ) ||
                                          0
                                      )}{' '}
                                      ر.س
                                    </strong>
                                  </div>
                                );
                              }
                            )}
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        display:
                          'grid',

                        gridTemplateColumns:
                          '1fr 1fr',

                        gap:
                          8,

                        marginTop:
                          14,
                      }}
                    >
                      <button
                        onClick={() =>
                          openDriverStatement(
                            driver
                          )
                        }
                        style={{
                          padding:
                            '12px 8px',

                          border:
                            '1px solid #315f9d',

                          borderRadius:
                            12,

                          background:
                            '#10294a',

                          color:
                            '#ffffff',

                          fontWeight:
                            800,

                          fontSize:
                            13,
                        }}
                      >
                        📄 ملخص الحساب / PDF
                      </button>

                      <button
                        onClick={() =>
                          shareDriverOnWhatsApp(
                            driver
                          )
                        }
                        style={{
                          padding:
                            '12px 8px',

                          border:
                            '1px solid #1f8b57',

                          borderRadius:
                            12,

                          background:
                            '#123a29',

                          color:
                            '#67e59c',

                          fontWeight:
                            800,

                          fontSize:
                            13,
                        }}
                      >
                        🟢 إرسال واتساب
                      </button>

                      <button
                        onClick={() =>
                          shareDriver(
                            driver
                          )
                        }
                        style={{
                          padding:
                            '12px 8px',

                          border:
                            '1px solid #475569',

                          borderRadius:
                            12,

                          background:
                            '#172033',

                          color:
                            '#dbeafe',

                          fontWeight:
                            800,

                          fontSize:
                            13,
                        }}
                      >
                        ↗ مشاركة
                      </button>

                      <button
                        onClick={() =>
                          alert(
                            'يمكنك تعديل بيانات السائق مباشرة من الخانات الموجودة أعلى هذه الأزرار، ويتم الحفظ تلقائيًا.'
                          )
                        }
                        style={{
                          padding:
                            '12px 8px',

                          border:
                            '1px solid #8a651d',

                          borderRadius:
                            12,

                          background:
                            '#3b2d0e',

                          color:
                            '#f8c85a',

                          fontWeight:
                            800,

                          fontSize:
                            13,
                        }}
                      >
                        ✏️ تعديل البيانات
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>
    </div>
  );
                }
