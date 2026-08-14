import { supabase } from '@/lib/supabase';
import type { Job } from '@/lib/transactions';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  jobId: string | null;
  date: string;
  customerName: string;
  customerPhone: string;
  equipmentName: string;
  jobType: string;
  location: string;
  description: string;
  workAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  notes: string;
  createdAt: string;
}

function mapInvoice(r: any): Invoice {
  return {
    id: r.id, invoiceNumber: r.invoice_number, jobId: r.job_id, date: r.date,
    customerName: r.customer_name, customerPhone: r.customer_phone ?? '',
    equipmentName: r.equipment_name ?? '', jobType: r.job_type ?? '', location: r.location ?? '',
    description: r.description ?? '', workAmount: Number(r.work_amount), paidAmount: Number(r.paid_amount),
    remainingAmount: Number(r.remaining_amount), paymentStatus: r.payment_status ?? '', notes: r.notes ?? '',
    createdAt: r.created_at ?? '',
  };
}

export async function generateInvoiceNumber(): Promise<string> {
  const { data, error } = await supabase
    .from('invoices')
    .select('invoice_number')
    .order('invoice_number', { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) return 'BK-0001';
  const last = data[0].invoice_number as string;
  const match = last.match(/BK-(\d+)/);
  const nextNum = match ? parseInt(match[1], 10) + 1 : 1;
  return `BK-${String(nextNum).padStart(4, '0')}`;
}

export async function createInvoiceFromJob(job: Job): Promise<Invoice> {
  const invoiceNumber = await generateInvoiceNumber();
  const { data, error } = await supabase.from('invoices').insert({
    invoice_number: invoiceNumber,
    job_id: job.id,
    date: job.date,
    customer_name: job.customerName,
    customer_phone: job.customerPhone,
    equipment_name: job.equipmentName,
    job_type: job.jobType,
    location: job.location,
    description: job.description,
    work_amount: job.workAmount,
    paid_amount: job.paidAmount,
    remaining_amount: job.remainingAmount,
    payment_status: job.paymentStatus,
    notes: job.notes,
  }).select('*').single();
  if (error) throw error;
  return mapInvoice(data);
}

export async function fetchInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapInvoice);
}

export async function fetchInvoiceById(id: string): Promise<Invoice | null> {
  const { data, error } = await supabase.from('invoices').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapInvoice(data) : null;
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) throw error;
}
