import {
  Bot, Send, Sparkles, TrendingUp, Wallet, Receipt, BarChart3,
  Mic, MicOff, Volume2, VolumeX, Users, Wrench, FileText,
  AlertTriangle, ExternalLink, RefreshCw,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { formatSAR } from '@/lib/format';
import {
  fetchDashboardTotals,
  fetchAllTransactions,
  type DashboardTotals,
} from '@/lib/transactions';

const DRIVER_KEY = 'crane_drivers_v1';
const EXPENSE_KEY = 'crane_accounting_driver_equipment_expenses_v1';
const DOCUMENTS_KEY = 'crane_accounting_equipment_documents_v1';
const WORK_INVOICE_KEY = 'baakr-work-invoice-v3';
const AI_CHAT_KEY = 'baakr_ai_chat_v1';

type Driver = {
  id: number; name: string; phone: string; equipment: string;
  salary: number; workDays: number; absentDays: number;
  extraAmount: number; withdrawals: number;
};
type ExpenseRecord = {
  id: number; date: string; driverId: string; driverName: string;
  equipmentId: string; equipmentName: string; category: string;
  amount: number; location: string; notes: string;
  affectsDriverBalance: boolean; createdAt: string; updatedAt: string;
};
type StoredFile = { name: string; mime: string; dataUrl: string };
type DocumentInfo = {
  id: string; title: string; number: string; issueDate: string;
  expiryDate: string; notes: string; file?: StoredFile | null;
};
type DriverInfo = {
  name: string; phone: string; iqamaNumber: string; iqamaExpiry: string;
  licenseNumber: string; licenseExpiry: string; tuvNumber: string;
  tuvIssueDate: string; tuvExpiryDate: string;
  iqamaFile?: StoredFile | null; licenseFile?: StoredFile | null;
  tuvFile?: StoredFile | null;
};
type EquipmentFile = {
  id: string; name: string; brand: string; capacity: string; model: string;
  year: string; plateNumber: string; chassisNumber: string; serialNumber: string;
  image?: StoredFile | null; registration: DocumentInfo; craneTuv: DocumentInfo;
  insurance: DocumentInfo; driver: DriverInfo; extraDocuments: DocumentInfo[];
  notes: string;
};
type WorkInvoiceDraft = {
  customer?: string; invoiceNo?: string; date?: string; description?: string;
  qty?: string; unitPrice?: string; receivedBy?: string; salesman?: string;
};
type Action =
  | { label: string; route: string }
  | { label: string; kind: 'invoice'; draft: WorkInvoiceDraft };
type Message = { id: number; type: 'user' | 'ai'; text: string; action?: Action };
type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean;
  start: () => void; stop: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

function readArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function normalizeArabic(value: string) {
  return String(value || '').toLowerCase()
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/[ًٌٍَُِّْـ]/g, '').replace(/[^\u0600-\u06FFa-z0-9\s.-]/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}
function compact(v: string) { return normalizeArabic(v).replace(/\s+/g, ''); }
function containsLoose(h: string, n: string) {
  const a = compact(h), b = compact(n);
  return !!b && (a.includes(b) || b.includes(a));
}
function money(v: number) { return formatSAR(Number(v) || 0); }
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function daysUntil(value: string) {
  if (!value) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime()-now.getTime())/86400000);
}
function expiryText(value: string) {
  const d = daysUntil(value);
  if (d === null) return 'لا يوجد تاريخ انتهاء مسجل.';
  if (d < 0) return `منتهي منذ ${Math.abs(d)} يوم.`;
  if (d === 0) return 'ينتهي اليوم.';
  if (d <= 30) return `ينتهي قريباً، باقي ${d} يوم.`;
  return `ساري، باقي ${d} يوم.`;
}
function automaticWithdrawals(driver: Driver, expenses: ExpenseRecord[]) {
  return expenses.filter(r => {
    const id = String(r.driverId || '') === String(driver.id);
    const name = !r.driverId &&
      normalizeArabic(r.driverName || '') === normalizeArabic(driver.name || '');
    return (id || name) && (r.affectsDriverBalance === true || r.category === 'سلفة / سحب');
  }).reduce((s,r)=>s+(Number(r.amount)||0),0);
}
function arabicDigits(v:string) {
  const a='٠١٢٣٤٥٦٧٨٩';
  return v.replace(/[٠-٩]/g,d=>String(a.indexOf(d)));
}
function parseNumberNear(text:string, labels:string[]) {
  for (const label of labels) {
    const m=text.match(new RegExp(`${label}\\s*(?:هو|هي|بـ|ب|:)?\\s*([0-9٠-٩.,]+)`,'i'));
    if(m?.[1]) return arabicDigits(m[1]).replace(/,/g,'');
  }
  return '';
}
function parseWorkInvoice(text:string):WorkInvoiceDraft|null {
  const n=normalizeArabic(text);
  if(!(n.includes('فاتوره')&&(n.includes('عمل')||n.includes('سوي')||n.includes('جهز')||n.includes('اعمل')))) return null;
  const d:WorkInvoiceDraft={
    date:todayISO(),
    qty:parseNumberNear(n,['الكميه','كميه'])||'1',
    unitPrice:parseNumberNear(n,['السعر','سعر الوحده','المبلغ']),
    invoiceNo:parseNumberNear(n,['رقم الفاتوره','فاتوره رقم']),
  };
  const c=n.match(/(?:للعميل|العميل|للسيد|السيد|للشركه|الشركه)\s+(.+?)(?=\s+(?:العمل|البيان|الكميه|السعر|المبلغ|رقم الفاتوره|$))/);
  if(c?.[1]) d.customer=c[1].trim();
  const w=n.match(/(?:العمل|البيان)\s+(.+?)(?=\s+(?:الكميه|السعر|المبلغ|رقم الفاتوره|$))/);
  if(w?.[1]) d.description=w[1].trim();
  return d;
}
function mergeInvoice(draft:WorkInvoiceDraft) {
  let current:any=null;
  try { const raw=localStorage.getItem(WORK_INVOICE_KEY); current=raw?JSON.parse(raw):null; } catch {}
  const rows=Array.isArray(current?.rows)?[...current.rows]:[
    {description:'',qty:'1',unitPrice:''},{description:'',qty:'',unitPrice:''},
    {description:'',qty:'',unitPrice:''},{description:'',qty:'',unitPrice:''}
  ];
  while(rows.length<4) rows.push({description:'',qty:'',unitPrice:''});
  rows[0]={...rows[0],
    ...(draft.description!==undefined?{description:draft.description}:{}),
    ...(draft.qty!==undefined?{qty:draft.qty}:{}),
    ...(draft.unitPrice!==undefined?{unitPrice:draft.unitPrice}:{})
  };
  const next={...(current||{}),
    ...(draft.customer!==undefined?{customer:draft.customer}:{}),
    ...(draft.invoiceNo!==undefined?{invoiceNo:draft.invoiceNo}:{}),
    ...(draft.date!==undefined?{date:draft.date}:{}),
    ...(draft.receivedBy!==undefined?{receivedBy:draft.receivedBy}:{}),
    ...(draft.salesman!==undefined?{salesman:draft.salesman}:{}),rows};
  localStorage.setItem(WORK_INVOICE_KEY,JSON.stringify(next));
}

