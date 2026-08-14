import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Phone, MessageCircle, FileText, Search, UserPlus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { fetchAllCustomersWithTotals, createCustomer, type CustomerWithTotals } from '@/lib/customers';
import { formatSAR } from '@/lib/format';

export function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerWithTotals[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const list = await fetchAllCustomersWithTotals();
      setCustomers(list);
    } catch {
      setCustomers([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = customers.filter(c =>
    c.name.includes(query) || c.phone.includes(query)
  );

  async function handleAdd() {
    if (!newName.trim()) { setError('الرجاء إدخال اسم العميل'); return; }
    setSaving(true);
    setError('');
    try {
      await createCustomer(newName.trim(), newPhone.trim(), '');
      setNewName('');
      setNewPhone('');
      setShowAdd(false);
      await load();
    } catch {
      setError('حدث خطأ أثناء الحفظ');
    }
    setSaving(false);
  }

  return (
    <AppLayout showHeader={false} showBottomNav={false}>
      <div className="pt-4">
        <PageHeader title="العملاء" subtitle="إدارة حسابات العملاء" icon={Users} onBack={() => navigate('/')}
          action={
            <button onClick={() => setShowAdd(true)}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-glow-gold active:scale-95 transition-transform flex-shrink-0">
              <Plus className="w-5 h-5 text-ink-950" strokeWidth={2.5} />
            </button>
          }
        />

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن عميل..."
            className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-2.5 pr-10 pl-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/40 transition-colors" />
        </div>

        <p className="text-xs text-slate-500 mb-3">{loading ? 'جاري التحميل...' : `${filtered.length} عميل`}</p>

        {loading ? (
          <Card className="p-8 text-center"><p className="text-sm text-slate-400">جاري التحميل...</p></Card>
        ) : filtered.length === 0 ? (
          <Card className="p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-slate-600" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-slate-400 mb-4">لا يوجد عملاء بعد</p>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-ink-950 font-semibold text-sm shadow-glow-gold active:scale-95 transition-transform">
              <UserPlus className="w-4 h-4" strokeWidth={2.5} /> إضافة عميل
            </button>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((c, i) => (
              <Card key={c.id} onClick={() => navigate(`/customers/${c.id}`)} className="p-4 animate-slide-up">
                <div className="flex items-start gap-3" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="w-11 h-11 rounded-xl bg-gold-500/10 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-gold-400" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-100 truncate">{c.name}</p>
                      {c.totalRemaining > 0 && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-receivable/10 text-receivable flex-shrink-0">
                          مستحق
                        </span>
                      )}
                    </div>
                    {c.phone && <p className="text-xs text-slate-500 mt-0.5">{c.phone}</p>}
                    <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                      <div className="rounded-lg bg-income/5 py-1.5">
                        <p className="text-[10px] text-slate-500">قيمة الأعمال</p>
                        <p className="text-xs font-bold text-income tabular-nums">{formatSAR(c.totalJobValue)}</p>
                      </div>
                      <div className="rounded-lg bg-white/5 py-1.5">
                        <p className="text-[10px] text-slate-500">المدفوع</p>
                        <p className="text-xs font-bold text-slate-200 tabular-nums">{formatSAR(c.totalPaid)}</p>
                      </div>
                      <div className="rounded-lg bg-receivable/5 py-1.5">
                        <p className="text-[10px] text-slate-500">المتبقي</p>
                        <p className="text-xs font-bold text-receivable tabular-nums">{formatSAR(c.totalRemaining)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                      <span>{c.jobsCount} عمل</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add customer modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink-950/80 backdrop-blur-sm animate-fade-in">
          <Card className="p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-white font-display mb-4">إضافة عميل جديد</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">اسم العميل</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="اسم العميل"
                  className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/40 transition-colors" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">رقم الجوال</label>
                <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} inputMode="tel" placeholder="05xxxxxxxx"
                  className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/40 transition-colors" />
              </div>
              {error && <p className="text-sm text-expense text-center">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setShowAdd(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-200 font-medium text-sm active:scale-95 transition-transform">إلغاء</button>
                <button onClick={handleAdd} disabled={saving}
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
