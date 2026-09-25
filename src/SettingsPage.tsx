import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type RefObject,
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
  Palette,
  Shield,
  DatabaseBackup,
  Bell,
  Lock,
  Languages,
  Sparkles,
  Eye,
  HardDrive,
  Zap,
  LayoutGrid,
  Check,
  Moon,
  Smartphone,
  Plus,
  Truck,
  Wallet,
  TrendingUp,
  FileText,
  Users,
  CalendarDays,
  ChevronLeft,
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

const DASHBOARD_IMAGE_KEY =
  'baakr_pro_dashboard_image';

const UI_PREFS_KEY =
  'baakr_pro_ui_preferences_v1';

const QUICK_ADD_STORAGE_KEY =
  'bakr_pro_quick_add_actions_v1';

const LAST_BACKUP_KEY =
  'baakr_pro_last_backup_at';

type AccentName =
  | 'gold'
  | 'blue'
  | 'green'
  | 'red'
  | 'purple'
  | 'silver';

type ThemeMode =
  | 'dark'
  | 'amoled';

type ImageQuality =
  | 'high'
  | 'balanced'
  | 'small';

type UiPreferences = {
  accent: AccentName;
  themeMode: ThemeMode;
  fontScale: number;
  iconScale: number;
  roundedCards: boolean;
  smartNotifications: boolean;
  dueNotifications: boolean;
  maintenanceNotifications: boolean;
  documentNotifications: boolean;
  highExpenseNotifications: boolean;
  hideSensitiveValues: boolean;
  confirmBeforeDelete: boolean;
  autoLockMinutes: number;
  language: 'ar' | 'en';
  arabicNumbers: boolean;
  imageQuality: ImageQuality;
  reduceMotion: boolean;
};

const DEFAULT_UI_PREFS: UiPreferences = {
  accent: 'gold',
  themeMode: 'dark',
  fontScale: 1,
  iconScale: 1,
  roundedCards: true,
  smartNotifications: true,
  dueNotifications: true,
  maintenanceNotifications: true,
  documentNotifications: true,
  highExpenseNotifications: false,
  hideSensitiveValues: false,
  confirmBeforeDelete: true,
  autoLockMinutes: 5,
  language: 'ar',
  arabicNumbers: false,
  imageQuality: 'balanced',
  reduceMotion: false,
};

const ACCENTS: Array<{
  id: AccentName;
  label: string;
  color: string;
  glow: string;
}> = [
  {
    id: 'gold',
    label: 'ذهبي',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,.35)',
  },
  {
    id: 'blue',
    label: 'أزرق',
    color: '#3b82f6',
    glow: 'rgba(59,130,246,.35)',
  },
  {
    id: 'green',
    label: 'أخضر',
    color: '#10b981',
    glow: 'rgba(16,185,129,.35)',
  },
  {
    id: 'red',
    label: 'أحمر',
    color: '#ef4444',
    glow: 'rgba(239,68,68,.35)',
  },
  {
    id: 'purple',
    label: 'بنفسجي',
    color: '#a855f7',
    glow: 'rgba(168,85,247,.35)',
  },
  {
    id: 'silver',
    label: 'فضي',
    color: '#cbd5e1',
    glow: 'rgba(203,213,225,.25)',
  },
];

const QUICK_ADD_OPTIONS = [
  {
    id: 'trip',
    label: 'مشوار',
    icon: Truck,
    color: '#fbbf24',
  },
  {
    id: 'expense',
    label: 'مصروف',
    icon: Wallet,
    color: '#fb7185',
  },
  {
    id: 'income',
    label: 'دخل جديد',
    icon: TrendingUp,
    color: '#4ade80',
  },
  {
    id: 'work-invoice',
    label: 'فاتورة عمل',
    icon: FileText,
    color: '#60a5fa',
  },
  {
    id: 'lead',
    label: 'عميل / فرصة',
    icon: Users,
    color: '#c084fc',
  },
  {
    id: 'quotation',
    label: 'عرض سعر',
    icon: FileText,
    color: '#22d3ee',
  },
  {
    id: 'invoice',
    label: 'الفواتير',
    icon: FileText,
    color: '#a78bfa',
  },
  {
    id: 'customer',
    label: 'العملاء',
    icon: Users,
    color: '#38bdf8',
  },
  {
    id: 'equipment',
    label: 'المعدات',
    icon: Truck,
    color: '#f59e0b',
  },
  {
    id: 'today',
    label: 'حساب اليوم',
    icon: CalendarDays,
    color: '#34d399',
  },
];

const DEFAULT_QUICK_ADD = [
  'lead',
  'work-invoice',
  'income',
  'expense',
  'trip',
];

function getUiPrefs(): UiPreferences {
  try {
    const raw =
      localStorage.getItem(UI_PREFS_KEY);

    if (!raw) {
      return DEFAULT_UI_PREFS;
    }

    return {
      ...DEFAULT_UI_PREFS,
      ...JSON.parse(raw),
    };
  } catch {
    return DEFAULT_UI_PREFS;
  }
}

