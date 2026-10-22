import { useRef, useState } from 'react';
import { FileText, Save, FolderOpen, ShieldCheck, Loader2 } from 'lucide-react';
import { exportFullBackup, exportFullPdf, parseFullBackup, restoreFullBackup } from '@/lib/fullBackup';

export function FullBackupCard() {
  const [tab,setTab]=useState<'pdf'|'backup'>('pdf');
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const input=useRef<HTMLInputElement>(null);
  const [progress,setProgress]=useState('');

  async function exportPdf(){
    setBusy(true);setStatus('');setProgress('يجري تجهيز التقرير...');
    try {
      const result=await exportFullPdf((done,total)=>setProgress(`تحضير الصفحات: ${done} / ${total}`));
      setStatus(`✅ تم تجهيز تقرير PDF (${result.pages} صفحة). اختر Google Drive من نافذة المشاركة لحفظه خارج الجوال.`);
    }catch(err){console.error(err);setStatus(`❌ ${err instanceof Error?err.message:'تعذر حفظ PDF'}`)}
    finally {setBusy(false);setProgress('');}
  }
  async function exportBackup(){
    setBusy(true);setStatus('');
    try {
      const r=await exportFullBackup();
      setStatus(`✅ نسخة شاملة جاهزة (${r.items} قسم محفوظ). تأكد أنك اخترت Google Drive وحفظت الملف.`);
    } catch(err){console.error(err);setStatus(`❌ ${err instanceof Error?err.message:'تعذر إنشاء النسخة'}`)}
    finally {setBusy(false);}
  }
  async function importBackup(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];e.currentTarget.value='';if(!file)return;
    setBusy(true);setStatus('');
    try {
      const text=await file.text();
      const backup=parseFullBackup(text);
      if(!window.confirm(`استعادة نسخة BAKR PRO بتاريخ ${new Date(backup.createdAt).toLocaleString('ar-SA')}؟\nستُستبدل البيانات الحالية، وسيتم إنشاء نسخة أمان على الجهاز قبل الاستعادة.`))return;
      if(!window.confirm('تأكيد أخير: هل تريد استبدال بيانات التطبيق الحالية فعلاً؟'))return;
      await restoreFullBackup(backup);
      alert('✅ تمت الاستعادة بنجاح. سيتم إعادة فتح التطبيق الآن.');window.location.reload();
    }catch(err){console.error(err);setStatus(`❌ ${err instanceof Error?err.message:'فشلت الاستعادة، لم تُستبدل البيانات'}`)}
    finally {setBusy(false);}
  }
  const cardStyle:React.CSSProperties={background:'linear-gradient(145deg,#11243d,#081323)',border:'1px solid rgba(222,183,98,.5)',boxShadow:'0 16px 40px rgba(0,0,0,.28)',padding:18,borderRadius:23,margin:'14px 0 20px'};
  const active:React.CSSProperties={background:'linear-gradient(120deg,#f4d17b,#c29335)',color:'#121827',border:'none'};
  const inactive:React.CSSProperties={background:'rgba(255,255,255,.06)',color:'#cbd5e1',border:'1px solid rgba(255,255,255,.08)'};
  const btn:React.CSSProperties={padding:'12px 14px',borderRadius:13,fontSize:14,fontWeight:800,cursor:'pointer',display:'flex',justifyContent:'center',alignItems:'center',gap:8};
  return <section dir="rtl" style={cardStyle}>
    <div style={{display:'flex',gap:9,alignItems:'center',marginBottom:4}}><ShieldCheck size={28} color="#e3bf68"/><b style={{fontSize:21,color:'#f4d17b'}}>النسخ الاحتياطي الشامل</b></div>
    <p style={{fontSize:13,color:'#bdc7da',lineHeight:1.9,margin:'8px 0 14px'}}>خانة واحدة فيها خياران لحماية جميع بيانات BAKR PRO المخزنة داخل التطبيق.</p>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
      <button type="button" disabled={busy} onClick={()=>setTab('pdf')} style={{...btn,...(tab==='pdf'?active:inactive)}}><FileText size={18}/> تصدير PDF</button>
      <button type="button" disabled={busy} onClick={()=>setTab('backup')} style={{...btn,...(tab==='backup'?active:inactive)}}><Save size={18}/> نسخة للاستعادة</button>
    </div>
    {tab==='pdf' ? <>
      <p style={{color:'#dbe4f3',fontSize:13,lineHeight:1.8}}>تقرير منسق بالعربي لجميع المعلومات النصية والأرقام، للاطلاع والطباعة والإرسال. <b>ملف PDF لا يعيد البيانات للتطبيق.</b></p>
      <button type="button" disabled={busy} onClick={exportPdf} style={{...btn,width:'100%',background:'#d4a94c',border:'none',color:'#101827'}}>{busy?<Loader2 size={19}/>:<FileText size={19}/>} حفظ ومشاركة PDF الشامل</button>
    </> : <>
      <p style={{color:'#dbe4f3',fontSize:13,lineHeight:1.8}}>ملف JSON واحد لحفظ سجلات السواقين والكرينات والحسابات والفواتير والمشاوير وأي بيانات محفوظة داخل التطبيق، واستعادتها على جهاز آخر.</p>
      <button type="button" disabled={busy} onClick={exportBackup} style={{...btn,width:'100%',background:'#d4a94c',border:'none',color:'#101827',marginBottom:9}}>{busy?<Loader2 size={19}/>:<Save size={19}/>} حفظ نسخة شاملة ومشاركتها</button>
      <button type="button" disabled={busy} onClick={()=>input.current?.click()} style={{...btn,width:'100%',background:'rgba(255,255,255,.04)',border:'1px solid #64748b',color:'#f8fafc'}}><FolderOpen size={18}/> استعادة من ملف JSON محفوظ</button>
      <input ref={input} type="file" accept=".json,application/json" style={{display:'none'}} onChange={importBackup} />
      <p style={{color:'#f8d98a',fontSize:12,lineHeight:1.8,marginTop:13}}>مهم: اختر Google Drive عند الحفظ وتأكد من ظهور الملف هناك. النسخة تشمل البيانات المحلية، ولا تشمل الملفات الخارجية أو الصور غير المخزنة داخل بيانات التطبيق.</p>
    </>}
    {(progress||status)&&<div role="status" style={{marginTop:14,padding:11,borderRadius:10,background:'rgba(255,255,255,.07)',lineHeight:1.8,fontSize:13,color:'#fff'}}>{progress||status}</div>}
  </section>;
}
