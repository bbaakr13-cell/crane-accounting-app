import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  ArrowDownLeft,
  ArrowUpLeft,
  Users,
  Truck,
  CalendarClock,
  FileBarChart,
  FileText,
  Plus,
  Receipt,
  Settings,
  Calculator,
  ShieldCheck,
  Image as ImageIcon,
  ChevronLeft,
  Bot,
  Sparkles,
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';

import {
  useState,
  useEffect,
  useCallback,
} from 'react';

import { AppLayout } from '@/components/layout/AppLayout';

import {
  TransactionItem,
  type Transaction,
} from '@/components/dashboard/TransactionItem';

import { formatSAR } from '@/lib/format';

import {
  fetchDashboardTotals,
  fetchAllTransactions,
  type DashboardTotals,
} from '@/lib/transactions';

const DASHBOARD_IMAGE_KEY =
  'baakr_pro_dashboard_image';

type ActionTone =
  | 'green'
  | 'red'
  | 'blue'
  | 'gold'
  | 'orange'
  | 'purple';

type ActionItem = {
  label: string;
  icon: any;
  path: string;
  tone: ActionTone;
};

const tones: Record<
  ActionTone,
  {
    background: string;
    color: string;
  }
> = {
  green: {
    background:
      'rgba(34,197,94,0.11)',
    color: '#4ade80',
  },

  red: {
    background:
      'rgba(239,68,68,0.11)',
    color: '#fb7185',
  },

  blue: {
    background:
      'rgba(59,130,246,0.12)',
    color: '#60a5fa',
  },

  gold: {
    background:
      'rgba(245,158,11,0.12)',
    color: '#fbbf24',
  },

  orange: {
    background:
      'rgba(249,115,22,0.12)',
    color: '#fb923c',
  },

  purple: {
    background:
      'rgba(168,85,247,0.12)',
    color: '#c084fc',
  },
};

