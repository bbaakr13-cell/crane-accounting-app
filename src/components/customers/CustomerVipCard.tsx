import { useEffect, useMemo, useRef, useState } from 'react';
import { Crown, Plus, Minus, FileDown, Share2, MessageCircle, ShieldCheck, Save, Check } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

type Stamp = { id: string; kind: 'manual' | 'job'; jobId?: string; date: string; note?: string };
type CardData = {
  target: number;
  rewardType: 'percentage' | 'amount' | 'gift' | 'none';
  rewardValue: string;
  rewardNote: string;
  stamps: Stamp[];
};
type CustomerJob = { id: string; date?: string; jobType?: string; workAmount?: number };
const blank: CardData = { target: 4, rewardType: 'none', rewardValue: '', rewardNote: '', stamps: [] };
const storageKey = (id: string) => `bakr-pro-vip-customer-v1-${id}`;
const iconImage = `${import.meta.env.BASE_URL || '/'}vip-sany-crane.webp`;
const makeStampId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function readCard(id: string): CardData {
  try {
    const raw = localStorage.getItem(storageKey(id));
    if (!raw) return { ...blank, stamps: [] };
    const stored = JSON.parse(raw) as Partial<CardData>;
    return {
      target: Math.max(1, Math.min(30, Number(stored.target) || 4)),
      rewardType: ['percentage', 'amount', 'gift', 'none'].includes(String(stored.rewardType)) ? stored.rewardType! : 'none',
      rewardValue: String(stored.rewardValue ?? ''),
      rewardNote: String(stored.rewardNote ?? ''),
      stamps: Array.isArray(stored.stamps) ? stored.stamps.filter(s => !!s?.id) : [],
    };
  } catch { return { ...blank, stamps: [] }; }
}
const cleanFilename = (s: string) => s.replace(/[\\/:*?"<>|]/g, '-').slice(0, 75);

export function CustomerVipCard({ customerId, customerName, jobs = [] }: {
  customerId: string; customerName: string; jobs?: CustomerJob[];
}) {
  const [card, setCard] = useState<CardData>(() => readCard(customerId));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [jobToApprove, setJobToApprove] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);
  const [loadedId, setLoadedId] = useState(customerId);

  useEffect(() => {
    setCard(readCard(customerId));
    setLoadedId(customerId);
    setJobToApprove('');
  }, [customerId]);
  useEffect(() => {
    if (loadedId !== customerId) return;
    try { localStorage.setItem(storageKey(customerId), JSON.stringify(card)); }
    catch { setStatus('مساحة التخزين ممتلئة. خذ نسخة احتياطية قبل إضافة أختام أخرى.'); }
  }, [customerId, card, loadedId]);

  const progress = Math.min(card.stamps.length, card.target);
  const approvedJobs = useMemo(() => new Set(card.stamps.map(s => s.jobId).filter(Boolean)), [card.stamps]);
  const eligibleJobs = jobs.filter(j => !!j.id && !approvedJobs.has(j.id));
  const reward = card.rewardType === 'percentage' && card.rewardValue ? `خصم ${card.rewardValue}%`
    : card.rewardType === 'amount' && card.rewardValue ? `خصم ${card.rewardValue} ريال`
    : card.rewardType === 'gift' ? (card.rewardNote.trim() || 'مكافأة يحددها صاحب الخدمة')
    : 'تُحدد المكافأة من الإدارة';

  const message = `🏗️ *BAKR PRO VIP* 👑\n\nعميلنا العزيز *${customerName}*،\nشكراً لثقتك بخدمات تأجير الكرينات والبوم ترك.\n\n🎫 هذه بطاقة الولاء الخاصة بك.\n⭐ أختامك الحالية: *${progress} من ${card.target}*\n🎁 مكافأتك عند اكتمال الأختام: *${reward}*\n\nيُضاف ختم بعد كل عملية تأجير مؤهلة يعتمدها صاحب الخدمة. وتخضع المكافأة لشروط بطاقتك.\n\n📄 أرفقنا لك بطاقة VIP بصيغة PDF للاحتفاظ بها.\n\nBAKR PRO – خميس مشيط وأبها وعسير`;

  function addManualStamp() {
    if (!window.confirm(`إضافة ختم يدوي للعميل ${customerName}؟`)) return;
    setCard(prev => ({ ...prev, stamps: [...prev.stamps, { id: makeStampId(), kind: 'manual', date: new Date().toISOString(), note: 'ختم يدوي معتمد' }] }));
  }
  function approveJob() {
    if (!jobToApprove || approvedJobs.has(jobToApprove)) return;
    const job = jobs.find(j => j.id === jobToApprove);
    if (!job || !window.confirm('تأكد أن العمل مكتمل ومؤهل للختم. هل تريد اعتماده؟')) return;
    setCard(prev => {
      if (prev.stamps.some(s => s.jobId === jobToApprove)) return prev;
      return { ...prev, stamps: [...prev.stamps, { id: makeStampId(), kind: 'job', jobId: jobToApprove, date: new Date().toISOString(), note: job.jobType || 'مشوار معتمد' }] };
    });
    setJobToApprove('');
  }
  function removeLast() {
    if (!card.stamps.length || !window.confirm('إلغاء آخر ختم مسجل لهذا العميل؟')) return;
    setCard(prev => ({ ...prev, stamps: prev.stamps.slice(0, -1) }));
  }

  async function makePdf() {
    if (!previewRef.current) throw new Error('لا توجد بطاقة جاهزة');
    const canvas = await html2canvas(previewRef.current, {
      scale: 2.5, backgroundColor: '#071527', useCORS: true,
      onclone(doc) { /* export-only content retains current stamp state */ void doc; },
    });
    const png = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [105, 148], compress: true });
    pdf.addImage(png, 'PNG', 0, 0, 105, 148, undefined, 'FAST');
    return pdf;
  }
  async function exportCard(mode: 'download' | 'share') {
    if (busy) return;
    setBusy(true); setStatus('');
    try {
      const pdf = await makePdf();
      const name = `BAKR-PRO-VIP-${cleanFilename(customerName)}.pdf`;
      const base64 = pdf.output('datauristring').split(',')[1];
      if (mode === 'share') {
        const file = await Filesystem.writeFile({ directory: Directory.Cache, path: name, data: base64 });
        await Share.share({ title: 'بطاقة BAKR PRO VIP', text: message, url: file.uri, dialogTitle: 'مشاركة بطاقة العميل PDF' });
      } else {
        try {
          await Filesystem.writeFile({ directory: Directory.Documents, path: name, data: base64 });
          setStatus(`تم حفظ PDF باسم ${name}`);
        } catch {
          pdf.save(name);
          setStatus('تم إرسال PDF إلى التنزيلات.');
        }
      }
    } catch (error) {
      console.error('BAKR VIP EXPORT:', error);
      setStatus('تعذر إخراج PDF أو المشاركة. تأكد من صلاحيات الملفات وحاول مرة ثانية.');
    } finally { setBusy(false); }
  }
  function whatsAppText() {
    const link = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(link, '_blank', 'noopener,noreferrer');
  }

  const fieldClass = 'w-full rounded-xl border border-white/15 bg-[#111f33] text-white px-3 py-2.5 text-sm outline-none focus:border-amber-400';
  return (
    <section dir="rtl" className="my-5 space-y-3">
      <div className="flex items-center gap-2 text-amber-300 text-base font-bold"><Crown size={20} /> بطاقة الولاء الرقمية • BAKR PRO VIP</div>
      <div ref={previewRef} style={{ width: '100%', aspectRatio: '105 / 148', color: '#fff', background: 'radial-gradient(circle at top right,#18365b 0%,#071527 52%,#06101f 100%)', border: '3px solid #d7a948', borderRadius: 24, boxSizing: 'border-box', position: 'relative', overflow: 'hidden', padding: '6% 6% 5%', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 900, direction: 'ltr', color: '#f2c76e', letterSpacing: 1.5 }}>BAKR PRO</div>
          <div style={{ fontSize: 12, color: '#dbe6f3', marginTop: 5 }}>إدارة حسابات الكرينات</div>
          <div style={{ fontSize: 22, lineHeight: 1.4, fontWeight: 900, color: '#f1c66c', marginTop: 16 }}>بطاقة الولاء الرقمية</div>
          <div style={{ margin: '7px auto 0', display: 'inline-block', borderRadius: 50, color: '#0b172b', background: 'linear-gradient(110deg,#f5d98f,#d99e31)', padding: '6px 22px', fontWeight: 900, letterSpacing: 1 }}>♛ VIP GOLD</div>
        </div>
        <div style={{ marginTop: 10, border: '1px solid #d7a948', borderRadius: 50, padding: '10px 8px', fontSize: 15 }}><span style={{ color: '#cbd5e1' }}>اسم العميل: </span><strong style={{ color: '#f5d98f' }}>{customerName}</strong></div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 12 }}>تقدّم الأختام</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(card.target, 5)},minmax(0,1fr))`, gap: 6 }}>
            {Array.from({ length: card.target }, (_, i) => {
              const earned = i < progress;
              return <div key={i} style={{ aspectRatio: '1/1', borderRadius: 12, padding: 4, background: earned ? '#f4d78f' : '#e9edf3', border: `2px solid ${earned ? '#ffdf8f' : '#c5a158'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', boxShadow: earned ? '0 0 12px #edbb6280' : 'none' }}>
                <img src={iconImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: earned ? 'none' : 'grayscale(0.3)', opacity: earned ? 1 : .72 }} />
                {earned && <span style={{ position: 'absolute', top: 2, right: 2, background: '#134e39', color: '#fff', borderRadius: 20, fontSize: 12, width: 17, height: 17, display: 'grid', placeItems: 'center' }}>✓</span>}
              </div>;
            })}
          </div>
          <div style={{ marginTop: 12, fontSize: 24, fontWeight: 900, color: '#f5d98f', direction: 'ltr' }}>{progress} / {card.target}</div>
        </div>
        <div style={{ marginTop: 12, border: '1px solid #cda34f', borderRadius: 16, padding: '12px 8px', background: '#0e1e31' }}>
          <div style={{ color: '#f3d58d', fontWeight: 900, fontSize: 16 }}>🎁 المكافأة الخاصة بك</div>
          <div style={{ fontSize: 19, fontWeight: 900, marginTop: 4 }}>{reward}</div>
          <div style={{ color: '#cbd5e1', fontSize: 11, marginTop: 5 }}>تُطبق عند اكتمال الأختام ووفق الشروط المحددة</div>
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: '#cbd5e1', lineHeight: 1.6 }}>ختم لكل عملية تأجير مؤهلة ومعتمدة • خميس مشيط – أبها – عسير</div>
      </div>
      <div className="p-4 rounded-2xl border border-amber-400/25 bg-[#0a1728] space-y-3">
        <div className="text-sm font-bold text-white flex gap-2 items-center"><ShieldCheck size={17} className="text-amber-300" /> إدارة البطاقة — للمدير فقط</div>
        <label className="block text-xs text-slate-300">عدد الأختام المطلوب
          <input className={fieldClass + ' mt-1'} type="number" min={1} max={30} inputMode="numeric" value={card.target} onChange={e => setCard(c => ({ ...c, target: Math.max(1, Math.min(30, Number(e.target.value) || 1)) }))} />
        </label>
        <label className="block text-xs text-slate-300">نوع المكافأة
          <select className={fieldClass + ' mt-1'} value={card.rewardType} onChange={e => setCard(c => ({ ...c, rewardType: e.target.value as CardData['rewardType'] }))}>
            <option value="none">بدون خصم حتى أحدده</option><option value="percentage">خصم بالنسبة المئوية</option><option value="amount">خصم بمبلغ ريال</option><option value="gift">مكافأة / خدمة خاصة</option>
          </select>
        </label>
        {(card.rewardType === 'percentage' || card.rewardType === 'amount') && <label className="block text-xs text-slate-300">{card.rewardType === 'percentage' ? 'نسبة الخصم %' : 'قيمة الخصم بالريال'}
          <input className={fieldClass + ' mt-1'} type="number" min={0} max={card.rewardType === 'percentage' ? 100 : undefined} inputMode="decimal" value={card.rewardValue} onChange={e => setCard(c => ({ ...c, rewardValue: e.target.value }))} placeholder="أنت تحدد" />
        </label>}
        <label className="block text-xs text-slate-300">المكافأة أو شروطها (اختياري)
          <input className={fieldClass + ' mt-1'} value={card.rewardNote} onChange={e => setCard(c => ({ ...c, rewardNote: e.target.value }))} placeholder="مثال: على التأجير القادم" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={addManualStamp} className="flex items-center justify-center gap-1 rounded-xl bg-amber-400 text-[#071527] text-sm font-bold p-3"><Plus size={17}/> إضافة ختم</button>
          <button type="button" onClick={removeLast} disabled={!card.stamps.length} className="flex items-center justify-center gap-1 rounded-xl bg-white/10 text-white text-sm font-bold p-3 disabled:opacity-40"><Minus size={17}/> إلغاء آخر ختم</button>
        </div>
        <div className="rounded-xl bg-[#14243b] p-3 space-y-2">
          <div className="text-xs font-bold text-slate-200">اعتماد ختم من عمل العميل (بعد اكتماله)</div>
          <select className={fieldClass} value={jobToApprove} onChange={e => setJobToApprove(e.target.value)}>
            <option value="">اختر عملاً لم يعتمد له ختم</option>
            {eligibleJobs.map(j => <option key={j.id} value={j.id}>{j.date || ''} — {j.jobType || 'عمل'} — {j.workAmount ?? 0} ر.س</option>)}
          </select>
          <button type="button" disabled={!jobToApprove} onClick={approveJob} className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-700 text-white text-sm font-bold p-2.5 disabled:opacity-40"><Check size={16}/> اعتماد ختم لهذا العمل</button>
          <p className="text-xs text-slate-400">لا تُحتسب نفس العملية مرتين. لا يعني دفع قيمة العمل اكتماله؛ أنت تعتمد العمل بعد التأكد.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => exportCard('download')} disabled={busy} className="rounded-xl bg-[#1e456b] text-white p-3 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"><FileDown size={17}/> حفظ PDF</button>
          <button onClick={() => exportCard('share')} disabled={busy} className="rounded-xl bg-[#215c48] text-white p-3 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"><Share2 size={17}/> مشاركة PDF</button>
        </div>
        <button onClick={whatsAppText} className="rounded-xl w-full bg-[#145e4a] text-white p-3 font-bold text-sm flex items-center justify-center gap-2"><MessageCircle size={17}/> تجهيز رسالة واتساب</button>
        <div className="text-xs text-slate-400 flex items-center gap-2"><Save size={15}/> يتم حفظ إعدادات البطاقة والأختام محلياً على هذا الجهاز فقط</div>
        {status && <div className="text-xs text-amber-200" role="status">{status}</div>}
      </div>
    </section>
  );
}
