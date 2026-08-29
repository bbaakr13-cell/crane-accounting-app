const BACKUP_PREFIX = 'baakr_pro_backup_';
const DAILY_PREFIX = `${BACKUP_PREFIX}daily_`;
const WEEKLY_PREFIX = `${BACKUP_PREFIX}weekly_`;
const MANUAL_PREFIX = `${BACKUP_PREFIX}manual_`;
const BEFORE_RESTORE_PREFIX = `${BACKUP_PREFIX}before_restore_`;

export type BackupFile = {
  app: 'BAAKR PRO';
  version: 1;
  createdAt: string;
  type: 'daily' | 'weekly' | 'manual' | 'before_restore';
  data: Record<string, string>;
};

function getAppData(): Record<string, string> {
  const data: Record<string, string> = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    if (!key) continue;

    // لا نضع ملفات النسخ الاحتياطي داخل نسخة أخرى
    if (key.startsWith(BACKUP_PREFIX)) continue;

    const value = localStorage.getItem(key);

    if (value !== null) {
      data[key] = value;
    }
  }

  return data;
}

function makeBackup(
  type: BackupFile['type']
): BackupFile {
  return {
    app: 'BAAKR PRO',
    version: 1,
    createdAt: new Date().toISOString(),
    type,
    data: getAppData(),
  };
}

function saveBackup(
  key: string,
  backup: BackupFile
) {
  localStorage.setItem(key, JSON.stringify(backup));
}

function getBackupKeys(prefix: string) {
  const keys: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    if (key?.startsWith(prefix)) {
      keys.push(key);
    }
  }

  return keys.sort().reverse();
}

function keepLatest(
  prefix: string,
  maximum: number
) {
  const keys = getBackupKeys(prefix);

  keys.slice(maximum).forEach((key) => {
    localStorage.removeItem(key);
  });
}

function dateId() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function weekId() {
  const date = new Date();

  const firstDay = new Date(date.getFullYear(), 0, 1);

  const days = Math.floor(
    (date.getTime() - firstDay.getTime()) / 86400000
  );

  const week = Math.ceil(
    (days + firstDay.getDay() + 1) / 7
  );

  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/* =========================
   نسخة يومية تلقائية
========================= */

export function createDailyBackup() {
  try {
    const key = `${DAILY_PREFIX}${dateId()}`;

    // نسخة واحدة فقط في اليوم
    if (!localStorage.getItem(key)) {
      saveBackup(key, makeBackup('daily'));
    }

    // الاحتفاظ بآخر 7 أيام
    keepLatest(DAILY_PREFIX, 7);

    return true;
  } catch (error) {
    console.error('خطأ في النسخة اليومية', error);
    return false;
  }
}

/* =========================
   نسخة أسبوعية تلقائية
========================= */

export function createWeeklyBackup() {
  try {
    const key = `${WEEKLY_PREFIX}${weekId()}`;

    if (!localStorage.getItem(key)) {
      saveBackup(key, makeBackup('weekly'));
    }

    // الاحتفاظ بآخر 4 أسابيع
    keepLatest(WEEKLY_PREFIX, 4);

    return true;
  } catch (error) {
    console.error('خطأ في النسخة الأسبوعية', error);
    return false;
  }
}

/* =========================
   تشغيل النسخ التلقائي
========================= */

export function runAutomaticBackup() {
  createDailyBackup();
  createWeeklyBackup();
}

/* =========================
   نسخة يدوية
========================= */

export function createManualBackup() {
  const backup = makeBackup('manual');

  const key =
    `${MANUAL_PREFIX}${Date.now()}`;

  saveBackup(key, backup);

  return backup;
}

/* =========================
   نسخة أمان قبل الاستعادة
========================= */

function createBeforeRestoreBackup() {
  const backup = makeBackup('before_restore');

  saveBackup(
    `${BEFORE_RESTORE_PREFIX}${Date.now()}`,
    backup
  );

  // نحتفظ بآخر 3 نسخ أمان
  keepLatest(BEFORE_RESTORE_PREFIX, 3);
}

/* =========================
   استعادة نسخة
========================= */

export function restoreBackup(
  backup: BackupFile
) {
  if (
    !backup ||
    backup.app !== 'BAAKR PRO' ||
    !backup.data
  ) {
    throw new Error('ملف النسخة الاحتياطية غير صالح');
  }

  // حماية البيانات الحالية قبل الاستعادة
  createBeforeRestoreBackup();

  const keysToRemove: string[] = [];

  // حذف بيانات التطبيق الحالية،
  // مع إبقاء النسخ الاحتياطية
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    if (
      key &&
      !key.startsWith(BACKUP_PREFIX)
    ) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => {
    localStorage.removeItem(key);
  });

  Object.entries(backup.data).forEach(
    ([key, value]) => {
      localStorage.setItem(key, value);
    }
  );

  return true;
}

/* =========================
   قائمة النسخ الموجودة
========================= */

export function getSavedBackups() {
  const backups: {
    key: string;
    backup: BackupFile;
  }[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    if (!key?.startsWith(BACKUP_PREFIX)) {
      continue;
    }

    try {
      const raw = localStorage.getItem(key);

      if (!raw) continue;

      const backup = JSON.parse(raw) as BackupFile;

      if (backup.app === 'BAAKR PRO') {
        backups.push({
          key,
          backup,
        });
      }
    } catch {
      // تجاهل النسخة التالفة
    }
  }

  return backups.sort(
    (a, b) =>
      new Date(b.backup.createdAt).getTime() -
      new Date(a.backup.createdAt).getTime()
  );
}

/* =========================
   حذف نسخة محددة
========================= */

export function deleteBackup(key: string) {
  if (!key.startsWith(BACKUP_PREFIX)) {
    return false;
  }

  localStorage.removeItem(key);

  return true;
}

/* =========================
   تصدير نسخة كملف JSON
========================= */

export function backupToJson(
  backup: BackupFile
) {
  return JSON.stringify(backup, null, 2);
}

/* =========================
   قراءة نسخة مستوردة
========================= */

export function parseBackupFile(
  text: string
): BackupFile {
  const backup = JSON.parse(text) as BackupFile;

  if (
    backup.app !== 'BAAKR PRO' ||
    backup.version !== 1 ||
    !backup.data
  ) {
    throw new Error('هذا الملف ليس نسخة احتياطية صالحة لـ BAAKR PRO');
  }

  return backup;
}
