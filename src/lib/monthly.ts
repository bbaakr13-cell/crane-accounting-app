import { supabase } from '@/lib/supabase';

export type DayStatus = 'worked' | 'idle' | 'maintenance' | 'holiday';

export const dayStatusLabels: Record<DayStatus, string> = {
  worked: 'اشتغل',
  idle: 'لم يشتغل',
  maintenance: 'عطل / صيانة',
  holiday: 'إجازة',
};

export const dayStatusStyles: Record<DayStatus, { text: string; bg: string; dot: string }> = {
  worked: { text: 'text-income', bg: 'bg-income/10', dot: 'bg-income' },
  idle: { text: 'text-slate-400', bg: 'bg-white/5', dot: 'bg-slate-500' },
  maintenance: { text: 'text-expense', bg: 'bg-expense/10', dot: 'bg-expense' },
  holiday: { text: 'text-gold-400', bg: 'bg-gold-500/10', dot: 'bg-gold-400' },
};

export interface MonthlyDay {
  id: string;
  equipmentId: string;
  date: string;
  dayStatus: DayStatus;
  jobType: string;
  customerId: string | null;
  customerName: string;
  location: string;
  workAmount: number;
  paidAmount: number;
  remainingAmount: number;
  expenseAmount: number;
  notes: string;
}

export interface MonthlyDayInput {
  dayStatus: DayStatus;
  jobType: string;
  customerId: string | null;
  customerName: string;
  location: string;
  workAmount: number;
  paidAmount: number;
  expenseAmount: number;
  notes: string;
}

function mapDay(r: any): MonthlyDay {
  return {
    id: r.id, equipmentId: r.equipment_id, date: r.date, dayStatus: r.day_status as DayStatus,
    jobType: r.job_type ?? '', customerId: r.customer_id, customerName: r.customer_name ?? '',
    location: r.location ?? '', workAmount: Number(r.work_amount), paidAmount: Number(r.paid_amount),
    remainingAmount: Number(r.remaining_amount), expenseAmount: Number(r.expense_amount), notes: r.notes ?? '',
  };
}

export async function fetchMonthlyDays(equipmentId: string, year: number, month: number): Promise<MonthlyDay[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const { data, error } = await supabase
    .from('monthly_equipment_days')
    .select('*')
    .eq('equipment_id', equipmentId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapDay);
}

export async function upsertMonthlyDay(equipmentId: string, date: string, input: MonthlyDayInput): Promise<void> {
  const remaining = input.workAmount - input.paidAmount;
  const { error } = await supabase.from('monthly_equipment_days').upsert({
    equipment_id: equipmentId,
    date,
    day_status: input.dayStatus,
    job_type: input.jobType,
    customer_id: input.customerId,
    customer_name: input.customerName,
    location: input.location,
    work_amount: input.workAmount,
    paid_amount: input.paidAmount,
    remaining_amount: remaining,
    expense_amount: input.expenseAmount,
    notes: input.notes,
  }, { onConflict: 'equipment_id,date' });
  if (error) throw error;
}

export async function deleteMonthlyDay(id: string): Promise<void> {
  const { error } = await supabase.from('monthly_equipment_days').delete().eq('id', id);
  if (error) throw error;
}

export interface MonthlySummary {
  totalDays: number;
  workDays: number;
  idleDays: number;
  maintenanceDays: number;
  holidayDays: number;
  totalWorkAmount: number;
  totalPaid: number;
  totalRemaining: number;
  totalExpenses: number;
  netMonth: number;
}

export function calcMonthlySummary(days: MonthlyDay[]): MonthlySummary {
  const totalDays = days.length;
  const workDays = days.filter(d => d.dayStatus === 'worked').length;
  const idleDays = days.filter(d => d.dayStatus === 'idle').length;
  const maintenanceDays = days.filter(d => d.dayStatus === 'maintenance').length;
  const holidayDays = days.filter(d => d.dayStatus === 'holiday').length;
  const totalWorkAmount = days.reduce((s, d) => s + d.workAmount, 0);
  const totalPaid = days.reduce((s, d) => s + d.paidAmount, 0);
  const totalRemaining = days.reduce((s, d) => s + d.remainingAmount, 0);
  const totalExpenses = days.reduce((s, d) => s + d.expenseAmount, 0);
  return {
    totalDays, workDays, idleDays, maintenanceDays, holidayDays,
    totalWorkAmount, totalPaid, totalRemaining, totalExpenses,
    netMonth: totalWorkAmount - totalExpenses,
  };
}

export const arabicMonths = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export const arabicWeekdays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function getArabicWeekday(date: Date): string {
  return arabicWeekdays[date.getDay()];
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
