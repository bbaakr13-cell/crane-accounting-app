import React from "react";
import DashboardHeader from "./DashboardHeader";
import QuickAction from "./QuickAction";
import StatCard from "./StatCard";
import TransactionItem from "./TransactionItem";

export default function Dashboard() {
  return (
    <main className="dashboard" dir="rtl">
      <DashboardHeader />

      <section className="dashboard-stats">
        <StatCard title="الإيرادات" value="0 ر.س" />
        <StatCard title="المصروفات" value="0 ر.س" />
        <StatCard title="الرصيد" value="0 ر.س" />
      </section>

      <section className="dashboard-actions">
        <QuickAction title="إضافة عملية" />
        <QuickAction title="العملاء" />
        <QuickAction title="المعدات" />
        <QuickAction title="التقارير" />
      </section>

      <section className="dashboard-transactions">
        <h2>آخر العمليات</h2>
        <TransactionItem />
      </section>
    </main>
  );
}
