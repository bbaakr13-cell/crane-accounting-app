import { Truck, Plus, Search } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { EquipmentCard } from '@/components/equipment/EquipmentCard';
import { type Equipment, statusLabels, fetchEquipment } from '@/lib/equipment';

export function EquipmentPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'maintenance' | 'idle'>('all');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const list = await fetchEquipment();
      setEquipment(list);
    } catch {
      setEquipment([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = equipment.filter((e) => {
    const matchesQuery =
      e.name.includes(query) || e.plateNumber.includes(query);
    const matchesFilter = filter === 'all' || e.status === filter;
    return matchesQuery && matchesFilter;
  });

  const filterChips: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'active', label: statusLabels.active },
    { key: 'maintenance', label: statusLabels.maintenance },
    { key: 'idle', label: statusLabels.idle },
  ];

  return (
    <AppLayout showHeader={false} showBottomNav={false}>
      <div className="pt-4">
        <PageHeader
          title="المعدات"
          subtitle="إدارة الكرينات والمعدات"
          icon={Truck}
          onBack={() => navigate('/')}
          action={
            <button
              onClick={() => navigate('/equipment/add')}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-glow-gold active:scale-95 transition-transform flex-shrink-0"
              aria-label="إضافة معدة"
            >
              <Plus className="w-5 h-5 text-ink-950" strokeWidth={2.5} />
            </button>
          }
        />

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن معدة..."
            className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-2.5 pr-10 pl-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/40 transition-colors"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
          {filterChips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setFilter(chip.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filter === chip.key
                  ? 'bg-gold-500/15 text-gold-300 border border-gold-500/30'
                  : 'bg-white/5 text-slate-400 border border-white/5'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Summary count */}
        <p className="text-xs text-slate-500 mb-3">
          {loading ? 'جاري التحميل...' : `${filtered.length} معدة`}
        </p>

        {/* Cards */}
        {loading ? (
          <div className="rounded-2xl bg-ink-850/80 border border-white/5 p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <Truck className="w-8 h-8 text-slate-600 animate-pulse" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-slate-400">جاري تحميل المعدات...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-ink-850/80 border border-white/5 p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <Truck className="w-8 h-8 text-slate-600" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-slate-400 mb-4">لا توجد معدات مطابقة</p>
            <button
              onClick={() => navigate('/equipment/add')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-ink-950 font-semibold text-sm shadow-glow-gold active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              إضافة معدة
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((eq, i) => (
              <EquipmentCard
                key={eq.id}
                equipment={eq}
                onClick={() => navigate(`/equipment/${eq.id}`)}
                onMonthlyClick={() => navigate(`/monthly/${eq.id}`)}
                delay={i * 60}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
