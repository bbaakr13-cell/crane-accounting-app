import { useState, useEffect, useRef, useCallback } from 'react';
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
  LockKeyhole,
  ShieldCheck,
  KeyRound,
  LockOpen,
  Mail,
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

function Toggle({
  value,
  onChange,
  label,
  desc,
  icon: Icon,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc: string;
  icon: any;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="w-full flex items-center gap-3 text-right"
    >
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
        <Icon className="w-5 h-5 text-gold-400" />
      </div>

      <div className="flex-1">
        <b className="text-sm text-white">{label}</b>
        <p className="text-[11px] text-slate-500 mt-0.5">{desc}</p>
      </div>

      <div
        className={`w-12 h-7 rounded-full p-1 transition-colors ${
          value ? 'bg-gold-500' : 'bg-white/10'
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white transition-transform ${
            value ? '-translate-x-5' : 'translate-x-0'
          }`}
        />
      </div>
    </button>
  );
}

export function SettingsPage() {
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [s, setS] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // =========================
  // قفل التطبيق
  // =========================

  const [lockEnabled, setLockEnabled] = useState(isAppLockEnabled());
  const [pinExists, setPinExists] = useState(hasAppPin());

  const [showPinForm, setShowPinForm] = useState(false);

  const [pinMode, setPinMode] = useState<'create' | 'change'>('create');

  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [pinMessage, setPinMessage] = useState('');
  const [pinError, setPinError] = useState('');

  // =========================
  // بريد الاسترجاع
  // =========================

  const [recoveryEmail, setRecoveryEmailValue] = useState(
    getRecoveryEmail()
  );

  const [savedRecoveryEmail, setSavedRecoveryEmail] = useState(
    getRecoveryEmail()
  );

  const load = useCallback(() => fetchSettings().then(setS), []);

  useEffect(() => {
    load();
  }, [load]);

  function logo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];

    if (!f || !s) return;

    const r = new FileReader();

    r.onload = () =>
      setS({
        ...s,
        logo: String(r.result),
      });

    r.readAsDataURL(f);
  }

  async function save() {
    if (!s) return;

    setSaving(true);

    await saveSettings(s);

    setMsg('تم حفظ الإعدادات بنجاح');

    setSaving(false);

    setTimeout(() => {
      setMsg('');
    }, 1800);
  }

  async function exp() {
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
      createdAt: new Date().toISOString(),
    };

    for (const t of tables) {
      const { data } = await supabase.from(t).select('*');
      out[t] = data ?? [];
    }

    const a = document.createElement('a');

    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(out, null, 2)], {
        type: 'application/json',
      })
    );

    a.download = `crane-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    a.click();
  }

  async function imp(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];

    if (
      !f ||
      !confirm('استعادة النسخة الاحتياطية واستبدال البيانات الحالية؟')
    ) {
      return;
    }

    const b = JSON.parse(await f.text());

    for (const [t, rows] of Object.entries(b)) {
      if (
        Array.isArray(rows) &&
        !['version', 'createdAt'].includes(t)
      ) {
        await supabase
          .from(t)
          .delete()
          .neq('id', '__none__');

        if (rows.length) {
          await supabase.from(t).insert(rows);
        }
      }
    }

    await load();

    setMsg('تمت استعادة النسخة');
  }

  // =========================
  // إنشاء PIN
  // =========================

  function openCreatePin() {
    setPinMode('create');

    setOldPin('');
    setNewPin('');
    setConfirmPin('');

    setPinError('');
    setPinMessage('');

    setShowPinForm(true);
  }

  // =========================
  // تغيير PIN
  // =========================

  function openChangePin() {
    setPinMode('change');

    setOldPin('');
    setNewPin('');
    setConfirmPin('');

    setPinError('');
    setPinMessage('');

    setShowPinForm(true);
  }

  // =========================
  // حفظ PIN
  // =========================

  async function handleSavePin() {
    setPinError('');
    setPinMessage('');

    if (!/^\d{4}$/.test(newPin)) {
      setPinError('الرقم السري يجب أن يكون 4 أرقام');
      return;
    }

    if (newPin !== confirmPin) {
      setPinError('تأكيد الرقم السري غير مطابق');
      return;
    }

    try {
      if (pinMode === 'change') {
        if (!/^\d{4}$/.test(oldPin)) {
          setPinError('أدخل الرقم السري الحالي');
          return;
        }

        const correct = await verifyAppPin(oldPin);

        if (!correct) {
          setPinError('الرقم السري الحالي غير صحيح');
          return;
        }
      }

      await setAppPin(newPin);

      setPinExists(true);
      setLockEnabled(true);

      setOldPin('');
      setNewPin('');
      setConfirmPin('');

      setShowPinForm(false);

      setPinMessage(
        pinMode === 'create'
          ? 'تم إنشاء قفل التطبيق بنجاح'
          : 'تم تغيير الرقم السري بنجاح'
      );

      setTimeout(() => {
        setPinMessage('');
      }, 2500);
    } catch (error) {
      console.error(error);
      setPinError('تعذر حفظ الرقم السري');
    }
  }

  // =========================
  // تشغيل / إيقاف القفل
  // =========================

  async function handleLockToggle() {
    setPinError('');
    setPinMessage('');

    if (!pinExists) {
      openCreatePin();
      return;
    }

    if (lockEnabled) {
      const entered = window.prompt(
        'أدخل الرقم السري الحالي لإيقاف القفل'
      );

      if (entered === null) return;

      const correct = await verifyAppPin(entered);

      if (!correct) {
        setPinError('الرقم السري غير صحيح');
        return;
      }

      disableAppLock();
      setLockEnabled(false);

      setPinMessage('تم إيقاف قفل التطبيق');
    } else {
      const entered = window.prompt(
        'أدخل الرقم السري لتفعيل القفل'
      );

      if (entered === null) return;

      const correct = await verifyAppPin(entered);

      if (!correct) {
        setPinError('الرقم السري غير صحيح');
        return;
      }

      await setAppPin(entered);

      setLockEnabled(true);

      setPinMessage('تم تفعيل قفل التطبيق');
    }

    setTimeout(() => {
      setPinMessage('');
    }, 2500);
  }

  // =========================
  // حذف PIN
  // =========================

  async function handleRemovePin() {
    if (!pinExists) return;

    const entered = window.prompt('أدخل الرقم السري الحالي');

    if (entered === null) return;

    const correct = await verifyAppPin(entered);

    if (!correct) {
      setPinError('الرقم السري غير صحيح');
      return;
    }

    const approved = window.confirm(
      'هل تريد حذف الرقم السري وإلغاء حماية التطبيق؟'
    );

    if (!approved) return;

    removeAppPin();

    setPinExists(false);
    setLockEnabled(false);

    setShowPinForm(false);

    setOldPin('');
    setNewPin('');
    setConfirmPin('');

    setPinMessage('تم حذف قفل التطبيق');

    setTimeout(() => {
      setPinMessage('');
    }, 2500);
  }

  // =========================
  // حفظ بريد الاسترجاع
  // =========================

  function handleSaveRecoveryEmail() {
    setPinError('');
    setPinMessage('');

    try {
      setRecoveryEmail(recoveryEmail);

      const saved = getRecoveryEmail();

      setSavedRecoveryEmail(saved);
      setRecoveryEmailValue(saved);

      setPinMessage('تم حفظ بريد الاسترجاع بنجاح');

      setTimeout(() => {
        setPinMessage('');
      }, 2500);
    } catch (error) {
      setPinError(
        error instanceof Error
          ? error.message
          : 'تعذر حفظ بريد الاسترجاع'
      );
    }
  }

  // =========================
  // حذف بريد الاسترجاع
  // =========================

  function handleRemoveRecoveryEmail() {
    const approved = window.confirm(
      'هل تريد حذف بريد استرجاع الرقم السري؟'
    );

    if (!approved) return;

    removeRecoveryEmail();

    setRecoveryEmailValue('');
    setSavedRecoveryEmail('');

    setPinError('');
    setPinMessage('تم حذف بريد الاسترجاع');

    setTimeout(() => {
      setPinMessage('');
    }, 2500);
  }

  if (!s) {
    return (
      <AppLayout showHeader={false} showBottomNav={false}>
        <PageHeader
          title="الإعدادات"
          icon={SettingsIcon}
          onBack={() => nav('/')}
        />
      </AppLayout>
    );
  }

  const input =
    'w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-gold-500/40';

  const pinInput =
    'w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-center text-xl tracking-[0.45em] text-white outline-none focus:border-gold-500/50';

  return (
    <AppLayout showHeader={false} showBottomNav={false}>
      <div className="pt-4">
        <PageHeader
          title="الإعدادات"
          subtitle="خيارات حقيقية محفوظة على الجهاز"
          icon={SettingsIcon}
          onBack={() => nav('/')}
        />

        {/* صورة التطبيق */}

        <Card className="p-5 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-ink-900 overflow-hidden flex items-center justify-center">
              {s.logo ? (
                <img
                  src={s.logo}
                  className="w-full h-full object-cover"
                  alt="شعار التطبيق"
                />
              ) : (
                <CraneLogo size={56} />
              )}
            </div>

            <div className="flex-1">
              <b className="text-white">
                صورة وواجهة التطبيق
              </b>

              <p className="text-xs text-slate-500 mt-1">
                اختر شعارًا من صور الجوال
              </p>

              <button
                onClick={() => fileRef.current?.click()}
                className="mt-3 px-3 py-2 rounded-xl bg-gold-500/10 text-gold-400 text-xs flex items-center gap-2"
              >
                <Image className="w-4 h-4" />
                تغيير الصورة
              </button>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={logo}
              />
            </div>
          </div>
        </Card>

        {/* بيانات النشاط */}

        <Card className="p-4 mb-4 space-y-3">
          <div className="flex items-center gap-2 text-gold-400 mb-2">
            <Building2 className="w-4 h-4" />
            <b className="text-sm">بيانات النشاط</b>
          </div>

          <input
            className={input}
            value={s.appName}
            onChange={(e) =>
              setS({
                ...s,
                appName: e.target.value,
              })
            }
            placeholder="اسم البرنامج"
          />

          <input
            className={input}
            value={s.businessName}
            onChange={(e) =>
              setS({
                ...s,
                businessName: e.target.value,
              })
            }
            placeholder="اسم النشاط"
          />

          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <Phone className="absolute right-3 top-3.5 w-4 h-4 text-slate-500" />

              <input
                className={`${input} pr-10`}
                value={s.phone}
                onChange={(e) =>
                  setS({
                    ...s,
                    phone: e.target.value,
                  })
                }
              />
            </div>

            <div className="relative">
              <MapPin className="absolute right-3 top-3.5 w-4 h-4 text-slate-500" />

              <input
                className={`${input} pr-10`}
                value={s.city}
                onChange={(e) =>
                  setS({
                    ...s,
                    city: e.target.value,
                  })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <CreditCard className="absolute right-3 top-3.5 w-4 h-4 text-slate-500" />

              <input
                className={`${input} pr-10`}
                value={s.currency}
                onChange={(e) =>
                  setS({
                    ...s,
                    currency: e.target.value,
                  })
                }
              />
            </div>

            <select
              className={input}
              value={s.defaultPaymentMethod}
              onChange={(e) =>
                setS({
                  ...s,
                  defaultPaymentMethod: e.target.value,
                })
              }
            >
              {paymentMethods.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>

          <input
            className={input}
            value={s.reportTitle}
            onChange={(e) =>
              setS({
                ...s,
                reportTitle: e.target.value,
              })
            }
            placeholder="عنوان التقارير"
          />
        </Card>

        {/* خيارات التشغيل */}

        <Card className="p-4 mb-4 space-y-5">
          <div className="flex items-center gap-2 text-gold-400">
            <SlidersHorizontal className="w-4 h-4" />
            <b className="text-sm">خيارات التشغيل</b>
          </div>

          <Toggle
            value={s.showOfflineBadge}
            onChange={(v) =>
              setS({
                ...s,
                showOfflineBadge: v,
              })
            }
            label="إظهار وضع بدون إنترنت"
            desc="شارة توضح أن البيانات محفوظة محليًا"
            icon={WifiOff}
          />

          <Toggle
            value={s.animations}
            onChange={(v) =>
              setS({
                ...s,
                animations: v,
              })
            }
            label="الحركات البصرية"
            desc="تشغيل أو تقليل مؤثرات الانتقال"
            icon={Gauge}
          />

          <Toggle
            value={s.compactMode}
            onChange={(v) =>
              setS({
                ...s,
                compactMode: v,
              })
            }
            label="الوضع المضغوط"
            desc="يعرض عناصر أكثر في الشاشة"
            icon={SlidersHorizontal}
          />

          <Toggle
            value={s.printPhone}
            onChange={(v) =>
              setS({
                ...s,
                printPhone: v,
              })
            }
            label="إظهار الجوال في الطباعة"
            desc="إضافة رقم الجوال في الفواتير والتقارير"
            icon={Printer}
          />
        </Card>

        {/* ========================= */}
        {/* أمان التطبيق */}
        {/* ========================= */}

        <Card className="p-4 mb-4">
          <div className="flex items-center gap-2 text-gold-400 mb-5">
            <ShieldCheck className="w-5 h-5" />

            <div>
              <b className="text-sm text-white">
                أمان التطبيق
              </b>

              <p className="text-[11px] text-slate-500 mt-1">
                حماية BAAKR PRO برقم سري
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLockToggle}
            className="w-full flex items-center gap-3 text-right"
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                lockEnabled
                  ? 'bg-green-500/10'
                  : 'bg-white/5'
              }`}
            >
              <LockKeyhole
                className={`w-5 h-5 ${
                  lockEnabled
                    ? 'text-green-400'
                    : 'text-gold-400'
                }`}
              />
            </div>

            <div className="flex-1">
              <b className="text-sm text-white">
                قفل التطبيق
              </b>

              <p className="text-[11px] text-slate-500 mt-0.5">
                {lockEnabled
                  ? 'القفل مفعل حاليًا'
                  : pinExists
                  ? 'القفل متوقف حاليًا'
                  : 'أنشئ رقم PIN لحماية التطبيق'}
              </p>
            </div>

            <div
              className={`w-12 h-7 rounded-full p-1 transition-colors ${
                lockEnabled
                  ? 'bg-green-500'
                  : 'bg-white/10'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  lockEnabled
                    ? '-translate-x-5'
                    : 'translate-x-0'
                }`}
              />
            </div>
          </button>

          <div className="border-t border-white/5 my-4" />

          {!pinExists ? (
            <button
              type="button"
              onClick={openCreatePin}
              className="w-full py-3 rounded-xl bg-gold-500/10 border border-gold-500/20 text-gold-400 font-bold text-sm flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              إنشاء رقم سري
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={openChangePin}
                className="py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold flex items-center justify-center gap-2"
              >
                <KeyRound className="w-4 h-4" />
                تغيير PIN
              </button>

              <button
                type="button"
                onClick={handleRemovePin}
                className="py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold flex items-center justify-center gap-2"
              >
                <LockOpen className="w-4 h-4" />
                حذف القفل
              </button>
            </div>
          )}

          {/* بريد الاسترجاع */}

          <div className="mt-4 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-5 h-5 text-blue-400" />

              <div>
                <b className="text-sm text-white">
                  بريد استرجاع الرقم السري
                </b>

                <p className="text-[11px] text-slate-500 mt-1">
                  يصلك عليه رمز التحقق إذا نسيت PIN
                </p>
              </div>
            </div>

            <input
              type="email"
              inputMode="email"
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              value={recoveryEmail}
              onChange={(e) =>
                setRecoveryEmailValue(e.target.value)
              }
              placeholder="example@gmail.com"
              className={`${input} mt-3 text-left`}
            />

            <button
              type="button"
              onClick={handleSaveRecoveryEmail}
              className="w-full mt-3 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold text-sm flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" />
              حفظ بريد الاسترجاع
            </button>

            {savedRecoveryEmail && (
              <div className="mt-3">
                <p className="text-xs text-green-400 text-center">
                  ✓ يوجد بريد استرجاع محفوظ
                </p>

                <button
                  type="button"
                  onClick={handleRemoveRecoveryEmail}
                  className="w-full mt-2 py-2 text-xs text-red-400"
                >
                  حذف بريد الاسترجاع
                </button>
              </div>
            )}
          </div>

          {/* نموذج PIN */}

          {showPinForm && (
            <div className="mt-4 p-4 rounded-2xl bg-black/20 border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <KeyRound className="w-5 h-5 text-gold-400" />

                <b className="text-white text-sm">
                  {pinMode === 'create'
                    ? 'إنشاء رقم سري'
                    : 'تغيير الرقم السري'}
                </b>
              </div>

              <div className="space-y-3">
                {pinMode === 'change' && (
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    className={pinInput}
                    value={oldPin}
                    onChange={(e) =>
                      setOldPin(
                        e.target.value
                          .replace(/\D/g, '')
                          .slice(0, 4)
                      )
                    }
                    placeholder="PIN الحالي"
                  />
                )}

                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  className={pinInput}
                  value={newPin}
                  onChange={(e) =>
                    setNewPin(
                      e.target.value
                        .replace(/\D/g, '')
                        .slice(0, 4)
                    )
                  }
                  placeholder="PIN الجديد"
                />

                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  className={pinInput}
                  value={confirmPin}
                  onChange={(e) =>
                    setConfirmPin(
                      e.target.value
                        .replace(/\D/g, '')
                        .slice(0, 4)
                    )
                  }
                  placeholder="تأكيد PIN"
                />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleSavePin}
                    className="py-3 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-ink-950 font-bold text-sm"
                  >
                    {pinMode === 'create'
                      ? 'إنشاء القفل'
                      : 'حفظ PIN الجديد'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowPinForm(false);
                      setOldPin('');
                      setNewPin('');
                      setConfirmPin('');
                      setPinError('');
                    }}
                    className="py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-bold text-sm"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          )}

          {pinError && (
            <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-bold">
              {pinError}
            </div>
          )}

          {pinMessage && (
            <div className="mt-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs text-center font-bold">
              {pinMessage}
            </div>
          )}

          <div className="mt-4 flex gap-2 items-start text-[11px] text-slate-500 leading-5">
            <ShieldCheck className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />

            <span>
              عند تفعيل القفل سيطلب BAAKR PRO رمز PIN عند فتح التطبيق أو العودة إليه بعد وضعه في الخلفية.
            </span>
          </div>
        </Card>

        {/* حفظ الإعدادات */}

        {msg && (
          <p className="text-sm text-income text-center mb-3">
            {msg}
          </p>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-ink-950 font-bold flex items-center justify-center gap-2"
        >
          <Save className="w-5 h-5" />

          {saving
            ? 'جاري الحفظ...'
            : 'حفظ جميع الإعدادات'}
        </button>

        <button
          type="button"
          onClick={() => nav('/about')}
          className="w-full mt-4 mb-4 p-4 rounded-2xl bg-ink-850/80 border border-white/10 text-white font-bold"
        >
          حقوق التصميم — BAAKR_ALMASBHI
        </button>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <button
            onClick={exp}
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
              onChange={imp}
              className="hidden"
            />
          </label>
        </div>

        <button
          onClick={() =>
            setS({
              ...DEFAULT_SETTINGS,
            })
          }
          className="w-full mt-3 py-3 rounded-xl text-xs text-slate-400 flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          استعادة الإعدادات الافتراضية
        </button>
      </div>
    </AppLayout>
  );
}
