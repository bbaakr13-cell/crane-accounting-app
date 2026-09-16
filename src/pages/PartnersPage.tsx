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
  FileText,
  Share2,
  FolderOpen,
  X,
  Pencil,
} from 'lucide-react';

import {
  AppLayout,
} from '@/components/layout/AppLayout';

import {
  fetchEquipment,
  type Equipment,
} from '@/lib/equipment';

import jsPDF from 'jspdf';

/* =========================================================
   الأنواع
========================================================= */

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
  updatedAt?: string;

  equipmentId: string;
  equipmentName: string;

  year: number;
  month: number;

  monthlyIncome: number;
  monthlyManualExpenses: number;
  linkedExpenses: number;
  additionalExpenses: number;

  totalExpenses: number;
  distributable: number;

  partners: Partner[];
};

/* =========================================================
   مفاتيح التخزين
========================================================= */

const STORAGE_KEY =
  'bakr_pro_partner_settlements_v2';

const EXTERNAL_EXPENSE_KEY =
  'crane_accounting_driver_equipment_expenses_v1';

/* =========================================================
   الأشهر
========================================================= */

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

/* =========================================================
   أدوات
========================================================= */

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

function safeFileName(
  value: string
) {
  return value
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-');
}

/* =========================================================
   الصفحة
========================================================= */

