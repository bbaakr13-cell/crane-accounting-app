import {
  useEffect,
  useState,
} from 'react';

import {
  Archive,
  Download,
  Upload,
  RotateCcw,
  Trash2,
  ShieldCheck,
  Database,
  CalendarDays,
  Clock,
  RefreshCw,
  CloudUpload,
  Cloud,
} from 'lucide-react';

import {
  Share,
} from '@capacitor/share';

import {
  type BackupFile,
  type SavedBackup,
  createManualBackup,
  deleteBackup,
  getSavedBackups,
  getBackupFileUri,
  parseBackupFile,
  restoreBackup,
  runAutomaticBackup,
} from '@/lib/backup';

import {
  uploadBackupObjectToDrive,
  listDriveBackups,
  downloadBackupFromDrive,
  deleteDriveBackup,
} from '@/lib/googleDrive';

type DriveBackup = {
  id: string;
  name: string;
  mimeType?: string;
  createdTime?: string;
};

function formatDate(
  value: string
) {
  try {
    return new Intl.DateTimeFormat(
      'ar-SA',
      {
        dateStyle:
          'medium',

        timeStyle:
          'short',
      }
    ).format(
      new Date(value)
    );
  } catch {
    return value;
  }
}

function getTypeName(
  type: BackupFile['type']
) {
  switch (type) {
    case 'daily':
      return 'نسخة يومية';

    case 'weekly':
      return 'نسخة أسبوعية';

    case 'manual':
      return 'نسخة يدوية';

    case 'before_restore':
      return 'نسخة أمان قبل الاستعادة';

    default:
      return 'نسخة احتياطية';
  }
}

function getDriveBackupName(
  fileName: string
) {
  if (
    fileName.includes(
      'DAILY'
    )
  ) {
    return 'نسخة يومية';
  }

  if (
    fileName.includes(
      'WEEKLY'
    )
  ) {
    return 'نسخة أسبوعية';
  }

  return 'نسخة Google Drive';
}

