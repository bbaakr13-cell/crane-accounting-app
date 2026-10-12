import type { CSSProperties } from 'react';

type QuotationItem = {
  id: string;
  equipment: string;
  description: string;
  quantity: string;
  monthly: string;
  daily: string;
};

type QuotationForm = {
  quoteNo: string;
  date: string;
  companyName: string;
  customer: string;
  region: string;
  workDays: string;
  workHours: string;
  housingDiesel: string;
  vatNote: string;
  extraNote: string;
  items: QuotationItem[];
};

const PAPER_WIDTH = 794;
const PAPER_HEIGHT = 1123;

const NAVY = '#0a2a4a';
const NAVY_2 = '#123e67';
const GOLD = '#c8972f';
const INK = '#13283b';
const MUTED = '#68798a';
const LINE = '#d8e1e8';
const PALE = '#f4f7f9';

function formatDisplayDate(value: string) {
  if (!value) return '—';
  const parts = value.split('-');
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
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

function num(value: string) {
  const cleaned = normalizeNumber(value);
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : 0;
}

function quantity(value: string) {
  const amount = Math.max(0, Math.floor(num(value) || 0));
  return amount || 1;
}

function moneyNumber(value: number) {
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value)} ر.س`;
}

function money(value: string) {
  const cleaned = normalizeNumber(value);
  if (!cleaned) return '—';
  return moneyNumber(Number(cleaned));
}

function Rule({
  style,
  color = LINE,
}: {
  style?: CSSProperties;
  color?: string;
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
  const totalQty = visibleItems.reduce(
    (sum, item) => sum + quantity(item.quantity),
    0
  );
  const monthlyTotal = visibleItems.reduce(
    (sum, item) =>
      sum + num(item.monthly) * quantity(item.quantity),
    0
  );
  const dailyTotal = visibleItems.reduce(
    (sum, item) =>
      sum + num(item.daily) * quantity(item.quantity),
    0
  );
  const footerRegion =
    data.region?.trim() || 'خميس مشيط • أبها';

  const compact = visibleItems.length > 4;
  const rowHeight = compact ? 40 : 48;
  const rowFont = compact ? 10.5 : 11.5;

  const terms = [
    data.workDays,
    data.workHours,
    data.housingDiesel,
    data.vatNote,
  ].filter(Boolean);

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
          top: 24,
          left: 30,
          right: 30,
          height: 4,
          borderRadius: 999,
          background: `linear-gradient(90deg,${GOLD},${NAVY})`,
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 48,
          left: 34,
          right: 34,
          bottom: 62,
        }}
      >
        <header
          style={{
            height: 142,
            display: 'grid',
            gridTemplateColumns: '1.15fr .8fr 1.05fr',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              textAlign: 'right',
              paddingRight: 8,
            }}
          >
            <div
              style={{
                fontSize: 46,
                lineHeight: 1,
                fontWeight: 950,
                color: NAVY,
              }}
            >
              عرض سعر
            </div>
            <div
              dir="ltr"
              style={{
                marginTop: 8,
                color: GOLD,
                fontSize: 14,
                fontWeight: 850,
                letterSpacing: 7,
              }}
            >
              QUOTATION
            </div>
            <div
              style={{
                marginTop: 13,
                width: 112,
                height: 3,
                borderRadius: 99,
                background: GOLD,
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 126,
            }}
          >
            <img
              src="/quotation-crane.png"
              alt="crane"
              style={{
                width: 165,
                height: 130,
                objectFit: 'contain',
                mixBlendMode: 'multiply',
              }}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 8,
              paddingLeft: 4,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '94px 1fr',
                alignItems: 'center',
                minHeight: 41,
                overflow: 'hidden',
                borderRadius: 8,
                border: `1px solid ${LINE}`,
                background: PALE,
              }}
            >
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#e9eef2',
                  color: NAVY,
                  fontSize: 11,
                  fontWeight: 950,
                }}
              >
                رقم العرض
              </div>
              <div
                dir="ltr"
                style={{
                  textAlign: 'center',
                  color: NAVY,
                  fontSize: 12,
                  fontWeight: 950,
                }}
              >
                {data.quoteNo || '—'}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '94px 1fr',
                alignItems: 'center',
                minHeight: 41,
                overflow: 'hidden',
                borderRadius: 8,
                border: `1px solid ${LINE}`,
                background: PALE,
              }}
            >
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#e9eef2',
                  color: NAVY,
                  fontSize: 11,
                  fontWeight: 950,
                }}
              >
                التاريخ
              </div>
              <div
                dir="ltr"
                style={{
                  textAlign: 'center',
                  color: NAVY,
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                {formatDisplayDate(data.date)}
              </div>
            </div>
          </div>
        </header>

        <section
          style={{
            marginTop: 3,
            border: `1px solid ${LINE}`,
            borderRadius: 13,
            overflow: 'hidden',
            background: '#ffffff',
          }}
        >
          <div
            style={{
              height: 41,
              display: 'flex',
              alignItems: 'center',
              padding: '0 18px',
              color: '#ffffff',
              background: `linear-gradient(90deg,${NAVY_2},${NAVY})`,
              borderRight: `5px solid ${GOLD}`,
              fontSize: 16,
              fontWeight: 950,
            }}
          >
            بيانات الشركة
          </div>
          <div
            style={{
              padding: '12px 19px 13px',
              fontSize: 12.5,
              lineHeight: 1.8,
              color: INK,
              fontWeight: 750,
            }}
          >
            <div style={{ fontWeight: 900 }}>
              السلام عليكم ورحمة الله وبركاته،
            </div>
            <div style={{ marginTop: 2 }}>
              السادة /{' '}
              <strong style={{ color: NAVY }}>
                {data.customer || '—'}
              </strong>{' '}
              المحترمين
            </div>
            <div style={{ marginTop: 2 }}>
              يسر{' '}
              <strong style={{ color: NAVY }}>
                {data.companyName || '—'}
              </strong>{' '}
              أن تقدم لكم عرض السعر التالي لتأجير المعدات.
            </div>
          </div>
        </section>

        <section style={{ marginTop: 15 }}>
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
                  height: 44,
                  color: '#ffffff',
                  background: NAVY,
                  borderBottom: `3px solid ${GOLD}`,
                }}
              >
                {[
                  ['م', 38],
                  ['المعدات', 110],
                  ['الوصف', 175],
                  ['العدد', 64],
                  ['الإيجار الشهري', 150],
                  ['الإيجار اليومي', 145],
                ].map(([label, width], index) => (
                  <th
                    key={String(label)}
                    style={{
                      width,
                      fontSize: 10.5,
                      fontWeight: 950,
                      borderLeft:
                        index < 5
                          ? '1px solid rgba(255,255,255,.28)'
                          : 'none',
                    }}
                  >
                    {label}
                  </th>
                ))}
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
                  <td style={cellStyle(rowFont, true)}>
                    {index + 1}
                  </td>
                  <td style={cellStyle(rowFont, true)}>
                    {item.equipment || '—'}
                  </td>
                  <td style={cellStyle(rowFont, false)}>
                    {item.description || '—'}
                  </td>
                  <td style={cellStyle(rowFont, true)}>
                    {item.quantity || '1'}
                  </td>
                  <td
                    dir="ltr"
                    style={cellStyle(rowFont, true)}
                  >
                    {money(item.monthly)}
                  </td>
                  <td
                    dir="ltr"
                    style={cellStyle(rowFont, true, true)}
                  >
                    {money(item.daily)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section
          style={{
            marginTop: 17,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            alignItems: 'stretch',
          }}
        >
          <div
            style={{
              minHeight: 184,
              border: `1px solid ${LINE}`,
              borderRadius: 12,
              overflow: 'hidden',
              background: '#ffffff',
            }}
          >
            <div
              style={{
                height: 41,
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                color: '#ffffff',
                background: NAVY,
                borderRight: `5px solid ${GOLD}`,
                fontSize: 15,
                fontWeight: 950,
              }}
            >
              ملخص الأسعار
            </div>
            <div style={{ padding: '10px 14px' }}>
              <SummaryRow
                label="إجمالي عدد المعدات"
                value={`${totalQty}`}
              />
              <SummaryRow
                label="إجمالي الإيجار الشهري"
                value={moneyNumber(monthlyTotal)}
              />
              <SummaryRow
                label="إجمالي الإيجار اليومي"
                value={moneyNumber(dailyTotal)}
              />
              <Rule style={{ margin: '8px 0' }} />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  color: MUTED,
                  fontSize: 9.5,
                  fontWeight: 750,
                }}
              >
                <span>الأسعار حسب البيانات أعلاه</span>
                <span>ر.س</span>
              </div>
            </div>
          </div>

          <div
            style={{
              minHeight: 184,
              border: `1px solid ${LINE}`,
              borderRadius: 12,
              overflow: 'hidden',
              background: '#ffffff',
            }}
          >
            <div
              style={{
                height: 41,
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                color: '#ffffff',
                background: NAVY,
                borderRight: `5px solid ${GOLD}`,
                fontSize: 15,
                fontWeight: 950,
              }}
            >
              الشروط
            </div>
            <div
              style={{
                padding: '11px 14px',
                display: 'grid',
                gap: 7,
              }}
            >
              {terms.map((text, index) => (
                <div
                  key={`${text}-${index}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    color: INK,
                    fontSize: 10.5,
                    lineHeight: 1.55,
                    fontWeight: 750,
                  }}
                >
                  <span
                    style={{
                      marginTop: 6,
                      width: 7,
                      height: 7,
                      flex: '0 0 7px',
                      borderRadius: '50%',
                      background: GOLD,
                    }}
                  />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {data.extraNote?.trim() ? (
          <div
            style={{
              marginTop: 12,
              padding: '9px 13px',
              borderRadius: 9,
              background: PALE,
              borderRight: `4px solid ${GOLD}`,
              color: MUTED,
              fontSize: 10,
              lineHeight: 1.55,
              fontWeight: 750,
            }}
          >
            <span style={{ color: NAVY, fontWeight: 950 }}>
              ملاحظة:{' '}
            </span>
            {data.extraNote}
          </div>
        ) : null}
      </div>

      <footer
        style={{
          position: 'absolute',
          left: 34,
          right: 34,
          bottom: 22,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: `2px solid ${NAVY}`,
          color: NAVY,
          fontSize: 10,
          fontWeight: 900,
        }}
      >
        <span>{data.companyName || 'مؤسسة صقر الجنوب'}</span>
        <span>{footerRegion}</span>
      </footer>
    </div>
  );
}

function cellStyle(
  fontSize: number,
  centered = false,
  last = false
): CSSProperties {
  return {
    padding: '5px 7px',
    textAlign: centered ? 'center' : 'right',
    verticalAlign: 'middle',
    color: INK,
    borderTop: `1px solid ${LINE}`,
    borderLeft: last ? 'none' : `1px solid ${LINE}`,
    fontSize,
    fontWeight: centered ? 900 : 750,
    lineHeight: 1.35,
  };
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        minHeight: 31,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        borderBottom: `1px solid ${LINE}`,
        color: INK,
        fontSize: 10.5,
        fontWeight: 850,
      }}
    >
      <span>{label}</span>
      <strong
        dir="ltr"
        style={{ color: NAVY, fontSize: 11.5 }}
      >
        {value}
      </strong>
    </div>
  );
}
