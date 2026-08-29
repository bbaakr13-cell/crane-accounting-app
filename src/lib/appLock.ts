const LOCK_ENABLED_KEY = 'baakr_pro_lock_enabled';
const LOCK_HASH_KEY = 'baakr_pro_lock_hash';

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

  const hash = await sha256(pin);

  return hash === savedHash;
}

export function disableAppLock(): void {
  localStorage.setItem(LOCK_ENABLED_KEY, 'false');
}

export function removeAppPin(): void {
  localStorage.removeItem(LOCK_HASH_KEY);
  localStorage.removeItem(LOCK_ENABLED_KEY);
}

export function hasAppPin(): boolean {
  return localStorage.getItem(LOCK_HASH_KEY) !== null;
}
