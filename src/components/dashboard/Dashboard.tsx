import React from "react";
import DashboardHeader from "./DashboardHeader";
import DashboardStats from "./DashboardStats";
import DashboardActions from "./DashboardActions";
import TransactionItem from "./TransactionItem";

export default function Dashboard() {
  return (
    <main className="dashboard" dir="rtl">
      <DashboardHeader />

      <DashboardStats />

      <DashboardActions />

      <section className="dashboard-transactions">
        <h2>آخر العمليات</h2>
        <TransactionItem />
      </section>
    </main>
  );
}
