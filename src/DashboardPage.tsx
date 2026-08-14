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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { QuickAction } from '@/components/dashboard/QuickAction';
import { TransactionItem, type Transaction } from '@/components/dashboard/TransactionItem';
import { Card } from '@/components/ui/Card';
import { formatSAR } from '@/lib/format';
import { fetchDashboardTotals, fetchAllTransactions, type DashboardTotals } from '@/lib/transactions';

export function DashboardPage() {
  const navigate = useNavigate();
  const [totals, setTotals] = useState<DashboardTotals>({ totalIncome: 0, totalExpenses: 0, netProfit: 0, receivables: 0 });
  const [recentTxs, setRecentTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [t, txs] = await Promise.all([fetchDashboardTotals(), fetchAllTransactions()]);
      setTotals(t);
      setRecentTxs(txs.slice(0, 5));
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppLayout>
      {/* Financial Summary */}
      <section className="grid grid-cols-2 gap-3">
        <StatCard label="إجمالي الدخل" amount={formatSAR(totals.totalIncome)} icon={TrendingUp} tone="income" delay={0} />
        <StatCard label="إجمالي المصروفات" amount={formatSAR(totals.totalExpenses)} icon={TrendingDown} tone="expense" delay={60} />
        <StatCard label="صافي الربح" amount={formatSAR(totals.netProfit)} icon={Wallet} tone="profit" delay={120} />
        <StatCard label="المستحقات" amount={formatSAR(totals.receivables)} icon={Clock} tone="receivable" delay={180} />
      </section>

      {/* Quick Actions */}
      <section className="mt-7">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white font-display">الاختصارات السريعة</h2>
        </div>
        <Card className="p-4">
          <div className="grid grid-cols-4 gap-y-4 gap-x-2">
            <QuickAction label="إضافة دخل" icon={ArrowDownLeft} to="/add?mode=job" tone="income" delay={0} />
            <QuickAction label="إضافة مصروف" icon={ArrowUpLeft} to="/add?mode=expense" tone="expense" delay={50} />
            <QuickAction label="العملاء" icon={Users} to="/customers" tone="profit" delay={100} />
            <QuickAction label="المعدات" icon={Truck} to="/equipment" tone="gold" delay={150} />
            <QuickAction label="الحساب الشهري" icon={CalendarClock} to="/monthly" tone="receivable" delay={200} />
            <QuickAction label="التقارير" icon={FileBarChart} to="/reports" tone="profit" delay={250} />
            <QuickAction label="الفواتير" icon={FileText} to="/invoices" tone="gold" delay={300} />
            <QuickAction label="حساب اليوم" icon={Calculator} to="/daily-calculator" tone="gold" delay={350} />
            <QuickAction label="الإعدادات" icon={Settings} to="/settings" tone="expense" delay={400} />
          </div>
        </Card>
      </section>

      {/* Recent Transactions */}
      <section className="mt-7">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white font-display">أحدث الحركات</h2>
          <button
            onClick={() => navigate('/transactions')}
            className="text-xs text-gold-400 font-medium active:scale-95 transition-transform"
          >
            عرض الكل
          </button>
        </div>

        {loading ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-slate-400">جاري التحميل...</p>
          </Card>
        ) : recentTxs.length === 0 ? (
          <Card className="p-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <Receipt className="w-8 h-8 text-slate-600" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-slate-400 mb-4">لا توجد حركات حتى الآن</p>
            <button
              onClick={() => navigate('/add')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-ink-950 font-semibold text-sm shadow-glow-gold active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              إضافة أول حركة
            </button>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {recentTxs.map((tx, i) => (
              <TransactionItem key={tx.data.id} tx={tx} delay={i * 50} />
            ))}
          </div>
        )}
      </section>
    </AppLayout>
  );
}
