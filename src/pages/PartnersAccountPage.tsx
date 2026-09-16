import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Plus,
  Trash2,
  Save,
  Users,
  Wallet,
  CircleDollarSign,
  Scale,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

import {
  useNavigate,
} from 'react-router-dom';

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
  notes: string;
};

type SavedPartnerAccount = {
  id: string;
  date: string;
  equipmentId: string;
  equipmentName: string;
  description: string;
  totalIncome: number;
  partnersEnabled: boolean;
  partners: Partner[];
  distributedAmount: number;
  difference: number;
  createdAt: string;
};

/* =========================
   التخزين
========================= */

const STORAGE_KEY =
  'bakr_pro_partners_accounts_v1';

/* =========================
   أدوات مساعدة
========================= */

function createId() {
  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2, 8)
  );
}

function normalizeNumber(
  value: string
) {
  const cleaned = value
    .replace(
      /[٠-٩]/g,
      (digit) =>
        String(
          '٠١٢٣٤٥٦٧٨٩'.indexOf(
            digit
          )
        )
    )
    .replace(
      /[۰-۹]/g,
      (digit) =>
        String(
          '۰۱۲۳۴۵۶۷۸۹'.indexOf(
            digit
          )
        )
    )
    .replace(/,/g, '')
    .replace(/٬/g, '');

  const number =
    Number(cleaned);

  return Number.isFinite(number)
    ? number
    : 0;
}

