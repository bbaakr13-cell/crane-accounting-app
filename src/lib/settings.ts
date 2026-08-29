import { supabase } from '@/lib/supabase';

export interface AppSettings {
  appName: string;
  businessName: string;
  phone: string;
  city: string;
  currency: string;
  logo: string;
  defaultPaymentMethod: string;
  compactMode: boolean;
  animations: boolean;
  showOfflineBadge: boolean;
  printPhone: boolean;
  reportTitle: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  appName: 'برنامج محاسبة كرينات بكر',
  businessName: 'إدارة محاسبية متكاملة',
  phone: '0558995962',
  city: 'خميس مشيط',
  currency: 'ريال سعودي',
  logo: '',
  defaultPaymentMethod: 'كاش',
  compactMode: false,
  animations: true,
  showOfflineBadge: true,
  printPhone: true,
  reportTitle: 'تقرير حساب كرينات',
};

export async function fetchSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_SETTINGS;
  }

  return {
    appName:
      data.app_name ??
      DEFAULT_SETTINGS.appName,

    businessName:
      data.business_name ??
      DEFAULT_SETTINGS.businessName,

    phone:
      data.phone ??
      DEFAULT_SETTINGS.phone,

    city:
      data.city ??
      DEFAULT_SETTINGS.city,

    currency:
      data.currency ??
      DEFAULT_SETTINGS.currency,

    logo:
      data.logo_data ?? '',

    defaultPaymentMethod:
      data.default_payment_method ??
      DEFAULT_SETTINGS.defaultPaymentMethod,

    compactMode:
      data.compact_mode ??
      DEFAULT_SETTINGS.compactMode,

    animations:
      data.animations ??
      DEFAULT_SETTINGS.animations,

    showOfflineBadge:
      data.show_offline_badge ??
      DEFAULT_SETTINGS.showOfflineBadge,

    printPhone:
      data.print_phone ??
      DEFAULT_SETTINGS.printPhone,

    reportTitle:
      data.report_title ??
      DEFAULT_SETTINGS.reportTitle,
  };
}

export async function saveSettings(
  s: AppSettings
): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .upsert({
      id: 1,

      app_name:
        s.appName,

      business_name:
        s.businessName,

      phone:
        s.phone,

      city:
        s.city,

      currency:
        s.currency,

      logo_data:
        s.logo,

      default_payment_method:
        s.defaultPaymentMethod,

      compact_mode:
        s.compactMode,

      animations:
        s.animations,

      show_offline_badge:
        s.showOfflineBadge,

      print_phone:
        s.printPhone,

      report_title:
        s.reportTitle,
    });

  if (error) {
    throw error;
  }
}

export { DEFAULT_SETTINGS };
