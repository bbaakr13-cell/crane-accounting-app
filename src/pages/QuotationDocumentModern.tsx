import type { CSSProperties } from 'react';

import type {
  QuotationForm,
} from './QuotationProPage';

const PAPER_WIDTH = 794;
const PAPER_HEIGHT = 1123;

const NAVY = '#0a2745';
const NAVY_SOFT = '#173c60';
const ORANGE = '#f26a21';
const INK = '#102b46';
const MUTED = '#65798c';
const LINE = '#d4dee7';
const PALE = '#f2f6f9';

function formatDisplayDate(value: string) {
  if (!value) return '—';
  const parts = value.split('-');
  if (parts.length !== 3) return value;
  return `${parts[2]} / ${parts[1]} / ${parts[0]}`;
}

function normalizeNumber(value: string) {
  return String(value || '')
    .replace(/[٠-٩]/g, (digit) =>
      String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))
    )
    .replace(/[۰-۹]/g, (digit) =>
      String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))
    )
    .replace(/[^0-9.]/g, '');
}

function money(value: string) {
  const normalized = normalizeNumber(value);
  if (!normalized) return '—';

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return value;

  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(amount)} ريال`;
}

function arabicNumber(value: number) {
  return String(value).replace(/[0-9]/g, (digit) =>
    '٠١٢٣٤٥٦٧٨٩'[Number(digit)]
  );
}

function Rule({
  color = LINE,
  style,
}: {
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        height: 1,
        background: color,
        ...style,
      }}
    />
  );
}

export function QuotationDocumentModern({
  data,
}: {
  data: QuotationForm;
}) {
  const visibleItems = data.items.slice(0, 6);
  const compactTable = visibleItems.length > 4;
  const rowHeight = compactTable ? 40 : 50;
  const rowFontSize = compactTable ? 12 : 14;
  const footerRegion =
    data.region?.trim() || 'خميس مشيط • أبها';

  const terms = [
    data.workDays,
    data.workHours,
    data.housingDiesel,
    data.vatNote,
  ];

  return (
    <div
      dir="rtl"
      style={{
        width: PAPER_WIDTH,
        height: PAPER_HEIGHT,
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        background: '#ffffff',
        color: INK,
        fontFamily:
          'Tajawal, "Noto Kufi Arabic", Arial, sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 27,
          left: 31,
          right: 31,
          height: 4,
          background: NAVY,
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 55,
          left: 39,
          right: 39,
          bottom: 72,
        }}
      >
        <header
          style={{
            height: 94,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 34,
          }}
        >
          <div
            style={{
              minWidth: 310,
              paddingRight: 22,
              borderRight: `7px solid ${ORANGE}`,
            }}
          >
            <div
              style={{
                fontSize: 43,
                lineHeight: 1,
                color: NAVY,
                fontWeight: 950,
              }}
            >
              عرض سعر
            </div>
            <div
              dir="ltr"
              style={{
                marginTop: 10,
                fontSize: 17,
                letterSpacing: 8,
                color: NAVY_SOFT,
                fontWeight: 700,
              }}
            >
              QUOTATION
            </div>
          </div>

          <div
            dir="ltr"
            style={{
              minWidth: 300,
              textAlign: 'left',
              paddingLeft: 24,
              borderLeft: `1px solid ${NAVY}`,
            }}
          >
            <div
              style={{
                fontSize: 39,
                lineHeight: 1,
                letterSpacing: 1,
                color: NAVY,
                fontWeight: 950,
              }}
            >
              BAKR{' '}
              <span style={{ color: ORANGE }}>
                PRO
              </span>
            </div>
            <div
              dir="rtl"
              style={{
                marginTop: 11,
                fontSize: 16,
                color: NAVY,
                fontWeight: 800,
              }}
            >
              إدارة وتأجير الكرينات والمعدات
            </div>
          </div>
        </header>

        <Rule
          color={NAVY_SOFT}
          style={{ marginTop: 8 }}
        />

        <section
          style={{
            height: 76,
            display: 'grid',
            gridTemplateColumns: '1.25fr 1fr 1fr',
            alignItems: 'center',
          }}
        >
          {[
            ['رقم العرض', data.quoteNo || '—'],
            [
              'التاريخ الميلادي',
              formatDisplayDate(data.date),
            ],
            ['التاريخ الهجري', data.hijriDate || '—'],
          ].map(([label, value], index) => (
            <div
              key={label}
              style={{
                height: 50,
                textAlign: 'center',
                borderLeft:
                  index < 2 ? `1px solid ${LINE}` : 'none',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: MUTED,
                  fontWeight: 800,
                }}
              >
                {label}
              </div>
              <div
                dir={index < 2 ? 'ltr' : 'rtl'}
                style={{
                  marginTop: 8,
                  fontSize: index === 0 ? 16 : 15,
                  color: NAVY,
                  fontWeight: 950,
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </section>

        <section
          style={{
            minHeight: 82,
            boxSizing: 'border-box',
            padding: '14px 20px',
            background: PALE,
            borderRight: `4px solid ${ORANGE}`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: MUTED,
              fontWeight: 850,
            }}
          >
            موجّه إلى
          </div>
          <div
            style={{
              marginTop: 5,
              fontSize: 17,
              color: NAVY,
              fontWeight: 950,
            }}
          >
            السادة / {data.customer || '—'}
          </div>
          <div
            style={{
              marginTop: 5,
              fontSize: 11,
              color: MUTED,
              fontWeight: 650,
            }}
          >
            {data.greeting || '—'}
          </div>
        </section>

        <div
          style={{
            margin: '15px 4px 10px',
            fontSize: 13,
            lineHeight: 1.6,
            color: INK,
            fontWeight: 750,
          }}
        >
          {data.intro || '—'}
        </div>

        <section>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              border: `1px solid ${LINE}`,
            }}
          >
            <thead>
              <tr
                style={{
                  height: 45,
                  color: '#ffffff',
                  background: NAVY,
                  borderBottom: `3px solid ${ORANGE}`,
                }}
              >
                <th
                  style={{
                    width: 52,
                    fontSize: 12,
                    fontWeight: 900,
                    borderLeft:
                      '1px solid rgba(255,255,255,0.35)',
                  }}
                >
                  م
                </th>
                <th
                  style={{
                    width: 285,
                    fontSize: 12,
                    fontWeight: 900,
                    borderLeft:
                      '1px solid rgba(255,255,255,0.35)',
                  }}
                >
                  نوع المعدة
                </th>
                <th
                  style={{
                    width: 185,
                    fontSize: 12,
                    fontWeight: 900,
                    borderLeft:
                      '1px solid rgba(255,255,255,0.35)',
                  }}
                >
                  الإيجار الشهري
                </th>
                <th
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  الإيجار اليومي
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item, index) => (
                <tr
                  key={item.id}
                  style={{
                    height: rowHeight,
                    background:
                      index % 2 === 0 ? '#ffffff' : PALE,
                  }}
                >
                  <td
                    style={{
                      textAlign: 'center',
                      color: NAVY,
                      borderTop: `1px solid ${LINE}`,
                      borderLeft: `1px solid ${LINE}`,
                      fontSize: rowFontSize,
                      fontWeight: 900,
                    }}
                  >
                    {arabicNumber(index + 1)}
                  </td>
                  <td
                    style={{
                      padding: '4px 8px',
                      textAlign: 'center',
                      color: NAVY,
                      borderTop: `1px solid ${LINE}`,
                      borderLeft: `1px solid ${LINE}`,
                      fontSize: rowFontSize,
                      fontWeight: 900,
                    }}
                  >
                    {item.equipment || '—'}
                  </td>
                  <td
                    dir="ltr"
                    style={{
                      padding: '4px 8px',
                      textAlign: 'center',
                      color: NAVY,
                      borderTop: `1px solid ${LINE}`,
                      borderLeft: `1px solid ${LINE}`,
                      fontSize: rowFontSize,
                      fontWeight: 950,
                    }}
                  >
                    {money(item.monthly)}
                  </td>
                  <td
                    dir="ltr"
                    style={{
                      padding: '4px 8px',
                      textAlign: 'center',
                      color: item.daily ? NAVY : '#8b9baa',
                      borderTop: `1px solid ${LINE}`,
                      fontSize: rowFontSize,
                      fontWeight: 850,
                    }}
                  >
                    {money(item.daily)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section style={{ marginTop: 17 }}>
          <div
            style={{
              paddingRight: 13,
              borderRight: `5px solid ${ORANGE}`,
              fontSize: 18,
              color: NAVY,
              fontWeight: 950,
            }}
          >
            الشروط والتفاصيل
          </div>

          <div
            style={{
              marginTop: 9,
              padding: '12px 17px 10px',
              background: PALE,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                columnGap: 27,
                rowGap: 10,
              }}
            >
              {terms.map((text, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    minWidth: 0,
                    color: INK,
                    fontSize: compactTable ? 10 : 11,
                    fontWeight: 750,
                  }}
                >
                  <span
                    style={{
                      width: 15,
                      height: 2,
                      flex: '0 0 15px',
                      background: ORANGE,
                    }}
                  />
                  <span>{text || '—'}</span>
                </div>
              ))}
            </div>

            <Rule style={{ marginTop: 11 }} />

            <div
              style={{
                marginTop: 8,
                color: MUTED,
                fontSize: 9.5,
                fontWeight: 750,
              }}
            >
              <span
                style={{
                  color: ORANGE,
                  fontWeight: 950,
                }}
              >
                ملاحظة:{' '}
              </span>
              {data.extraNote || '—'}
            </div>
          </div>
        </section>

        <section
          style={{
            marginTop: 18,
            height: 76,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
          }}
        >
          <div
            style={{
              padding: '7px 18px',
              borderLeft: `1px solid ${LINE}`,
            }}
          >
            <div
              style={{
                color: NAVY,
                fontSize: 11,
                fontWeight: 900,
              }}
            >
              اعتماد الجهة المستأجرة
            </div>
            <div
              style={{
                marginTop: 10,
                color: MUTED,
                fontSize: 9.5,
                fontWeight: 650,
              }}
            >
              الاسم والتوقيع والختم
            </div>
            <div
              style={{
                width: 250,
                marginTop: 12,
                borderTop: `1px dashed ${MUTED}`,
              }}
            />
          </div>

          <div
            style={{
              padding: '7px 18px',
              textAlign: 'right',
            }}
          >
            <div
              style={{
                color: NAVY,
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              مع خالص التحية والتقدير
            </div>
            <div
              dir="ltr"
              style={{
                marginTop: 9,
                color: NAVY,
                fontSize: 22,
                fontWeight: 950,
              }}
            >
              BAKR{' '}
              <span style={{ color: ORANGE }}>
                PRO
              </span>
            </div>
          </div>
        </section>
      </div>

      <footer
        style={{
          position: 'absolute',
          left: 31,
          right: 31,
          bottom: 25,
          minHeight: 40,
          boxSizing: 'border-box',
          borderTop: `2px solid ${NAVY}`,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1.8fr',
          alignItems: 'center',
          gap: 15,
          color: NAVY,
          fontSize: 9.5,
          fontWeight: 850,
        }}
      >
        <span>جاهزون لخدمتكم</span>
        <span style={{ textAlign: 'center' }}>
          {footerRegion}
        </span>
        <span
          dir="ltr"
          style={{
            textAlign: 'left',
            fontSize: 8.5,
            letterSpacing: 0.2,
          }}
        >
          BAKR PRO • CRANE &amp; HEAVY EQUIPMENT RENTAL
        </span>
      </footer>
    </div>
  );
}
