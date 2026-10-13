import {
  useMemo,
  useState,
} from 'react';

import {
  BadgeCheck,
  CalendarDays,
  CreditCard,
  HardHat,
  IdCard,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';

type OperatorStatus =
  | 'valid'
  | 'expired'
  | 'suspended';

type OperatorQualificationRecord = {
  id: string;
  cardNo: string;
  operatorName: string;
  idNumber: string;
  employer: string;
  qualificationType: string;
  capacityRange: string;
  equipmentType: string;
  issueDate: string;
  expiryDate: string;
  inspector: string;
  status: OperatorStatus;
  verificationUrl: string;
  notes: string;
};

const STORAGE_KEY =
  'bakr_pro_operator_qualification_cards_v1';

const inputClass =
  'w-full h-12 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-400/50';

const labelClass =
  'block mb-2 text-[11px] font-black text-slate-300';

function currentYear2() {
  return String(
    new Date().getFullYear()
  ).slice(-2);
}

function nextCardNo(
  records: OperatorQualificationRecord[]
) {
  let max = 0;

  records.forEach((item) => {
    const match = item.cardNo.match(
      /^OPC-\d{2}-(\d+)$/
    );

    if (match) {
      max = Math.max(
        max,
        Number(match[1])
      );
    }
  });

  return `OPC-${currentYear2()}-${String(
    max + 1
  ).padStart(6, '0')}`;
}

function loadRecords():
  OperatorQualificationRecord[] {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function statusText(
  status: OperatorStatus
) {
  if (status === 'valid') {
    return 'سارية';
  }

  if (status === 'expired') {
    return 'منتهية';
  }

  return 'موقوفة';
}

function statusStyle(
  status: OperatorStatus
) {
  if (status === 'valid') {
    return {
      background:
        'rgba(34,197,94,0.12)',
      color: '#4ade80',
      border:
        '1px solid rgba(74,222,128,0.22)',
    };
  }

  if (status === 'expired') {
    return {
      background:
        'rgba(245,158,11,0.12)',
      color: '#fbbf24',
      border:
        '1px solid rgba(251,191,36,0.22)',
    };
  }

  return {
    background:
      'rgba(239,68,68,0.12)',
    color: '#fb7185',
    border:
      '1px solid rgba(251,113,133,0.22)',
  };
}

export function OperatorQualificationPage() {
  const [records, setRecords] =
    useState<
      OperatorQualificationRecord[]
    >(() => loadRecords());

  const [search, setSearch] =
    useState('');

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [cardNo, setCardNo] =
    useState(() =>
      nextCardNo(loadRecords())
    );

  const [
    operatorName,
    setOperatorName,
  ] = useState('');

  const [idNumber, setIdNumber] =
    useState('');

  const [employer, setEmployer] =
    useState('');

  const [
    qualificationType,
    setQualificationType,
  ] = useState(
    'Mobile Crane Operator'
  );

  const [
    capacityRange,
    setCapacityRange,
  ] = useState('20T - 50T');

  const [
    equipmentType,
    setEquipmentType,
  ] = useState('Mobile Crane');

  const [issueDate, setIssueDate] =
    useState('');

  const [expiryDate, setExpiryDate] =
    useState('');

  const [inspector, setInspector] =
    useState('');

  const [status, setStatus] =
    useState<OperatorStatus>('valid');

  const [
    verificationUrl,
    setVerificationUrl,
  ] = useState('');

  const [notes, setNotes] =
    useState('');

  const filtered = useMemo(() => {
    const q = search
      .trim()
      .toLowerCase();

    if (!q) {
      return records;
    }

    return records.filter((item) => {
      const text = [
        item.cardNo,
        item.operatorName,
        item.idNumber,
        item.employer,
        item.qualificationType,
        item.capacityRange,
        item.equipmentType,
        item.inspector,
      ]
        .join(' ')
        .toLowerCase();

      return text.includes(q);
    });
  }, [records, search]);

  function persist(
    next:
      OperatorQualificationRecord[]
  ) {
    setRecords(next);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(next)
    );
  }

  function clearForm(
    nextRecords = records
  ) {
    setEditingId(null);

    setCardNo(
      nextCardNo(nextRecords)
    );

    setOperatorName('');
    setIdNumber('');
    setEmployer('');

    setQualificationType(
      'Mobile Crane Operator'
    );

    setCapacityRange(
      '20T - 50T'
    );

    setEquipmentType(
      'Mobile Crane'
    );

    setIssueDate('');
    setExpiryDate('');
    setInspector('');
    setStatus('valid');
    setVerificationUrl('');
    setNotes('');
  }

  function saveRecord() {
    if (!operatorName.trim()) {
      alert(
        'اكتب اسم المشغل'
      );

      return;
    }

    if (!idNumber.trim()) {
      alert(
        'اكتب رقم الهوية أو الإقامة'
      );

      return;
    }

    if (
      !issueDate ||
      !expiryDate
    ) {
      alert(
        'حدد تاريخ الإصدار والانتهاء'
      );

      return;
    }

    const record:
      OperatorQualificationRecord = {
      id:
        editingId ??
        `${Date.now()}`,
      cardNo:
        cardNo.trim().toUpperCase(),
      operatorName:
        operatorName.trim(),
      idNumber:
        idNumber.trim(),
      employer:
        employer.trim(),
      qualificationType:
        qualificationType.trim(),
      capacityRange:
        capacityRange.trim(),
      equipmentType:
        equipmentType.trim(),
      issueDate,
      expiryDate,
      inspector:
        inspector.trim(),
      status,
      verificationUrl:
        verificationUrl.trim(),
      notes: notes.trim(),
    };

    const next =
      editingId === null
        ? [record, ...records]
        : records.map((item) =>
            item.id === editingId
              ? record
              : item
          );

    persist(next);
    clearForm(next);

    alert(
      editingId === null
        ? 'تم حفظ بطاقة التأهيل'
        : 'تم تحديث بطاقة التأهيل'
    );
  }

  function editRecord(
    record:
      OperatorQualificationRecord
  ) {
    setEditingId(record.id);
    setCardNo(record.cardNo);

    setOperatorName(
      record.operatorName
    );

    setIdNumber(
      record.idNumber
    );

    setEmployer(
      record.employer
    );

    setQualificationType(
      record.qualificationType
    );

    setCapacityRange(
      record.capacityRange
    );

    setEquipmentType(
      record.equipmentType
    );

    setIssueDate(
      record.issueDate
    );

    setExpiryDate(
      record.expiryDate
    );

    setInspector(
      record.inspector
    );

    setStatus(record.status);

    setVerificationUrl(
      record.verificationUrl
    );

    setNotes(record.notes);

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function deleteRecord(id: string) {
    const ok = confirm(
      'هل تريد حذف بطاقة التأهيل؟'
    );

    if (!ok) return;

    const next = records.filter(
      (item) => item.id !== id
    );

    persist(next);

    if (editingId === id) {
      clearForm(next);
    }
  }

  return (
    <AppLayout>
      <div
        dir="rtl"
        className="w-full pb-8"
      >
        <section
          className="rounded-[26px] p-5 mb-5 overflow-hidden relative"
          style={{
            background:
              'linear-gradient(135deg,#0b1a2c,#102b46 62%,#162032)',
            border:
              '1px solid rgba(245,158,11,0.18)',
            boxShadow:
              '0 16px 38px rgba(0,0,0,0.20)',
          }}
        >
          <div className="relative z-10 flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-[20px] flex items-center justify-center shrink-0"
              style={{
                background:
                  'rgba(245,158,11,0.13)',
                border:
                  '1px solid rgba(251,191,36,0.22)',
              }}
            >
              <HardHat className="w-9 h-9 text-amber-400" />
            </div>

            <div>
              <p className="text-[10px] text-amber-400 font-black tracking-[0.16em]">
                BAKR PRO
              </p>

              <h1 className="text-[22px] font-black text-white mt-1">
                بطاقة تأهيل المشغل
              </h1>

              <p className="text-[11px] text-slate-400 mt-1">
                Operator Training &
                Qualification Record
              </p>
            </div>
          </div>
        </section>

        <section
          className="rounded-[24px] p-4 mb-5"
          style={{
            background:
              'linear-gradient(145deg,rgba(15,29,49,0.98),rgba(7,17,31,0.99))',
            border:
              '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[16px] font-black text-white">
                بيانات بطاقة التأهيل
              </h2>

              <p className="text-[9px] text-slate-500 mt-1">
                سجل داخلي للتدريب
                والتأهيل — ليس رخصة
                حكومية
              </p>
            </div>

            <CreditCard className="w-7 h-7 text-amber-400" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>
                رقم البطاقة
              </label>

              <input
                value={cardNo}
                onChange={(event) =>
                  setCardNo(
                    event.target.value
                  )
                }
                className={inputClass}
                placeholder="OPC-26-000001"
              />
            </div>

            <div>
              <label className={labelClass}>
                اسم المشغل
              </label>

              <input
                value={operatorName}
                onChange={(event) =>
                  setOperatorName(
                    event.target.value
                  )
                }
                className={inputClass}
                placeholder="اسم المشغل"
              />
            </div>

            <div>
              <label className={labelClass}>
                رقم الهوية / الإقامة
              </label>

              <input
                value={idNumber}
                onChange={(event) =>
                  setIdNumber(
                    event.target.value
                  )
                }
                className={inputClass}
                inputMode="numeric"
                placeholder="رقم الهوية أو الإقامة"
              />
            </div>

            <div>
              <label className={labelClass}>
                المنشأة / جهة العمل
              </label>

              <input
                value={employer}
                onChange={(event) =>
                  setEmployer(
                    event.target.value
                  )
                }
                className={inputClass}
                placeholder="اسم الشركة أو المؤسسة"
              />
            </div>

            <div>
              <label className={labelClass}>
                نوع التأهيل
              </label>

              <input
                value={
                  qualificationType
                }
                onChange={(event) =>
                  setQualificationType(
                    event.target.value
                  )
                }
                className={inputClass}
                placeholder="Mobile Crane Operator"
              />
            </div>

            <div>
              <label className={labelClass}>
                نوع المعدة
              </label>

              <input
                value={equipmentType}
                onChange={(event) =>
                  setEquipmentType(
                    event.target.value
                  )
                }
                className={inputClass}
                placeholder="Mobile Crane"
              />
            </div>

            <div>
              <label className={labelClass}>
                الفئة / الحمولة
              </label>

              <input
                value={capacityRange}
                onChange={(event) =>
                  setCapacityRange(
                    event.target.value
                  )
                }
                className={inputClass}
                placeholder="20T - 50T"
              />
            </div>

            <div>
              <label className={labelClass}>
                الفاحص / المقيّم
              </label>

              <input
                value={inspector}
                onChange={(event) =>
                  setInspector(
                    event.target.value
                  )
                }
                className={inputClass}
                placeholder="اسم الفاحص أو المقيّم"
              />
            </div>

            <div>
              <label className={labelClass}>
                تاريخ الإصدار
              </label>

              <input
                type="date"
                value={issueDate}
                onChange={(event) =>
                  setIssueDate(
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                تاريخ الانتهاء
              </label>

              <input
                type="date"
                value={expiryDate}
                onChange={(event) =>
                  setExpiryDate(
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                حالة البطاقة
              </label>

              <select
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target
                      .value as OperatorStatus
                  )
                }
                className={inputClass}
              >
                <option value="valid">
                  سارية
                </option>

                <option value="expired">
                  منتهية
                </option>

                <option value="suspended">
                  موقوفة
                </option>
              </select>
            </div>

            <div>
              <label className={labelClass}>
                رابط التحقق
              </label>

              <input
                value={
                  verificationUrl
                }
                onChange={(event) =>
                  setVerificationUrl(
                    event.target.value
                  )
                }
                className={inputClass}
                placeholder="ضع رابط موقع الفحص بعد النشر"
                dir="ltr"
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>
                ملاحظات
              </label>

              <textarea
                value={notes}
                onChange={(event) =>
                  setNotes(
                    event.target.value
                  )
                }
                className="w-full min-h-[90px] rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-400/50"
                placeholder="ملاحظات التدريب أو التقييم"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={saveRecord}
              className="h-12 px-5 rounded-2xl bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 active:scale-95"
            >
              <Save className="w-4 h-4" />

              {editingId
                ? 'تحديث البطاقة'
                : 'حفظ البطاقة'}
            </button>

            <button
              type="button"
              onClick={() =>
                clearForm()
              }
              className="h-12 px-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              جديد
            </button>
          </div>
        </section>

        <section
          className="rounded-[24px] p-4"
          style={{
            background:
              'linear-gradient(145deg,rgba(15,29,49,0.98),rgba(7,17,31,0.99))',
            border:
              '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[16px] font-black text-white">
                بطاقات المشغلين
              </h2>

              <p className="text-[9px] text-slate-500 mt-1">
                {records.length} سجل محفوظ
              </p>
            </div>

            <div className="relative flex-1 max-w-[260px]">
              <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                className="w-full h-10 rounded-xl border border-white/10 bg-slate-950/60 pr-9 pl-3 text-[11px] text-white outline-none"
                placeholder="بحث..."
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <ShieldCheck className="w-12 h-12 text-slate-700 mx-auto" />

              <p className="text-sm font-bold text-slate-400 mt-3">
                لا توجد بطاقات محفوظة
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(
                (record) => (
                  <article
                    key={record.id}
                    className="rounded-[20px] p-4"
                    style={{
                      background:
                        'rgba(255,255,255,0.035)',
                      border:
                        '1px solid rgba(255,255,255,0.075)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-400/10 flex items-center justify-center shrink-0">
                        <UserRound className="w-6 h-6 text-amber-400" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-[14px] font-black text-white">
                              {
                                record.operatorName
                              }
                            </h3>

                            <p
                              className="text-[10px] text-amber-300 mt-0.5"
                              dir="ltr"
                            >
                              {record.cardNo}
                            </p>
                          </div>

                          <span
                            className="px-2.5 py-1 rounded-full text-[9px] font-black"
                            style={statusStyle(
                              record.status
                            )}
                          >
                            {statusText(
                              record.status
                            )}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-[10px] text-slate-400">
                          <div className="flex items-center gap-2">
                            <IdCard className="w-3.5 h-3.5" />
                            <span>
                              {
                                record.idNumber
                              }
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <HardHat className="w-3.5 h-3.5" />
                            <span>
                              {
                                record.qualificationType
                              }
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <BadgeCheck className="w-3.5 h-3.5" />
                            <span>
                              {
                                record.capacityRange
                              }
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <CalendarDays className="w-3.5 h-3.5" />
                            <span dir="ltr">
                              {
                                record.issueDate
                              }{' '}
                              →{' '}
                              {
                                record.expiryDate
                              }
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-4">
                          <button
                            type="button"
                            onClick={() =>
                              editRecord(
                                record
                              )
                            }
                            className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black text-white"
                          >
                            تعديل
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteRecord(
                                record.id
                              )
                            }
                            className="h-9 px-3 rounded-xl bg-red-500/10 border border-red-400/15 text-[10px] font-black text-red-300 flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            حذف
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
