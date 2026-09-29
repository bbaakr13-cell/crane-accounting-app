import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  ExternalLink,
  MessageCircleMore,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { AppLayout } from '@/components/layout/AppLayout';

type MonitorOpportunity = {
  id: string;
  timestamp: number;
  packageName: string;
  appName: string;
  groupName: string;
  sender: string;
  message: string;
  matchedKeyword: string;
  matchedArea: string;
};

type MonitorSettings = {
  keywords: string[];
  areas: string[];
  requireArea: boolean;
  enabled: boolean;
};

type MonitorPlugin = {
  isNotificationAccessEnabled(): Promise<{ enabled: boolean }>;
  openNotificationAccessSettings(): Promise<void>;
  requestAlertPermission(): Promise<{ granted: boolean }>;
  getSettings(): Promise<MonitorSettings>;
  setSettings(options: MonitorSettings): Promise<MonitorSettings>;
  getOpportunities(): Promise<{ opportunities: MonitorOpportunity[] }>;
  clearOpportunities(): Promise<void>;
  openWhatsApp(options?: { business?: boolean }): Promise<void>;
};

const WhatsAppMonitor = registerPlugin<MonitorPlugin>('WhatsAppMonitor');

const DEFAULT_KEYWORDS = [
  'محتاج كرين', 'مطلوب كرين', 'ابغى كرين', 'أبغى كرين', 'احتاج كرين',
  'أحتاج كرين', 'كرين', 'رافعة', 'بوم ترك', 'بومترك', 'ونش',
  'رفع كونتينر', 'رفع بركس', 'تحميل', 'تنزيل',
];

const DEFAULT_AREAS = [
  'خميس مشيط', 'الخميس', 'أبها', 'ابها', 'أحد رفيدة', 'احد رفيدة',
  'سراة عبيدة', 'ظهران الجنوب', 'الحرجة', 'تثليث', 'النماص',
  'تنومة', 'محايل', 'عسير',
];

const listToText = (values: string[]) => values.join('\n');
const textToList = (value: string) => Array.from(new Set(
  value.split(/[\n,،]+/).map((item) => item.trim()).filter(Boolean)
));

