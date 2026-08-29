import { createClient } from '@supabase/supabase-js';

const recoveryUrl =
  import.meta.env.VITE_RECOVERY_SUPABASE_URL;

const recoveryKey =
  import.meta.env.VITE_RECOVERY_SUPABASE_KEY;

if (!recoveryUrl || !recoveryKey) {
  console.warn(
    'Recovery Supabase configuration is missing'
  );
}

export const recoverySupabase = createClient(
  recoveryUrl || '',
  recoveryKey || ''
);

/* =========================
   إرسال رمز الاسترجاع
========================= */

export async function sendRecoveryCode(
  email: string
): Promise<boolean> {
  const cleanEmail = email
    .trim()
    .toLowerCase();

  if (!cleanEmail) {
    throw new Error(
      'أدخل البريد الإلكتروني'
    );
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      cleanEmail
    )
  ) {
    throw new Error(
      'البريد الإلكتروني غير صحيح'
    );
  }

  if (!recoveryUrl || !recoveryKey) {
    throw new Error(
      'إعدادات استعادة الرقم السري غير مكتملة'
    );
  }

  const { error } =
    await recoverySupabase.auth.signInWithOtp({
      email: cleanEmail,

      options: {
        /*
         * مهم جدًا:
         * لا ننشئ مستخدمًا جديدًا تلقائيًا.
         * يجب أن يكون بريد الاسترجاع
         * مسجلًا مسبقًا في Supabase.
         */
        shouldCreateUser: false,
      },
    });

  if (error) {
    console.error(
      'Recovery send error:',
      error
    );

    const message =
      error.message.toLowerCase();

    if (
      message.includes('rate') ||
      message.includes('limit')
    ) {
      throw new Error(
        'تم طلب الرمز عدة مرات. انتظر قليلًا ثم حاول مرة أخرى'
      );
    }

    if (
      message.includes('signup') ||
      message.includes('user') ||
      message.includes('not found')
    ) {
      throw new Error(
        'هذا البريد غير مسجل كبريد استرجاع'
      );
    }

    throw new Error(
      'تعذر إرسال رمز التحقق. تحقق من الإنترنت وحاول مرة أخرى'
    );
  }

  return true;
}

/* =========================
   التحقق من رمز البريد
========================= */

export async function verifyRecoveryCode(
  email: string,
  code: string
) {
  const cleanEmail = email
    .trim()
    .toLowerCase();

  const cleanCode = code
    .trim()
    .replace(/\s/g, '');

  if (!cleanEmail) {
    throw new Error(
      'البريد الإلكتروني غير موجود'
    );
  }

  if (!cleanCode) {
    throw new Error(
      'أدخل رمز التحقق'
    );
  }

  if (!/^\d+$/.test(cleanCode)) {
    throw new Error(
      'رمز التحقق غير صحيح'
    );
  }

  const { data, error } =
    await recoverySupabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanCode,
      type: 'email',
    });

  if (error) {
    console.error(
      'Recovery verify error:',
      error
    );

    const message =
      error.message.toLowerCase();

    if (
      message.includes('expired')
    ) {
      throw new Error(
        'انتهت صلاحية رمز التحقق. اطلب رمزًا جديدًا'
      );
    }

    throw new Error(
      'رمز التحقق غير صحيح أو انتهت صلاحيته'
    );
  }

  if (!data.session) {
    throw new Error(
      'لم يكتمل التحقق من البريد'
    );
  }

  return data;
}

/* =========================
   تسجيل الخروج بعد الاسترجاع
========================= */

export async function signOutRecovery(): Promise<void> {
  try {
    await recoverySupabase.auth.signOut();
  } catch (error) {
    console.error(
      'Recovery sign out error:',
      error
    );
  }
}
