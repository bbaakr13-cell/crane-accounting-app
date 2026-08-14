import { supabase } from '@/lib/supabase';

export type PaymentStatus = 'paid' | 'partial' | 'credit' | 'unpaid';

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  paid: 'مدفوع بالكامل',
  partial: 'مدفوع جزئيًا',
  credit: 'على الحساب',
  unpaid: 'غير مدفوع',
};

export const paymentStatusStyles: Record<PaymentStatus, { text: string; bg: string; dot: string }> = {
  paid: { text: 'text-income', bg: 'bg-income/10', dot: 'bg-income' },
  partial: { text: 'text-gold-400', bg: 'bg-gold-500/10', dot: 'bg-gold-400' },
  credit: { text: 'text-receivable', bg: 'bg-receivable/10', dot: 'bg-receivable' },
  unpaid: { text: 'text-expense', bg: 'bg-expense/10', dot: 'bg-expense' },
};

export const paymentMethods = ['كاش', 'تحويل بنكي', 'آيبان', 'شيك', 'بطاقة', 'أخرى'];

export const expenseTypes = [
  'ديزل', 'وقود', 'صيانة', 'زيت', 'قطع غيار', 'إطارات',
  'راتب سائق', 'نقل', 'إصلاح', 'رسوم', 'مصروف آخر',
];

export interface Job {
  id: string;
  date: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  equipmentId: string | null;
  equipmentName: string;
  jobType: string;
  location: string;
  description: string;
  workAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  notes: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  date: string;
  equipmentId: string | null;
  equipmentName: string;
  expenseType: string;
  amount: number;
  notes: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  jobId: string;
  customerId: string | null;
  amount: number;
  paymentMethod: string;
  date: string;
  notes: string;
  createdAt: string;
}

export type Transaction = { kind: 'job'; data: Job } | { kind: 'expense'; data: Expense };

function mapJob(r: any): Job {
  return {
    id: r.id, date: r.date, customerId: r.customer_id, customerName: r.customer_name,
    customerPhone: r.customer_phone ?? '', equipmentId: r.equipment_id, equipmentName: r.equipment_name ?? '',
    jobType: r.job_type, location: r.location ?? '', description: r.description ?? '',
    workAmount: Number(r.work_amount), paidAmount: Number(r.paid_amount),
    remainingAmount: Number(r.remaining_amount), paymentStatus: r.payment_status as PaymentStatus,
    paymentMethod: r.payment_method ?? '', notes: r.notes ?? '', createdAt: r.created_at ?? '',
  };
}

function mapExpense(r: any): Expense {
  return {
    id: r.id, date: r.date, equipmentId: r.equipment_id, equipmentName: r.equipment_name ?? '',
    expenseType: r.expense_type, amount: Number(r.amount), notes: r.notes ?? '', createdAt: r.created_at ?? '',
  };
}

function mapPayment(r: any): Payment {
  return {
    id: r.id, jobId: r.job_id, customerId: r.customer_id, amount: Number(r.amount),
    paymentMethod: r.payment_method ?? '', date: r.date, notes: r.notes ?? '', createdAt: r.created_at ?? '',
  };
}

export function calcPaymentStatus(workAmount: number, paidAmount: number): PaymentStatus {
  if (paidAmount >= workAmount && workAmount > 0) return 'paid';
  if (paidAmount > 0) return 'partial';
  return 'unpaid';
}

export interface JobInput {
  date: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  equipmentId: string | null;
  equipmentName: string;
  jobType: string;
  location: string;
  description: string;
  workAmount: number;
  paidAmount: number;
  paymentMethod: string;
  notes: string;
}

