import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Plus,
  Save,
  Trash2,
  Users,
  RefreshCw,
  Truck,
  Wallet,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

import {
  AppLayout,
} from '@/components/layout/AppLayout';

import {
  fetchEquipment,
  type Equipment,
} from '@/lib/equipment';

/* =========================
   الأنواع
========================= */

type Partner = {
  id: string;
  name: string;
  percentage: number;
  paid: number;
  notes: string;
};

type DayRow = {
  day: number;
  workType?: string;
  tripType?: string;
  tripPrice?: number;
  expenseType?: string;
  expenseAmount?: number;
  notes?: string;
};

type ExternalExpenseRecord = {
  id?: number | string;
  date?: string;
  equipmentId?: string;
  equipmentName?: string;
  amount?: number;
  category?: string;
};

type SavedSettlement = {
  id: string;
  createdAt: string;

  equipmentId: string;
  equipmentName: string;

  year: number;
  month: number;

  monthlyIncome: number;
  monthlyExpenses: number;

  additionalExpenses: number;

  totalExpenses: number;
  distributable: number;

  partners: Partner[];
};

/* =========================
   التخزين
========================= */

const STORAGE_KEY =
  'bakr_pro_partner_settlements_v2';

const EXTERNAL_EXPENSE_KEY =
  'crane_accounting_driver_equipment_expenses_v1';

/* =========================
   الأشهر
========================= */

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

/* =========================
   أدوات
========================= */

function money(
  value: number
) {
  return (
    `${(
      Number(value) || 0
    ).toLocaleString(
      'en-US',
      {
        maximumFractionDigits:
          2,
      }
    )} ر.س`
  );
}

function n(
  value:
    | string
    | number
) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}

function makePartner():
Partner {
  return {
    id:
      `${Date.now()}-${Math.random()}`,

    name: '',

    percentage: 0,

    paid: 0,

    notes: '',
  };
}

function getDateParts(
  value: string
) {
  const parts =
    String(
      value || ''
    ).split('-');

  if (
    parts.length < 3
  ) {
    return null;
  }

  const year =
    Number(parts[0]);

  const month =
    Number(parts[1]);

  const day =
    Number(parts[2]);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
  };
}

/* =========================
   الصفحة
========================= */