function formatMoney(
  value: number
) {
  return value.toLocaleString(
    'en-US',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

function todayValue() {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      now.getDate()
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/* =========================
   الصفحة
========================= */

export function PartnersAccountPage() {
  const navigate =
    useNavigate();

  const [
    equipmentList,
    setEquipmentList,
  ] =
    useState<Equipment[]>(
      []
    );

  const [
    loadingEquipment,
    setLoadingEquipment,
  ] =
    useState(true);

  const [
    equipmentId,
    setEquipmentId,
  ] =
    useState('');

  const [
    date,
    setDate,
  ] =
    useState(
      todayValue()
    );

  const [
    description,
    setDescription,
  ] =
    useState(
      'إجمالي دخل الشهر'
    );

  const [
    totalIncome,
    setTotalIncome,
  ] =
    useState(0);

  const [
    partnersEnabled,
    setPartnersEnabled,
  ] =
    useState(true);

  const [
    partners,
    setPartners,
  ] =
    useState<Partner[]>([
      {
        id: createId(),
        name: '',
        percentage: 0,
        notes: '',
      },
      {
        id: createId(),
        name: '',
        percentage: 0,
        notes: '',
      },
      {
        id: createId(),
        name: '',
        percentage: 0,
        notes: '',
      },
    ]);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    savedSuccessfully,
    setSavedSuccessfully,
  ] =
    useState(false);

  /* =========================
     تحميل المعدات
  ========================= */

  useEffect(() => {
    let cancelled =
      false;

    async function load() {
      try {
        setLoadingEquipment(
          true
        );

        const list =
          await fetchEquipment();

        if (cancelled) {
          return;
        }

        const safe =
          Array.isArray(list)
            ? list
            : [];

        setEquipmentList(
          safe
        );

        if (
          safe.length > 0
        ) {
          setEquipmentId(
            String(
              safe[0].id
            )
          );
        }
      } catch (error) {
        console.error(
          'Partners equipment error:',
          error
        );
      } finally {
        if (!cancelled) {
          setLoadingEquipment(
            false
          );
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =========================
     المعدة المحددة
  ========================= */

  const selectedEquipment =
    useMemo(() => {
      return (
        equipmentList.find(
          (item) =>
            String(
              item.id
            ) ===
            String(
              equipmentId
            )
        ) || null
      );
    }, [
      equipmentList,
      equipmentId,
    ]);

  /* =========================
     الحسابات
  ========================= */

  const totalPercentage =
    useMemo(() => {
      if (
        !partnersEnabled
      ) {
        return 0;
      }

      return partners.reduce(
        (
          total,
          partner
        ) =>
          total +
          (
            Number(
              partner.percentage
            ) || 0
          ),
        0
      );
    }, [
      partners,
      partnersEnabled,
    ]);

  const distributedAmount =
    useMemo(() => {
      if (
        !partnersEnabled
      ) {
        return 0;
      }

      return partners.reduce(
        (
          total,
          partner
        ) => {
          const amount =
            totalIncome *
            (
              (
                Number(
                  partner.percentage
                ) || 0
              ) /
              100
            );

          return (
            total + amount
          );
        },
        0
      );
    }, [
      partners,
      partnersEnabled,
      totalIncome,
    ]);

  const difference =
    totalIncome -
    distributedAmount;

  const percentagesCorrect =
    !partnersEnabled ||
    Math.abs(
      totalPercentage -
        100
    ) < 0.001;

  /* =========================
     تعديل شريك
  ========================= */

  function updatePartner(
    id: string,
    field:
      | 'name'
      | 'percentage'
      | 'notes',
    value: string
  ) {
    setSavedSuccessfully(
      false
    );

    setPartners(
      (current) =>
        current.map(
          (partner) => {
            if (
              partner.id !== id
            ) {
              return partner;
            }

            if (
              field ===
              'percentage'
            ) {
              return {
                ...partner,
                percentage:
                  Math.max(
                    0,
                    normalizeNumber(
                      value
                    )
                  ),
              };
            }

            return {
              ...partner,
              [field]: value,
            };
          }
        )
    );
  }

  /* =========================
     إضافة شريك
  ========================= */

  function addPartner() {
    setSavedSuccessfully(
      false
    );

    setPartners(
      (current) => [
        ...current,
        {
          id: createId(),
          name: '',
          percentage: 0,
          notes: '',
        },
      ]
    );
  }

  /* =========================
     حذف شريك
  ========================= */

  function removePartner(
    id: string
  ) {
    setSavedSuccessfully(
      false
    );

    setPartners(
      (current) =>
        current.filter(
          (partner) =>
            partner.id !== id
        )
    );
  }

  /* =========================
     حفظ
  ========================= */

  function handleSave() {
    if (
      !equipmentId
    ) {
      alert(
        'اختر الكرين أولاً'
      );

      return;
    }

    if (
      totalIncome <= 0
    ) {
      alert(
        'أدخل إجمالي الدخل'
      );

      return;
    }

    if (
      partnersEnabled
    ) {
      if (
        partners.length ===
        0
      ) {
        alert(
          'أضف شريكاً واحداً على الأقل'
        );

        return;
      }

      const missingName =
        partners.some(
          (partner) =>
            !partner.name.trim()
        );

      if (missingName) {
        alert(
          'اكتب اسم كل شريك'
        );

        return;
      }

      if (
        !percentagesCorrect
      ) {
        alert(
          `مجموع نسب الشركاء يجب أن يكون 100%. المجموع الحالي ${totalPercentage}%`
        );

        return;
      }
    }

    try {
      setSaving(true);

      let oldRecords:
        SavedPartnerAccount[] =
        [];

      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (raw) {
        try {
          const parsed =
            JSON.parse(raw);

          if (
            Array.isArray(
              parsed
            )
          ) {
            oldRecords =
              parsed;
          }
        } catch {
          oldRecords =
            [];
        }
      }

      const record:
        SavedPartnerAccount =
        {
          id: createId(),

          date,

          equipmentId,

          equipmentName:
            selectedEquipment
              ?.name ||
            'كرين',

          description:
            description.trim() ||
            'إجمالي دخل الشهر',

          totalIncome,

          partnersEnabled,

          partners:
            partnersEnabled
              ? partners
              : [],

          distributedAmount:
            partnersEnabled
              ? distributedAmount
              : 0,

          difference:
            partnersEnabled
              ? difference
              : totalIncome,

          createdAt:
            new Date().toISOString(),
        };

      const updated = [
        record,
        ...oldRecords,
      ];

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          updated
        )
      );

      /*
        حدث خاص حتى تستطيع
        بقية صفحات التطبيق التحديث
      */
      window.dispatchEvent(
        new CustomEvent(
          'bakr-partners-account-updated'
        )
      );

      setSavedSuccessfully(
        true
      );
    } catch (error) {
      console.error(
        'Partners save error:',
        error
      );

      alert(
        'تعذر حفظ حساب الشركاء'
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================
     الأنماط
  ========================= */

  const cardStyle:
    React.CSSProperties =
    {
      background:
        'linear-gradient(145deg,#0d1c30,#07111e)',
      border:
        '1px solid rgba(255,255,255,0.08)',
      borderRadius: 22,
      padding: 16,
      boxShadow:
        '0 12px 28px rgba(0,0,0,0.22)',
    };

  const inputStyle:
    React.CSSProperties =
    {
      width: '100%',
      height: 48,
      borderRadius: 13,
      border:
        '1px solid rgba(148,163,184,0.20)',
      background:
        '#081525',
      color: '#ffffff',
      padding:
        '0 12px',
      outline: 'none',
      fontSize: 14,
      boxSizing:
        'border-box',
    };

  /* =========================
     العرض
  ========================= */

  return (
    <AppLayout>
      <div
        dir="rtl"
        style={{
          width: '100%',
          maxWidth: 900,
          margin: '0 auto',
          padding:
            '18px 14px 120px',
          color: '#ffffff',
        }}
      >
        {/* العنوان */}

        <div
          style={{
            marginBottom: 20,
          }}
        >
          <button
            type="button"
            onClick={() =>
              navigate(-1)
            }
            style={{
              border: 'none',
              background:
                'transparent',
              color:
                '#94a3b8',
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            ← رجوع
          </button>

          <div
            style={{
              display: 'flex',
              alignItems:
                'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: 16,
                display: 'flex',
                alignItems:
                  'center',
                justifyContent:
                  'center',
                background:
                  'rgba(59,130,246,0.14)',
                border:
                  '1px solid rgba(96,165,250,0.22)',
              }}
            >
              <Users
                size={27}
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
                  fontSize: 12,
                }}
              >
                توزيع الدخل تلقائياً
                بين الشركاء
              </p>
            </div>
          </div>
        </div>

        {/* البيانات الرئيسية */}

        <div
          style={cardStyle}
        >
          <div
            style={{
              display: 'grid',
              gap: 12,
            }}
          >
            <label>
              <div
                style={{
                  color:
                    '#94a3b8',
                  fontSize: 11,
                  marginBottom: 6,
                }}
              >
                الكرين
              </div>

              <select
                value={
                  equipmentId
                }
                disabled={
                  loadingEquipment
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
                {loadingEquipment ? (
                  <option>
                    جاري تحميل
                    المعدات...
                  </option>
                ) : equipmentList.length ===
                  0 ? (
                  <option value="">
                    لا توجد معدات
                  </option>
                ) : (
                  equipmentList.map(
                    (item) => (
                      <option
                        key={
                          item.id
                        }
                        value={String(
                          item.id
                        )}
                      >
                        {item.name}
                      </option>
                    )
                  )
                )}
              </select>
            </label>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '1fr 1fr',
                gap: 10,
              }}
            >
              <label>
                <div
                  style={{
                    color:
                      '#94a3b8',
                    fontSize: 11,
                    marginBottom: 6,
                  }}
                >
                  التاريخ
                </div>

                <input
                  type="date"
                  value={date}
                  onChange={(
                    event
                  ) =>
                    setDate(
                      event.target
                        .value
                    )
                  }
                  style={
                    inputStyle
                  }
                />
              </label>

              <label>
                <div
                  style={{
                    color:
                      '#94a3b8',
                    fontSize: 11,
                    marginBottom: 6,
                  }}
                >
                  وصف الدخل
                </div>

                <input
                  value={
                    description
                  }
                  onChange={(
                    event
                  ) =>
                    setDescription(
                      event.target
                        .value
                    )
                  }
                  style={
                    inputStyle
                  }
                />
              </label>
            </div>
          </div>
        </div>

        {/* الدخل */}

        <div
          style={{
            ...cardStyle,
            marginTop: 14,
            border:
              '1px solid rgba(34,197,94,0.22)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems:
                'center',
              gap: 12,
            }}
          >
            <CircleDollarSign
              size={30}
              color="#4ade80"
            />

            <div
              style={{
                flex: 1,
              }}
            >
              <div
                style={{
                  color:
                    '#4ade80',
                  fontSize: 12,
                  fontWeight: 800,
                  marginBottom: 5,
                }}
              >
                إجمالي الدخل
              </div>

              <input
                inputMode="decimal"
                value={
                  totalIncome ||
                  ''
                }
                placeholder="0"
                onChange={(
                  event
                ) => {
                  setSavedSuccessfully(
                    false
                  );

                  setTotalIncome(
                    normalizeNumber(
                      event.target
                        .value
                    )
                  );
                }}
                style={{
                  ...inputStyle,
                  height: 56,
                  fontSize: 24,
                  fontWeight: 900,
                }}
              />
            </div>

            <strong
              style={{
                color:
                  '#94a3b8',
              }}
            >
              ريال
            </strong>
          </div>
        </div>

        {/* تفعيل الشركاء */}

        <button
          type="button"
          onClick={() => {
            setSavedSuccessfully(
              false
            );

            setPartnersEnabled(
              (value) =>
                !value
            );
          }}
          style={{
            ...cardStyle,
            width: '100%',
            marginTop: 14,
            color: '#ffffff',
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'space-between',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              textAlign:
                'right',
            }}
          >
            <div
              style={{
                fontWeight: 900,
                fontSize: 15,
              }}
            >
              هذا الكرين فيه
              شركاء
            </div>

            <div
              style={{
                color:
                  '#94a3b8',
                fontSize: 11,
                marginTop: 4,
              }}
            >
              تفعيل توزيع الدخل
              تلقائياً
            </div>
          </div>

          <div
            style={{
              width: 54,
              height: 30,
              borderRadius: 30,
              padding: 3,
              background:
                partnersEnabled
                  ? '#2563eb'
                  : '#334155',
              display: 'flex',
              justifyContent:
                partnersEnabled
                  ? 'flex-start'
                  : 'flex-end',
              transition:
                '0.2s',
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius:
                  '50%',
                background:
                  '#ffffff',
              }}
            />
          </div>
        </button>

        {/* الشركاء */}

        {partnersEnabled && (
          <div
            style={{
              marginTop: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems:
                  'center',
                marginBottom: 10,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                }}
              >
                الشركاء
              </h2>

              <span
                style={{
                  color:
                    percentagesCorrect
                      ? '#4ade80'
                      : '#fbbf24',
                  fontWeight: 900,
                }}
              >
                {totalPercentage}%
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gap: 10,
              }}
            >
              {partners.map(
                (
                  partner,
                  index
                ) => {
                  const amount =
                    totalIncome *
                    (
                      partner.percentage /
                      100
                    );

                  return (
                    <div
                      key={
                        partner.id
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
                          alignItems:
                            'center',
                          marginBottom:
                            12,
                        }}
                      >
                        <strong>
                          الشريك{' '}
                          {index +
                            1}
                        </strong>

                        <button
                          type="button"
                          onClick={() =>
                            removePartner(
                              partner.id
                            )
                          }
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius:
                              11,
                            border:
                              '1px solid rgba(239,68,68,0.20)',
                            background:
                              'rgba(239,68,68,0.10)',
                            color:
                              '#fb7185',
                            display:
                              'flex',
                            alignItems:
                              'center',
                            justifyContent:
                              'center',
                          }}
                        >
                          <Trash2
                            size={
                              18
                            }
                          />
                        </button>
                      </div>

                      <div
                        style={{
                          display:
                            'grid',
                          gridTemplateColumns:
                            '1.5fr 0.7fr',
                          gap: 8,
                        }}
                      >
                        <input
                          value={
                            partner.name
                          }
                          placeholder="اسم الشريك"
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

                        <input
                          inputMode="decimal"
                          value={
                            partner.percentage ||
                            ''
                          }
                          placeholder="%"
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
                          style={{
                            ...inputStyle,
                            textAlign:
                              'center',
                          }}
                        />
                      </div>

                      {/* المبلغ المستحق */}

                      <div
                        style={{
                          marginTop:
                            10,
                          padding:
                            '12px 14px',
                          borderRadius:
                            13,
                          background:
                            'rgba(34,197,94,0.09)',
                          border:
                            '1px solid rgba(34,197,94,0.18)',
                          display:
                            'flex',
                          justifyContent:
                            'space-between',
                        }}
                      >
                        <span
                          style={{
                            color:
                              '#94a3b8',
                            fontSize:
                              12,
                          }}
                        >
                          المبلغ
                          المستحق
                        </span>

                        <strong
                          style={{
                            color:
                              '#4ade80',
                            fontSize:
                              17,
                          }}
                        >
                          {formatMoney(
                            amount
                          )}{' '}
                          ريال
                        </strong>
                      </div>

                      <input
                        value={
                          partner.notes
                        }
                        placeholder="ملاحظات (اختياري)"
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
                          marginTop:
                            10,
                        }}
                      />
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
                height: 52,
                marginTop: 12,
                borderRadius: 15,
                border:
                  '1px dashed rgba(96,165,250,0.55)',
                background:
                  'rgba(59,130,246,0.08)',
                color:
                  '#60a5fa',
                fontWeight: 900,
                display: 'flex',
                alignItems:
                  'center',
                justifyContent:
                  'center',
                gap: 7,
              }}
            >
              <Plus
                size={20}
              />
              إضافة شريك
            </button>
          </div>
        )}

        {/* ملخص */}

        {partnersEnabled && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(3,1fr)',
              gap: 8,
              marginTop: 18,
            }}
          >
            <SummaryBox
              title="إجمالي الدخل"
              value={`${formatMoney(
                totalIncome
              )} ريال`}
              icon={
                Wallet
              }
              color="#4ade80"
            />

            <SummaryBox
              title="تم توزيعه"
              value={`${formatMoney(
                distributedAmount
              )} ريال`}
              icon={
                Users
              }
              color="#60a5fa"
            />

            <SummaryBox
              title="الفارق"
              value={`${formatMoney(
                difference
              )} ريال`}
              icon={
                Scale
              }
              color={
                Math.abs(
                  difference
                ) <
                0.01
                  ? '#4ade80'
                  : '#fbbf24'
              }
            />
          </div>
        )}

        {/* حالة النسب */}

        {partnersEnabled && (
          <div
            style={{
              marginTop: 14,
              padding: 13,
              borderRadius: 15,
              display: 'flex',
              alignItems:
                'center',
              justifyContent:
                'center',
              gap: 8,
              background:
                percentagesCorrect
                  ? 'rgba(34,197,94,0.09)'
                  : 'rgba(245,158,11,0.09)',
              border:
                percentagesCorrect
                  ? '1px solid rgba(34,197,94,0.20)'
                  : '1px solid rgba(245,158,11,0.20)',
              color:
                percentagesCorrect
                  ? '#4ade80'
                  : '#fbbf24',
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            {percentagesCorrect ? (
              <>
                <CheckCircle2
                  size={18}
                />
                النسب صحيحة
                ومكتملة (100%)
              </>
            ) : (
              <>
                <AlertTriangle
                  size={18}
                />
                مجموع النسب
                حالياً{' '}
                {totalPercentage}%
              </>
            )}
          </div>
        )}

        {/* نجاح الحفظ */}

        {savedSuccessfully && (
          <div
            style={{
              marginTop: 14,
              padding: 15,
              borderRadius: 16,
              background:
                'rgba(34,197,94,0.12)',
              border:
                '1px solid rgba(34,197,94,0.25)',
              color:
                '#4ade80',
              textAlign:
                'center',
              fontWeight: 900,
            }}
          >
            ✓ تم حفظ حساب
            الشركاء بنجاح
          </div>
        )}

        {/* حفظ */}

        <button
          type="button"
          disabled={saving}
          onClick={
            handleSave
          }
          style={{
            width: '100%',
            height: 58,
            border: 'none',
            borderRadius: 17,
            marginTop: 18,
            color: '#ffffff',
            fontSize: 17,
            fontWeight: 900,
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'center',
            gap: 9,
            background:
              percentagesCorrect
                ? 'linear-gradient(135deg,#0f5fa8,#08437d)'
                : '#334155',
            boxShadow:
              percentagesCorrect
                ? '0 12px 28px rgba(37,99,235,0.24)'
                : 'none',
          }}
        >
          <Save size={21} />

          {saving
            ? 'جاري الحفظ...'
            : 'حفظ حساب الشركاء'}
        </button>
      </div>
    </AppLayout>
  );
}

/* =========================
   بطاقة الملخص
========================= */

function SummaryBox({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  icon: any;
  color: string;
}) {
  return (
    <div
      style={{
        minHeight: 105,
        padding:
          '12px 7px',
        borderRadius: 17,
        textAlign:
          'center',
        background:
          '#0b1728',
        border:
          '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <Icon
        size={22}
        color={color}
      />

      <div
        style={{
          color:
            '#94a3b8',
          fontSize: 10,
          marginTop: 7,
        }}
      >
        {title}
      </div>

      <div
        style={{
          color,
          fontSize: 13,
          fontWeight: 900,
          marginTop: 5,
        }}
      >
        {value}
      </div>
    </div>
  );
}