export async function createJob(input: JobInput): Promise<Job> {
  const remaining = input.workAmount - input.paidAmount;
  const status = calcPaymentStatus(input.workAmount, input.paidAmount);
  const { data, error } = await supabase.from('jobs').insert({
    date: input.date, customer_id: input.customerId, customer_name: input.customerName,
    customer_phone: input.customerPhone, equipment_id: input.equipmentId, equipment_name: input.equipmentName,
    job_type: input.jobType, location: input.location, description: input.description,
    work_amount: input.workAmount, paid_amount: input.paidAmount, remaining_amount: remaining,
    payment_status: status, payment_method: input.paymentMethod, notes: input.notes,
  }).select('*').single();
  if (error) throw error;
  return mapJob(data);
}

export async function updateJob(id: string, input: Partial<JobInput>): Promise<void> {
  const update: Record<string, any> = {};
  if (input.date !== undefined) update.date = input.date;
  if (input.customerId !== undefined) update.customer_id = input.customerId;
  if (input.customerName !== undefined) update.customer_name = input.customerName;
  if (input.customerPhone !== undefined) update.customer_phone = input.customerPhone;
  if (input.equipmentId !== undefined) update.equipment_id = input.equipmentId;
  if (input.equipmentName !== undefined) update.equipment_name = input.equipmentName;
  if (input.jobType !== undefined) update.job_type = input.jobType;
  if (input.location !== undefined) update.location = input.location;
  if (input.description !== undefined) update.description = input.description;
  if (input.workAmount !== undefined) update.work_amount = input.workAmount;
  if (input.paidAmount !== undefined) update.paid_amount = input.paidAmount;
  if (input.paymentMethod !== undefined) update.payment_method = input.paymentMethod;
  if (input.notes !== undefined) update.notes = input.notes;
  if (input.workAmount !== undefined || input.paidAmount !== undefined) {
    const { data: current } = await supabase.from('jobs').select('work_amount, paid_amount').eq('id', id).single();
    const work = input.workAmount ?? Number(current?.work_amount ?? 0);
    const paid = input.paidAmount ?? Number(current?.paid_amount ?? 0);
    update.remaining_amount = work - paid;
    update.payment_status = calcPaymentStatus(work, paid);
  }
  const { error } = await supabase.from('jobs').update(update).eq('id', id);
  if (error) throw error;
}

export async function deleteJob(id: string): Promise<void> {
  const { error } = await supabase.from('jobs').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchJobs(): Promise<Job[]> {
  const { data, error } = await supabase.from('jobs').select('*').order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapJob);
}

export async function fetchJobById(id: string): Promise<Job | null> {
  const { data, error } = await supabase.from('jobs').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapJob(data) : null;
}

export async function fetchJobsByCustomer(customerId: string): Promise<Job[]> {
  const { data, error } = await supabase.from('jobs').select('*').eq('customer_id', customerId).order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapJob);
}

export async function fetchJobsByEquipment(equipmentId: string): Promise<Job[]> {
  const { data, error } = await supabase.from('jobs').select('*').eq('equipment_id', equipmentId).order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapJob);
}

export interface ExpenseInput {
  date: string;
  equipmentId: string | null;
  equipmentName: string;
  expenseType: string;
  amount: number;
  notes: string;
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const { data, error } = await supabase.from('expenses').insert({
    date: input.date, equipment_id: input.equipmentId, equipment_name: input.equipmentName,
    expense_type: input.expenseType, amount: input.amount, notes: input.notes,
  }).select('*').single();
  if (error) throw error;
  return mapExpense(data);
}

export async function updateExpense(id: string, input: Partial<ExpenseInput>): Promise<void> {
  const update: Record<string, any> = {};
  if (input.date !== undefined) update.date = input.date;
  if (input.equipmentId !== undefined) update.equipment_id = input.equipmentId;
  if (input.equipmentName !== undefined) update.equipment_name = input.equipmentName;
  if (input.expenseType !== undefined) update.expense_type = input.expenseType;
  if (input.amount !== undefined) update.amount = input.amount;
  if (input.notes !== undefined) update.notes = input.notes;
  const { error } = await supabase.from('expenses').update(update).eq('id', id);
  if (error) throw error;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapExpense);
}

