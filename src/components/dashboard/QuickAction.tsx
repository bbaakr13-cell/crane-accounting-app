import { type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuickActionProps {
  label: string;
  icon: LucideIcon;
  to: string;
  tone?: 'gold' | 'income' | 'expense' | 'profit' | 'receivable';
  delay?: number;
}

const toneMap = {
  gold: 'text-gold-400 bg-gold-500/10 group-hover:bg-gold-500/20 group-active:scale-90',
  income: 'text-income bg-income/10 group-hover:bg-income/20 group-active:scale-90',
  expense: 'text-expense bg-expense/10 group-hover:bg-expense/20 group-active:scale-90',
  profit: 'text-profit bg-profit/10 group-hover:bg-profit/20 group-active:scale-90',
  receivable: 'text-receivable bg-receivable/10 group-hover:bg-receivable/20 group-active:scale-90',
};

export function QuickAction({ label, icon: Icon, to, tone = 'gold', delay = 0 }: QuickActionProps) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      className="group flex flex-col items-center gap-2 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span
        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 ${toneMap[tone]}`}
      >
        <Icon className="w-6 h-6" strokeWidth={2} />
      </span>
      <span className="text-xs font-medium text-slate-300 text-center leading-tight">{label}</span>
    </button>
  );
}
