import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Car,
  ChevronDown,
  ChevronUp,
  FileDown,
  FilePlus2,
  FileText,
  IdCard,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  Wrench,
} from 'lucide-react';

import jsPDF from 'jspdf';

import {
  Directory,
  Filesystem,
} from '@capacitor/filesystem';

import { Share } from '@capacitor/share';

import { AppLayout } from '@/components/layout/AppLayout';

const STORAGE_KEY =
  'crane_accounting_equipment_documents_v1';

type DocumentInfo = {
  id: string;
  title: string;
  number: string;
  issueDate: string;
  expiryDate: string;
  notes: string;
};

type DriverInfo = {
  name: string;
  phone: string;
  iqamaNumber: string;
  iqamaExpiry: string;
  licenseNumber: string;
  licenseExpiry: string;
  tuvNumber: string;
  tuvIssueDate: string;
  tuvExpiryDate: string;
};

type EquipmentFile = {
  id: string;

  name: string;
  brand: string;
  capacity: string;
  model: string;
  year: string;

  plateNumber: string;
  chassisNumber: string;
  serialNumber: string;

  registration: DocumentInfo;
  craneTuv: DocumentInfo;
  insurance: DocumentInfo;

  driver: DriverInfo;

  extraDocuments: DocumentInfo[];

  notes: string;
};

function makeId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function emptyDocument(
  title: string
): DocumentInfo {
  return {
    id: makeId(),
    title,
    number: '',
    issueDate: '',
    expiryDate: '',
    notes: '',
  };
}

function emptyDriver(): DriverInfo {
  return {
    name: '',
    phone: '',

    iqamaNumber: '',
    iqamaExpiry: '',

    licenseNumber: '',
    licenseExpiry: '',

    tuvNumber: '',
    tuvIssueDate: '',
    tuvExpiryDate: '',
  };
}

function createEquipment(): EquipmentFile {
  return {
    id: makeId(),

    name: '',
    brand: '',
    capacity: '',
    model: '',
    year: '',

    plateNumber: '',
    chassisNumber: '',
    serialNumber: '',

    registration:
      emptyDocument(
        'استمارة الكرين'
      ),

    craneTuv:
      emptyDocument(
        'TUV CRANE'
      ),

    insurance:
      emptyDocument(
        'تأمين الكرين'
      ),

    driver:
      emptyDriver(),

    extraDocuments: [],

    notes: '',
  };
}

function daysUntil(
  dateString: string
) {
  if (!dateString) {
    return null;
  }

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const expiry =
    new Date(
      `${dateString}T00:00:00`
    );

  if (
    Number.isNaN(
      expiry.getTime()
    )
  ) {
    return null;
  }

  return Math.ceil(
    (
      expiry.getTime() -
      today.getTime()
    ) /
      86400000
  );
}

function getStatus(
  dateString: string
) {
  const days =
    daysUntil(dateString);

  if (days === null) {
    return {
      text: 'بدون تاريخ',
      className:
        'bg-slate-500/10 text-slate-400 border-slate-500/20',
    };
  }

  if (days < 0) {
    return {
      text: 'منتهي',
      className:
        'bg-red-500/10 text-red-400 border-red-500/20',
    };
  }

  if (days === 0) {
    return {
      text: 'ينتهي اليوم',
      className:
        'bg-red-500/10 text-red-400 border-red-500/20',
    };
  }

  if (days <= 30) {
    return {
      text: `باقي ${days} يوم`,
      className:
        'bg-amber-500/10 text-amber-400 border-amber-500/20',
    };
  }

  return {
    text: `ساري • ${days} يوم`,
    className:
      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  };
}

function formatDate(
  value: string
) {
  if (!value) {
    return '—';
  }

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    const [
      year,
      month,
      day,
    ] = value.split('-');

    return `${day}/${month}/${year}`;
  }

  return value;
}