export async function fetchExpensesByEquipment(equipmentId: string): Promise<Expense[]> {
  const { data, error } = await supabase.from('expenses').select('*').eq('equipment_id', equipmentId).order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapExpense);
}

export async function recordPayment(jobId: string, customerId: string | null, amount: number, paymentMethod: string, date: string, notes: string): Promise<void> {
  const { data: job } = await supabase.from('jobs').select('paid_amount, work_amount').eq('id', jobId).single();
  if (!job) throw new Error('Job not found');
  const newPaid = Number(job.paid_amount) + amount;
  const remaining = Number(job.work_amount) - newPaid;
  const status = calcPaymentStatus(Number(job.work_amount), newPaid);
  await supabase.from('jobs').update({ paid_amount: newPaid, remaining_amount: remaining, payment_status: status }).eq('id', jobId);
  await supabase.from('payments').insert({ job_id: jobId, customer_id: customerId, amount, payment_method: paymentMethod, date, notes });
}

export async function fetchPaymentsByJob(jobId: string): Promise<Payment[]> {
  const { data, error } = await supabase.from('payments').select('*').eq('job_id', jobId).order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapPayment);
}

export async function fetchPaymentsByCustomer(customerId: string): Promise<Payment[]> {
  const { data, error } = await supabase.from('payments').select('*').eq('customer_id', customerId).order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapPayment);
}

export async function fetchAllTransactions(): Promise<Transaction[]> {
  const [jobs, expenses] = await Promise.all([fetchJobs(), fetchExpenses()]);
  const all: Transaction[] = [
    ...jobs.map(j => ({ kind: 'job' as const, data: j })),
    ...expenses.map(e => ({ kind: 'expense' as const, data: e })),
  ];
  all.sort((a, b) => {
    const da = a.kind === 'job' ? a.data.date : a.data.date;
    const db = b.kind === 'job' ? b.data.date : b.data.date;
    return db.localeCompare(da);
  });
  return all;
}

export interface DashboardTotals {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  receivables: number;
}

export async function fetchDashboardTotals(): Promise<DashboardTotals> {
  const { data: jobs } = await supabase.from('jobs').select('work_amount, paid_amount, remaining_amount');
  const { data: expenses } = await supabase.from('expenses').select('amount');
  const jobRows = jobs ?? [];
  const expRows = expenses ?? [];
  const totalIncome = jobRows.reduce((s: number, r: any) => s + Number(r.work_amount), 0);
  const totalExpenses = expRows.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const receivables = jobRows.reduce((s: number, r: any) => s + Number(r.remaining_amount), 0);
  return { totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses, receivables };
}

export interface EquipmentStats {
  totalJobValue: number;
  totalPaid: number;
  totalRemaining: number;
  totalExpenses: number;
  netProfit: number;
  jobsCount: number;
}

export async function fetchEquipmentStats(equipmentId: string): Promise<EquipmentStats> {
  const { data: jobs } = await supabase.from('jobs').select('work_amount, paid_amount, remaining_amount').eq('equipment_id', equipmentId);
  const { data: expenses } = await supabase.from('expenses').select('amount').eq('equipment_id', equipmentId);
  const jobRows = jobs ?? [];
  const expRows = expenses ?? [];
  const totalJobValue = jobRows.reduce((s: number, r: any) => s + Number(r.work_amount), 0);
  const totalPaid = jobRows.reduce((s: number, r: any) => s + Number(r.paid_amount), 0);
  const totalRemaining = jobRows.reduce((s: number, r: any) => s + Number(r.remaining_amount), 0);
  const totalExpenses = expRows.reduce((s: number, r: any) => s + Number(r.amount), 0);
  return { totalJobValue, totalPaid, totalRemaining, totalExpenses, netProfit: totalJobValue - totalExpenses, jobsCount: jobRows.length };
}
