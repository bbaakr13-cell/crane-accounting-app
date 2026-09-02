import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  CalendarDays,
  Truck,
  Save,
  MapPin,
  Wallet,
  Receipt,
  FileText,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';

import { AppLayout } from '@/components/layout/AppLayout';

import {
  fetchEquipment,
  type Equipment,
} from '@/lib/equipment';

type DayRow = {
  day: number;
  workType: string;
  tripType: string;
  tripPrice: number;
  expenseType: string;
  expenseAmount: number;
  notes: string;
};

function getTodayValue() {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(
    now.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    now.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function normalizeArabicNumbers(
  value: string
) {
  return value
    .replace(/[٠-٩]/g, (digit) =>
      String(
        '٠١٢٣٤٥٦٧٨٩'.indexOf(
          digit
        )
      )
    )
    .replace(/[۰-۹]/g, (digit) =>
      String(
        '۰۱۲۳۴۵۶۷۸۹'.indexOf(
          digit
        )
      )
    );
}

function toNumber(value: string) {
  const normalized =
    normalizeArabicNumbers(value)
      .replace(/,/g, '')
      .trim();

  const number = Number(normalized);

  return Number.isFinite(number)
    ? number
    : 0;
}

function emptyRow(
  day: number
): DayRow {
  return {
    day,
    workType: '',
    tripType: '',
    tripPrice: 0,
    expenseType: '',
    expenseAmount: 0,
    notes: '',
  };
}

function rowHasData(row?: DayRow) {
  if (!row) return false;

  return Boolean(
    row.workType?.trim() ||
      row.tripType?.trim() ||
      Number(row.tripPrice) > 0 ||
      row.expenseType?.trim() ||
      Number(row.expenseAmount) >
        0 ||
      row.notes?.trim()
  );
}

function formatEquipmentName(
  value: string
) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(
      /كرين\s*(\d+)/g,
      'كرين $1'
    )
    .replace(
      /(\d+)\s*طن/g,
      '$1 طن'
    )
    .trim();
}

export function DailyTripsPage() {
  const navigate = useNavigate();

  const [equipment, setEquipment] =
    useState<Equipment[]>([]);

  const [
    equipmentId,
    setEquipmentId,
  ] = useState('');

  const [date, setDate] = useState(
    getTodayValue()
  );

  const [workType, setWorkType] =
    useState('');

  const [tripType, setTripType] =
    useState('');

  const [tripPrice, setTripPrice] =
    useState('');

  const [
    expenseType,
    setExpenseType,
  ] = useState('');

  const [
    expenseAmount,
    setExpenseAmount,
  ] = useState('');

  const [notes, setNotes] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('');

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  useEffect(() => {
    let active = true;

    async function loadEquipment() {
      try {
        setLoading(true);

        const data =
          await fetchEquipment();

        if (!active) return;

        setEquipment(data || []);

        if (
          data &&
          data.length > 0
        ) {
          setEquipmentId(
            String(data[0].id)
          );
        }
      } catch (error) {
        console.error(
          'Equipment load error:',
          error
        );

        if (active) {
          setErrorMessage(
            'تعذر تحميل المعدات'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadEquipment();

    return () => {
      active = false;
    };
  }, []);

  const selectedEquipment =
    useMemo(() => {
      return equipment.find(
        (item) =>
          String(item.id) ===
          String(equipmentId)
      );
    }, [
      equipment,
      equipmentId,
    ]);

  const equipmentName =
    useMemo(() => {
      if (!selectedEquipment) {
        return '';
      }

      const item =
        selectedEquipment as any;

      return formatEquipmentName(
        item.name ||
          item.equipmentName ||
          item.title ||
          item.model ||
          'المعدة'
      );
    }, [selectedEquipment]);

  function clearMessages() {
    setSuccessMessage('');
    setErrorMessage('');
  }

  function clearTripFields() {
    setWorkType('');
    setTripType('');
    setTripPrice('');
    setExpenseType('');
    setExpenseAmount('');
    setNotes('');
  }

  function getDateParts() {
    const parts = date
      .split('-')
      .map(Number);

    if (
      parts.length !== 3 ||
      !parts[0] ||
      !parts[1] ||
      !parts[2]
    ) {
      return null;
    }

    return {
      year: parts[0],
      month: parts[1] - 1,
      day: parts[2],
    };
  }

  function getStorageKey() {
    const parts =
      getDateParts();

    if (
      !parts ||
      !equipmentId
    ) {
      return '';
    }

    return `monthly-ledger-v3-${equipmentId}-${parts.year}-${parts.month}`;
  }

  function handleSave() {
    clearMessages();

    if (!equipmentId) {
      setErrorMessage(
        'اختر الكرين أو المعدة أولاً'
      );

      return;
    }

    const parts =
      getDateParts();

    if (!parts) {
      setErrorMessage(
        'اختر تاريخ صحيح'
      );

      return;
    }

    if (
      !workType.trim() &&
      !tripType.trim() &&
      toNumber(tripPrice) <= 0 &&
      !expenseType.trim() &&
      toNumber(expenseAmount) <=
        0 &&
      !notes.trim()
    ) {
      setErrorMessage(
        'أدخل بيانات المشوار أولاً'
      );

      return;
    }

    try {
      setSaving(true);

      const storageKey =
        getStorageKey();

      if (!storageKey) {
        setErrorMessage(
          'تعذر تحديد الحساب الشهري'
        );

        return;
      }

      let existingRows: DayRow[] =
        [];

      const saved =
        localStorage.getItem(
          storageKey
        );

      if (saved) {
        try {
          const parsed =
            JSON.parse(saved);

          if (
            Array.isArray(parsed)
          ) {
            existingRows =
              parsed;
          }
        } catch {
          existingRows = [];
        }
      }

      const existingIndex =
        existingRows.findIndex(
          (row) =>
            Number(row.day) ===
            parts.day
        );

      const newRow: DayRow = {
        day: parts.day,
        workType:
          workType.trim(),
        tripType:
          tripType.trim(),
        tripPrice:
          toNumber(tripPrice),
        expenseType:
          expenseType.trim(),
        expenseAmount:
          toNumber(
            expenseAmount
          ),
        notes: notes.trim(),
      };

      if (
        existingIndex >= 0 &&
        rowHasData(
          existingRows[
            existingIndex
          ]
        )
      ) {
        const shouldReplace =
          window.confirm(
            `يوجد تسجيل سابق ليوم ${parts.day} لهذا الكرين.\n\nهل تريد تحديث بيانات هذا اليوم؟`
          );

        if (!shouldReplace) {
          return;
        }
      }

      if (existingIndex >= 0) {
        existingRows[
          existingIndex
        ] = newRow;
      } else {
        existingRows.push(
          newRow
        );
      }

      existingRows.sort(
        (a, b) =>
          Number(a.day) -
          Number(b.day)
      );

      localStorage.setItem(
        storageKey,
        JSON.stringify(
          existingRows
        )
      );

      setSuccessMessage(
        `تم حفظ مشوار ${equipmentName || 'المعدة'} بتاريخ ${date} في الحساب الشهري`
      );

      clearTripFields();
    } catch (error) {
      console.error(
        'Daily trip save error:',
        error
      );

      setErrorMessage(
        'حدث خطأ أثناء حفظ المشوار'
      );
    } finally {
      setSaving(false);
    }
  }

  function openMonthlyAccount() {
    if (!equipmentId) {
      setErrorMessage(
        'اختر الكرين أولاً'
      );

      return;
    }

    navigate(
      `/monthly/${equipmentId}`
    );
  }

  return (
    <AppLayout>
      <div
        dir="rtl"
        className="w-full pb-8"
      >
        {/* العنوان */}

        <section className="mb-5">
          <div
            className="rounded-[25px] p-5"
            style={{
              background:
                'linear-gradient(145deg,#14243b,#081321)',
              border:
                '1px solid rgba(245,158,11,0.15)',
              boxShadow:
                '0 12px 30px rgba(0,0,0,0.22)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-[18px] flex items-center justify-center"
                style={{
                  background:
                    'rgba(34,197,94,0.11)',
                  border:
                    '1px solid rgba(34,197,94,0.15)',
                }}
              >
                <Truck className="w-7 h-7 text-green-400" />
              </div>

              <div>
                <p className="text-[9px] font-bold text-amber-400 tracking-[0.15em]">
                  BAKR PRO
                </p>

                <h1 className="text-[20px] font-black text-white mt-1">
                  مشاوير يومية
                </h1>

                <p className="text-[10px] text-slate-400 mt-1">
                  سجل مشاوير جميع الكرينات من مكان واحد
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* رسائل */}

        {successMessage && (
          <div
            className="mb-4 rounded-[17px] p-3.5 flex items-start gap-3"
            style={{
              background:
                'rgba(34,197,94,0.10)',
              border:
                '1px solid rgba(34,197,94,0.20)',
            }}
          >
            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />

            <p className="text-[11px] font-bold text-green-300 leading-5">
              {successMessage}
            </p>
          </div>
        )}

        {errorMessage && (
          <div
            className="mb-4 rounded-[17px] p-3.5"
            style={{
              background:
                'rgba(239,68,68,0.09)',
              border:
                '1px solid rgba(239,68,68,0.18)',
            }}
          >
            <p className="text-[11px] font-bold text-red-300">
              {errorMessage}
            </p>
          </div>
        )}

        {/* البيانات الأساسية */}

        <section
          className="rounded-[24px] p-4 mb-4"
          style={{
            background:
              'linear-gradient(145deg,rgba(15,29,49,0.96),rgba(7,17,31,0.98))',
            border:
              '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <h2 className="text-[14px] font-black text-white mb-4">
            بيانات المشوار
          </h2>

          <div className="space-y-4">
            {/* التاريخ */}

            <FieldLabel
              icon={CalendarDays}
              label="التاريخ"
            />

            <input
              type="date"
              value={date}
              onChange={(event) => {
                clearMessages();

                setDate(
                  event.target.value
                );
              }}
              className="w-full h-[52px] rounded-[15px] px-4 bg-[#091525] border border-white/10 text-white text-[12px] outline-none"
            />

            {/* المعدة */}

            <FieldLabel
              icon={Truck}
              label="الكرين / المعدة"
            />

            {loading ? (
              <div className="w-full h-[52px] rounded-[15px] px-4 bg-[#091525] border border-white/10 flex items-center text-[11px] text-slate-500">
                جاري تحميل المعدات...
              </div>
            ) : (
              <select
                value={
                  equipmentId
                }
                onChange={(
                  event
                ) => {
                  clearMessages();

                  setEquipmentId(
                    event.target
                      .value
                  );
                }}
                className="w-full h-[52px] rounded-[15px] px-4 bg-[#091525] border border-white/10 text-white text-[12px] outline-none"
              >
                {equipment.length ===
                  0 && (
                  <option value="">
                    لا توجد معدات
                  </option>
                )}

                {equipment.map(
                  (item: any) => (
                    <option
                      key={
                        item.id
                      }
                      value={
                        item.id
                      }
                    >
                      {formatEquipmentName(
                        item.name ||
                          item.equipmentName ||
                          item.title ||
                          item.model ||
                          'المعدة'
                      )}
                    </option>
                  )
                )}
              </select>
            )}

            {/* نوع العمل */}

            <FieldLabel
              icon={Truck}
              label="نوع العمل"
            />

            <input
              value={workType}
              onChange={(event) =>
                setWorkType(
                  event.target.value
                )
              }
              placeholder="مثال: مشوار كرين"
              className="w-full h-[52px] rounded-[15px] px-4 bg-[#091525] border border-white/10 text-white text-[12px] outline-none placeholder:text-slate-600"
            />

            {/* موقع العمل */}

            <FieldLabel
              icon={MapPin}
              label="موقع العمل"
            />

            <input
              value={tripType}
              onChange={(event) =>
                setTripType(
                  event.target.value
                )
              }
              placeholder="مثال: خميس مشيط"
              className="w-full h-[52px] rounded-[15px] px-4 bg-[#091525] border border-white/10 text-white text-[12px] outline-none placeholder:text-slate-600"
            />

            {/* سعر المشوار */}

            <FieldLabel
              icon={Wallet}
              label="سعر المشوار"
            />

            <div className="relative">
              <input
                inputMode="decimal"
                value={tripPrice}
                onChange={(event) =>
                  setTripPrice(
                    normalizeArabicNumbers(
                      event.target
                        .value
                    )
                  )
                }
                placeholder="0"
                className="w-full h-[52px] rounded-[15px] pr-4 pl-16 bg-[#091525] border border-white/10 text-green-400 font-black text-[14px] outline-none placeholder:text-slate-700"
              />

              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
                ر.س
              </span>
            </div>
          </div>
        </section>

        {/* المصروف */}

        <section
          className="rounded-[24px] p-4 mb-4"
          style={{
            background:
              'linear-gradient(145deg,rgba(15,29,49,0.96),rgba(7,17,31,0.98))',
            border:
              '1px solid rgba(239,68,68,0.10)',
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-5 h-5 text-red-400" />

            <h2 className="text-[14px] font-black text-white">
              مصروف المشوار
            </h2>

            <span className="text-[9px] text-slate-600">
              اختياري
            </span>
          </div>

          <div className="space-y-3">
            <input
              value={expenseType}
              onChange={(event) =>
                setExpenseType(
                  event.target.value
                )
              }
              placeholder="بيان المصروف - مثال: ديزل"
              className="w-full h-[52px] rounded-[15px] px-4 bg-[#091525] border border-white/10 text-white text-[12px] outline-none placeholder:text-slate-600"
            />

            <div className="relative">
              <input
                inputMode="decimal"
                value={
                  expenseAmount
                }
                onChange={(event) =>
                  setExpenseAmount(
                    normalizeArabicNumbers(
                      event.target
                        .value
                    )
                  )
                }
                placeholder="مبلغ المصروف"
                className="w-full h-[52px] rounded-[15px] pr-4 pl-16 bg-[#091525] border border-white/10 text-red-400 font-black text-[13px] outline-none placeholder:text-slate-600"
              />

              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
                ر.س
              </span>
            </div>
          </div>
        </section>

        {/* الملاحظات */}

        <section
          className="rounded-[24px] p-4 mb-5"
          style={{
            background:
              'linear-gradient(145deg,rgba(15,29,49,0.96),rgba(7,17,31,0.98))',
            border:
              '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-blue-400" />

            <h2 className="text-[14px] font-black text-white">
              ملاحظات
            </h2>
          </div>

          <textarea
            value={notes}
            onChange={(event) =>
              setNotes(
                event.target.value
              )
            }
            placeholder="أي ملاحظات على المشوار..."
            rows={4}
            className="w-full rounded-[15px] p-4 bg-[#091525] border border-white/10 text-white text-[12px] outline-none resize-none placeholder:text-slate-600"
          />
        </section>

        {/* الحفظ */}

        <button
          type="button"
          disabled={
            saving || loading
          }
          onClick={handleSave}
          className="w-full h-[59px] rounded-[18px] flex items-center justify-center gap-2 font-black text-[14px] text-white active:scale-[0.98] disabled:opacity-50"
          style={{
            background:
              'linear-gradient(135deg,#15803d,#22c55e)',
            boxShadow:
              '0 10px 25px rgba(34,197,94,0.18)',
          }}
        >
          <Save className="w-5 h-5" />

          {saving
            ? 'جاري الحفظ...'
            : 'حفظ المشوار'}
        </button>

        {/* فتح الحساب الشهري */}

        <button
          type="button"
          onClick={
            openMonthlyAccount
          }
          className="w-full h-[54px] rounded-[17px] mt-3 flex items-center justify-center gap-2 font-bold text-[12px] text-amber-400 active:scale-[0.98]"
          style={{
            background:
              'rgba(245,158,11,0.07)',
            border:
              '1px solid rgba(245,158,11,0.17)',
          }}
        >
          <ExternalLink className="w-4 h-4" />

          فتح الحساب الشهري للكرين
        </button>
      </div>
    </AppLayout>
  );
}

type FieldLabelProps = {
  icon: any;
  label: string;
};

function FieldLabel({
  icon: Icon,
  label,
}: FieldLabelProps) {
  return (
    <div className="flex items-center gap-2 mb-[-7px]">
      <Icon className="w-4 h-4 text-amber-400" />

      <label className="text-[11px] font-bold text-slate-300">
        {label}
      </label>
    </div>
  );
      }
