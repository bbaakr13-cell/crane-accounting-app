import type { Invoice } from '@/lib/invoices';
import type { Expense } from '@/lib/transactions';
import type { MonthlyDay, MonthlySummary } from '@/lib/monthly';
import { arabicMonths, arabicWeekdays } from '@/lib/monthly';
import type { AppSettings } from '@/lib/settings';
import { formatSAR } from '@/lib/format';

const NAVY = '#1e3a5f';
const GOLD = '#f59e0b';
const LIGHT_GOLD = '#fbbf24';
const DARK = '#1a1a2e';
const LIGHT_GRAY = '#f8f9fa';
const BORDER = '#dee2e6';
const TEXT_DARK = '#333333';
const TEXT_MUTED = '#6c757d';

function svgLogo(): string {
  return `<svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <rect x="20" y="70" width="50" height="14" rx="2" fill="${NAVY}" />
    <path d="M22 70 L22 58 L35 58 L38 70 Z" fill="${NAVY}" />
    <circle cx="32" cy="86" r="6" fill="${NAVY}" stroke="${GOLD}" stroke-width="2" />
    <circle cx="32" cy="86" r="2.5" fill="${GOLD}" />
    <circle cx="58" cy="86" r="6" fill="${NAVY}" stroke="${GOLD}" stroke-width="2" />
    <circle cx="58" cy="86" r="2.5" fill="${GOLD}" />
    <rect x="40" y="56" width="10" height="14" rx="1" fill="${GOLD}" />
    <line x1="45" y1="56" x2="85" y2="20" stroke="${GOLD}" stroke-width="4" stroke-linecap="round" />
    <line x1="45" y1="56" x2="85" y2="20" stroke="${LIGHT_GOLD}" stroke-width="2" stroke-linecap="round" />
    <line x1="52" y1="49" x2="56" y2="45" stroke="${NAVY}" stroke-width="1.5" />
    <line x1="60" y1="41" x2="64" y2="37" stroke="${NAVY}" stroke-width="1.5" />
    <line x1="68" y1="33" x2="72" y2="29" stroke="${NAVY}" stroke-width="1.5" />
    <line x1="76" y1="25" x2="80" y2="21" stroke="${NAVY}" stroke-width="1.5" />
    <line x1="85" y1="20" x2="85" y2="38" stroke="${NAVY}" stroke-width="1.5" stroke-dasharray="2,2" />
    <path d="M85 38 Q85 42 82 42 Q79 42 79 39" stroke="${GOLD}" stroke-width="2" fill="none" stroke-linecap="round" />
    <line x1="25" y1="84" x2="18" y2="88" stroke="${NAVY}" stroke-width="2" stroke-linecap="round" />
    <line x1="65" y1="84" x2="72" y2="88" stroke="${NAVY}" stroke-width="2" stroke-linecap="round" />
  </svg>`;
}