export function DashboardPage() {
  const navigate = useNavigate();

  const [totals, setTotals] =
    useState<DashboardTotals>({
      totalIncome: 0,
      totalExpenses: 0,
      netProfit: 0,
      receivables: 0,
    });

  const [
    recentTxs,
    setRecentTxs,
  ] = useState<Transaction[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [
    heroImage,
    setHeroImage,
  ] = useState('');

  const load = useCallback(
    async () => {
      try {
        const [t, txs] =
          await Promise.all([
            fetchDashboardTotals(),
            fetchAllTransactions(),
          ]);

        setTotals(t);

        setRecentTxs(
          txs.slice(0, 5)
        );
      } catch (error) {
        console.error(
          'Dashboard load error:',
          error
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadHeroImage =
    useCallback(() => {
      try {
        const savedImage =
          localStorage.getItem(
            DASHBOARD_IMAGE_KEY
          ) || '';

        setHeroImage(
          savedImage
        );
      } catch (error) {
        console.error(
          'Dashboard image load error:',
          error
        );

        setHeroImage('');
      }
    }, []);

  useEffect(() => {
    load();
    loadHeroImage();

    const handleStorage =
      () => {
        loadHeroImage();
      };

    window.addEventListener(
      'storage',
      handleStorage
    );

    window.addEventListener(
      'focus',
      loadHeroImage
    );

    return () => {
      window.removeEventListener(
        'storage',
        handleStorage
      );

      window.removeEventListener(
        'focus',
        loadHeroImage
      );
    };
  }, [
    load,
    loadHeroImage,
  ]);

  const actions: ActionItem[] = [
    {
      label: 'BAAKR AI',
      icon: Bot,
      path: '/ai',
      tone: 'purple',
    },

    {
      label: 'إضافة دخل',
      icon: ArrowDownLeft,
      path: '/add',
      tone: 'green',
    },

    {
      label: 'إضافة مصروف',
      icon: ArrowUpLeft,
      path: '/add',
      tone: 'red',
    },

    {
      label: 'العملاء',
      icon: Users,
      path: '/customers',
      tone: 'blue',
    },

    {
      label: 'المعدات',
      icon: Truck,
      path: '/equipment',
      tone: 'gold',
    },

    {
      label: 'الحساب الشهري',
      icon: CalendarClock,
      path: '/monthly',
      tone: 'orange',
    },

    {
      label: 'التأجير الشهري',
      icon: CalendarClock,
      path: '/monthly-rental',
      tone: 'purple',
    },

    {
      label: 'السواقين والمشغلين',
      icon: Users,
      path: '/drivers',
      tone: 'gold',
    },

    {
      label: 'التقارير',
      icon: FileBarChart,
      path: '/reports',
      tone: 'blue',
    },

    {
      label: 'الفواتير',
      icon: FileText,
      path: '/invoices',
      tone: 'purple',
    },

    {
      label: 'عرض سعر',
      icon: FileText,
      path: '/quotation',
      tone: 'green',
    },

    {
      label: 'حساب اليوم',
      icon: Calculator,
      path: '/daily-calculator',
      tone: 'gold',
    },

    {
      label: 'الإعدادات',
      icon: Settings,
      path: '/settings',
      tone: 'red',
    },

    {
      label: 'النسخ الاحتياطي',
      icon: ShieldCheck,
      path: '/backup',
      tone: 'blue',
    },
  ];

  return (
    <AppLayout>
      <div
        dir="rtl"
        className="w-full"
      >

        {/* ========================= */}
        {/* الصورة الرئيسية */}
        {/* ========================= */}

        <section className="mb-5">
          <div
            className="relative overflow-hidden rounded-[25px] w-full"
            style={{
              aspectRatio:
                '16 / 7',

              border:
                '1px solid rgba(255,255,255,0.09)',

              boxShadow:
                '0 14px 35px rgba(0,0,0,0.28)',

              background:
                'linear-gradient(135deg,#15243b,#081321)',
            }}
          >
            {heroImage ? (
              <img
                src={heroImage}
                alt="صورة واجهة BAAKR PRO"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-end px-5"
                style={{
                  background:
                    'radial-gradient(circle at left, rgba(245,158,11,0.18), transparent 45%), linear-gradient(135deg,#17263b,#07111e)',
                }}
              >
                <Truck
                  className="w-24 h-24 text-amber-400/20"
                  strokeWidth={1}
                />
              </div>
            )}

            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(90deg, rgba(3,8,17,0.22) 0%, rgba(3,8,17,0.50) 48%, rgba(3,8,17,0.94) 100%)',
              }}
            />

            <div className="absolute inset-0 p-5 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold text-amber-400 tracking-[0.16em]">
                  BAAKR PRO
                </p>

                <h2 className="text-[21px] font-black text-white mt-1">
                  إدارة حسابات الكرينات
                </h2>

                <p className="text-[11px] text-slate-300 mt-1">
                  دقة • سرعة • احترافية
                </p>
              </div>

              <div className="flex items-end justify-between">
                <div className="flex gap-2">
                  <div className="px-2.5 py-1.5 rounded-xl bg-black/35 border border-white/10 text-[9px] text-slate-200">
                    🔒 آمن
                  </div>

                  <div className="px-2.5 py-1.5 rounded-xl bg-black/35 border border-white/10 text-[9px] text-slate-200">
                    ⚡ سريع
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      '/settings'
                    )
                  }
                  className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center active:scale-95"
                  aria-label="تغيير صورة الواجهة"
                >
                  <ImageIcon className="w-5 h-5 text-amber-400" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ========================= */}
        {/* BAAKR AI */}
        {/* ========================= */}

        <section className="mb-5">
          <button
            type="button"
            onClick={() =>
              navigate('/ai')
            }
            className="relative w-full overflow-hidden rounded-[22px] p-4 text-right active:scale-[0.98] transition-transform"
            style={{
              background:
                'linear-gradient(135deg, rgba(88,28,135,0.92), rgba(76,29,149,0.72), rgba(17,24,39,0.96))',

              border:
                '1px solid rgba(192,132,252,0.24)',

              boxShadow:
                '0 12px 30px rgba(88,28,135,0.20)',
            }}
          >
            <div
              className="absolute -left-8 -top-8 w-28 h-28 rounded-full"
              style={{
                background:
                  'rgba(168,85,247,0.16)',
                filter:
                  'blur(8px)',
              }}
            />

            <div className="relative flex items-center gap-3">
              <div
                className="w-14 h-14 shrink-0 rounded-[18px] flex items-center justify-center"
                style={{
                  background:
                    'linear-gradient(135deg,rgba(168,85,247,0.28),rgba(124,58,237,0.14))',

                  border:
                    '1px solid rgba(216,180,254,0.20)',
                }}
              >
                <Bot className="w-8 h-8 text-purple-300" />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-[16px] font-black text-white">
                    BAAKR AI
                  </h2>

                  <Sparkles className="w-4 h-4 text-purple-300" />
                </div>

                <p className="text-[11px] text-purple-100/80 mt-1">
                  مساعدك الذكي لإدارة الحسابات والكرينات
                </p>

                <p className="text-[9px] text-purple-200/60 mt-1">
                  اسأل عن الدخل • الأرباح • المستحقات • التقارير
                </p>
              </div>

              <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                <ChevronLeft className="w-5 h-5 text-purple-300" />
              </div>
            </div>
          </button>
        </section>

        {/* ========================= */}
        {/* الملخص المالي */}
        {/* ========================= */}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-black text-white">
              نظرة عامة
            </h2>

            <span className="text-[10px] text-slate-500">
              الحسابات الحالية
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MoneyCard
              label="إجمالي الدخل"
              value={formatSAR(
                totals.totalIncome
              )}
              icon={TrendingUp}
              color="#4ade80"
              bg="rgba(34,197,94,0.10)"
              border="rgba(34,197,94,0.17)"
              onClick={() =>
                navigate(
                  '/transactions'
                )
              }
            />

            <MoneyCard
              label="إجمالي المصروفات"
              value={formatSAR(
                totals.totalExpenses
              )}
              icon={
                TrendingDown
              }
              color="#fb7185"
              bg="rgba(239,68,68,0.10)"
              border="rgba(239,68,68,0.17)"
              onClick={() =>
                navigate(
                  '/transactions'
                )
              }
            />

            <MoneyCard
              label="صافي الربح"
              value={formatSAR(
                totals.netProfit
              )}
              icon={Wallet}
              color="#60a5fa"
              bg="rgba(59,130,246,0.10)"
              border="rgba(59,130,246,0.17)"
              onClick={() =>
                navigate(
                  '/reports'
                )
              }
            />

            <MoneyCard
              label="المستحقات"
              value={formatSAR(
                totals.receivables
              )}
              icon={Clock}
              color="#fb923c"
              bg="rgba(249,115,22,0.10)"
              border="rgba(249,115,22,0.17)"
              onClick={() =>
                navigate(
                  '/customers'
                )
              }
            />
          </div>
        </section>

        {/* ========================= */}
        {/* إضافة سريعة */}
        {/* ========================= */}

        <section className="mt-5">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                navigate('/add')
              }
              className="h-[57px] rounded-[18px] flex items-center justify-center gap-2 font-bold text-[13px] active:scale-[0.97] transition-transform"
              style={{
                background:
                  'linear-gradient(135deg,#15803d,#22c55e)',

                boxShadow:
                  '0 8px 20px rgba(34,197,94,0.14)',
              }}
            >
              <ArrowDownLeft className="w-5 h-5" />
              إضافة دخل
            </button>

            <button
              type="button"
              onClick={() =>
                navigate('/add')
              }
              className="h-[57px] rounded-[18px] flex items-center justify-center gap-2 font-bold text-[13px] active:scale-[0.97] transition-transform"
              style={{
                background:
                  'linear-gradient(135deg,#be123c,#ef4444)',

                boxShadow:
                  '0 8px 20px rgba(239,68,68,0.14)',
              }}
            >
              <ArrowUpLeft className="w-5 h-5" />
              إضافة مصروف
            </button>
          </div>
        </section>

        {/* ========================= */}
        {/* الاختصارات */}
        {/* ========================= */}

        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-black text-white">
              الاختصارات السريعة
            </h2>

            <span className="text-amber-400">
              ⚡
            </span>
          </div>

          <div
            className="rounded-[25px] p-3"
            style={{
              background:
                'linear-gradient(180deg, rgba(17,31,53,0.75), rgba(8,19,34,0.92))',

              border:
                '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <div className="grid grid-cols-3 gap-2">
              {actions
                .filter(
                  (item) =>
                    item.path !==
                    '/add'
                )
                .map(
                  (item) => {
                    const Icon =
                      item.icon;

                    const tone =
                      tones[
                        item.tone
                      ];

                    return (
                      <button
                        key={`${item.path}-${item.label}`}
                        type="button"
                        onClick={() =>
                          navigate(
                            item.path
                          )
                        }
                        className="min-h-[96px] rounded-[18px] flex flex-col items-center justify-center gap-2 px-1 active:scale-[0.96] transition-transform"
                        style={{
                          background:
                            item.path ===
                            '/ai'
                              ? 'linear-gradient(145deg,rgba(88,28,135,0.22),rgba(255,255,255,0.025))'
                              : 'rgba(255,255,255,0.025)',

                          border:
                            item.path ===
                            '/ai'
                              ? '1px solid rgba(192,132,252,0.16)'
                              : '1px solid rgba(255,255,255,0.045)',
                        }}
                      >
                        <div
                          className="w-11 h-11 rounded-[15px] flex items-center justify-center"
                          style={{
                            background:
                              tone.background,
                          }}
                        >
                          <Icon
                            className="w-5 h-5"
                            style={{
                              color:
                                tone.color,
                            }}
                            strokeWidth={
                              2
                            }
                          />
                        </div>

                        <span className="text-[10px] leading-[15px] font-bold text-slate-200 text-center">
                          {
                            item.label
                          }
                        </span>
                      </button>
                    );
                  }
                )}
            </div>
          </div>
        </section>

        {/* ========================= */}
        {/* أحدث الحركات */}
        {/* ========================= */}

        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-black text-white">
              أحدث الحركات
            </h2>

            <button
              type="button"
              onClick={() =>
                navigate(
                  '/transactions'
                )
              }
              className="flex items-center gap-1 text-[11px] font-bold text-amber-400"
            >
              عرض الكل

              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div
              className="rounded-[22px] p-7 text-center"
              style={{
                background:
                  'rgba(255,255,255,0.025)',

                border:
                  '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="w-9 h-9 mx-auto rounded-full border-2 border-white/10 border-t-amber-400 animate-spin" />

              <p className="text-[11px] text-slate-500 mt-3">
                جاري التحميل...
              </p>
            </div>
          ) : recentTxs.length ===
            0 ? (
            <div
              className="rounded-[24px] p-7 text-center"
              style={{
                background:
                  'rgba(255,255,255,0.025)',

                border:
                  '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="w-14 h-14 rounded-[18px] bg-amber-500/10 flex items-center justify-center mx-auto">
                <Receipt className="w-7 h-7 text-amber-400" />
              </div>

              <p className="text-sm font-bold text-white mt-4">
                لا توجد حركات حتى الآن
              </p>

              <p className="text-[11px] text-slate-500 mt-1">
                ابدأ بإضافة أول حركة مالية
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    '/add'
                  )
                }
                className="mt-4 px-5 py-2.5 rounded-xl font-bold text-[12px] text-slate-950 bg-gradient-to-br from-amber-400 to-orange-500 inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />

                إضافة حركة
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentTxs.map(
                (tx, i) => (
                  <TransactionItem
                    key={
                      tx.data.id
                    }
                    tx={tx}
                    delay={
                      i * 50
                    }
                  />
                )
              )}
            </div>
          )}
        </section>

        <div className="h-4" />
      </div>
    </AppLayout>
  );
}

type MoneyCardProps = {
  label: string;
  value: string;
  icon: any;
  color: string;
  bg: string;
  border: string;
  onClick: () => void;
};

function MoneyCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
  border,
  onClick,
}: MoneyCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[116px] rounded-[22px] p-3.5 text-right active:scale-[0.98] transition-transform"
      style={{
        background:
          'linear-gradient(145deg, rgba(13,27,47,0.94), rgba(7,17,31,0.98))',

        border: `1px solid ${border}`,

        boxShadow:
          '0 10px 25px rgba(0,0,0,0.18)',
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] text-slate-400">
            {label}
          </p>
        </div>

        <div
          className="w-10 h-10 rounded-[14px] flex items-center justify-center"
          style={{
            background:
              bg,
          }}
        >
          <Icon
            className="w-5 h-5"
            style={{
              color,
            }}
            strokeWidth={2.1}
          />
        </div>
      </div>

      <p
        className="text-[15px] font-black mt-4 leading-tight"
        style={{
          color,
        }}
      >
        {value}
      </p>
    </button>
  );
}
