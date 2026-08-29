import { createClient } from '@supabase/supabase-js';

const recoveryUrl = import.meta.env.VITE_RECOVERY_SUPABASE_URL;
const recoveryKey = import.meta.env.VITE_RECOVERY_SUPABASE_KEY;

if (!recoveryUrl || !recoveryKey) {
  console.warn('Recovery Supabase configuration is missing');
}

export const recoverySupabase = createClient(
  recoveryUrl || '',
  recoveryKey || ''
);

export async function sendRecoveryCode(email: string) {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail) {
    throw new Error('أدخل البريد الإلكتروني');
  }

  if (!recoveryUrl || !recoveryKey) {
    throw new Error('إعدادات استعادة الحساب غير مكتملة');
  }

  const { error } = await recoverySupabase.auth.signInWithOtp({
    email: cleanEmail,
    options: {
      shouldCreateUser: false,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function verifyRecoveryCode(
  email: string,
  code: string
) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();

  if (!cleanEmail || !cleanCode) {
    throw new Error('أدخل البريد ورمز التحقق');
  }

  const { data, error } = await recoverySupabase.auth.verifyOtp({
    email: cleanEmail,
    token: cleanCode,
    type: 'email',
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function signOutRecovery() {
  await recoverySupabase.auth.signOut();
}
