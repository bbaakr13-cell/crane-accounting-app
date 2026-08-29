import {
  Directory,
  Encoding,
  Filesystem,
} from '@capacitor/filesystem';

const BACKUP_FOLDER = 'BAAKR_PRO_BACKUPS';

const APP_STORAGE_PREFIXES = [
  'crane_accounting_',
  'monthly-ledger-',
];

export type BackupType =
  | 'daily'
  | 'weekly'
  | 'manual'
  | 'before_restore';

export type BackupFile = {
  app: 'BAAKR PRO';
  version: 2;
  createdAt: string;
  type: BackupType;
  data: Record<string, string>;
};

export type SavedBackup = {
  fileName: string;
  backup: BackupFile;
};

/* ==============================
   معرفة بيانات التطبيق
============================== */

function isAppDataKey(key: string): boolean {
  if (key === 'crane_accounting_offline_db_v2') {
    return true;
  }

  return APP_STORAGE_PREFIXES.some((prefix) =>
    key.startsWith(prefix)
  );
}

/* ==============================
   جمع بيانات التطبيق كاملة
============================== */

function getAppData(): Record<string, string> {
  const data: Record<string, string> = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    if (!key) continue;

    if (!isAppDataKey(key)) continue;

    const value = localStorage.getItem(key);

    if (value !== null) {
      data[key] = value;
    }
  }

  return data;
}

/* ==============================
   إنشاء محتوى النسخة
============================== */

function makeBackup(type: BackupType): BackupFile {
  return {
    app: 'BAAKR PRO',
    version: 2,
    createdAt: new Date().toISOString(),
    type,
    data: getAppData(),
  };
}

/* ==============================
   تجهيز مجلد النسخ
============================== */

async function ensureBackupFolder() {
  try {
    await Filesystem.mkdir({
      path: BACKUP_FOLDER,
      directory: Directory.Data,
      recursive: true,
    });
  } catch {
    // المجلد موجود مسبقًا
  }
}

/* ==============================
   كتابة ملف نسخة
============================== */

async function writeBackupFile(
  fileName: string,
  backup: BackupFile
) {
  await ensureBackupFolder();

  await Filesystem.writeFile({
    path: `${BACKUP_FOLDER}/${fileName}`,
    data: JSON.stringify(backup, null, 2),
    directory: Directory.Data,
    encoding: Encoding.UTF8,
    recursive: true,
  });
}

/* ==============================
   قراءة ملف نسخة
============================== */

async function readBackupFile(
  fileName: string
): Promise<BackupFile> {
  const result = await Filesystem.readFile({
    path: `${BACKUP_FOLDER}/${fileName}`,
    directory: Directory.Data,
    encoding: Encoding.UTF8,
  });

  const text =
    typeof result.data === 'string'
      ? result.data
      : '';

  const backup = JSON.parse(text) as BackupFile;

  validateBackup(backup);

  return backup;
}

/* ==============================
   التحقق من النسخة
============================== */

function validateBackup(
  backup: BackupFile
): void {
  if (
    !backup ||
    backup.app !== 'BAAKR PRO' ||
    !backup.data ||
    typeof backup.data !== 'object'
  ) {
    throw new Error(
      'ملف النسخة الاحتياطية غير صالح'
    );
  }
}

/* ==============================
   التاريخ
============================== */