export function EquipmentDocumentsPage() {
  const navigate =
    useNavigate();

  const [
    equipments,
    setEquipments,
  ] = useState<
    EquipmentFile[]
  >([]);

  const [
    selectedId,
    setSelectedId,
  ] = useState<
    string | null
  >(null);

  const [
    busy,
    setBusy,
  ] = useState(false);

  useEffect(() => {
    try {
      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) {
        return;
      }

      const parsed =
        JSON.parse(raw);

      if (
        Array.isArray(parsed)
      ) {
        setEquipments(
          parsed
        );

        if (
          parsed.length > 0
        ) {
          setSelectedId(
            parsed[0].id
          );
        }
      }
    } catch (error) {
      console.error(
        'Equipment documents load error:',
        error
      );
    }
  }, []);

  const selected =
    useMemo(
      () =>
        equipments.find(
          (item) =>
            item.id ===
            selectedId
        ) || null,
      [
        equipments,
        selectedId,
      ]
    );

  function persist(
    next:
      EquipmentFile[]
  ) {
    setEquipments(next);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(next)
    );
  }

  function addEquipment() {
    const equipment =
      createEquipment();

    const next = [
      equipment,
      ...equipments,
    ];

    persist(next);

    setSelectedId(
      equipment.id
    );
  }

  function updateSelected(
    updater:
      (
        current:
          EquipmentFile
      ) => EquipmentFile
  ) {
    if (!selected) {
      return;
    }

    const next =
      equipments.map(
        (item) =>
          item.id ===
          selected.id
            ? updater(item)
            : item
      );

    persist(next);
  }

  function updateEquipmentField(
    key:
      keyof EquipmentFile,
    value: any
  ) {
    updateSelected(
      (current) => ({
        ...current,
        [key]: value,
      })
    );
  }

  function updateDocument(
    key:
      | 'registration'
      | 'craneTuv'
      | 'insurance',
    field:
      keyof DocumentInfo,
    value: string
  ) {
    updateSelected(
      (current) => ({
        ...current,

        [key]: {
          ...current[key],
          [field]: value,
        },
      })
    );
  }

  function updateDriver(
    field:
      keyof DriverInfo,
    value: string
  ) {
    updateSelected(
      (current) => ({
        ...current,

        driver: {
          ...current.driver,
          [field]: value,
        },
      })
    );
  }

  function addExtraDocument() {
    updateSelected(
      (current) => ({
        ...current,

        extraDocuments: [
          ...current.extraDocuments,

          emptyDocument(
            'مستند إضافي'
          ),
        ],
      })
    );
  }

  function updateExtraDocument(
    id: string,
    field:
      keyof DocumentInfo,
    value: string
  ) {
    updateSelected(
      (current) => ({
        ...current,

        extraDocuments:
          current.extraDocuments.map(
            (document) =>
              document.id ===
              id
                ? {
                    ...document,
                    [field]:
                      value,
                  }
                : document
          ),
      })
    );
  }

  function deleteExtraDocument(
    id: string
  ) {
    updateSelected(
      (current) => ({
        ...current,

        extraDocuments:
          current.extraDocuments.filter(
            (document) =>
              document.id !==
              id
          ),
      })
    );
  }

  function deleteEquipment() {
    if (!selected) {
      return;
    }

    const accepted =
      window.confirm(
        `حذف ${
          selected.name ||
          'هذه المعدة'
        }؟`
      );

    if (!accepted) {
      return;
    }

    const next =
      equipments.filter(
        (item) =>
          item.id !==
          selected.id
      );

    persist(next);

    setSelectedId(
      next[0]?.id ||
        null
    );
  }

  function saveNow() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        equipments
      )
    );

    alert(
      'تم حفظ ملف المعدة'
    );
  }

  function blobToBase64(
    blob: Blob
  ): Promise<string> {
    return new Promise(
      (
        resolve,
        reject
      ) => {
        const reader =
          new FileReader();

        reader.onloadend =
          () => {
            const result =
              String(
                reader.result ||
                  ''
              );

            const comma =
              result.indexOf(
                ','
              );

            resolve(
              comma >= 0
                ? result.slice(
                    comma + 1
                  )
                : result
            );
          };

        reader.onerror =
          () =>
            reject(
              reader.error
            );

        reader.readAsDataURL(
          blob
        );
      }
    );
  }

  async function createSummaryPDF() {
    if (
      !selected ||
      busy
    ) {
      return;
    }

    try {
      setBusy(true);

      /*
       * PDF ملخص بيانات.
       * دمج صور وملفات المستندات
       * الفعلية سنضيفه في المرحلة
       * التالية.
       */

      const pdf =
        new jsPDF({
          orientation:
            'portrait',
          unit: 'mm',
          format: 'a4',
        });

      let y = 18;

      const left = 15;

      function line(
        label: string,
        value: string
      ) {
        if (y > 278) {
          pdf.addPage();
          y = 18;
        }

        /*
         * النص الإنجليزي والأرقام
         * يعمل مباشرة.
         * العربية الكاملة سنجعلها
         * بخط التطبيق في مرحلة
         * PDF النهائية.
         */
        pdf.setFontSize(10);

        pdf.text(
          `${label}: ${
            value || '-'
          }`,
          left,
          y
        );

        y += 7;
      }

      pdf.setFontSize(18);

      pdf.text(
        'BAKR PRO',
        left,
        y
      );

      y += 10;

      pdf.setFontSize(14);

      pdf.text(
        'Equipment File',
        left,
        y
      );

      y += 12;

      line(
        'Equipment',
        selected.name
      );

      line(
        'Brand',
        selected.brand
      );

      line(
        'Capacity',
        selected.capacity
      );

      line(
        'Model',
        selected.model
      );

      line(
        'Year',
        selected.year
      );

      line(
        'Plate',
        selected.plateNumber
      );

      line(
        'Chassis',
        selected.chassisNumber
      );

      line(
        'Serial',
        selected.serialNumber
      );

      y += 5;

      pdf.setFontSize(13);

      pdf.text(
        'Crane Registration',
        left,
        y
      );

      y += 9;

      line(
        'Number',
        selected.registration
          .number
      );

      line(
        'Issue',
        formatDate(
          selected.registration
            .issueDate
        )
      );

      line(
        'Expiry',
        formatDate(
          selected.registration
            .expiryDate
        )
      );

      y += 5;

      pdf.setFontSize(13);

      pdf.text(
        'TUV CRANE',
        left,
        y
      );

      y += 9;

      line(
        'Certificate',
        selected.craneTuv
          .number
      );

      line(
        'Issue',
        formatDate(
          selected.craneTuv
            .issueDate
        )
      );

      line(
        'Expiry',
        formatDate(
          selected.craneTuv
            .expiryDate
        )
      );

      y += 5;

      pdf.setFontSize(13);

      pdf.text(
        'Insurance',
        left,
        y
      );

      y += 9;

      line(
        'Policy',
        selected.insurance
          .number
      );

      line(
        'Issue',
        formatDate(
          selected.insurance
            .issueDate
        )
      );

      line(
        'Expiry',
        formatDate(
          selected.insurance
            .expiryDate
        )
      );

      y += 5;

      pdf.setFontSize(13);

      pdf.text(
        'Driver',
        left,
        y
      );

      y += 9;

      line(
        'Name',
        selected.driver.name
      );

      line(
        'Phone',
        selected.driver.phone
      );

      line(
        'Iqama',
        selected.driver
          .iqamaNumber
      );

      line(
        'Iqama Expiry',
        formatDate(
          selected.driver
            .iqamaExpiry
        )
      );

      line(
        'License',
        selected.driver
          .licenseNumber
      );

      line(
        'License Expiry',
        formatDate(
          selected.driver
            .licenseExpiry
        )
      );

      line(
        'Driver TUV',
        selected.driver
          .tuvNumber
      );

      line(
        'TUV Issue',
        formatDate(
          selected.driver
            .tuvIssueDate
        )
      );

      line(
        'TUV Expiry',
        formatDate(
          selected.driver
            .tuvExpiryDate
        )
      );

      if (
        selected
          .extraDocuments
          .length > 0
      ) {
        y += 5;

        pdf.setFontSize(
          13
        );

        pdf.text(
          'Additional Documents',
          left,
          y
        );

        y += 9;

        selected.extraDocuments.forEach(
          (
            document,
            index
          ) => {
            line(
              `Document ${
                index + 1
              }`,
              document.title
            );

            line(
              'Number',
              document.number
            );

            line(
              'Expiry',
              formatDate(
                document.expiryDate
              )
            );
          }
        );
      }

      const blob =
        pdf.output(
          'blob'
        );

      const base64 =
        await blobToBase64(
          blob
        );

      const safeName =
        (
          selected.name ||
          'equipment'
        )
          .trim()
          .replace(
            /[\\/:*?"<>|]/g,
            '-'
          );

      const fileName =
        `BAKR-PRO-${safeName}-${Date.now()}.pdf`;

      const result =
        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory:
            Directory.Cache,
          recursive: true,
        });

      await Share.share({
        title:
          'ملف المعدة',
        text:
          selected.name ||
          'ملف المعدة',
        url:
          result.uri,
        dialogTitle:
          'حفظ أو مشاركة ملف المعدة',
      });
    } catch (error) {
      console.error(
        error
      );

      alert(
        'تعذر إنشاء ملف PDF'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppLayout>
      <div
        dir="rtl"
        className="pb-24"
      >
        {/* HEADER */}

        <div className="flex items-center justify-between mb-5">
          <button
            type="button"
            onClick={() =>
              navigate(-1)
            }
            className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center"
          >
            <ArrowRight className="w-5 h-5 text-white" />
          </button>

          <div className="text-center">
            <h1 className="text-lg font-black text-white">
              ملفات المعدات
            </h1>

            <p className="text-[11px] text-slate-500 mt-1">
              مستندات الكرين والسائق
            </p>
          </div>

          <button
            type="button"
            onClick={
              addEquipment
            }
            className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* EQUIPMENT LIST */}

        {equipments.length >
          0 && (
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
            {equipments.map(
              (equipment) => {
                const active =
                  equipment.id ===
                  selectedId;

                return (
                  <button
                    key={
                      equipment.id
                    }
                    type="button"
                    onClick={() =>
                      setSelectedId(
                        equipment.id
                      )
                    }
                    className={`shrink-0 min-w-[130px] rounded-2xl border p-3 text-right ${
                      active
                        ? 'bg-blue-600/20 border-blue-500/40'
                        : 'bg-[#0b1524] border-white/10'
                    }`}
                  >
                    <div className="text-white text-sm font-black">
                      {equipment.name ||
                        'معدة جديدة'}
                    </div>

                    <div className="text-slate-500 text-[10px] mt-1">
                      {equipment.capacity ||
                        'بدون حمولة'}
                    </div>
                  </button>
                );
              }
            )}
          </div>
        )}

        {!selected ? (
          <div className="rounded-[26px] border border-dashed border-white/10 bg-[#0b1524] p-8 text-center">
            <Wrench className="w-12 h-12 text-slate-600 mx-auto mb-4" />

            <div className="text-white font-black">
              لا توجد معدات
            </div>

            <div className="text-slate-500 text-xs mt-2">
              أضف أول كرين وابدأ بإنشاء ملفه
            </div>

            <button
              type="button"
              onClick={
                addEquipment
              }
              className="mt-5 h-12 px-6 rounded-2xl bg-blue-600 text-white font-black inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              إضافة معدة
            </button>
          </div>
        ) : (
          <>
            {/* EQUIPMENT */}

            <Card
              title="بيانات المعدة"
              icon={
                <Car className="w-5 h-5" />
              }
            >
              <Field
                label="اسم المعدة"
                placeholder="مثال: SANY 25 TON"
                value={
                  selected.name
                }
                onChange={(
                  value
                ) =>
                  updateEquipmentField(
                    'name',
                    value
                  )
                }
              />

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="الشركة"
                  placeholder="SANY"
                  value={
                    selected.brand
                  }
                  onChange={(
                    value
                  ) =>
                    updateEquipmentField(
                      'brand',
                      value
                    )
                  }
                />

                <Field
                  label="الحمولة"
                  placeholder="25 طن"
                  value={
                    selected.capacity
                  }
                  onChange={(
                    value
                  ) =>
                    updateEquipmentField(
                      'capacity',
                      value
                    )
                  }
                />

                <Field
                  label="الموديل"
                  value={
                    selected.model
                  }
                  onChange={(
                    value
                  ) =>
                    updateEquipmentField(
                      'model',
                      value
                    )
                  }
                />

                <Field
                  label="سنة الصنع"
                  inputMode="numeric"
                  value={
                    selected.year
                  }
                  onChange={(
                    value
                  ) =>
                    updateEquipmentField(
                      'year',
                      value
                    )
                  }
                />
              </div>

              <Field
                label="رقم اللوحة"
                value={
                  selected.plateNumber
                }
                onChange={(
                  value
                ) =>
                  updateEquipmentField(
                    'plateNumber',
                    value
                  )
                }
              />

              <Field
                label="رقم الهيكل"
                value={
                  selected.chassisNumber
                }
                onChange={(
                  value
                ) =>
                  updateEquipmentField(
                    'chassisNumber',
                    value
                  )
                }
              />

              <Field
                label="الرقم التسلسلي"
                value={
                  selected.serialNumber
                }
                onChange={(
                  value
                ) =>
                  updateEquipmentField(
                    'serialNumber',
                    value
                  )
                }
              />
            </Card>

            {/* REGISTRATION */}

            <DocumentCard
              title="استمارة الكرين"
              icon={
                <FileText className="w-5 h-5" />
              }
              document={
                selected.registration
              }
              onChange={(
                field,
                value
              ) =>
                updateDocument(
                  'registration',
                  field,
                  value
                )
              }
            />

            {/* CRANE TUV */}

            <DocumentCard
              title="TUV CRANE"
              icon={
                <BadgeCheck className="w-5 h-5" />
              }
              document={
                selected.craneTuv
              }
              onChange={(
                field,
                value
              ) =>
                updateDocument(
                  'craneTuv',
                  field,
                  value
                )
              }
            />

            {/* INSURANCE */}

            <DocumentCard
              title="تأمين الكرين"
              icon={
                <ShieldCheck className="w-5 h-5" />
              }
              document={
                selected.insurance
              }
              onChange={(
                field,
                value
              ) =>
                updateDocument(
                  'insurance',
                  field,
                  value
                )
              }
            />

            {/* DRIVER */}

            <Card
              title="السائق"
              icon={
                <UserRound className="w-5 h-5" />
              }
            >
              <Field
                label="اسم السائق"
                value={
                  selected.driver
                    .name
                }
                onChange={(
                  value
                ) =>
                  updateDriver(
                    'name',
                    value
                  )
                }
              />

              <Field
                label="رقم الجوال"
                inputMode="numeric"
                value={
                  selected.driver
                    .phone
                }
                onChange={(
                  value
                ) =>
                  updateDriver(
                    'phone',
                    value
                  )
                }
              />

              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-white text-sm font-black mb-3 flex items-center gap-2">
                  <IdCard className="w-4 h-4 text-blue-400" />
                  الإقامة
                </div>

                <Field
                  label="رقم الإقامة"
                  value={
                    selected.driver
                      .iqamaNumber
                  }
                  onChange={(
                    value
                  ) =>
                    updateDriver(
                      'iqamaNumber',
                      value
                    )
                  }
                />

                <DateInput
                  label="تاريخ انتهاء الإقامة"
                  value={
                    selected.driver
                      .iqamaExpiry
                  }
                  onChange={(
                    value
                  ) =>
                    updateDriver(
                      'iqamaExpiry',
                      value
                    )
                  }
                />
              </div>

              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-white text-sm font-black mb-3">
                  رخصة القيادة
                </div>

                <Field
                  label="رقم الرخصة"
                  value={
                    selected.driver
                      .licenseNumber
                  }
                  onChange={(
                    value
                  ) =>
                    updateDriver(
                      'licenseNumber',
                      value
                    )
                  }
                />

                <DateInput
                  label="انتهاء الرخصة"
                  value={
                    selected.driver
                      .licenseExpiry
                  }
                  onChange={(
                    value
                  ) =>
                    updateDriver(
                      'licenseExpiry',
                      value
                    )
                  }
                />
              </div>

              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-white text-sm font-black mb-3">
                  TUV السائق
                </div>

                <Field
                  label="رقم الشهادة"
                  value={
                    selected.driver
                      .tuvNumber
                  }
                  onChange={(
                    value
                  ) =>
                    updateDriver(
                      'tuvNumber',
                      value
                    )
                  }
                />

                <div className="grid grid-cols-2 gap-3">
                  <DateInput
                    label="تاريخ الإصدار"
                    value={
                      selected.driver
                        .tuvIssueDate
                    }
                    onChange={(
                      value
                    ) =>
                      updateDriver(
                        'tuvIssueDate',
                        value
                      )
                    }
                  />

                  <DateInput
                    label="تاريخ الانتهاء"
                    value={
                      selected.driver
                        .tuvExpiryDate
                    }
                    onChange={(
                      value
                    ) =>
                      updateDriver(
                        'tuvExpiryDate',
                        value
                      )
                    }
                  />
                </div>

                <StatusBadge
                  date={
                    selected.driver
                      .tuvExpiryDate
                  }
                />
              </div>
            </Card>

            {/* EXTRA DOCUMENTS */}

            <Card
              title="مستندات إضافية"
              icon={
                <FilePlus2 className="w-5 h-5" />
              }
            >
              {selected
                .extraDocuments
                .map(
                  (
                    document,
                    index
                  ) => (
                    <div
                      key={
                        document.id
                      }
                      className="rounded-2xl bg-black/20 border border-white/10 p-3 mb-3"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <div className="text-white text-sm font-black">
                          مستند{' '}
                          {index +
                            1}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            deleteExtraDocument(
                              document.id
                            )
                          }
                          className="w-9 h-9 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <Field
                        label="اسم المستند"
                        value={
                          document.title
                        }
                        onChange={(
                          value
                        ) =>
                          updateExtraDocument(
                            document.id,
                            'title',
                            value
                          )
                        }
                      />

                      <Field
                        label="رقم المستند"
                        value={
                          document.number
                        }
                        onChange={(
                          value
                        ) =>
                          updateExtraDocument(
                            document.id,
                            'number',
                            value
                          )
                        }
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <DateInput
                          label="الإصدار"
                          value={
                            document.issueDate
                          }
                          onChange={(
                            value
                          ) =>
                            updateExtraDocument(
                              document.id,
                              'issueDate',
                              value
                            )
                          }
                        />

                        <DateInput
                          label="الانتهاء"
                          value={
                            document.expiryDate
                          }
                          onChange={(
                            value
                          ) =>
                            updateExtraDocument(
                              document.id,
                              'expiryDate',
                              value
                            )
                          }
                        />
                      </div>

                      <StatusBadge
                        date={
                          document.expiryDate
                        }
                      />
                    </div>
                  )
                )}

              <button
                type="button"
                onClick={
                  addExtraDocument
                }
                className="w-full h-12 rounded-2xl border border-dashed border-blue-500/30 bg-blue-500/5 text-blue-400 font-black flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                إضافة مستند
              </button>
            </Card>

            {/* NOTES */}

            <Card
              title="ملاحظات"
              icon={
                <FileText className="w-5 h-5" />
              }
            >
              <textarea
                value={
                  selected.notes
                }
                onChange={(
                  event
                ) =>
                  updateEquipmentField(
                    'notes',
                    event.target.value
                  )
                }
                placeholder="أي ملاحظات عن الكرين أو المستندات..."
                className="w-full min-h-[110px] p-3 rounded-2xl bg-[#07111d] border border-white/10 text-white text-sm outline-none focus:border-blue-500/60 resize-none"
              />
            </Card>

            {/* ACTIONS */}

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                type="button"
                onClick={
                  saveNow
                }
                className="h-14 rounded-2xl bg-slate-800 border border-white/10 text-white font-black flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                حفظ
              </button>

              <button
                type="button"
                disabled={
                  busy
                }
                onClick={
                  createSummaryPDF
                }
                className="h-14 rounded-2xl bg-emerald-600 text-white font-black flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <FileDown className="w-5 h-5" />

                {busy
                  ? 'جاري التجهيز...'
                  : 'ملف PDF'}
              </button>
            </div>

            <button
              type="button"
              onClick={
                deleteEquipment
              }
              className="w-full h-12 mt-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-black flex items-center justify-center gap-2"
            >
              <Trash2 className="w-5 h-5" />
              حذف المعدة
            </button>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function DocumentCard({
  title,
  icon,
  document,
  onChange,
}: {
  title: string;
  icon:
    React.ReactNode;
  document:
    DocumentInfo;
  onChange:
    (
      field:
        keyof DocumentInfo,
      value: string
    ) => void;
}) {
  return (
    <Card
      title={
        title
      }
      icon={
        icon
      }
    >
      <Field
        label="رقم المستند / الشهادة"
        value={
          document.number
        }
        onChange={(
          value
        ) =>
          onChange(
            'number',
            value
          )
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <DateInput
          label="تاريخ الإصدار"
          value={
            document.issueDate
          }
          onChange={(
            value
          ) =>
            onChange(
              'issueDate',
              value
            )
          }
        />

        <DateInput
          label="تاريخ الانتهاء"
          value={
            document.expiryDate
          }
          onChange={(
            value
          ) =>
            onChange(
              'expiryDate',
              value
            )
          }
        />
      </div>

      <StatusBadge
        date={
          document.expiryDate
        }
      />

      <Field
        label="ملاحظات"
        value={
          document.notes
        }
        onChange={(
          value
        ) =>
          onChange(
            'notes',
            value
          )
        }
      />
    </Card>
  );
}

function StatusBadge({
  date,
}: {
  date: string;
}) {
  const status =
    getStatus(date);

  return (
    <div className="mt-2">
      <span
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-black ${status.className}`}
      >
        <CalendarDays className="w-4 h-4" />
        {status.text}
      </span>
    </div>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon:
    React.ReactNode;
  children:
    React.ReactNode;
}) {
  const [
    open,
    setOpen,
  ] = useState(true);

  return (
    <section className="mb-4 rounded-[24px] border border-white/10 bg-[#0b1524] overflow-hidden">
      <button
        type="button"
        onClick={() =>
          setOpen(
            !open
          )
        }
        className="w-full p-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
            {icon}
          </div>

          <div className="text-white text-sm font-black">
            {title}
          </div>
        </div>

        {open ? (
          <ChevronUp className="w-5 h-5 text-slate-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-500" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {children}
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder = '',
  inputMode = 'text',
}: {
  label: string;
  value: string;
  onChange:
    (value: string) => void;
  placeholder?: string;
  inputMode?:
    | 'text'
    | 'numeric'
    | 'decimal';
}) {
  return (
    <label className="block">
      <span className="block mb-2 text-[11px] font-bold text-slate-400">
        {label}
      </span>

      <input
        type="text"
        value={
          value
        }
        inputMode={
          inputMode
        }
        placeholder={
          placeholder
        }
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }
        className="w-full h-12 px-3 rounded-xl bg-[#07111d] border border-white/10 text-white text-sm font-bold outline-none focus:border-blue-500/60"
      />
    </label>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange:
    (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="block mb-2 text-[11px] font-bold text-slate-400">
        {label}
      </span>

      <input
        type="date"
        value={
          value
        }
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }
        className="w-full h-12 px-3 rounded-xl bg-[#07111d] border border-white/10 text-white text-sm font-bold outline-none focus:border-blue-500/60"
      />
    </label>
  );
          }
