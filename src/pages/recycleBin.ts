import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import {
  AppLayout,
} from '@/components/layout/AppLayout';

import {
  deleteRecycleItemPermanently,
  emptyRecycleBin,
  readRecycleBin,
  RECYCLE_BIN_EVENT,
  restoreRecycleItem,
  type RecycleBinItem,
} from '@/lib/recycleBin';

function formatDeletedAt(value: string) {
  try {
    return new Intl.DateTimeFormat(
      'ar-SA-u-ca-gregory',
      {
        dateStyle: 'medium',
        timeStyle: 'short',
      }
    ).format(new Date(value));
  } catch {
    return value;
  }
}

export function RecycleBinPage() {
  const [items, setItems] =
    useState<RecycleBinItem[]>([]);

  const [search, setSearch] =
    useState('');

  const load = useCallback(() => {
    setItems(readRecycleBin());
  }, []);

  useEffect(() => {
    load();

    const onUpdated = () => load();

    const onStorage = (
      event: StorageEvent
    ) => {
      if (
        !event.key ||
        event.key ===
          'bakr_pro_recycle_bin_v1'
      ) {
        load();
      }
    };

    window.addEventListener(
      RECYCLE_BIN_EVENT,
      onUpdated
    );

    window.addEventListener(
      'storage',
      onStorage
    );

    return () => {
      window.removeEventListener(
        RECYCLE_BIN_EVENT,
        onUpdated
      );

      window.removeEventListener(
        'storage',
        onStorage
      );
    };
  }, [load]);

  const filtered = useMemo(() => {
    const q = search
      .trim()
      .toLowerCase();

    if (!q) return items;

    return items.filter(item =>
      [
        item.title,
        item.subtitle,
        item.entityType,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [items, search]);

  function restore(item: RecycleBinItem) {
    const result =
      restoreRecycleItem(item.id);

    if (!result.ok) {
      alert(result.message);
      return;
    }

    load();
    alert('تمت استعادة العنصر');
  }

  function removeForever(
    item: RecycleBinItem
  ) {
    const ok = window.confirm(
      `حذف "${item.title}" نهائيًا؟\n\nلن يمكن استعادته بعد ذلك.`
    );

    if (!ok) return;

    deleteRecycleItemPermanently(
      item.id
    );

    load();
  }

  function clearAll() {
    if (!items.length) return;

    const ok = window.confirm(
      `إفراغ سلة المحذوفات بالكامل؟\n\nسيتم حذف ${items.length} عنصر نهائيًا.`
    );

    if (!ok) return;

    emptyRecycleBin();
    load();
  }

  return (
    <AppLayout>
      <div
        dir="rtl"
        style={{
          maxWidth: 1000,
          margin: '0 auto',
          padding: 18,
          paddingBottom: 110,
          color: '#fff',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent:
              'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 18,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 27,
                fontWeight: 900,
              }}
            >
              سلة المحذوفات
            </h1>

            <p
              style={{
                color: '#94a3b8',
                margin:
                  '6px 0 0',
                fontSize: 13,
              }}
            >
              استعادة العناصر أو حذفها نهائيًا
            </p>
          </div>

          <button
            type="button"
            disabled={!items.length}
            onClick={clearAll}
            style={{
              border:
                '1px solid rgba(239,68,68,.30)',
              borderRadius: 12,
              background:
                items.length
                  ? 'rgba(239,68,68,.12)'
                  : 'rgba(255,255,255,.04)',
              color:
                items.length
                  ? '#fda4af'
                  : '#64748b',
              padding:
                '11px 14px',
              fontWeight: 900,
              cursor:
                items.length
                  ? 'pointer'
                  : 'not-allowed',
            }}
          >
            إفراغ السلة
          </button>
        </div>

        <div
          style={{
            position: 'relative',
            marginBottom: 14,
          }}
        >
          <Search
            size={18}
            style={{
              position: 'absolute',
              right: 13,
              top: 13,
              color: '#94a3b8',
            }}
          />

          <input
            value={search}
            onChange={event =>
              setSearch(event.target.value)
            }
            placeholder="ابحث في المحذوفات..."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              borderRadius: 13,
              border:
                '1px solid #26384f',
              background: '#091321',
              color: '#fff',
              padding:
                '12px 42px 12px 42px',
              outline: 'none',
              fontSize: 14,
            }}
          />

          {search && (
            <button
              type="button"
              onClick={() =>
                setSearch('')
              }
              style={{
                position: 'absolute',
                left: 8,
                top: 7,
                width: 36,
                height: 36,
                border: 'none',
                borderRadius: 9,
                background:
                  'transparent',
                color: '#94a3b8',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={17} />
            </button>
          )}
        </div>

        <div
          style={{
            marginBottom: 12,
            color: '#94a3b8',
            fontSize: 12,
          }}
        >
          عدد العناصر: {items.length}
        </div>

        {!filtered.length ? (
          <div
            style={{
              borderRadius: 20,
              padding: 42,
              textAlign: 'center',
              background:
                'linear-gradient(145deg,#0d1b2f,#07111f)',
              border:
                '1px solid rgba(255,255,255,.07)',
            }}
          >
            <Trash2
              size={44}
              style={{
                color: '#475569',
                marginBottom: 10,
              }}
            />

            <div
              style={{
                fontWeight: 900,
                fontSize: 16,
              }}
            >
              {items.length
                ? 'لا توجد نتائج'
                : 'سلة المحذوفات فارغة'}
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 10,
            }}
          >
            {filtered.map(item => (
              <div
                key={item.id}
                style={{
                  borderRadius: 18,
                  padding: 14,
                  background:
                    'linear-gradient(145deg,#0d1b2f,#07111f)',
                  border:
                    '1px solid rgba(255,255,255,.07)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent:
                      'space-between',
                    alignItems:
                      'flex-start',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      minWidth: 210,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 16,
                      }}
                    >
                      {item.title}
                    </div>

                    {item.subtitle && (
                      <div
                        style={{
                          color: '#b8c3d2',
                          marginTop: 5,
                          fontSize: 12,
                        }}
                      >
                        {item.subtitle}
                      </div>
                    )}

                    <div
                      style={{
                        color: '#718198',
                        marginTop: 8,
                        fontSize: 11,
                      }}
                    >
                      تم الحذف:{' '}
                      {formatDeletedAt(
                        item.deletedAt
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 7,
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        restore(item)
                      }
                      style={{
                        border:
                          '1px solid rgba(34,197,94,.25)',
                        borderRadius: 11,
                        background:
                          'rgba(34,197,94,.11)',
                        color: '#86efac',
                        padding:
                          '10px 12px',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems:
                          'center',
                        gap: 6,
                      }}
                    >
                      <RotateCcw
                        size={16}
                      />
                      استعادة
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        removeForever(
                          item
                        )
                      }
                      style={{
                        border:
                          '1px solid rgba(239,68,68,.25)',
                        borderRadius: 11,
                        background:
                          'rgba(239,68,68,.11)',
                        color: '#fda4af',
                        padding:
                          '10px 12px',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems:
                          'center',
                        gap: 6,
                      }}
                    >
                      <Trash2
                        size={16}
                      />
                      حذف نهائي
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
