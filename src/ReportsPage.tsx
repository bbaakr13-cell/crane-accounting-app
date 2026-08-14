import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileBarChart, TrendingUp, TrendingDown, Wallet, Clock, Printer } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/dashboard/StatCard';
import { fetchJobs, fetchExpenses, type Job, type Expense } from '@/lib/transactions';
import { formatSAR } from '@/lib/format';

export function ReportsPage(){
 const nav=useNavigate(); const [jobs,setJobs]=useState<Job[]>([]); const [expenses,setExpenses]=useState<Expense[]>([]); const [loading,setLoading]=useState(true); const [period,setPeriod]=useState('all');
 useEffect(()=>{Promise.all([fetchJobs(),fetchExpenses()]).then(([j,e])=>{setJobs(j);setExpenses(e)}).finally(()=>setLoading(false))},[]);
 const now=new Date(); const match=(d:string)=>{if(period==='all')return true; const x=new Date(d+'T00:00:00'); if(period==='month')return x.getFullYear()===now.getFullYear()&&x.getMonth()===now.getMonth(); return x.getFullYear()===now.getFullYear()};
 const fj=jobs.filter(j=>match(j.date)), fe=expenses.filter(e=>match(e.date)); const income=fj.reduce((s,j)=>s+j.workAmount,0), paid=fj.reduce((s,j)=>s+j.paidAmount,0), due=fj.reduce((s,j)=>s+j.remainingAmount,0), exp=fe.reduce((s,e)=>s+e.amount,0);
 const equipment=Array.from(new Set([...fj.map(j=>j.equipmentName),...fe.map(e=>e.equipmentName)].filter(Boolean))).map(name=>({name,income:fj.filter(j=>j.equipmentName===name).reduce((s,j)=>s+j.workAmount,0),expenses:fe.filter(e=>e.equipmentName===name).reduce((s,e)=>s+e.amount,0)})).sort((a,b)=>(b.income-b.expenses)-(a.income-a.expenses));
 return <AppLayout showHeader={false}><div className="pt-4"><PageHeader title="التقارير" subtitle="ملخص مالي وتشغيلي" icon={FileBarChart} onBack={()=>nav('/')} action={<button onClick={()=>window.print()} className="p-2.5 rounded-xl bg-white/5"><Printer className="w-5 h-5 text-slate-300"/></button>}/>
 <div className="grid grid-cols-3 gap-2 mb-4">{[['all','الكل'],['year','هذه السنة'],['month','هذا الشهر']].map(([v,l])=><button key={v} onClick={()=>setPeriod(v)} className={`py-2 rounded-xl text-xs font-semibold ${period===v?'bg-gold-500 text-ink-950':'bg-white/5 text-slate-400'}`}>{l}</button>)}</div>
 {loading?<Card className="p-8 text-center text-slate-400">جاري التحميل...</Card>:<><div className="grid grid-cols-2 gap-2.5 mb-5"><StatCard label="إجمالي الأعمال" amount={formatSAR(income)} icon={TrendingUp} tone="income"/><StatCard label="المصروفات" amount={formatSAR(exp)} icon={TrendingDown} tone="expense"/><StatCard label="صافي الربح" amount={formatSAR(income-exp)} icon={Wallet} tone="profit"/><StatCard label="المستحقات" amount={formatSAR(due)} icon={Clock} tone="receivable"/></div>
 <Card className="p-4 mb-4"><div className="flex justify-between text-sm"><span className="text-slate-400">المحصل فعليًا</span><b className="text-income">{formatSAR(paid)}</b></div><div className="flex justify-between text-sm mt-3"><span className="text-slate-400">عدد الأعمال</span><b className="text-white">{fj.length}</b></div></Card>
 <h3 className="text-sm font-bold text-white mb-3">أداء المعدات</h3><div className="space-y-2">{equipment.map(x=><Card key={x.name} className="p-4"><div className="flex justify-between"><span className="text-sm text-white font-semibold">{x.name}</span><span className="text-sm font-bold text-profit">{formatSAR(x.income-x.expenses)}</span></div><div className="flex gap-4 mt-2 text-xs"><span className="text-income">دخل {formatSAR(x.income)}</span><span className="text-expense">مصروف {formatSAR(x.expenses)}</span></div></Card>)}</div></>}
 </div></AppLayout>
}