function docHeader(settings: AppSettings, title: string): string {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid ${GOLD};padding-bottom:16px;margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:12px">
        ${svgLogo()}
        <div>
          <div style="font-size:18px;font-weight:bold;color:${NAVY}">${settings.appName}</div>
          <div style="font-size:12px;color:${TEXT_MUTED};margin-top:2px">${settings.businessName}</div>
          <div style="font-size:11px;color:${TEXT_MUTED};margin-top:2px">${settings.city} - السعودية</div>
          <div style="font-size:11px;color:${GOLD};font-weight:bold;margin-top:2px">${settings.phone}</div>
        </div>
      </div>
      <div style="text-align:left">
        <div style="font-size:22px;font-weight:bold;color:${NAVY}">${title}</div>
      </div>
    </div>`;
}

function docFooter(settings: AppSettings, pageNum: number): string {
  return `
    <div style="position:fixed;bottom:0;width:100%;border-top:1px solid ${BORDER};padding-top:8px;margin-top:20px;display:flex;justify-content:space-between;font-size:10px;color:${TEXT_MUTED}">
      <span>${settings.appName} - ${settings.phone}</span>
      <span>تاريخ الإصدار: ${new Date().toLocaleDateString('ar-SA')}</span>
      <span>صفحة ${pageNum}</span>
    </div>`;
}

const baseCSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI','Tahoma','Arial',sans-serif; direction:rtl; color:${TEXT_DARK}; background:#fff; }
  .doc { max-width:800px; margin:0 auto; padding:30px; }
  table { width:100%; border-collapse:collapse; margin-top:12px; }
  th { background:${NAVY}; color:#fff; padding:8px 10px; font-size:11px; text-align:center; border:1px solid ${NAVY}; }
  td { padding:8px 10px; font-size:11px; text-align:center; border:1px solid ${BORDER}; }
  tr:nth-child(even) td { background:${LIGHT_GRAY}; }
  .totals-box { margin-top:20px; border:2px solid ${NAVY}; border-radius:8px; padding:16px; background:${LIGHT_GRAY}; }
  .totals-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid ${BORDER}; }
  .totals-row:last-child { border-bottom:none; }
  .totals-label { font-size:12px; color:${TEXT_MUTED}; }
  .totals-value { font-size:12px; font-weight:bold; color:${NAVY}; }
  .totals-final { background:${NAVY}; color:#fff; border-radius:6px; padding:10px 16px; margin-top:8px; display:flex; justify-content:space-between; }
  .totals-final .totals-label { color:#fff; font-size:14px; }
  .totals-final .totals-value { color:${GOLD}; font-size:16px; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; }
  .info-card { border:1px solid ${BORDER}; border-radius:8px; padding:12px; background:${LIGHT_GRAY}; }
  .info-label { font-size:10px; color:${TEXT_MUTED}; margin-bottom:4px; }
  .info-value { font-size:13px; font-weight:bold; color:${NAVY}; }
  .signature { margin-top:40px; display:flex; justify-content:space-between; }
  .sig-box { text-align:center; }
  .sig-line { width:200px; border-top:1px solid ${NAVY}; margin-top:40px; padding-top:6px; font-size:11px; color:${TEXT_MUTED}; }
  @media print { .doc { padding:15px; } .no-print { display:none; } }
`;

export function generateInvoiceHTML(inv: Invoice, settings: AppSettings): string {
  const statusLabels: Record<string, string> = {
    paid: 'مدفوع بالكامل', partial: 'مدفوع جزئيًا', credit: 'على الحساب', unpaid: 'غير مدفوع',
  };
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>فاتورة ${inv.invoiceNumber}</title>
<style>${baseCSS}</style>
</head>
<body>
<div class="doc">
  ${docHeader(settings, 'فاتورة')}
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div><span style="font-size:13px;color:${TEXT_MUTED}">رقم الفاتورة: </span><span style="font-size:16px;font-weight:bold;color:${NAVY}">${inv.invoiceNumber}</span></div>
    <div><span style="font-size:13px;color:${TEXT_MUTED}">التاريخ: </span><span style="font-size:14px;font-weight:bold;color:${NAVY}">${inv.date}</span></div>
  </div>
  <div class="info-grid">
    <div class="info-card">
      <div class="info-label">اسم العميل</div>
      <div class="info-value">${inv.customerName}</div>
    </div>
    <div class="info-card">
      <div class="info-label">رقم الجوال</div>
      <div class="info-value">${inv.customerPhone || '—'}</div>
    </div>
    <div class="info-card">
      <div class="info-label">المعدة</div>
      <div class="info-value">${inv.equipmentName || '—'}</div>
    </div>
    <div class="info-card">
      <div class="info-label">نوع الشغل</div>
      <div class="info-value">${inv.jobType || '—'}</div>
    </div>
    <div class="info-card">
      <div class="info-label">الموقع</div>
      <div class="info-value">${inv.location || '—'}</div>
    </div>
    <div class="info-card">
      <div class="info-label">حالة الدفع</div>
      <div class="info-value">${statusLabels[inv.paymentStatus] ?? inv.paymentStatus}</div>
    </div>
  </div>
  ${inv.description ? `<div style="margin-bottom:16px;padding:12px;border:1px solid ${BORDER};border-radius:8px;background:${LIGHT_GRAY}"><div class="info-label">وصف العمل</div><div style="font-size:13px;margin-top:4px">${inv.description}</div></div>` : ''}
  <div class="totals-box">
    <div class="totals-row"><span class="totals-label">قيمة العمل</span><span class="totals-value">${formatSAR(inv.workAmount)}</span></div>
    <div class="totals-row"><span class="totals-label">المبلغ المدفوع</span><span class="totals-value">${formatSAR(inv.paidAmount)}</span></div>
    <div class="totals-row"><span class="totals-label">المبلغ المتبقي</span><span class="totals-value">${formatSAR(inv.remainingAmount)}</span></div>
    <div class="totals-final"><span class="totals-label">صافي الفاتورة</span><span class="totals-value">${formatSAR(inv.workAmount)}</span></div>
  </div>
  ${inv.notes ? `<div style="margin-top:16px;padding:12px;border:1px solid ${BORDER};border-radius:8px"><div class="info-label">ملاحظات</div><div style="font-size:12px;margin-top:4px">${inv.notes}</div></div>` : ''}
  <div class="signature">
    <div class="sig-box"><div class="sig-line">التوقيع / الختم</div></div>
    <div class="sig-box"><div class="sig-line">استلام العميل</div></div>
  </div>
  ${docFooter(settings, 1)}
</div>
</body>
</html>`;
}

export function generateMonthlyHTML(
  equipmentName: string,
  days: MonthlyDay[],
  summary: MonthlySummary,
  year: number,
  month: number,
  settings: AppSettings
): string {
  const monthName = arabicMonths[month - 1];
  const rows = days.map((d, i) => {
    const dateObj = new Date(d.date);
    const weekday = arabicWeekdays[dateObj.getDay()];
    const statusLabels: Record<string, string> = {
      worked: 'اشتغل', idle: 'لم يشتغل', maintenance: 'عطل / صيانة', holiday: 'إجازة',
    };
    return `<tr>
      <td>${i + 1}</td>
      <td>${weekday}</td>
      <td>${d.date}</td>
      <td>${statusLabels[d.dayStatus] ?? d.dayStatus}</td>
      <td>${d.jobType || '—'}</td>
      <td>${d.customerName || '—'}</td>
      <td>${d.location || '—'}</td>
      <td>${d.workAmount > 0 ? formatSAR(d.workAmount) : '—'}</td>
      <td>${d.paidAmount > 0 ? formatSAR(d.paidAmount) : '—'}</td>
      <td>${d.remainingAmount > 0 ? formatSAR(d.remainingAmount) : '—'}</td>
      <td>${d.expenseAmount > 0 ? formatSAR(d.expenseAmount) : '—'}</td>
      <td>${d.notes || '—'}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>كشف ${equipmentName} - ${monthName} ${year}</title>
<style>${baseCSS}</style>
</head>
<body>
<div class="doc">
  ${docHeader(settings, 'كشف حساب شهري')}
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div><span style="font-size:13px;color:${TEXT_MUTED}">المعدة: </span><span style="font-size:16px;font-weight:bold;color:${NAVY}">${equipmentName}</span></div>
    <div><span style="font-size:13px;color:${TEXT_MUTED}">الفترة: </span><span style="font-size:14px;font-weight:bold;color:${NAVY}">${monthName} ${year}</span></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>الرقم</th><th>اليوم</th><th>التاريخ</th><th>حالة المعدة</th>
        <th>نوع الشغل</th><th>العميل</th><th>الموقع</th>
        <th>قيمة الشغل</th><th>المدفوع</th><th>المتبقي</th><th>المصروف</th><th>ملاحظات</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals-box">
    <div class="totals-row"><span class="totals-label">أيام العمل</span><span class="totals-value">${summary.workDays} يوم</span></div>
    <div class="totals-row"><span class="totals-label">أيام التوقف</span><span class="totals-value">${summary.idleDays} يوم</span></div>
    <div class="totals-row"><span class="totals-label">أيام الصيانة</span><span class="totals-value">${summary.maintenanceDays} يوم</span></div>
    <div class="totals-row"><span class="totals-label">إجمالي قيمة الأعمال</span><span class="totals-value">${formatSAR(summary.totalWorkAmount)}</span></div>
    <div class="totals-row"><span class="totals-label">إجمالي المدفوع</span><span class="totals-value">${formatSAR(summary.totalPaid)}</span></div>
    <div class="totals-row"><span class="totals-label">إجمالي المتبقي</span><span class="totals-value">${formatSAR(summary.totalRemaining)}</span></div>
    <div class="totals-row"><span class="totals-label">إجمالي المصروفات</span><span class="totals-value">${formatSAR(summary.totalExpenses)}</span></div>
    <div class="totals-final"><span class="totals-label">صافي الشهر</span><span class="totals-value">${formatSAR(summary.netMonth)}</span></div>
  </div>
  <div class="signature">
    <div class="sig-box"><div class="sig-line">التوقيع / الختم</div></div>
    <div class="sig-box"><div class="sig-line">المراجعة</div></div>
  </div>
  ${docFooter(settings, 1)}
</div>
</body>
</html>`;
}


export function generateExpenseReceiptHTML(exp: Expense, settings: AppSettings): string {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>سند مصروف ${exp.date}</title><style>${baseCSS}</style></head><body><div class="doc">
    ${docHeader(settings, 'سند مصروف')}
    <div class="info-grid">
      <div class="info-card"><div class="info-label">التاريخ</div><div class="info-value">${exp.date}</div></div>
      <div class="info-card"><div class="info-label">المعدة</div><div class="info-value">${exp.equipmentName || 'مصروف عام'}</div></div>
      <div class="info-card"><div class="info-label">نوع المصروف</div><div class="info-value">${exp.expenseType}</div></div>
      <div class="info-card"><div class="info-label">المبلغ</div><div class="info-value" style="color:#dc2626">${formatSAR(exp.amount)}</div></div>
    </div>
    ${exp.notes ? `<div style="padding:14px;border:1px solid ${BORDER};border-radius:8px;background:${LIGHT_GRAY}"><div class="info-label">تفاصيل / ملاحظات</div><div style="font-size:13px;margin-top:5px">${exp.notes}</div></div>` : ''}
    <div class="totals-box"><div class="totals-final"><span class="totals-label">إجمالي المصروف</span><span class="totals-value">${formatSAR(exp.amount)}</span></div></div>
    <div class="signature"><div class="sig-box"><div class="sig-line">المستلم / المورد</div></div><div class="sig-box"><div class="sig-line">اعتماد المصروف</div></div></div>
    ${docFooter(settings, 1)}
  </div></body></html>`;
}
export function openPrintWindow(html: string) {
  const win = window.open('', '_blank');
  if (!win) {
    alert('الرجاء السماح بالنوافذ المنبثقة لطباعة أو حفظ المستند');
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
  }, 500);
}

export function sharePDF(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
