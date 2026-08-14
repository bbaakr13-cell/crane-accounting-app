import { type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';

type Tone = 'income' | 'expense' | 'profit' | 'receivable';

const toneStyles: Record<Tone, { text: string; bg: string; ring: string; icon: string }> = {
  income: {
    text: 'text-income',
    bg: 'bg-income-soft/60',
    ring: 'ring-income/20',
    icon: 'bg-income/10 text-income',
  },
  expense: {
    text: 'text-expense',
    bg: 'bg-expense-soft/60',
    ring: 'ring-expense/20',
    icon: 'bg-expense/10 text-expense',
  },
  profit: {
    text: 'text-profit',
    bg: 'bg-profit-soft/60',
    ring: 'ring-profit/20',
    icon: 'bg-profit/10 text-profit',
  },
  receivable: {
    text: 'text-receivable',
    bg: 'bg-receivable-soft/60',
    ring: 'ring-receivable/20',
    icon: 'bg-receivable/10 text-receivable',
  },
};

interface StatCardProps {
  label: string;
  amount: string;
  icon: LucideIcon;
  tone: Tone;
  trend?: string;
  delay?: number;
}

export function StatCard({ label, amount, icon: Icon, tone, trend, delay = 0 }: StatCardProps) {
  const styles = toneStyles[tone];
  return (
    <Card
      className={`p-4 animate-slide-up ring-1 ${styles.ring} relative overflow-hidden`}
    >
      <div
        className="absolute -top-6 -left-6 w-24 h-24 rounded-full blur-2xl opacity-20"
        style={{ animationDelay: `${delay}ms` }}
      />
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${styles.icon}`}>
          <Icon className="w-5 h-5" strokeWidth={2.2} />
        </div>
        {trend && (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${styles.bg} ${styles.text}`}>
            {trend}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-400 mb-1 font-medium">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${styles.text}`} style={{ animationDelay: `${delay}ms` }}>
        {amount}
      </p>
    </Card>
  );
}
