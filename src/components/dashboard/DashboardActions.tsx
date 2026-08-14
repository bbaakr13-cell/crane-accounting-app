import React from "react";
import QuickAction from "./QuickAction";

export default function DashboardActions() {
  return (
    <section className="dashboard-actions" dir="rtl">
      <QuickAction title="إضافة عملية" />
      <QuickAction title="العملاء" />
      <QuickAction title="المعدات" />
      <QuickAction title="الفواتير" />
      <QuickAction title="التقارير" />
      <QuickAction title="الديون" />
    </section>
  );
}
