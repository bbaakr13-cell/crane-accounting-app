import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export type ReminderCategory = 'operation' | 'collection' | 'maintenance' | 'documents' | 'personal';
export type ReminderRepeat = 'none' | 'daily' | 'weekly' | 'monthly';
export type ReminderPriority = 'normal' | 'important' | 'urgent';
export type ReminderStatus = 'open' | 'done';
export interface CommandReminder {
  id: string;
  notificationId: number;
  title: string;
  details: string;
  category: ReminderCategory;
  priority: ReminderPriority;
  repeat: ReminderRepeat;
  dueAt: string; // local user-selected wall time represented as ISO
  equipmentId: string;
  equipmentName: string;
  contactName: string;
  phone: string;
  destination: string;
  status: ReminderStatus;
  createdAt: string;
  completedAt?: string;
}
export const REMINDERS_KEY = 'bakr_pro_command_reminders_v1';
export const categories: Record<ReminderCategory, string> = {
  operation: 'تشغيل وحجز كرين', collection: 'تحصيل عميل', maintenance: 'صيانة معدة',
  documents: 'وثائق وشهادات', personal: 'مهمة شخصية',
};
export const priorityLabels: Record<ReminderPriority, string> = {normal:'عادي', important:'مهم', urgent:'عاجل'};
export const repeatLabels: Record<ReminderRepeat, string> = {none:'مرة واحدة',daily:'يومي',weekly:'أسبوعي',monthly:'شهري'};

export function readReminders(): CommandReminder[] {
  try {
    const raw = JSON.parse(localStorage.getItem(REMINDERS_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(x => x && typeof x.id === 'string' && typeof x.dueAt === 'string') : [];
  } catch { return []; }
}
export function writeReminders(items: CommandReminder[]) {
  localStorage.setItem(REMINDERS_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('bakr-reminders-changed'));
}
export function nativeAlertsAvailable() { return Capacitor.isNativePlatform(); }
export async function enableNativeAlerts(): Promise<string> {
  if (!nativeAlertsAvailable()) return 'في المتصفح تظهر التذكيرات داخل التطبيق فقط. إشعارات الخلفية تحتاج APK.';
  try {
    const current = await LocalNotifications.checkPermissions();
    const permission = current.display === 'granted' ? current : await LocalNotifications.requestPermissions();
    if (permission.display !== 'granted') return 'الإشعارات غير مسموحة. فعّلها من إعدادات أندرويد للتطبيق.';
    return '';
  } catch { return 'تعذر طلب إذن الإشعارات. تحقق من تثبيت إضافة أندرويد وإعدادات التطبيق.'; }
}
export async function cancelNativeReminder(notificationId: number) {
  if (!nativeAlertsAvailable()) return;
  try { await LocalNotifications.cancel({ notifications: [{ id: notificationId }] }); } catch { /* best effort */ }
}
export async function scheduleNativeReminder(reminder: CommandReminder): Promise<string> {
  if (!nativeAlertsAvailable() || reminder.status !== 'open') return '';
  const target = new Date(reminder.dueAt);
  if (Number.isNaN(target.getTime())) return 'تاريخ التذكير غير صالح';
  if (target.getTime() <= Date.now()) return 'التاريخ مضى؛ اختر موعداً مستقبلياً لإشعار أندرويد.';
  const error = await enableNativeAlerts();
  if (error) return error;
  try {
    await cancelNativeReminder(reminder.notificationId);
    const every = reminder.repeat === 'daily' ? 'day' : reminder.repeat === 'weekly' ? 'week' : reminder.repeat === 'monthly' ? 'month' : undefined;
    await LocalNotifications.schedule({ notifications: [{
      id: reminder.notificationId,
      title: `BAKR PRO • ${reminder.title}`,
      body: `${categories[reminder.category]}${reminder.equipmentName ? ' • ' + reminder.equipmentName : ''}${reminder.details ? '\n' + reminder.details : ''}`,
      schedule: every ? { at: target, every, allowWhileIdle: true } : { at: target, allowWhileIdle: true },
      extra: { reminderId: reminder.id, destination: reminder.destination },
    }] });
    return '';
  } catch {
    return 'تم حفظ المهمة، لكن تعذر جدولة إشعار أندرويد. راجع الإذن وإعدادات البطارية والتنبيهات الدقيقة.';
  }
}
export function newNativeId(items: CommandReminder[]) {
  const used = new Set(items.map(r => r.notificationId));
  let id = Math.floor(Math.random() * 1900000000) + 1000000;
  while (used.has(id)) id = (id + 1) % 2000000000;
  return id;
}
export function nextOccurrence(reminder: CommandReminder, at = new Date()): Date {
  const d = new Date(reminder.dueAt);
  if (reminder.repeat === 'none' || d > at) return d;
  let count = 0;
  while (d <= at && count++ < 1500) {
    if (reminder.repeat === 'daily') d.setDate(d.getDate() + 1);
    else if (reminder.repeat === 'weekly') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
  }
  return d;
}
