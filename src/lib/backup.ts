import {
  Directory,
  Encoding,
  Filesystem,
} from '@capacitor/filesystem';

import {
  uploadBackupObjectToDrive,
} from '@/lib/googleDrive';

import {
  supabase,
} from '@/lib/supabase';

/* ==============================
   إعدادات النسخ
============================== */

const BACKUP_FOLDER =
  'BAAKR_PRO_BACKUPS';

const APP_STORAGE_PREFIXES = [
  'crane_accounting_',
  'monthly-ledger-',
];

const APP_STORAGE_KEYS = [
  'crane_accounting_offline_db_v2',
  'crane_drivers_v1',
  'monthly-rentals',
  'baakr-work-invoice-v3',
];

const DAILY_DRIVE_MARKER =
  'bakr_drive_daily_uploaded';

const WEEKLY_DRIVE_MARKER =
  'bakr_drive_weekly_uploaded';

/* ==============================
   جداول Supabase
============================== */

const SUPABASE_TABLES = [
  'equipment',
  'customers',
  'jobs',
  'expenses',
  'payments',
  'invoices',
] as const;

export type SupabaseTableName =
  (typeof SUPABASE_TABLES)[number];

export type SupabaseBackupData =
  Record<
    SupabaseTableName,
    any[]
  >;

/* ==============================
   أنواع النسخة
============================== */

export type BackupType =
  | 'daily'
  | 'weekly'
  | 'manual'
  | 'before_restore';

export type BackupFile = {
  app:
    | 'BAKR PRO'
    | 'BAAKR PRO';

  version:
    | 2
    | 3;

  createdAt:
    string;

  type:
    BackupType;

  data:
    Record<
      string,
      string
    >;

  supabaseData?:
    SupabaseBackupData;
};

export type SavedBackup = {
  fileName:
    string;

  backup:
    BackupFile;
};

/* ==============================
   معرفة بيانات التطبيق المحلية
============================== */

function isAppDataKey(
  key: string
): boolean {
  if (
    APP_STORAGE_KEYS.includes(
      key
    )
  ) {
    return true;
  }

  return APP_STORAGE_PREFIXES.some(
    (prefix) =>
      key.startsWith(
        prefix
      )
  );
}

/* ==============================
   جمع localStorage
============================== */

function getAppData():
  Record<string, string> {
  const data:
    Record<
      string,
      string
    > = {};

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

    if (
      !isAppDataKey(
        key
      )
    ) {
      continue;
    }

    const value =
      localStorage.getItem(
        key
      );

    if (
      value !== null
    ) {
      data[key] =
        value;
    }
  }

  return data;
}

/* ==============================
   قراءة جدول كامل من Supabase
============================== */

async function fetchAllTableRows(
  table:
    SupabaseTableName
): Promise<any[]> {
  const allRows:
    any[] = [];

  const pageSize =
    500;

  let from =
    0;

  while (true) {
    const to =
      from +
      pageSize -
      1;

    const {
      data,
      error,
    } =
      await supabase
        .from(table)
        .select('*')
        .order(
          'id',
          {
            ascending:
              true,
          }
        )
        .range(
          from,
          to
        );

    if (error) {
      console.error(
        `Backup read ${table} error:`,
        error
      );

      throw new Error(
        `تعذر قراءة جدول ${table}`
      );
    }

    const rows =
      data || [];

    allRows.push(
      ...rows
    );

    if (
      rows.length <
      pageSize
    ) {
      break;
    }

    from +=
      pageSize;
  }

  return allRows;
}

/* ==============================
   جمع Supabase
============================== */

async function getSupabaseData():
  Promise<SupabaseBackupData> {
  const result =
    {} as SupabaseBackupData;

  for (
    const table
    of SUPABASE_TABLES
  ) {
    result[table] =
      await fetchAllTableRows(
        table
      );
  }

  return result;
}

/* ==============================
   إنشاء محتوى النسخة
============================== */

