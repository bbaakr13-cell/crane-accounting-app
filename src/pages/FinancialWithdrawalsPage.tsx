import { useMemo, useRef, useState, type ReactNode, type HTMLAttributes } from 'react';
import {
  Wallet,
  Plus,
  Trash2,
  Save,
  FileDown,
  Share2,
  MessageCircle,
  Pencil,
  RotateCcw,
  CheckCircle2,
  UserRound,
  CalendarDays,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { AppLayout } from '@/components/layout/AppLayout';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

type WithdrawalRow = {
  id: string;
  amount: string;
  reason: string;
  date: string;
  notes: string;
};

type LedgerRecord = {
  id: string;
  accountName: string;
  baseAmount: string;
  createdDate: string;
  rows: WithdrawalRow[];
  extraNotes: string;
  savedAt: string;
};

const STORAGE_KEY = 'bakr_pro_financial_withdrawals_v1';
const PHONE = '0558995962';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function uid(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function moneyNumber(value: string | number) {
  const normalized = String(value ?? '').replace(/[,\s]/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('ar-SA', {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMoneyEn(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value);
}

function emptyRow(): WithdrawalRow {
  return {
    id: uid('row'),
    amount: '',
    reason: '',
    date: today(),
    notes: '',
  };
}

function readSaved(): LedgerRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}


async function waitForImages(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll('img'));

  await Promise.all(
    images.map(async (img) => {
      try {
        if (img.complete && img.naturalWidth > 0) {
          if ('decode' in img) {
            await img.decode().catch(() => undefined);
          }
          return;
        }

        await new Promise<void>((resolve) => {
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        });

        if ('decode' in img) {
          await img.decode().catch(() => undefined);
        }
      } catch {
        // لا نوقف إنشاء PDF إذا تعذر تحميل صورة غير مهمة.
      }
    })
  );
}

export function FinancialWithdrawalsPage() {
  const pdfRef = useRef<HTMLDivElement | null>(null);

  const [recordId, setRecordId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState('');
  const [baseAmount, setBaseAmount] = useState('');
  const [createdDate, setCreatedDate] = useState(today());
  const [rows, setRows] = useState<WithdrawalRow[]>([emptyRow()]);
  const [extraNotes, setExtraNotes] = useState('');
  const [savedRecords, setSavedRecords] = useState<LedgerRecord[]>(() => readSaved());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const base = useMemo(() => moneyNumber(baseAmount), [baseAmount]);

  const totalWithdrawn = useMemo(
    () => rows.reduce((sum, row) => sum + moneyNumber(row.amount), 0),
    [rows]
  );

  const remaining = base - totalWithdrawn;

  const shownRows = useMemo(() => {
    const withContent = rows.filter(
      (row) => row.amount.trim() || row.reason.trim() || row.notes.trim()
    );
    return withContent.length ? withContent : rows.slice(0, 1);
  }, [rows]);

  function flash(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2200);
  }

  function updateRow(id: string, key: keyof WithdrawalRow, value: string) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [key]: value } : row))
    );
  }

  function addRow() {
    setRows((current) => [...current, emptyRow()]);
  }

  function removeRow(id: string) {
    setRows((current) => {
      const next = current.filter((row) => row.id !== id);
      return next.length ? next : [emptyRow()];
    });
  }

  function resetForm() {
    setRecordId(null);
    setAccountName('');
    setBaseAmount('');
    setCreatedDate(today());
    setRows([emptyRow()]);
    setExtraNotes('');
    flash('تم فتح سجل جديد');
  }

  function buildRecord(): LedgerRecord {
    return {
      id: recordId || uid('ledger'),
      accountName: accountName.trim(),
      baseAmount,
      createdDate,
      rows,
      extraNotes: extraNotes.trim(),
      savedAt: new Date().toISOString(),
    };
  }

  function saveRecord(showMessage = true) {
    if (base <= 0) {
      alert('اكتب المبلغ الأساسي أولاً');
      return false;
    }

    const record = buildRecord();
    const next = [
      record,
      ...savedRecords.filter((item) => item.id !== record.id),
    ];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSavedRecords(next);
    setRecordId(record.id);

    if (showMessage) flash('تم حفظ السجل');
    return true;
  }

  function openRecord(record: LedgerRecord) {
    setRecordId(record.id);
    setAccountName(record.accountName || '');
    setBaseAmount(record.baseAmount || '');
    setCreatedDate(record.createdDate || today());
    setRows(
      Array.isArray(record.rows) && record.rows.length
        ? record.rows
        : [emptyRow()]
    );
    setExtraNotes(record.extraNotes || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    flash('تم فتح السجل للتعديل');
  }

  function deleteRecord(id: string) {
    if (!window.confirm('حذف هذا السجل المحفوظ؟')) return;

    const next = savedRecords.filter((record) => record.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSavedRecords(next);

    if (recordId === id) resetForm();
  }

  async function createPdfDocument() {
    if (!pdfRef.current) {
      throw new Error('PDF template not ready');
    }

    const target = pdfRef.current;

    await waitForImages(target);

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => resolve())
      );
    });

    const canvas = await html2canvas(target, {
      scale: 4,
      backgroundColor: '#f8f3e8',
      useCORS: true,
      allowTaint: false,
      logging: false,
      width: 794,
      height: 1123,
      windowWidth: 794,
      windowHeight: 1123,
      scrollX: 0,
      scrollY: 0,
    });

    const image = canvas.toDataURL('image/png');

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    // صفحة A4 واحدة فقط — تمنع الصفحة الثانية الفارغة.
    pdf.addImage(
      image,
      'PNG',
      0,
      0,
      210,
      297,
      undefined,
      'FAST'
    );

    return pdf;
  }

  function pdfName() {
    const cleanName = (accountName || 'حساب')
      .replace(/[\\/:*?"<>|]/g, '-')
      .trim();

    return `BAKR-PRO-سجل-السحوبات-${cleanName || 'حساب'}-${createdDate}.pdf`;
  }

  function pdfShareText() {
    return (
      `سجل السحوبات المالية - BAKR PRO\n` +
      `${accountName ? `الحساب: ${accountName}\n` : ''}` +
      `المبلغ الأساسي: ${formatMoney(base)} ريال\n` +
      `إجمالي المسحوب: ${formatMoney(totalWithdrawn)} ريال\n` +
      `المتبقي: ${formatMoney(remaining)} ريال`
    );
  }

  function pdfBase64(pdf: jsPDF) {
    const dataUri = pdf.output('datauristring');
    const commaIndex = dataUri.indexOf(',');

    if (commaIndex < 0) {
      throw new Error('تعذر تحويل PDF');
    }

    return dataUri.slice(commaIndex + 1);
  }

  async function savePdf() {
    if (base <= 0) {
      alert('اكتب المبلغ الأساسي أولاً');
      return;
    }

    setBusy(true);

    try {
      saveRecord();

      const pdf = await createPdfDocument();
      const name = pdfName();

      if (Capacitor.isNativePlatform()) {
        const result = await Filesystem.writeFile({
          path: name,
          data: pdfBase64(pdf),
          directory: Directory.Documents,
          recursive: true,
        });

        flash('تم حفظ PDF في المستندات');
        console.log('PDF saved:', result.uri);
      } else {
        pdf.save(name);
        flash('تم حفظ PDF');
      }
    } catch (error) {
      console.error('PDF save error:', error);
      alert('تعذر حفظ PDF. تأكد من تحديث التطبيق ثم حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  async function sharePdf(preferWhatsApp = false) {
    if (base <= 0) {
      alert('اكتب المبلغ الأساسي أولاً');
      return;
    }

    setBusy(true);

    try {
      saveRecord();

      const pdf = await createPdfDocument();
      const name = pdfName();
      const text = pdfShareText();

      if (Capacitor.isNativePlatform()) {
        const result = await Filesystem.writeFile({
          path: name,
          data: pdfBase64(pdf),
          directory: Directory.Cache,
          recursive: true,
        });

        await Share.share({
          title: 'سجل السحوبات المالية - BAKR PRO',
          text,
          files: [result.uri],
          dialogTitle: preferWhatsApp
            ? 'اختر واتساب لإرسال ملف PDF'
            : 'مشاركة سجل السحوبات',
        });

        flash(
          preferWhatsApp
            ? 'اختر واتساب من قائمة المشاركة'
            : 'تم فتح المشاركة'
        );
        return;
      }

      const blob = pdf.output('blob');
      const file = new File([blob], name, {
        type: 'application/pdf',
      });

      const canShareFile =
        typeof navigator.share === 'function' &&
        (!navigator.canShare ||
          navigator.canShare({
            files: [file],
          }));

      if (canShareFile) {
        await navigator.share({
          title: 'سجل السحوبات المالية - BAKR PRO',
          text,
          files: [file],
        });

        flash('تم فتح المشاركة');
        return;
      }

      pdf.save(name);

      if (preferWhatsApp) {
        window.open(
          `https://wa.me/?text=${encodeURIComponent(text)}`,
          '_blank'
        );
      } else if (typeof navigator.share === 'function') {
        await navigator.share({
          title: 'سجل السحوبات المالية - BAKR PRO',
          text,
        });
      } else {
        flash('تم تنزيل PDF للمشاركة');
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('PDF share error:', error);
        alert('تعذر مشاركة PDF. حاول مرة أخرى.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppLayout showBottomNav={false}>
      <div dir="rtl" className="w-full pb-28" style={{ maxWidth: 760, margin: '0 auto' }}>
        <section
          className="rounded-[28px] p-5 overflow-hidden"
          style={{
            background:
              'radial-gradient(circle at left top, rgba(245,158,11,.20), transparent 36%), linear-gradient(145deg,#122744,#071421 74%)',
            border: '1px solid rgba(226,190,96,.30)',
            boxShadow: '0 18px 46px rgba(0,0,0,.30)',
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-[18px] flex items-center justify-center"
                style={{
                  background: 'linear-gradient(145deg,#f6d77a,#b88928)',
                  boxShadow: '0 10px 28px rgba(245,158,11,.25)',
                }}
              >
                <Wallet className="w-7 h-7 text-slate-950" />
              </div>

              <div>
                <p className="text-[10px] font-black tracking-[.18em] text-amber-300">
                  BAKR PRO
                </p>
                <h1 className="text-[20px] font-black text-white mt-1">
                  سجل السحوبات المالية
                </h1>
                <p className="text-[10px] text-slate-400 mt-1">
                  حساب مستقل لكل مبلغ • حفظ • PDF • مشاركة
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={resetForm}
              className="w-11 h-11 rounded-[14px] flex items-center justify-center active:scale-95"
              style={{
                background: 'rgba(245,158,11,.10)',
                border: '1px solid rgba(245,158,11,.22)',
              }}
              title="سجل جديد"
            >
              <RotateCcw className="w-5 h-5 text-amber-300" />
            </button>
          </div>
        </section>

        {message && (
          <div
            className="mt-3 rounded-[15px] px-4 py-3 flex items-center gap-2"
            style={{
              background: 'rgba(34,197,94,.08)',
              border: '1px solid rgba(34,197,94,.18)',
            }}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-bold text-emerald-300">{message}</span>
          </div>
        )}

        <section
          className="mt-4 rounded-[25px] p-4"
          style={{
            background:
              'linear-gradient(145deg,rgba(13,27,47,.98),rgba(7,17,31,.99))',
            border: '1px solid rgba(255,255,255,.07)',
          }}
        >
          <div className="grid grid-cols-1 gap-3">
            <FieldLabel icon={UserRound} label="اسم صاحب الحساب / الجهة">
              <input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="مثال: أبو محمد / شركة ..."
                className="w-full h-12 rounded-[15px] px-3 bg-slate-950/40 text-white text-[12px] outline-none"
                style={{ border: '1px solid rgba(255,255,255,.08)' }}
              />
            </FieldLabel>

            <div className="grid grid-cols-2 gap-3">
              <FieldLabel icon={Wallet} label="المبلغ الأساسي">
                <div className="relative">
                  <input
                    inputMode="decimal"
                    value={baseAmount}
                    onChange={(e) => setBaseAmount(e.target.value)}
                    placeholder="5000"
                    className="w-full h-12 rounded-[15px] pr-3 pl-14 bg-slate-950/40 text-amber-300 text-[14px] font-black outline-none"
                    style={{ border: '1px solid rgba(245,158,11,.20)' }}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-500">
                    ريال
                  </span>
                </div>
              </FieldLabel>

              <FieldLabel icon={CalendarDays} label="تاريخ الحساب">
                <input
                  type="date"
                  value={createdDate}
                  onChange={(e) => setCreatedDate(e.target.value)}
                  className="w-full h-12 rounded-[15px] px-3 bg-slate-950/40 text-white text-[11px] outline-none"
                  style={{ border: '1px solid rgba(255,255,255,.08)' }}
                />
              </FieldLabel>
            </div>
          </div>
        </section>

        <section className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-[15px] font-black text-white">السحوبات</h2>
              <p className="text-[9px] text-slate-500 mt-1">
                المبلغ • سبب السحب • التاريخ • الملاحظات
              </p>
            </div>

            <button
              type="button"
              onClick={addRow}
              className="h-10 px-3 rounded-[13px] flex items-center gap-1.5 text-[10px] font-black text-slate-950 bg-amber-400 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              إضافة سحب
            </button>
          </div>

          <div className="space-y-3">
            {rows.map((row, index) => (
              <div
                key={row.id}
                className="rounded-[22px] p-3.5"
                style={{
                  background:
                    'linear-gradient(145deg,rgba(13,27,47,.96),rgba(7,17,31,.99))',
                  border: '1px solid rgba(255,255,255,.06)',
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-amber-300">
                    سحب رقم {index + 1}
                  </span>

                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95"
                    style={{
                      background: 'rgba(239,68,68,.08)',
                      border: '1px solid rgba(239,68,68,.15)',
                    }}
                    aria-label="حذف السحب"
                  >
                    <Trash2 className="w-4 h-4 text-rose-300" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <InputBox
                    label="المبلغ"
                    value={row.amount}
                    onChange={(value) => updateRow(row.id, 'amount', value)}
                    inputMode="decimal"
                    placeholder="0"
                  />
                  <InputBox
                    label="سبب السحب"
                    value={row.reason}
                    onChange={(value) => updateRow(row.id, 'reason', value)}
                    placeholder="ديزل، سائق..."
                  />
                  <InputBox
                    label="التاريخ"
                    value={row.date}
                    onChange={(value) => updateRow(row.id, 'date', value)}
                    type="date"
                  />
                  <InputBox
                    label="ملاحظات"
                    value={row.notes}
                    onChange={(value) => updateRow(row.id, 'notes', value)}
                    placeholder="اختياري"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 grid grid-cols-3 gap-2.5">
          <SummaryCard label="المبلغ الأساسي" value={`${formatMoney(base)} ر.س`} color="#60a5fa" />
          <SummaryCard label="إجمالي المسحوب" value={`${formatMoney(totalWithdrawn)} ر.س`} color="#fb7185" />
          <SummaryCard
            label="المتبقي"
            value={`${formatMoney(remaining)} ر.س`}
            color={remaining >= 0 ? '#4ade80' : '#fb7185'}
          />
        </section>

        <section
          className="mt-4 rounded-[22px] p-4"
          style={{
            background:
              'linear-gradient(145deg,rgba(13,27,47,.96),rgba(7,17,31,.99))',
            border: '1px solid rgba(255,255,255,.06)',
          }}
        >
          <label className="text-[10px] font-black text-slate-300">
            ملاحظات إضافية
          </label>
          <textarea
            value={extraNotes}
            onChange={(e) => setExtraNotes(e.target.value)}
            placeholder="أي ملاحظات خاصة بالحساب..."
            rows={3}
            className="mt-2 w-full rounded-[15px] p-3 bg-slate-950/40 text-white text-[11px] outline-none resize-none"
            style={{ border: '1px solid rgba(255,255,255,.08)' }}
          />
        </section>

        <section className="mt-4 grid grid-cols-2 gap-2.5">
          <ActionButton
            label={recordId ? 'حفظ التعديل' : 'حفظ'}
            icon={Save}
            onClick={() => saveRecord()}
            color="#4ade80"
            disabled={busy}
          />
          <ActionButton
            label="تعديل"
            icon={Pencil}
            onClick={() =>
              flash('عدّل أي خانة مباشرة ثم اضغط حفظ التعديل')
            }
            color="#60a5fa"
            disabled={busy}
          />
          <ActionButton
            label={busy ? 'جاري تجهيز PDF...' : 'حفظ PDF'}
            icon={FileDown}
            onClick={savePdf}
            color="#fbbf24"
            disabled={busy}
          />
          <ActionButton
            label="مشاركة"
            icon={Share2}
            onClick={() => sharePdf(false)}
            color="#c084fc"
            disabled={busy}
          />
          <div className="col-span-2">
            <ActionButton
              label="مشاركة عبر واتساب"
              icon={MessageCircle}
              onClick={() => sharePdf(true)}
              color="#4ade80"
              disabled={busy}
            />
          </div>
        </section>

        {savedRecords.length > 0 && (
          <section className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-[15px] font-black text-white">
                  السجلات المحفوظة
                </h2>
                <p className="text-[9px] text-slate-500 mt-1">
                  كل حساب محفوظ بشكل مستقل
                </p>
              </div>
              <span className="text-[10px] font-bold text-amber-300">
                {savedRecords.length} سجل
              </span>
            </div>

            <div className="space-y-2.5">
              {savedRecords.map((record) => {
                const rowTotal = (record.rows || []).reduce(
                  (sum, row) => sum + moneyNumber(row.amount),
                  0
                );
                const recordBase = moneyNumber(record.baseAmount);

                return (
                  <div
                    key={record.id}
                    className="rounded-[18px] p-3 flex items-center gap-3"
                    style={{
                      background:
                        'linear-gradient(145deg,rgba(13,27,47,.96),rgba(7,17,31,.99))',
                      border: '1px solid rgba(255,255,255,.06)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => openRecord(record)}
                      className="flex-1 text-right min-w-0"
                    >
                      <p className="text-[11px] font-black text-white truncate">
                        {record.accountName || 'حساب بدون اسم'}
                      </p>
                      <p className="text-[9px] text-slate-500 mt-1">
                        {record.createdDate} • الأساسي {formatMoney(recordBase)} • المتبقي{' '}
                        {formatMoney(recordBase - rowTotal)}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => openRecord(record)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{
                        background: 'rgba(96,165,250,.08)',
                        border: '1px solid rgba(96,165,250,.16)',
                      }}
                    >
                      <Pencil className="w-4 h-4 text-blue-300" />
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteRecord(record.id)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{
                        background: 'rgba(239,68,68,.08)',
                        border: '1px solid rgba(239,68,68,.16)',
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-rose-300" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* قالب PDF النهائي المعتمد — نسخة مصححة وثابتة للطباعة */}
        <div
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: 794,
            transform: 'translateX(-220vw)',
            pointerEvents: 'none',
            opacity: 1,
            zIndex: 1,
          }}
        >
          <div
            ref={pdfRef}
            dir="rtl"
            style={{
              width: 794,
              height: 1123,
              boxSizing: 'border-box',
              overflow: 'hidden',
              background: '#f8f4ea',
              color: '#0b2440',
              fontFamily: 'Tahoma, Arial, sans-serif',
              position: 'relative',
              padding: 18,
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                border: '2px solid #cba64d',
                borderRadius: 24,
                overflow: 'hidden',
                background: '#fffdfa',
                boxSizing: 'border-box',
                position: 'relative',
              }}
            >
              {/* رأس التقرير */}
              <div
                style={{
                  height: 130,
                  boxSizing: 'border-box',
                  padding: '20px 26px',
                  background:
                    'radial-gradient(circle at 12% 15%,rgba(224,186,91,.16),transparent 30%),linear-gradient(125deg,#071a2f 0%,#0d3155 58%,#071a2f 100%)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '4px solid #cba64d',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                  <div
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: 20,
                      background: 'linear-gradient(145deg,#ffe28c,#b98324)',
                      color: '#071a2f',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 36,
                      fontWeight: 900,
                      border: '2px solid rgba(255,255,255,.24)',
                      boxShadow: '0 8px 20px rgba(0,0,0,.22)',
                      fontFamily: 'Arial, sans-serif',
                    }}
                  >
                    B
                  </div>

                  <div>
                    <div
                      style={{
                        direction: 'ltr',
                        fontFamily: 'Arial, sans-serif',
                        fontSize: 28,
                        fontWeight: 900,
                        letterSpacing: 1.4,
                      }}
                    >
                      <span>BAKR </span>
                      <span style={{ color: '#efc85d' }}>PRO</span>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        marginTop: 6,
                        color: '#eef3f7',
                      }}
                    >
                      إدارة مالية - تتبع ومراقبة
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#cbd5df' }}>تاريخ التقرير</div>
                  <div
                    style={{
                      marginTop: 5,
                      fontSize: 15,
                      color: '#efc85d',
                      fontWeight: 900,
                      direction: 'ltr',
                      fontFamily: 'Arial, sans-serif',
                    }}
                  >
                    {createdDate || '—'}
                  </div>
                </div>
              </div>

              {/* عنوان التقرير */}
              <div
                style={{
                  height: 112,
                  boxSizing: 'border-box',
                  padding: '20px 28px 14px',
                  textAlign: 'center',
                  background: '#fffdfa',
                }}
              >
                <div
                  style={{
                    fontSize: 34,
                    lineHeight: 1.12,
                    fontWeight: 900,
                    color: '#071f3d',
                  }}
                >
                  سجل السحوبات المالية
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: '#264566',
                    marginTop: 8,
                    fontWeight: 700,
                  }}
                >
                  تفاصيل السحوبات والمصروفات الخاصة بالمعدة
                </div>
                <div
                  style={{
                    width: 108,
                    height: 4,
                    background: '#d0a548',
                    borderRadius: 99,
                    margin: '11px auto 0',
                  }}
                />
              </div>

              <div
                style={{
                  padding: '0 24px',
                  boxSizing: 'border-box',
                  height: 735,
                }}
              >
                {/* بيانات الحساب */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.35fr .65fr',
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      height: 68,
                      border: '1px solid #dfd1b0',
                      borderRadius: 15,
                      background: '#fffdfa',
                      padding: '11px 15px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ fontSize: 9, color: '#726957', fontWeight: 700 }}>
                      اسم صاحب الحساب / المعدة
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        color: '#071f3d',
                        fontWeight: 900,
                        marginTop: 6,
                      }}
                    >
                      {accountName || '—'}
                    </div>
                  </div>

                  <div
                    style={{
                      height: 68,
                      border: '1px solid #dfd1b0',
                      borderRadius: 15,
                      background: '#fffdfa',
                      padding: '11px 15px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ fontSize: 9, color: '#726957', fontWeight: 700 }}>
                      عدد عمليات السحب
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        color: '#071f3d',
                        fontWeight: 900,
                        marginTop: 6,
                        direction: 'ltr',
                        fontFamily: 'Arial, sans-serif',
                      }}
                    >
                      {shownRows.filter((row) => moneyNumber(row.amount) > 0).length}
                    </div>
                  </div>
                </div>

                {/* المبلغ الأساسي — مصحح بدون أي تداخل */}
                <div
                  style={{
                    height: 126,
                    borderRadius: 18,
                    background:
                      'radial-gradient(circle at 85% 45%,rgba(214,174,78,.12),transparent 27%),linear-gradient(125deg,#071f3d,#0d355b)',
                    border: '2px solid #d2aa4f',
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    marginBottom: 12,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        fontSize: 20,
                        lineHeight: 1.1,
                        fontWeight: 900,
                        color: '#ffffff',
                      }}
                    >
                      المبلغ الأساسي
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 11,
                        direction: 'ltr',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 48,
                          lineHeight: 1,
                          fontWeight: 900,
                          color: '#f1c95e',
                          fontFamily: 'Arial, sans-serif',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatMoneyEn(base)}
                      </span>
                      <span
                        style={{
                          fontSize: 18,
                          lineHeight: 1,
                          fontWeight: 900,
                          color: '#ffffff',
                          direction: 'rtl',
                        }}
                      >
                        ريال
                      </span>
                    </div>
                  </div>
                </div>

                {/* تفاصيل السحوبات */}
                <div
                  style={{
                    height: 38,
                    borderRadius: '13px 13px 0 0',
                    background: 'linear-gradient(90deg,#ead083,#d7aa49,#f0da93)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 15px',
                    boxSizing: 'border-box',
                    color: '#071f3d',
                    fontSize: 15,
                    fontWeight: 900,
                  }}
                >
                  تفاصيل السحوبات والمصروفات
                </div>

                <div
                  style={{
                    border: '1px solid #d9ceb8',
                    borderTop: 'none',
                    borderRadius: '0 0 13px 13px',
                    overflow: 'hidden',
                    background: '#fff',
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 118px 1.25fr 110px 1fr',
                      height: 36,
                      alignItems: 'center',
                      background: '#082745',
                      color: '#fff',
                      fontSize: 9.5,
                      fontWeight: 900,
                    }}
                  >
                    {['#', 'التاريخ', 'البند / نوع المصروف', 'المبلغ (ريال)', 'ملاحظات'].map(
                      (label) => (
                        <div
                          key={label}
                          style={{
                            textAlign: 'center',
                            padding: '7px 5px',
                            borderLeft: '1px solid rgba(255,255,255,.11)',
                          }}
                        >
                          {label}
                        </div>
                      )
                    )}
                  </div>

                  {shownRows.slice(0, 6).map((row, index) => (
                    <div
                      key={row.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 118px 1.25fr 110px 1fr',
                        minHeight: 39,
                        alignItems: 'center',
                        background: index % 2 === 0 ? '#fffdfa' : '#f7f2e8',
                        borderTop: '1px solid #e9dfcc',
                        fontSize: 10,
                      }}
                    >
                      <div style={{ textAlign: 'center', fontWeight: 900 }}>{index + 1}</div>
                      <div
                        style={{
                          textAlign: 'center',
                          color: '#17385d',
                          direction: 'ltr',
                          fontFamily: 'Arial, sans-serif',
                        }}
                      >
                        {row.date || '—'}
                      </div>
                      <div style={{ padding: '7px 9px', color: '#071f3d', fontWeight: 800 }}>
                        {row.reason || '—'}
                      </div>
                      <div
                        style={{
                          textAlign: 'center',
                          color: '#a31120',
                          fontSize: 12.5,
                          fontWeight: 900,
                          direction: 'ltr',
                          fontFamily: 'Arial, sans-serif',
                        }}
                      >
                        {row.amount ? formatMoneyEn(moneyNumber(row.amount)) : '—'}
                      </div>
                      <div style={{ padding: '7px 9px', color: '#526273', textAlign: 'center' }}>
                        {row.notes || '—'}
                      </div>
                    </div>
                  ))}
                </div>

                {/* الملخص المالي */}
                <div
                  style={{
                    height: 38,
                    borderRadius: '13px 13px 0 0',
                    background: 'linear-gradient(90deg,#ead083,#d7aa49,#f0da93)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 15px',
                    boxSizing: 'border-box',
                    color: '#071f3d',
                    fontSize: 15,
                    fontWeight: 900,
                  }}
                >
                  الملخص المالي
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 9,
                    padding: '9px 0 12px',
                  }}
                >
                  <div
                    style={{
                      height: 96,
                      borderRadius: 14,
                      border: '1px solid #bad2e8',
                      background: '#eef6fd',
                      padding: '11px 12px',
                      boxSizing: 'border-box',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#092a4c' }}>المبلغ الأساسي</div>
                    <div
                      style={{
                        fontSize: 26,
                        lineHeight: 1,
                        fontWeight: 900,
                        color: '#092a4c',
                        marginTop: 10,
                        direction: 'ltr',
                        fontFamily: 'Arial, sans-serif',
                      }}
                    >
                      {formatMoneyEn(base)}
                    </div>
                    <div style={{ fontSize: 10, color: '#092a4c', marginTop: 4 }}>ريال</div>
                  </div>

                  <div
                    style={{
                      height: 96,
                      borderRadius: 14,
                      border: '1px solid #ecc5c5',
                      background: '#fff0f0',
                      padding: '11px 12px',
                      boxSizing: 'border-box',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#8e111b' }}>إجمالي المسحوب</div>
                    <div
                      style={{
                        fontSize: 26,
                        lineHeight: 1,
                        fontWeight: 900,
                        color: '#a5111d',
                        marginTop: 10,
                        direction: 'ltr',
                        fontFamily: 'Arial, sans-serif',
                      }}
                    >
                      {formatMoneyEn(totalWithdrawn)}
                    </div>
                    <div style={{ fontSize: 10, color: '#a5111d', marginTop: 4 }}>ريال</div>
                  </div>

                  <div
                    style={{
                      height: 96,
                      borderRadius: 14,
                      border: '1px solid #c3dfcc',
                      background: '#eef9f1',
                      padding: '11px 12px',
                      boxSizing: 'border-box',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#12653c' }}>المتبقي</div>
                    <div
                      style={{
                        fontSize: 26,
                        lineHeight: 1,
                        fontWeight: 900,
                        color: remaining >= 0 ? '#0e7a45' : '#a5111d',
                        marginTop: 10,
                        direction: 'ltr',
                        fontFamily: 'Arial, sans-serif',
                      }}
                    >
                      {formatMoneyEn(remaining)}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: remaining >= 0 ? '#0e7a45' : '#a5111d',
                        marginTop: 4,
                      }}
                    >
                      ريال
                    </div>
                  </div>
                </div>

                {/* الملاحظات */}
                <div
                  style={{
                    height: 35,
                    borderRadius: '12px 12px 0 0',
                    background: 'linear-gradient(90deg,#ead083,#d7aa49,#f0da93)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 14px',
                    color: '#071f3d',
                    fontSize: 14,
                    fontWeight: 900,
                    boxSizing: 'border-box',
                  }}
                >
                  الملاحظات
                </div>
                <div
                  style={{
                    height: 58,
                    border: '1px solid #ded2b9',
                    borderTop: 'none',
                    borderRadius: '0 0 12px 12px',
                    background: '#fffdfa',
                    padding: '11px 14px',
                    boxSizing: 'border-box',
                    color: '#5e6873',
                    fontSize: 10.5,
                    lineHeight: 1.6,
                  }}
                >
                  {extraNotes || 'لا توجد ملاحظات إضافية.'}
                </div>
              </div>

              {/* الفوتر الثابت */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 126,
                  background:
                    'linear-gradient(170deg,#fffdfa 0%,#fffdfa 24%,#d0aa4e 25%,#0a2d50 31%,#071b31 100%)',
                  padding: '47px 30px 15px',
                  boxSizing: 'border-box',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  alignItems: 'center',
                  gap: 16,
                  color: '#fff',
                }}
              >
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 900 }}>
                    إدارة مالية للمعدات والكرينات
                  </div>
                  <div style={{ fontSize: 8.5, color: '#cbd6df', marginTop: 5 }}>
                    تنظيم مالي .. لعمل أكثر استقراراً
                  </div>
                </div>

                <div
                  style={{
                    width: 82,
                    height: 82,
                    borderRadius: 11,
                    background: '#fff',
                    padding: 5,
                    boxSizing: 'border-box',
                    border: '2px solid #d2ad50',
                  }}
                >
                  <img
                    src="/icons/bakr-whatsapp-qr.png"
                    alt="WhatsApp QR"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>

                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 9.5, color: '#eef3f7' }}>للتواصل عبر واتساب</div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 900,
                      color: '#fff',
                      marginTop: 4,
                      direction: 'ltr',
                      fontFamily: 'Arial, sans-serif',
                    }}
                  >
                    {PHONE}
                  </div>
                  <div style={{ fontSize: 8.5, color: '#cbd6df', marginTop: 4 }}>
                    دعم سريع .. لخدمة أفضل
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}


function PdfMetric({
  label,
  value,
  accent,
  background,
}: {
  label: string;
  value: string;
  accent: string;
  background: string;
}) {
  return (
    <div
      style={{
        minHeight: 70,
        borderRadius: 15,
        padding: '12px 13px',
        boxSizing: 'border-box',
        background,
        border: `1px solid ${accent}22`,
      }}
    >
      <div style={{ color: '#756c5c', fontSize: 9, fontWeight: 700 }}>
        {label}
      </div>
      <div
        style={{
          color: accent,
          fontSize: 17,
          fontWeight: 900,
          marginTop: 9,
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FieldLabel({
  icon: Icon,
  label,
  children,
}: {
  icon: any;
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-4 h-4 text-amber-300" />
        <span className="text-[9px] font-black text-slate-400">{label}</span>
      </div>
      {children}
    </label>
  );
}

function InputBox({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <label className="block">
      <span className="text-[8px] font-black text-slate-500">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full h-11 rounded-[13px] px-2.5 bg-slate-950/40 text-white text-[10px] outline-none"
        style={{ border: '1px solid rgba(255,255,255,.07)' }}
      />
    </label>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="rounded-[18px] p-3 min-w-0"
      style={{
        background:
          'linear-gradient(145deg,rgba(13,27,47,.96),rgba(7,17,31,.99))',
        border: `1px solid ${color}24`,
      }}
    >
      <p className="text-[8px] text-slate-500">{label}</p>
      <p className="text-[11px] font-black mt-2 truncate" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
  color,
  disabled,
}: {
  label: string;
  icon: any;
  onClick: () => void;
  color: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-[54px] rounded-[16px] flex items-center justify-center gap-2 text-[10px] font-black active:scale-95 disabled:opacity-50"
      style={{
        color,
        background: `${color}10`,
        border: `1px solid ${color}28`,
      }}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function PdfInfo({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: '1px solid #e2d7bf',
        background: '#fbf8ef',
        padding: '13px 15px',
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: '#86795d',
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 900, marginTop: 5 }}>
        {value}
      </div>
    </div>
  );
}

function PdfSummary({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${accent}33`,
        background: '#fffdf8',
        padding: 14,
      }}
    >
      <div
        style={{
          color: '#796f5e',
          fontSize: 9,
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: accent,
          fontSize: 15,
          fontWeight: 900,
          marginTop: 7,
        }}
      >
        {value}
      </div>
    </div>
  );
                            }