export function PartnersPage() {
  const now =
    new Date();

  const [
    equipmentList,
    setEquipmentList,
  ] =
    useState<
      Equipment[]
    >([]);

  const [
    equipmentId,
    setEquipmentId,
  ] =
    useState('');

  const [
    equipmentLoading,
    setEquipmentLoading,
  ] =
    useState(true);

  const [
    year,
    setYear,
  ] =
    useState(
      now.getFullYear()
    );

  const [
    month,
    setMonth,
  ] =
    useState(
      now.getMonth()
    );

  /*
    الدخل القادم من الحساب الشهري
  */
  const [
    monthlyIncome,
    setMonthlyIncome,
  ] =
    useState(0);

  /*
    المصاريف الموجودة داخل
    الحساب الشهري
  */
  const [
    monthlyManualExpenses,
    setMonthlyManualExpenses,
  ] =
    useState(0);

  /*
    المصاريف المرتبطة
    بالسواقين والمعدات
  */
  const [
    linkedExpenses,
    setLinkedExpenses,
  ] =
    useState(0);

  /*
    مصاريف إضافية خاصة
    بالشراكة
  */
  const [
    additionalExpenses,
    setAdditionalExpenses,
  ] =
    useState(0);

  const [
    partners,
    setPartners,
  ] =
    useState<
      Partner[]
    >([
      makePartner(),
      makePartner(),
      makePartner(),
    ]);

  const [
    loadingAccount,
    setLoadingAccount,
  ] =
    useState(false);

  /* =========================
     تحميل المعدات
  ========================= */

  useEffect(
    () => {
      let cancelled =
        false;

      async function loadEquipment() {
        try {
          setEquipmentLoading(
            true
          );

          const result =
            await fetchEquipment();

          if (
            cancelled
          ) {
            return;
          }

          const list =
            Array.isArray(
              result
            )
              ? result
              : [];

          setEquipmentList(
            list
          );

          if (
            list.length >
            0
          ) {
            setEquipmentId(
              String(
                list[0].id
              )
            );
          }
        } catch (
          error
        ) {
          console.error(
            'Partners equipment:',
            error
          );
        } finally {
          if (
            !cancelled
          ) {
            setEquipmentLoading(
              false
            );
          }
        }
      }

      loadEquipment();

      return () => {
        cancelled =
          true;
      };
    },
    []
  );

  /* =========================
     المعدة المختارة
  ========================= */

  const selectedEquipment =
    useMemo(
      () =>
        equipmentList.find(
          (
            item
          ) =>
            String(
              item.id
            ) ===
            String(
              equipmentId
            )
        ) || null,
      [
        equipmentList,
        equipmentId,
      ]
    );

  const equipmentName =
    selectedEquipment
      ?.name ||
    '';

  /* =========================
     تحميل الحساب الشهري
  ========================= */

  function loadMonthlyAccount() {
    if (
      !equipmentId
    ) {
      setMonthlyIncome(
        0
      );

      setMonthlyManualExpenses(
        0
      );

      setLinkedExpenses(
        0
      );

      return;
    }

    try {
      setLoadingAccount(
        true
      );

      /*
        نفس المفتاح المستخدم
        في MonthlyDetailPage
      */

      const monthlyKey =
        `monthly-ledger-v3-${equipmentId}-${year}-${month}`;

      const raw =
        localStorage.getItem(
          monthlyKey
        );

      let rows:
        DayRow[] = [];

      if (raw) {
        try {
          const parsed =
            JSON.parse(
              raw
            );

          if (
            Array.isArray(
              parsed
            )
          ) {
            rows =
              parsed;
          }
        } catch (
          error
        ) {
          console.error(
            'Monthly ledger parse:',
            error
          );
        }
      }

      /*
        إجمالي الدخل
      */

      const income =
        rows.reduce(
          (
            sum,
            row
          ) =>
            sum +
            n(
              row.tripPrice ||
                0
            ),
          0
        );

      /*
        المصاريف اليدوية
        الموجودة داخل
        الحساب الشهري
      */

      const manual =
        rows.reduce(
          (
            sum,
            row
          ) =>
            sum +
            n(
              row.expenseAmount ||
                0
            ),
          0
        );

      /*
        المصاريف المرتبطة
        بالمعدة
      */

      let external:
        ExternalExpenseRecord[] =
        [];

      try {
        const expenseRaw =
          localStorage.getItem(
            EXTERNAL_EXPENSE_KEY
          );

        if (
          expenseRaw
        ) {
          const parsed =
            JSON.parse(
              expenseRaw
            );

          if (
            Array.isArray(
              parsed
            )
          ) {
            external =
              parsed;
          }
        }
      } catch (
        error
      ) {
        console.error(
          'External expenses:',
          error
        );
      }

      const linked =
        external.reduce(
          (
            sum,
            expense
          ) => {
            if (
              String(
                expense.equipmentId ||
                  ''
              ) !==
              String(
                equipmentId
              )
            ) {
              return sum;
            }

            const date =
              getDateParts(
                expense.date ||
                  ''
              );

            if (
              !date
            ) {
              return sum;
            }

            if (
              date.year !==
                year ||
              date.month !==
                month + 1
            ) {
              return sum;
            }

            return (
              sum +
              n(
                expense.amount ||
                  0
              )
            );
          },
          0
        );

      setMonthlyIncome(
        income
      );

      setMonthlyManualExpenses(
        manual
      );

      setLinkedExpenses(
        linked
      );
    } catch (
      error
    ) {
      console.error(
        'Partners monthly account:',
        error
      );

      setMonthlyIncome(
        0
      );

      setMonthlyManualExpenses(
        0
      );

      setLinkedExpenses(
        0
      );
    } finally {
      setLoadingAccount(
        false
      );
    }
  }

  /*
    عند تغيير المعدة
    أو الشهر أو السنة
    يتحدث الحساب
  */

  useEffect(
    () => {
      loadMonthlyAccount();
    },
    [
      equipmentId,
      year,
      month,
    ]
  );

  /*
    عند الرجوع للتطبيق
    نحدث الأرقام
  */

  useEffect(
    () => {
      const handleFocus =
        () => {
          loadMonthlyAccount();
        };

      window.addEventListener(
        'focus',
        handleFocus
      );

      return () => {
        window.removeEventListener(
          'focus',
          handleFocus
        );
      };
    }
  );

  /* =========================
     الحسابات
  ========================= */

  const totalExpenses =
    monthlyManualExpenses +
    linkedExpenses +
    additionalExpenses;

  /*
    إذا المصاريف أكبر من
    الدخل نسمح للصافي
    أن يكون بالسالب
    حتى يظهر الوضع الحقيقي
  */

  const distributable =
    monthlyIncome -
    totalExpenses;

  const percentageTotal =
    useMemo(
      () =>
        partners.reduce(
          (
            sum,
            partner
          ) =>
            sum +
            n(
              partner.percentage
            ),
          0
        ),
      [
        partners,
      ]
    );

  const distributed =
    useMemo(
      () =>
        partners.reduce(
          (
            sum,
            partner
          ) =>
            sum +
            distributable *
              (
                n(
                  partner.percentage
                ) /
                100
              ),
          0
        ),
      [
        partners,
        distributable,
      ]
    );

  const difference =
    distributable -
    distributed;

  /* =========================
     تحديث الشريك
  ========================= */

  function updatePartner(
    id: string,
    field:
      keyof Omit<
        Partner,
        'id'
      >,
    value: string
  ) {
    setPartners(
      (
        old
      ) =>
        old.map(
          (
            partner
          ) => {
            if (
              partner.id !==
              id
            ) {
              return partner;
            }

            return {
              ...partner,

              [field]:
                field ===
                  'percentage' ||
                field ===
                  'paid'
                  ? n(
                      value
                    )
                  : value,
            };
          }
        )
    );
  }

  /* =========================
     توزيع متساوي
  ========================= */

  function distributeEqually() {
    if (
      partners.length ===
      0
   
