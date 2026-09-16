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
  Equal,
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
  linkedExpenses: number;
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

function money(value: number) {
  return `${(
    Number(value) || 0
  ).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })} ر.س`;
}

function n(
  value: string | number
) {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function makePartner(): Partner {
  return {
    id: `${Date.now()}-${Math.random()}`,
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
    String(value || '')
      .split('-');

  if (parts.length < 3) {
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
    useState<Equipment[]>([]);

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
    دخل الحساب الشهري
  */

  const [
    monthlyIncome,
    setMonthlyIncome,
  ] =
    useState(0);

  /*
    المصاريف الموجودة
    داخل الحساب الشهري
  */

  const [
    monthlyManualExpenses,
    setMonthlyManualExpenses,
  ] =
    useState(0);

  /*
    مصاريف السواقين
    والمعدات المرتبطة
  */

  const [
    linkedExpenses,
    setLinkedExpenses,
  ] =
    useState(0);

  /*
    مصاريف إضافية
    خاصة بالشراكة
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
    useState<Partner[]>([
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

  useEffect(() => {
    let cancelled =
      false;

    async function loadEquipment() {
      try {
        setEquipmentLoading(
          true
        );

        const result =
          await fetchEquipment();

        if (cancelled) {
          return;
        }

        const list =
          Array.isArray(result)
            ? result
            : [];

        setEquipmentList(
          list
        );

        if (
          list.length > 0
        ) {
          setEquipmentId(
            String(
              list[0].id
            )
          );
        }
      } catch (error) {
        console.error(
          'Partners equipment:',
          error
        );
      } finally {
        if (!cancelled) {
          setEquipmentLoading(
            false
          );
        }
      }
    }

    loadEquipment();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =========================
     المعدة المختارة
  ========================= */

  const selectedEquipment =
    useMemo(
      () =>
        equipmentList.find(
          (item) =>
            String(item.id) ===
            String(equipmentId)
        ) || null,
      [
        equipmentList,
        equipmentId,
      ]
    );

  const equipmentName =
    selectedEquipment?.name ||
    '';

  /* =========================
     تحميل الحساب الشهري
  ========================= */

  function loadMonthlyAccount() {
    if (!equipmentId) {
      setMonthlyIncome(0);

      setMonthlyManualExpenses(
        0
      );

      setLinkedExpenses(0);

      return;
    }

    try {
      setLoadingAccount(
        true
      );

      /*
        نفس المفتاح المستخدم
        في الحساب الشهري
      */

      const monthlyKey =
        `monthly-ledger-v3-${equipmentId}-${year}-${month}`;

      const raw =
        localStorage.getItem(
          monthlyKey
        );

      let rows: DayRow[] =
        [];

      if (raw) {
        try {
          const parsed =
            JSON.parse(raw);

          if (
            Array.isArray(parsed)
          ) {
            rows = parsed;
          }
        } catch (error) {
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
          (sum, row) =>
            sum +
            n(
              row.tripPrice ||
                0
            ),
          0
        );

      /*
        المصاريف اليدوية
        في الحساب الشهري
      */

      const manual =
        rows.reduce(
          (sum, row) =>
            sum +
            n(
              row.expenseAmount ||
                0
            ),
          0
        );

      /*
        المصاريف المرتبطة
        بالسواقين والمعدات
      */

      let external:
        ExternalExpenseRecord[] =
        [];

      try {
        const expenseRaw =
          localStorage.getItem(
            EXTERNAL_EXPENSE_KEY
          );

        if (expenseRaw) {
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
      } catch (error) {
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

            if (!date) {
              return sum;
            }

            if (
              date.year !== year ||
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
    } catch (error) {
      console.error(
        'Partners monthly account:',
        error
      );

      setMonthlyIncome(0);

      setMonthlyManualExpenses(
        0
      );

      setLinkedExpenses(0);
    } finally {
      setLoadingAccount(
        false
      );
    }
  }

  /*
    تحديث عند تغيير
    الكرين أو الشهر أو السنة
  */

  useEffect(() => {
    loadMonthlyAccount();
  }, [
    equipmentId,
    year,
    month,
  ]);

  /*
    تحديث عند الرجوع
    إلى التطبيق
  */

  useEffect(() => {
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
  }, [
    equipmentId,
    year,
    month,
  ]);

  /* =========================
     الحسابات
  ========================= */

  const totalExpenses =
    monthlyManualExpenses +
    linkedExpenses +
    additionalExpenses;

  /*
    صافي المبلغ
    القابل للتوزيع
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
      [partners]
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
     تحديث بيانات الشريك
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
      (old) =>
        old.map(
          (partner) => {
            if (
              partner.id !== id
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
                  ? n(value)
                  : value,
            };
          }
        )
    );
  }

  /* =========================
     توزيع النسب بالتساوي
  ========================= */

  function distributeEqually() {
    if (
      partners.length === 0
    ) {
      return;
    }

    const equal =
      100 /
      partners.length;

    /*
      نحافظ على المجموع
      100% حتى مع الكسور
    */

    let used = 0;

    setPartners(
      (old) =>
        old.map(
          (
            partner,
            index
          ) => {
            let percentage =
              Number(
                equal.toFixed(
                  4
                )
              );

            if (
              index ===
              old.length - 1
            ) {
              percentage =
                Number(
                  (
                    100 -
                    used
                  ).toFixed(
                    4
                  )
                );
            }

            used +=
              percentage;

            return {
              ...partner,
              percentage,
            };
          }
        )
    );
  }

  /* =========================
     إضافة شريك
  ========================= */

  function addPartner() {
    setPartners(
      (old) => [
        ...old,
        makePartner(),
      ]
    );
  }

  /* =========================
     حذف شريك
  ========================= */

  function removePartner(
    id: string
  ) {
    setPartners(
      (old) =>
        old.filter(
          (partner) =>
            partner.id !== id
        )
    );
  }

  /* =========================
     الحفظ
  ========================= */

  function saveSettlement() {
    if (!equipmentId) {
      alert(
        'اختر الكرين أو المعدة'
      );

      return;
    }

    if (
      partners.length === 0
    ) {
      alert(
        'أضف شريكاً واحداً على الأقل'
      );

      return;
    }

    if (
      partners.some(
        (partner) =>
          !partner.name.trim()
      )
    ) {
      alert(
        'أدخل أسماء جميع الشركاء'
      );

      return;
    }

    if (
      Math.abs(
        percentageTotal -
          100
      ) > 0.01
    ) {
      alert(
        `مجموع نسب الشركاء يجب أن يكون 100% — المجموع الحالي ${percentageTotal.toFixed(
          2
        )}%`
      );

      return;
    }

    const record:
      SavedSettlement = {
      id:
        String(
          Date.now()
        ),

      createdAt:
        new Date()
          .toISOString(),

      equipmentId:
        String(
          equipmentId
        ),

      equipmentName,

      year,

      month,

      monthlyIncome,

      monthlyExpenses:
        monthlyManualExpenses,

      linkedExpenses,

      additionalExpenses,

      totalExpenses,

      distributable,

      partners:
        partners.map(
          (partner) => ({
            ...partner,
          })
        ),
    };

    try {
      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      let old:
        SavedSettlement[] =
        [];

      if (raw) {
        try {
          const parsed =
            JSON.parse(raw);

          if (
            Array.isArray(
              parsed
            )
          ) {
            old = parsed;
          }
        } catch {
          old = [];
        }
      }

      /*
        إذا حفظنا نفس الكرين
        ونفس الشهر والسنة
        نستبدل التسوية القديمة
        بدلاً من تكرارها
      */

      const withoutSameMonth =
        old.filter(
          (item) =>
            !(
              String(
                item.equipmentId
              ) ===
                String(
                  equipmentId
                ) &&
              item.year ===
                year &&
              item.month ===
                month
            )
        );

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
          record,
          ...withoutSameMonth,
        ])
      );

      alert(
        'تم حفظ حساب الشركاء بنجاح'
      );
    } catch (error) {
      console.error(
        'Save partners settlement:',
        error
      );

      alert(
        'تعذر حفظ حساب الشركاء'
      );
    }
  }

  /* =========================
     التنسيقات
  ========================= */

  const inputStyle:
    React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: 12,
    borderRadius: 12,
    border:
      '1px solid #263b58',
    background: '#081526',
    color: '#ffffff',
    outline: 'none',
    fontSize: 13,
  };

  const cardStyle:
    React.CSSProperties = {
    background:
      'linear-gradient(145deg,#0d1b2f,#07111f)',

    border:
      '1px solid rgba(255,255,255,.08)',

    borderRadius: 20,

    padding: 14,
  };

  /* =========================
     الواجهة
  ========================= */

  return (
    <AppLayout>
      <div
        dir="rtl"
        style={{
          padding: 16,
          paddingBottom: 110,
          color: '#ffffff',
        }}
      >
        {/* العنوان */}

        <div
          style={{
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems:
                'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                display: 'flex',
                alignItems:
                  'center',
                justifyContent:
                  'center',

                background:
                  'rgba(59,130,246,.12)',

                border:
                  '1px solid rgba(96,165,250,.20)',
              }}
            >
              <Users
                size={25}
                color="#60a5fa"
              />
            </div>

            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 25,
                  fontWeight: 900,
                }}
              >
                حساب الشركاء
              </h1>

              <p
                style={{
                  margin:
                    '4px 0 0',
                  color:
                    '#94a3b8',
                  fontSize: 11,
                }}
              >
                توزيع صافي دخل
                الكرين على
                الشركاء
              </p>
            </div>
          </div>
        </div>

        {/* اختيار الكرين */}

        <section
          style={
            cardStyle
          }
        >
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems:
                'center',
              marginBottom: 9,
            }}
          >
            <Truck
              size={18}
              color="#fbbf24"
            />

            <strong
              style={{
                fontSize: 14,
              }}
            >
              الكرين / المعدة
            </strong>
          </div>

          <select
            value={
              equipmentId
            }
            disabled={
              equipmentLoading
            }
            onChange={(
              event
            ) =>
              setEquipmentId(
                event.target
                  .value
              )
            }
            style={
              inputStyle
            }
          >
            {equipmentLoading ? (
              <option value="">
                جاري تحميل
                المعدات...
              </option>
            ) : equipmentList.length ===
              0 ? (
              <option value="">
                لا توجد معدات
                مسجلة
              </option>
            ) : (
              equipmentList.map(
                (equipment) => (
                  <option
                    key={
                      equipment.id
                    }
                    value={
                      equipment.id
                    }
                  >
                    {
                      equipment.name
                    }
                  </option>
                )
              )
            )}
          </select>

          {/* الشهر والسنة */}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                '1fr 1fr',
              gap: 9,
              marginTop: 9,
            }}
          >
            <div>
              <label
                style={{
                  display:
                    'block',
                  fontSize: 10,
                  color:
                    '#94a3b8',
                  marginBottom: 5,
                }}
              >
                الشهر
              </label>

              <select
                value={month}
                onChange={(
                  event
                ) =>
                  setMonth(
                    Number(
                      event
                        .target
                        .value
                    )
                  )
                }
                style={
                  inputStyle
                }
              >
                {monthNames.map(
                  (
                    name,
                    index
                  ) => (
                    <option
                      key={
                        name
                      }
                      value={
                        index
                      }
                    >
                      {name}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label
                style={{
                  display:
                    'block',
                  fontSize: 10,
                  color:
                    '#94a3b8',
                  marginBottom: 5,
                }}
              >
                السنة
              </label>

              <input
                type="number"
                inputMode="numeric"
                value={year}
                onChange={(
                  event
                ) =>
                  setYear(
                    n(
                      event
                        .target
                        .value
                    )
                  )
                }
                style={
                  inputStyle
                }
              />
            </div>
          </div>

          {/* تحديث */}

          <button
            type="button"
            onClick={
              loadMonthlyAccount
            }
            disabled={
              loadingAccount
            }
            style={{
              width: '100%',
              marginTop: 10,
              padding: 11,
              borderRadius: 12,
              border:
                '1px solid rgba(96,165,250,.25)',
              background:
                'rgba(59,130,246,.08)',
              color:
                '#93c5fd',
              fontWeight: 800,
              display: 'flex',
              justifyContent:
                'center',
              alignItems:
                'center',
              gap: 7,
            }}
          >
            <RefreshCw
              size={17}
            />

            {loadingAccount
              ? 'جاري التحديث...'
              : 'تحديث الحساب الشهري'}
          </button>
        </section>

        {/* أرقام الحساب */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              '1fr 1fr',
            gap: 10,
            marginTop: 12,
          }}
        >
          <Summary
            label="دخل الشهر"
            value={money(
              monthlyIncome
            )}
            color="#4ade80"
            icon={
              TrendingUp
            }
          />

          <Summary
            label="مصاريف الشهر"
            value={money(
              monthlyManualExpenses
            )}
            color="#fb7185"
            icon={
              TrendingDown
            }
          />

          <Summary
            label="مصاريف السواقين والمعدات"
            value={money(
              linkedExpenses
            )}
            color="#fb923c"
            icon={
              TrendingDown
            }
          />

          <Summary
            label="صافي قبل المصاريف الإضافية"
            value={money(
              monthlyIncome -
                monthlyManualExpenses -
                linkedExpenses
            )}
            color="#60a5fa"
            icon={Wallet}
          />
        </div>

        {/* المصاريف الإضافية */}

        <section
          style={{
            ...cardStyle,
            marginTop: 12,
          }}
        >
          <label
            style={{
              display: 'block',
              color:
                '#94a3b8',
              fontSize: 11,
              marginBottom: 7,
            }}
          >
            مصاريف إضافية
            خاصة بالشراكة
          </label>

          <input
            type="number"
            inputMode="decimal"
            value={
              additionalExpenses ||
              ''
            }
            onChange={(
              event
            ) =>
              setAdditionalExpenses(
                n(
                  event.target
                    .value
                )
              )
            }
            placeholder="0"
            style={
              inputStyle
            }
          />
        </section>

        {/* ملخص */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              '1fr 1fr',
            gap: 10,
            marginTop: 12,
          }}
        >
          <Summary
            label="إجمالي المصاريف"
            value={money(
              totalExpenses
            )}
            color="#fb7185"
          />

          <Summary
            label="صافي التوزيع"
            value={money(
              distributable
            )}
            color={
              distributable >=
              0
                ? '#4ade80'
                : '#fb7185'
            }
          />
        </div>

        {/* الشركاء */}

        <section
          style={{
            ...cardStyle,
            marginTop: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems:
                'center',
              marginBottom: 12,
            }}
          >
            <div>
              <strong
                style={{
                  fontSize: 18,
                }}
              >
                الشركاء
              </strong>

              <div
                style={{
                  color:
                    Math.abs(
                      percentageTotal -
                        100
                    ) <
                    0.01
                      ? '#4ade80'
                      : '#fbbf24',

                  fontSize: 11,
                  marginTop: 3,
                }}
              >
                مجموع النسب:{' '}
                {percentageTotal.toFixed(
                  2
                )}
                %
              </div>
            </div>

            <Users
              color="#60a5fa"
            />
          </div>

          {/* توزيع متساوي */}

          <button
            type="button"
            onClick={
              distributeEqually
            }
            style={{
              width: '100%',
              marginBottom: 12,
              padding: 11,
              borderRadius: 12,

              border:
                '1px solid rgba(245,158,11,.30)',

              background:
                'rgba(245,158,11,.08)',

              color:
                '#fbbf24',

              fontWeight: 800,

              display: 'flex',

              alignItems:
                'center',

              justifyContent:
                'center',

              gap: 7,
            }}
          >
            <Equal
              size={17}
            />

            توزيع النسب
            بالتساوي
          </button>

          <div
            style={{
              display: 'grid',
              gap: 12,
            }}
          >
            {partners.map(
              (
                partner,
                index
              ) => {
                const due =
                  distributable *
                  (
                    n(
                      partner.percentage
                    ) /
                    100
                  );

                const remaining =
                  due -
                  n(
                    partner.paid
                  );

                return (
                  <div
                    key={
                      partner.id
                    }
                    style={{
                      background:
                        'rgba(255,255,255,.025)',

                      border:
                        '1px solid rgba(255,255,255,.07)',

                      borderRadius: 16,

                      padding: 12,
                    }}
                  >
                    {/* عنوان الشريك */}

                    <div
                      style={{
                        display:
                          'flex',

                        justifyContent:
                          'space-between',

                        alignItems:
                          'center',

                        marginBottom: 9,
                      }}
                    >
                      <strong>
                        الشريك{' '}
                        {index +
                          1}
                      </strong>

                      {partners.length >
                        1 && (
                        <button
                          type="button"
                          onClick={() =>
                            removePartner(
                              partner.id
                            )
                          }
                          style={{
                            border: 0,
                            borderRadius: 10,
                            padding: 8,

                            background:
                              'rgba(239,68,68,.12)',

                            color:
                              '#fb7185',
                          }}
                        >
                          <Trash2
                            size={
                              17
                            }
                          />
                        </button>
                      )}
                    </div>

                    {/* الاسم */}

                    <input
                      placeholder="اسم الشريك"
                      value={
                        partner.name
                      }
                      onChange={(
                        event
                      ) =>
                        updatePartner(
                          partner.id,
                          'name',
                          event
                            .target
                            .value
                        )
                      }
                      style={
                        inputStyle
                      }
                    />

                    {/* النسبة والسحوبات */}

                    <div
                      style={{
                        display:
                          'grid',

                        gridTemplateColumns:
                          '1fr 1fr',

                        gap: 8,

                        marginTop: 8,
                      }}
                    >
                      <div>
                        <label
                          style={{
                            display:
                              'block',

                            color:
                              '#94a3b8',

                            fontSize: 9,

                            marginBottom: 4,
                          }}
                        >
                          نسبة
                          الشريك %
                        </label>

                        <input
                          type="number"
                          inputMode="decimal"
                          placeholder="0"
                          value={
                            partner.percentage ||
                            ''
                          }
                          onChange={(
                            event
                          ) =>
                            updatePartner(
                              partner.id,
                              'percentage',
                              event
                                .target
                                .value
                            )
                          }
                          style={
                            inputStyle
                          }
                        />
                      </div>

                      <div>
                        <label
                          style={{
                            display:
                              'block',

                            color:
                              '#94a3b8',

                            fontSize: 9,

                            marginBottom: 4,
                          }}
                        >
                          المدفوع /
                          السحوبات
                        </label>

                        <input
                          type="number"
                          inputMode="decimal"
                          placeholder="0"
                          value={
                            partner.paid ||
                            ''
                          }
                          onChange={(
                            event
                          ) =>
                            updatePartner(
                              partner.id,
                              'paid',
                              event
                                .target
                                .value
                            )
                          }
                          style={
                            inputStyle
                          }
                        />
                      </div>
                    </div>

                    {/* ملاحظات */}

                    <input
                      placeholder="ملاحظات الشريك"
                      value={
                        partner.notes
                      }
                      onChange={(
                        event
                      ) =>
                        updatePartner(
                          partner.id,
                          'notes',
                          event
                            .target
                            .value
                        )
                      }
                      style={{
                        ...inputStyle,
                        marginTop: 8,
                      }}
                    />

                    {/* حساب الشريك */}

                    <div
                      style={{
                        display:
                          'grid',

                        gridTemplateColumns:
                          '1fr 1fr',

                        gap: 8,

                        marginTop: 10,
                      }}
                    >
                      <Summary
                        label="المستحق"
                        value={money(
                          due
                        )}
                        color="#4ade80"
                        small
                      />

                      <Summary
                        label="المتبقي"
                        value={money(
                          remaining
                        )}
                        color={
                          remaining >
                          0
                            ? '#fbbf24'
                            : '#60a5fa'
                        }
                        small
                      />
                    </div>
                  </div>
                );
              }
            )}
          </div>

          {/* إضافة شريك */}

          <button
            type="button"
            onClick={
              addPartner
            }
            style={{
              width: '100%',
              marginTop: 12,
              padding: 13,

              borderRadius: 13,

              border:
                '1px dashed rgba(96,165,250,.55)',

              background:
                'rgba(59,130,246,.08)',

              color:
                '#93c5fd',

              fontWeight: 800,

              display: 'flex',

              gap: 6,

              justifyContent:
                'center',

              alignItems:
                'center',
            }}
          >
            <Plus
              size={18}
            />

            إضافة شريك
          </button>
        </section>

        {/* الفارق */}

        <section
          style={{
            ...cardStyle,
            marginTop: 12,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                '1fr 1fr',
              gap: 9,
            }}
          >
            <Summary
              label="المبلغ الموزع"
              value={money(
                distributed
              )}
              color="#60a5fa"
              small
            />

            <Summary
              label="الفارق"
              value={money(
                difference
              )}
              color={
                Math.abs(
                  difference
                ) < 0.01
                  ? '#4ade80'
                  : '#fbbf24'
              }
              small
            />
          </div>
        </section>

        {/* حفظ */}

        <button
          type="button"
          onClick={
            saveSettlement
          }
          style={{
            width: '100%',
            marginTop: 14,
            padding: 16,

            border: 0,

            borderRadius: 16,

            background:
              'linear-gradient(135deg,#0f5fb7,#063a78)',

            color:
              '#ffffff',

            fontWeight: 900,

            fontSize: 15,

            display: 'flex',

            gap: 7,

            justifyContent:
              'center',

            alignItems:
              'center',

            boxShadow:
              '0 12px 30px rgba(15,95,183,.22)',
          }}
        >
          <Save
            size={19}
          />

          حفظ حساب الشركاء
        </button>

        <p
          style={{
            textAlign:
              'center',

            color:
              '#64748b',

            fontSize: 9,

            marginTop: 12,
          }}
        >
          BAKR PRO • حساب
          الشركاء
        </p>
      </div>
    </AppLayout>
  );
}

