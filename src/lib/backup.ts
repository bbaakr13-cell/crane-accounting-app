import {
  Directory,
  Encoding,
  Filesystem,
} from '@capacitor/filesystem';

import {
  uploadBackupObjectToDrive,
} from '@/lib/googleDrive';

const BACKUP_FOLDER =
  'BAAKR_PRO_BACKUPS';

const APP_STORAGE_PREFIXES = [
  'crane_accounting_',
  'monthly-ledger-',
];

const DAILY_DRIVE_MARKER =
  'bakr_drive_daily_uploaded';

const WEEKLY_DRIVE_MARKER =
  'bakr_drive_weekly_uploaded';

export type BackupType =
  | 'daily'
  | 'weekly'
  | 'manual'
  | 'before_restore';

export type BackupFile = {
  app:
    | 'BAKR PRO'
    | 'BAAKR PRO';

  version: 2;

  createdAt: string;

  type: BackupType;

  data:
    Record<string, string>;
};

export type SavedBackup = {
  fileName: string;

  backup: BackupFile;
};

/* ==============================
   معرفة بيانات التطبيق
============================== */

function isAppDataKey(
  key: string
): boolean {
  if (
    key ===
    'crane_accounting_offline_db_v2'
  ) {
    return true;
  }

  return APP_STORAGE_PREFIXES.some(
    (prefix) =>
      key.startsWith(prefix)
  );
}

/* ==============================
   جمع بيانات التطبيق
============================== */

function getAppData():
  Record<string, string> {
  const data:
    Record<string, string> = {};

  for (
    let i = 0;
    i < localStorage.length;
    i++
  ) {
    const key =
      localStorage.key(i);

    if (!key) {
      continue;
    }

    if (!isAppDataKey(key)) {
      continue;
    }

    const value =
      localStorage.getItem(key);

    if (value !== null) {
      data[key] = value;
    }
  }

  return data;
}

/* ==============================
   إنشاء محتوى النسخة
============================== */

function makeBackup(
  type: BackupType
): BackupFile {
  return {
    app:
      'BAKR PRO',

    version:
      2,

    createdAt:
      new Date().toISOString(),

    type,

    data:
      getAppData(),
  };
}

/* ==============================
   تجهيز المجلد
============================== */

async function ensureBackupFolder() {
  try {
    await Filesystem.mkdir({
      path:
        BACKUP_FOLDER,

      directory:
        Directory.Data,

      recursive:
        true,
    });
  } catch {
    // المجلد موجود مسبقًا
  }
}

/* ==============================
   كتابة ملف النسخة
============================== */

async function writeBackupFile(
  fileName: string,
  backup: BackupFile
) {
  await ensureBackupFolder();

  await Filesystem.writeFile({
    path:
      `${BACKUP_FOLDER}/${fileName}`,

    data:
      JSON.stringify(
        backup,
        null,
        2
      ),

    directory:
      Directory.Data,

    encoding:
      Encoding.UTF8,

    recursive:
      true,
  });
}

/* ==============================
   قراءة ملف النسخة
============================== */

async function readBackupFile(
  fileName: string
): Promise<BackupFile> {
  const result =
    await Filesystem.readFile({
      path:
        `${BACKUP_FOLDER}/${fileName}`,

      directory:
        Directory.Data,

      encoding:
        Encoding.UTF8,
    });

  const text =
    typeof result.data ===
      'string'
      ? result.data
      : '';

  const backup =
    JSON.parse(
      text
    ) as BackupFile;

  validateBackup(
    backup
  );

  return backup;
}

/* ==============================
   التحقق من النسخة
============================== */

function validateBackup(
  backup: BackupFile
): void {
  const validApp =
    backup?.app ===
      'BAKR PRO' ||
    backup?.app ===
      'BAAKR PRO';

  if (
    !backup ||
    !validApp ||
    !backup.data ||
    typeof backup.data !==
      'object'
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
  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    );

  return (
    `${year}-${month}-${day}`
  );
}

