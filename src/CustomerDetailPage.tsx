import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, Phone, MessageCircle, FileText, Wallet, TrendingUp, TrendingDown, Plus, Pencil, Receipt, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/dashboard/StatCard';
import {
  fetchCustomerWithTotals, updateCustomer, type CustomerWithTotals,
} from '@/lib/customers';
import { fetchJobsByCustomer, fetchPaymentsByCustomer, recordPayment, type Job, type Payment, paymentStatusLabels, paymentStatusStyles, paymentMethods } from '@/lib/transactions';
import { formatSAR } from '@/lib/format';

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<CustomerWithTotals | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('كاش');
  const [payNotes, setPayNotes] = useState('');
  const [payJobId, setPayJobId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [cust, jobList, payList] = await Promise.all([
        fetchCustomerWithTotals(id), fetchJobsByCustomer(id), fetchPaymentsByCustomer(id),
      ]);
      setCustomer(cust);
      setJobs(jobList);
      setPayments(payList);
      if (cust) { setEditName(cust.name); setEditPhone(cust.phone); }
    } catch {
      setCustomer(null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handlePayment() {
    if (!payAmount || Number(payAmount) <= 0) { setError('الرجاء إدخال المبلغ'); return; }
    if (!payJobId) { setError('الرجاء اختيار عمل'); return; }
    setSaving(true);
    setError('');
    try {
      await recordPayment(payJobId, id!, Number(payAmount), payMethod, new Date().toISOString().slice(0, 10), payNotes);
      setShowPayment(false);
      setPayAmount(''); setPayNotes(''); setPayJobId('');
      await load();
    } catch {
      setError('حدث خطأ أثناء تسجيل الدفعة');
    }
    setSaving(false);
  }

  async function handleEdit() {
    if (!editName.trim() || !id) return;
    setSaving(true);
    try {
      await updateCustomer(id, editName.trim(), editPhone.trim(), customer?.notes ?? '');
      setShowEdit(false);
      await load();
    } catch {
      setError('حدث خطأ');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <AppLayout showHeader={false} showBottomNav={false}>
        <div className="pt-4">
          <PageHeader title="العميل" icon={Users} onBack={() => navigate('/customers')} />
          <Card className="p-8 text-center"><p className="text-sm text-slate-400">جاري التحميل...</p></Card>
        </div>
      </AppLayout>
    );
  }

  if (!customer) {
    return (
      <AppLayout showHeader={false} showBottomNav={false}>
        <div className="pt-4">
          <PageHeader title="العميل" icon={Users} onBack={() => navigate('/customers')} />
          <Card className="p-8 text-center">
            <p className="text-sm text-slate-400 mb-4">لم يتم العثور على العميل</p>
            <button onClick={() => navigate('/customers')} className="px-5 py-2.5 rounded-xl bg-gold-500/15 text-gold-300 font-semibold text-sm active:scale-95 transition-transform">العودة</button>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const whatsappLink = customer.phone ? `https://wa.me/966${customer.phone.replace(/^0/, '')}` : '';

  return (
    <AppLayout showHeader={false} showBottomNav={false}>
      <div className="pt-4">
        <PageHeader title={customer.name} icon={Users} onBack={() => navigate('/customers')}
          action={
            <button onClick={() => navigate('/add')}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-glow-gold active:scale-95 transition-transform flex-shrink-0">
              <Plus className="w-5 h-5 text-ink-950" strokeWidth={2.5} />
            </button>
          }
        />

        {/* Customer info */}
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gold-500/10 flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6 text-gold-400" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white font-display">{customer.name}</p>
              {customer.phone && <p className="text-xs text-slate-400 mt-0.5">{customer.phone}</p>}
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            {customer.phone && (
              <a href={`tel:${customer.phone}`} className="flex-1 py-2 rounded-xl bg-income/10 text-income text-xs font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
                <Phone className="w-3.5 h-3.5" /> اتصال
              </a>
            )}
            {whatsappLink && (
              <a href={whatsappLink} target="_blank" rel="noreferrer" className="flex-1 py-2 rounded-xl bg-income/10 text-income text-xs font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
                <MessageCircle className="w-3.5 h-3.5" /> واتساب
              </a>
            )}
            <button onClick={() => setShowEdit(true)} className="flex-1 py-2 rounded-xl bg-white/5 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
              <Pencil className="w-3.5 h-3.5" /> تعديل
            </button>
          </div>
        </Card>

        {/* Financial summary */}
        <section className="grid grid-cols-3 gap-2.5 mb-4">
          <StatCard label="قيمة الأعمال" amount={formatSAR(customer.totalJobValue)} icon={TrendingUp} tone="income" delay={0} />
          <StatCard label="المدفوع" amount={formatSAR(customer.totalPaid)} icon={Wallet} tone="profit" delay={60} />
          <StatCard label="المتبقي" amount={formatSAR(customer.totalRemaining)} icon={TrendingDown} tone="receivable" delay={120} />
        </section>

        {/* Payment button */}
        {customer.totalRemaining > 0 && (
          <button onClick={() => setShowPayment(true)} className="w-full mb-4 active:scale-[0.98] transition-transform">
            <Card className="p-4 flex items-center gap-3 ring-1 ring-receivable/20">
              <div className="w-11 h-11 rounded-xl bg-receivable/10 flex items-center justify-center flex-shrink-0">
                <Wallet className="w-6 h-6 text-receivable" strokeWidth={2} />
              </div>
              <div className="flex-1 text-right">
                <p className="text-sm font-semibold text-slate-100">تسجيل دفعة</p>
                <p className="text-xs text-slate-500">المتبقي: {formatSAR(customer.totalRemaining)}</p>
              </div>
              <span className="text-slate-500 text-lg">‹</span>
            </Card>
          </button>
        )}

        {/* Jobs list */}
        <h3 className="text-sm font-bold text-white font-display mb-3">أعمال العميل ({jobs.length})</h3>
        {jobs.length === 0 ? (
          <Card className="p-6 flex flex-col items-center text-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
              <Receipt className="w-7 h-7 text-slate-600" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-slate-400">لا توجد أعمال لهذا العميل بعد</p>
          </Card>
        ) : (
          <div className="space-y-2.5 mb-4">
            {jobs.map((j, i) => {
              const styles = paymentStatusStyles[j.paymentStatus];
              return (
                <Card key={j.id} className="p-3.5 animate-slide-up">
                  <div className="flex items-center justify-between" style={{ animationDelay: `${i * 40}ms` }}>
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{j.jobType}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{j.date} • {j.equipmentName || '—'}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-income tabular-nums">{formatSAR(j.workAmount)}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${styles.bg} ${styles.text}`}>
                        {paymentStatusLabels[j.paymentStatus]}
                      </span>
                    </div>
                  </div>
                  {j.remainingAmount > 0 && (
                    <p className="text-[11px] text-receivable mt-1.5">متبقي: {formatSAR(j.remainingAmount)}</p>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Payment history */}
        {payments.length > 0 && (
          <>
            <h3 className="text-sm font-bold text-white font-display mb-3">سجل المدفوعات ({payments.length})</h3>
            <div className="space-y-2.5">
              {payments.map((p, i) => (
                <Card key={p.id} className="p-3.5 animate-slide-up">
                  <div className="flex items-center justify-between" style={{ animationDelay: `${i * 40}ms` }}>
                    <div>
                      <p className="text-sm font-semibold text-income tabular-nums">+{formatSAR(p.amount)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{p.date} • {p.paymentMethod}</p>
                    </div>
                    {p.notes && <span className="text-xs text-slate-400">{p.notes}</span>}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Payment modal */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink-950/80 backdrop-blur-sm animate-fade-in">
          <Card className="p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-white font-display mb-4">تسجيل دفعة</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">اختر العمل</label>
                <select value={payJobId} onChange={(e) => setPayJobId(e.target.value)}
                  className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-gold-500/40">
                  <option value="">— اختر —</option>
                  {jobs.filter(j => j.remainingAmount > 0).map(j => (
                    <option key={j.id} value={j.id}>{j.jobType} - {formatSAR(j.remainingAmount)} متبقي</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">المبلغ</label>
                <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} inputMode="decimal" placeholder="0"
                  className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/40" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">طريقة الدفع</label>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-gold-500/40">
                  {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">ملاحظات (اختياري)</label>
                <input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="ملاحظات"
                  className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/40" />
              </div>
              {error && <p className="text-sm text-expense text-center">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setShowPayment(false)} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-200 font-medium text-sm active:scale-95 transition-transform">إلغاء</button>
                <button onClick={handlePayment} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-br from-receivable to-receivable/80 text-white font-bold text-sm active:scale-95 transition-transform disabled:opacity-50">
                  {saving ? 'جاري...' : 'تسجيل'}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Edit modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink-950/80 backdrop-blur-sm animate-fade-in">
          <Card className="p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-white font-display mb-4">تعديل العميل</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">اسم العميل</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-gold-500/40" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">رقم الجوال</label>
                <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} inputMode="tel"
                  className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-gold-500/40" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowEdit(false)} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-200 font-medium text-sm active:scale-95 transition-transform">إلغاء</button>
                <button onClick={handleEdit} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-ink-950 font-bold text-sm active:scale-95 transition-transform disabled:opacity-50">
                  {saving ? 'جاري...' : 'حفظ'}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
