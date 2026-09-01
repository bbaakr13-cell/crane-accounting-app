import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
  Settings as SettingsIcon,
  Save,
  Download,
  Upload,
  Phone,
  MapPin,
  Building2,
  CreditCard,
  Image,
  SlidersHorizontal,
  Printer,
  Gauge,
  WifiOff,
  RotateCcw,
  Trash2,
  ImagePlus,
  LockKeyhole,
  ShieldCheck,
  KeyRound,
  LockOpen,
  Mail,
  Truck,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { CraneLogo } from '@/components/CraneLogo';

import {
  fetchSettings,
  saveSettings,
  DEFAULT_SETTINGS,
  type AppSettings,
} from '@/lib/settings';

import { supabase } from '@/lib/supabase';
import { paymentMethods } from '@/lib/transactions';

import {
  hasAppPin,
  isAppLockEnabled,
  setAppPin,
  verifyAppPin,
  disableAppLock,
  removeAppPin,
  setRecoveryEmail,
  getRecoveryEmail,
  removeRecoveryEmail,
} from '@/lib/appLock';

const DASHBOARD_IMAGE_KEY =
  'baakr_pro_dashboard_image';

/* =========================
   ضغط الصور
========================= */

async function compressImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(
        new Error('تعذر قراءة الصورة')
      );
    };

    reader.onload = () => {
      const image = new window.Image();

      image.onerror = () => {
        reject(
          new Error('تعذر فتح الصورة')
        );
      };

      image.onload = () => {
        let width = image.width;
        let height = image.height;

        if (!width || !height) {
          reject(
            new Error(
              'أبعاد الصورة غير صحيحة'
            )
          );
          return;
        }

        const ratio = Math.min(
          maxWidth / width,
          maxHeight / height,
          1
        );

        width = Math.max(
          1,
          Math.round(width * ratio)
        );

        height = Math.max(
          1,
          Math.round(height * ratio)
        );

        const canvas =
          document.createElement(
            'canvas'
          );

        canvas.width = width;
        canvas.height = height;

        const ctx =
          canvas.getContext('2d');

        if (!ctx) {
          reject(
            new Error(
              'تعذر معالجة الصورة'
            )
          );
          return;
        }

        ctx.drawImage(
          image,
          0,
          0,
          width,
          height
        );

        const result =
          canvas.toDataURL(
            'image/jpeg',
            quality
          );

        resolve(result);
      };

      image.src = String(
        reader.result || ''
      );
    };

    reader.readAsDataURL(file);
  });
}

/* =========================
   Toggle
========================= */

function Toggle({
  value,
  onChange,
  label,
  desc,
  icon: Icon,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  desc: string;
  icon: any;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onChange(!value)
      }
      className="w-full flex items-center gap-3 text-right"
    >
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
        <Icon className="w-5 h-5 text-gold-400" />
      </div>

      <div className="flex-1">
        <b className="text-sm text-white">
          {label}
        </b>

        <p className="text-[11px] text-slate-500 mt-0.5">
          {desc}
        </p>
      </div>

      <div
        className={`w-12 h-7 rounded-full p-1 ${
          value
            ? 'bg-gold-500'
            : 'bg-white/10'
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white transition-transform ${
            value
              ? '-translate-x-5'
              : ''
          }`}
        />
      </div>
    </button>
  );
}