function formatTime(timestamp: number) {
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

export function WhatsAppMonitorPage() {
  const isNative = Capacitor.isNativePlatform();
  const [accessEnabled, setAccessEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keywordsText, setKeywordsText] = useState(listToText(DEFAULT_KEYWORDS));
  const [areasText, setAreasText] = useState(listToText(DEFAULT_AREAS));
  const [requireArea, setRequireArea] = useState(false);
  const [monitorEnabled, setMonitorEnabled] = useState(true);
  const [opportunities, setOpportunities] = useState<MonitorOpportunity[]>([]);

  const refresh = useCallback(async () => {
    if (!isNative) {
      setLoading(false);
      return;
    }

    try {
      const [access, settings, list] = await Promise.all([
        WhatsAppMonitor.isNotificationAccessEnabled(),
        WhatsAppMonitor.getSettings(),
        WhatsAppMonitor.getOpportunities(),
      ]);
      setAccessEnabled(access.enabled);
      setKeywordsText(listToText(settings.keywords?.length ? settings.keywords : DEFAULT_KEYWORDS));
      setAreasText(listToText(settings.areas?.length ? settings.areas : DEFAULT_AREAS));
      setRequireArea(Boolean(settings.requireArea));
      setMonitorEnabled(settings.enabled !== false);
      setOpportunities(list.opportunities || []);
    } catch (error) {
      console.error('WhatsApp monitor refresh failed', error);
    } finally {
      setLoading(false);
    }
  }, [isNative]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const keywordsCount = useMemo(() => textToList(keywordsText).length, [keywordsText]);
  const areasCount = useMemo(() => textToList(areasText).length, [areasText]);

  async function enableAccess() {
    if (!isNative) {
      window.alert('هذه الميزة تعمل داخل تطبيق Android فقط.');
      return;
    }
    await WhatsAppMonitor.openNotificationAccessSettings();
  }

  async function enableAlerts() {
    if (!isNative) return;
    const result = await WhatsAppMonitor.requestAlertPermission();
    if (!result.granted) {
      window.alert('فعّل إشعارات BAKR PRO من إعدادات الجوال حتى يصلك التنبيه القوي.');
    }
  }

  async function saveSettings() {
    if (!isNative) return;
    setSaving(true);
    try {
      await WhatsAppMonitor.setSettings({
        keywords: textToList(keywordsText),
        areas: textToList(areasText),
        requireArea,
        enabled: monitorEnabled,
      });
      window.alert('تم حفظ إعدادات مراقب واتساب.');
      await refresh();
    } catch (error) {
      console.error(error);
      window.alert('تعذر حفظ الإعدادات.');
    } finally {
      setSaving(false);
    }
  }

  async function clearList() {
    if (!isNative) return;
    if (!window.confirm('مسح سجل الفرص التي التقطها مراقب واتساب؟')) return;
    await WhatsAppMonitor.clearOpportunities();
    setOpportunities([]);
  }

  async function openWhatsApp(business = false) {
    if (!isNative) return;
    try {
      await WhatsAppMonitor.openWhatsApp({ business });
    } catch {
      window.alert('لم أجد تطبيق واتساب على هذا الجهاز.');
    }
  }

  return (
    <AppLayout>
      <div dir="rtl" className="min-h-screen pb-28 text-white">
        <section
          className="rounded-[28px] p-5 overflow-hidden relative"
          style={{
            background: 'linear-gradient(145deg,#0b2b22,#07131f 68%)',
            border: '1px solid rgba(74,222,128,.22)',
            boxShadow: '0 18px 42px rgba(0,0,0,.26)',
          }}
        >
          <div className="absolute -left-10 -top-10 w-36 h-36 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <div className="w-14 h-14 rounded-[18px] flex items-center justify-center shrink-0 bg-emerald-500/10 border border-emerald-300/20">
              <MessageCircleMore className="w-8 h-8 text-emerald-300" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-emerald-200/70 font-bold">BAKR PRO</p>
              <h1 className="text-[20px] font-black mt-1">مراقب فرص واتساب</h1>
              <p className="text-[11px] leading-6 text-slate-300 mt-2">
                يقرأ إشعارات WhatsApp وWhatsApp Business على هذا الجوال، ويبحث عن طلبات الكرينات والرفع ثم يعطيك تنبيهًا مستقلًا.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-[20px] p-4 bg-slate-900/70 border border-white/10">
            <p className="text-[10px] text-slate-400">الوصول للإشعارات</p>
            <div className="flex items-center gap-2 mt-2">
              {accessEnabled ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <ShieldCheck className="w-5 h-5 text-amber-300" />}
              <span className={`text-[13px] font-black ${accessEnabled ? 'text-emerald-300' : 'text-amber-300'}`}>
                {accessEnabled ? 'مفعّل' : 'غير مفعّل'}
              </span>
            </div>
          </div>
          <div className="rounded-[20px] p-4 bg-slate-900/70 border border-white/10">
            <p className="text-[10px] text-slate-400">الفرص الملتقطة</p>
            <p className="text-[24px] font-black text-sky-300 mt-1">{opportunities.length}</p>
          </div>
        </section>

        <section className="mt-4 rounded-[24px] p-4 bg-slate-900/70 border border-white/10">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-sky-300" />
            <h2 className="text-[15px] font-black">التفعيل أول مرة</h2>
          </div>
          <div className="grid grid-cols-1 gap-2 mt-4">
            <button type="button" onClick={enableAccess} className="h-12 rounded-[15px] font-black text-[12px] bg-emerald-500/10 border border-emerald-400/20 text-emerald-200 active:scale-[.98]">
              1 — فتح إعداد الوصول للإشعارات
            </button>
            <button type="button" onClick={enableAlerts} className="h-12 rounded-[15px] font-black text-[12px] bg-sky-500/10 border border-sky-400/20 text-sky-200 active:scale-[.98]">
              2 — السماح بتنبيهات BAKR PRO
            </button>
          </div>
          <p className="text-[10px] leading-5 text-slate-400 mt-3">
            بعد فتح الإعدادات، فعّل المفتاح بجانب BAKR PRO ثم ارجع لهذه الصفحة واضغط تحديث.
          </p>
        </section>

        <section className="mt-4 rounded-[24px] p-4 bg-slate-900/70 border border-white/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-black">تشغيل المراقبة</h2>
              <p className="text-[10px] text-slate-400 mt-1">إيقافها يمنع إنشاء تنبيهات فرص جديدة.</p>
            </div>
            <button
              type="button"
              onClick={() => setMonitorEnabled((value) => !value)}
              className={`w-14 h-8 rounded-full p-1 transition ${monitorEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <span className={`block w-6 h-6 rounded-full bg-white transition-transform ${monitorEnabled ? '-translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-[24px] p-4 bg-slate-900/70 border border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-black">كلمات البحث</h2>
            <span className="text-[10px] text-sky-300">{keywordsCount} كلمة</span>
          </div>
          <textarea
            value={keywordsText}
            onChange={(event) => setKeywordsText(event.target.value)}
            className="mt-3 w-full min-h-[190px] rounded-[16px] p-3 bg-black/20 border border-white/10 outline-none text-[12px] leading-6 text-white"
            placeholder="مثال: مطلوب كرين"
          />
        </section>

        <section className="mt-4 rounded-[24px] p-4 bg-slate-900/70 border border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-black">المناطق</h2>
            <span className="text-[10px] text-emerald-300">{areasCount} منطقة</span>
          </div>
          <textarea
            value={areasText}
            onChange={(event) => setAreasText(event.target.value)}
            className="mt-3 w-full min-h-[150px] rounded-[16px] p-3 bg-black/20 border border-white/10 outline-none text-[12px] leading-6 text-white"
            placeholder="مثال: خميس مشيط"
          />
          <label className="flex items-center gap-3 mt-3 rounded-[15px] p-3 bg-black/20 border border-white/10">
            <input type="checkbox" checked={requireArea} onChange={(event) => setRequireArea(event.target.checked)} className="w-4 h-4" />
            <span className="text-[11px] text-slate-300">لا تنبّهني إلا إذا كانت الرسالة تحتوي أيضًا على منطقة من القائمة</span>
          </label>
        </section>

        <button
          type="button"
          disabled={saving || !isNative}
          onClick={saveSettings}
          className="mt-4 w-full h-12 rounded-[17px] flex items-center justify-center gap-2 font-black text-[13px] bg-amber-400 text-slate-950 disabled:opacity-50 active:scale-[.98]"
        >
          <Save className="w-5 h-5" />
          {saving ? 'جارٍ الحفظ…' : 'حفظ إعدادات المراقبة'}
        </button>

        <section className="mt-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <BellRing className="w-5 h-5 text-amber-300" />
              <h2 className="text-[15px] font-black">آخر الفرص</h2>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={refresh} className="w-9 h-9 rounded-[12px] flex items-center justify-center bg-sky-500/10 border border-sky-400/20 text-sky-300">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button type="button" onClick={clearList} className="w-9 h-9 rounded-[12px] flex items-center justify-center bg-rose-500/10 border border-rose-400/20 text-rose-300">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {opportunities.length === 0 ? (
            <div className="rounded-[20px] p-7 text-center bg-slate-900/60 border border-white/10">
              <MessageCircleMore className="w-9 h-9 text-slate-600 mx-auto" />
              <p className="text-[12px] font-bold text-slate-300 mt-3">لا توجد فرص ملتقطة حتى الآن</p>
              <p className="text-[10px] text-slate-500 mt-1">بعد التفعيل، أي إشعار مطابق سيظهر هنا.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {opportunities.map((item) => (
                <article key={item.id} className="rounded-[20px] p-4 bg-slate-900/70 border border-emerald-400/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-black text-emerald-200 truncate">{item.groupName || item.sender || item.appName || 'WhatsApp'}</p>
                      <p className="text-[9px] text-slate-500 mt-1">{formatTime(item.timestamp)}</p>
                    </div>
                    <span className="text-[9px] font-black px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-400/20">{item.matchedKeyword || 'فرصة'}</span>
                  </div>
                  <p className="text-[12px] leading-6 text-slate-200 mt-3 whitespace-pre-wrap break-words">{item.message}</p>
                  {item.matchedArea ? <p className="text-[10px] text-sky-300 mt-2">📍 {item.matchedArea}</p> : null}
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button type="button" onClick={() => openWhatsApp(false)} className="h-10 rounded-[13px] flex items-center justify-center gap-1.5 text-[10px] font-black bg-emerald-500/10 border border-emerald-400/20 text-emerald-200">
                      <ExternalLink className="w-4 h-4" /> واتساب
                    </button>
                    <button type="button" onClick={() => openWhatsApp(true)} className="h-10 rounded-[13px] flex items-center justify-center gap-1.5 text-[10px] font-black bg-sky-500/10 border border-sky-400/20 text-sky-200">
                      <ExternalLink className="w-4 h-4" /> واتساب بزنس
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {!isNative ? (
          <p className="mt-5 text-[10px] leading-5 text-amber-300 bg-amber-500/10 border border-amber-400/20 rounded-[16px] p-3">
            وضع المعاينة في المتصفح لا يستطيع قراءة إشعارات واتساب. المراقبة تعمل بعد بناء APK وتثبيته على أندرويد.
          </p>
        ) : null}
      </div>
    </AppLayout>
  );
}

export default WhatsAppMonitorPage;
