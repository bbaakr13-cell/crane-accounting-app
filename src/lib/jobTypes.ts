import { supabase } from '@/lib/supabase';

export async function fetchJobTypes(): Promise<string[]> {
  const { data, error } = await supabase.from('job_types').select('name').order('created_at', { ascending: true });
  if (error || !data) return ['مشوار', 'ساعة', 'يومية', 'أسبوع', 'شهري', 'عقد', 'عمل خاص'];
  return data.map((r: any) => r.name);
}

export async function addJobType(name: string): Promise<void> {
  const { error } = await supabase.from('job_types').insert({ name });
  if (error) throw error;
}

export async function deleteJobType(name: string): Promise<void> {
  const { error } = await supabase.from('job_types').delete().eq('name', name);
  if (error) throw error;
}
