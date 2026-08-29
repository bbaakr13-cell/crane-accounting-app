import { useMemo, useState } from 'react';
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
} from 'lucide-react';

import {
  BackupFile,
  createManualBackup,
  deleteBackup,
  getSavedBackups,
  parseBackupFile,
  restoreBackup,
  runAutomaticBackup,
} from '@/lib/backup';

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getTypeName(type: BackupFile['type']) {
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

function downloadBackup(backup: BackupFile) {
  const content = JSON.stringify(backup, null, 2);

  const blob = new Blob([content], {
    type: 'application/json;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');

  const safeDate = backup.createdAt
    .replace(/:/g, '-')
    .replace(/\./g, '-');

  link.href = url;
  link.download = `BAAKR-PRO-BACKUP-${safeDate}.json`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

export function BackupPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [message, setMessage] = useState('');

  const backups = useMemo(() => {
    return getSavedBackups();
  }, [refreshKey]);

  const dailyCount = backups.filter(
    (item) => item.backup.type === 'daily'
  ).length;

  const weeklyCount = backups.filter(
    (item) => item.backup.type === 'weekly'
  ).length;

  const lastBackup = backups[0]?.backup;

  function refresh() {
    setRefreshKey((value) => value + 1);
  }

  function showMessage(text: string) {
    setMessage(text);

    window.setTimeout(() => {
      setMessage('');
    }, 3000);
  }

  function handleManualBackup() {
    try {
      const backup = createManualBackup();

      refresh();

      showMessage(
        `تم إنشاء النسخة الاحتياطية بنجاح - ${formatDate(
          backup.createdAt
        )}`
      );
    } catch (error) {
      console.error(error);
      showMessage('تعذر إنشاء النسخة الاحتياطية');
    }
  }

  function handleAutomaticBackup() {
    try {
      runAutomaticBackup();
      refresh();

      showMessage('تم تحديث النسخ التلقائية بنجاح');
    } catch (error) {
      console.error(error);
      showMessage('حدث خطأ أثناء النسخ التلقائي');
    }
  }

  function handleRestore(
    backup: BackupFile
  ) {
    const approved = window.confirm(
      'هل تريد استعادة هذه النسخة؟\n\n' +
        'سيتم استبدال بيانات التطبيق الحالية بالبيانات الموجودة في النسخة.\n\n' +
        'سيقوم BAAKR PRO بإنشاء نسخة أمان من البيانات الحالية قبل الاستعادة.'
    );

    if (!approved) return;

    try {
      restoreBackup(backup);

      window.alert(
        'تمت استعادة النسخة الاحتياطية بنجاح.\nسيتم إعادة تحميل التطبيق الآن.'
      );

      window.location.reload();
    } catch (error) {
      console.error(error);

      window.alert(
        'تعذر استعادة النسخة الاحتياطية.'
      );
    }
  }

  function handleDelete(
    key: string,
    backup: BackupFile
  ) {
    const approved = window.confirm(
      `هل تريد حذف ${getTypeName(
        backup.type
      )}؟`
    );

    if (!approved) return;

    deleteBackup(key);
    refresh();

    showMessage('تم حذف النسخة');
  }

  async function handleImport(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file) return;

    try {
      const text = await file.text();

      const backup = parseBackupFile(text);

      const approved = window.confirm(
        'تم العثور على نسخة احتياطية صالحة.\n\n' +
          `تاريخ النسخة: ${formatDate(
            backup.createdAt
          )}\n\n` +
          'هل تريد استعادتها الآن؟\n' +
          'سيتم إنشاء نسخة أمان من البيانات الحالية أولًا.'
      );

      if (!approved) return;

      restoreBackup(backup);

      window.alert(
        'تم استيراد واستعادة النسخة بنجاح.\nسيتم إعادة تحميل التطبيق.'
      );

      window.location.reload();
    } catch (error) {
      console.error(error);

      window.alert(
        'الملف المحدد ليس نسخة احتياطية صالحة لـ BAAKR PRO.'
      );
    }
  }

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(180deg, #07101f 0%, #0b1628 100%)',
        color: '#ffffff',
        padding: '82px 16px 40px',
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: '0 auto',
        }}
      >
        {/* العنوان */}

        <div
          style={{
            textAlign: 'center',
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 68,
              height: 68,
              margin: '0 auto 12px',
              borderRadius: 22,
              background:
                'linear-gradient(135deg, #2563eb, #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow:
                '0 12px 35px rgba(37,99,235,0.28)',
            }}
          >
            <ShieldCheck size={36} />
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 25,
              fontWeight: 900,
            }}
          >
            النسخ الاحتياطي والاستعادة
          </h1>

          <p
            style={{
              margin: '8px 0 0',
              color: '#94a3b8',
              fontSize: 14,
              lineHeight: 1.8,
            }}
          >
            حماية بيانات BAAKR PRO واستعادتها عند الحاجة
          </p>
        </div>

        {/* حالة الحماية */}

        <div
          style={{
            padding: 18,
            borderRadius: 20,
            background:
              'rgba(15, 30, 52, 0.96)',
            border:
              '1px solid rgba(255,255,255,0.08)',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
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
                  fontWeight: 900,
                  fontSize: 16,
                }}
              >
                حالة النسخ الاحتياطي
              </div>

              <div
                style={{
                  color: '#94a3b8',
                  fontSize: 13,
                  marginTop: 4,
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
              display: 'grid',
              gridTemplateColumns:
                'repeat(2, minmax(0, 1fr))',
              gap: 10,
              marginTop: 16,
            }}
          >
            <div
              style={{
                padding: 13,
                background:
                  'rgba(255,255,255,0.04)',
                borderRadius: 14,
                textAlign: 'center',
              }}
            >
              <CalendarDays
                size={20}
                style={{
                  margin: '0 auto 5px',
                }}
              />

              <strong>
                {dailyCount} / 7
              </strong>

              <div
                style={{
                  color: '#94a3b8',
                  fontSize: 12,
                  marginTop: 3,
                }}
              >
                نسخ يومية
              </div>
            </div>

            <div
              style={{
                padding: 13,
                background:
                  'rgba(255,255,255,0.04)',
                borderRadius: 14,
                textAlign: 'center',
              }}
            >
              <Clock
                size={20}
                style={{
                  margin: '0 auto 5px',
                }}
              />

              <strong>
                {weeklyCount} / 4
              </strong>

              <div
                style={{
                  color: '#94a3b8',
                  fontSize: 12,
                  marginTop: 3,
                }}
              >
                نسخ أسبوعية
              </div>
            </div>
          </div>
        </div>

        {/* العمليات */}

        <div
          style={{
            display: 'grid',
            gap: 11,
            marginBottom: 22,
          }}
        >
          <button
            type="button"
            onClick={handleManualBackup}
            style={primaryButton}
          >
            <Archive size={22} />
            إنشاء نسخة احتياطية الآن
          </button>

          <button
            type="button"
            onClick={handleAutomaticBackup}
            style={normalButton}
          >
            <ShieldCheck size={22} />
            تحديث النسخ التلقائية
          </button>

          <label
            style={{
              ...normalButton,
              cursor: 'pointer',
            }}
          >
            <Upload size={22} />
            استيراد واستعادة نسخة من ملف

            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImport}
              style={{
                display: 'none',
              }}
            />
          </label>
        </div>

        {/* الرسالة */}

        {message && (
          <div
            style={{
              padding: 13,
              borderRadius: 14,
              marginBottom: 16,
              textAlign: 'center',
              fontWeight: 800,
              background:
                'rgba(34,197,94,0.12)',
              border:
                '1px solid rgba(34,197,94,0.28)',
              color: '#86efac',
            }}
          >
            {message}
          </div>
        )}

        {/* قائمة النسخ */}

        <div
          style={{
            marginBottom: 10,
            fontSize: 18,
            fontWeight: 900,
          }}
        >
          النسخ المحفوظة
        </div>

        {backups.length === 0 ? (
          <div
            style={{
              padding: 30,
              textAlign: 'center',
              borderRadius: 18,
              color: '#94a3b8',
              background:
                'rgba(255,255,255,0.035)',
              border:
                '1px solid rgba(255,255,255,0.07)',
            }}
          >
            لا توجد نسخ احتياطية محفوظة
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 10,
            }}
          >
            {backups.map(
              ({ key, backup }) => (
                <div
                  key={key}
                  style={{
                    padding: 15,
                    borderRadius: 18,
                    background:
                      'rgba(15,30,52,0.96)',
                    border:
                      '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: 15,
                    }}
                  >
                    {getTypeName(
                      backup.type
                    )}
                  </div>

                  <div
                    style={{
                      color: '#94a3b8',
                      fontSize: 12,
                      marginTop: 5,
                    }}
                  >
                    {formatDate(
                      backup.createdAt
                    )}
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(3, 1fr)',
                      gap: 7,
                      marginTop: 13,
                    }}
                  >
                    <button
                      type="button"
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
                      onClick={() =>
                        downloadBackup(
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
                      onClick={() =>
                        handleDelete(
                          key,
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
            marginTop: 20,
            padding: 15,
            borderRadius: 16,
            background:
              'rgba(59,130,246,0.08)',
            border:
              '1px solid rgba(59,130,246,0.18)',
            color: '#bfdbfe',
            fontSize: 13,
            lineHeight: 1.9,
          }}
        >
          🛡️ يحتفظ BAAKR PRO بآخر 7 نسخ
          يومية و4 نسخ أسبوعية. قبل أي
          عملية استعادة يتم إنشاء نسخة أمان
          من البيانات الحالية تلقائيًا.
        </div>
      </div>
    </div>
  );
}

const primaryButton: React.CSSProperties = {
  width: '100%',
  border: 0,
  borderRadius: 16,
  padding: '15px 16px',
  background:
    'linear-gradient(135deg, #2563eb, #1d4ed8)',
  color: '#ffffff',
  fontSize: 15,
  fontWeight: 900,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 9,
  cursor: 'pointer',
};

const normalButton: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border:
    '1px solid rgba(255,255,255,0.10)',
  borderRadius: 16,
  padding: '14px 16px',
  background:
    'rgba(15,30,52,0.96)',
  color: '#ffffff',
  fontSize: 14,
  fontWeight: 800,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 9,
};

const smallButton: React.CSSProperties = {
  border:
    '1px solid rgba(255,255,255,0.09)',
  borderRadius: 11,
  padding: '9px 5px',
  background:
    'rgba(255,255,255,0.04)',
  color: '#ffffff',
  fontSize: 12,
  fontWeight: 800,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  cursor: 'pointer',
};
