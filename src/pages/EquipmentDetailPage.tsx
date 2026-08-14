import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  CalendarClock,
  TrendingUp,
  TrendingDown,
  Wallet,
  Wrench,
  Hash,
  FileText,
  Pencil,
  Trash2,
  AlertTriangle,
  Receipt,
  ArrowDownLeft,
  ArrowUpLeft,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/dashboard/StatCard';
import {
  type Equipment,
  statusLabels,
  statusStyles,
  typeLabels,
  fetchEquipmentById,
  deleteEquipment,
} from '@/lib/equipment';
import { fetchEquipmentStats, type EquipmentStats } from '@/lib/transactions';
import { formatSAR } from '@/lib/format';

export function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [stats, setStats] = useState<EquipmentStats>({ totalJobValue: 0, totalPaid: 0, totalRemaining: 0, totalExpenses: 0, netProfit: 0, jobsCount: 0 });
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const [eq, st] = await Promise.all([fetchEquipmentById(id), fetchEquipmentStats(id)]);
        setEquipment(eq);
        setStats(st);
      } catch {
        setEquipment(null);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteEquipment(id);
      navigate('/equipment');
    } catch {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <AppLayout showHeader={false} showBottomNav={false}>
        <div className="pt-4">
          <PageHeader title="المعدات" icon={Truck} onBack={() => navigate('/equipment')} />
          <Card className="p-8 text-center"><p className="text-sm text-slate-400">جاري التحميل...</p></Card>
        </div>
      </AppLayout>
    );
  }

  if (!equipment) {
    return (
      <AppLayout showHeader={false} showBottomNav={false}>
        <div className="pt-4">
          <PageHeader title="المعدات" icon={Truck} onBack={() => navigate('/equipment')} />
          <Card className="p-8 flex flex-col items-center text-center">
            <p className="text-sm text-slate-400">لم يتم العثور على هذه المعدة</p>
            <button onClick={() => navigate('/equipment')} className="mt-4 px-5 py-2.5 rounded-xl bg-gold-500/15 text-gold-300 font-semibold text-sm active:scale-95 transition-transform">العودة للمعدات</button>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const styles = statusStyles[equipment.status];

  const actionButtons = [
    { label: 'إضافة عمل', icon: ArrowDownLeft, onClick: () => navigate('/add'), tone: 'bg-income/10 text-income border-income/20' },
    { label: 'إضافة مصروف', icon: ArrowUpLeft, onClick: () => navigate('/add'), tone: 'bg-expense/10 text-expense border-expense/20' },
    { label: 'الحساب الشهري', icon: CalendarClock, onClick: () => navigate(`/monthly/${equipment.id}`), tone: 'bg-receivable/10 text-receivable border-receivable/20' },
    { label: 'عرض الحركات', icon: Receipt, onClick: () => navigate('/transactions'), tone: 'bg-white/5 text-slate-200 border-white/10' },
    { label: 'كشف PDF', icon: FileText, onClick: () => navigate(`/monthly/${equipment.id}`), tone: 'bg-gold-500/10 text-gold-400 border-gold-500/20' },
    { label: 'تعديل المعدة', icon: Pencil, onClick: () => navigate(`/equipment/${equipment.id}/edit`), tone: 'bg-white/5 text-slate-200 border-white/10' },
  ];

  return (
    <AppLayout showHeader={false} showBottomNav={false}>
      <div className="pt-4">
        <PageHeader
          title={equipment.name}
          icon={Truck}
          onBack={() => navigate('/equipment')}
          action={
            <button onClick={() => navigate('/add')} className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-glow-gold active:scale-95 transition-transform flex-shrink-0">
              <Plus className="w-5 h-5 text-ink-950" strokeWidth={2.5} />
            </button>
          }
        />

        {/* Hero image */}
        <Card className="overflow-hidden mb-4 animate-scale-in">
          <div className="relative h-40">
            {equipment.image ? (
              <img src={equipment.image} alt={equipment.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-ink-900/60 flex items-center justify-center">
                <Truck className="w-12 h-12 text-slate-600" strokeWidth={1.5} />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-ink-850 via-ink-850/30 to-transparent" />
            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-ink-950/70 backdrop-blur-sm">
              <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
              <span className={`text-xs font-medium ${styles.text}`}>{statusLabels[equipment.status]}</span>
            </div>
            <div className="absolute bottom-3 right-3 left-3">
              <h3 className="text-lg font-bold text-white font-display">{equipment.name}</h3>
            </div>
          </div>
        </Card>

        {/* Action buttons grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {actionButtons.map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.label}
                onClick={btn.onClick}
                className={`py-3 rounded-xl border text-xs font-medium active:scale-95 transition-transform flex flex-col items-center gap-1.5 ${btn.tone}`}
              >
                <Icon className="w-5 h-5" strokeWidth={2} />
                {btn.label}
              </button>
            );
          })}
        </div>

        {/* Financial stats */}
        <section className="grid grid-cols-3 gap-2.5 mb-4">
          <StatCard label="قيمة الأعمال" amount={formatSAR(stats.totalJobValue)} icon={TrendingUp} tone="income" delay={0} />
          <StatCard label="المصروفات" amount={formatSAR(stats.totalExpenses)} icon={TrendingDown} tone="expense" delay={60} />
          <StatCard label="صافي الربح" amount={formatSAR(stats.netProfit)} icon={Wallet} tone="profit" delay={120} />
        </section>

        {/* Additional stats */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <Card className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-receivable/10 flex items-center justify-center flex-shrink-0">
              <Receipt className="w-4 h-4 text-receivable" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[11px] text-slate-500">المستحقات</p>
              <p className="text-sm font-bold text-receivable tabular-nums">{formatSAR(stats.totalRemaining)}</p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
              <Hash className="w-4 h-4 text-slate-400" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[11px] text-slate-500">عدد الأعمال</p>
              <p className="text-sm font-bold text-slate-200 tabular-nums">{stats.jobsCount}</p>
            </div>
          </Card>
        </div>

        {/* Info rows */}
        <Card className="divide-y divide-white/5 mb-4">
          {[
            { icon: Hash, label: 'رقم اللوحة', value: equipment.plateNumber || '—' },
            { icon: Wrench, label: 'الحمولة', value: equipment.capacity ? `${equipment.capacity} طن` : '—' },
            { icon: Truck, label: 'النوع', value: typeLabels[equipment.type] },
          ].map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.label} className="flex items-center gap-3 p-3.5">
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-slate-400" strokeWidth={2} />
                </div>
                <span className="text-sm text-slate-400 flex-1">{row.label}</span>
                <span className="text-sm font-semibold text-slate-100 tabular-nums">{row.value}</span>
              </div>
            );
          })}
        </Card>

        {/* Notes */}
        {equipment.notes && (
          <Card className="p-4 mb-4">
            <p className="text-xs text-slate-500 mb-1.5">ملاحظات</p>
            <p className="text-sm text-slate-200 leading-relaxed">{equipment.notes}</p>
          </Card>
        )}

        {/* Delete button */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full py-2.5 rounded-xl bg-expense/10 border border-expense/20 text-expense font-medium text-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" strokeWidth={2} />
          حذف المعدة
        </button>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink-950/80 backdrop-blur-sm animate-fade-in">
          <Card className="p-6 max-w-sm w-full">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-expense/10 flex items-center justify-center mb-4">
                <AlertTriangle className="w-7 h-7 text-expense" strokeWidth={2} />
              </div>
              <h3 className="text-base font-bold text-white font-display mb-2">تأكيد الحذف</h3>
              <p className="text-sm text-slate-400 mb-6">
                هل أنت متأكد من حذف "{equipment.name}"؟ سيتم حذف المعدة ولكن ستبقى الحركات المالية محفوظة.
              </p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-200 font-medium text-sm active:scale-95 transition-transform">إلغاء</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-expense text-white font-medium text-sm active:scale-95 transition-transform disabled:opacity-50">
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