function dateTimeId() {
  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    );

  const hour =
    String(
      date.getHours()
    ).padStart(
      2,
      '0'
    );

  const minute =
    String(
      date.getMinutes()
    ).padStart(
      2,
      '0'
    );

  const second =
    String(
      date.getSeconds()
    ).padStart(
      2,
      '0'
    );

  return (
    `${year}-${month}-${day}` +
    `_${hour}-${minute}-${second}`
  );
}

/* ==============================
   رقم الأسبوع
============================== */

function weekId() {
  const date =
    new Date();

  const firstDay =
    new Date(
      date.getFullYear(),
      0,
      1
    );

  const days =
    Math.floor(
      (
        date.getTime() -
        firstDay.getTime()
      ) /
        86400000
    );

  const week =
    Math.ceil(
      (
        days +
        firstDay.getDay() +
        1
      ) / 7
    );

  return (
    `${date.getFullYear()}` +
    `-W${String(
      week
    ).padStart(
      2,
      '0'
    )}`
  );
}

/* ==============================
   أسماء الملفات
============================== */

function dailyFileName() {
  return (
    `daily-` +
    `${dateId()}.json`
  );
}

function weeklyFileName() {
  return (
    `weekly-` +
    `${weekId()}.json`
  );
}

function manualFileName() {
  return (
    `BAKR-PRO-BACKUP-` +
    `${dateTimeId()}.json`
  );
}

function beforeRestoreFileName() {
  return (
    `before-restore-` +
    `${Date.now()}.json`
  );
}

function dailyDriveFileName() {
  return (
    `BAKR-PRO-DAILY-` +
    `${dateId()}.json`
  );
}

function weeklyDriveFileName() {
  return (
    `BAKR-PRO-WEEKLY-` +
    `${weekId()}.json`
  );
}

/* ==============================
   هل الملف موجود؟
============================== */

async function fileExists(
  fileName: string
): Promise<boolean> {
  try {
    await Filesystem.stat({
      path:
        `${BACKUP_FOLDER}/${fileName}`,

      directory:
        Directory.Data,
    });

    return true;
  } catch {
    return false;
  }
}

/* ==============================
   قائمة الملفات
============================== */

async function listFileNames():
  Promise<string[]> {
  await ensureBackupFolder();

  try {
    const result =
      await Filesystem.readdir({
        path:
          BACKUP_FOLDER,

        directory:
          Directory.Data,
      });

    return result.files
      .map(
        (file) =>
          file.name
      )
      .filter(
        (name) =>
          name.endsWith(
            '.json'
          )
      );
  } catch {
    return [];
  }
}

/* ==============================
   الاحتفاظ بآخر عدد
============================== */

async function keepLatest(
  prefix: string,
  maximum: number
) {
  const names =
    await listFileNames();

  const matching =
    names
      .filter(
        (name) =>
          name.startsWith(
            prefix
          )
      )
      .sort()
      .reverse();

  const oldFiles =
    matching.slice(
      maximum
    );

  for (
    const fileName
    of oldFiles
  ) {
    try {
      await Filesystem.deleteFile({
        path:
          `${BACKUP_FOLDER}/${fileName}`,

        directory:
          Directory.Data,
      });
    } catch {
      // تجاهل
    }
  }
}

/* ==============================
   نسخة يومية محلية
============================== */

export async function createDailyBackup() {
  const fileName =
    dailyFileName();

  if (
    !(await fileExists(
      fileName
    ))
  ) {
    const backup =
      makeBackup(
        'daily'
      );

    await writeBackupFile(
      fileName,
      backup
    );
  }

  await keepLatest(
    'daily-',
    7
  );

  return true;
}

/* ==============================
   نسخة أسبوعية محلية
============================== */

export async function createWeeklyBackup() {
  const fileName =
    weeklyFileName();

  if (
    !(await fileExists(
      fileName
    ))
  ) {
    const backup =
      makeBackup(
        'weekly'
      );

    await writeBackupFile(
      fileName,
      backup
    );
  }

  await keepLatest(
    'weekly-',
    4
  );

  return true;
}

/* ==============================
   رفع النسخة اليومية إلى Drive
============================== */

