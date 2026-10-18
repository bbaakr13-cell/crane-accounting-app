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

function ExistingFinancialWithdrawalsPage({ onBack }: { onBack: () => void }) {
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
        <button type="button" onClick={onBack} className="mb-3 rounded-xl px-4 py-2.5 text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20">← الرجوع إلى خيارات السجل</button>
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


/** صفحة اختيار مستقلة؛ لا تمس بيانات أو شكل سجل السحوبات الأصلي. */
export function FinancialWithdrawalsPage() {
  const [mode, setMode] = useState<'menu' | 'original' | 'people'>('menu');

  if (mode === 'original') {
    return <ExistingFinancialWithdrawalsPage onBack={() => setMode('menu')} />;
  }

  if (mode === 'people') {
    return <NamedReceiptsSection onBack={() => setMode('menu')} />;
  }

  return (
    <AppLayout showBottomNav={false}>
      <main dir="rtl" className="mx-auto w-full max-w-[760px] pb-24">
        <div className="rounded-[25px] p-6 mb-5" style={{background:'linear-gradient(135deg,#071b32,#153858)',border:'1px solid #aa8842'}}>
          <p className="text-amber-300 text-[12px] font-black tracking-widest" dir="ltr">BAKR PRO</p>
          <h1 className="text-white text-[22px] font-black mt-2">السجل المالي</h1>
          <p className="text-slate-300 text-[12px] mt-2">اختر نوع الحساب الذي تريد استخدامه</p>
        </div>
        <div className="space-y-4">
          <button type="button" onClick={() => setMode('original')} className="w-full rounded-[23px] p-5 text-right active:scale-[.98] transition-transform" style={{background:'linear-gradient(145deg,#102841,#081421)',border:'1px solid rgba(251,191,36,.35)'}}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center bg-amber-400/10"><Wallet className="w-8 h-8 text-amber-300" /></div>
              <div className="flex-1"><p className="text-white font-black text-[17px]">سجل السحوبات المالية</p><p className="text-slate-400 text-[11px] mt-1.5">السجل الأصلي المعتمد • المبلغ الأساسي • السحوبات • المتبقي</p></div>
              <span className="text-amber-300 text-xl">‹</span>
            </div>
          </button>
          <button type="button" onClick={() => setMode('people')} className="w-full rounded-[23px] p-5 text-right active:scale-[.98] transition-transform" style={{background:'linear-gradient(145deg,#102e39,#091923)',border:'1px solid rgba(74,222,128,.35)'}}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center bg-emerald-400/10"><UserRound className="w-8 h-8 text-emerald-300" /></div>
              <div className="flex-1"><p className="text-white font-black text-[17px]">سجل الاستلامات بالأسماء</p><p className="text-slate-400 text-[11px] mt-1.5">أضف اسم ياسر أو غيره • سجّل ما استلمه ومن مَن • إجمالي كل شخص وPDF مستقل</p></div>
              <span className="text-emerald-300 text-xl">‹</span>
            </div>
          </button>
        </div>
        <p className="text-center text-slate-500 text-[10px] mt-5">حسابات الأشخاص منفصلة تماماً عن السحوبات الأصلية.</p>
      </main>
    </AppLayout>
  );
}


// —————————————— استلامات الأشخاص (مخزن مستقل) ——————————————
type NRItem = {
  id: string;
  amount: string;
  receivedFrom: string;
  date: string;
  notes: string;
  createdAt: string;
};

type NRPerson = {
  id: string;
  name: string;
  createdAt: string;
  entries: NRItem[];
};

const NAMED_RECEIPTS_KEY = 'bakr_pro_named_receipts_v1';
const NAMED_RECEIPTS_QR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYwAAAGMAQAAAADhQqjnAAACCUlEQVR4nO2cQW7EIAxFn6vu4Qa9/7HmBnACd4EhoU1bTVvNkOiziJKQJ9mSZczHijl3jvpyLwFChAgRIkSIECFCfkBsjAzV2hvA8jz1cMOEXAdJ3gZgb041d7eMl2nqCYYJuRCyZapq9hYR1d7sktgTDBNycuT14F0qgAFwpGws64uQ0yB+M4D0lXJ2Jl+ELIBseWwfUpbK/nGOtmV9EbI2UmPvSKv5RyWWp6knGCbk9EjkseN1sdrR1LK+CFkTIXSJIVCkuAe8AJC83cQXZVlfhKyJTDE2oqvFVYhjZfpSMSbkzrHV/La7Atb3lSFi1GypPNAwIZdBenbySFwtd0GX9wuAF7b1VHlMyH1jymOW3MCreTwWgFRmrWxZX4SsifR6jKn6GqeTkd/GVXlMyK+R5CRvJ5X7sj8Us96D8QTDhFwIaSHkhdHeQ09oXhin5KfwRchKyHSW5DVHPZacap48NputTnuoYUIug8w6f3J6RNFq/t6DsSv6l/VFyNLIvtnVbzZ0V7YyTPWYkN8hfa0MfRUjspl/aiHTWinkrzX/hz7Yan6z1nTBLpudwhchKyGHfbBu1TbdNRXAq6GzJCH/FWM1R6k/wqxm+kZgYV+ErIkc9cEmHwdJBl6zzpKE/AHpMVZHw0VEV1czijWt7NGGCbkMYscdsN8M/VNFiBAhQoQIESLkP5F3mgIEwnlIHMgAAAAASUVORK5CYII=';
const NR_ROWS_PER_PAGE = 9;

function nrToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function nrMoney(n: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
}

function nrAmount(value: string) {
  const normalized = String(value).replace(/[٬,\s]/g, '').replace(/[٠-٩]/g, (s) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(s))).replace(/[۰-۹]/g, (s) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(s)));
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function nrNewId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nrRead(): NRPerson[] {
  try {
    const value = JSON.parse(localStorage.getItem(NAMED_RECEIPTS_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is NRPerson =>
      entry !== null && typeof entry === 'object' && typeof entry.id === 'string' &&
      typeof entry.name === 'string' && Array.isArray(entry.entries)
    );
  } catch {
    return [];
  }
}

function nrTotal(person: NRPerson) {
  return person.entries.reduce((sum, item) => sum + nrAmount(item.amount), 0);
}

function nrChunks<T,>(items: T[], count: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += count) {
    result.push(items.slice(index, index + count));
  }
  return result.length ? result : [[]];
}