async function makeBackup(
  type: BackupType
): Promise<BackupFile> {
  const localData =
    getAppData();

  const supabaseData =
    await getSupabaseData();

  return {
    app:
      'BAKR PRO',

    version:
      3,

    createdAt:
      new Date()
        .toISOString(),

    type,

    data:
      localData,

    supabaseData,
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

  const validVersion =
    backup?.version ===
      2 ||
    backup?.version ===
      3;

  if (
    !backup ||
    !validApp ||
    !validVersion ||
    !backup.data ||
    typeof backup.data !==
      'object'
  ) {
    throw new Error(
      'ملف النسخة الاحتياطية غير صالح'
    );
  }

  if (
    backup.version ===
      3 &&
    (
      !backup.supabaseData ||
      typeof backup.supabaseData !==
        'object'
    )
  ) {
    throw new Error(
      'بيانات Supabase غير موجودة في النسخة'
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
      ) /
        7
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
   فحص نسخة يومية قديمة
============================== */

async function dailyBackupNeedsUpgrade(
  fileName: string
) {
  if (
    !(await fileExists(
      fileName
    ))
  ) {
    return true;
  }

  try {
    const backup =
      await readBackupFile(
        fileName
      );

    return (
      backup.version !==
      3
    );
  } catch {
    return true;
  }
}

/* ==============================
   فحص نسخة أسبوعية قديمة
============================== */

async function weeklyBackupNeedsUpgrade(
  fileName: string
) {
  if (
    !(await fileExists(
      fileName
    ))
  ) {
    return true;
  }

  try {
    const backup =
      await readBackupFile(
        fileName
      );

    return (
      backup.version !==
      3
    );
  } catch {
    return true;
  }
}

/* ==============================
   نسخة يومية محلية
============================== */

export async function createDailyBackup() {
  const fileName =
    dailyFileName();

  const needsUpgrade =
    await dailyBackupNeedsUpgrade(
      fileName
    );

  if (
    needsUpgrade
  ) {
    const backup =
      await makeBackup(
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

  const needsUpgrade =
    await weeklyBackupNeedsUpgrade(
      fileName
    );

  if (
    needsUpgrade
  ) {
    const backup =
      await makeBackup(
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

  const markerValue =
    `${today}-v3`;

  const alreadyUploaded =
    localStorage.getItem(
      DAILY_DRIVE_MARKER
    );

  if (
    alreadyUploaded ===
    markerValue
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
    markerValue
  );

  return true;
}

/* ==============================
   رفع النسخة الأسبوعية إلى Drive
============================== */

async function uploadWeeklyBackupToDrive() {
  const currentWeek =
    weekId();

  const markerValue =
    `${currentWeek}-v3`;

  const alreadyUploaded =
    localStorage.getItem(
      WEEKLY_DRIVE_MARKER
    );

  if (
    alreadyUploaded ===
    markerValue
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
    markerValue
  );

  return true;
}

/* ==============================
   النسخ التلقائي
============================== */

export async function runAutomaticBackup() {
  try {
    await createDailyBackup();

    await createWeeklyBackup();

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
    await makeBackup(
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
    await makeBackup(
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
   استعادة localStorage
============================== */

function restoreLocalData(
  backup: BackupFile
) {
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
      if (
        isAppDataKey(
          key
        )
      ) {
        localStorage.setItem(
          key,
          value
        );
      }
    }
  );
}

/* ==============================
   تقسيم السجلات
============================== */

function chunkRows<T>(
  rows: T[],
  size = 50
): T[][] {
  const chunks:
    T[][] = [];

  for (
    let i = 0;
    i < rows.length;
    i += size
  ) {
    chunks.push(
      rows.slice(
        i,
        i + size
      )
    );
  }

  return chunks;
}

/* ==============================
   استعادة جدول Supabase
============================== */

async function restoreSupabaseTable(
  table:
    SupabaseTableName,
  rows:
    any[]
) {
  if (
    !Array.isArray(
      rows
    ) ||
    rows.length ===
      0
  ) {
    return;
  }

  const chunks =
    chunkRows(
      rows,
      50
    );

  for (
    const chunk
    of chunks
  ) {
    const {
      error,
    } =
      await supabase
        .from(table)
        .upsert(
          chunk,
          {
            onConflict:
              'id',
          }
        );

    if (error) {
      console.error(
        `Restore ${table} error:`,
        error
      );

      throw new Error(
        `تعذر استعادة جدول ${table}`
      );
    }
  }
}

/* ==============================
   استعادة Supabase
============================== */

async function restoreSupabaseData(
  backup: BackupFile
) {
  if (
    backup.version !==
      3 ||
    !backup.supabaseData
  ) {
    return;
  }

  /*
    الترتيب مهم بسبب العلاقات:
    المعدات والعملاء أولاً
    ثم الأعمال والمصروفات
    ثم الدفعات والفواتير
  */

  await restoreSupabaseTable(
    'equipment',
    backup.supabaseData
      .equipment || []
  );

  await restoreSupabaseTable(
    'customers',
    backup.supabaseData
      .customers || []
  );

  await restoreSupabaseTable(
    'jobs',
    backup.supabaseData
      .jobs || []
  );

  await restoreSupabaseTable(
    'expenses',
    backup.supabaseData
      .expenses || []
  );

  await restoreSupabaseTable(
    'payments',
    backup.supabaseData
      .payments || []
  );

  await restoreSupabaseTable(
    'invoices',
    backup.supabaseData
      .invoices || []
  );
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

  /*
    أولاً ننشئ نسخة أمان شاملة
    من البيانات الحالية قبل أي تغيير.
  */

  await createBeforeRestoreBackup();

  /*
    استعادة البيانات السحابية أولاً.
    إذا حدث خطأ لن نمسح البيانات
    المحلية الحالية.
  */

  await restoreSupabaseData(
    backup
  );

  /*
    بعد نجاح Supabase
    نستعيد البيانات المحلية.
  */

  restoreLocalData(
    backup
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
