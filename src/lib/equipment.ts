import { supabase } from '@/lib/supabase';

export type EquipmentStatus = 'active' | 'maintenance' | 'idle';
export type EquipmentType = 'crane' | 'boom_truck' | 'other';

export interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  capacity: string;
  plateNumber: string;
  status: EquipmentStatus;
  notes: string;
  image: string;
  hourlyRate: number;
  dailyRate: number;
  totalIncome: number;
  totalExpenses: number;
  createdAt: string;
}

export interface MonthlyEntry {
  id: string;
  equipmentId: string;
  month: string;
  year: number;
  income: number;
  expenses: number;
  jobsCount: number;
}

export const statusLabels: Record<EquipmentStatus, string> = {
  active: 'نشط',
  maintenance: 'صيانة',
  idle: 'متوقف',
};

export const statusStyles: Record<EquipmentStatus, { dot: string; text: string; bg: string }> = {
  active: { dot: 'bg-income', text: 'text-income', bg: 'bg-income/10' },
  maintenance: { dot: 'bg-gold-400', text: 'text-gold-400', bg: 'bg-gold-500/10' },
  idle: { dot: 'bg-slate-500', text: 'text-slate-400', bg: 'bg-white/5' },
};

export const typeLabels: Record<EquipmentType, string> = {
  crane: 'كرين',
  boom_truck: 'بوم ترك',
  other: 'أخرى',
};

export const monthlyEntries: MonthlyEntry[] = [];

function mapRow(row: any): Equipment {
  return {
    id: row.id,
    name: row.name,
    type: row.type as EquipmentType,
    capacity: row.capacity ?? '',
    plateNumber: row.plate_number ?? '',
    status: row.status as EquipmentStatus,
    notes: row.notes ?? '',
    image: row.image_data ?? '',
    hourlyRate: Number(row.hourly_rate) || 0,
    dailyRate: Number(row.daily_rate) || 0,
    totalIncome: Number(row.total_income) || 0,
    totalExpenses: Number(row.total_expenses) || 0,
    createdAt: row.created_at ?? '',
  };
}

export async function fetchEquipment(): Promise<Equipment[]> {
  const { data, error } = await supabase
    .from('equipment')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function fetchEquipmentById(id: string): Promise<Equipment | null> {
  const { data, error } = await supabase
    .from('equipment')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

export interface EquipmentInput {
  name: string;
  type: EquipmentType;
  capacity: string;
  plateNumber: string;
  status: EquipmentStatus;
  notes: string;
  image: string;
}

export async function createEquipment(input: EquipmentInput): Promise<Equipment> {
  const { data, error } = await supabase
    .from('equipment')
    .insert({
      name: input.name,
      type: input.type,
      capacity: input.capacity,
      plate_number: input.plateNumber,
      status: input.status,
      notes: input.notes,
      image_data: input.image,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function updateEquipment(id: string, input: Partial<EquipmentInput>): Promise<Equipment> {
  const update: Record<string, any> = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.type !== undefined) update.type = input.type;
  if (input.capacity !== undefined) update.capacity = input.capacity;
  if (input.plateNumber !== undefined) update.plate_number = input.plateNumber;
  if (input.status !== undefined) update.status = input.status;
  if (input.notes !== undefined) update.notes = input.notes;
  if (input.image !== undefined) update.image_data = input.image;

  const { data, error } = await supabase
    .from('equipment')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function deleteEquipment(id: string): Promise<void> {
  const { error } = await supabase.from('equipment').delete().eq('id', id);
  if (error) throw error;
}

export function getMonthlyByEquipment(_equipmentId: string): MonthlyEntry[] {
  return [];
}
