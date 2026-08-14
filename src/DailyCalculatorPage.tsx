import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, Wallet, TrendingDown, Banknote, RotateCcw } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { formatSAR } from '@/lib/format';

export function DailyCalculatorPage(){
  const nav=useNavigate();
  const [work,setWork]=useState(''); const [paid,setPaid]=useState(''); const [expense,setExpense]=useState('');
  const v=useMemo(()=>{const w=Number(work)||0,p=Number(paid)||0,e=Number(expense)||0;return{remaining:Math.max(w-p,0),net:w-e,cash:p-e}},[work,paid,expense]);
  const field='w-full bg-ink-850/80 border border-white/10 rounded-2xl py-3.5 px-4 text-base text-white outline-none focus:border-gold-500/50';
  return <AppLayout showHeader={false} showBottomNav={false}><div className="pt-4"><PageHeader title="حساب اليوم السريع" subtitle="احسب قيمة العمل والمدفوع والمصروف فورًا" icon={Calculator} onBack={()=>nav('/')}/>
    <Card className="p-4 space-y-4">
      <div><label className="text-xs text-slate-400 mb-1.5 block">قيمة العمل</label><input className={field} inputMode="decimal" value={work} onChange={e=>setWork(e.target.value)} placeholder="0"/></div>
      <div className="grid grid-cols-2 gap-3"><div><label className="text-xs text-slate-400 mb-1.5 block">المدفوع</label><input className={field} inputMode="decimal" value={paid} onChange={e=>setPaid(e.target.value)} placeholder="0"/></div><div><label className="text-xs text-slate-400 mb-1.5 block">المصروف</label><input className={field} inputMode="decimal" value={expense} onChange={e=>setExpense(e.target.value)} placeholder="0"/></div></div>
    </Card>
    <div className="grid grid-cols-2 gap-3 mt-4"><Card className="p-4"><Banknote className="w-5 h-5 text-receivable mb-2"/><p className="text-xs text-slate-400">المتبقي</p><b className="text-lg text-receivable">{formatSAR(v.remaining)}</b></Card><Card className="p-4"><Wallet className="w-5 h-5 text-profit mb-2"/><p className="text-xs text-slate-400">صافي العمل</p><b className="text-lg text-profit">{formatSAR(v.net)}</b></Card><Card className="p-4 col-span-2"><TrendingDown className="w-5 h-5 text-gold-400 mb-2"/><div className="flex items-center justify-between"><div><p className="text-xs text-slate-400">النقد بعد المصروف</p><b className="text-xl text-gold-400">{formatSAR(v.cash)}</b></div><button onClick={()=>{setWork('');setPaid('');setExpense('')}} className="px-4 py-2.5 rounded-xl bg-white/5 text-slate-300 flex items-center gap-2 text-xs"><RotateCcw className="w-4 h-4"/> تصفير</button></div></Card></div>
  </div></AppLayout>
}
