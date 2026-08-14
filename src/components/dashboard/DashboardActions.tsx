import {
  Plus,
  Users,
  Truck,
  Receipt,
  FileBarChart,
  CalendarClock,
} from "lucide-react";

import { QuickAction } from "./QuickAction";

export default function DashboardActions() {
  return (
    <section className="grid grid-cols-3 gap-3" dir="rtl">
      <QuickAction
        label="إضافة عملية"
        icon={Plus}
        to="/add"
        tone="gold"
      />

      <QuickAction
        label="العملاء"
        icon={Users}
        to="/customers"
        tone="income"
      />

      <QuickAction
        label="المعدات"
        icon={Truck}
        to="/equipment"
        tone="profit"
      />

      <QuickAction
        label="الفواتير"
        icon={Receipt}
        to="/invoices"
        tone="receivable"
      />

      <QuickAction
        label="التقارير"
        icon={FileBarChart}
        to="/reports"
        tone="gold"
      />

      <QuickAction
        label="الحساب الشهري"
        icon={CalendarClock}
        to="/monthly"
        tone="income"
      />
    </section>
  );
}
