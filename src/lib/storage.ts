// src/lib/storage.ts
// أدوات بسيطة وآمنة لحفظ وقراءة بيانات التطبيق من localStorage

const PREFIX = 'crane_accounting_';

function getKey(key: string): string {
  return `${PREFIX}${key}`;
}

export function saveData<T>(key: string, data: T): boolean {
  try {
    localStorage.setItem(getKey(key), JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`خطأ في حفظ البيانات: ${key}`, error);
    return false;
  }
}

export function loadData<T>(key: string, defaultValue: T): T {
  try {
    const saved = localStorage.getItem(getKey(key));

    if (saved === null) {
      return defaultValue;
    }

    return JSON.parse(saved) as T;
  } catch (error) {
    console.error(`خطأ في قراءة البيانات: ${key}`, error);
    return defaultValue;
  }
}

export function removeData(key: string): boolean {
  try {
    localStorage.removeItem(getKey(key));
    return true;
  } catch (error) {
    console.error(`خطأ في حذف البيانات: ${key}`, error);
    return false;
  }
}

export function clearAllData(): boolean {
  try {
    const keysToDelete: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (key && key.startsWith(PREFIX)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => localStorage.removeItem(key));

    return true;
  } catch (error) {
    console.error('خطأ في حذف بيانات التطبيق', error);
    return false;
  }
}

export function hasData(key: string): boolean {
  return localStorage.getItem(getKey(key)) !== null;
}
