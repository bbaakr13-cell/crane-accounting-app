import React from "react";
import StatCard from "./StatCard";

export default function DashboardStats() {
  return (
    <section className="dashboard-stats" dir="rtl">
      <StatCard
        title="الإيرادات"
        value="0 ر.س"
      />

      <StatCard
        title="المصروفات"
        value="0 ر.س"
      />

      <StatCard
        title="الرصيد"
        value="0 ر.س"
      />

      <StatCard
        title="الديون"
        value="0 ر.س"
      />
    </section>
  );
}