export function AIAssistantPage() {
  const navigate=useNavigate();
  const recognitionRef=useRef<SpeechRecognitionLike|null>(null);
  const [input,setInput]=useState('');
  const [listening,setListening]=useState(false);
  const [voiceEnabled,setVoiceEnabled]=useState(true);
  const [totals,setTotals]=useState<DashboardTotals>({totalIncome:0,totalExpenses:0,netProfit:0,receivables:0});
  const [transactionCount,setTransactionCount]=useState(0);
  const [drivers,setDrivers]=useState<Driver[]>([]);
  const [expenses,setExpenses]=useState<ExpenseRecord[]>([]);
  const [equipmentDocs,setEquipmentDocs]=useState<EquipmentFile[]>([]);
  const [messages,setMessages]=useState<Message[]>(()=>{
    try {
      const raw=localStorage.getItem(AI_CHAT_KEY), p=raw?JSON.parse(raw):null;
      if(Array.isArray(p)&&p.length)return p;
    } catch {}
    return [{id:1,type:'ai',text:'مرحباً بك 👋 أنا BAAKR AI.\nأقرأ الحسابات والسائقين ومستندات الكرينات والتنبيهات، وأجهز فاتورة العمل بعد تأكيدك.'}];
  });

  useEffect(()=>{loadData()},[]);
  useEffect(()=>{try{localStorage.setItem(AI_CHAT_KEY,JSON.stringify(messages.slice(-80)))}catch{}},[messages]);

  async function loadData(){
    try {
      const [t,tx]=await Promise.all([fetchDashboardTotals(),fetchAllTransactions()]);
      setTotals(t);setTransactionCount(tx.length);
    } catch(e){console.error('BAAKR AI load error:',e)}
    setDrivers(readArray<Driver>(DRIVER_KEY));
    setExpenses(readArray<ExpenseRecord>(EXPENSE_KEY));
    setEquipmentDocs(readArray<EquipmentFile>(DOCUMENTS_KEY));
  }

  const alerts=useMemo(()=>{
    const out:{equipment:string;title:string;days:number}[]=[];
    equipmentDocs.forEach(e=>{
      const docs=[
        ['رخصة سير الكرين',e.registration?.expiryDate],['TUV الكرين',e.craneTuv?.expiryDate],
        ['التأمين',e.insurance?.expiryDate],['إقامة السائق',e.driver?.iqamaExpiry],
        ['رخصة السائق',e.driver?.licenseExpiry],['TUV السائق',e.driver?.tuvExpiryDate]
      ];
      docs.forEach(([title,date])=>{
        const days=daysUntil(date||'');
        if(days!==null&&days<=30)out.push({equipment:e.name||e.brand||'معدة',title,days});
      });
    });
    return out.sort((a,b)=>a.days-b.days);
  },[equipmentDocs]);

  function findDriver(q:string){return drivers.find(d=>containsLoose(q,d.name));}
  function findEquipment(q:string){
    return equipmentDocs.find(e=>[e.name,e.brand,e.capacity,e.model,e.plateNumber,e.driver?.name]
      .filter(Boolean).some(v=>containsLoose(q,String(v))));
  }
  function driverText(d:Driver){
    const auto=automaticWithdrawals(d,expenses);
    const total=(Number(d.withdrawals)||0)+auto;
    const remaining=(Number(d.salary)||0)+(Number(d.extraAmount)||0)-total;
    return [`👷 حساب ${d.name}`,`المعدة: ${d.equipment||'-'}`,`الراتب: ${money(d.salary)}`,
      `أيام العمل: ${d.workDays||0}`,`أيام الغياب: ${d.absentDays||0}`,`الإضافي: ${money(d.extraAmount)}`,
      `السحوبات اليدوية: ${money(d.withdrawals)}`,`السلف/السحوبات التلقائية: ${money(auto)}`,
      `إجمالي السحوبات: ${money(total)}`,`المتبقي: ${money(remaining)}`].join('\n');
  }
  function equipmentText(e:EquipmentFile,q:string):{text:string;action:Action}{
    const n=normalizeArabic(q);
    if(n.includes('tuv')){
      const d=e.craneTuv;
      return {text:[`📄 TUV الكرين: ${e.name||e.brand||'المعدة'}`,`الرقم: ${d?.number||'-'}`,
        `تاريخ الإصدار: ${d?.issueDate||'-'}`,`تاريخ الانتهاء: ${d?.expiryDate||'-'}`,
        expiryText(d?.expiryDate||''),`الملف: ${d?.file?.name||'غير مرفوع'}`].join('\n'),
        action:{label:'فتح ملف الكرين',route:'/equipment-documents'}};
    }
    if(n.includes('تامين')){
      const d=e.insurance;
      return {text:[`🛡️ تأمين ${e.name||e.brand||'المعدة'}`,`الرقم: ${d?.number||'-'}`,
        `تاريخ الانتهاء: ${d?.expiryDate||'-'}`,expiryText(d?.expiryDate||''),
        `الملف: ${d?.file?.name||'غير مرفوع'}`].join('\n'),
        action:{label:'فتح ملف الكرين',route:'/equipment-documents'}};
    }
    return {text:[`🏗️ ${e.name||'ملف المعدة'}`,`الشركة: ${e.brand||'-'}`,`الحمولة: ${e.capacity||'-'}`,
      `الموديل: ${e.model||'-'}`,`رقم اللوحة: ${e.plateNumber||'-'}`,`السائق: ${e.driver?.name||'-'}`,
      `رخصة الكرين: ${expiryText(e.registration?.expiryDate||'')}`,
      `TUV الكرين: ${expiryText(e.craneTuv?.expiryDate||'')}`,
      `التأمين: ${expiryText(e.insurance?.expiryDate||'')}`].join('\n'),
      action:{label:'فتح المحفظة الرقمية',route:'/equipment-documents'}};
  }

  function answer(question:string):{text:string;action?:Action}{
    const text=normalizeArabic(question),draft=parseWorkInvoice(question);
    if(draft){
      const missing:string[]=[];
      if(!draft.customer)missing.push('اسم العميل');
      if(!draft.description)missing.push('بيان العمل');
      if(!draft.unitPrice)missing.push('السعر');
      if(missing.length)return{text:'أقدر أجهز فاتورة العمل، لكن ناقص: '+missing.join('، ')+'.\nقل البيانات الناقصة ثم أعد الطلب في رسالة واحدة.'};
      return{text:['🧾 مسودة فاتورة العمل جاهزة:',`العميل: ${draft.customer}`,`البيان: ${draft.description}`,
        `الكمية: ${draft.qty||'1'}`,`السعر: ${draft.unitPrice} ر.س`,'','اضغط التأكيد لتعبئة نفس فاتورة العمل الحالية وفتحها للمراجعة.'].join('\n'),
        action:{label:'تأكيد وفتح فاتورة العمل',kind:'invoice',draft}};
    }
    const d=findDriver(question);
    if(d&&(text.includes('سواق')||text.includes('سائق')||text.includes('حساب')||text.includes('راتب')||
      text.includes('متبقي')||text.includes('سحب')||text.includes('غياب')))
      return{text:driverText(d),action:{label:'فتح صفحة السائقين',route:'/drivers'}};

    const e=findEquipment(question);
    if(e&&(text.includes('مستند')||text.includes('اوراق')||text.includes('tuv')||text.includes('تامين')||
      text.includes('رخصه')||text.includes('كرين')||text.includes('معده'))) return equipmentText(e,question);

    if(text.includes('تنبيه')||text.includes('انتباهي')||text.includes('ينتهي')||text.includes('منتهي')){
      if(!alerts.length)return{text:'✅ لا توجد مستندات مسجلة منتهية أو ستنتهي خلال 30 يوماً.',
        action:{label:'فتح مركز المستندات',route:'/equipment-documents'}};
      const lines=alerts.slice(0,8).map(a=>a.days<0?`🔴 ${a.equipment} — ${a.title}: منتهي منذ ${Math.abs(a.days)} يوم`
        :a.days===0?`🔴 ${a.equipment} — ${a.title}: ينتهي اليوم`
        :`🟠 ${a.equipment} — ${a.title}: باقي ${a.days} يوم`);
      return{text:`⚠️ أهم تنبيهات المستندات:\n${lines.join('\n')}`,action:{label:'فتح مركز المستندات',route:'/equipment-documents'}};
    }
    if(text.includes('سواقين')||text.includes('السائقين'))
      return{text:drivers.length?`👷 السائقون المسجلون (${drivers.length}):\n${drivers.slice(0,12).map(d=>`• ${d.name} — ${d.equipment||'بدون معدة'}`).join('\n')}`:'لا يوجد سائقون مسجلون حالياً.',
        action:{label:'فتح السائقين',route:'/drivers'}};
    if(text.includes('دخل')||text.includes('ايراد'))return{text:`إجمالي الدخل المسجل هو ${money(totals.totalIncome)}.`,action:{label:'فتح الحركات',route:'/transactions'}};
    if(text.includes('مصروف'))return{text:`إجمالي المصروفات المسجلة هو ${money(totals.totalExpenses)}.`,action:{label:'فتح المصروفات',route:'/expenses'}};
    if(text.includes('ربح')||text.includes('صافي'))return{text:`صافي الربح الحالي هو ${money(totals.netProfit)}.`,action:{label:'فتح التقارير',route:'/reports'}};
    if(text.includes('مستحق')||text.includes('ديون'))return{text:`إجمالي المستحقات الحالية هو ${money(totals.receivables)}.`,action:{label:'فتح العملاء',route:'/customers'}};
    if(text.includes('حركه')||text.includes('حركات'))return{text:`عدد الحركات المالية المسجلة هو ${transactionCount} حركة.`,action:{label:'فتح الحركات',route:'/transactions'}};
    if(text.includes('ملخص')||text.includes('اليوم')||text.includes('وضع الحساب'))
      return{text:['📊 ملخص BAAKR PRO:',`الدخل: ${money(totals.totalIncome)}`,`المصروفات: ${money(totals.totalExpenses)}`,
        `صافي الربح: ${money(totals.netProfit)}`,`المستحقات: ${money(totals.receivables)}`,`الحركات: ${transactionCount}`,
        `السائقون: ${drivers.length}`,`ملفات المعدات: ${equipmentDocs.length}`,`تنبيهات المستندات: ${alerts.length}`].join('\n')};
    return{text:'أقدر أساعدك في الحسابات والسائقين ومستندات الكرينات والتنبيهات وفاتورة العمل.\nمثال: «كم حساب السائق محمد؟» أو «متى ينتهي TUV الساني؟» أو «سوّي فاتورة عمل للعميل محمد، العمل رفع حديد، الكمية 1، السعر 2500».'};
  }

  function speak(text:string){
    if(!voiceEnabled||!('speechSynthesis'in window))return;
    try{window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='ar-SA';u.rate=.95;window.speechSynthesis.speak(u)}catch{}
  }
  function sendMessage(customText?:string){
    const text=(customText??input).trim();if(!text)return;
    const a=answer(text),now=Date.now();
    setMessages(c=>[...c,{id:now,type:'user',text},{id:now+1,type:'ai',text:a.text,action:a.action}]);
    setInput('');speak(a.text);
  }
  function startVoice(){
    if(listening){recognitionRef.current?.stop();return}
    const C=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!C){alert('التعرف الصوتي غير متاح في هذا المحرك حالياً. الكتابة تعمل الآن.');return}
    const r:SpeechRecognitionLike=new C();r.lang='ar-SA';r.interimResults=false;r.continuous=false;
    r.onresult=e=>{const t=e?.results?.[0]?.[0]?.transcript||'';if(t){setInput(t);setTimeout(()=>sendMessage(t),100)}};
    r.onerror=()=>setListening(false);r.onend=()=>setListening(false);recognitionRef.current=r;setListening(true);
    try{r.start()}catch{setListening(false)}
  }
  function runAction(action?:Action){
    if(!action)return;
    if('route'in action){navigate(action.route);return}
    if(action.kind==='invoice'){
      if(!window.confirm('هل تريد تعبئة فاتورة العمل بهذه البيانات وفتحها للمراجعة؟'))return;
      mergeInvoice(action.draft);navigate('/work-invoice');
    }
  }

  const quick=['وش يحتاج انتباهي اليوم؟','اعطني ملخص الحساب','كم صافي الربح؟','كم المستحقات؟','اعرض السائقين'];

  return (
    <AppLayout>
      <div dir="rtl" className="w-full pb-6">
        <section className="relative overflow-hidden rounded-[26px] p-5 mb-4"
          style={{background:'linear-gradient(135deg, rgba(88,28,135,0.92), rgba(49,46,129,0.78), rgba(10,20,38,0.98))',border:'1px solid rgba(192,132,252,0.22)',boxShadow:'0 14px 35px rgba(88,28,135,0.20)'}}>
          <div className="absolute -left-10 -top-10 w-32 h-32 rounded-full bg-purple-400/10"/>
          <div className="relative flex items-center gap-4">
            <div className="w-16 h-16 rounded-[20px] bg-purple-400/15 border border-purple-300/20 flex items-center justify-center"><Bot className="w-9 h-9 text-purple-300"/></div>
            <div className="flex-1">
              <div className="flex items-center gap-2"><h1 className="text-[21px] font-black text-white">BAAKR AI</h1><Sparkles className="w-5 h-5 text-purple-300"/></div>
              <p className="text-[11px] text-purple-100/80 mt-1">مركز ذكي للحسابات والسائقين والمعدات والمستندات</p>
              <div className="mt-2 inline-flex items-center gap-1.5 text-[9px] text-green-300"><span className="w-2 h-2 rounded-full bg-green-400"/>متصل ببيانات BAAKR PRO</div>
            </div>
            <button type="button" onClick={loadData} className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center"><RefreshCw className="w-4 h-4 text-white"/></button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 mb-4">
          <MiniCard title="الدخل" value={money(totals.totalIncome)} icon={TrendingUp}/>
          <MiniCard title="المستحقات" value={money(totals.receivables)} icon={Wallet}/>
          <MiniCard title="صافي الربح" value={money(totals.netProfit)} icon={BarChart3}/>
          <MiniCard title="الحركات" value={`${transactionCount}`} icon={Receipt}/>
        </section>

        <section className="grid grid-cols-3 gap-2 mb-4">
          <SmallStatus icon={Users} label="السائقون" value={drivers.length}/>
          <SmallStatus icon={Wrench} label="المعدات" value={equipmentDocs.length}/>
          <SmallStatus icon={AlertTriangle} label="التنبيهات" value={alerts.length} warning={alerts.length>0}/>
        </section>

        <section className="rounded-[26px] overflow-hidden" style={{background:'linear-gradient(180deg,rgba(12,25,45,0.98),rgba(6,14,26,0.99))',border:'1px solid rgba(255,255,255,0.07)'}}>
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[14px] bg-purple-500/15 flex items-center justify-center"><Bot className="w-6 h-6 text-purple-400"/></div>
              <div className="flex-1"><p className="text-[13px] font-black text-white">المحادثة الذكية</p><p className="text-[9px] text-slate-500 mt-0.5">اكتب أو تكلم بالعربي</p></div>
              <button type="button" onClick={()=>setVoiceEnabled(v=>!v)} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                {voiceEnabled?<Volume2 className="w-4 h-4 text-purple-300"/>:<VolumeX className="w-4 h-4 text-slate-500"/>}
              </button>
            </div>
          </div>

          <div className="p-4 min-h-[330px] max-h-[470px] overflow-y-auto space-y-3">
            {messages.map(m=>(
              <div key={m.id} className={`flex ${m.type==='user'?'justify-start':'justify-end'}`}>
                <div className={`max-w-[88%] px-4 py-3 rounded-[18px] text-[12px] leading-6 whitespace-pre-line ${m.type==='user'?'bg-purple-600 text-white rounded-tl-[5px]':'bg-white/[0.045] border border-white/[0.06] text-slate-200 rounded-tr-[5px]'}`}>
                  {m.type==='ai'&&<div className="flex items-center gap-1.5 text-purple-400 mb-1"><Bot className="w-4 h-4"/><span className="text-[9px] font-bold">BAAKR AI</span></div>}
                  {m.text}
                  {m.type==='ai'&&m.action&&(
                    <button type="button" onClick={()=>runAction(m.action)}
                      className="mt-3 w-full min-h-10 px-3 rounded-xl bg-purple-500/15 border border-purple-400/20 text-purple-200 font-black text-[11px] flex items-center justify-center gap-2">
                      {'kind' in m.action?<FileText className="w-4 h-4"/>:<ExternalLink className="w-4 h-4"/>}{m.action.label}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="px-3 pb-3"><div className="flex gap-2 overflow-x-auto">
            {quick.map(q=><button key={q} type="button" onClick={()=>sendMessage(q)} className="shrink-0 px-3 h-9 rounded-xl bg-purple-500/10 border border-purple-400/10 text-[9px] text-purple-200 active:scale-95">{q}</button>)}
          </div></div>

          <div className="p-3 border-t border-white/5">
            {listening&&<div className="mb-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-[10px] font-bold text-center">🎙️ أسمعك الآن... تكلم</div>}
            <div className="flex items-center gap-2">
              <input type="text" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendMessage()}}
                placeholder="مثال: كم حساب السائق محمد؟"
                className="flex-1 h-12 min-w-0 rounded-[16px] bg-white/[0.04] border border-white/[0.07] px-4 text-[12px] text-white placeholder:text-slate-600 outline-none focus:border-purple-500/40"/>
              <button type="button" onClick={startVoice} className={`w-12 h-12 shrink-0 rounded-[16px] flex items-center justify-center active:scale-95 border ${listening?'bg-red-500/20 border-red-400/30':'bg-white/[0.05] border-white/[0.08]'}`}>
                {listening?<MicOff className="w-5 h-5 text-red-300"/>:<Mic className="w-5 h-5 text-purple-300"/>}
              </button>
              <button type="button" onClick={()=>sendMessage()} disabled={!input.trim()} className="w-12 h-12 shrink-0 rounded-[16px] bg-gradient-to-br from-purple-500 to-violet-700 flex items-center justify-center active:scale-95 disabled:opacity-40"><Send className="w-5 h-5 text-white"/></button>
            </div>
            <p className="text-[8px] text-slate-600 text-center mt-2">أي إنشاء أو تعديل مالي يحتاج تأكيدك قبل التنفيذ.</p>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function MiniCard({title,value,icon:Icon}:{title:string;value:string;icon:any}) {
  return <div className="rounded-[20px] p-3.5" style={{background:'linear-gradient(145deg,rgba(13,27,47,0.94),rgba(7,17,31,0.98))',border:'1px solid rgba(168,85,247,0.10)'}}>
    <div className="flex items-center justify-between">
      <div><p className="text-[9px] text-slate-500">{title}</p><p className="text-[13px] font-black text-purple-300 mt-2">{value}</p></div>
      <div className="w-10 h-10 rounded-[14px] bg-purple-500/10 flex items-center justify-center"><Icon className="w-5 h-5 text-purple-400"/></div>
    </div>
  </div>;
}
function SmallStatus({icon:Icon,label,value,warning=false}:{icon:any;label:string;value:number;warning?:boolean}) {
  return <div className={`rounded-2xl p-3 border ${warning?'bg-amber-500/10 border-amber-500/20':'bg-[#0b1524] border-white/10'}`}>
    <Icon className={`w-4 h-4 mb-2 ${warning?'text-amber-400':'text-purple-400'}`}/>
    <div className="text-white text-lg font-black">{value}</div><div className="text-[9px] text-slate-500">{label}</div>
  </div>;
        }