function getQuickAddIds(): string[] {
  try {
    const raw =
      localStorage.getItem(
        QUICK_ADD_STORAGE_KEY
      );

    if (!raw) {
      return DEFAULT_QUICK_ADD;
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return DEFAULT_QUICK_ADD;
    }

    const valid = parsed.filter(
      (id: unknown) =>
        typeof id === 'string' &&
        QUICK_ADD_OPTIONS.some(
          (item) => item.id === id
        )
    );

    return valid.length
      ? valid.slice(0, 8)
      : DEFAULT_QUICK_ADD;
  } catch {
    return DEFAULT_QUICK_ADD;
  }
}

function applyUiPrefs(
  prefs: UiPreferences
) {
  const accent =
    ACCENTS.find(
      (item) =>
        item.id === prefs.accent
    ) ?? ACCENTS[0];

  document.documentElement.style.setProperty(
    '--baakr-accent',
    accent.color
  );

  document.documentElement.dataset.baakrTheme =
    prefs.themeMode;

  document.documentElement.dataset.baakrLanguage =
    prefs.language;

  document.documentElement.style.fontSize =
    `${prefs.fontScale * 100}%`;

  window.dispatchEvent(
    new CustomEvent(
      'baakr-ui-settings-changed',
      {
        detail: prefs,
      }
    )
  );
}

async function compressImage(
  file: File,
  maxWidth: number,
  quality: number
): Promise<string> {
  return new Promise(
    (resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () =>
        reject(
          new Error(
            'تعذر قراءة الصورة'
          )
        );

      reader.onload = () => {
        const img =
          new window.Image();

        img.onerror = () =>
          reject(
            new Error(
              'تعذر تحميل الصورة'
            )
          );

        img.onload = () => {
          const ratio = Math.min(
            1,
            maxWidth / img.width
          );

          const width = Math.round(
            img.width * ratio
          );

          const height = Math.round(
            img.height * ratio
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
            img,
            0,
            0,
            width,
            height
          );

          resolve(
            canvas.toDataURL(
              'image/jpeg',
              quality
            )
          );
        };

        img.src = String(
          reader.result || ''
        );
      };

      reader.readAsDataURL(file);
    }
  );
}