async function uploadDailyBackupToDrive() {
  const today =
    dateId();

  const alreadyUploaded =
    localStorage.getItem(
      DAILY_DRIVE_MARKER
    );

  if (
    alreadyUploaded ===
    today
  ) {
    return true;
  }

  const fileName =
    dailyFileName();

  const backup =
    await readBackupFile(
      fileName
    );

  await uploadBackupObjectToDrive(
    dailyDriveFileName(),
    backup
  );

  localStorage.setItem(
    DAILY_DRIVE_MARKER,
    today
  );

  return true;
}

/* ==============================
   رفع النسخة الأسبوعية إلى Drive
============================== */

async function uploadWeeklyBackupToDrive() {
  const currentWeek =
    weekId();

  const alreadyUploaded =
    localStorage.getItem(
      WEEKLY_DRIVE_MARKER
    );

  if (
    alreadyUploaded ===
    currentWeek
  ) {
    return true;
  }

  const fileName =
    weeklyFileName();

  const backup =
    await readBackupFile(
      fileName
    );

  await uploadBackupObjectToDrive(
    weeklyDriveFileName(),
    backup
  );

  localStorage.setItem(
    WEEKLY_DRIVE_MARKER,
    currentWeek
  );

  return true;
}

/* ==============================
   النسخ التلقائي
============================== */

export async function runAutomaticBackup() {
  try {
    /*
      أولًا نحفظ النسخة
      محليًا على الجهاز
    */

    await createDailyBackup();

    await createWeeklyBackup();

    /*
      ثم نحاول رفعها
      إلى Google Drive
    */

    try {
      await uploadDailyBackupToDrive();
    } catch (error) {
      console.error(
        'خطأ رفع النسخة اليومية إلى Google Drive:',
        error
      );
    }

    try {
      await uploadWeeklyBackupToDrive();
    } catch (error) {
      console.error(
        'خطأ رفع النسخة الأسبوعية إلى Google Drive:',
        error
      );
    }

    /*
      نجاح النسخة المحلية
      يعتبر نجاحًا حتى لو
      تعذر الإنترنت مؤقتًا
    */

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
  const backup =
    makeBackup(
      'manual'
    );

  const fileName =
    manualFileName();

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
    makeBackup(
      'before_restore'
    );

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
  validateBackup(
    backup
  );

  await createBeforeRestoreBackup();

  const keysToDelete:
    string[] = [];

  for (
    let i = 0;
    i < localStorage.length;
    i++
  ) {
    const key =
      localStorage.key(i);

    if (
      key &&
      isAppDataKey(
        key
      )
    ) {
      keysToDelete.push(
        key
      );
    }
  }

  keysToDelete.forEach(
    (key) => {
      localStorage.removeItem(
        key
      );
    }
  );

  Object.entries(
    backup.data
  ).forEach(
    ([key, value]) => {
      localStorage.setItem(
        key,
        value
      );
    }
  );

  return true;
}

/* ==============================
   جلب النسخ
============================== */

export async function getSavedBackups():
  Promise<SavedBackup[]> {
  const names =
    await listFileNames();

  const backups:
    SavedBackup[] = [];

  for (
    const fileName
    of names
  ) {
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
    !fileName.endsWith(
      '.json'
    )
  ) {
    return false;
  }

  await Filesystem.deleteFile({
    path:
      `${BACKUP_FOLDER}/${fileName}`,

    directory:
      Directory.Data,
  });

  return true;
}

/* ==============================
   تحويل إلى JSON
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
    JSON.parse(
      text
    ) as BackupFile;

  validateBackup(
    backup
  );

  return backup;
}

/* ==============================
   رابط الملف
============================== */

export async function getBackupFileUri(
  fileName: string
) {
  const result =
    await Filesystem.getUri({
      path:
        `${BACKUP_FOLDER}/${fileName}`,

      directory:
        Directory.Data,
    });

  return result.uri;
}

/* ==============================
   تصدير نسخة
============================== */

export async function saveBackupForExport(
  backup: BackupFile
) {
  validateBackup(
    backup
  );

  const fileName =
    `BAKR-PRO-BACKUP-` +
    `${dateTimeId()}.json`;

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
