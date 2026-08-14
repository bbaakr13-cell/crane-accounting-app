import { supabase } from '@/lib/supabase';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  notes: string;
  createdAt: string;
}

export interface CustomerWithTotals extends Customer {
  totalJobValue: number;
  totalPaid: number;
  totalRemaining: number;
  jobsCount: number;
}

export async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id, name: r.name, phone: r.phone ?? '', notes: r.notes ?? '', createdAt: r.created_at ?? '',
  }));
}

export async function fetchCustomerById(id: string): Promise<Customer | null> {
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, name: data.name, phone: data.phone ?? '', notes: data.notes ?? '', createdAt: data.created_at ?? '' };
}

export async function createCustomer(name: string, phone: string, notes: string): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers').insert({ name, phone, notes }).select('*').single();
  if (error) throw error;
  return { id: data.id, name: data.name, phone: data.phone ?? '', notes: data.notes ?? '', createdAt: data.created_at ?? '' };
}

export async function updateCustomer(id: string, name: string, phone: string, notes: string): Promise<void> {
  const { error } = await supabase.from('customers').update({ name, phone, notes }).eq('id', id);
  if (error) throw error;
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchCustomerWithTotals(id: string): Promise<CustomerWithTotals | null> {
  const customer = await fetchCustomerById(id);
  if (!customer) return null;
  const { data: jobs } = await supabase
    .from('jobs').select('work_amount, paid_amount, remaining_amount').eq('customer_id', id);
  const rows = jobs ?? [];
  return {
    ...customer,
    totalJobValue: rows.reduce((s: number, r: any) => s + Number(r.work_amount), 0),
    totalPaid: rows.reduce((s: number, r: any) => s + Number(r.paid_amount), 0),
    totalRemaining: rows.reduce((s: number, r: any) => s + Number(r.remaining_amount), 0),
    jobsCount: rows.length,
  };
}

export async function fetchAllCustomersWithTotals(): Promise<CustomerWithTotals[]> {
  const customers = await fetchCustomers();
  const result: CustomerWithTotals[] = [];
  for (const c of customers) {
    const { data: jobs } = await supabase
      .from('jobs').select('work_amount, paid_amount, remaining_amount').eq('customer_id', c.id);
    const rows = jobs ?? [];
    result.push({
      ...c,
      totalJobValue: rows.reduce((s: number, r: any) => s + Number(r.work_amount), 0),
      totalPaid: rows.reduce((s: number, r: any) => s + Number(r.paid_amount), 0),
      totalRemaining: rows.reduce((s: number, r: any) => s + Number(r.remaining_amount), 0),
      jobsCount: rows.length,
    });
  }
  return result;
}