export function BackupPage() {
  const [
    backups,
    setBackups,
  ] = useState<
    SavedBackup[]
  >([]);

  const [
    driveBackups,
    setDriveBackups,
  ] = useState<
    DriveBackup[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    driveLoading,
    setDriveLoading,
  ] = useState(false);

  const [
    working,
    setWorking,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState('');

  const [
    isError,
    setIsError,
  ] = useState(false);

  function showMessage(
    text: string,
    error = false
  ) {
    setMessage(text);
    setIsError(error);

    window.setTimeout(
      () => {
        setMessage('');
      },
      3500
    );
  }

  async function loadBackups() {
    try {
      const list =
        await getSavedBackups();

      setBackups(list);
    } catch (error) {
      console.error(
        error
      );

      showMessage(
        'تعذر قراءة النسخ الاحتياطية',
        true
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadDriveBackups(
    showSuccess = false
  ) {
    if (driveLoading) {
      return;
    }

    setDriveLoading(true);

    try {
      const list =
        await listDriveBackups();

      setDriveBackups(
        list.filter(
          (item) =>
            item.name
              .toLowerCase()
              .endsWith(
                '.json'
              )
        )
      );

      if (showSuccess) {
        showMessage(
          'تم تحديث نسخ Google Drive'
        );
      }
    } catch (error) {
      console.error(
        'Drive list error:',
        error
      );

      showMessage(
        'تعذر قراءة النسخ من Google Drive',
        true
      );
    } finally {
      setDriveLoading(false);
    }
  }

  useEffect(() => {
    loadBackups();

    loadDriveBackups();
  }, []);

  const dailyCount =
    backups.filter(
      (item) =>
        item.backup.type ===
        'daily'
    ).length;

  const weeklyCount =
    backups.filter(
      (item) =>
        item.backup.type ===
        'weekly'
    ).length;

  const lastBackup =
    backups.length > 0
      ? backups[0].backup
      : null;

  /* ==========================
     إنشاء نسخة محلية
  ========================== */

  async function handleManualBackup() {
    if (working) {
      return;
    }

    setWorking(true);

    try {
      const result =
        await createManualBackup();

      await loadBackups();

      showMessage(
        `تم إنشاء النسخة الاحتياطية - ${formatDate(
          result.backup.createdAt
        )}`
      );
    } catch (error) {
      console.error(
        error
      );

      showMessage(
        'تعذر إنشاء النسخة الاحتياطية',
        true
      );
    } finally {
      setWorking(false);
    }
  }

  /* ==========================
     رفع نسخة مباشرة إلى Drive
  ========================== */

  async function handleSaveToDrive() {
    if (working) {
      return;
    }

    setWorking(true);
    setMessage('');

    try {
      const result =
        await createManualBackup();

      const driveFileName =
        `BAKR-PRO-BACKUP-${Date.now()}.json`;

      await uploadBackupObjectToDrive(
        driveFileName,
        result.backup
      );

      await loadBackups();

      await loadDriveBackups();

      showMessage(
        'تم حفظ النسخة في Google Drive بنجاح'
      );
    } catch (error) {
      console.error(
        'Drive backup error:',
        error
      );

      showMessage(
        'تعذر حفظ النسخة في Google Drive',
        true
      );
    } finally {
      setWorking(false);
    }
  }

  /* ==========================
     تحديث النسخ التلقائية
  ========================== */

  async function handleAutomaticBackup() {
    if (working) {
      return;
    }

    setWorking(true);

    try {
      const success =
        await runAutomaticBackup();

      await loadBackups();

      if (success) {
        showMessage(
          'تم تحديث النسخ التلقائية بنجاح'
        );
      } else {
        showMessage(
          'تعذر تحديث النسخ التلقائية',
          true
        );
      }
    } catch (error) {
      console.error(
        error
      );

      showMessage(
        'تعذر تحديث النسخ التلقائية',
        true
      );
    } finally {
      setWorking(false);
    }
  }

  /* ==========================
     استعادة نسخة محلية
  ========================== */

  async function handleRestore(
    backup: BackupFile
  ) {
    const approved =
      window.confirm(
        'هل تريد استعادة هذه النسخة؟\n\n' +
          'سيتم استبدال بيانات التطبيق الحالية بالبيانات الموجودة في النسخة.\n\n' +
          'سيتم إنشاء نسخة أمان من بياناتك الحالية قبل الاستعادة.'
      );

    if (!approved) {
      return;
    }

    setWorking(true);

    try {
      await restoreBackup(
        backup
      );

      window.alert(
        'تمت استعادة النسخة الاحتياطية بنجاح.\nسيتم إعادة تحميل التطبيق الآن.'
      );

      window.location.reload();
    } catch (error) {
      console.error(
        error
      );

      window.alert(
        'تعذر استعادة النسخة الاحتياطية.'
      );
    } finally {
      setWorking(false);
    }
  }

  /* ==========================
     استعادة من Google Drive
  ========================== */

  async function handleDriveRestore(
    item: DriveBackup
  ) {
    if (working) {
      return;
    }

    const approved =
      window.confirm(
        'هل تريد استعادة هذه النسخة من Google Drive؟\n\n' +
          `اسم الملف:\n${item.name}\n\n` +
          'سيتم استبدال بيانات التطبيق الحالية بالبيانات الموجودة في النسخة.\n\n' +
          'سيتم إنشاء نسخة أمان من بياناتك الحالية قبل الاستعادة.'
      );

    if (!approved) {
      return;
    }

    setWorking(true);

    try {
      const text =
        await downloadBackupFromDrive(
          item.id
        );

      const backup =
        parseBackupFile(
          text
        );

      await restoreBackup(
        backup
      );

      window.alert(
        'تمت استعادة النسخة من Google Drive بنجاح.\nسيتم إعادة تحميل التطبيق الآن.'
      );

      window.location.reload();
    } catch (error) {
      console.error(
        'Drive restore error:',
        error
      );

      window.alert(
        'تعذر استعادة النسخة من Google Drive.\nتأكد أن الملف نسخة صحيحة لـ BAKR PRO.'
      );
    } finally {
      setWorking(false);
    }
  }

  /* ==========================
     حذف نسخة محلية
  ========================== */

  async function handleDelete(
    fileName: string,
    backup: BackupFile
  ) {
    const approved =
      window.confirm(
        `هل تريد حذف ${getTypeName(
          backup.type
        )}؟`
      );

    if (!approved) {
      return;
    }

    setWorking(true);

    try {
      await deleteBackup(
        fileName
      );

      await loadBackups();

      showMessage(
        'تم حذف النسخة الاحتياطية'
      );
    } catch (error) {
      console.error(
        error
      );

      showMessage(
        'تعذر حذف النسخة',
        true
      );
    } finally {
      setWorking(false);
    }
  }

  /* ==========================
     حذف نسخة من Google Drive
  ========================== */

  async function handleDriveDelete(
    item: DriveBackup
  ) {
    if (working) {
      return;
    }

    const approved =
      window.confirm(
        'هل تريد حذف هذه النسخة من Google Drive نهائيًا؟\n\n' +
          item.name
      );

    if (!approved) {
      return;
    }

    setWorking(true);

    try {
      await deleteDriveBackup(
        item.id
      );

      await loadDriveBackups();

      showMessage(
        'تم حذف النسخة من Google Drive'
      );
    } catch (error) {
      console.error(
        'Drive delete error:',
        error
      );

      showMessage(
        'تعذر حذف النسخة من Google Drive',
        true
      );
    } finally {
      setWorking(false);
    }
  }

  /* ==========================
     تصدير نسخة محلية
  ========================== */

  async function handleShare(
    fileName: string,
    backup: BackupFile
  ) {
    if (working) {
      return;
    }

    setWorking(true);

    try {
      const uri =
        await getBackupFileUri(
          fileName
        );

      await Share.share({
        title:
          'نسخة BAKR PRO الاحتياطية',

        text:
          `نسخة احتياطية لتطبيق BAKR PRO\n` +
          `التاريخ: ${formatDate(
            backup.createdAt
          )}`,

        url: uri,

        dialogTitle:
          'حفظ أو مشاركة النسخة الاحتياطية',
      });
    } catch (error) {
      console.error(
        error
      );

      showMessage(
        'تعذر تصدير النسخة الاحتياطية',
        true
      );
    } finally {
      setWorking(false);
    }
  }

  /* ==========================
     استيراد ملف
  ========================== */

  async function handleImport(
    event:
      React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    event.target.value = '';

    if (!file) {
      return;
    }

    setWorking(true);

    try {
      const text =
        await file.text();

      const backup =
        parseBackupFile(
          text
        );

      const approved =
        window.confirm(
          'تم العثور على نسخة احتياطية صالحة.\n\n' +
            `تاريخ النسخة: ${formatDate(
              backup.createdAt
            )}\n\n` +
            'هل تريد استعادتها الآن؟\n' +
            'سيتم إنشاء نسخة أمان من بياناتك الحالية أولًا.'
        );

      if (!approved) {
        setWorking(false);
        return;
      }

      await restoreBackup(
        backup
      );

      window.alert(
        'تم استيراد واستعادة النسخة بنجاح.\nسيتم إعادة تحميل التطبيق الآن.'
      );

      window.location.reload();
    } catch (error) {
      console.error(
        error
      );

      window.alert(
        'الملف المحدد ليس نسخة احتياطية صالحة لـ BAKR PRO.'
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <div
      dir="rtl"
      style={{
        minHeight:
          '100vh',

        background:
          'linear-gradient(180deg, #07101f 0%, #0b1628 100%)',

        color:
          '#ffffff',

        padding:
          '82px 16px 40px',
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            textAlign:
              'center',

            marginBottom:
              24,
          }}
        >
          <div
            style={{
              width: 68,
              height: 68,

              margin:
                '0 auto 12px',

              borderRadius:
                22,

              background:
                'linear-gradient(135deg, #2563eb, #1d4ed8)',

              display:
                'flex',

              alignItems:
                'center',

              justifyContent:
                'center',

              boxShadow:
                '0 12px 35px rgba(37,99,235,0.28)',
            }}
          >
            <ShieldCheck
              size={36}
            />
          </div>

          <h1
            style={{
              margin: 0,

              fontSize:
                25,

              fontWeight:
                900,
            }}
          >
            النسخ الاحتياطي والاستعادة
          </h1>

          <p
            style={{
              margin:
                '8px 0 0',

              color:
                '#94a3b8',

              fontSize:
                14,

              lineHeight:
                1.8,
            }}
          >
            حماية بيانات BAKR PRO واستعادتها عند الحاجة
          </p>
        </div>

        <div
          style={{
            padding: 18,

            borderRadius:
              20,

            background:
              'rgba(15,30,52,0.96)',

            border:
              '1px solid rgba(255,255,255,0.08)',

            marginBottom:
              16,
          }}
        >
          <div
            style={{
              display:
                'flex',

              alignItems:
                'center',

              gap: 12,
            }}
          >
            <Database
              size={27}
              color="#60a5fa"
            />

            <div>
              <div
                style={{
                  fontWeight:
                    900,

                  fontSize:
                    16,
                }}
              >
                حالة النسخ الاحتياطي
              </div>

              <div
                style={{
                  color:
                    '#94a3b8',

                  fontSize:
                    13,

                  marginTop:
                    4,
                }}
              >
                {lastBackup
                  ? `آخر نسخة: ${formatDate(
                      lastBackup.createdAt
                    )}`
                  : 'لا توجد نسخة احتياطية حتى الآن'}
              </div>
            </div>
          </div>

          <div
            style={{
              display:
                'grid',

              gridTemplateColumns:
                'repeat(2, minmax(0, 1fr))',

              gap: 10,

              marginTop:
                16,
            }}
          >
            <div
              style={{
                padding:
                  13,

                background:
                  'rgba(255,255,255,0.04)',

                borderRadius:
                  14,

                textAlign:
                  'center',
              }}
            >
              <CalendarDays
                size={20}
                style={{
                  margin:
                    '0 auto 5px',
                }}
              />

              <strong>
                {dailyCount} / 7
              </strong>

              <div
                style={{
                  color:
                    '#94a3b8',

                  fontSize:
                    12,

                  marginTop:
                    3,
                }}
              >
                نسخ يومية
              </div>
            </div>

            <div
              style={{
                padding:
                  13,

                background:
                  'rgba(255,255,255,0.04)',

                borderRadius:
                  14,

                textAlign:
                  'center',
              }}
            >
              <Clock
                size={20}
                style={{
                  margin:
                    '0 auto 5px',
                }}
              />

              <strong>
                {weeklyCount} / 4
              </strong>

              <div
                style={{
                  color:
                    '#94a3b8',

                  fontSize:
                    12,

                  marginTop:
                    3,
                }}
              >
                نسخ أسبوعية
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display:
              'grid',

            gap: 11,

            marginBottom:
              22,
          }}
        >
          <button
            type="button"
            onClick={
              handleSaveToDrive
            }
            disabled={
              working
            }
            style={{
              ...driveButton,

              opacity:
                working
                  ? 0.6
                  : 1,
            }}
          >
            <CloudUpload
              size={23}
            />

            حفظ نسخة في Google Drive
          </button>

          <button
            type="button"
            onClick={
              handleManualBackup
            }
            disabled={
              working
            }
            style={{
              ...primaryButton,

              opacity:
                working
                  ? 0.6
                  : 1,
            }}
          >
            {working ? (
              <RefreshCw
                size={22}
              />
            ) : (
              <Archive
                size={22}
              />
            )}

            إنشاء نسخة محلية الآن
          </button>

          <button
            type="button"
            onClick={
              handleAutomaticBackup
            }
            disabled={
              working
            }
            style={{
              ...normalButton,

              opacity:
                working
                  ? 0.6
                  : 1,
            }}
          >
            <ShieldCheck
              size={22}
            />

            تحديث النسخ التلقائية
          </button>

          <label
            style={{
              ...normalButton,

              cursor:
                working
                  ? 'default'
                  : 'pointer',

              opacity:
                working
                  ? 0.6
                  : 1,
            }}
          >
            <Upload
              size={22}
            />

            استيراد واستعادة نسخة من ملف

            <input
              type="file"
              accept=".json,application/json"
              disabled={
                working
              }
              onChange={
                handleImport
              }
              style={{
                display:
                  'none',
              }}
            />
          </label>
        </div>

        {message && (
          <div
            style={{
              padding:
                13,

              borderRadius:
                14,

              marginBottom:
                16,

              textAlign:
                'center',

              fontWeight:
                800,

              background:
                isError
                  ? 'rgba(239,68,68,0.12)'
                  : 'rgba(34,197,94,0.12)',

              border:
                isError
                  ? '1px solid rgba(239,68,68,0.28)'
                  : '1px solid rgba(34,197,94,0.28)',

              color:
                isError
                  ? '#fca5a5'
                  : '#86efac',
            }}
          >
            {message}
          </div>
        )}

        {/* =====================
            GOOGLE DRIVE
        ====================== */}

        <div
          style={{
            padding:
              16,

            borderRadius:
              20,

            background:
              'rgba(15,30,52,0.96)',

            border:
              '1px solid rgba(34,197,94,0.20)',

            marginBottom:
              22,
          }}
        >
          <div
            style={{
              display:
                'flex',

              alignItems:
                'center',

              justifyContent:
                'space-between',

              gap:
                10,

              marginBottom:
                14,
            }}
          >
            <div
              style={{
                display:
                  'flex',

                alignItems:
                  'center',

                gap:
                  9,

                fontSize:
                  18,

                fontWeight:
                  900,
              }}
            >
              <Cloud
                size={24}
                color="#4ade80"
              />

              نسخ Google Drive
            </div>

            <button
              type="button"
              disabled={
                driveLoading ||
                working
              }
              onClick={() =>
                loadDriveBackups(
                  true
                )
              }
              style={{
                border:
                  '1px solid rgba(255,255,255,0.10)',

                borderRadius:
                  11,

                padding:
                  '8px 10px',

                background:
                  'rgba(255,255,255,0.05)',

                color:
                  '#ffffff',

                display:
                  'flex',

                alignItems:
                  'center',

                gap:
                  5,

                fontWeight:
                  800,
              }}
            >
              <RefreshCw
                size={17}
              />

              تحديث
            </button>
          </div>

          {driveLoading ? (
            <div
              style={
                driveEmptyBox
              }
            >
              جاري قراءة Google Drive...
            </div>
          ) : driveBackups.length ===
            0 ? (
            <div
              style={
                driveEmptyBox
              }
            >
              لا توجد نسخ في Google Drive
            </div>
          ) : (
            <div
              style={{
                display:
                  'grid',

                gap:
                  9,
              }}
            >
              {driveBackups.map(
                (item) => (
                  <div
                    key={
                      item.id
                    }
                    style={{
                      padding:
                        13,

                      borderRadius:
                        14,

                      background:
                        'rgba(255,255,255,0.04)',

                      border:
                        '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <div
                      style={{
                        fontWeight:
                          900,

                        fontSize:
                          14,
                      }}
                    >
                      {getDriveBackupName(
                        item.name
                      )}
                    </div>

                    <div
                      style={{
                        color:
                          '#cbd5e1',

                        fontSize:
                          11,

                        marginTop:
                          5,

                        wordBreak:
                          'break-all',
                      }}
                    >
                      {item.name}
                    </div>

                    {item.createdTime && (
                      <div
                        style={{
                          color:
                            '#94a3b8',

                          fontSize:
                            11,

                          marginTop:
                            5,
                        }}
                      >
                        {formatDate(
                          item.createdTime
                        )}
                      </div>
                    )}

                    <div
                      style={{
                        display:
                          'grid',

                        gridTemplateColumns:
                          '1fr 1fr',

                        gap:
                          7,

                        marginTop:
                          11,
                      }}
                    >
                      <button
                        type="button"
                        disabled={
                          working
                        }
                        onClick={() =>
                          handleDriveRestore(
                            item
                          )
                        }
                        style={{
                          ...smallButton,

                          color:
                            '#86efac',
                        }}
                      >
                        <RotateCcw
                          size={17}
                        />

                        استعادة
                      </button>

                      <button
                        type="button"
                        disabled={
                          working
                        }
                        onClick={() =>
                          handleDriveDelete(
                            item
                          )
                        }
                        style={{
                          ...smallButton,

                          color:
                            '#fca5a5',
                        }}
                      >
                        <Trash2
                          size={17}
                        />

                        حذف
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* =====================
            LOCAL BACKUPS
        ====================== */}

        <div
          style={{
            marginBottom:
              10,

            fontSize:
              18,

            fontWeight:
              900,
          }}
        >
          النسخ المحفوظة على الجهاز
        </div>

        {loading ? (
          <div
            style={
              emptyBox
            }
          >
            جاري قراءة النسخ...
          </div>
        ) : backups.length ===
          0 ? (
          <div
            style={
              emptyBox
            }
          >
            لا توجد نسخ احتياطية محفوظة
          </div>
        ) : (
          <div
            style={{
              display:
                'grid',

              gap: 10,
            }}
          >
            {backups.map(
              ({
                fileName,
                backup,
              }) => (
                <div
                  key={
                    fileName
                  }
                  style={{
                    padding:
                      15,

                    borderRadius:
                      18,

                    background:
                      'rgba(15,30,52,0.96)',

                    border:
                      '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div
                    style={{
                      fontWeight:
                        900,

                      fontSize:
                        15,
                    }}
                  >
                    {getTypeName(
                      backup.type
                    )}
                  </div>

                  <div
                    style={{
                      color:
                        '#94a3b8',

                      fontSize:
                        12,

                      marginTop:
                        5,
                    }}
                  >
                    {formatDate(
                      backup.createdAt
                    )}
                  </div>

                  <div
                    style={{
                      display:
                        'grid',

                      gridTemplateColumns:
                        'repeat(3, 1fr)',

                      gap:
                        7,

                      marginTop:
                        13,
                    }}
                  >
                    <button
                      type="button"
                      disabled={
                        working
                      }
                      onClick={() =>
                        handleRestore(
                          backup
                        )
                      }
                      style={
                        smallButton
                      }
                    >
                      <RotateCcw
                        size={17}
                      />

                      استعادة
                    </button>

                    <button
                      type="button"
                      disabled={
                        working
                      }
                      onClick={() =>
                        handleShare(
                          fileName,
                          backup
                        )
                      }
                      style={
                        smallButton
                      }
                    >
                      <Download
                        size={17}
                      />

                      تصدير
                    </button>

                    <button
                      type="button"
                      disabled={
                        working
                      }
                      onClick={() =>
                        handleDelete(
                          fileName,
                          backup
                        )
                      }
                      style={{
                        ...smallButton,

                        color:
                          '#fca5a5',
                      }}
                    >
                      <Trash2
                        size={17}
                      />

                      حذف
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        <div
          style={{
            marginTop:
              20,

            padding:
              15,

            borderRadius:
              16,

            background:
              'rgba(59,130,246,0.08)',

            border:
              '1px solid rgba(59,130,246,0.18)',

            color:
              '#bfdbfe',

            fontSize:
              13,

            lineHeight:
              1.9,
          }}
        >
          🛡️ يحتفظ BAKR PRO بنسخ محلية،
          ويمكن حفظ واستعادة النسخ مباشرة
          من Google Drive. كما يحتفظ التطبيق
          بآخر 7 نسخ يومية و4 نسخ أسبوعية.
        </div>
      </div>
    </div>
  );
}

const driveButton:
  React.CSSProperties = {
  width:
    '100%',

  border:
    '1px solid rgba(34,197,94,0.35)',

  borderRadius:
    16,

  padding:
    '16px',

  background:
    'linear-gradient(135deg, #16a34a, #15803d)',

  color:
    '#ffffff',

  fontSize:
    15,

  fontWeight:
    900,

  display:
    'flex',

  alignItems:
    'center',

  justifyContent:
    'center',

  gap:
    9,

  cursor:
    'pointer',
};

const primaryButton:
  React.CSSProperties = {
  width:
    '100%',

  border:
    0,

  borderRadius:
    16,

  padding:
    '15px 16px',

  background:
    'linear-gradient(135deg, #2563eb, #1d4ed8)',

  color:
    '#ffffff',

  fontSize:
    15,

  fontWeight:
    900,

  display:
    'flex',

  alignItems:
    'center',

  justifyContent:
    'center',

  gap:
    9,

  cursor:
    'pointer',
};

const normalButton:
  React.CSSProperties = {
  width:
    '100%',

  boxSizing:
    'border-box',

  border:
    '1px solid rgba(255,255,255,0.10)',

  borderRadius:
    16,

  padding:
    '14px 16px',

  background:
    'rgba(15,30,52,0.96)',

  color:
    '#ffffff',

  fontSize:
    14,

  fontWeight:
    800,

  display:
    'flex',

  alignItems:
    'center',

  justifyContent:
    'center',

  gap:
    9,
};

const smallButton:
  React.CSSProperties = {
  border:
    '1px solid rgba(255,255,255,0.09)',

  borderRadius:
    11,

  padding:
    '9px 5px',

  background:
    'rgba(255,255,255,0.04)',

  color:
    '#ffffff',

  fontSize:
    12,

  fontWeight:
    800,

  display:
    'flex',

  alignItems:
    'center',

  justifyContent:
    'center',

  gap:
    4,

  cursor:
    'pointer',
};

const emptyBox:
  React.CSSProperties = {
  padding:
    30,

  textAlign:
    'center',

  borderRadius:
    18,

  color:
    '#94a3b8',

  background:
    'rgba(255,255,255,0.035)',

  border:
    '1px solid rgba(255,255,255,0.07)',
};

const driveEmptyBox:
  React.CSSProperties = {
  padding:
    22,

  textAlign:
    'center',

  borderRadius:
    14,

  color:
    '#94a3b8',

  background:
    'rgba(255,255,255,0.025)',

  border:
    '1px solid rgba(255,255,255,0.06)',
};
