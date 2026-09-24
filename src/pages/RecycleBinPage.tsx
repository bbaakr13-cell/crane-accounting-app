import React, { useEffect, useMemo, useState } from 'react';
import {
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';

import {
  RECYCLE_BIN_EVENT,
  deleteRecycleItemPermanently,
  emptyRecycleBin,
  readRecycleBin,
  restoreRecycleItem,
  type RecycleBinItem,
} from '@/lib/recycleBin';

export function RecycleBinPage() {
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [search, setSearch] = useState('');

  function loadItems() {
    setItems(readRecycleBin());
  }

  useEffect(() => {
    loadItems();

    const onUpdate = () => loadItems();

    window.addEventListener(
      RECYCLE_BIN_EVENT,
      onUpdate,
    );

    window.addEventListener(
      'focus',
      onUpdate,
    );

    return () => {
      window.removeEventListener(
        RECYCLE_BIN_EVENT,
        onUpdate,
      );

      window.removeEventListener(
        'focus',
        onUpdate,
      );
    };
  }, []);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) {
      return items;
    }

    return items.filter((item) => {
      const text = [
        item.title,
        item.subtitle,
        item.entityType,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return text.includes(q);
    });
  }, [items, search]);

  function handleRestore(item: RecycleBinItem) {
    const result = restoreRecycleItem(item.id);

    if (!result.ok) {
      alert(result.message);
      return;
    }

    loadItems();
    alert('تمت استعادة العنصر');
  }

  function handlePermanentDelete(item: RecycleBinItem) {
    const ok = window.confirm(
      `حذف "${item.title}" نهائيًا؟\n\nلن يمكن استعادته بعد ذلك.`,
    );

    if (!ok) {
      return;
    }

    deleteRecycleItemPermanently(item.id);
    loadItems();
  }

  function handleEmptyBin() {
    if (!items.length) {
      return;
    }

    const ok = window.confirm(
      'إفراغ سلة المحذوفات بالكامل؟\n\nلن يمكن استعادة العناصر بعد ذلك.',
    );

    if (!ok) {
      return;
    }

    emptyRecycleBin();
    loadItems();
  }

  return (
    <AppLayout>
      <div
        dir="rtl"
        style={{
          maxWidth: 1000,
          margin: '0 auto',
          padding: 18,
          paddingBottom: 120,
          color: '#ffffff',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 18,
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
                margin: '6px 0 0',
                color: '#94a3b8',
                fontSize: 13,
              }}
            >
              استعادة العناصر أو حذفها نهائيًا
            </p>
          </div>

          <button
            type="button"
            onClick={handleEmptyBin}
            disabled={!items.length}
            style={{
              border: '1px solid rgba(239,68,68,.28)',
              borderRadius: 14,
              background: items.length
                ? 'rgba(239,68,68,.12)'
                : 'rgba(255,255,255,.04)',
              color: items.length
                ? '#fda4af'
                : '#64748b',
              padding: '11px 15px',
              fontWeight: 900,
            }}
          >
            إفراغ السلة
          </button>
        </div>

        <div
          style={{
            position: 'relative',
            marginBottom: 12,
          }}
        >
          <Search
            size={20}
            style={{
              position: 'absolute',
              right: 14,
              top: 13,
              color: '#94a3b8',
            }}
          />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="ابحث في المحذوفات..."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              borderRadius: 16,
              border: '1px solid #26384f',
              background: '#091321',
              color: '#ffffff',
              padding: '13px 44px',
              outline: 'none',
              fontSize: 14,
            }}
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                left: 8,
                top: 8,
                width: 34,
                height: 34,
                border: 'none',
                borderRadius: 10,
                background: 'transparent',
                color: '#94a3b8',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div
          style={{
            color: '#94a3b8',
            fontSize: 12,
            marginBottom: 14,
          }}
        >
          عدد العناصر: {items.length}
        </div>

        {!filteredItems.length ? (
          <div
            style={{
              borderRadius: 22,
              padding: 44,
              textAlign: 'center',
              background:
                'linear-gradient(145deg,#0d1b2f,#07111f)',
              border:
                '1px solid rgba(255,255,255,.07)',
            }}
          >
            <Trash2
              size={48}
              style={{
                color: '#475569',
                marginBottom: 12,
              }}
            />

            <div
              style={{
                fontWeight: 900,
                fontSize: 18,
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
              gap: 12,
            }}
          >
            {filteredItems.map((item) => (
              <div
                key={item.id}
                style={{
                  borderRadius: 18,
                  padding: 15,
                  background:
                    'linear-gradient(145deg,#0d1b2f,#07111f)',
                  border:
                    '1px solid rgba(255,255,255,.07)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
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

                    <div
                      style={{
                        marginTop: 5,
                        color: '#93a4b8',
                        fontSize: 12,
                      }}
                    >
                      {item.entityType}
                    </div>

                    {item.subtitle && (
                      <div
                        style={{
                          marginTop: 5,
                          color: '#cbd5e1',
                          fontSize: 12,
                        }}
                      >
                        {item.subtitle}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        handleRestore(item)
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        border:
                          '1px solid rgba(34,197,94,.25)',
                        borderRadius: 12,
                        background:
                          'rgba(34,197,94,.12)',
                        color: '#86efac',
                        padding: '10px 12px',
                        fontWeight: 900,
                      }}
                    >
                      <RotateCcw size={16} />
                      استعادة
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handlePermanentDelete(item)
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        border:
                          '1px solid rgba(239,68,68,.25)',
                        borderRadius: 12,
                        background:
                          'rgba(239,68,68,.12)',
                        color: '#fda4af',
                        padding: '10px 12px',
                        fontWeight: 900,
                      }}
                    >
                      <Trash2 size={16} />
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
