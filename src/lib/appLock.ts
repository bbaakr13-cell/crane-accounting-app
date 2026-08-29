const LOCK_ENABLED_KEY = 'baakr_pro_lock_enabled';
const LOCK_HASH_KEY = 'baakr_pro_lock_hash';
const RECOVERY_EMAIL_KEY = 'baakr_pro_recovery_email';
const RECOVERY_VERIFIED_KEY = 'baakr_pro_recovery_verified';

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function isAppLockEnabled(): boolean {
  return localStorage.getItem(LOCK_ENABLED_KEY) === 'true';
}

export async function setAppPin(pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('PIN يجب أن يكون 4 أرقام');
  }

  const hash = await sha256(pin);

  localStorage.setItem(LOCK_HASH_KEY, hash);
  localStorage.setItem(LOCK_ENABLED_KEY, 'true');
}

export async function verifyAppPin(pin: string): Promise<boolean> {
  const savedHash = localStorage.getItem(LOCK_HASH_KEY);

  if (!savedHash) {
    return false;
  }

  if (!/^\d{4}$/.test(pin)) {
    return false;
  }

  const hash = await sha256(pin);

  return hash === savedHash;
}

export function disableAppLock(): void {
  localStorage.setItem(LOCK_ENABLED_KEY, 'false');
}

export function enableAppLock(): void {
  if (hasAppPin()) {
    localStorage.setItem(LOCK_ENABLED_KEY, 'true');
  }
}

export function removeAppPin(): void {
  localStorage.removeItem(LOCK_HASH_KEY);
  localStorage.removeItem(LOCK_ENABLED_KEY);
  localStorage.removeItem(RECOVERY_VERIFIED_KEY);
}

export function hasAppPin(): boolean {
  return localStorage.getItem(LOCK_HASH_KEY) !== null;
}

/* =========================
   بريد استرجاع كلمة المرور
========================= */

export function setRecoveryEmail(email: string): void {
  const cleanEmail = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('البريد الإلكتروني غير صحيح');
  }

  localStorage.setItem(RECOVERY_EMAIL_KEY, cleanEmail);
}

export function getRecoveryEmail(): string {
  return localStorage.getItem(RECOVERY_EMAIL_KEY) || '';
}

export function hasRecoveryEmail(): boolean {
  return getRecoveryEmail().length > 0;
}

export function removeRecoveryEmail(): void {
  localStorage.removeItem(RECOVERY_EMAIL_KEY);
  localStorage.removeItem(RECOVERY_VERIFIED_KEY);
}

/* =========================
   حالة التحقق من الاسترجاع
========================= */

export function setRecoveryVerified(value: boolean): void {
  if (value) {
    localStorage.setItem(RECOVERY_VERIFIED_KEY, 'true');
  } else {
    localStorage.removeItem(RECOVERY_VERIFIED_KEY);
  }
}

export function isRecoveryVerified(): boolean {
  return localStorage.getItem(RECOVERY_VERIFIED_KEY) === 'true';
}

/* =========================
   تعيين PIN جديد بعد الاسترجاع
========================= */

export async function resetPinAfterRecovery(
  newPin: string
): Promise<void> {
  if (!isRecoveryVerified()) {
    throw new Error('يجب التحقق من البريد أولاً');
  }

  if (!/^\d{4}$/.test(newPin)) {
    throw new Error('PIN الجديد يجب أن يكون 4 أرقام');
  }

  await setAppPin(newPin);

  // إلغاء صلاحية الاسترجاع بعد تغيير الرمز
  setRecoveryVerified(false);
}

/* =========================
   إخفاء جزء من البريد للعرض
========================= */

export function maskRecoveryEmail(email?: string): string {
  const value = email || getRecoveryEmail();

  if (!value || !value.includes('@')) {
    return '';
  }

  const [name, domain] = value.split('@');

  if (name.length <= 2) {
    return `${name[0] || '*'}***@${domain}`;
  }

  return `${name.slice(0, 2)}***@${domain}`;
} 
