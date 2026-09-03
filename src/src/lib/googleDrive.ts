import {
  getGoogleAccessToken,
} from '@/lib/googleAuth';

const DRIVE_API =
  'https://www.googleapis.com/drive/v3';

const DRIVE_UPLOAD_API =
  'https://www.googleapis.com/upload/drive/v3/files';

const BACKUP_FOLDER_NAME =
  'BAKR PRO Backups';

type DriveFile = {
  id: string;
  name: string;
  mimeType?: string;
  createdTime?: string;
};

/* ==============================
   تنفيذ طلب Google Drive
============================== */

async function driveFetch(
  url: string,
  options: RequestInit = {}
) {
  const accessToken =
    await getGoogleAccessToken();

  const headers =
    new Headers(
      options.headers || {}
    );

  headers.set(
    'Authorization',
    `Bearer ${accessToken}`
  );

  const response =
    await fetch(
      url,
      {
        ...options,
        headers,
      }
    );

  if (!response.ok) {
    const errorText =
      await response.text();

    console.error(
      'Google Drive API error:',
      response.status,
      errorText
    );

    throw new Error(
      `Google Drive error ${response.status}`
    );
  }

  return response;
}

/* ==============================
   البحث عن مجلد النسخ
============================== */

async function findBackupFolder():
  Promise<string | null> {
  const query =
    [
      `name='${BACKUP_FOLDER_NAME}'`,
      `mimeType='application/vnd.google-apps.folder'`,
      `trashed=false`,
    ].join(' and ');

  const params =
    new URLSearchParams({
      q: query,
      spaces: 'drive',
      fields:
        'files(id,name)',
      pageSize: '1',
    });

  const response =
    await driveFetch(
      `${DRIVE_API}/files?${params.toString()}`
    );

  const data =
    await response.json();

  const files:
    DriveFile[] =
    data.files || [];

  return (
    files[0]?.id ||
    null
  );
}

/* ==============================
   إنشاء مجلد BAKR PRO Backups
============================== */

async function createBackupFolder():
  Promise<string> {
  const response =
    await driveFetch(
      `${DRIVE_API}/files?fields=id,name`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify({
            name:
              BACKUP_FOLDER_NAME,

            mimeType:
              'application/vnd.google-apps.folder',
          }),
      }
    );

  const data =
    await response.json();

  if (!data.id) {
    throw new Error(
      'تعذر إنشاء مجلد النسخ الاحتياطية'
    );
  }

  return data.id;
}

/* ==============================
   الحصول على مجلد النسخ
============================== */

async function getBackupFolderId():
  Promise<string> {
  const existing =
    await findBackupFolder();

  if (existing) {
    return existing;
  }

  return createBackupFolder();
}

/* ==============================
   رفع ملف نسخة إلى Drive
============================== */

export async function uploadBackupToDrive(
  fileName: string,
  backupData: string
) {
  const folderId =
    await getBackupFolderId();

  const metadata = {
    name: fileName,

    mimeType:
      'application/json',

    parents: [
      folderId,
    ],
  };

  const boundary =
    `BAKR_PRO_${Date.now()}`;

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${backupData}\r\n` +
    `--${boundary}--`;

  const response =
    await driveFetch(
      `${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,name,createdTime`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            `multipart/related; boundary=${boundary}`,
        },

        body,
      }
    );

  const data =
    await response.json();

  if (!data.id) {
    throw new Error(
      'لم يتم رفع النسخة إلى Google Drive'
    );
  }

  return {
    id:
      data.id as string,

    name:
      data.name as string,

    createdTime:
      data.createdTime as
        | string
        | undefined,
  };
}

/* ==============================
   رفع BackupFile مباشرة
============================== */

export async function uploadBackupObjectToDrive(
  fileName: string,
  backup: unknown
) {
  const backupData =
    JSON.stringify(
      backup,
      null,
      2
    );

  return uploadBackupToDrive(
    fileName,
    backupData
  );
}

/* ==============================
   جلب نسخ BAKR PRO من Drive
============================== */

export async function listDriveBackups():
  Promise<DriveFile[]> {
  const folderId =
    await getBackupFolderId();

  const query =
    `'${folderId}' in parents and trashed=false`;

  const params =
    new URLSearchParams({
      q: query,

      spaces:
        'drive',

      fields:
        'files(id,name,mimeType,createdTime)',

      orderBy:
        'createdTime desc',

      pageSize:
        '100',
    });

  const response =
    await driveFetch(
      `${DRIVE_API}/files?${params.toString()}`
    );

  const data =
    await response.json();

  return (
    data.files || []
  );
}

/* ==============================
   تنزيل نسخة من Drive
============================== */

export async function downloadBackupFromDrive(
  fileId: string
) {
  const response =
    await driveFetch(
      `${DRIVE_API}/files/${encodeURIComponent(
        fileId
      )}?alt=media`
    );

  return response.text();
}

/* ==============================
   حذف نسخة من Drive
============================== */

export async function deleteDriveBackup(
  fileId: string
) {
  await driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(
      fileId
    )}`,
    {
      method:
        'DELETE',
    }
  );

  return true;
}
