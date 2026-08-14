import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, Plus, Search, ArrowDownLeft, ArrowUpLeft, Pencil, Trash2, AlertTriangle, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import {
  fetchAllTransactions, deleteJob, deleteExpense,
  paymentStatusLabels, paymentStatusStyles,
  type Transaction, type Job, type Expense,
} from '@/lib/transactions';
import { fetchEquipment, type Equipment } from '@/lib/equipment';
import { formatSAR } from '@/lib/format';

type FilterType = 'all' | 'job' | 'expense';
type FilterStatus = 'all' | 'paid' | 'partial' | 'credit' | 'unpaid';

export function TransactionsPage() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterEquipment, setFilterEquipment] = useState('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterMonth, setFilterMonth] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [txs, eqList] = await Promise.all([fetchAllTransactions(), fetchEquipment()]);
      setTransactions(txs);
      setEquipment(eqList);
    } catch {
      setTransactions([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = transactions.filter(tx => {
    if (filterType !== 'all' && tx.kind !== filterType) return false;
    if (filterStatus !== 'all') {
      if (tx.kind !== 'job') return false;
      if ((tx.data as Job).paymentStatus !== filterStatus) return false;
    }
    if (filterEquipment !== 'all') {
      const eqId = tx.kind === 'job' ? (tx.data as Job).equipmentId : (tx.data as Expense).equipmentId;
      if (eqId !== filterEquipment) return false;
    }
    if (filterMonth) {
      if (!tx.data.date.startsWith(filterMonth)) return false;
    }
    if (query) {
      const q = query.toLowerCase();
      if (tx.kind === 'job') {
        const j = tx.data as Job;
        return j.customerName.includes(query) || j.customerPhone.includes(query) || j.location.includes(query) || j.jobType.includes(query) || j.equipmentName.includes(query);
      } else {
        const e = tx.data as Expense;
        return e.expenseType.includes(query) || e.equipmentName.includes(query) || e.notes.includes(query);
      }
    }
    return true;
  });

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === 'job') await deleteJob(deleteTarget.data.id);
      else await deleteExpense(deleteTarget.data.id);
      setDeleteTarget(null);
      await load();
    } catch {
      // ignore
    }
    setDeleting(false);
  }

  const filterChips: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'job', label: 'دخل / عمل' },
    { key: 'expense', label: 'مصروف' },
  ];

  const statusChips: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'كل الحالات' },
    { key: 'paid', label: paymentStatusLabels.paid },
    { key: 'partial', label: paymentStatusLabels.partial },
    { key: 'unpaid', label: paymentStatusLabels.unpaid },
  ];

  return (
    <AppLayout showHeader={false} showBottomNav={false}>
      <div className="pt-4">
        <PageHeader title="الحركات" subtitle="جميع المعاملات" icon={Receipt} onBack={() => navigate('/')}
          action={
            <button onClick={() => navigate('/add')}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-glow-gold active:scale-95 transition-transform flex-shrink-0">
              <Plus className="w-5 h-5 text-ink-950" strokeWidth={2.5} />
            </button>
          }
        />

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالعميل، الجوال، المعدة، الموقع..."
            className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-2.5 pr-10 pl-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/40 transition-colors" />
        </div>

        {/* Type filter */}
        <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar">
          {filterChips.map(chip => (
            <button key={chip.key} onClick={() => setFilterType(chip.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterType === chip.key ? 'bg-gold-500/15 text-gold-300 border border-gold-500/30' : 'bg-white/5 text-slate-400 border border-white/5'}`}>
              {chip.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar">
          {statusChips.map(chip => (
            <button key={chip.key} onClick={() => setFilterStatus(chip.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterStatus === chip.key ? 'bg-receivable/10 text-receivable border border-receivable/30' : 'bg-white/5 text-slate-400 border border-white/5'}`}>
              {chip.label}
            </button>
          ))}
        </div>

        {/* Equipment + Month filters */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <select value={filterEquipment} onChange={(e) => setFilterEquipment(e.target.value)}
            className="bg-ink-850/80 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-gold-500/40">
            <option value="all">كل المعدات</option>
            {equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
          </select>
          <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
            className="bg-ink-850/80 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-gold-500/40" />
        </div>

        <p className="text-xs text-slate-500 mb-3">{loading ? 'جاري التحميل...' : `${filtered.length} حركة`}</p>

        {/* Transactions list */}
        {loading ? (
          <Card className="p-8 text-center"><p className="text-sm text-slate-400">جاري التحميل...</p></Card>
        ) : filtered.length === 0 ? (
          <Card className="p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <Receipt className="w-8 h-8 text-slate-600" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-slate-400 mb-4">لا توجد حركات مطابقة</p>
            <button onClick={() => navigate('/add')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-ink-950 font-semibold text-sm shadow-glow-gold active:scale-95 transition-transform">
              <Plus className="w-4 h-4" strokeWidth={2.5} /> إضافة حركة
            </button>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((tx, i) => {
              if (tx.kind === 'job') {
                const j = tx.data as Job;
                const styles = paymentStatusStyles[j.paymentStatus];
                return (
                  <Card key={j.id} className="p-4 animate-slide-up" >
                    <div className="flex items-start gap-3" style={{ animationDelay: `${i * 40}ms` }}>
                      <div className="w-10 h-10 rounded-xl bg-income/10 flex items-center justify-center flex-shrink-0">
                        <ArrowDownLeft className="w-5 h-5 text-income" strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-100 truncate">{j.customerName}</p>
                          <span className="text-xs text-slate-500 flex-shrink-0">{j.date}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                          {j.equipmentName && <span className="truncate">{j.equipmentName}</span>}
                          {j.equipmentName && j.jobType && <span className="text-slate-600">•</span>}
                          <span>{j.jobType}</span>
                          {j.location && <><span className="text-slate-600">•</span><span className="truncate">{j.location}</span></>}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-bold text-income tabular-nums">{formatSAR(j.workAmount)}</span>
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${styles.bg} ${styles.text}`}>
                            {paymentStatusLabels[j.paymentStatus]}
                          </span>
                        </div>
                        {j.remainingAmount > 0 && (
                          <p className="text-[11px] text-receivable mt-1">متبقي: {formatSAR(j.remainingAmount)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                      <button onClick={() => navigate(`/transactions/${j.id}/edit`)}
                        className="flex-1 py-1.5 rounded-lg bg-white/5 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
                        <Pencil className="w-3.5 h-3.5" /> تعديل
                      </button>
                      <button onClick={() => setDeleteTarget(tx)}
                        className="flex-1 py-1.5 rounded-lg bg-expense/10 text-expense text-xs font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
                        <Trash2 className="w-3.5 h-3.5" /> حذف
                      </button>
                    </div>
                  </Card>
                );
              } else {
                const e = tx.data as Expense;
                return (
                  <Card key={e.id} className="p-4 animate-slide-up">
                    <div className="flex items-start gap-3" style={{ animationDelay: `${i * 40}ms` }}>
                      <div className="w-10 h-10 rounded-xl bg-expense/10 flex items-center justify-center flex-shrink-0">
                        <ArrowUpLeft className="w-5 h-5 text-expense" strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-100 truncate">{e.expenseType}</p>
                          <span className="text-xs text-slate-500 flex-shrink-0">{e.date}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                          {e.equipmentName && <span className="truncate">{e.equipmentName}</span>}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-bold text-expense tabular-nums">−{formatSAR(e.amount)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                      <button onClick={() => setDeleteTarget(tx)}
                        className="flex-1 py-1.5 rounded-lg bg-expense/10 text-expense text-xs font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
                        <Trash2 className="w-3.5 h-3.5" /> حذف
                      </button>
                    </div>
                  </Card>
                );
              }
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink-950/80 backdrop-blur-sm animate-fade-in">
          <Card className="p-6 max-w-sm w-full">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-expense/10 flex items-center justify-center mb-4">
                <AlertTriangle className="w-7 h-7 text-expense" strokeWidth={2} />
              </div>
              <h3 className="text-base font-bold text-white font-display mb-2">تأكيد الحذف</h3>
              <p className="text-sm text-slate-400 mb-6">
                هل أنت متأكد من حذف هذه الحركة؟ لا يمكن التراجع عن هذا الإجراء.
              </p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-200 font-medium text-sm active:scale-95 transition-transform">إلغاء</button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl bg-expense text-white font-medium text-sm active:scale-95 transition-transform disabled:opacity-50">
                  {deleting ? 'جاري الحذف...' : 'حذف'}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
