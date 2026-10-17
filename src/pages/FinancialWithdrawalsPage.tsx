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

  async function createPdfBlob() {
    if (!pdfRef.current) throw new Error('PDF template not ready');

    const canvas = await html2canvas(pdfRef.current, {
      scale: 2,
      backgroundColor: '#f8f3e8',
      useCORS: true,
      logging: false,
      windowWidth: 794,
    });

    const image = canvas.toDataURL('image/jpeg', 0.96);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const imageHeight = (canvas.height * pageWidth) / canvas.width;

    let heightLeft = imageHeight;
    let position = 0;

    pdf.addImage(image, 'JPEG', 0, position, pageWidth, imageHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imageHeight;
      pdf.addPage();
      pdf.addImage(image, 'JPEG', 0, position, pageWidth, imageHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    return pdf.output('blob');
  }

  function pdfName() {
    const cleanName = (accountName || 'حساب').replace(/[\\/:*?"<>|]/g, '-');
    return `BAKR-PRO-سجل-السحوبات-${cleanName}-${createdDate}.pdf`;
  }

  async function savePdf() {
    if (!saveRecord(false)) return;

    setBusy(true);

    try {
      const blob = await createPdfBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = pdfName();
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      flash('تم تجهيز ملف PDF');
    } catch (error) {
      console.error(error);
      alert('تعذر إنشاء PDF. حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  async function sharePdf(preferWhatsApp = false) {
    if (!saveRecord(false)) return;

    setBusy(true);

    try {
      const blob = await createPdfBlob();
      const file = new File([blob], pdfName(), { type: 'application/pdf' });

      const text =
        `سجل السحوبات المالية - BAKR PRO\n` +
        `${accountName ? `الحساب: ${accountName}\n` : ''}` +
        `المبلغ الأساسي: ${formatMoney(base)} ريال\n` +
        `إجمالي المسحوب: ${formatMoney(totalWithdrawn)} ريال\n` +
        `المتبقي: ${formatMoney(remaining)} ريال`;

      const canShareFiles =
        typeof navigator.share === 'function' &&
        (!navigator.canShare || navigator.canShare({ files: [file] }));

      if (canShareFiles) {
        await navigator.share({
          title: 'سجل السحوبات المالية - BAKR PRO',
          text,
          files: [file],
        });

        flash(
          preferWhatsApp
            ? 'اختر واتساب من قائمة المشاركة'
            : 'تم فتح المشاركة'
        );
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = pdfName();
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);

      if (preferWhatsApp) {
        window.open(
          `https://wa.me/?text=${encodeURIComponent(text)}`,
          '_blank'
        );
      } else {
        flash('تم تنزيل PDF للمشاركة');
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error(error);
        alert('تعذر فتح المشاركة.');
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

        <div
          style={{
            position: 'fixed',
            left: '-10000px',
            top: 0,
            width: 794,
            zIndex: -1,
          }}
        >
          <div
            ref={pdfRef}
            dir="rtl"
            style={{
              width: 794,
              minHeight: 1123,
              background: '#f8f3e8',
              color: '#102033',
              padding: 34,
              fontFamily: 'Arial, Tahoma, sans-serif',
            }}
          >
            <div
              style={{
                borderRadius: 24,
                overflow: 'hidden',
                border: '2px solid #c8a54a',
                background: '#fffdf8',
              }}
            >
              <div
                style={{
                  padding: '28px 30px 22px',
                  background:
                    'linear-gradient(135deg,#0b1e35,#132f52 64%,#0a1a2d)',
                  color: '#fff',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    insetInlineStart: -40,
                    top: -48,
                    width: 180,
                    height: 180,
                    borderRadius: '50%',
                    background: 'rgba(214,173,75,.12)',
                  }}
                />

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 18,
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: '#e8c866',
                        fontWeight: 900,
                        letterSpacing: 3,
                        fontSize: 16,
                      }}
                    >
                      BAKR PRO
                    </div>
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 900,
                        marginTop: 7,
                      }}
                    >
                      سجل السحوبات المالية
                    </div>
                    <div
                      style={{
                        color: '#dbe4ef',
                        fontSize: 12,
                        marginTop: 7,
                      }}
                    >
                      تنظيم • متابعة • وضوح مالي
                    </div>
                  </div>

                  <div
                    style={{
                      width: 78,
                      height: 78,
                      borderRadius: 22,
                      background: 'linear-gradient(145deg,#f7dd88,#b98625)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0d1d31',
                      fontSize: 35,
                      fontWeight: 900,
                    }}
                  >
                    B
                  </div>
                </div>
              </div>

              <div style={{ padding: 28 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr .8fr',
                    gap: 14,
                    marginBottom: 18,
                  }}
                >
                  <PdfInfo
                    label="اسم صاحب الحساب / الجهة"
                    value={accountName || '—'}
                  />
                  <PdfInfo label="التاريخ" value={createdDate || '—'} />
                </div>

                <div
                  style={{
                    borderRadius: 18,
                    padding: '18px 20px',
                    background: '#0f2948',
                    color: '#fff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 20,
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: 15 }}>
                    المبلغ الأساسي
                  </span>
                  <span
                    style={{
                      color: '#f3d77b',
                      fontWeight: 900,
                      fontSize: 26,
                    }}
                  >
                    {formatMoney(base)} ريال
                  </span>
                </div>

                <div
                  style={{
                    border: '1px solid #dfd5bb',
                    borderRadius: 18,
                    overflow: 'hidden',
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '52px 110px 1fr 105px 1fr',
                      background: '#102a49',
                      color: '#fff',
                      fontWeight: 900,
                      fontSize: 11,
                    }}
                  >
                    {['#', 'المبلغ', 'سبب السحب', 'التاريخ', 'الملاحظات'].map(
                      (text) => (
                        <div
                          key={text}
                          style={{
                            padding: '12px 9px',
                            borderLeft: '1px solid rgba(255,255,255,.10)',
                          }}
                        >
                          {text}
                        </div>
                      )
                    )}
                  </div>

                  {shownRows.map((row, index) => (
                    <div
                      key={row.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '52px 110px 1fr 105px 1fr',
                        background: index % 2 ? '#fbf8f0' : '#ffffff',
                        fontSize: 10.5,
                        minHeight: 45,
                        borderTop: '1px solid #eee5d2',
                      }}
                    >
                      <div style={{ padding: '12px 9px', fontWeight: 900 }}>
                        {index + 1}
                      </div>
                      <div
                        style={{
                          padding: '12px 9px',
                          fontWeight: 900,
                          color: '#b54a50',
                        }}
                      >
                        {row.amount
                          ? `${formatMoney(moneyNumber(row.amount))} ر.س`
                          : '—'}
                      </div>
                      <div style={{ padding: '12px 9px' }}>
                        {row.reason || '—'}
                      </div>
                      <div style={{ padding: '12px 9px' }}>
                        {row.date || '—'}
                      </div>
                      <div style={{ padding: '12px 9px' }}>
                        {row.notes || '—'}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 12,
                    marginBottom: 18,
                  }}
                >
                  <PdfSummary
                    label="المبلغ الأساسي"
                    value={`${formatMoney(base)} ر.س`}
                    accent="#315f9b"
                  />
                  <PdfSummary
                    label="إجمالي المسحوب"
                    value={`${formatMoney(totalWithdrawn)} ر.س`}
                    accent="#b04a51"
                  />
                  <PdfSummary
                    label="المتبقي"
                    value={`${formatMoney(remaining)} ر.س`}
                    accent={remaining >= 0 ? '#2e7d57' : '#b04a51'}
                  />
                </div>

                <div
                  style={{
                    borderRadius: 16,
                    border: '1px solid #e1d6bd',
                    background: '#fbf8ef',
                    padding: 16,
                    minHeight: 86,
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: 12,
                      marginBottom: 8,
                    }}
                  >
                    ملاحظات إضافية
                  </div>
                  <div
                    style={{
                      color: '#526173',
                      fontSize: 11,
                      lineHeight: 1.8,
                    }}
                  >
                    {extraNotes || 'لا توجد ملاحظات إضافية.'}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid #e3d8bf',
                    paddingTop: 18,
                    gap: 18,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <img
                      src="/icons/bakr-whatsapp-qr.png"
                      alt="WhatsApp QR"
                      style={{
                        width: 82,
                        height: 82,
                        borderRadius: 12,
                        border: '1px solid #d7c18a',
                        background: '#fff',
                        padding: 5,
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 13 }}>
                        للتواصل عبر واتساب
                      </div>
                      <div
                        style={{
                          color: '#1f6f4f',
                          fontWeight: 900,
                          fontSize: 17,
                          marginTop: 5,
                        }}
                      >
                        {PHONE}
                      </div>
                      <div
                        style={{
                          color: '#7a6c50',
                          fontSize: 10,
                          marginTop: 5,
                        }}
                      >
                        امسح الباركود للانتقال مباشرة إلى واتساب
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'left' }}>
                    <div
                      style={{
                        color: '#c49a35',
                        fontWeight: 900,
                        letterSpacing: 2,
                      }}
                    >
                      BAKR PRO
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: '#728094',
                        marginTop: 4,
                      }}
                    >
                      المملكة العربية السعودية
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: '#728094',
                        marginTop: 4,
                      }}
                    >
                      معك دائماً نحو إدارة مالية أفضل
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  height: 12,
                  background:
                    'linear-gradient(90deg,#0d2542,#c69b36,#0d2542)',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
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
