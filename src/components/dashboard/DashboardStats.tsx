import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
} from "lucide-react";

import { StatCard } from "./StatCard";

export default function DashboardStats() {
  return (
    <section
      className="grid grid-cols-2 gap-3"
      dir="rtl"
    >
      <StatCard
        label="إجمالي الدخل"
        amount="0 ر.س"
        icon={TrendingUp}
        tone="income"
      />

      <StatCard
        label="إجمالي المصروفات"
        amount="0 ر.س"
        icon={TrendingDown}
        tone="expense"
      />

      <StatCard
        label="صافي الربح"
        amount="0 ر.س"
        icon={Wallet}
        tone="profit"
      />

      <StatCard
        label="المستحقات"
        amount="0 ر.س"
        icon={Clock}
        tone="receivable"
      />
    </section>
  );
}
