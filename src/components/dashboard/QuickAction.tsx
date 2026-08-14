import {
  Plus,
  Users,
  Truck,
  FileText,
  FileBarChart,
  Receipt,
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
        to="/
