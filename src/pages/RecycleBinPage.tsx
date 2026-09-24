import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Filter,
  RefreshCcw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import {
  AppLayout,
} from '@/components/layout/AppLayout';

import {
  deleteRecycleBinItem,
  emptyRecycleBin,
  getRecycleBinDaysLeft,
  getRecycleBinItems,
  pruneExpiredRecycleBinItems,
  RECYCLE_BIN_UPDATED_EVENT,
  restoreRecycleBinItem,
  type RecycleBinItem,
} from '@/lib/recycleBin';

function formatDate(
  value: string
) {
  try {
    return new Intl.DateTimeFormat(
      'ar-SA-u-ca-gregory',
      {
        dateStyle: 'medium',
        timeStyle: 'short',
      }
    ).format(
      new Date(value)
    );
  } catch {
    return value || '—';
  }
}

function entityLabel(
  type: string
) {
  const value =
    String(type || '')
      .toLowerCase();

  if (
    value.includes(
      'customer'
    ) ||
    value.includes(
      'opportun'
    )
  ) {
    return 'العملاء والفرص';
  }

  if (
    value.includes(
      'invoice'
    )
  ) {
    return 'الفواتير';
  }

  if (
    value.includes(
      'expense'
    )
  ) {
    return 'المصاريف';
  }

  if (
    value.includes(
      'trip'
    )
  ) {
    return 'المشاوير';
  }

  if (
    value.includes(
      'equipment'
    )
  ) {
    return 'المعدات';
  }

  if (
    value.includes(
      'driver'
    )
  ) {
    return 'السواقين';
  }

  return 'أخرى';
}