export function PartnersPage() {
  const now =
    new Date();

  const [
    equipmentList,
    setEquipmentList,
  ] = useState<Equipment[]>([]);

  const [
    equipmentId,
    setEquipmentId,
  ] = useState('');

  const [
    equipmentLoading,
    setEquipmentLoading,
  ] = useState(true);

  const [
    year,
    setYear,
  ] = useState(
    now.getFullYear()
  );

  const [
    month,
    setMonth,
  ] = useState(
    now.getMonth()
  );

  const [
    monthlyIncome,
    setMonthlyIncome,
  ] = useState(0);

  const [
    monthlyManualExpenses,
    setMonthlyManualExpenses,
  ] = useState(0);

  const [
    linkedExpenses,
    setLinkedExpenses,
  ] = useState(0);

  const [
    additionalExpenses,
    setAdditionalExpenses,
  ] = useState(0);

  const [
    partners,
    setPartners,
  ] = useState<Partner[]>([
    makePartner(),
    makePartner(),
    makePartner(),
  ]);

  const [
    loadingAccount,
    setLoadingAccount,
  ] = useState(false);

  const [
    savedSettlements,
    setSavedSettlements,
  ] = useState<SavedSettlement[]>([]);

  const [
    historyOpen,
    setHistoryOpen,
  ] = useState(false);

  const [
    editingId,
    setEditingId,
  ] = useState<string | null>(
    null
  );

  const [
    savingPdf,
    setSavingPdf,
  ] = useState(false);

  /* =========================================================
     تحميل المعدات
  ========================================================= */

  useEffect(() => {
    let cancelled = false;

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

        if (list.length > 0) {
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

  /* =========================================================
     تحميل الحسابات المحفوظة
  ========================================================= */

  function loadSavedSettlements() {
    try {
      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) {
        setSavedSettlements(
          []
        );

        return;
      }

      const parsed =
        JSON.parse(raw);

      setSavedSettlements(
        Array.isArray(parsed)
          ? parsed
          : []
      );
    } catch (error) {
      console.error(
        'Partner history:',
        error
      );

      setSavedSettlements(
        []
      );
    }
  }

  useEffect(() => {
    loadSavedSettlements();
  }, []);

  /* =========================================================
     المعدة المختارة
  ========================================================= */

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

  /* =========================================================
     تحميل الحساب الشهري
  ========================================================= */

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
            rows =
              parsed;
          }
        } catch (error) {
          console.error(
            'Monthly ledger parse:',
            error
          );
        }
      }

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
            Array.isArray(parsed)
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

  useEffect(() => {
    loadMonthlyAccount();
  }, [
    equipmentId,
    year,
    month,
  ]);

  useEffect(() => {
    const handleFocus =
      () => {
        loadMonthlyAccount();
        loadSavedSettlements();
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

  /* =========================================================
     الحسابات
  ========================================================= */

  const totalExpenses =
    monthlyManualExpenses +
    linkedExpenses +
    additionalExpenses;

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

  /* =========================================================
     تعديل بيانات شريك
  ========================================================= */

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
                  ? n(value)
                  : value,
            };
          }
        )
    );
  }

  /* =========================================================
     توزيع متساوي
  ========================================================= */

  function distributeEqually() {
    if (
      partners.length === 0
    ) {
      return;
    }

    const base =
      Number(
        (
          100 /
          partners.length
        ).toFixed(4)
      );

    let used = 0;

    const next =
      partners.map(
        (
          partner,
          index
        ) => {
          const percentage =
            index ===
            partners.length - 1
              ? Number(
                  (
                    100 -
                    used
                  ).toFixed(
                    4
                  )
                )
              : base;

          used +=
            percentage;

          return {
            ...partner,
            percentage,
          };
        }
      );

    setPartners(
      next
    );
  }

  /* =========================================================
     التحقق
  ========================================================= */

  function validateAccount() {
    if (!equipmentId) {
      alert(
        'اختر المعدة أو الكرين'
      );

      return false;
    }

    if (
      partners.length ===
      0
    ) {
      alert(
        'أضف شريكاً واحداً على الأقل'
      );

      return false;
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

      return false;
    }

    if (
      Math.abs(
        percentageTotal -
          100
      ) > 0.01
    ) {
      alert(
        `مجموع نسب الشركاء يجب أن يكون 100%.\nالمجموع الحالي: ${percentageTotal.toFixed(
          2
        )}%`
      );

      return false;
    }

    return true;
  }

  /* =========================================================
     إنشاء سجل
  ========================================================= */

  function createRecord():
  SavedSettlement {
    const current =
      savedSettlements.find(
        (item) =>
          item.id ===
          editingId
      );

    return {
      id:
        editingId ||
        String(
          Date.now()
        ),

      createdAt:
        current?.createdAt ||
        new Date()
          .toISOString(),

      updatedAt:
        new Date()
          .toISOString(),

      equipmentId,

      equipmentName,

      year,

      month,

      monthlyIncome,

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
  }

  /* =========================================================
     حفظ حساب الشركاء
  ========================================================= */

  function saveSettlement() {
    if (
      !validateAccount()
    ) {
      return;
    }

    try {
      const record =
        createRecord();

      let list:
        SavedSettlement[] =
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
            list =
              parsed;
          }
        } catch {
          list = [];
        }
      }

      if (editingId) {
        const exists =
          list.some(
            (item) =>
              item.id ===
              editingId
          );

        if (exists) {
          list =
            list.map(
              (item) =>
                item.id ===
                editingId
                  ? record
                  : item
            );
        } else {
          list = [
            record,
            ...list,
          ];
        }
      } else {
        list = [
          record,
          ...list,
        ];
      }

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          list
        )
      );

      setEditingId(
        record.id
      );

      setSavedSettlements(
        list
      );

      alert(
        'تم حفظ حساب الشركاء بنجاح'
      );
    } catch (error) {
      console.error(
        'Save partners:',
        error
      );

      alert(
        'تعذر حفظ حساب الشركاء'
      );
    }
  }

  /* =========================================================
     فتح حساب محفوظ
  ========================================================= */

  function openSettlement(
    item: SavedSettlement
  ) {
    setEditingId(
      item.id
    );

    setEquipmentId(
      String(
        item.equipmentId
      )
    );

    setYear(
      item.year
    );

    setMonth(
      item.month
    );

    setMonthlyIncome(
      n(
        item.monthlyIncome
      )
    );

    setMonthlyManualExpenses(
      n(
        item.monthlyManualExpenses
      )
    );

    setLinkedExpenses(
      n(
        item.linkedExpenses
      )
    );

    setAdditionalExpenses(
      n(
        item.additionalExpenses
      )
    );

    setPartners(
      Array.isArray(
        item.partners
      )
        ? item.partners.map(
            (partner) => ({
              ...partner,

              id:
                partner.id ||
                `${Date.now()}-${Math.random()}`,
            })
          )
        : []
    );

    setHistoryOpen(
      false
    );

    window.scrollTo({
      top: 0,
      behavior:
        'smooth',
    });
  }

  /* =========================================================
     حذف حساب محفوظ
  ========================================================= */

  function deleteSettlement(
    id: string
  ) {
    const ok =
      window.confirm(
        'هل تريد حذف حساب الشركاء المحفوظ؟'
      );

    if (!ok) {
      return;
    }

    try {
      const next =
        savedSettlements.filter(
          (item) =>
            item.id !== id
        );

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          next
        )
      );

      setSavedSettlements(
        next
      );

      if (
        editingId === id
      ) {
        setEditingId(
          null
        );
      }
    } catch (error) {
      console.error(
        'Delete settlement:',
        error
      );
    }
  }

  /* =========================================================
     حساب جديد
  ========================================================= */

  function newSettlement() {
    setEditingId(
      null
    );

    setAdditionalExpenses(
      0
    );

    setPartners([
      makePartner(),
      makePartner(),
      makePartner(),
    ]);

    loadMonthlyAccount();

    window.scrollTo({
      top: 0,
      behavior:
        'smooth',
    });
  }

  /* =========================================================
     إنشاء PDF
  ========================================================= */

  function buildPdf() {
    if (
      !validateAccount()
    ) {
      return null;
    }

    const doc =
      new jsPDF({
        orientation:
          'portrait',
        unit: 'mm',
        format: 'a4',
      });

    const pageWidth =
      doc.internal.pageSize.getWidth();

    doc.setFillColor(
      8,
      21,
      38
    );

    doc.rect(
      0,
      0,
      pageWidth,
      40,
      'F'
    );

    doc.setTextColor(
      245,
      158,
      11
    );

    doc.setFontSize(
      21
    );

    doc.text(
      'BAKR PRO',
      pageWidth / 2,
      14,
      {
        align:
          'center',
      }
    );

    doc.setTextColor(
      255,
      255,
      255
    );

    doc.setFontSize(
      13
    );

    doc.text(
      'PARTNERS ACCOUNT',
      pageWidth / 2,
      24,
      {
        align:
          'center',
      }
    );

    doc.setFontSize(
      9
    );

    doc.text(
      `${equipmentName || 'Equipment'} - ${month + 1}/${year}`,
      pageWidth / 2,
      32,
      {
        align:
          'center',
      }
    );

    let y = 50;

    const summary:
      [string, number][] =
      [
        [
          'Monthly Income',
          monthlyIncome,
        ],
        [
          'Monthly Expenses',
          monthlyManualExpenses,
        ],
        [
          'Driver / Equipment Expenses',
          linkedExpenses,
        ],
        [
          'Additional Expenses',
          additionalExpenses,
        ],
        [
          'Total Expenses',
          totalExpenses,
        ],
        [
          'Net Distribution',
          distributable,
        ],
      ];

    doc.setFontSize(
      10
    );

    summary.forEach(
      ([
        label,
        value,
      ]) => {
        doc.setFillColor(
          245,
          247,
          250
        );

        doc.roundedRect(
          15,
          y,
          180,
          10,
          2,
          2,
          'F'
        );

        doc.setTextColor(
          30,
          41,
          59
        );

        doc.text(
          label,
          20,
          y + 6.5
        );

        doc.text(
          `${Number(
            value
          ).toLocaleString(
            'en-US',
            {
              maximumFractionDigits:
                2,
            }
          )} SAR`,
          190,
          y + 6.5,
          {
            align:
              'right',
          }
        );

        y += 12;
      }
    );

    y += 5;

    doc.setFillColor(
      15,
      95,
      183
    );

    doc.rect(
      15,
      y,
      180,
      10,
      'F'
    );

    doc.setTextColor(
      255,
      255,
      255
    );

    doc.setFontSize(
      10
    );

    doc.text(
      'PARTNERS DISTRIBUTION',
      pageWidth / 2,
      y + 6.5,
      {
        align:
          'center',
      }
    );

    y += 13;

    doc.setFillColor(
      226,
      232,
      240
    );

    doc.rect(
      15,
      y,
      180,
      9,
      'F'
    );

    doc.setTextColor(
      30,
      41,
      59
    );

    doc.setFontSize(
      8
    );

    doc.text(
      'Partner',
      18,
      y + 6
    );

    doc.text(
      '%',
      82,
      y + 6
    );

    doc.text(
      'Due',
      105,
      y + 6
    );

    doc.text(
      'Paid',
      140,
      y + 6
    );

    doc.text(
      'Remaining',
      190,
      y + 6,
      {
        align:
          'right',
      }
    );

    y += 9;

    partners.forEach(
      (partner) => {
        if (
          y > 270
        ) {
          doc.addPage();

          y = 20;
        }

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

        doc.setDrawColor(
          226,
          232,
          240
        );

        doc.rect(
          15,
          y,
          180,
          11
        );

        doc.setTextColor(
          30,
          41,
          59
        );

        /*
          نستخدم Partner 1/2...
          في PDF حتى لا تتكسر العربية
          بسبب خط jsPDF الافتراضي.
        */

        const partnerIndex =
          partners.findIndex(
            (item) =>
              item.id ===
              partner.id
          ) + 1;

        doc.text(
          `Partner ${partnerIndex}`,
          18,
          y + 7
        );

        doc.text(
          `${Number(
            partner.percentage
          ).toLocaleString(
            'en-US',
            {
              maximumFractionDigits:
                2,
            }
          )}%`,
          82,
          y + 7
        );

        doc.text(
          Number(
            due
          ).toLocaleString(
            'en-US',
            {
              maximumFractionDigits:
                2,
            }
          ),
          105,
          y + 7
        );

        doc.text(
          Number(
            partner.paid
          ).toLocaleString(
            'en-US',
            {
              maximumFractionDigits:
                2,
            }
          ),
          140,
          y + 7
        );

        doc.text(
          Number(
            remaining
          ).toLocaleString(
            'en-US',
            {
              maximumFractionDigits:
                2,
            }
          ),
          190,
          y + 7,
          {
            align:
              'right',
          }
        );

        y += 11;
      }
    );

    y += 10;

    if (
      y > 285
    ) {
      doc.addPage();
      y = 20;
    }

    doc.setTextColor(
      100,
      116,
      139
    );

    doc.setFontSize(
      8
    );

    doc.text(
      `Generated by BAKR PRO - ${new Date().toLocaleDateString(
        'en-GB'
      )}`,
      pageWidth / 2,
      y,
      {
        align:
          'center',
      }
    );

    return doc;
  }

  /* =========================================================
     حفظ PDF
  ========================================================= */

  async function savePdf() {
    const doc =
      buildPdf();

    if (!doc) {
      return;
    }

    try {
      setSavingPdf(
        true
      );

      const fileName =
        safeFileName(
          `BAKR-PRO-Partners-${equipmentName || 'Equipment'}-${month + 1}-${year}.pdf`
        );

      doc.save(
        fileName
      );
    } catch (error) {
      console.error(
        'Save PDF:',
        error
      );

      alert(
        'تعذر حفظ ملف PDF'
      );
    } finally {
      setSavingPdf(
        false
      );
    }
  }

  /* =========================================================
     مشاركة PDF
  ========================================================= */

  async function sharePdf() {
    const doc =
      buildPdf();

    if (!doc) {
      return;
    }

    try {
      setSavingPdf(
        true
      );

      const fileName =
        safeFileName(
          `BAKR-PRO-Partners-${equipmentName || 'Equipment'}-${month + 1}-${year}.pdf`
        );

      const blob =
        doc.output(
          'blob'
        );

      const file =
        new File(
          [blob],
          fileName,
          {
            type:
              'application/pdf',
          }
        );

      /*
        إذا الهاتف يدعم مشاركة الملفات
        نفتح قائمة المشاركة.
      */

      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({
          files: [
            file,
          ],
        })
      ) {
        await navigator.share({
          title:
            'حساب الشركاء - BAKR PRO',

          text:
            `حساب الشركاء - ${equipmentName} - ${monthNames[month]} ${year}`,

          files: [
            file,
          ],
        });

        return;
      }

      /*
        إذا المتصفح لا يدعم مشاركة PDF
        نحفظ الملف بدلًا من ذلك.
      */

      doc.save(
        fileName
      );

      alert(
        'المشاركة المباشرة غير متاحة في هذا المتصفح، لذلك تم تنزيل ملف PDF.'
      );
    } catch (error: any) {
      /*
        إذا المستخدم أغلق نافذة المشاركة
        لا نظهر خطأ.
      */

      if (
        error?.name ===
        'AbortError'
      ) {
        return;
      }

      console.error(
        'Share PDF:',
        error
      );

      alert(
        'تعذر مشاركة ملف PDF. استخدم زر حفظ PDF.'
      );
    } finally {
      setSavingPdf(
        false
      );
    }
  }

  /* =========================================================
     التصميم
  ========================================================= */

  const inputStyle:
    React.CSSProperties = {
      width: '100%',
      boxSizing:
        'border-box',
      padding: 12,
      borderRadius: 12,
      border:
        '1px solid #263b58',
      background:
        '#081526',
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

  /* =========================================================
     الواجهة
  ========================================================= */

  return (
    <AppLayout>
      <div
        dir="rtl"
        style={{
          padding: 16,
          paddingBottom: 120,
          color:
            '#ffffff',
        }}
      >
        {/* الرأس */}

        <div
          style={{
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'space-between',
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 900,
              }}
            >
              حساب الشركاء
            </h1>

            <p
              style={{
                color:
                  '#94a3b8',
                fontSize: 11,
                marginTop: 5,
              }}
            >
              توزيع صافي حساب الكرين على الشركاء
            </p>
          </div>

          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: 16,
              background:
                'rgba(59,130,246,.12)',
              display: 'flex',
              alignItems:
                'center',
              justifyContent:
                'center',
            }}
          >
            <Users
              size={25}
              color="#60a5fa"
            />
          </div>
        </div>

        {/* الحسابات المحفوظة */}

        <button
          type="button"
          onClick={() => {
            loadSavedSettlements();
            setHistoryOpen(
              true
            );
          }}
          style={{
            width: '100%',
            marginTop: 15,
            padding: 13,
            borderRadius: 15,
            border:
              '1px solid rgba(96,165,250,.25)',
            background:
              'rgba(59,130,246,.08)',
            color:
              '#93c5fd',
            fontWeight: 800,
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'center',
            gap: 8,
          }}
        >
          <FolderOpen
            size={18}
          />

          الحسابات المحفوظة

          <span>
            (
            {
              savedSettlements.length
            }
            )
          </span>
        </button>

        {/* اختيار المعدة */}

        <section
          style={{
            ...cardStyle,
            marginTop: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems:
                'center',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <Truck
              size={18}
              color="#fbbf24"
            />

            <strong>
              المعدة / الكرين
            </strong>
          </div>

          <select
            value={
              equipmentId
            }
            onChange={(e) =>
              setEquipmentId(
                e.target.value
              )
            }
            disabled={
              equipmentLoading
            }
            style={
              inputStyle
            }
          >
            {equipmentList.length ===
              0 && (
              <option value="">
                لا توجد معدات
              </option>
            )}

            {equipmentList.map(
              (item) => (
                <option
                  key={
                    item.id
                  }
                  value={
                    item.id
                  }
                >
                  {
                    item.name
                  }
                </option>
              )
            )}
          </select>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                '1fr 1fr',
              gap: 8,
              marginTop: 9,
            }}
          >
            <select
              value={
                month
              }
              onChange={(e) =>
                setMonth(
                  Number(
                    e.target
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

            <input
              type="number"
              value={
                year
              }
              onChange={(e) =>
                setYear(
                  n(
                    e.target
                      .value
                  )
                )
              }
              style={
                inputStyle
              }
            />
          </div>

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
              alignItems:
                'center',
              justifyContent:
                'center',
              gap: 7,
            }}
          >
            <RefreshCw
              size={16}
            />

            {loadingAccount
              ? 'جاري التحديث...'
              : 'تحديث الحساب الشهري'}
          </button>
        </section>

        {/* الملخص */}

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
            label="إجمالي الدخل"
            value={money(
              monthlyIncome
            )}
            color="#4ade80"
            icon={
              <TrendingUp
                size={18}
              />
            }
          />

          <Summary
            label="مصاريف الحساب الشهري"
            value={money(
              monthlyManualExpenses
            )}
            color="#fb7185"
            icon={
              <TrendingDown
                size={18}
              />
            }
          />

          <Summary
            label="مصاريف السواقين والمعدات"
            value={money(
              linkedExpenses
            )}
            color="#fb923c"
          />

          <Summary
            label="إجمالي المصاريف"
            value={money(
              totalExpenses
            )}
            color="#f87171"
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
              display:
                'block',
              color:
                '#94a3b8',
              fontSize: 11,
              marginBottom: 7,
            }}
          >
            مصاريف إضافية خاصة بالشراكة
          </label>

          <input
            type="number"
            inputMode="decimal"
            value={
              additionalExpenses ||
              ''
            }
            onChange={(e) =>
              setAdditionalExpenses(
                n(
                  e.target
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

        {/* صافي التوزيع */}

        <section
          style={{
            ...cardStyle,
            marginTop: 12,
            textAlign:
              'center',
          }}
        >
          <Wallet
            size={27}
            color="#60a5fa"
            style={{
              margin:
                '0 auto 7px',
            }}
          />

          <div
            style={{
              color:
                '#94a3b8',
              fontSize: 11,
            }}
          >
            صافي المبلغ القابل للتوزيع
          </div>

          <div
            style={{
              color:
                distributable >=
                0
                  ? '#4ade80'
                  : '#fb7185',
              fontSize: 25,
              fontWeight: 900,
              marginTop: 6,
            }}
          >
            {money(
              distributable
            )}
          </div>
        </section>

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
                    ) < 0.01
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

            <button
              type="button"
              onClick={
                distributeEqually
              }
              style={{
                border:
                  '1px solid rgba(96,165,250,.25)',
                borderRadius: 11,
                padding:
                  '8px 10px',
                background:
                  'rgba(59,130,246,.08)',
                color:
                  '#93c5fd',
                fontWeight: 700,
                fontSize: 10,
              }}
            >
              توزيع متساوي
            </button>
          </div>

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
                    partner.percentage /
                    100
                  );

                const remaining =
                  due -
                  partner.paid;

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
                            setPartners(
                              (
                                old
                              ) =>
                                old.filter(
                                  (
                                    item
                                  ) =>
                                    item.id !==
                                    partner.id
                                )
                            )
                          }
                          style={{
                            border:
                              0,
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

                    <input
                      placeholder="اسم الشريك"
                      value={
                        partner.name
                      }
                      onChange={(e) =>
                        updatePartner(
                          partner.id,
                          'name',
                          e.target
                            .value
                        )
                      }
                      style={
                        inputStyle
                      }
                    />

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
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="النسبة %"
                        value={
                          partner.percentage ||
                          ''
                        }
                        onChange={(e) =>
                          updatePartner(
                            partner.id,
                            'percentage',
                            e.target
                              .value
                          )
                        }
                        style={
                          inputStyle
                        }
                      />

                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="السحوبات / المدفوع"
                        value={
                          partner.paid ||
                          ''
                        }
                        onChange={(e) =>
                          updatePartner(
                            partner.id,
                            'paid',
                            e.target
                              .value
                          )
                        }
                        style={
                          inputStyle
                        }
                      />
                    </div>

                    <input
                      placeholder="ملاحظات"
                      value={
                        partner.notes
                      }
                      onChange={(e) =>
                        updatePartner(
                          partner.id,
                          'notes',
                          e.target
                            .value
                        )
                      }
                      style={{
                        ...inputStyle,
                        marginTop: 8,
                      }}
                    />

                    <div
                      style={{
                        display:
                          'grid',
                        gridTemplateColumns:
                          '1fr 1fr',
                        gap: 8,
                        marginTop: 9,
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

          <button
            type="button"
            onClick={() =>
              setPartners(
                (old) => [
                  ...old,
                  makePartner(),
                ]
              )
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

        <div
          style={{
            marginTop: 12,
          }}
        >
          <Summary
            label="فارق التوزيع"
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
          />
        </div>

        {/* الأزرار */}

        <div
          style={{
            display: 'grid',
            gap: 10,
            marginTop: 15,
          }}
        >
          <button
            type="button"
            onClick={
              saveSettlement
            }
            style={{
              width: '100%',
              padding: 16,
              border: 0,
              borderRadius: 16,
              background:
                'linear-gradient(135deg,#0f5fb7,#063a78)',
              color:
                '#ffffff',
              fontWeight: 900,
              fontSize: 14,
              display: 'flex',
              gap: 8,
              justifyContent:
                'center',
              alignItems:
                'center',
            }}
          >
            <Save
              size={19}
            />

            {editingId
              ? 'حفظ التعديلات'
              : 'حفظ حساب الشركاء'}
          </button>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                '1fr 1fr',
              gap: 9,
            }}
          >
            <button
              type="button"
              onClick={
                savePdf
              }
              disabled={
                savingPdf
              }
              style={{
                padding: 14,
                borderRadius: 15,
                border:
                  '1px solid rgba(34,197,94,.30)',
                background:
                  'rgba(34,197,94,.10)',
                color:
                  '#4ade80',
                fontWeight: 800,
                display: 'flex',
                alignItems:
                  'center',
                justifyContent:
                  'center',
                gap: 7,
              }}
            >
              <FileText
                size={18}
              />

              {savingPdf
                ? 'جاري...'
                : 'حفظ PDF'}
            </button>

            <button
              type="button"
              onClick={
                sharePdf
              }
              disabled={
                savingPdf
              }
              style={{
                padding: 14,
                borderRadius: 15,
                border:
                  '1px solid rgba(168,85,247,.30)',
                background:
                  'rgba(168,85,247,.10)',
                color:
                  '#c084fc',
                fontWeight: 800,
                display: 'flex',
                alignItems:
                  'center',
                justifyContent:
                  'center',
                gap: 7,
              }}
            >
              <Share2
                size={18}
              />

              مشاركة PDF
            </button>
          </div>

          <button
            type="button"
            onClick={
              newSettlement
            }
            style={{
              padding: 13,
              borderRadius: 14,
              border:
                '1px solid rgba(255,255,255,.10)',
              background:
                'rgba(255,255,255,.035)',
              color:
                '#cbd5e1',
              fontWeight: 800,
            }}
          >
            + حساب شراكة جديد
          </button>
        </div>

        {/* نافذة الحسابات المحفوظة */}

        {historyOpen && (
          <div
            style={{
              position:
                'fixed',
              inset: 0,
              zIndex: 99999,
              background:
                'rgba(2,6,15,.95)',
              overflowY:
                'auto',
            }}
          >
            <div
              dir="rtl"
              style={{
                width: '100%',
                maxWidth: 430,
                minHeight:
                  '100dvh',
                margin:
                  '0 auto',
                padding:
                  '20px 16px 40px',
                boxSizing:
                  'border-box',
              }}
            >
              <div
                style={{
                  display:
                    'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'space-between',
                  marginBottom: 18,
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 21,
                    }}
                  >
                    الحسابات المحفوظة
                  </h2>

                  <p
                    style={{
                      margin:
                        '4px 0 0',
                      color:
                        '#64748b',
                      fontSize: 10,
                    }}
                  >
                    {
                      savedSettlements.length
                    }{' '}
                    حساب محفوظ
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setHistoryOpen(
                      false
                    )
                  }
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 13,
                    border:
                      '1px solid rgba(255,255,255,.08)',
                    background:
                      'rgba(255,255,255,.05)',
                    color:
                      '#ffffff',
                    display:
                      'flex',
                    alignItems:
                      'center',
                    justifyContent:
                      'center',
                  }}
                >
                  <X
                    size={20}
                  />
                </button>
              </div>

              {savedSettlements.length ===
              0 ? (
                <div
                  style={{
                    marginTop: 80,
                    textAlign:
                      'center',
                    color:
                      '#64748b',
                  }}
                >
                  <FolderOpen
                    size={42}
                    style={{
                      margin:
                        '0 auto 12px',
                    }}
                  />

                  لا توجد حسابات محفوظة حتى الآن
                </div>
              ) : (
                <div
                  style={{
                    display:
                      'grid',
                    gap: 10,
                  }}
                >
                  {savedSettlements.map(
                    (item) => (
                      <div
                        key={
                          item.id
                        }
                        style={{
                          ...cardStyle,
                          padding: 13,
                        }}
                      >
                        <div
                          style={{
                            display:
                              'flex',
                            justifyContent:
                              'space-between',
                            gap: 10,
                          }}
                        >
                          <div>
                            <strong
                              style={{
                                fontSize: 14,
                              }}
                            >
                              {item.equipmentName ||
                                'كرين'}
                            </strong>

                            <div
                              style={{
                                color:
                                  '#94a3b8',
                                fontSize: 10,
                                marginTop: 4,
                              }}
                            >
                              {
                                monthNames[
                                  item.month
                                ]
                              }{' '}
                              {
                                item.year
                              }
                            </div>
                          </div>

                          <div
                            style={{
                              color:
                                item.distributable >=
                                0
                                  ? '#4ade80'
                                  : '#fb7185',
                              fontWeight: 900,
                              fontSize: 13,
                            }}
                          >
                            {money(
                              item.distributable
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            display:
                              'grid',
                            gridTemplateColumns:
                              '1fr 1fr',
                            gap: 7,
                            marginTop: 11,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              openSettlement(
                                item
                              )
                            }
                            style={{
                              padding: 10,
                              borderRadius: 11,
                              border:
                                '1px solid rgba(96,165,250,.25)',
                              background:
                                'rgba(59,130,246,.08)',
                              color:
                                '#93c5fd',
                              fontWeight: 800,
                              display:
                                'flex',
                              alignItems:
                                'center',
                              justifyContent:
                                'center',
                              gap: 5,
                            }}
                          >
                            <Pencil
                              size={
                                15
                              }
                            />

                            فتح وتعديل
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteSettlement(
                                item.id
                              )
                            }
                            style={{
                              padding: 10,
                              borderRadius: 11,
                              border:
                                '1px solid rgba(239,68,68,.25)',
                              background:
                                'rgba(239,68,68,.08)',
                              color:
                                '#fb7185',
                              fontWeight: 800,
                              display:
                                'flex',
                              alignItems:
                                'center',
                              justifyContent:
                                'center',
                              gap: 5,
                            }}
                          >
                            <Trash2
                              size={
                                15
                              }
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
          </div>
        )}
      </div>
    </AppLayout>
  );
}

/* =========================================================
   صندوق الملخص
========================================================= */

function Summary({
  label,
  value,
  color,
  small = false,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  small?: boolean;
  icon?: React.ReactNode;
}) {
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
      {icon && (
        <div
          style={{
            color,
            marginBottom: 5,
            display: 'flex',
            justifyContent:
              'center',
          }}
        >
          {icon}
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
