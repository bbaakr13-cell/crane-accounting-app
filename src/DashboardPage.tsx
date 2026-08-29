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
  ChevronLeft,
  Sparkles,
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';

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

const toneClasses: Record<
  ActionTone,
  {
    box: string;
    icon: string;
  }
> = {
  green: {
    box: 'bg-emerald-500/10 border-emerald-400/10',
    icon: 'text-emerald-400',
  },

  red: {
    box: 'bg-rose-500/10 border-rose-400/10',
    icon: 'text-rose-400',
  },

  blue: {
    box: 'bg-blue-500/10 border-blue-400/10',
    icon: 'text-blue-400',
  },

  gold: {
    box: 'bg-amber-500/10 border-amber-400/10',
    icon: 'text-amber-400',
  },

  orange: {
    box: 'bg-orange-500/10 border-orange-400/10',
    icon: 'text-orange-400',
  },

  purple: {
    box: 'bg-violet-500/10 border-violet-400/10',
    icon: 'text-violet-400',
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

  const [recentTxs, setRecentTxs] =
    useState<Transaction[]>([]);

  const [loading, setLoading] =
    useState(true);

  const load = useCallback(async () => {
    try {
      const [t, txs] = await Promise.all([
        fetchDashboardTotals(),
        fetchAllTransactions(),
      ]);

      setTotals(t);
      setRecentTxs(txs.slice(0, 5));
    } catch (error) {
      console.error(
        'Dashboard loading error:',
        error
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const actions: ActionItem[] = [
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
      tone: 'orange',
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
        className="w-full max-w-lg mx-auto pt-4"
      >

        {/* ===================== */}
        {/* الهوية */}
        {/* ===================== */}

        <section className="mb-5">
          <div
            className="
              relative overflow-hidden
              rounded-[28px]
              border border-white/10
              bg-gradient-to-br
              from-[#101d32]
              via-[#0b1728]
              to-[#07101f]
              p-5
              shadow-2xl
            "
          >
            {/* إضاءة خلفية */}

            <div className="absolute -top-16 -left-16 w-44 h-44 rounded-full bg-amber-500/10 blur-3xl" />

            <div className="absolute -bottom-20 -right-14 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl" />

            <div className="relative">

              <div className="flex items-center justify-between">

                <div>
                  <div className="flex items-center gap-2">

                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                      <Truck className="w-5 h-5 text-[#07101f]" />
                    </div>

                    <div>
                      <h1 className="text-xl font-black text-white tracking-wide">
                        BAAKR PRO
                      </h1>

                      <p className="text-[10px] text-slate-400">
                        CRANE MANAGEMENT
                      </p>
                    </div>

                  </div>
                </div>

                <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/20">
                  <div className="flex items-center gap-1.5">

                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40 animate-ping" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </span>

                    <span className="text-[10px] font-bold text-emerald-400">
                      النظام جاهز
                    </span>

                  </div>
                </div>

              </div>

              <div className="mt-5">
                <p className="text-xs text-slate-400">
                  لوحة إدارة الأعمال
                </p>

                <h2 className="text-lg font-bold text-white mt-1">
                  إدارة حسابات الكرينات
                </h2>

                <p className="text-xs text-slate-500 mt-1">
                  تابع الدخل والمصروفات والأعمال من مكان واحد
                </p>
              </div>

              {/* خط ديكوري */}

              <div className="mt-5 h-[1px] bg-gradient-to-l from-transparent via-white/10 to-transparent" />

              <div className="mt-4 flex items-center justify-between">

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  نظام إدارة احترافي
                </div>

                <div className="text-[10px] text-slate-500">
                  BAAKR PRO
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* ===================== */}
        {/* الملخص المالي */}
        {/* ===================== */}

        <section>
          <div className="flex items-center justify-between mb-3">

            <div>
              <p className="text-[10px] text-slate-500">
                نظرة سريعة
              </p>

              <h2 className="text-base font-bold text-white">
                الملخص المالي
              </h2>
            </div>

            <Wallet className="w-5 h-5 text-amber-400" />

          </div>

          <div className="grid grid-cols-2 gap-3">

            {/* الدخل */}

            <button
              type="button"
              onClick={() => navigate('/transactions')}
              className="
                relative overflow-hidden
                min-h-[125px]
                rounded-[24px]
                border border-emerald-400/10
                bg-gradient-to-br
                from-emerald-500/[0.12]
                to-white/[0.03]
                p-4 text-right
                active:scale-[0.98]
                transition-transform
              "
            >
              <div className="flex items-start justify-between">

                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>

                <span className="text-[9px] text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-1">
                  الدخل
                </span>

              </div>

              <p className="text-[11px] text-slate-400 mt-4">
                إجمالي الدخل
              </p>

              <p className="text-[15px] font-black text-white mt-1 leading-tight">
                {formatSAR(totals.totalIncome)}
              </p>
            </button>

            {/* المصروفات */}

            <button
              type="button"
              onClick={() => navigate('/transactions')}
              className="
                relative overflow-hidden
                min-h-[125px]
                rounded-[24px]
                border border-rose-400/10
                bg-gradient-to-br
                from-rose-500/[0.12]
                to-white/[0.03]
                p-4 text-right
                active:scale-[0.98]
                transition-transform
              "
            >
              <div className="flex items-start justify-between">

                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-rose-400" />
                </div>

                <span className="text-[9px] text-rose-400 bg-rose-500/10 rounded-full px-2 py-1">
                  مصروف
                </span>

              </div>

              <p className="text-[11px] text-slate-400 mt-4">
                إجمالي المصروفات
              </p>

              <p className="text-[15px] font-black text-white mt-1 leading-tight">
                {formatSAR(totals.totalExpenses)}
              </p>
            </button>

            {/* الربح */}

            <button
              type="button"
              onClick={() => navigate('/reports')}
              className="
                relative overflow-hidden
                min-h-[125px]
                rounded-[24px]
                border border-blue-400/10
                bg-gradient-to-br
                from-blue-500/[0.12]
                to-white/[0.03]
                p-4 text-right
                active:scale-[0.98]
                transition-transform
              "
            >
              <div className="flex items-start justify-between">

                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-blue-400" />
                </div>

                <span className="text-[9px] text-blue-400 bg-blue-500/10 rounded-full px-2 py-1">
                  الأرباح
                </span>

              </div>

              <p className="text-[11px] text-slate-400 mt-4">
                صافي الربح
              </p>

              <p className="text-[15px] font-black text-white mt-1 leading-tight">
                {formatSAR(totals.netProfit)}
              </p>
            </button>

            {/* المستحقات */}

            <button
              type="button"
              onClick={() => navigate('/customers')}
              className="
                relative overflow-hidden
                min-h-[125px]
                rounded-[24px]
                border border-amber-400/10
                bg-gradient-to-br
                from-amber-500/[0.12]
                to-white/[0.03]
                p-4 text-right
                active:scale-[0.98]
                transition-transform
              "
            >
              <div className="flex items-start justify-between">

                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>

                <span className="text-[9px] text-amber-400 bg-amber-500/10 rounded-full px-2 py-1">
                  مستحق
                </span>

              </div>

              <p className="text-[11px] text-slate-400 mt-4">
                المستحقات
              </p>

              <p className="text-[15px] font-black text-white mt-1 leading-tight">
                {formatSAR(totals.receivables)}
              </p>
            </button>

          </div>
        </section>

        {/* ===================== */}
        {/* إضافة سريعة */}
        {/* ===================== */}

        <section className="mt-6">

          <div
            className="
              rounded-[26px]
              border border-white/10
              bg-white/[0.035]
              p-3
            "
          >
            <div className="grid grid-cols-2 gap-3">

              <button
                type="button"
                onClick={() => navigate('/add')}
                className="
                  min-h-[64px]
                  rounded-2xl
                  bg-gradient-to-br
                  from-emerald-500
                  to-emerald-700
                  flex items-center
                  justify-center
                  gap-2
                  text-white
                  font-bold
                  text-sm
                  shadow-lg
                  active:scale-[0.97]
                  transition-transform
                "
              >
                <ArrowDownLeft className="w-5 h-5" />
                إضافة دخل
              </button>

              <button
                type="button"
                onClick={() => navigate('/add')}
                className="
                  min-h-[64px]
                  rounded-2xl
                  bg-gradient-to-br
                  from-rose-500
                  to-rose-700
                  flex items-center
                  justify-center
                  gap-2
                  text-white
                  font-bold
                  text-sm
                  shadow-lg
                  active:scale-[0.97]
                  transition-transform
                "
              >
                <ArrowUpLeft className="w-5 h-5" />
                إضافة مصروف
              </button>

            </div>
          </div>
        </section>

        {/* ===================== */}
        {/* الخدمات */}
        {/* ===================== */}

        <section className="mt-7">

          <div className="flex items-center justify-between mb-4">

            <div>
              <p className="text-[10px] text-slate-500">
                وصول سريع
              </p>

              <h2 className="text-base font-bold text-white">
                إدارة الأعمال
              </h2>
            </div>

            <span className="text-[10px] text-amber-400">
              BAAKR PRO
            </span>

          </div>

          <div
            className="
              rounded-[28px]
              border border-white/[0.08]
              bg-gradient-to-b
              from-white/[0.045]
              to-white/[0.02]
              p-3
            "
          >

            <div className="grid grid-cols-3 gap-2">

              {actions
                .filter(
                  (item) =>
                    item.path !== '/add'
                )
                .map((item) => {
                  const Icon = item.icon;
                  const tone =
                    toneClasses[item.tone];

                  return (
                    <button
                      key={`${item.path}-${item.label}`}
                      type="button"
                      onClick={() =>
                        navigate(item.path)
                      }
                      className="
                        min-h-[108px]
                        rounded-[20px]
                        border border-white/[0.05]
                        bg-[#0b1627]/70
                        flex flex-col
                        items-center
                        justify-center
                        gap-2.5
                        px-1
                        active:scale-[0.96]
                        transition-transform
                      "
                    >
                      <div
                        className={`
                          w-12 h-12
                          rounded-[17px]
                          border
                          flex items-center
                          justify-center
                          ${tone.box}
                        `}
                      >
                        <Icon
                          className={`w-6 h-6 ${tone.icon}`}
                          strokeWidth={1.8}
                        />
                      </div>

                      <span className="text-[11px] leading-4 font-semibold text-slate-200 text-center">
                        {item.label}
                      </span>

                    </button>
                  );
                })}

            </div>
          </div>
        </section>

        {/* ===================== */}
        {/* أحدث الحركات */}
        {/* ===================== */}

        <section className="mt-7">

          <div className="flex items-center justify-between mb-4">

            <div>
              <p className="text-[10px] text-slate-500">
                آخر العمليات
              </p>

              <h2 className="text-base font-bold text-white">
                أحدث الحركات
              </h2>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate('/transactions')
              }
              className="
                flex items-center gap-1
                px-3 py-2
                rounded-xl
                bg-amber-500/10
                border border-amber-400/10
                text-xs text-amber-400
                font-bold
                active:scale-95
                transition-transform
              "
            >
              عرض الكل
              <ChevronLeft className="w-4 h-4" />
            </button>

          </div>

          {loading ? (
            <div
              className="
                rounded-[24px]
                border border-white/[0.07]
                bg-white/[0.03]
                p-8
                text-center
              "
            >
              <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-amber-400 animate-spin mx-auto" />

              <p className="text-xs text-slate-400 mt-4">
                جاري تحميل البيانات...
              </p>
            </div>
          ) : recentTxs.length === 0 ? (
            <div
              className="
                rounded-[26px]
                border border-white/[0.07]
                bg-gradient-to-b
                from-white/[0.04]
                to-white/[0.02]
                p-7
                text-center
              "
            >

              <div
                className="
                  w-16 h-16
                  mx-auto
                  rounded-[22px]
                  bg-amber-500/10
                  border border-amber-400/10
                  flex items-center
                  justify-center
                "
              >
                <Receipt
                  className="w-8 h-8 text-amber-400"
                  strokeWidth={1.5}
                />
              </div>

              <h3 className="text-sm font-bold text-white mt-4">
                لا توجد حركات حتى الآن
              </h3>

              <p className="text-[11px] text-slate-500 mt-1">
                ابدأ بإضافة أول عملية مالية
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate('/add')
                }
                className="
                  mt-5
                  mx-auto
                  px-5 py-3
                  rounded-2xl
                  bg-gradient-to-br
                  from-amber-400
                  to-orange-500
                  text-[#07101f]
                  font-black
                  text-sm
                  flex items-center
                  justify-center
                  gap-2
                  active:scale-95
                  transition-transform
                "
              >
                <Plus className="w-5 h-5" />
                إضافة أول حركة
              </button>

            </div>
          ) : (
            <div className="space-y-2.5">

              {recentTxs.map(
                (tx, index) => (
                  <TransactionItem
                    key={tx.data.id}
                    tx={tx}
                    delay={index * 50}
                  />
                )
              )}

            </div>
          )}

        </section>

        {/* ===================== */}
        {/* نهاية الصفحة */}
        {/* ===================== */}

        <div className="mt-8 mb-3 text-center">

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.025] border border-white/[0.05]">

            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />

            <span className="text-[9px] text-slate-500">
              BAAKR PRO • نظام إدارة حسابات الكرينات
            </span>

          </div>

        </div>

      </div>
    </AppLayout>
  );
            }