/* =========================
   بطاقة الملخص
========================= */

type SummaryProps = {
  label: string;
  value: string;
  color: string;
  small?: boolean;
  icon?: any;
};

function Summary({
  label,
  value,
  color,
  small = false,
  icon: Icon,
}: SummaryProps) {
  return (
    <div
      style={{
        background:
          'linear-gradient(145deg,#0d1b2f,#07111f)',

        border:
          '1px solid rgba(255,255,255,.07)',

        borderRadius:
          small
            ? 12
            : 17,

        padding:
          small
            ? 9
            : 12,

        textAlign:
          'center',
      }}
    >
      {Icon && (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,

            margin:
              '0 auto 7px',

            display: 'flex',

            alignItems:
              'center',

            justifyContent:
              'center',

            background:
              `${color}15`,
          }}
        >
          <Icon
            size={16}
            color={color}
          />
        </div>
      )}

      <div
        style={{
          color:
            '#94a3b8',

          fontSize:
            small
              ? 9
              : 10,

          lineHeight: 1.4,
        }}
      >
        {label}
      </div>

      <div
        style={{
          color,

          fontWeight: 900,

          fontSize:
            small
              ? 12
              : 15,

          marginTop: 5,
        }}
      >
        {value}
      </div>
    </div>
  );
        }