function NamedReceiptsSection({ onBack }: { onBack: () => void }) {
  const [people, setPeople] = useState<NRPerson[]>(() => nrRead());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [filter, setFilter] = useState('');
  const [amount, setAmount] = useState('');
  const [receivedFrom, setReceivedFrom] = useState('');
  const [receivedDate, setReceivedDate] = useState(nrToday());
  const [notes, setNotes] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState('');
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const active = people.find((person) => person.id === activeId) || null;
  const activeTotal = active ? nrTotal(active) : 0;
  const reportPages = active ? nrChunks(active.entries, NR_ROWS_PER_PAGE) : [];
  const matching = people.filter((person) => person.name.toLowerCase().includes(filter.trim().toLowerCase()));

  function inform(text: string) {
    setFeedback(text);
    window.setTimeout(() => setFeedback(''), 2800);
  }

  function persist(next: NRPerson[]) {
    try {
      localStorage.setItem(NAMED_RECEIPTS_KEY, JSON.stringify(next));
      setPeople(next);
      return true;
    } catch (error) {
      console.error('Failed to save named receipts:', error);
      alert('تعذر حفظ السجل على الجهاز. تأكد من توفر مساحة تخزين.');
      return false;
    }
  }

  function clearForm() {
    setAmount('');
    setReceivedFrom('');
    setReceivedDate(nrToday());
    setNotes('');
    setEditId(null);
  }

  function addPerson() {
    const name = newName.trim().replace(/\s+/g, ' ');
    if (!name) {
      alert('اكتب اسم الشخص أولاً');
      return;
    }
    const duplicate = people.find((person) => person.name.trim().toLowerCase() === name.toLowerCase());
    if (duplicate) {
      setActiveId(duplicate.id);
      setNewName('');
      inform('الاسم موجود، تم فتح حسابه');
      return;
    }
    const person: NRPerson = {
      id: nrNewId(), name, createdAt: new Date().toISOString(), entries: [],
    };
    if (!persist([person, ...people])) return;
    setActiveId(person.id);
    setNewName('');
    clearForm();
    inform('تم إنشاء حساب باسم ' + name);
  }

  function saveEntry() {
    if (!active) return;
    if (nrAmount(amount) <= 0) {
      alert('اكتب مبلغ الاستلام أولاً');
      return;
    }
    if (!receivedFrom.trim()) {
      alert('اكتب اسم الشخص الذي تم الاستلام منه');
      return;
    }
    const entry: NRItem = {
      id: editId || nrNewId(),
      amount: String(nrAmount(amount)),
      receivedFrom: receivedFrom.trim(),
      date: receivedDate || nrToday(),
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };
    const next = people.map((person) => person.id === active.id ? {
      ...person,
      entries: editId
        ? person.entries.map((item) => item.id === editId ? entry : item)
        : [...person.entries, entry],
    } : person);
    if (persist(next)) {
      clearForm();
      inform(editId ? 'تم حفظ تعديل الاستلام' : 'تم حفظ الاستلام وإضافته للإجمالي');
    }
  }

  function beginEdit(entry: NRItem) {
    setAmount(entry.amount);
    setReceivedFrom(entry.receivedFrom);
    setReceivedDate(entry.date);
    setNotes(entry.notes);
    setEditId(entry.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function deleteEntry(entryId: string) {
    if (!active || !window.confirm('هل تريد حذف عملية الاستلام هذه؟')) return;
    const next = people.map((person) => person.id === active.id
      ? { ...person, entries: person.entries.filter((entry) => entry.id !== entryId) }
      : person);
    if (persist(next)) {
      if (editId === entryId) clearForm();
      inform('تم حذف عملية الاستلام');
    }
  }

  function deletePerson(id: string) {
    const person = people.find((item) => item.id === id);
    if (!person) return;
    if (!window.confirm(`حذف حساب ${person.name} وكل استلاماته؟ لا يمكن التراجع عن ذلك.`)) return;
    if (persist(people.filter((item) => item.id !== id))) {
      if (activeId === id) setActiveId(null);
      clearForm();
    }
  }

  async function createNamedPdf() {
    if (!active) throw new Error('لا يوجد شخص محدد');
    if (!active.entries.length) throw new Error('لا يوجد استلامات لهذا الشخص');

    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

    for (let index = 0; index < reportPages.length; index += 1) {
      const element = pageRefs.current[index];
      if (!element) throw new Error('قالب PDF غير جاهز');
      const images = Array.from(element.querySelectorAll('img'));
      await Promise.all(images.map(async (img) => {
        if (img.complete) return;
        await new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        });
      }));
      const canvas = await html2canvas(element, {
        scale: 3,
        width: 794,
        height: 1123,
        windowWidth: 794,
        windowHeight: 1123,
        backgroundColor: '#f7f3ea',
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
      });
      if (index > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297, undefined, 'FAST');
    }
    return pdf;
  }

  function fileName(person: NRPerson) {
    const safe = person.name.replace(/[\\/:*?"<>|]/g, '_');
    return `BAKR-PRO-استلامات-${safe}-${nrToday()}.pdf`;
  }

  function pdfBase64(pdf: jsPDF) {
    return pdf.output('datauristring').split(',')[1];
  }

  async function exportPdf(share: boolean, whatsapp = false) {
    if (!active || !active.entries.length) {
      alert('سجّل عملية استلام واحدة على الأقل أولاً');
      return;
    }
    setWorking(true);
    try {
      const pdf = await createNamedPdf();
      const name = fileName(active);
      const text = `كشف استلامات ${active.name} - BAKR PRO\nعدد العمليات: ${active.entries.length}\nإجمالي الاستلام: ${nrMoney(activeTotal)} ريال`;

      if (Capacitor.isNativePlatform()) {
        const result = await Filesystem.writeFile({
          path: name,
          data: pdfBase64(pdf),
          directory: share ? Directory.Cache : Directory.Documents,
          recursive: true,
        });
        if (share) {
          await Share.share({
            title: `استلامات ${active.name}`,
            text,
            files: [result.uri],
            dialogTitle: whatsapp ? 'اختر واتساب لإرسال PDF' : 'مشاركة ملف PDF',
          });
        } else {
          inform('تم حفظ PDF في مستندات التطبيق');
        }
      } else {
        const file = new File([pdf.output('blob')], name, {type: 'application/pdf'});
        if (share && typeof navigator.share === 'function' &&
          (!navigator.canShare || navigator.canShare({files:[file]}))) {
          await navigator.share({title: `استلامات ${active.name}`, text, files:[file]});
        } else {
          pdf.save(name);
          if (share && whatsapp) {
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
          }
          inform(share ? 'تم تنزيل PDF ويمكنك إرساله' : 'تم تنزيل ملف PDF');
        }
      }
    } catch (error: any) {
      console.error('Named receipts PDF error:', error);
      if (error?.name !== 'AbortError') {
        alert('تعذر تجهيز PDF: ' + (error?.message || 'حاول مرة أخرى'));
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <AppLayout showBottomNav={false}>
      <main dir="rtl" className="w-full max-w-[760px] mx-auto pb-24">
        <button type="button" onClick={() => { if (activeId) {setActiveId(null); clearForm();} else onBack(); }} className="mb-3 text-amber-300 bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 rounded-xl text-[11px] font-bold">← {activeId ? 'جميع الأسماء' : 'العودة للخيارات'}</button>
        <header className="rounded-[25px] px-5 py-6 mb-4" style={{background:'linear-gradient(130deg,#091f35,#153a5c)', border:'1px solid #be9849'}}>
          <div className="text-amber-300 font-black text-[12px]" dir="ltr">BAKR PRO</div>
          <h1 className="font-black text-white text-[22px] mt-2">سجل الاستلامات بالأسماء</h1>
          <p className="text-slate-300 text-[11px] mt-2">كل شخص له حساب واستلاماته وإجماليه الخاص</p>
        </header>
        {feedback && <p className="text-emerald-300 rounded-xl p-3 mb-3 bg-emerald-500/10 text-[11px] font-bold">✓ {feedback}</p>}

        {!active ? (
          <>
            <section className="rounded-[22px] p-4 mb-5" style={{background:'#0e2138',border:'1px solid rgba(244,203,104,.25)'}}>
              <h2 className="font-black text-white text-[15px] mb-3">إضافة اسم جديد</h2>
              <div className="flex gap-2">
                <input value={newName} onChange={(e)=>setNewName(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter')addPerson();}} placeholder="مثلاً: ياسر" className="bg-slate-950/60 border border-white/10 text-white rounded-xl px-3 h-12 flex-1 min-w-0 outline-none text-[13px]" />
                <button type="button" onClick={addPerson} className="px-4 rounded-xl bg-amber-400 text-slate-950 font-black text-[12px] flex items-center gap-2"><Plus className="w-4 h-4"/> إضافة اسم</button>
              </div>
            </section>
            <section>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-white font-black text-[16px]">الأسماء المحفوظة ({people.length})</h2>
                <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="بحث باسم شخص..." className="w-40 h-10 rounded-xl px-3 text-white bg-slate-900 border border-white/10 text-[11px] outline-none"/>
              </div>
              {matching.length === 0 && <p className="text-slate-400 rounded-2xl p-5 text-[12px] bg-slate-900/60">{people.length ? 'لا توجد أسماء مطابقة للبحث.' : 'لا يوجد أسماء بعد، أضف أول اسم من الأعلى.'}</p>}
              <div className="space-y-2.5">
                {matching.map(person => (
                  <div key={person.id} className="flex gap-2 p-3.5 rounded-[18px]" style={{background:'#0d2035',border:'1px solid rgba(255,255,255,.09)'}}>
                    <button type="button" onClick={()=>{setActiveId(person.id);clearForm();}} className="flex-1 text-right min-w-0">
                      <p className="text-white text-[15px] font-black truncate">{person.name}</p>
                      <p className="text-slate-400 text-[10px] mt-1.5">{person.entries.length} استلام • الإجمالي <span dir="ltr" className="text-emerald-300 font-black">{nrMoney(nrTotal(person))} ر.س</span></p>
                    </button>
                    <button type="button" title="حذف الاسم" onClick={()=>deletePerson(person.id)} className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-rose-400/10 border border-rose-400/20"><Trash2 className="w-4 h-4 text-rose-300"/></button>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="rounded-[23px] p-5 mb-4" style={{background:'linear-gradient(135deg,#0d304b,#071a2d)',border:'1px solid rgba(239,197,91,.38)'}}>
              <p className="text-slate-300 text-[11px]">حساب الاستلامات باسم</p>
              <h2 className="text-white font-black text-[24px] mt-1">{active.name}</h2>
              <div className="mt-4 flex items-end justify-between gap-4">
                <div><p className="text-slate-300 text-[11px]">إجمالي ما استلمه</p><p className="text-amber-300 text-[26px] font-black mt-1" dir="ltr">{nrMoney(activeTotal)} <span className="text-[12px]">ر.س</span></p></div>
                <p className="text-emerald-300 font-black text-[11px]">{active.entries.length} عملية استلام</p>
              </div>
            </section>
            <section className="rounded-[22px] p-4 mb-4" style={{background:'#0d2137',border:'1px solid rgba(255,255,255,.09)'}}>
              <div className="flex justify-between items-center mb-3"><h3 className="text-white font-black text-[16px]">{editId ? 'تعديل استلام' : 'إضافة عملية استلام'}</h3>{editId && <button type="button" onClick={clearForm} className="text-blue-300 text-[11px]">إلغاء التعديل</button>}</div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-slate-300 text-[10px]">المبلغ المستلم (ريال)</span><input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="10000" className="mt-1.5 w-full h-12 bg-slate-950/60 text-white border border-amber-500/25 rounded-xl px-3 outline-none text-[12px]" /></label>
                <label className="block"><span className="text-slate-300 text-[10px]">استلم من</span><input value={receivedFrom} onChange={e=>setReceivedFrom(e.target.value)} placeholder="أبو بكر / فلان" className="mt-1.5 w-full h-12 bg-slate-950/60 text-white border border-white/10 rounded-xl px-3 outline-none text-[12px]" /></label>
                <label className="block"><span className="text-slate-300 text-[10px]">التاريخ</span><input type="date" value={receivedDate} onChange={e=>setReceivedDate(e.target.value)} className="mt-1.5 w-full h-12 bg-slate-950/60 text-white border border-white/10 rounded-xl px-3 outline-none text-[12px]" /></label>
                <label className="block"><span className="text-slate-300 text-[10px]">ملاحظات</span><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="اختياري" className="mt-1.5 w-full h-12 bg-slate-950/60 text-white border border-white/10 rounded-xl px-3 outline-none text-[12px]" /></label>
              </div>
              <button type="button" onClick={saveEntry} className="w-full mt-4 h-12 rounded-xl bg-amber-400 text-slate-950 font-black text-[13px] flex justify-center items-center gap-2"><Save className="w-4 h-4"/>{editId?'حفظ التعديل':'حفظ الاستلام وإضافته للإجمالي'}</button>
            </section>
            <section className="rounded-[22px] p-4 mb-4" style={{background:'#0d2137',border:'1px solid rgba(255,255,255,.09)'}}>
              <h3 className="text-white font-black text-[16px] mb-3">سجل استلامات {active.name}</h3>
              {!active.entries.length && <p className="text-slate-400 text-[11px]">لم تُسجّل استلامات لهذا الشخص بعد.</p>}
              <div className="space-y-2.5">
                {active.entries.map((entry, index)=>(
                  <div key={entry.id} className="rounded-[16px] p-3 bg-slate-950/50 border border-white/5 flex items-center gap-2">
                    <div className="min-w-0 flex-1"><p className="text-amber-300 font-black text-[15px]" dir="ltr">{nrMoney(nrAmount(entry.amount))} ر.س</p><p className="text-white text-[11px] mt-1">استلم من: <b>{entry.receivedFrom}</b></p><p className="text-slate-400 text-[10px] mt-1">{index+1} • {entry.date}{entry.notes?' • '+entry.notes:''}</p></div>
                    <button type="button" onClick={()=>beginEdit(entry)} aria-label="تعديل استلام" className="w-9 h-9 rounded-xl bg-blue-400/10 flex items-center justify-center"><Pencil className="w-4 h-4 text-blue-300"/></button>
                    <button type="button" onClick={()=>deleteEntry(entry.id)} aria-label="حذف استلام" className="w-9 h-9 rounded-xl bg-rose-400/10 flex items-center justify-center"><Trash2 className="w-4 h-4 text-rose-300"/></button>
                  </div>
                ))}
              </div>
            </section>
            <section className="grid grid-cols-2 gap-3">
              <button type="button" disabled={working || !active.entries.length} onClick={()=>exportPdf(false)} className="h-12 rounded-xl bg-amber-400 text-slate-950 font-black text-[12px] disabled:opacity-40 flex items-center justify-center gap-2"><FileDown className="w-4 h-4"/>{working?'جاري التجهيز...':'حفظ PDF'}</button>
              <button type="button" disabled={working || !active.entries.length} onClick={()=>exportPdf(true)} className="h-12 rounded-xl bg-blue-500/15 text-blue-200 font-black text-[12px] disabled:opacity-40 flex items-center justify-center gap-2"><Share2 className="w-4 h-4"/>مشاركة PDF</button>
              <button type="button" disabled={working || !active.entries.length} onClick={()=>exportPdf(true,true)} className="col-span-2 h-12 rounded-xl bg-emerald-500/15 border border-emerald-400/25 text-emerald-300 font-black text-[12px] disabled:opacity-40 flex items-center justify-center gap-2"><MessageCircle className="w-4 h-4"/>إرسال PDF عبر واتساب</button>
            </section>
          </>
        )}

        {/* صفحات PDF الكاملة: كافة الاستلامات، دون حذف أو اقتطاع أي عملية */}
        {active && active.entries.length > 0 && (
          <div aria-hidden="true" style={{position:'fixed', top:0, left:0, transform:'translateX(-240vw)', pointerEvents:'none', zIndex:1}}>
            {reportPages.map((entries, pageIndex)=>(
              <div key={`${active.id}-${pageIndex}`} ref={(element)=>{pageRefs.current[pageIndex]=element;}} dir="rtl" style={{width:794,height:1123,boxSizing:'border-box',padding:22,fontFamily:'Tahoma, Arial, sans-serif',background:'#f7f3ea',color:'#0a2442',overflow:'hidden'}}>
                <div style={{height:'100%',border:'2px solid #c5a252',borderRadius:22,background:'#fffefa',overflow:'hidden',display:'flex',flexDirection:'column',boxSizing:'border-box'}}>
                  <div style={{background:'linear-gradient(125deg,#071b31,#153d5f)',color:'white',padding:'23px 27px',borderBottom:'4px solid #c5a252',height:137,boxSizing:'border-box',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div><div style={{fontSize:18,fontWeight:900,color:'#edc969',letterSpacing:3,direction:'ltr'}}>BAKR PRO</div><div style={{fontSize:29,fontWeight:900,marginTop:9}}>سجل الاستلامات بالأسماء</div><div style={{fontSize:12,color:'#c8d6e5',marginTop:7}}>كشف استلامات مستقل باسم الشخص</div></div>
                    <div style={{textAlign:'center',border:'1px solid #a98642',borderRadius:14,padding:12}}><div style={{fontSize:11}}>التاريخ</div><div style={{fontSize:15,fontWeight:900,marginTop:6,direction:'ltr'}}>{nrToday()}</div></div>
                  </div>
                  <div style={{padding:'23px 25px 12px',flex:1,boxSizing:'border-box',display:'flex',flexDirection:'column'}}>
                    <div style={{border:'1px solid #e2d4b8',borderRadius:15,background:'#faf6eb',padding:17,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div><div style={{fontSize:11,color:'#6f6b62'}}>اسم المستلم</div><div style={{fontSize:26,fontWeight:900,marginTop:6}}>{active.name}</div></div>
                      <div style={{textAlign:'left'}}><div style={{fontSize:10,color:'#706b63'}}>عدد الاستلامات الكلي</div><div style={{fontSize:24,fontWeight:900,marginTop:6}}>{active.entries.length}</div></div>
                    </div>
                    <div style={{background:'#e5bc61',padding:'12px 15px',fontSize:17,fontWeight:900,marginTop:20,borderRadius:'12px 12px 0 0'}}>تفاصيل الاستلامات</div>
                    <div style={{border:'1px solid #ddcaa5',borderTop:0,borderRadius:'0 0 12px 12px',overflow:'hidden'}}>
                      <div style={{display:'grid',gridTemplateColumns:'48px 160px 1.3fr 130px 1fr',background:'#0c2d4e',color:'#fff',height:44,alignItems:'center',fontSize:12,fontWeight:900,textAlign:'center'}}>
                        {['#','التاريخ','استلم من','المبلغ (ريال)','ملاحظات'].map(column=><div key={column} style={{padding:6}}>{column}</div>)}
                      </div>
                      {entries.map((entry, index)=>(
                        <div key={entry.id} style={{display:'grid',gridTemplateColumns:'48px 160px 1.3fr 130px 1fr',minHeight:56,alignItems:'center',borderTop:'1px solid #e7ddc9',background:index%2?'#f9f5ec':'#fffdfa',fontSize:11.5,textAlign:'center'}}>
                          <div>{pageIndex*NR_ROWS_PER_PAGE+index+1}</div><div style={{direction:'ltr',fontFamily:'Arial,sans-serif'}}>{entry.date}</div><div style={{fontWeight:800,padding:5}}>{entry.receivedFrom}</div><div style={{color:'#096641',fontWeight:900,fontSize:15,direction:'ltr',fontFamily:'Arial,sans-serif'}}>{nrMoney(nrAmount(entry.amount))}</div><div style={{padding:5}}>{entry.notes||'—'}</div>
                        </div>
                      ))}
                    </div>
                    {pageIndex === reportPages.length-1 && (
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginTop:23}}>
                        <div style={{background:'#0b2d4d',color:'#fff',border:'2px solid #c5a252',borderRadius:17,padding:16}}><div style={{fontSize:14,fontWeight:800}}>إجمالي ما استلمه {active.name}</div><div style={{fontSize:33,color:'#f1cf75',fontWeight:900,marginTop:8,direction:'ltr',fontFamily:'Arial,sans-serif'}}>{nrMoney(activeTotal)} <span style={{fontSize:14}}>ريال</span></div></div>
                        <div style={{background:'#f2f9f2',border:'1px solid #c1e3c9',borderRadius:17,padding:16}}><div style={{fontSize:13,fontWeight:800}}>عدد عمليات الاستلام</div><div style={{fontSize:32,color:'#20734a',fontWeight:900,marginTop:9}}>{active.entries.length}</div></div>
                      </div>
                    )}
                  </div>
                  <div style={{height:115,boxSizing:'border-box',padding:'15px 26px',background:'linear-gradient(120deg,#071b31,#123a5c)',color:'#fff',display:'flex',justifyContent:'space-between',alignItems:'center',borderTop:'4px solid #c5a252'}}>
                    <div><div style={{fontSize:15,fontWeight:900}}>BAKR PRO</div><div style={{fontSize:11,color:'#c8d9e5',marginTop:7}}>المملكة العربية السعودية</div><div style={{fontSize:11,color:'#c8d9e5',marginTop:4}}>صفحة {pageIndex+1} من {reportPages.length}</div></div>
                    <div style={{display:'flex',alignItems:'center',gap:13}}><div style={{textAlign:'left',fontSize:12}}><div>للتواصل عبر واتساب</div><div style={{fontSize:22,fontWeight:900,direction:'ltr',marginTop:7}}>0558995962</div></div><img src={NAMED_RECEIPTS_QR} alt="WhatsApp QR" style={{width:76,height:76,background:'#fff',padding:5,borderRadius:9,boxSizing:'border-box'}} /></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </AppLayout>
  );
    }
