import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  CalendarDays,
  Users,
  Truck,
  Wallet,
  MapPin,
  FileText,
  Save,
  Receipt,
  Pencil,
  Trash2,
  X,
  Search,
  CheckCircle2,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';

import {
  fetchEquipment,
  type Equipment,
} from '@/lib/equipment';

const DRIVER_STORAGE_KEY =
  'crane_drivers_v1';

const EXPENSE_STORAGE_KEY =
  'crane_accounting_driver_equipment_expenses_v1';

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

const categories = [
  'ديزل',
  'سلفة / سحب',
  'صيانة',
  'كفرات',
  'قطع غيار',
  'مشتريات',
  'زيوت',
  'غسيل',
  'رسوم',
  'مصروف طريق',
  'أخرى',
];

function getTodayValue() {
  const now = new Date();

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
    )
    .replace(/٬/g, '')
    .replace(/,/g, '');
}

function toNumber(
  value: string
) {
  const normalized =
    normalizeArabicNumbers(
      value
    ).trim();

  const number =
    Number(normalized);

  return Number.isFinite(number)
    ? number
    : 0;
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

function loadDrivers():
  Driver[] {
  try {
    const saved =
      localStorage.getItem(
        DRIVER_STORAGE_KEY
      );

    if (!saved) {
      return [];
    }

    const parsed =
      JSON.parse(saved);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function loadExpenses():
  ExpenseRecord[] {
  try {
    const saved =
      localStorage.getItem(
        EXPENSE_STORAGE_KEY
      );

    if (!saved) {
      return [];
    }

    const parsed =
      JSON.parse(saved);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

export function DriverEquipmentExpensesPage() {
  const [
    drivers,
    setDrivers,
  ] =
    useState<Driver[]>([]);

  const [
    equipment,
    setEquipment,
  ] =
    useState<Equipment[]>([]);

  const [
    records,
    setRecords,
  ] =
    useState<ExpenseRecord[]>(
      () => loadExpenses()
    );

  const [
    editingId,
    setEditingId,
  ] =
    useState<number | null>(
      null
    );

  const [date, setDate] =
    useState(
      getTodayValue()
    );

  const [
    driverId,
    setDriverId,
  ] =
    useState('');

  const [
    equipmentId,
    setEquipmentId,
  ] =
    useState('');

  const [
    category,
    setCategory,
  ] =
    useState('ديزل');

  const [
    amount,
    setAmount,
  ] =
    useState('');

  const [
    location,
    setLocation,
  ] =
    useState('');

  const [
    notes,
    setNotes,
  ] =
    useState('');

  const [
    search,
    setSearch,
  ] =
    useState('');

  const [
    filterDriver,
    setFilterDriver,
  ] =
    useState('');

  const [
    filterEquipment,
    setFilterEquipment,
  ] =
    useState('');

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState('');

  const [
    error,
    setError,
  ] =
    useState('');

  useEffect(() => {
    setDrivers(
      loadDrivers()
    );

    let active =
      true;

    async function load() {
      try {
        setLoading(true);

        const result =
          await fetchEquipment();

        if (!active) {
          return;
        }

        setEquipment(
          result || []
        );
      } catch (
        loadError
      ) {
        console.error(
          loadError
        );

        if (active) {
          setError(
            'تعذر تحميل المعدات'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(
      EXPENSE_STORAGE_KEY,
      JSON.stringify(
        records
      )
    );
  }, [records]);

  const selectedDriver =
    useMemo(() => {
      return drivers.find(
        (driver) =>
          String(
            driver.id
          ) ===
          String(
            driverId
          )
      );
    }, [
      drivers,
      driverId,
    ]);

  const selectedEquipment =
    useMemo(() => {
      return equipment.find(
        (item) =>
          String(
            item.id
          ) ===
          String(
            equipmentId
          )
      );
    }, [
      equipment,
      equipmentId,
    ]);

  const equipmentName =
    useMemo(() => {
      if (
        !selectedEquipment
      ) {
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
    }, [
      selectedEquipment,
    ]);

  const affectsDriverBalance =
    category ===
    'سلفة / سحب';

  const monthPrefix =
    date
      ? date.slice(
          0,
          7
        )
      : '';

  const todayTotal =
    useMemo(() => {
      return records
        .filter(
          (record) =>
            record.date ===
            date
        )
        .reduce(
          (
            sum,
            record
          ) =>
            sum +
            Number(
              record.amount ||
                0
            ),
          0
        );
    }, [
      records,
      date,
    ]);

  const monthTotal =
    useMemo(() => {
      if (
        !monthPrefix
      ) {
        return 0;
      }

      return records
        .filter(
          (record) =>
            record.date.startsWith(
              monthPrefix
            )
        )
        .reduce(
          (
            sum,
            record
          ) =>
            sum +
            Number(
              record.amount ||
                0
            ),
          0
        );
    }, [
      records,
      monthPrefix,
    ]);

  const driverAdvanceTotal =
    useMemo(() => {
      if (
        !monthPrefix
      ) {
        return 0;
      }

      return records
        .filter(
          (record) =>
            record.date.startsWith(
              monthPrefix
            ) &&
            record.affectsDriverBalance
        )
        .reduce(
          (
            sum,
            record
          ) =>
            sum +
            Number(
              record.amount ||
                0
            ),
          0
        );
    }, [
      records,
      monthPrefix,
    ]);

  const filteredRecords =
    useMemo(() => {
      const text =
        search
          .trim()
          .toLowerCase();

      return records
        .filter(
          (record) => {
            if (
              filterDriver &&
              record.driverId !==
                filterDriver
            ) {
              return false;
            }

            if (
              filterEquipment &&
              record.equipmentId !==
                filterEquipment
            ) {
              return false;
            }

            if (
              !text
            ) {
              return true;
            }

            const haystack =
              [
                record.driverName,
                record.equipmentName,
                record.category,
                record.location,
                record.notes,
                record.date,
              ]
                .join(' ')
                .toLowerCase();

            return haystack.includes(
              text
            );
          }
        )
        .sort(
          (a, b) =>
            b.date.localeCompare(
              a.date
            ) ||
            b.id - a.id
        );
    }, [
      records,
      search,
      filterDriver,
      filterEquipment,
    ]);

  function clearMessages() {
    setMessage('');
    setError('');
  }

  function resetForm() {
    setEditingId(
      null
    );

    setDate(
      getTodayValue()
    );

    setDriverId('');

    setEquipmentId('');

    setCategory(
      'ديزل'
    );

    setAmount('');

    setLocation('');

    setNotes('');
  }

  function handleSave() {
    clearMessages();

    if (
      !driverId &&
      !equipmentId
    ) {
      setError(
        'اختر السائق أو المعدة على الأقل'
      );

      return;
    }

    if (!date) {
      setError(
        'اختر التاريخ'
      );

      return;
    }

    const numericAmount =
      toNumber(
        amount
      );

    if (
      numericAmount <= 0
    ) {
      setError(
        'اكتب مبلغ المصروف'
      );

      return;
    }

    if (
      affectsDriverBalance &&
      !driverId
    ) {
      setError(
        'السلفة أو السحب يجب أن تكون مرتبطة بسائق'
      );

      return;
    }

    if (
      category ===
        'ديزل' &&
      !equipmentId
    ) {
      setError(
        'مصروف الديزل يجب أن يكون مرتبطًا بمعدة'
      );

      return;
    }

    try {
      setSaving(true);

      const now =
        new Date().toISOString();

      const record:
        ExpenseRecord = {
        id:
          editingId ||
          Date.now(),

        date,

        driverId,

        driverName:
          selectedDriver
            ?.name ||
          '',

        equipmentId,

        equipmentName,

        category,

        amount:
          numericAmount,

        location:
          location.trim(),

        notes:
          notes.trim(),

        affectsDriverBalance,

        createdAt:
          editingId
            ? records.find(
                (item) =>
                  item.id ===
                  editingId
              )
                ?.createdAt ||
              now
            : now,

        updatedAt:
          now,
      };

      if (
        editingId
      ) {
        setRecords(
          (old) =>
            old.map(
              (item) =>
                item.id ===
                editingId
                  ? record
                  : item
            )
        );

        setMessage(
          'تم تحديث الحركة بنجاح'
        );
      } else {
        setRecords(
          (old) => [
            record,
            ...old,
          ]
        );

        setMessage(
          'تم حفظ المصروف وربطه بالسائق والمعدة'
        );
      }

      resetForm();
    } catch (
      saveError
    ) {
      console.error(
        saveError
      );

      setError(
        'حدث خطأ أثناء الحفظ'
      );
    } finally {
      setSaving(false);
    }
  }

  function editRecord(
    record:
      ExpenseRecord
  ) {
    clearMessages();

    setEditingId(
      record.id
    );

    setDate(
      record.date
    );

    setDriverId(
      record.driverId
    );

    setEquipmentId(
      record.equipmentId
    );

    setCategory(
      record.category
    );

    setAmount(
      String(
        record.amount
      )
    );

    setLocation(
      record.location
    );

    setNotes(
      record.notes
    );

    window.scrollTo({
      top: 0,
      behavior:
        'smooth',
    });
  }

  function deleteRecord(
    id: number
  ) {
    const ok =
      window.confirm(
        'هل تريد حذف هذه الحركة؟'
      );

    if (!ok) {
      return;
    }

    setRecords(
      (old) =>
        old.filter(
          (item) =>
            item.id !== id
        )
    );

    if (
      editingId ===
      id
    ) {
      resetForm();
    }

    setMessage(
      'تم حذف الحركة'
    );
  }

  const cardStyle:
    React.CSSProperties = {
    background:
      'linear-gradient(145deg,#0f1d31,#07111f)',
    border:
      '1px solid rgba(255,255,255,0.07)',
    borderRadius:
      22,
    padding:
      15,
  };

  const inputStyle:
    React.CSSProperties = {
    width:
      '100%',
    height:
      52,
    borderRadius:
      14,
    border:
      '1px solid #26364d',
    background:
      '#091525',
    color:
      '#ffffff',
    boxSizing:
      'border-box',
    padding:
      '0 14px',
    fontSize:
      13,
    outline:
      'none',
  };

  return (
    <AppLayout>
      <div
        dir="rtl"
        style={{
          maxWidth:
            760,
          margin:
            'auto',
          paddingBottom:
            80,
          color:
            '#ffffff',
        }}
      >
        <section
          style={{
            ...cardStyle,
            padding:
              20,
            marginBottom:
              16,
            border:
              '1px solid rgba(245,158,11,0.16)',
          }}
        >
          <div
            style={{
              display:
                'flex',
              gap:
                12,
              alignItems:
                'center',
            }}
          >
            <div
              style={{
                width:
                  56,
                height:
                  56,
                borderRadius:
                  18,
                display:
                  'flex',
                alignItems:
                  'center',
                justifyContent:
                  'center',
                background:
                  'rgba(245,158,11,0.10)',
              }}
            >
              <Receipt
                size={28}
                color="#f59e0b"
              />
            </div>

            <div>
              <div
                style={{
                  color:
                    '#f59e0b',
                  fontWeight:
                    900,
                  fontSize:
                    10,
                  letterSpacing:
                    1.5,
                }}
              >
                BAKR PRO
              </div>

              <h1
                style={{
                  margin:
                    '4px 0 0',
                  fontSize:
                    22,
                }}
              >
                مصروفات وتشغيل
              </h1>

              <p
                style={{
                  margin:
                    '5px 0 0',
                  color:
                    '#94a3b8',
                  fontSize:
                    11,
                }}
              >
                تسجيل مصروفات السائقين والمعدات من مكان واحد
              </p>
            </div>
          </div>
        </section>

        {message && (
          <div
            style={{
              marginBottom:
                14,
              borderRadius:
                14,
              padding:
                12,
              display:
                'flex',
              gap:
                8,
              alignItems:
                'center',
              background:
                'rgba(34,197,94,0.10)',
              border:
                '1px solid rgba(34,197,94,0.20)',
              color:
                '#86efac',
              fontSize:
                12,
              fontWeight:
                800,
            }}
          >
            <CheckCircle2
              size={18}
            />

            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom:
                14,
              borderRadius:
                14,
              padding:
                12,
              background:
                'rgba(239,68,68,0.10)',
              border:
                '1px solid rgba(239,68,68,0.20)',
              color:
                '#fca5a5',
              fontSize:
                12,
              fontWeight:
                800,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display:
              'grid',
            gridTemplateColumns:
              'repeat(3,1fr)',
            gap:
              8,
            marginBottom:
              15,
          }}
        >
          <SummaryCard
            title="مصروف اليوم"
            value={
              todayTotal
            }
            color="#ef4444"
          />

          <SummaryCard
            title="مصروف الشهر"
            value={
              monthTotal
            }
            color="#f59e0b"
          />

          <SummaryCard
            title="سلف السائقين"
            value={
              driverAdvanceTotal
            }
            color="#8b5cf6"
          />
        </div>

        <section
          style={{
            ...cardStyle,
            marginBottom:
              16,
          }}
        >
          <h2
            style={{
              margin:
                '0 0 16px',
              fontSize:
                16,
            }}
          >
            {editingId
              ? 'تعديل الحركة'
              : 'إضافة حركة جديدة'}
          </h2>

          <div
            style={{
              display:
                'grid',
              gap:
                13,
            }}
          >
            <FieldTitle
              icon={
                CalendarDays
              }
              title="التاريخ"
            />

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

            <FieldTitle
              icon={
                Users
              }
              title="السائق / المشغل"
            />

            <select
              value={
                driverId
              }
              onChange={(
                event
              ) =>
                setDriverId(
                  event.target
                    .value
                )
              }
              style={
                inputStyle
              }
            >
              <option value="">
                بدون سائق
              </option>

              {drivers.map(
                (driver) => (
                  <option
                    key={
                      driver.id
                    }
                    value={
                      driver.id
                    }
                  >
                    {
                      driver.name
                    }
                  </option>
                )
              )}
            </select>

            <FieldTitle
              icon={
                Truck
              }
              title="الكرين / المعدة"
            />

            <select
              value={
                equipmentId
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
              disabled={
                loading
              }
            >
              <option value="">
                بدون معدة
              </option>

              {equipment.map(
                (
                  item: any
                ) => (
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

            <FieldTitle
              icon={
                Receipt
              }
              title="نوع الحركة"
            />

            <select
              value={
                category
              }
              onChange={(
                event
              ) =>
                setCategory(
                  event.target
                    .value
                )
              }
              style={
                inputStyle
              }
            >
              {categories.map(
                (item) => (
                  <option
                    key={
                      item
                    }
                    value={
                      item
                    }
                  >
                    {item}
                  </option>
                )
              )}
            </select>

            {affectsDriverBalance && (
              <div
                style={{
                  padding:
                    11,
                  borderRadius:
                    12,
                  background:
                    'rgba(139,92,246,0.10)',
                  border:
                    '1px solid rgba(139,92,246,0.20)',
                  color:
                    '#c4b5fd',
                  fontSize:
                    11,
                  lineHeight:
                    1.8,
                }}
              >
                هذه الحركة تعتبر سلفة/سحب للسائق وستدخل في حساب مستحقاته.
              </div>
            )}

            <FieldTitle
              icon={
                Wallet
              }
              title="المبلغ"
            />

            <div
              style={{
                position:
                  'relative',
              }}
            >
              <input
                value={
                  amount
                }
                inputMode="decimal"
                onChange={(
                  event
                ) =>
                  setAmount(
                    normalizeArabicNumbers(
                      event.target
                        .value
                    )
                  )
                }
                placeholder="0"
                style={{
                  ...inputStyle,
                  paddingLeft:
                    58,
                  color:
                    '#fca5a5',
                  fontWeight:
                    900,
                }}
              />

              <span
                style={{
                  position:
                    'absolute',
                  left:
                    15,
                  top:
                    '50%',
                  transform:
                    'translateY(-50%)',
                  color:
                    '#64748b',
                  fontSize:
                    11,
                }}
              >
                ر.س
              </span>
            </div>

            <FieldTitle
              icon={
                MapPin
              }
              title="الموقع / الجهة"
            />

            <input
              value={
                location
              }
              onChange={(
                event
              ) =>
                setLocation(
                  event.target
                    .value
                )
              }
              placeholder="مثال: محطة الدريس - خميس مشيط"
              style={
                inputStyle
              }
            />

            <FieldTitle
              icon={
                FileText
              }
              title="ملاحظات"
            />

            <textarea
              value={
                notes
              }
              onChange={(
                event
              ) =>
                setNotes(
                  event.target
                    .value
                )
              }
              placeholder="ملاحظات اختيارية..."
              rows={3}
              style={{
                ...inputStyle,
                height:
                  'auto',
                padding:
                  13,
                resize:
                  'none',
              }}
            />

            <button
              type="button"
              disabled={
                saving
              }
              onClick={
                handleSave
              }
              style={{
                height:
                  56,
                border:
                  0,
                borderRadius:
                  15,
                background:
                  editingId
                    ? '#2563eb'
                    : '#16a34a',
                color:
                  '#ffffff',
                fontWeight:
                  900,
                fontSize:
                  14,
                display:
                  'flex',
                alignItems:
                  'center',
                justifyContent:
                  'center',
                gap:
                  8,
              }}
            >
              <Save
                size={19}
              />

              {saving
                ? 'جاري الحفظ...'
                : editingId
                  ? 'حفظ التعديل'
                  : 'حفظ الحركة'}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={
                  resetForm
                }
                style={{
                  height:
                    48,
                  borderRadius:
                    14,
                  background:
                    '#172033',
                  border:
                    '1px solid #334155',
                  color:
                    '#cbd5e1',
                  fontWeight:
                    800,
                  display:
                    'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                  gap:
                    7,
                }}
              >
                <X
                  size={18}
                />

                إلغاء التعديل
              </button>
            )}
          </div>
        </section>

        <section
          style={{
            ...cardStyle,
            marginBottom:
              15,
          }}
        >
          <h2
            style={{
              margin:
                '0 0 13px',
              fontSize:
                16,
            }}
          >
            البحث والفلترة
          </h2>

          <div
            style={{
              display:
                'grid',
              gap:
                9,
            }}
          >
            <div
              style={{
                position:
                  'relative',
              }}
            >
              <Search
                size={17}
                style={{
                  position:
                    'absolute',
                  right:
                    13,
                  top:
                    17,
                  color:
                    '#64748b',
                }}
              />

              <input
                value={
                  search
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target
                      .value
                  )
                }
                placeholder="بحث في المصروفات..."
                style={{
                  ...inputStyle,
                  paddingRight:
                    40,
                }}
              />
            </div>

            <select
              value={
                filterDriver
              }
              onChange={(
                event
              ) =>
                setFilterDriver(
                  event.target
                    .value
                )
              }
              style={
                inputStyle
              }
            >
              <option value="">
                جميع السائقين
              </option>

              {drivers.map(
                (driver) => (
                  <option
                    key={
                      driver.id
                    }
                    value={
                      driver.id
                    }
                  >
                    {
                      driver.name
                    }
                  </option>
                )
              )}
            </select>

            <select
              value={
                filterEquipment
              }
              onChange={(
                event
              ) =>
                setFilterEquipment(
                  event.target
                    .value
                )
              }
              style={
                inputStyle
              }
            >
              <option value="">
                جميع المعدات
              </option>

              {equipment.map(
                (
                  item: any
                ) => (
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
          </div>
        </section>

        <h2
          style={{
            fontSize:
              17,
            marginBottom:
              12,
          }}
        >
          سجل الحركات
        </h2>

        {filteredRecords.length ===
        0 ? (
          <div
            style={{
              ...cardStyle,
              textAlign:
                'center',
              color:
                '#94a3b8',
              fontSize:
                12,
            }}
          >
            لا توجد حركات مسجلة
          </div>
        ) : (
          <div
            style={{
              display:
                'grid',
              gap:
                10,
            }}
          >
            {filteredRecords.map(
              (record) => (
                <div
                  key={
                    record.id
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
                    }}
                  >
                    <div>
                      <strong
                        style={{
                          color:
                            '#ffffff',
                          fontSize:
                            14,
                        }}
                      >
                        {
                          record.category
                        }
                      </strong>

                      <div
                        style={{
                          marginTop:
                            5,
                          color:
                            '#94a3b8',
                          fontSize:
                            10,
                        }}
                      >
                        {
                          record.date
                        }
                      </div>
                    </div>

                    <strong
                      style={{
                        color:
                          '#f87171',
                        fontSize:
                          16,
                      }}
                    >
                      {record.amount.toLocaleString(
                        'en-US'
                      )}{' '}
                      ر.س
                    </strong>
                  </div>

                  <div
                    style={{
                      marginTop:
                        12,
                      display:
                        'grid',
                      gap:
                        5,
                      fontSize:
                        11,
                      color:
                        '#cbd5e1',
                    }}
                  >
                    {record.driverName && (
                      <div>
                        👷 السائق:{' '}
                        <strong>
                          {
                            record.driverName
                          }
                        </strong>
                      </div>
                    )}

                    {record.equipmentName && (
                      <div>
                        🏗️ المعدة:{' '}
                        <strong>
                          {
                            record.equipmentName
                          }
                        </strong>
                      </div>
                    )}

                    {record.location && (
                      <div>
                        📍 المكان:{' '}
                        {
                          record.location
                        }
                      </div>
                    )}

                    {record.notes && (
                      <div>
                        📝{' '}
                        {
                          record.notes
                        }
                      </div>
                    )}

                    {record.affectsDriverBalance && (
                      <div
                        style={{
                          color:
                            '#c4b5fd',
                          fontWeight:
                            800,
                        }}
                      >
                        💳 محسوبة كسلفة على السائق
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display:
                        'grid',
                      gridTemplateColumns:
                        '1fr 1fr',
                      gap:
                        8,
                      marginTop:
                        13,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        editRecord(
                          record
                        )
                      }
                      style={{
                        height:
                          42,
                        borderRadius:
                          11,
                        background:
                          '#10294a',
                        color:
                          '#93c5fd',
                        border:
                          '1px solid #315f9d',
                        fontWeight:
                          800,
                        display:
                          'flex',
                        alignItems:
                          'center',
                        justifyContent:
                          'center',
                        gap:
                          5,
                      }}
                    >
                      <Pencil
                        size={15}
                      />

                      تعديل
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        deleteRecord(
                          record.id
                        )
                      }
                      style={{
                        height:
                          42,
                        borderRadius:
                          11,
                        background:
                          '#411827',
                        color:
                          '#fda4af',
                        border:
                          '1px solid #7f1d1d',
                        fontWeight:
                          800,
                        display:
                          'flex',
                        alignItems:
                          'center',
                        justifyContent:
                          'center',
                        gap:
                          5,
                      }}
                    >
                      <Trash2
                        size={15}
                      />

                      حذف
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

type FieldTitleProps = {
  icon: any;
  title: string;
};

function FieldTitle({
  icon: Icon,
  title,
}: FieldTitleProps) {
  return (
    <div
      style={{
        display:
          'flex',
        alignItems:
          'center',
        gap:
          7,
        marginBottom:
          -5,
      }}
    >
      <Icon
        size={16}
        color="#f59e0b"
      />

      <span
        style={{
          color:
            '#cbd5e1',
          fontSize:
            11,
          fontWeight:
            800,
        }}
      >
        {title}
      </span>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        background:
          '#0b1527',
        border:
          '1px solid #1d2d47',
        borderRadius:
          15,
        padding:
          '12px 5px',
        textAlign:
          'center',
      }}
    >
      <div
        style={{
          color:
            '#94a3b8',
          fontSize:
            9,
        }}
      >
        {title}
      </div>

      <div
        style={{
          color,
          fontSize:
            14,
          fontWeight:
            900,
          marginTop:
            7,
        }}
      >
        {value.toLocaleString(
          'en-US'
        )}
      </div>

      <div
        style={{
          color:
            '#64748b',
          fontSize:
            9,
          marginTop:
            2,
        }}
      >
        ر.س
      </div>
    </div>
  );
            }