export function SettingsPage() {
  const nav = useNavigate();

  const logoRef =
    useRef<HTMLInputElement>(null);

  const dashboardImageRef =
    useRef<HTMLInputElement>(null);

  const [settings, setSettings] =
    useState<AppSettings | null>(
      null
    );

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState('');

  const [
    messageType,
    setMessageType,
  ] = useState<
    'success' | 'error'
  >('success');

  const [
    dashboardImage,
    setDashboardImage,
  ] = useState('');

  /* =========================
     القفل
  ========================= */

  const [
    lockEnabled,
    setLockEnabled,
  ] = useState(
    isAppLockEnabled()
  );

  const [
    pinExists,
    setPinExists,
  ] = useState(
    hasAppPin()
  );

  const [
    showPinForm,
    setShowPinForm,
  ] = useState(false);

  const [pinMode, setPinMode] =
    useState<
      'create' | 'change'
    >('create');

  const [oldPin, setOldPin] =
    useState('');

  const [newPin, setNewPin] =
    useState('');

  const [
    confirmPin,
    setConfirmPin,
  ] = useState('');

  const [
    pinMessage,
    setPinMessage,
  ] = useState('');

  const [
    pinError,
    setPinError,
  ] = useState('');

  /* =========================
     بريد الاسترجاع
  ========================= */

  const [
    recoveryEmail,
    setRecoveryEmailValue,
  ] = useState(
    getRecoveryEmail()
  );

  const [
    savedRecoveryEmail,
    setSavedRecoveryEmail,
  ] = useState(
    getRecoveryEmail()
  );

  const load = useCallback(
    async () => {
      const data =
        await fetchSettings();

      setSettings(data);
    },
    []
  );

  useEffect(() => {
    load();

    try {
      const savedImage =
        localStorage.getItem(
          DASHBOARD_IMAGE_KEY
        ) || '';

      setDashboardImage(
        savedImage
      );
    } catch (error) {
      console.error(error);
    }
  }, [load]);

  function showMessage(
    text: string,
    type:
      | 'success'
      | 'error' = 'success'
  ) {
    setMessage(text);
    setMessageType(type);

    window.setTimeout(() => {
      setMessage('');
    }, 2800);
  }

  /* =========================
     الشعار
  ========================= */

  async function handleLogo(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file || !settings) {
      return;
    }

    if (
      !file.type.startsWith(
        'image/'
      )
    ) {
      showMessage(
        'الملف المختار ليس صورة',
        'error'
      );
      return;
    }

    try {
      showMessage(
        'جاري تجهيز الشعار...'
      );

      const compressed =
        await compressImage(
          file,
          500,
          500,
          0.68
        );

      setSettings(
        (current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            logo: compressed,
          };
        }
      );

      showMessage(
        'تم تجهيز الشعار، اضغط حفظ الإعدادات'
      );
    } catch (error) {
      console.error(error);

      showMessage(
        'تعذر تجهيز الشعار',
        'error'
      );
    } finally {
      event.target.value = '';
    }
  }

  /* =========================
     صورة الواجهة
  ========================= */

  async function handleDashboardImage(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    if (
      !file.type.startsWith(
        'image/'
      )
    ) {
      showMessage(
        'الملف المختار ليس صورة',
        'error'
      );

      return;
    }

    try {
      showMessage(
        'جاري تجهيز الصورة...'
      );

      /*
       * حجم صغير نسبيًا حتى
       * لا تمتلئ مساحة localStorage
       */
      const compressed =
        await compressImage(
          file,
          900,
          500,
          0.6
        );

      localStorage.setItem(
        DASHBOARD_IMAGE_KEY,
        compressed
      );

      setDashboardImage(
        compressed
      );

      showMessage(
        'تم حفظ صورة الواجهة بنجاح ✓'
      );
    } catch (error) {
      console.error(error);

      showMessage(
        'تعذر حفظ الصورة. جرّب صورة أخرى',
        'error'
      );
    } finally {
      event.target.value = '';
    }
  }

  function removeDashboardImage() {
    const approved =
      window.confirm(
        'هل تريد حذف صورة الواجهة الرئيسية؟'
      );

    if (!approved) return;

    try {
      localStorage.removeItem(
        DASHBOARD_IMAGE_KEY
      );

      setDashboardImage('');

      showMessage(
        'تم حذف صورة الواجهة'
      );
    } catch (error) {
      console.error(error);

      showMessage(
        'تعذر حذف الصورة',
        'error'
      );
    }
  }

  /* =========================
     حفظ الإعدادات
  ========================= */

  async function save() {
    if (
      !settings ||
      saving
    ) {
      return;
    }

    setSaving(true);
    setMessage('');

    const timeout =
      new Promise<never>(
        (_, reject) => {
          window.setTimeout(
            () =>
              reject(
                new Error(
                  'SAVE_TIMEOUT'
                )
              ),
            12000
          );
        }
      );

    try {
      await Promise.race([
        saveSettings(settings),
        timeout,
      ]);

      showMessage(
        'تم حفظ جميع الإعدادات بنجاح ✓'
      );
    } catch (error) {
      console.error(
        'Settings save error:',
        error
      );

      showMessage(
        'تعذر حفظ الإعدادات',
        'error'
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================
     النسخ الاحتياطي
  ========================= */

  async function exportBackup() {
    try {
      const tables = [
        'equipment',
        'customers',
        'jobs',
        'expenses',
        'payments',
        'invoices',
        'monthly_equipment_days',
        'settings',
        'job_types',
      ];

      const out: any = {
        version: 2,
        createdAt:
          new Date().toISOString(),
      };

      for (
        const table of tables
      ) {
        const { data } =
          await supabase
            .from(table)
            .select('*');

        out[table] =
          data ?? [];
      }

      const blob =
        new Blob(
          [
            JSON.stringify(
              out,
              null,
              2
            ),
          ],
          {
            type:
              'application/json',
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const a =
        document.createElement(
          'a'
        );

      a.href = url;

      a.download =
        `crane-backup-${new Date()
          .toISOString()
          .slice(0, 10)}.json`;

      a.click();

      window.setTimeout(() => {
        URL.revokeObjectURL(
          url
        );
      }, 1000);
    } catch (error) {
      console.error(error);

      showMessage(
        'تعذر إنشاء النسخة الاحتياطية',
        'error'
      );
    }
  }

  async function importBackup(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    const approved =
      window.confirm(
        'استعادة النسخة الاحتياطية واستبدال البيانات الحالية؟'
      );

    if (!approved) {
      event.target.value = '';
      return;
    }

    try {
      const text =
        await file.text();

      const backup =
        JSON.parse(text);

      for (
        const [table, rows]
        of Object.entries(
          backup
        )
      ) {
        if (
          Array.isArray(rows) &&
          ![
            'version',
            'createdAt',
          ].includes(table)
        ) {
          await supabase
            .from(table)
            .delete()
            .neq(
              'id',
              '__none__'
            );

          if (rows.length) {
            await supabase
              .from(table)
              .insert(rows);
          }
        }
      }

      await load();

      showMessage(
        'تمت استعادة النسخة'
      );
    } catch (error) {
      console.error(error);

      showMessage(
        'تعذر استعادة النسخة',
        'error'
      );
    } finally {
      event.target.value = '';
    }
  }

  /* =========================
     PIN
  ========================= */

  function openCreatePin() {
    setPinMode('create');

    setOldPin('');
    setNewPin('');
    setConfirmPin('');

    setPinError('');
    setPinMessage('');

    setShowPinForm(true);
  }

  function openChangePin() {
    setPinMode('change');

    setOldPin('');
    setNewPin('');
    setConfirmPin('');

    setPinError('');
    setPinMessage('');

    setShowPinForm(true);
  }

  async function handleSavePin() {
    setPinError('');
    setPinMessage('');

    if (
      !/^\d{4}$/.test(
        newPin
      )
    ) {
      setPinError(
        'الرقم السري يجب أن يكون 4 أرقام'
      );

      return;
    }

    if (
      newPin !== confirmPin
    ) {
      setPinError(
        'تأكيد الرقم السري غير مطابق'
      );

      return;
    }

    try {
      if (
        pinMode === 'change'
      ) {
        if (
          !/^\d{4}$/.test(
            oldPin
          )
        ) {
          setPinError(
            'أدخل الرقم السري الحالي'
          );

          return;
        }

        const correct =
          await verifyAppPin(
            oldPin
          );

        if (!correct) {
          setPinError(
            'الرقم السري الحالي غير صحيح'
          );

          return;
        }
      }

      await setAppPin(
        newPin
      );

      setPinExists(true);
      setLockEnabled(true);

      setShowPinForm(false);

      setOldPin('');
      setNewPin('');
      setConfirmPin('');

      setPinMessage(
        pinMode === 'create'
          ? 'تم إنشاء القفل بنجاح'
          : 'تم تغيير الرقم السري بنجاح'
      );
    } catch (error) {
      console.error(error);

      setPinError(
        'تعذر حفظ الرقم السري'
      );
    }
  }

  async function handleLockToggle() {
    setPinError('');
    setPinMessage('');

    if (!pinExists) {
      openCreatePin();
      return;
    }

    const entered =
      window.prompt(
        lockEnabled
          ? 'أدخل PIN لإيقاف القفل'
          : 'أدخل PIN لتشغيل القفل'
      );

    if (entered === null) {
      return;
    }

    const correct =
      await verifyAppPin(
        entered
      );

    if (!correct) {
      setPinError(
        'الرقم السري غير صحيح'
      );

      return;
    }

    if (lockEnabled) {
      disableAppLock();

      setLockEnabled(false);

      setPinMessage(
        'تم إيقاف القفل'
      );
    } else {
      await setAppPin(
        entered
      );

      setLockEnabled(true);

      setPinMessage(
        'تم تشغيل القفل'
      );
    }
  }

  async function handleRemovePin() {
    const entered =
      window.prompt(
        'أدخل الرقم السري الحالي'
      );

    if (entered === null) {
      return;
    }

    const correct =
      await verifyAppPin(
        entered
      );

    if (!correct) {
      setPinError(
        'الرقم السري غير صحيح'
      );

      return;
    }

    const approved =
      window.confirm(
        'هل تريد حذف قفل التطبيق؟'
      );

    if (!approved) {
      return;
    }

    removeAppPin();

    setPinExists(false);
    setLockEnabled(false);
    setShowPinForm(false);

    setPinMessage(
      'تم حذف القفل'
    );
  }

  /* =========================
     بريد الاسترجاع
  ========================= */

  function saveRecoveryEmail() {
    setPinError('');
    setPinMessage('');

    try {
      setRecoveryEmail(
        recoveryEmail
      );

      const saved =
        getRecoveryEmail();

      setRecoveryEmailValue(
        saved
      );

      setSavedRecoveryEmail(
        saved
      );

      setPinMessage(
        'تم حفظ بريد الاسترجاع'
      );
    } catch (error) {
      setPinError(
        error instanceof Error
          ? error.message
          : 'تعذر حفظ البريد'
      );
    }
  }

  function deleteRecoveryEmail() {
    const approved =
      window.confirm(
        'هل تريد حذف بريد الاسترجاع؟'
      );

    if (!approved) {
      return;
    }

    removeRecoveryEmail();

    setRecoveryEmailValue('');
    setSavedRecoveryEmail('');

    setPinMessage(
      'تم حذف بريد الاسترجاع'
    );
  }

  if (!settings) {
    return (
      <AppLayout
        showHeader={false}
        showBottomNav={false}
      >
        <PageHeader
          title="الإعدادات"
          icon={SettingsIcon}
          onBack={() =>
            nav('/')
          }
        />
      </AppLayout>
    );
  }

  const input =
    'w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-gold-500/40';

  const pinInput =
    'w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-center text-xl tracking-[0.4em] text-white outline-none focus:border-gold-500/50';

  return (
    <AppLayout
      showHeader={false}
      showBottomNav={false}
    >
      <div className="pt-4">

        <PageHeader
          title="الإعدادات"
          subtitle="تخصيص وإدارة BAAKR PRO"
          icon={SettingsIcon}
          onBack={() =>
            nav('/')
          }
        />

        {/* شعار التطبيق */}

        <Card className="p-5 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-ink-900 overflow-hidden flex items-center justify-center">

              {settings.logo ? (
                <img
                  src={
                    settings.logo
                  }
                  alt="شعار التطبيق"
                  className="w-full h-full object-cover"
                />
              ) : (
                <CraneLogo
                  size={56}
                />
              )}

            </div>

            <div className="flex-1">
              <b className="text-white">
                شعار التطبيق
              </b>

              <p className="text-xs text-slate-500 mt-1">
                اختر شعارًا من صور الجوال
              </p>

              <button
                type="button"
                onClick={() =>
                  logoRef.current?.click()
                }
                className="mt-3 px-3 py-2 rounded-xl bg-gold-500/10 text-gold-400 text-xs flex items-center gap-2"
              >
                <Image className="w-4 h-4" />
                تغيير الشعار
              </button>

              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={
                  handleLogo
                }
              />
            </div>
          </div>
        </Card>

        {/* صورة الرئيسية */}

        <Card className="p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <ImagePlus className="w-5 h-5 text-gold-400" />

            <div>
              <b className="text-sm text-white">
                صورة الواجهة الرئيسية
              </b>

              <p className="text-[10px] text-slate-500 mt-1">
                تتغير مباشرة في الصفحة الرئيسية
              </p>
            </div>
          </div>

          <div
            className="relative overflow-hidden rounded-[20px]"
            style={{
              height: 135,
              background:
                'linear-gradient(135deg,#14243a,#07111f)',
              border:
                '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {dashboardImage ? (
              <img
                src={
                  dashboardImage
                }
                alt="صورة الرئيسية"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Truck className="w-12 h-12 text-gold-400/30" />

                <span className="text-xs text-slate-500 mt-2">
                  لا توجد صورة
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              type="button"
              onClick={() =>
                dashboardImageRef.current?.click()
              }
              className="h-11 rounded-xl bg-gold-500/10 border border-gold-500/20 text-gold-400 text-xs font-bold flex items-center justify-center gap-2"
            >
              <ImagePlus className="w-4 h-4" />

              {dashboardImage
                ? 'تغيير الصورة'
                : 'اختيار صورة'}
            </button>

            <button
              type="button"
              disabled={
                !dashboardImage
              }
              onClick={
                removeDashboardImage
              }
              className="h-11 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-30"
            >
              <Trash2 className="w-4 h-4" />

              حذف الصورة
            </button>
          </div>

          <input
            ref={
              dashboardImageRef
            }
            type="file"
            accept="image/*"
            className="hidden"
            onChange={
              handleDashboardImage
            }
          />

          <p className="text-[10px] text-green-400/70 text-center mt-3">
            ✓ يتم ضغط الصورة وحفظها تلقائيًا
          </p>
        </Card>

        {/* بيانات النشاط */}

        <Card className="p-4 mb-4 space-y-3">
          <div className="flex items-center gap-2 text-gold-400">
            <Building2 className="w-4 h-4" />
            <b className="text-sm">
              بيانات النشاط
            </b>
          </div>

          <input
            className={input}
            value={
              settings.appName
            }
            onChange={(e) =>
              setSettings({
                ...settings,
                appName:
                  e.target.value,
              })
            }
            placeholder="اسم البرنامج"
          />

          <input
            className={input}
            value={
              settings.businessName
            }
            onChange={(e) =>
              setSettings({
                ...settings,
                businessName:
                  e.target.value,
              })
            }
            placeholder="اسم النشاط"
          />

          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <Phone className="absolute right-3 top-3.5 w-4 h-4 text-slate-500" />

              <input
                className={`${input} pr-10`}
                value={
                  settings.phone
                }
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    phone:
                      e.target.value,
                  })
                }
                placeholder="الجوال"
              />
            </div>

            <div className="relative">
              <MapPin className="absolute right-3 top-3.5 w-4 h-4 text-slate-500" />

              <input
                className={`${input} pr-10`}
                value={
                  settings.city
                }
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    city:
                      e.target.value,
                  })
                }
                placeholder="المدينة"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <CreditCard className="absolute right-3 top-3.5 w-4 h-4 text-slate-500" />

              <input
                className={`${input} pr-10`}
                value={
                  settings.currency
                }
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    currency:
                      e.target.value,
                  })
                }
              />
            </div>

            <select
              className={input}
              value={
                settings.defaultPaymentMethod
              }
              onChange={(e) =>
                setSettings({
                  ...settings,
                  defaultPaymentMethod:
                    e.target.value,
                })
              }
            >
              {paymentMethods.map(
                (method) => (
                  <option
                    key={method}
                  >
                    {method}
                  </option>
                )
              )}
            </select>
          </div>

          <input
            className={input}
            value={
              settings.reportTitle
            }
            onChange={(e) =>
              setSettings({
                ...settings,
                reportTitle:
                  e.target.value,
              })
            }
            placeholder="عنوان التقارير"
          />
        </Card>

        {/* خيارات */}

        <Card className="p-4 mb-4 space-y-5">
          <div className="flex items-center gap-2 text-gold-400">
            <SlidersHorizontal className="w-4 h-4" />

            <b className="text-sm">
              خيارات التشغيل
            </b>
          </div>

          <Toggle
            value={
              settings.showOfflineBadge
            }
            onChange={(value) =>
              setSettings({
                ...settings,
                showOfflineBadge:
                  value,
              })
            }
            label="وضع بدون إنترنت"
            desc="إظهار شارة حفظ البيانات محليًا"
            icon={WifiOff}
          />

          <Toggle
            value={
              settings.animations
            }
            onChange={(value) =>
              setSettings({
                ...settings,
                animations:
                  value,
              })
            }
            label="الحركات البصرية"
            desc="تشغيل تأثيرات الواجهة"
            icon={Gauge}
          />

          <Toggle
            value={
              settings.compactMode
            }
            onChange={(value) =>
              setSettings({
                ...settings,
                compactMode:
                  value,
              })
            }
            label="الوضع المضغوط"
            desc="عرض عناصر أكثر"
            icon={
              SlidersHorizontal
            }
          />

          <Toggle
            value={
              settings.printPhone
            }
            onChange={(value) =>
              setSettings({
                ...settings,
                printPhone:
                  value,
              })
            }
            label="الجوال في الطباعة"
            desc="إظهار الرقم في التقارير"
            icon={Printer}
          />
        </Card>

        {/* القفل */}

        <Card className="p-4 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-gold-400" />

            <div>
              <b className="text-sm text-white">
                أمان التطبيق
              </b>

              <p className="text-[10px] text-slate-500">
                حماية BAAKR PRO
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={
              handleLockToggle
            }
            className="w-full flex items-center gap-3"
          >
            <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center">
              <LockKeyhole
                className={
                  lockEnabled
                    ? 'w-5 h-5 text-green-400'
                    : 'w-5 h-5 text-gold-400'
                }
              />
            </div>

            <div className="flex-1 text-right">
              <b className="text-sm text-white">
                قفل التطبيق
              </b>

              <p className="text-[10px] text-slate-500">
                {lockEnabled
                  ? 'القفل مفعل'
                  : 'القفل متوقف'}
              </p>
            </div>
          </button>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              type="button"
              onClick={
                pinExists
                  ? openChangePin
                  : openCreatePin
              }
              className="py-3 rounded-xl bg-gold-500/10 border border-gold-500/20 text-gold-400 text-xs font-bold flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />

              {pinExists
                ? 'تغيير PIN'
                : 'إنشاء PIN'}
            </button>

            <button
              type="button"
              disabled={
                !pinExists
              }
              onClick={
                handleRemovePin
              }
              className="py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-30"
            >
              <LockOpen className="w-4 h-4" />
              حذف القفل
            </button>
          </div>

          {showPinForm && (
            <div className="mt-4 p-4 rounded-xl bg-black/20 border border-white/10 space-y-3">
              {pinMode ===
                'change' && (
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  className={
                    pinInput
                  }
                  placeholder="PIN الحالي"
                  value={oldPin}
                  onChange={(e) =>
                    setOldPin(
                      e.target.value
                        .replace(
                          /\D/g,
                          ''
                        )
                        .slice(
                          0,
                          4
                        )
                    )
                  }
                />
              )}

              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                className={
                  pinInput
                }
                placeholder="PIN الجديد"
                value={newPin}
                onChange={(e) =>
                  setNewPin(
                    e.target.value
                      .replace(
                        /\D/g,
                        ''
                      )
                      .slice(
                        0,
                        4
                      )
                  )
                }
              />

              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                className={
                  pinInput
                }
                placeholder="تأكيد PIN"
                value={
                  confirmPin
                }
                onChange={(e) =>
                  setConfirmPin(
                    e.target.value
                      .replace(
                        /\D/g,
                        ''
                      )
                      .slice(
                        0,
                        4
                      )
                  )
                }
              />

              <button
                type="button"
                onClick={
                  handleSavePin
                }
                className="w-full py-3 rounded-xl bg-gold-500 text-ink-950 font-bold text-sm"
              >
                حفظ PIN
              </button>
            </div>
          )}

          {/* البريد */}

          <div className="mt-4 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-400" />

              <b className="text-sm text-white">
                بريد استرجاع PIN
              </b>
            </div>

            <input
              type="email"
              dir="ltr"
              value={
                recoveryEmail
              }
              onChange={(e) =>
                setRecoveryEmailValue(
                  e.target.value
                )
              }
              className={`${input} mt-3 text-left`}
              placeholder="example@gmail.com"
            />

            <button
              type="button"
              onClick={
                saveRecoveryEmail
              }
              className="w-full mt-3 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold"
            >
              حفظ بريد الاسترجاع
            </button>

            {savedRecoveryEmail && (
              <button
                type="button"
                onClick={
                  deleteRecoveryEmail
                }
                className="w-full mt-2 py-2 text-xs text-red-400"
              >
                حذف بريد الاسترجاع
              </button>
            )}
          </div>

          {pinError && (
            <p className="mt-3 p-3 rounded-xl bg-red-500/10 text-red-400 text-xs text-center">
              {pinError}
            </p>
          )}

          {pinMessage && (
            <p className="mt-3 p-3 rounded-xl bg-green-500/10 text-green-400 text-xs text-center">
              {pinMessage}
            </p>
          )}
        </Card>

        {/* الرسالة */}

        {message && (
          <div
            className={`mb-3 p-3 rounded-xl border text-xs font-bold text-center ${
              messageType ===
              'success'
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {message}
          </div>
        )}

        {/* الحفظ */}

        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="w-full py-3.5 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-ink-950 font-bold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Save className="w-5 h-5" />

          {saving
            ? 'جاري الحفظ...'
            : 'حفظ جميع الإعدادات'}
        </button>

        {/* النسخ */}

        <div className="grid grid-cols-2 gap-3 mt-4">
          <button
            type="button"
            onClick={
              exportBackup
            }
            className="py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            نسخة احتياطية
          </button>

          <label className="py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white flex items-center justify-center gap-2">
            <Upload className="w-4 h-4" />
            استعادة

            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={
                importBackup
              }
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => {
            setSettings({
              ...DEFAULT_SETTINGS,
            });

            showMessage(
              'تم تحميل الإعدادات الافتراضية، اضغط حفظ'
            );
          }}
          className="w-full mt-3 py-3 rounded-xl text-xs text-slate-400 flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          استعادة الإعدادات الافتراضية
        </button>

        <div className="h-8" />
      </div>
    </AppLayout>
  );
  }