function Toggle({
  value,
  onChange,
  label,
  desc,
  icon: Icon,
  color = '#f59e0b',
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc: string;
  icon: any;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onChange(!value)
      }
      className="w-full flex items-center gap-3 text-right"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: `${color}12`,
          border:
            `1px solid ${color}22`,
        }}
      >
        <Icon
          className="w-5 h-5"
          style={{ color }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <b className="text-sm text-white">
          {label}
        </b>

        <p className="text-[11px] text-slate-500 mt-0.5">
          {desc}
        </p>
      </div>

      <div
        className="w-12 h-7 rounded-full p-1 transition-colors shrink-0"
        style={{
          background: value
            ? color
            : 'rgba(255,255,255,.10)',
        }}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white transition-transform ${
            value
              ? '-translate-x-5'
              : 'translate-x-0'
          }`}
        />
      </div>
    </button>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
  color = '#f59e0b',
}: {
  icon: any;
  title: string;
  subtitle?: string;
  color?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
        style={{
          background: `${color}12`,
          border:
            `1px solid ${color}20`,
        }}
      >
        <Icon
          className="w-5 h-5"
          style={{ color }}
        />
      </div>

      <div className="min-w-0">
        <h2 className="text-[15px] font-black text-white">
          {title}
        </h2>

        {subtitle && (
          <p className="text-[10px] text-slate-500 mt-1">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function QuickSettingCard({
  title,
  subtitle,
  icon: Icon,
  color,
  onClick,
}: {
  title: string;
  subtitle: string;
  icon: any;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[20px] p-3.5 text-right active:scale-[0.98] transition-transform"
      style={{
        background:
          'linear-gradient(145deg,rgba(15,29,49,.98),rgba(7,17,31,.99))',
        border:
          `1px solid ${color}22`,
      }}
    >
      <div
        className="w-10 h-10 rounded-[13px] flex items-center justify-center mb-3"
        style={{
          background: `${color}14`,
        }}
      >
        <Icon
          className="w-5 h-5"
          style={{ color }}
        />
      </div>

      <p className="text-[12px] font-black text-white">
        {title}
      </p>

      <p className="text-[9px] text-slate-500 mt-1">
        {subtitle}
      </p>
    </button>
  );
}

export function SettingsPage() {
  const nav = useNavigate();

  const logoRef =
    useRef<HTMLInputElement>(null);

  const dashboardImageRef =
    useRef<HTMLInputElement>(null);

  const appearanceRef =
    useRef<HTMLDivElement>(null);

  const homeRef =
    useRef<HTMLDivElement>(null);

  const securityRef =
    useRef<HTMLDivElement>(null);

  const backupRef =
    useRef<HTMLDivElement>(null);

  const [s, setS] =
    useState<AppSettings | null>(
      null
    );

  const [ui, setUi] =
    useState<UiPreferences>(
      DEFAULT_UI_PREFS
    );

  const [quickAddIds, setQuickAddIds] =
    useState<string[]>(
      DEFAULT_QUICK_ADD
    );

  const [saving, setSaving] =
    useState(false);

  const [msg, setMsg] =
    useState('');

  const [
    dashboardImage,
    setDashboardImage,
  ] = useState('');

  const [
    lastBackupAt,
    setLastBackupAt,
  ] = useState('');

  const load = useCallback(() => {
    return fetchSettings().then(setS);
  }, []);

  useEffect(() => {
    load();

    setUi(getUiPrefs());

    setQuickAddIds(
      getQuickAddIds()
    );

    setDashboardImage(
      localStorage.getItem(
        DASHBOARD_IMAGE_KEY
      ) || ''
    );

    setLastBackupAt(
      localStorage.getItem(
        LAST_BACKUP_KEY
      ) || ''
    );
  }, [load]);

  useEffect(() => {
    applyUiPrefs(ui);
  }, [ui]);

  function showMessage(
    text: string
  ) {
    setMsg(text);

    setTimeout(() => {
      setMsg('');
    }, 2400);
  }

  function scrollTo(
    ref: RefObject<HTMLDivElement>
  ) {
    ref.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  async function logo(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const f =
      e.target.files?.[0];

    if (!f || !s) {
      return;
    }

    if (
      !f.type.startsWith('image/')
    ) {
      showMessage(
        'الملف المختار ليس صورة'
      );
      return;
    }

    try {
      const result =
        await compressImage(
          f,
          900,
          0.88
        );

      setS({
        ...s,
        logo: result,
      });

      showMessage(
        'تم تجهيز الشعار الجديد'
      );
    } catch {
      showMessage(
        'تعذر معالجة الشعار'
      );
    }

    e.target.value = '';
  }

  async function changeDashboardImage(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      e.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith('image/')
    ) {
      showMessage(
        'الملف المختار ليس صورة'
      );
      return;
    }

    try {
      const quality =
        ui.imageQuality === 'high'
          ? 0.92
          : ui.imageQuality ===
              'small'
            ? 0.72
            : 0.84;

      const maxWidth =
        ui.imageQuality === 'high'
          ? 1800
          : ui.imageQuality ===
              'small'
            ? 1000
            : 1400;

      const result =
        await compressImage(
          file,
          maxWidth,
          quality
        );

      localStorage.setItem(
        DASHBOARD_IMAGE_KEY,
        result
      );

      setDashboardImage(result);

      showMessage(
        'تم تغيير صورة الواجهة الرئيسية'
      );
    } catch (error) {
      console.error(error);

      showMessage(
        'تعذر حفظ الصورة'
      );
    }

    e.target.value = '';
  }

  function removeDashboardImage() {
    localStorage.removeItem(
      DASHBOARD_IMAGE_KEY
    );

    setDashboardImage('');

    if (
      dashboardImageRef.current
    ) {
      dashboardImageRef.current.value =
        '';
    }

    showMessage(
      'تم حذف صورة الواجهة الرئيسية'
    );
  }

  function toggleQuickAdd(
    id: string
  ) {
    setQuickAddIds(
      (current) => {
        if (
          current.includes(id)
        ) {
          if (
            current.length <= 1
          ) {
            showMessage(
              'يجب إبقاء اختصار واحد على الأقل'
            );

            return current;
          }

          return current.filter(
            (item) =>
              item !== id
          );
        }

        if (
          current.length >= 8
        ) {
          showMessage(
            'الحد الأقصى 8 اختصارات'
          );

          return current;
        }

        return [
          ...current,
          id,
        ];
      }
    );
  }

  async function save() {
    if (!s) {
      return;
    }

    setSaving(true);

    try {
      await saveSettings(s);

      localStorage.setItem(
        UI_PREFS_KEY,
        JSON.stringify(ui)
      );

      localStorage.setItem(
        QUICK_ADD_STORAGE_KEY,
        JSON.stringify(
          quickAddIds
        )
      );

      applyUiPrefs(ui);

      showMessage(
        'تم حفظ جميع الإعدادات بنجاح'
      );
    } finally {
      setSaving(false);
    }
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
      version: 3,
      createdAt:
        new Date().toISOString(),
      localPreferences: {
        ui:
          localStorage.getItem(
            UI_PREFS_KEY
          ),
        quickAdd:
          localStorage.getItem(
            QUICK_ADD_STORAGE_KEY
          ),
        dashboardImage:
          localStorage.getItem(
            DASHBOARD_IMAGE_KEY
          ),
      },
    };

    for (const t of tables) {
      const { data } =
        await supabase
          .from(t)
          .select('*');

      out[t] = data ?? [];
    }

    const createdAt =
      new Date().toISOString();

    localStorage.setItem(
      LAST_BACKUP_KEY,
      createdAt
    );

    setLastBackupAt(
      createdAt
    );

    const a =
      document.createElement('a');

    a.href =
      URL.createObjectURL(
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
        )
      );

    a.download =
      `baakr-pro-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;

    a.click();

    showMessage(
      'تم إنشاء النسخة الاحتياطية'
    );
  }

  async function imp(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const f =
      e.target.files?.[0];

    if (
      !f ||
      !confirm(
        'استعادة النسخة الاحتياطية واستبدال البيانات الحالية؟'
      )
    ) {
      return;
    }

    try {
      const b = JSON.parse(
        await f.text()
      );

      for (
        const [t, rows]
        of Object.entries(b)
      ) {
        if (
          Array.isArray(rows) &&
          ![
            'version',
            'createdAt',
          ].includes(t)
        ) {
          await supabase
            .from(t)
            .delete()
            .neq(
              'id',
              '__none__'
            );

          if (rows.length) {
            await supabase
              .from(t)
              .insert(rows);
          }
        }
      }

      const local =
        b?.localPreferences;

      if (local) {
        if (local.ui) {
          localStorage.setItem(
            UI_PREFS_KEY,
            local.ui
          );
        }

        if (local.quickAdd) {
          localStorage.setItem(
            QUICK_ADD_STORAGE_KEY,
            local.quickAdd
          );
        }

        if (
          local.dashboardImage
        ) {
          localStorage.setItem(
            DASHBOARD_IMAGE_KEY,
            local.dashboardImage
          );
        }
      }

      setUi(getUiPrefs());

      setQuickAddIds(
        getQuickAddIds()
      );

      setDashboardImage(
        localStorage.getItem(
          DASHBOARD_IMAGE_KEY
        ) || ''
      );

      await load();

      showMessage(
        'تمت استعادة النسخة بنجاح'
      );
    } catch (error) {
      console.error(error);

      showMessage(
        'تعذر استعادة النسخة'
      );
    }

    e.target.value = '';
  }

  function resetUi() {
    if (
      !confirm(
        'استعادة تخصيص الواجهة والإعدادات الإضافية للوضع الافتراضي؟'
      )
    ) {
      return;
    }

    setUi(
      DEFAULT_UI_PREFS
    );

    setQuickAddIds(
      DEFAULT_QUICK_ADD
    );

    localStorage.removeItem(
      UI_PREFS_KEY
    );

    localStorage.removeItem(
      QUICK_ADD_STORAGE_KEY
    );

    applyUiPrefs(
      DEFAULT_UI_PREFS
    );

    showMessage(
      'تمت استعادة تخصيص الواجهة'
    );
  }

  if (!s) {
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

  const accent =
    ACCENTS.find(
      (item) =>
        item.id === ui.accent
    ) ?? ACCENTS[0];

  const input =
    'w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-gold-500/40';

  return (
    <AppLayout
      showHeader={false}
      showBottomNav={false}
    >
      <div className="pt-4">

        <PageHeader
          title="الإعدادات"
          subtitle="تخصيص وتحكم كامل في BAAKR PRO"
          icon={SettingsIcon}
          onBack={() =>
            nav('/')
          }
        />

        {/* اختصارات الإعدادات */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <QuickSettingCard
            title="المظهر"
            subtitle="ألوان وشكل التطبيق"
            icon={Palette}
            color="#f59e0b"
            onClick={() =>
              scrollTo(
                appearanceRef
              )
            }
          />

          <QuickSettingCard
            title="الرئيسية"
            subtitle="الصور والاختصارات"
            icon={LayoutGrid}
            color="#3b82f6"
            onClick={() =>
              scrollTo(homeRef)
            }
          />

          <QuickSettingCard
            title="الأمان"
            subtitle="الخصوصية والحماية"
            icon={Shield}
            color="#10b981"
            onClick={() =>
              scrollTo(
                securityRef
              )
            }
          />

          <QuickSettingCard
            title="النسخ الاحتياطي"
            subtitle="حفظ واستعادة البيانات"
            icon={DatabaseBackup}
            color="#a855f7"
            onClick={() =>
              scrollTo(backupRef)
            }
          />
        </div>

        {/* المظهر */}
        <div ref={appearanceRef}>
          <Card className="p-4 mb-4">
            <SectionTitle
              icon={Palette}
              title="المظهر والتصميم"
              subtitle="خصص ألوان وشكل BAAKR PRO كما يناسبك"
              color={
                accent.color
              }
            />

            <div className="mb-5">
              <p className="text-[11px] font-bold text-slate-300 mb-3">
                لون التطبيق الرئيسي
              </p>

              <div className="grid grid-cols-6 gap-2">
                {ACCENTS.map(
                  (item) => {
                    const selected =
                      ui.accent ===
                      item.id;

                    return (
                      <button
                        key={
                          item.id
                        }
                        type="button"
                        onClick={() =>
                          setUi({
                            ...ui,
                            accent:
                              item.id,
                          })
                        }
                        className="flex flex-col items-center gap-1.5"
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{
                            background:
                              item.color,
                            boxShadow:
                              selected
                                ? `0 0 0 3px #07101f, 0 0 0 5px ${item.color}, 0 0 18px ${item.glow}`
                                : `0 0 12px ${item.glow}`,
                          }}
                        >
                          {selected && (
                            <Check className="w-5 h-5 text-slate-950" />
                          )}
                        </div>

                        <span className="text-[8px] text-slate-500">
                          {item.label}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <div className="mb-5">
              <p className="text-[11px] font-bold text-slate-300 mb-2">
                وضع الواجهة
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setUi({
                      ...ui,
                      themeMode:
                        'dark',
                    })
                  }
                  className="h-12 rounded-xl flex items-center justify-center gap-2 text-xs font-bold"
                  style={{
                    background:
                      ui.themeMode ===
                      'dark'
                        ? `${accent.color}16`
                        : 'rgba(255,255,255,.03)',
                    border:
                      ui.themeMode ===
                      'dark'
                        ? `1px solid ${accent.color}35`
                        : '1px solid rgba(255,255,255,.07)',
                    color:
                      ui.themeMode ===
                      'dark'
                        ? accent.color
                        : '#94a3b8',
                  }}
                >
                  <Moon className="w-4 h-4" />
                  داكن
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setUi({
                      ...ui,
                      themeMode:
                        'amoled',
                    })
                  }
                  className="h-12 rounded-xl flex items-center justify-center gap-2 text-xs font-bold"
                  style={{
                    background:
                      ui.themeMode ===
                      'amoled'
                        ? `${accent.color}16`
                        : 'rgba(0,0,0,.34)',
                    border:
                      ui.themeMode ===
                      'amoled'
                        ? `1px solid ${accent.color}35`
                        : '1px solid rgba(255,255,255,.07)',
                    color:
                      ui.themeMode ===
                      'amoled'
                        ? accent.color
                        : '#94a3b8',
                  }}
                >
                  <Smartphone className="w-4 h-4" />
                  AMOLED
                </button>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-300">
                    حجم الخط
                  </span>

                  <span className="text-[10px] text-slate-500">
                    {Math.round(
                      ui.fontScale *
                        100
                    )}
                    %
                  </span>
                </div>

                <input
                  type="range"
                  min="0.9"
                  max="1.15"
                  step="0.05"
                  value={
                    ui.fontScale
                  }
                  onChange={(e) =>
                    setUi({
                      ...ui,
                      fontScale:
                        Number(
                          e.target
                            .value
                        ),
                    })
                  }
                  className="w-full accent-amber-400"
                />
              </div>

              <Toggle
                value={
                  s.animations
                }
                onChange={(v) =>
                  setS({
                    ...s,
                    animations: v,
                  })
                }
                label="الحركات البصرية"
                desc="تشغيل المؤثرات والانتقالات في التطبيق"
                icon={Sparkles}
                color={
                  accent.color
                }
              />

              <Toggle
                value={
                  ui.reduceMotion
                }
                onChange={(v) =>
                  setUi({
                    ...ui,
                    reduceMotion: v,
                  })
                }
                label="تقليل الحركة"
                desc="مفيد للأجهزة الأبطأ وتوفير البطارية"
                icon={Zap}
                color="#60a5fa"
              />

              <Toggle
                value={
                  s.compactMode
                }
                onChange={(v) =>
                  setS({
                    ...s,
                    compactMode: v,
                  })
                }
                label="الوضع المضغوط"
                desc="يعرض عناصر أكثر في الشاشة"
                icon={
                  SlidersHorizontal
                }
                color="#a78bfa"
              />
            </div>
          </Card>
        </div>

        {/* شعار التطبيق */}
        <Card className="p-5 mb-4">
          <SectionTitle
            icon={Image}
            title="شعار التطبيق"
            subtitle="غيّر هوية BAAKR PRO من صور الجوال"
            color={
              accent.color
            }
          />

          <div className="flex items-center gap-4">
            <div
              className="w-20 h-20 rounded-3xl overflow-hidden flex items-center justify-center shrink-0"
              style={{
                background:
                  '#07101f',
                border:
                  `1px solid ${accent.color}25`,
              }}
            >
              {s.logo ? (
                <img
                  src={s.logo}
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
              <button
                type="button"
                onClick={() =>
                  logoRef.current?.click()
                }
                className="w-full h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98]"
                style={{
                  background:
                    `${accent.color}12`,
                  border:
                    `1px solid ${accent.color}25`,
                  color:
                    accent.color,
                }}
              >
                <Image className="w-4 h-4" />
                تغيير الشعار
              </button>

              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={logo}
              />
            </div>
          </div>
        </Card>

        {/* الرئيسية */}
        <div ref={homeRef}>
          <Card className="p-4 mb-4">
            <SectionTitle
              icon={LayoutGrid}
              title="تخصيص الواجهة الرئيسية"
              subtitle="الصورة واختصارات زر الإضافة السريعة"
              color="#3b82f6"
            />

            <div
              className="relative w-full overflow-hidden rounded-[22px]"
              style={{
                height: 150,
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
                  alt="صورة الواجهة الرئيسية"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Truck
                    className="w-12 h-12 text-amber-400/30"
                    strokeWidth={
                      1.4
                    }
                  />

                  <p className="text-xs text-slate-500 mt-2">
                    لم يتم اختيار صورة
                  </p>
                </div>
              )}

              {dashboardImage && (
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(180deg, transparent 35%, rgba(3,8,17,0.70))',
                  }}
                />
              )}

              {dashboardImage && (
                <div className="absolute bottom-3 right-3">
                  <span className="px-3 py-1.5 rounded-xl bg-black/55 border border-white/10 text-[10px] text-white">
                    BAAKR PRO
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
                className="h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98]"
                style={{
                  background:
                    `${accent.color}12`,
                  border:
                    `1px solid ${accent.color}25`,
                  color:
                    accent.color,
                }}
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
                className={`h-11 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] ${
                  dashboardImage
                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                    : 'bg-white/[0.03] border-white/[0.05] text-slate-600'
                }`}
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
                changeDashboardImage
              }
            />

            <div className="mt-6 pt-5 border-t border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[12px] font-black text-white">
                    زر الإضافة السريعة
                  </p>

                  <p className="text-[9px] text-slate-500 mt-1">
                    اختر الخانات التي تظهر عند الضغط على +
                  </p>
                </div>

                <span className="text-[9px] text-slate-500">
                  {
                    quickAddIds.length
                  }
                  /8
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {QUICK_ADD_OPTIONS.map(
                  (item) => {
                    const Icon =
                      item.icon;

                    const selected =
                      quickAddIds.includes(
                        item.id
                      );

                    return (
                      <button
                        key={
                          item.id
                        }
                        type="button"
                        onClick={() =>
                          toggleQuickAdd(
                            item.id
                          )
                        }
                        className="relative rounded-[16px] p-3 flex items-center gap-2.5 text-right active:scale-[0.98]"
                        style={{
                          background:
                            selected
                              ? `${item.color}12`
                              : 'rgba(255,255,255,.025)',
                          border:
                            selected
                              ? `1px solid ${item.color}35`
                              : '1px solid rgba(255,255,255,.06)',
                        }}
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            background:
                              `${item.color}12`,
                          }}
                        >
                          <Icon
                            className="w-5 h-5"
                            style={{
                              color:
                                item.color,
                            }}
                          />
                        </div>

                        <span className="text-[10px] font-bold text-white flex-1">
                          {item.label}
                        </span>

                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center"
                          style={{
                            background:
                              selected
                                ? item.color
                                : 'rgba(255,255,255,.06)',
                          }}
                        >
                          {selected ? (
                            <Check className="w-4 h-4 text-slate-950" />
                          ) : (
                            <Plus className="w-4 h-4 text-slate-500" />
                          )}
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* بيانات النشاط */}
        <Card className="p-4 mb-4 space-y-3">
          <SectionTitle
            icon={Building2}
            title="بيانات النشاط"
            subtitle="المعلومات الأساسية المستخدمة داخل التطبيق"
            color="#f59e0b"
          />

          <input
            className={input}
            value={s.appName}
            onChange={(e) =>
              setS({
                ...s,
                appName:
                  e.target.value,
              })
            }
            placeholder="اسم البرنامج"
          />

          <input
            className={input}
            value={
              s.businessName
            }
            onChange={(e) =>
              setS({
                ...s,
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
                  s.phone
                }
                onChange={(e) =>
                  setS({
                    ...s,
                    phone:
                      e.target.value,
                  })
                }
                placeholder="رقم الجوال"
              />
            </div>

            <div className="relative">
              <MapPin className="absolute right-3 top-3.5 w-4 h-4 text-slate-500" />

              <input
                className={`${input} pr-10`}
                value={
                  s.city
                }
                onChange={(e) =>
                  setS({
                    ...s,
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
                  s.currency
                }
                onChange={(e) =>
                  setS({
                    ...s,
                    currency:
                      e.target.value,
                  })
                }
                placeholder="العملة"
              />
            </div>

            <select
              className={input}
              value={
                s.defaultPaymentMethod
              }
              onChange={(e) =>
                setS({
                  ...s,
                  defaultPaymentMethod:
                    e.target.value,
                })
              }
            >
              {paymentMethods.map(
                (x) => (
                  <option key={x}>
                    {x}
                  </option>
                )
              )}
            </select>
          </div>

          <input
            className={input}
            value={
              s.reportTitle
            }
            onChange={(e) =>
              setS({
                ...s,
                reportTitle:
                  e.target.value,
              })
            }
            placeholder="عنوان التقارير"
          />
        </Card>

        {/* التنبيهات */}
        <Card className="p-4 mb-4 space-y-5">
          <SectionTitle
            icon={Bell}
            title="التنبيهات الذكية"
            subtitle="اختر التنبيهات التي تساعدك في العمل اليومي"
            color="#f59e0b"
          />

          <Toggle
            value={
              ui.dueNotifications
            }
            onChange={(v) =>
              setUi({
                ...ui,
                dueNotifications: v,
              })
            }
            label="تنبيه المستحقات"
            desc="تذكير بالدفعات والمبالغ المستحقة"
            icon={Bell}
            color="#f59e0b"
          />

          <Toggle
            value={
              ui.maintenanceNotifications
            }
            onChange={(v) =>
              setUi({
                ...ui,
                maintenanceNotifications:
                  v,
              })
            }
            label="مواعيد الصيانة"
            desc="تنبيه بمواعيد صيانة المعدات"
            icon={Gauge}
            color="#60a5fa"
          />

          <Toggle
            value={
              ui.documentNotifications
            }
            onChange={(v) =>
              setUi({
                ...ui,
                documentNotifications:
                  v,
              })
            }
            label="انتهاء المستندات"
            desc="تنبيه قبل انتهاء مستندات المعدات والمشغلين"
            icon={FileText}
            color="#a78bfa"
          />

          <Toggle
            value={
              ui.highExpenseNotifications
            }
            onChange={(v) =>
              setUi({
                ...ui,
                highExpenseNotifications:
                  v,
              })
            }
            label="المصروف المرتفع"
            desc="تنبيه عند تسجيل مصروف غير معتاد"
            icon={TrendingUp}
            color="#fb7185"
          />
        </Card>

        {/* الأمان */}
        <div ref={securityRef}>
          <Card className="p-4 mb-4 space-y-5">
            <SectionTitle
              icon={Shield}
              title="الأمان والخصوصية"
              subtitle="حماية معلوماتك المالية وبيانات العمل"
              color="#10b981"
            />

            <Toggle
              value={
                ui.hideSensitiveValues
              }
              onChange={(v) =>
                setUi({
                  ...ui,
                  hideSensitiveValues:
                    v,
                })
              }
              label="إخفاء المبالغ الحساسة"
              desc="حفظ خيار الخصوصية لعرض المبالغ"
              icon={Eye}
              color="#10b981"
            />

            <Toggle
              value={
                ui.confirmBeforeDelete
              }
              onChange={(v) =>
                setUi({
                  ...ui,
                  confirmBeforeDelete:
                    v,
                })
              }
              label="تأكيد قبل الحذف"
              desc="طلب تأكيد قبل عمليات الحذف المهمة"
              icon={Trash2}
              color="#fb7185"
            />

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />

                  <span className="text-[11px] font-bold text-slate-300">
                    القفل التلقائي
                  </span>
                </div>

                <span className="text-[10px] text-slate-500">
                  {
                    ui.autoLockMinutes
                  }{' '}
                  دقائق
                </span>
              </div>

              <select
                value={
                  ui.autoLockMinutes
                }
                onChange={(e) =>
                  setUi({
                    ...ui,
                    autoLockMinutes:
                      Number(
                        e.target
                          .value
                      ),
                  })
                }
                className={input}
              >
                <option value={1}>
                  بعد دقيقة
                </option>

                <option value={5}>
                  بعد 5 دقائق
                </option>

                <option value={15}>
                  بعد 15 دقيقة
                </option>

                <option value={30}>
                  بعد 30 دقيقة
                </option>

                <option value={60}>
                  بعد ساعة
                </option>
              </select>

              <p className="text-[9px] text-slate-600 mt-2">
                يتم حفظ هذا التفضيل ليُستخدم مع نظام قفل التطبيق
              </p>
            </div>
          </Card>
        </div>

        {/* اللغة والأداء */}
        <Card className="p-4 mb-4">
          <SectionTitle
            icon={Languages}
            title="اللغة والأداء"
            subtitle="تنسيق الواجهة وجودة الصور وسرعة التطبيق"
            color="#38bdf8"
          />

          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-bold text-slate-300 mb-2">
                اللغة
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setUi({
                      ...ui,
                      language:
                        'ar',
                    })
                  }
                  className="h-11 rounded-xl text-xs font-bold"
                  style={{
                    background:
                      ui.language ===
                      'ar'
                        ? 'rgba(56,189,248,.12)'
                        : 'rgba(255,255,255,.03)',
                    border:
                      ui.language ===
                      'ar'
                        ? '1px solid rgba(56,189,248,.30)'
                        : '1px solid rgba(255,255,255,.07)',
                    color:
                      ui.language ===
                      'ar'
                        ? '#38bdf8'
                        : '#94a3b8',
                  }}
                >
                  العربية
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setUi({
                      ...ui,
                      language:
                        'en',
                    })
                  }
                  className="h-11 rounded-xl text-xs font-bold"
                  style={{
                    background:
                      ui.language ===
                      'en'
                        ? 'rgba(56,189,248,.12)'
                        : 'rgba(255,255,255,.03)',
                    border:
                      ui.language ===
                      'en'
                        ? '1px solid rgba(56,189,248,.30)'
                        : '1px solid rgba(255,255,255,.07)',
                    color:
                      ui.language ===
                      'en'
                        ? '#38bdf8'
                        : '#94a3b8',
                  }}
                >
                  English
                </button>
              </div>
            </div>

            <Toggle
              value={
                ui.arabicNumbers
              }
              onChange={(v) =>
                setUi({
                  ...ui,
                  arabicNumbers: v,
                })
              }
              label="الأرقام العربية"
              desc="حفظ تفضيل عرض ١٢٣ بدل 123"
              icon={Languages}
              color="#38bdf8"
            />

            <div>
              <p className="text-[11px] font-bold text-slate-300 mb-2">
                جودة الصور
              </p>

              <select
                value={
                  ui.imageQuality
                }
                onChange={(e) =>
                  setUi({
                    ...ui,
                    imageQuality:
                      e.target
                        .value as ImageQuality,
                  })
                }
                className={input}
              >
                <option value="high">
                  عالية
                </option>

                <option value="balanced">
                  متوازنة
                </option>

                <option value="small">
                  حجم أصغر وأسرع
                </option>
              </select>

              <p className="text-[9px] text-slate-600 mt-2">
                الصور الجديدة يتم ضغطها تلقائيًا حسب هذا الاختيار
              </p>
            </div>

            <Toggle
              value={
                s.showOfflineBadge
              }
              onChange={(v) =>
                setS({
                  ...s,
                  showOfflineBadge:
                    v,
                })
              }
              label="وضع بدون إنترنت"
              desc="إظهار شارة عند العمل دون اتصال"
              icon={WifiOff}
              color="#94a3b8"
            />

            <Toggle
              value={
                s.printPhone
              }
              onChange={(v) =>
                setS({
                  ...s,
                  printPhone: v,
                })
              }
              label="إظهار الجوال في الطباعة"
              desc="إضافة رقم الجوال في التقارير والمستندات"
              icon={Printer}
              color="#f59e0b"
            />
          </div>
        </Card>

        {/* النسخ الاحتياطي */}
        <div ref={backupRef}>
          <Card className="p-4 mb-4">
            <SectionTitle
              icon={
                DatabaseBackup
              }
              title="النسخ الاحتياطي والبيانات"
              subtitle="حفظ بيانات التطبيق وتفضيلات الواجهة"
              color="#a855f7"
            />

            {lastBackupAt && (
              <div className="mb-3 rounded-xl bg-purple-500/5 border border-purple-500/10 px-3 py-2.5">
                <p className="text-[9px] text-slate-500">
                  آخر نسخة احتياطية
                </p>

                <p className="text-[10px] font-bold text-purple-300 mt-1">
                  {new Date(
                    lastBackupAt
                  ).toLocaleString(
                    'ar-SA'
                  )}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={exp}
                className="py-3 rounded-xl text-sm text-white flex items-center justify-center gap-2 active:scale-[0.98]"
                style={{
                  background:
                    'rgba(168,85,247,.10)',
                  border:
                    '1px solid rgba(168,85,247,.20)',
                }}
              >
                <Download className="w-4 h-4 text-purple-300" />
                نسخ الآن
              </button>

              <label
                className="py-3 rounded-xl text-sm text-white flex items-center justify-center gap-2 active:scale-[0.98]"
                style={{
                  background:
                    'rgba(59,130,246,.08)',
                  border:
                    '1px solid rgba(59,130,246,.18)',
                }}
              >
                <Upload className="w-4 h-4 text-blue-300" />
                استعادة

                <input
                  type="file"
                  accept=".json"
                  onChange={imp}
                  className="hidden"
                />
              </label>
            </div>

            <div
              className="mt-3 rounded-xl p-3 flex items-center gap-3"
              style={{
                background:
                  'rgba(255,255,255,.025)',
                border:
                  '1px solid rgba(255,255,255,.055)',
              }}
            >
              <HardDrive className="w-5 h-5 text-slate-500 shrink-0" />

              <div className="flex-1">
                <p className="text-[10px] font-bold text-slate-300">
                  النسخة تشمل
                </p>

                <p className="text-[9px] text-slate-600 mt-1">
                  البيانات + إعدادات الواجهة + اختصارات الإضافة + صورة الرئيسية
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* حفظ */}
        {msg && (
          <div className="mb-3 rounded-xl bg-green-500/10 border border-green-500/20 py-3 px-4 text-center">
            <p className="text-xs font-bold text-green-400">
              ✓ {msg}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full py-4 rounded-[16px] font-black flex items-center justify-center gap-2 active:scale-[0.99]"
          style={{
            background:
              `linear-gradient(145deg,${accent.color},#f59e0b)`,
            color: '#07101f',
            boxShadow:
              `0 12px 30px ${accent.glow}`,
          }}
        >
          <Save className="w-5 h-5" />

          {saving
            ? 'جاري الحفظ...'
            : 'حفظ جميع الإعدادات'}
        </button>

        <button
          type="button"
          onClick={() =>
            setS({
              ...DEFAULT_SETTINGS,
            })
          }
          className="w-full mt-3 py-3 rounded-xl text-xs text-slate-500 flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          استعادة إعدادات النشاط الافتراضية
        </button>

        <button
          type="button"
          onClick={resetUi}
          className="w-full mt-1 py-3 rounded-xl text-xs text-slate-600 flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          استعادة تخصيص الواجهة الافتراضي
        </button>

        {/* حول التطبيق */}
        <Card className="p-4 mt-4 mb-4">
          <SectionTitle
            icon={SettingsIcon}
            title="حول BAAKR PRO"
            subtitle="معلومات التطبيق"
            color="#f59e0b"
          />

          <div className="flex items-center justify-between rounded-xl bg-white/[0.025] border border-white/[0.055] px-3 py-3">
            <div>
              <p className="text-[11px] font-black text-white">
                BAAKR PRO
              </p>

              <p className="text-[9px] text-slate-600 mt-1">
                إدارة أعمال الكرينات والمعدات
              </p>
            </div>

            <div className="flex items-center gap-2 text-slate-500">
              <span className="text-[9px]">
                v2.1
              </span>

              <ChevronLeft className="w-4 h-4" />
            </div>
          </div>
        </Card>

        <div className="h-6" />
      </div>
    </AppLayout>
  );
}
