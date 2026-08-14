import { CalendarClock, ChevronLeft, TrendingUp, TrendingDown, Wallet, Truck, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/dashboard/StatCard';
import { type Equipment, fetchEquipment } from '@/lib/equipment';
import { fetchMonthlyDays, calcMonthlySummary, arabicMonths, type MonthlySummary } from '@/lib/monthly';
import { formatSAR } from '@/lib/format';

type Row={eq:Equipment;summary:MonthlySummary};
export function MonthlyPage() {
  const navigate = useNavigate();
  const now=new Date(); const [year,setYear]=useState(now.getFullYear()); const [month,setMonth]=useState(now.getMonth()+1);
  const [rows,setRows]=useState<Row[]>([]); const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{setLoading(true);try{const eqs=await fetchEquipment();const out=await Promise.all(eqs.map(async eq=>({eq,summary:calcMonthlySummary(await fetchMonthlyDays(eq.id,year,month))})));setRows(out)}catch{setRows([])}setLoading(false)},[year,month]);
  useEffect(()=>{load()},[load]);
  const totalIncome=rows.reduce((s,r)=>s+r.summary.totalWorkAmount,0), totalExpenses=rows.reduce((s,r)=>s+r.summary.totalExpenses,0), totalProfit=totalIncome-totalExpenses;
  return <AppLayout showHeader={false} showBottomNav={false}><div className="pt-4"><PageHeader title="الحساب الشهري" subtitle="حساب مستقل لكل معدة من يوم 1 إلى 31" icon={CalendarClock} onBack={()=>navigate('/')}/>
    <Card className="p-3 mb-4"><div className="grid grid-cols-2 gap-2"><select value={month} onChange={e=>setMonth(Number(e.target.value))} className="bg-ink-850 border border-white/10 rounded-xl p-3 text-sm text-white">{arabicMonths.map((m,i)=><option value={i+1} key={m}>{m}</option>)}</select><select value={year} onChange={e=>setYear(Number(e.target.value))} className="bg-ink-850 border border-white/10 rounded-xl p-3 text-sm text-white">{[year-2,year-1,year,year+1,year+2].map(y=><option key={y}>{y}</option>)}</select></div></Card>
    <section className="grid grid-cols-3 gap-2.5 mb-5"><StatCard label="قيمة الأعمال" amount={formatSAR(totalIncome)} icon={TrendingUp} tone="income" delay={0}/><StatCard label="المصروفات" amount={formatSAR(totalExpenses)} icon={TrendingDown} tone="expense" delay={50}/><StatCard label="الصافي" amount={formatSAR(totalProfit)} icon={Wallet} tone="profit" delay={100}/></section>
    <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-bold text-white">المعدات — {arabicMonths[month-1]} {year}</h3><span className="text-[11px] text-slate-500">اضغط على المعدة لفتح الأيام</span></div>
    {loading?<Card className="p-8 text-center text-slate-400">جاري حساب الشهر...</Card>:rows.length===0?<Card className="p-8 text-center text-slate-400">لا توجد معدات بعد</Card>:<div className="space-y-3">{rows.map(({eq,summary})=><Card key={eq.id} onClick={()=>navigate(`/monthly/${eq.id}?year=${year}&month=${month}`)} className="p-4 active:scale-[.99] transition-transform"><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-2xl bg-gold-500/10 flex items-center justify-center overflow-hidden">{eq.image?<img src={eq.image} className="w-full h-full object-cover"/>:<Truck className="w-6 h-6 text-gold-400"/>}</div><div className="flex-1 min-w-0"><b className="text-sm text-white block truncate">{eq.name}</b><div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500"><span className="flex gap-1 items-center"><CalendarDays className="w-3 h-3"/>{summary.workDays} يوم عمل</span><span>{summary.totalDays} يوم مسجل</span></div></div><div className="text-left"><b className="text-sm text-profit block">{formatSAR(summary.netMonth)}</b><span className="text-[10px] text-slate-500">صافي الشهر</span></div><ChevronLeft className="w-5 h-5 text-slate-600"/></div></Card>)}</div>}
  </div></AppLayout>
}
