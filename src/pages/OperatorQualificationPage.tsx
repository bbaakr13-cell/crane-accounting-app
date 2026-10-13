import {
  useMemo,
  useState,
} from 'react';

import {
  BadgeCheck,
  CalendarDays,
  HardHat,
  IdCard,
  Plus,
  Save,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';

type OperatorStatus =
  | 'valid'
  | 'expired'
  | 'suspended';

type OperatorCard = {
  id: string;
  cardNo: string;
  operatorName: string;
  idNumber: string;
  employer: string;
  qualificationType: string;
  equipmentType: string;
  capacityRange: string;
  issueDate: string;
  expiryDate: string;
  evaluator: string;
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

function loadCards(): OperatorCard[] {
  try {
    const raw = localStorage.getItem(
      STORAGE_KEY
    );

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function nextCardNo(
  cards: OperatorCard[]
) {
  let max = 0;

  cards.forEach((card) => {
    const match =
      card.cardNo.match(
        /^OPC-\d{2}-(\d+)$/
      );

    if (match) {
      max = Math.max(
        max,
        Number(match[1])
      );
    }
  });

  const yy = String(
    new Date().getFullYear()
  ).slice(-2);

  return `OPC-${yy}-${String(
    max + 1
  ).padStart(6, '0')}`;
}

function statusLabel(
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

export function OperatorQualificationPage() {
  const [cards, setCards] =
    useState<OperatorCard[]>(
      () => loadCards()
    );

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState('');

  const [cardNo, setCardNo] =
    useState(() =>
      nextCardNo(loadCards())
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
    equipmentType,
    setEquipmentType,
  ] = useState('Mobile Crane');

  const [
    capacityRange,
    setCapacityRange,
  ] = useState('20T - 50T');

  const [issueDate, setIssueDate] =
    useState('');

  const [expiryDate, setExpiryDate] =
    useState('');

  const [evaluator, setEvaluator] =
    useState('');

  const [status, setStatus] =
    useState<OperatorStatus>('valid');

  const [
    verificationUrl,
    setVerificationUrl,
  ] = useState('');

  const [notes, setNotes] =
    useState('');

  const filteredCards = useMemo(() => {
    const q = search
      .trim()
      .toLowerCase();

    if (!q) return cards;

    return cards.filter((card) =>
      [
        card.cardNo,
        card.operatorName,
        card.idNumber,
        card.employer,
        card.qualificationType,
        card.equipmentType,
        card.capacityRange,
        card.evaluator,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [cards, search]);

  function persist(
    next: OperatorCard[]
  ) {
    setCards(next);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(next)
    );
  }

  function resetForm(
    source = cards
  ) {
    setEditingId(null);
    setCardNo(
      nextCardNo(source)
    );
    setOperatorName('');
    setIdNumber('');
    setEmployer('');
    setQualificationType(
      'Mobile Crane Operator'
    );
    setEquipmentType(
      'Mobile Crane'
    );
    setCapacityRange(
      '20T - 50T'
    );
    setIssueDate('');
    setExpiryDate('');
    setEvaluator('');
    setStatus('valid');
    setVerificationUrl('');
    setNotes('');
  }

  function saveCard() {
    if (!operatorName.trim()) {
      alert('اكتب اسم المشغل');
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

    const card: OperatorCard = {
      id:
        editingId ??
        String(Date.now()),
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
      equipmentType:
        equipmentType.trim(),
      capacityRange:
        capacityRange.trim(),
      issueDate,
      expiryDate,
      evaluator:
        evaluator.trim(),
      status,
      verificationUrl:
        verificationUrl.trim(),
      notes: notes.trim(),
    };

    const next =
      editingId === null
        ? [card, ...cards]
        : cards.map((item) =>
            item.id === editingId
              ? card
              : item
          );

    persist(next);
    resetForm(next);

    alert(
      editingId
        ? 'تم تحديث البطاقة'
        : 'تم حفظ البطاقة'
    );
  }

  function editCard(
    card: OperatorCard
  ) {
    setEditingId(card.id);
    setCardNo(card.cardNo);
    setOperatorName(
      card.operatorName
    );
    setIdNumber(card.idNumber);
    setEmployer(card.employer);
    setQualificationType(
      card.qualificationType
    );
    setEquipmentType(
      card.equipmentType
    );
    setCapacityRange(
      card.capacityRange
    );
    setIssueDate(card.issueDate);
    setExpiryDate(
      card.expiryDate
    );
    setEvaluator(card.evaluator);
    setStatus(card.status);
    setVerificationUrl(
      card.verificationUrl
    );
    setNotes(card.notes);

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function deleteCard(id: string) {
    if (
      !window.confirm(
        'هل تريد حذف هذه البطاقة؟'
      )
    ) {
      return;
    }

    const next = cards.filter(
      (item) => item.id !== id
    );

    persist(next);

    if (editingId === id) {
      resetForm(next);
    }
  }

  return (
    <AppLayout>
      <div
        dir="rtl"
        className="w-full pb-8"
      >
        <section
          className="rounded-[26px] p-5 mb-5"
          style={{
            background:
              'linear-gradient(135deg,#0b1a2c,#102b46 62%,#162032)',
            border:
              '1px solid rgba(245,158,11,0.18)',
            boxShadow:
              '0 16px 38px rgba(0,0,0,0.20)',
          }}
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-[20px] flex items-center justify-center shrink-0 bg-amber-400/10 border border-amber-400/20">
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

          <div className="mt-4 rounded-2xl px-3 py-2 bg-sky-400/5 border border-sky-400/10">
            <p className="text-[9px] leading-5 text-slate-400">
              سجل داخلي للتدريب
              والتأهيل داخل BAKR PRO —
              ليس رخصة حكومية.
            </p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>
                رقم البطاقة
              </label>
              <input
                className={inputClass}
                value={cardNo}
                onChange={(e) =>
                  setCardNo(
                    e.target.value
                  )
                }
                placeholder="OPC-26-000001"
              />
            </div>

            <div>
              <label className={labelClass}>
                اسم المشغل
              </label>
              <input
                className={inputClass}
                value={operatorName}
                onChange={(e) =>
                  setOperatorName(
                    e.target.value
                  )
                }
                placeholder="اسم المشغل"
              />
            </div>

            <div>
              <label className={labelClass}>
                رقم الهوية / الإقامة
              </label>
              <input
                className={inputClass}
                value={idNumber}
                onChange={(e) =>
                  setIdNumber(
                    e.target.value
                  )
                }
                placeholder="رقم الهوية أو الإقامة"
              />
            </div>

            <div>
              <label className={labelClass}>
                المنشأة / جهة العمل
              </label>
              <input
                className={inputClass}
                value={employer}
                onChange={(e) =>
                  setEmployer(
                    e.target.value
                  )
                }
                placeholder="اسم الشركة أو المؤسسة"
              />
            </div>

            <div>
              <label className={labelClass}>
                نوع التأهيل
              </label>
              <input
                className={inputClass}
                value={
                  qualificationType
                }
                onChange={(e) =>
                  setQualificationType(
                    e.target.value
                  )
                }
              />
            </div>

            <div>
              <label className={labelClass}>
                نوع المعدة
              </label>
              <input
                className={inputClass}
                value={equipmentType}
                onChange={(e) =>
                  setEquipmentType(
                    e.target.value
                  )
                }
              />
            </div>

            <div>
              <label className={labelClass}>
                الفئة / الحمولة
              </label>
              <input
                className={inputClass}
                value={capacityRange}
                onChange={(e) =>
                  setCapacityRange(
                    e.target.value
                  )
                }
                placeholder="20T - 50T"
              />
            </div>

            <div>
              <label className={labelClass}>
                الفاحص / المقيّم
              </label>
              <input
                className={inputClass}
                value={evaluator}
                onChange={(e) =>
                  setEvaluator(
                    e.target.value
                  )
                }
                placeholder="اسم الفاحص أو المقيّم"
              />
            </div>

            <div>
              <label className={labelClass}>
                تاريخ الإصدار
              </label>
              <input
                type="date"
                className={inputClass}
                value={issueDate}
                onChange={(e) =>
                  setIssueDate(
                    e.target.value
                  )
                }
              />
            </div>

            <div>
              <label className={labelClass}>
                تاريخ الانتهاء
              </label>
              <input
                type="date"
                className={inputClass}
                value={expiryDate}
                onChange={(e) =>
                  setExpiryDate(
                    e.target.value
                  )
                }
              />
            </div>

            <div>
              <label className={labelClass}>
                الحالة
              </label>
              <select
                className={inputClass}
                value={status}
                onChange={(e) =>
                  setStatus(
                    e.target
                      .value as OperatorStatus
                  )
                }
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
                dir="ltr"
                className={inputClass}
                value={
                  verificationUrl
                }
                onChange={(e) =>
                  setVerificationUrl(
                    e.target.value
                  )
                }
                placeholder="https://..."
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>
                ملاحظات
              </label>
              <textarea
                className="w-full min-h-[90px] rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-400/50"
                value={notes}
                onChange={(e) =>
                  setNotes(
                    e.target.value
                  )
                }
                placeholder="ملاحظات التدريب أو التقييم"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={saveCard}
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
                resetForm()
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
                {cards.length} سجل محفوظ
              </p>
            </div>

            <div className="relative flex-1 max-w-[230px]">
              <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                className="w-full h-10 rounded-xl border border-white/10 bg-slate-950/60 pr-9 pl-3 text-[11px] text-white outline-none"
                placeholder="بحث..."
              />
            </div>
          </div>

          {filteredCards.length ===
          0 ? (
            <div className="py-12 text-center">
              <BadgeCheck className="w-12 h-12 text-slate-700 mx-auto" />
              <p className="text-sm font-bold text-slate-400 mt-3">
                لا توجد بطاقات محفوظة
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCards.map(
                (card) => (
                  <article
                    key={card.id}
                    className="rounded-[20px] p-4 bg-white/[0.035] border border-white/[0.075]"
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
                                card.operatorName
                              }
                            </h3>
                            <p
                              className="text-[10px] text-amber-300 mt-0.5"
                              dir="ltr"
                            >
                              {card.cardNo}
                            </p>
                          </div>

                          <span className="px-2.5 py-1 rounded-full text-[9px] font-black text-emerald-300 bg-emerald-400/10 border border-emerald-400/20">
                            {statusLabel(
                              card.status
                            )}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-[10px] text-slate-400">
                          <div className="flex items-center gap-2">
                            <IdCard className="w-3.5 h-3.5" />
                            <span>
                              {
                                card.idNumber
                              }
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <HardHat className="w-3.5 h-3.5" />
                            <span>
                              {
                                card.qualificationType
                              }
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <BadgeCheck className="w-3.5 h-3.5" />
                            <span>
                              {
                                card.capacityRange
                              }
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <CalendarDays className="w-3.5 h-3.5" />
                            <span dir="ltr">
                              {
                                card.issueDate
                              }{' '}
                              →{' '}
                              {
                                card.expiryDate
                              }
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-4">
                          <button
                            type="button"
                            onClick={() =>
                              editCard(card)
                            }
                            className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black text-white"
                          >
                            تعديل
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteCard(
                                card.id
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
