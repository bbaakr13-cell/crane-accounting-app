import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';

export interface Transaction {
  id: string;
  date: string;
  customer: string;
  equipment: string;
  type: 'income' | 'expense';
  amount: number;
}

interface TransactionItemProps {
  tx: Transaction;
  delay?: number;
}

export function TransactionItem({ tx, delay = 0 }: TransactionItemProps) {
  const isIncome = tx.type === 'income';
  return (
    <Card className="p-3.5 animate-slide-up">
      <div className="flex items-center gap-3" style={{ animationDelay: `${delay}ms` }}>
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isIncome ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'
          }`}
        >
          {isIncome ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-sm text-slate-100 truncate">{tx.customer}</p>
            <p
              className={`font-bold text-sm tabular-nums flex-shrink-0 ${
                isIncome ? 'text-income' : 'text-expense'
              }`}
            >
              {isIncome ? '+' : '−'}
              {formatSigned(tx.amount)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400">
            <span className="truncate">{tx.equipment}</span>
            <span className="text-slate-600">•</span>
            <span className="flex-shrink-0">{tx.date}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function formatSigned(amount: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount) + ' ر.س';
}
