import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowDownLeft, ArrowUpLeft, Save, X, Printer } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { fetchEquipment, type Equipment, type EquipmentType, typeLabels } from '@/lib/equipment';
import { fetchCustomers, createCustomer, type Customer } from '@/lib/customers';
import {
  createJob, createExpense, calcPaymentStatus, paymentStatusLabels,
  paymentMethods, expenseTypes, type JobInput, type ExpenseInput,
} from '@/lib/transactions';
import { fetchJobTypes, addJobType } from '@/lib/jobTypes';
import { fetchSettings } from '@/lib/settings';
import { generateExpenseReceiptHTML, openPrintWindow } from '@/lib/pdf';

type Mode = 'job' | 'expense' | null;

export function AddPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(null);

  // Shared
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobTypes, setJobTypes] = useState<string[]>([]);

  // Job fields
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [jobType, setJobType] = useState('مشوار');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [workAmount, setWorkAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('كاش');
  const [notes, setNotes] = useState('');
  const [newJobType, setNewJobType] = useState('');
  const [showNewJobType, setShowNewJobType] = useState(false);

  // Expense fields
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10));
  const [expEquipment, setExpEquipment] = useState('');
  const [expType, setExpType] = useState(expenseTypes[0]);
  const [expAmount, setExpAmount] = useState('');
  const [expNotes, setExpNotes] = useState('');
  const [customExpType, setCustomExpType] = useState('');
  const [showCustomExpType, setShowCustomExpType] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [eqList, custList, jtList] = await Promise.all([fetchEquipment(), fetchCustomers(), fetchJobTypes()]);
      setEquipment(eqList);
      setCustomers(custList);
      setJobTypes(jtList);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const remaining = (Number(workAmount) || 0) - (Number(paidAmount) || 0);
  const status = calcPaymentStatus(Number(workAmount) || 0, Number(paidAmount) || 0);

  function selectCustomer(name: string) {
    setCustomerName(name);
    const found = customers.find(c => c.name === name);
    if (found) setCustomerPhone(found.phone);
  }

  async function handleAddJobType() {
    if (!newJobType.trim()) return;
    try {
      await addJobType(newJobType.trim());
      setJobTypes([...jobTypes, newJobType.trim()]);
      setJobType(newJobType.trim());
      setNewJobType('');
      setShowNewJobType(false);
    } catch {
      setError('فشل إضافة نوع الشغل');
    }
  }

  async function handleSaveJob() {
    if (!customerName.trim()) { setError('الرجاء إدخال اسم العميل'); return; }
    if (!workAmount || Number(workAmount) <= 0) { setError('الرجاء إدخال قيمة الشغل'); return; }
    setSaving(true);
    setError('');
    try {
      let customerId: string | null = null;
      const existing = customers.find(c => c.name === customerName.trim());
      if (existing) {
        customerId = existing.id;
        if (customerPhone && customerPhone !== existing.phone) {
          // could update, but keep simple
        }
      } else {
        const newCust = await createCustomer(customerName.trim(), customerPhone, '');
        customerId = newCust.id;
        setCustomers([...customers, newCust]);
      }
      const eq = equipment.find(e => e.id === selectedEquipment);
      const input: JobInput = {
        date, customerId, customerName: customerName.trim(), customerPhone,
        equipmentId: selectedEquipment || null, equipmentName: eq?.name ?? '',
        jobType, location: location.trim(), description: description.trim(),
        workAmount: Number(workAmount), paidAmount: Number(paidAmount) || 0,
        paymentMethod, notes: notes.trim(),
      };
      await createJob(input);
      navigate('/transactions');
    } catch {
      setError('حدث خطأ أثناء الحفظ');
      setSaving(false);
    }
  }

  async function handleSaveExpense(printAfter = false) {
    if (!expAmount || Number(expAmount) <= 0) { setError('الرجاء إدخال المبلغ'); return; }
    setSaving(true);
    setError('');
    try {
      const eq = equipment.find(e => e.id === expEquipment);
      const input: ExpenseInput = {
        date: expDate, equipmentId: expEquipment || null, equipmentName: eq?.name ?? '',
        expenseType: (showCustomExpType && customExpType.trim()) ? customExpType.trim() : expType, amount: Number(expAmount), notes: expNotes.trim(),
      };
      const savedExpense = await createExpense(input);
      if (printAfter) {
        const settings = await fetchSettings();
        openPrintWindow(generateExpenseReceiptHTML(savedExpense, settings));
      }
      navigate('/transactions');
    } catch {
      setError('حدث خطأ أثناء الحفظ');
      setSaving(false);
    }
  }

  return (
    <AppLayout showHeader={false} showBottomNav={false}>
      <div className="pt-4">
        <PageHeader title="إضافة حركة جديدة" icon={Plus} onBack={() => navigate('/')} />

        {/* Mode selection */}
        {!mode && (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <button onClick={() => setMode('job')} className="active:scale-95 transition-transform">
              <Card className="p-6 flex flex-col items-center gap-3 ring-1 ring-income/20">
                <div className="w-14 h-14 rounded-2xl bg-income/10 flex items-center justify-center">
                  <ArrowDownLeft className="w-7 h-7 text-income" strokeWidth={2} />
                </div>
                <span className="font-semibold text-sm text-slate-100">دخل / عمل</span>
              </Card>
            </button>
            <button onClick={() => setMode('expense')} className="active:scale-95 transition-transform">
              <Card className="p-6 flex flex-col items-center gap-3 ring-1 ring-expense/20">
                <div className="w-14 h-14 rounded-2xl bg-expense/10 flex items-center justify-center">
                  <ArrowUpLeft className="w-7 h-7 text-expense" strokeWidth={2} />
                </div>
                <span className="font-semibold text-sm text-slate-100">مصروف</span>
              </Card>
            </button>
          </div>
        )}

        {/* Job form */}
        {mode === 'job' && (
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-xl bg-income/10 flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5 text-income" strokeWidth={2} />
              </div>
              <h3 className="text-base font-bold text-white font-display">إضافة دخل / عمل</h3>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">التاريخ</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-gold-500/40 transition-colors" />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">اسم العميل</label>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                list="customer-list" placeholder="اسم العميل"
                className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/40 transition-colors" />
              <datalist id="customer-list">
                {customers.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">رقم الجوال</label>
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} inputMode="tel"
                placeholder="05xxxxxxxx"
                className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/40 transition-colors" />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">المعدة</label>
              <select value={selectedEquipment} onChange={(e) => setSelectedEquipment(e.target.value)}
                className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-gold-500/40 transition-colors">
                <option value="">— اختر المعدة —</option>
                {equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">نوع الشغل</label>
              <div className="flex gap-2 flex-wrap">
                {jobTypes.map(jt => (
                  <button key={jt} onClick={() => setJobType(jt)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${jobType === jt ? 'bg-gold-500/15 text-gold-300 border border-gold-500/30' : 'bg-white/5 text-slate-400 border border-white/5'}`}>
                    {jt}
                  </button>
                ))}
                <button onClick={() => setShowNewJobType(!showNewJobType)}
                  className="px-3 py-2 rounded-xl text-xs font-medium bg-white/5 text-gold-400 border border-white/5">
                  + نوع جديد
                </button>
              </div>
              {showNewJobType && (
                <div className="flex gap-2 mt-2">
                  <input value={newJobType} onChange={(e) => setNewJobType(e.target.value)} placeholder="نوع شغل جديد"
                    className="flex-1 bg-ink-850/80 border border-white/10 rounded-xl py-2 px-3 text-sm text-slate-100 focus:outline-none focus:border-gold-500/40" />
                  <button onClick={handleAddJobType} className="px-4 py-2 rounded-xl bg-gold-500/15 text-gold-300 text-sm font-medium">إضافة</button>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">الموقع</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="موقع العمل"
                className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/40 transition-colors" />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">وصف العمل (اختياري)</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف مختصر"
                className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/40 transition-colors" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">قيمة الشغل</label>
                <input value={workAmount} onChange={(e) => setWorkAmount(e.target.value)} inputMode="decimal" placeholder="0"
                  className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/40 transition-colors" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">المبلغ المدفوع</label>
                <input value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} inputMode="decimal" placeholder="0"
                  className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/40 transition-colors" />
              </div>
            </div>

            {/* Auto-calculated */}
            <Card className="p-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">المتبقي</span>
              <span className="text-sm font-bold text-receivable tabular-nums">{remaining.toLocaleString('en-US')} ر.س</span>
            </Card>
            <Card className="p-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">حالة الدفع</span>
              <span className={`text-sm font-medium ${status === 'paid' ? 'text-income' : status === 'partial' ? 'text-gold-400' : 'text-expense'}`}>{paymentStatusLabels[status]}</span>
            </Card>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">طريقة الدفع</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-gold-500/40 transition-colors">
                {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">ملاحظات (اختياري)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="ملاحظات..."
                className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/40 transition-colors resize-none" />
            </div>

            {error && <p className="text-sm text-expense text-center">{error}</p>}

            <button onClick={handleSaveJob} disabled={saving}
              className="w-full py-3.5 rounded-xl bg-gradient-to-br from-income to-income/80 text-white font-bold text-sm shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50">
              <Save className="w-5 h-5" strokeWidth={2.5} />
              {saving ? 'جاري الحفظ...' : 'حفظ العمل'}
            </button>
          </div>
        )}

        {/* Expense form */}
        {mode === 'expense' && (
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-xl bg-expense/10 flex items-center justify-center">
                <ArrowUpLeft className="w-5 h-5 text-expense" strokeWidth={2} />
              </div>
              <h3 className="text-base font-bold text-white font-display">إضافة مصروف</h3>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">التاريخ</label>
              <input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)}
                className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-gold-500/40 transition-colors" />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">المعدة</label>
              <select value={expEquipment} onChange={(e) => setExpEquipment(e.target.value)}
                className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-gold-500/40 transition-colors">
                <option value="">— اختر المعدة —</option>
                {equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">نوع المصروف</label>
              <div className="flex gap-2 flex-wrap">
                {expenseTypes.map(et => (
                  <button key={et} onClick={() => setExpType(et)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${expType === et ? 'bg-expense/15 text-expense border border-expense/30' : 'bg-white/5 text-slate-400 border border-white/5'}`}>
                    {et}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-400">نوع المصروف</label>
                <button type="button" onClick={() => setShowCustomExpType(!showCustomExpType)} className="text-xs text-gold-400 font-bold flex items-center gap-1"><Plus className="w-3.5 h-3.5"/> إضافة نوع جديد</button>
              </div>
              {showCustomExpType && <input value={customExpType} onChange={(e)=>setCustomExpType(e.target.value)} placeholder="مثال: بطارية، ونش، كهربائي..." className="w-full mb-3 bg-ink-850/80 border border-gold-500/30 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none" />}

              <label className="text-xs font-medium text-slate-400 mb-1.5 block">المبلغ</label>
              <input value={expAmount} onChange={(e) => setExpAmount(e.target.value)} inputMode="decimal" placeholder="0"
                className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/40 transition-colors" />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">ملاحظات (اختياري)</label>
              <textarea value={expNotes} onChange={(e) => setExpNotes(e.target.value)} rows={2} placeholder="ملاحظات..."
                className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/40 transition-colors resize-none" />
            </div>

            {error && <p className="text-sm text-expense text-center">{error}</p>}

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleSaveExpense(false)} disabled={saving}
                className="py-3.5 rounded-xl bg-gradient-to-br from-expense to-expense/80 text-white font-bold text-sm shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50">
                <Save className="w-5 h-5" strokeWidth={2.5} />
                {saving ? 'جاري الحفظ...' : 'حفظ المصروف'}
              </button>
              <button onClick={() => handleSaveExpense(true)} disabled={saving}
                className="py-3.5 rounded-xl bg-white/5 border border-gold-500/20 text-gold-300 font-bold text-sm active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50">
                <Printer className="w-5 h-5" />
                حفظ وطباعة PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