export function RecycleBinPage() {
  const [
    items,
    setItems,
  ] = useState<
    RecycleBinItem[]
  >([]);

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    typeFilter,
    setTypeFilter,
  ] = useState('all');

  const [
    message,
    setMessage,
  ] = useState('');

  const load =
    useCallback(() => {
      const current =
        pruneExpiredRecycleBinItems();

      setItems(current);
    }, []);

  useEffect(() => {
    load();

    const onUpdated =
      () => load();

    const onStorage =
      (event: StorageEvent) => {
        if (
          !event.key ||
          event.key ===
            'bakr_pro_recycle_bin_v1'
        ) {
          load();
        }
      };

    window.addEventListener(
      RECYCLE_BIN_UPDATED_EVENT,
      onUpdated
    );

    window.addEventListener(
      'storage',
      onStorage
    );

    return () => {
      window.removeEventListener(
        RECYCLE_BIN_UPDATED_EVENT,
        onUpdated
      );

      window.removeEventListener(
        'storage',
        onStorage
      );
    };
  }, [load]);

  const types =
    useMemo(() => {
      return Array.from(
        new Set(
          items.map(
            item =>
              entityLabel(
                item.entityType
              )
          )
        )
      ).sort();
    }, [items]);

  const filtered =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return items.filter(
        item => {
          const label =
            entityLabel(
              item.entityType
            );

          if (
            typeFilter !==
              'all' &&
            label !==
              typeFilter
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          return [
            item.title,
            item.subtitle,
            label,
            item.sourceStorageKey,
          ]
            .join(' ')
            .toLowerCase()
            .includes(query);
        }
      );
    }, [
      items,
      search,
      typeFilter,
    ]);

  const expiringSoon =
    useMemo(
      () =>
        items.filter(
          item => {
            const days =
              getRecycleBinDaysLeft(
                item
              );

            return (
              days !== null &&
              days <= 7
            );
          }
        ).length,
      [items]
    );

  function showMessage(
    value: string
  ) {
    setMessage(value);

    window.setTimeout(
      () => {
        setMessage('');
      },
      2200
    );
  }

  function restoreItem(
    item: RecycleBinItem
  ) {
    const result =
      restoreRecycleBinItem(
        item.id
      );

    if (!result.ok) {
      alert(
        result.message ||
          'تعذر الاستعادة'
      );
      return;
    }

    load();
    showMessage(
      `تمت استعادة ${item.title}`
    );
  }

  function deleteForever(
    item: RecycleBinItem
  ) {
    const ok =
      window.confirm(
        `حذف "${item.title}" نهائيًا؟\n\nلن يمكن استعادته بعد ذلك.`
      );

    if (!ok) return;

    deleteRecycleBinItem(
      item.id
    );

    load();

    showMessage(
      'تم الحذف النهائي'
    );
  }

  function restoreAll() {
    if (!items.length) {
      return;
    }

    const ok =
      window.confirm(
        `استعادة جميع العناصر (${items.length})؟`
      );

    if (!ok) return;

    const ids =
      [...items].map(
        item => item.id
      );

    let restored = 0;

    ids.forEach(id => {
      const result =
        restoreRecycleBinItem(
          id
        );

      if (result.ok) {
        restored += 1;
      }
    });

    load();

    showMessage(
      `تمت استعادة ${restored} عنصر`
    );
  }

  function clearAll() {
    if (!items.length) {
      return;
    }

    const ok =
      window.confirm(
        `إفراغ سلة المحذوفات بالكامل؟\n\nسيتم حذف ${items.length} عنصر نهائيًا ولا يمكن التراجع.`
      );

    if (!ok) return;

    const second =
      window.confirm(
        'تأكيد أخير: حذف كل العناصر نهائيًا؟'
      );

    if (!second) return;

    emptyRecycleBin();
    load();

    showMessage(
      'تم إفراغ سلة المحذوفات'
    );
  }

  return (
    <AppLayout>
      <div
        dir="rtl"
        style={{
          width: '100%',
          maxWidth: 1180,
          margin: '0 auto',
          padding: 18,
          paddingBottom: 110,
          color: '#fff',
        }}
      >
        <style>
          {`
            .trash-scroll::-webkit-scrollbar{
              width:8px;
              height:8px;
            }
            .trash-scroll::-webkit-scrollbar-thumb{
              background:#334963;
              border-radius:999px;
            }
            .trash-card{
              transition:.18s ease;
            }
            .trash-card:hover{
              transform:translateY(-1px);
              border-color:#3c5572 !important;
            }
            @media(max-width:720px){
              .trash-stats{
                grid-template-columns:repeat(2,minmax(0,1fr)) !important;
              }
              .trash-toolbar{
                grid-template-columns:1fr !important;
              }
              .trash-actions{
                grid-template-columns:1fr 1fr !important;
              }
            }
          `}
        </style>

        {message && (
          <div
            style={{
              position: 'fixed',
              left: '50%',
              bottom:
                'calc(env(safe-area-inset-bottom, 0px) + 26px)',
              transform:
                'translateX(-50%)',
              zIndex: 10000,
              background:
                'rgba(8,20,35,.97)',
              color: '#fff',
              border:
                '1px solid rgba(74,222,128,.26)',
              borderRadius: 14,
              padding:
                '11px 15px',
              boxShadow:
                '0 14px 34px rgba(0,0,0,.35)',
              fontWeight: 800,
              whiteSpace: 'nowrap',
            }}
          >
            <CheckCircle2
              size={17}
              style={{
                verticalAlign: -4,
                marginLeft: 6,
                color: '#4ade80',
              }}
            />
            {message}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent:
              'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 16,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 28,
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
              استعادة العناصر المحذوفة أو حذفها نهائيًا بأمان
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={restoreAll}
              disabled={!items.length}
              style={{
                border:
                  '1px solid rgba(74,222,128,.23)',
                borderRadius: 12,
                padding:
                  '11px 13px',
                background:
                  items.length
                    ? 'rgba(34,197,94,.10)'
                    : 'rgba(255,255,255,.04)',
                color:
                  items.length
                    ? '#86efac'
                    : '#64748b',
                fontWeight: 900,
                cursor:
                  items.length
                    ? 'pointer'
                    : 'not-allowed',
                display: 'flex',
                alignItems:
                  'center',
                gap: 6,
              }}
            >
              <RotateCcw
                size={17}
              />
              استعادة الكل
            </button>

            <button
              onClick={clearAll}
              disabled={!items.length}
              style={{
                border:
                  '1px solid rgba(251,113,133,.24)',
                borderRadius: 12,
                padding:
                  '11px 13px',
                background:
                  items.length
                    ? 'rgba(239,68,68,.10)'
                    : 'rgba(255,255,255,.04)',
                color:
                  items.length
                    ? '#fda4af'
                    : '#64748b',
                fontWeight: 900,
                cursor:
                  items.length
                    ? 'pointer'
                    : 'not-allowed',
                display: 'flex',
                alignItems:
                  'center',
                gap: 6,
              }}
            >
              <Trash2
                size={17}
              />
              إفراغ السلة
            </button>
          </div>
        </div>

        <div
          className="trash-stats"
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(3,minmax(0,1fr))',
            gap: 10,
            marginBottom: 14,
          }}
        >
          {[
            {
              title:
                'العناصر المحذوفة',
              value:
                items.length,
              color:
                '#60a5fa',
              bg:
                'rgba(59,130,246,.09)',
              icon:
                <Trash2
                  size={20}
                />,
            },
            {
              title:
                'تنتهي خلال 7 أيام',
              value:
                expiringSoon,
              color:
                '#fbbf24',
              bg:
                'rgba(245,158,11,.09)',
              icon:
                <Clock3
                  size={20}
                />,
            },
            {
              title:
                'مدة الاحتفاظ',
              value:
                '30 يوم',
              color:
                '#4ade80',
              bg:
                'rgba(34,197,94,.09)',
              icon:
                <RefreshCcw
                  size={20}
                />,
            },
          ].map(card => (
            <div
              key={card.title}
              style={{
                borderRadius: 16,
                padding: 14,
                background:
                  card.bg,
                border:
                  `1px solid ${card.color}2a`,
                minHeight: 86,
              }}
            >
              <div
                style={{
                  color:
                    card.color,
                  display: 'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'space-between',
                  gap: 8,
                }}
              >
                <span>
                  {card.icon}
                </span>

                <span
                  style={{
                    fontSize: 11,
                    fontWeight:
                      800,
                  }}
                >
                  {card.title}
                </span>
              </div>

              <div
                style={{
                  marginTop: 12,
                  fontSize: 22,
                  fontWeight: 900,
                  color:
                    card.color,
                }}
              >
                {card.value}
              </div>
            </div>
          ))}
        </div>

        <div
          className="trash-toolbar"
          style={{
            display: 'grid',
            gridTemplateColumns:
              '1fr 220px',
            gap: 10,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              position:
                'relative',
            }}
          >
            <Search
              size={18}
              style={{
                position:
                  'absolute',
                right: 13,
                top: 13,
                color:
                  '#8293aa',
              }}
            />

            <input
              value={search}
              onChange={event =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="ابحث في المحذوفات..."
              style={{
                width: '100%',
                boxSizing:
                  'border-box',
                borderRadius: 12,
                border:
                  '1px solid #273951',
                background:
                  '#091321',
                color: '#fff',
                padding:
                  '12px 40px 12px 13px',
                outline: 'none',
                fontSize: 14,
              }}
            />

            {search && (
              <button
                onClick={() =>
                  setSearch('')
                }
                aria-label="مسح البحث"
                style={{
                  position:
                    'absolute',
                  left: 9,
                  top: 8,
                  width: 34,
                  height: 34,
                  border: 'none',
                  borderRadius:
                    9,
                  background:
                    'transparent',
                  color:
                    '#94a3b8',
                  display: 'grid',
                  placeItems:
                    'center',
                  cursor:
                    'pointer',
                }}
              >
                <X size={17} />
              </button>
            )}
          </div>

          <div
            style={{
              position:
                'relative',
            }}
          >
            <Filter
              size={17}
              style={{
                position:
                  'absolute',
                right: 12,
                top: 13,
                color:
                  '#8293aa',
                pointerEvents:
                  'none',
              }}
            />

            <select
              value={typeFilter}
              onChange={event =>
                setTypeFilter(
                  event.target.value
                )
              }
              style={{
                width: '100%',
                boxSizing:
                  'border-box',
                borderRadius: 12,
                border:
                  '1px solid #273951',
                background:
                  '#091321',
                color: '#fff',
                padding:
                  '12px 38px 12px 12px',
                outline: 'none',
                fontSize: 14,
              }}
            >
              <option value="all">
                كل الأنواع
              </option>

              {types.map(type => (
                <option
                  key={type}
                  value={type}
                >
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!filtered.length ? (
          <div
            style={{
              borderRadius: 20,
              padding:
                '46px 18px',
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
                color:
                  '#475569',
                marginBottom: 10,
              }}
            />

            <div
              style={{
                fontSize: 17,
                fontWeight: 900,
              }}
            >
              {items.length
                ? 'لا توجد نتائج مطابقة'
                : 'سلة المحذوفات فارغة'}
            </div>

            <div
              style={{
                color:
                  '#76869b',
                marginTop: 7,
                fontSize: 12,
              }}
            >
              {items.length
                ? 'غيّر البحث أو الفلتر'
                : 'أي عنصر يتم حذفه بطريقة آمنة سيظهر هنا'}
            </div>
          </div>
        ) : (
          <div
            className="trash-scroll"
            style={{
              display: 'grid',
              gap: 10,
            }}
          >
            {filtered.map(item => {
              const days =
                getRecycleBinDaysLeft(
                  item
                );

              const label =
                entityLabel(
                  item.entityType
                );

              return (
                <div
                  key={item.id}
                  className="trash-card"
                  style={{
                    borderRadius: 18,
                    padding: 14,
                    background:
                      'linear-gradient(145deg,#0d1b2f,#07111f)',
                    border:
                      '1px solid rgba(255,255,255,.07)',
                    boxShadow:
                      '0 10px 24px rgba(0,0,0,.16)',
                  }}
                >
                  <div
                    style={{
                      display:
                        'flex',
                      justifyContent:
                        'space-between',
                      alignItems:
                        'flex-start',
                      gap: 12,
                      flexWrap:
                        'wrap',
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        minWidth: 220,
                      }}
                    >
                      <div
                        style={{
                          display:
                            'flex',
                          alignItems:
                            'center',
                          gap: 8,
                          flexWrap:
                            'wrap',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight:
                              900,
                          }}
                        >
                          {item.title}
                        </div>

                        <span
                          style={{
                            borderRadius:
                              999,
                            padding:
                              '5px 9px',
                            fontSize:
                              10,
                            fontWeight:
                              900,
                            background:
                              'rgba(96,165,250,.10)',
                            color:
                              '#93c5fd',
                            border:
                              '1px solid rgba(96,165,250,.18)',
                          }}
                        >
                          {label}
                        </span>
                      </div>

                      {item.subtitle && (
                        <div
                          style={{
                            color:
                              '#bdc8d6',
                            marginTop: 6,
                            fontSize: 12,
                          }}
                        >
                          {item.subtitle}
                        </div>
                      )}

                      <div
                        style={{
                          display:
                            'flex',
                          gap: 12,
                          flexWrap:
                            'wrap',
                          marginTop: 10,
                          color:
                            '#7f90a6',
                          fontSize: 11,
                        }}
                      >
                        <span>
                          حُذف:{' '}
                          {formatDate(
                            item.deletedAt
                          )}
                        </span>

                        {days !==
                          null && (
                          <span
                            style={{
                              color:
                                days <=
                                7
                                  ? '#fbbf24'
                                  : '#7f90a6',
                            }}
                          >
                            متبقي:{' '}
                            {days}{' '}
                            يوم
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      className="trash-actions"
                      style={{
                        display:
                          'grid',
                        gridTemplateColumns:
                          'auto auto',
                        gap: 7,
                      }}
                    >
                      <button
                        onClick={() =>
                          restoreItem(
                            item
                          )
                        }
                        style={{
                          border:
                            '1px solid rgba(74,222,128,.20)',
                          borderRadius:
                            11,
                          padding:
                            '10px 12px',
                          background:
                            'rgba(34,197,94,.10)',
                          color:
                            '#86efac',
                          fontWeight:
                            900,
                          cursor:
                            'pointer',
                          display:
                            'flex',
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
                        onClick={() =>
                          deleteForever(
                            item
                          )
                        }
                        style={{
                          border:
                            '1px solid rgba(251,113,133,.20)',
                          borderRadius:
                            11,
                          padding:
                            '10px 12px',
                          background:
                            'rgba(239,68,68,.10)',
                          color:
                            '#fda4af',
                          fontWeight:
                            900,
                          cursor:
                            'pointer',
                          display:
                            'flex',
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

                  {days !==
                    null &&
                    days <= 3 && (
                      <div
                        style={{
                          marginTop: 12,
                          borderRadius:
                            11,
                          padding:
                            '9px 10px',
                          background:
                            'rgba(245,158,11,.09)',
                          border:
                            '1px solid rgba(245,158,11,.17)',
                          color:
                            '#facc15',
                          fontSize: 11,
                          fontWeight:
                            800,
                          display:
                            'flex',
                          alignItems:
                            'center',
                          gap: 6,
                        }}
                      >
                        <AlertTriangle
                          size={15}
                        />
                        سيتم حذف هذا العنصر تلقائيًا قريبًا إذا لم تتم استعادته.
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