function dateId() {
  const date = new Date();

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/* ==============================
   رقم الأسبوع
============================== */

function weekId() {
  const date = new Date();

  const firstDay = new Date(
    date.getFullYear(),
    0,
    1
  );

  const days = Math.floor(
    (date.getTime() -
      firstDay.getTime()) /
      86400000
  );

  const week = Math.ceil(
    (
      days +
      firstDay.getDay() +
      1
    ) / 7
  );

  return `${date.getFullYear()}-W${String(
    week
  ).padStart(2, '0')}`;
}

/* ==============================
   أسماء الملفات
============================== */

function dailyFileName() {
  return `daily-${dateId()}.json`;
}

function weeklyFileName() {
  return `weekly-${weekId()}.json`;
}

function manualFileName() {
  return `manual-${Date.now()}.json`;
}

function beforeRestoreFileName() {
  return `before-restore-${Date.now()}.json`;
}

/* ==============================
   هل الملف موجود؟
============================== */

async function fileExists(
  fileName: string
): Promise<boolean> {
  try {
    await Filesystem.stat({
      path: `${BACKUP_FOLDER}/${fileName}`,
      directory: Directory.Data,
    });

    return true;
  } catch {
    return false;
  }
}

/* ==============================
   قائمة أسماء الملفات
============================== */

async function listFileNames(): Promise<string[]> {
  await ensureBackupFolder();

  try {
    const result = await Filesystem.readdir({
      path: BACKUP_FOLDER,
      directory: Directory.Data,
    });

    return result.files
      .map((file) => file.name)
      .filter((name) =>
        name.endsWith('.json')
      );
  } catch {
    return [];
  }
}

/* ==============================
   الاحتفاظ بآخر عدد محدد
============================== */

async function keepLatest(
  prefix: string,
  maximum: number
) {
  const names = await listFileNames();

  const matching = names
    .filter((name) =>
      name.startsWith(prefix)
    )
    .sort()
    .reverse();

  const oldFiles =
    matching.slice(maximum);

  for (const fileName of oldFiles) {
    try {
      await Filesystem.deleteFile({
        path: `${BACKUP_FOLDER}/${fileName}`,
        directory: Directory.Data,
      });
    } catch {
      // تجاهل
    }
  }
}

/* ==============================
   نسخة يومية
============================== */

export async function createDailyBackup() {
  const fileName = dailyFileName();

  if (!(await fileExists(fileName))) {
    await writeBackupFile(
      fileName,
      makeBackup('daily')
    );
  }

  await keepLatest('daily-', 7);

  return true;
}

/* ==============================
   نسخة أسبوعية
============================== */

export async function createWeeklyBackup() {
  const fileName = weeklyFileName();

  if (!(await fileExists(fileName))) {
    await writeBackupFile(
      fileName,
      makeBackup('weekly')
    );
  }

  await keepLatest('weekly-', 4);

  return true;
}

/* ==============================
   تشغيل النسخ التلقائي
============================== */

export async function runAutomaticBackup() {
  try {
    await createDailyBackup();
    await createWeeklyBackup();

    return true;
  } catch (error) {
    console.error(
      'خطأ في النسخ الاحتياطي التلقائي',
      error
    );

    return false;
  }
}

/* ==============================
   نسخة يدوية
============================== */

export async function createManualBackup() {
  const backup = makeBackup('manual');

  const fileName = manualFileName();

  await writeBackupFile(
    fileName,
    backup
  );

  return {
    fileName,
    backup,
  };
}

/* ==============================
   نسخة قبل الاستعادة
============================== */

async function createBeforeRestoreBackup() {
  const backup =
    makeBackup('before_restore');

  const fileName =
    beforeRestoreFileName();

  await writeBackupFile(
    fileName,
    backup
  );

  await keepLatest(
    'before-restore-',
    3
  );

  return {
    fileName,
    backup,
  };
}

/* ==============================
   استعادة البيانات
============================== */

export async function restoreBackup(
  backup: BackupFile
) {
  validateBackup(backup);

  // نسخة أمان قبل الاستعادة
  await createBeforeRestoreBackup();

  const keysToDelete: string[] = [];

  for (
    let i = 0;
    i < localStorage.length;
    i++
  ) {
    const key =
      localStorage.key(i);

    if (
      key &&
      isAppDataKey(key)
    ) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => {
    localStorage.removeItem(key);
  });

  Object.entries(
    backup.data
  ).forEach(([key, value]) => {
    localStorage.setItem(
      key,
      value
    );
  });

  return true;
}

/* ==============================
   جلب النسخ المحفوظة
============================== */

export async function getSavedBackups(): Promise<
  SavedBackup[]
> {
  const names =
    await listFileNames();

  const backups: SavedBackup[] = [];

  for (const fileName of names) {
    try {
      const backup =
        await readBackupFile(
          fileName
        );

      backups.push({
        fileName,
        backup,
      });
    } catch {
      // تجاهل الملف التالف
    }
  }

  return backups.sort(
    (a, b) =>
      new Date(
        b.backup.createdAt
      ).getTime() -
      new Date(
        a.backup.createdAt
      ).getTime()
  );
}

/* ==============================
   حذف نسخة
============================== */

export async function deleteBackup(
  fileName: string
) {
  if (
    !fileName.endsWith('.json')
  ) {
    return false;
  }

  await Filesystem.deleteFile({
    path: `${BACKUP_FOLDER}/${fileName}`,
    directory: Directory.Data,
  });

  return true;
}

/* ==============================
   تحويل النسخة إلى JSON
============================== */

export function backupToJson(
  backup: BackupFile
) {
  return JSON.stringify(
    backup,
    null,
    2
  );
}

/* ==============================
   قراءة ملف مستورد
============================== */

export function parseBackupFile(
  text: string
): BackupFile {
  const backup =
    JSON.parse(text) as BackupFile;

  validateBackup(backup);

  return backup;
}

/* ==============================
   الحصول على رابط ملف النسخة
   للمشاركة أو التصدير
============================== */

export async function getBackupFileUri(
  fileName: string
) {
  const result =
    await Filesystem.getUri({
      path: `${BACKUP_FOLDER}/${fileName}`,
      directory: Directory.Data,
    });

  return result.uri;
}

/* ==============================
   تصدير نسخة مستوردة/مؤقتة
============================== */

export async function saveBackupForExport(
  backup: BackupFile
) {
  validateBackup(backup);

  const fileName =
    `BAAKR-PRO-BACKUP-${Date.now()}.json`;

  await writeBackupFile(
    fileName,
    backup
  );

  return {
    fileName,
    uri:
      await getBackupFileUri(
        fileName
      ),
  };
}
