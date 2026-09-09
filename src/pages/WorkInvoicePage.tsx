import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, FileDown, RotateCcw, Save, Share2, X } from 'lucide-react';
import jsPDF from 'jspdf';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { AppLayout } from '@/components/layout/AppLayout';

const STORAGE_KEY = 'baakr-work-invoice-v4';
const TEMPLATE_WIDTH = 1058;
const TEMPLATE_HEIGHT = 1487;
const PDF_SCALE = 2;
const ARABIC_FONT_NAME = 'HacenEgypt';
const ARABIC_FONT_URL = '/hacen-egypt.ttf';
const TEMPLATE_URL = '/work-invoice-template.png';
const INK = '#0b2f6d';

type InvoiceRow = { description: string; qty: string; unitPrice: string };
type InvoiceData = {
  companyArabic: string; companyEnglish: string; cranesText: string; boomTruckText: string;
  activityText: string; locationText: string; invoiceTypeArabic: string; invoiceTypeEnglish: string;
  invoiceNo: string; date: string; customer: string; rows: InvoiceRow[];
  receivedBy: string; salesman: string;
};

const createEmptyInvoice = (): InvoiceData => ({
  companyArabic: 'رافعات الحديثة',
  companyEnglish: 'RAFIEAT AL-HADITHA',
  cranesText: 'كرينات',
  boomTruckText: 'بوم تراك',
  activityText: 'لتأجير المعدات الثقيلة',
  locationText: 'خميس مشيط - أبها',
  invoiceTypeArabic: 'فاتورة نقداً',
  invoiceTypeEnglish: 'Cash Invoice',
  invoiceNo: '',
  date: '',
  customer: '',
  rows: Array.from({ length: 7 }, (_, i) => ({ description: '', qty: i === 0 ? '1' : '', unitPrice: '' })),
  receivedBy: '',
  salesman: '',
});

function toNumber(value: string) {
  const cleaned = String(value || '').replace(/,/g, '').replace(/[^\d.-]/g, '');
  const result = Number(cleaned);
  return Number.isFinite(result) ? result : 0;
}
function rowTotal(row: InvoiceRow) { return toNumber(row.qty) * toNumber(row.unitPrice); }
function formatMoney(value: number) {
  if (!value) return '';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}
function formatDate(value: string) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${String(Number(day)).padStart(2, '0')} / ${String(Number(month)).padStart(2, '0')} / ${year}`;
  }
  return value;
}
function numberToArabicWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return 'صفر ريال لا غير';
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  const under100 = (num: number): string => {
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    const t = Math.floor(num / 10), o = num % 10;
    return o === 0 ? tens[t] : `${ones[o]} و${tens[t]}`;
  };
  const under1000 = (num: number): string => {
    if (num < 100) return under100(num);
    const h = Math.floor(num / 100), rest = num % 100;
    return rest === 0 ? hundreds[h] : `${hundreds[h]} و${under100(rest)}`;
  };
  const convert = (num: number): string => {
    if (num < 1000) return under1000(num);
    if (num < 1000000) {
      const thousands = Math.floor(num / 1000), rest = num % 1000;
      let t = '';
      if (thousands === 1) t = 'ألف';
      else if (thousands === 2) t = 'ألفان';
      else if (thousands >= 3 && thousands <= 10) t = `${under1000(thousands)} آلاف`;
      else t = `${under1000(thousands)} ألف`;
      return rest === 0 ? t : `${t} و${under1000(rest)}`;
    }
    return String(num);
  };
  return `${convert(n)} ريال سعودي لا غير`;
}
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

let templateCache: HTMLImageElement | null = null;
async function loadTemplate() {
  if (templateCache) return templateCache;
  const image = new Image();
  image.src = `${TEMPLATE_URL}?v=4`;
  await new Promise<void>((resolve, reject) => {
    if (image.complete && image.naturalWidth > 0) return resolve();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('تعذر تحميل قالب الفاتورة'));
  });
  templateCache = image;
  return image;
}
async function ensureHacenFont() {
  try {
    await document.fonts.load(`400 32px "${ARABIC_FONT_NAME}"`);
    if (document.fonts.check(`400 32px "${ARABIC_FONT_NAME}"`)) return;
  } catch {}
  const response = await fetch(ARABIC_FONT_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error('تعذر تحميل خط Hacen Egypt');
  const buffer = await response.arrayBuffer();
  const face = new FontFace(ARABIC_FONT_NAME, buffer, { style: 'normal', weight: '400' });
  const loaded = await face.load();
  document.fonts.add(loaded);
  await document.fonts.load(`400 32px "${ARABIC_FONT_NAME}"`);
  await document.fonts.ready;
}
function fitFontSize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, start: number, min: number) {
  let size = start;
  while (size > min) {
    ctx.font = `400 ${size}px "${ARABIC_FONT_NAME}"`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  return size;
}
function drawArabic(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, opts: {align?: CanvasTextAlign; maxWidth?: number; minSize?: number; color?: string} = {}) {
  const value = String(text || '').trim();
  if (!value) return;
  const finalSize = opts.maxWidth ? fitFontSize(ctx, value, opts.maxWidth, size, opts.minSize || 14) : size;
  ctx.save();
  ctx.font = `400 ${finalSize}px "${ARABIC_FONT_NAME}"`;
  ctx.direction = 'rtl';
  ctx.textAlign = opts.align || 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = opts.color || INK;
  ctx.fillText(value, x, y);
  ctx.restore();
}
function drawEnglish(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, opts: {maxWidth?: number; minSize?: number; color?: string} = {}) {
  const value = String(text || '').trim();
  if (!value) return;
  let finalSize = size;
  if (opts.maxWidth) {
    while (finalSize > (opts.minSize || 12)) {
      ctx.font = `900 ${finalSize}px Arial, sans-serif`;
      if (ctx.measureText(value).width <= opts.maxWidth) break;
      finalSize -= 1;
    }
  }
  ctx.save();
  ctx.font = `900 ${finalSize}px Arial, sans-serif`;
  ctx.direction = 'ltr';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = opts.color || INK;
  ctx.fillText(value, x, y);
  ctx.restore();
}

const ROW_Y = [687, 724, 761, 798, 835, 872, 901];

export function WorkInvoicePage() {
  const navigate = useNavigate();
  const invoiceRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<InvoiceData>(createEmptyInvoice());
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = 'invoice-arabic-font-style';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `@font-face{font-family:'${ARABIC_FONT_NAME}';src:url('${ARABIC_FONT_URL}') format('truetype');font-style:normal;font-weight:400;font-display:block;}`;
      document.head.appendChild(style);
    }
    ensureHacenFont().catch(console.warn);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw), fresh = createEmptyInvoice();
      const savedRows = Array.isArray(parsed?.rows) ? parsed.rows : [];
      setData({...fresh, ...parsed, rows: Array.from({length: 7}, (_, i) => ({...fresh.rows[i], ...(savedRows[i] || {})}))});
    } catch (e) { console.error('Invoice load error:', e); }
  }, []);

  const totals = useMemo(() => data.rows.map(rowTotal), [data.rows]);
  const grandTotal = useMemo(() => totals.reduce((a,b) => a+b, 0), [totals]);
  const totalWords = useMemo(() => grandTotal > 0 ? numberToArabicWords(grandTotal) : '', [grandTotal]);

  function setField<K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) { setData(current => ({...current, [key]: value})); }
  function setRow(index: number, field: keyof InvoiceRow, value: string) {
    setData(current => ({...current, rows: current.rows.map((r,i) => i === index ? {...r, [field]: value} : r)}));
  }
  function saveData(show = true) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); if (show) alert('تم حفظ بيانات الفاتورة'); }
    catch { alert('تعذر حفظ بيانات الفاتورة'); }
  }
  function resetInvoice() {
    if (!window.confirm('هل تريد إنشاء فاتورة جديدة؟')) return;
    const fresh = createEmptyInvoice(); setData(fresh); setPreview(false);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  }

  async function createInvoiceCanvas() {
    await ensureHacenFont();
    const template = await loadTemplate();
    const canvas = document.createElement('canvas');
    canvas.width = TEMPLATE_WIDTH * PDF_SCALE; canvas.height = TEMPLATE_HEIGHT * PDF_SCALE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('تعذر إنشاء Canvas');
    ctx.scale(PDF_SCALE, PDF_SCALE);
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,TEMPLATE_WIDTH,TEMPLATE_HEIGHT);
    ctx.drawImage(template,0,0,TEMPLATE_WIDTH,TEMPLATE_HEIGHT);

    drawEnglish(ctx, formatDate(data.date), 270, 366, 19, {maxWidth:135,minSize:13});
    drawEnglish(ctx, data.invoiceNo, 938, 366, 20, {maxWidth:110,minSize:13});
    drawArabic(ctx, data.customer, 700, 438, 27, {align:'right',maxWidth:625,minSize:17});

    drawArabic(ctx, data.invoiceTypeArabic, 159, 579, 18, {maxWidth:155,minSize:13});
    drawEnglish(ctx, data.invoiceNo, 390, 579, 19, {maxWidth:185,minSize:13});
    drawEnglish(ctx, formatDate(data.date), 642, 579, 18, {maxWidth:185,minSize:12});
    drawArabic(ctx, data.locationText, 895, 579, 18, {maxWidth:175,minSize:12});

    data.rows.forEach((row,i) => {
      const y = ROW_Y[i];
      drawArabic(ctx,row.description,760,y,22,{maxWidth:345,minSize:14});
      drawEnglish(ctx,row.qty,510,y,18,{maxWidth:90,minSize:13});
      drawEnglish(ctx,formatMoney(toNumber(row.unitPrice)),352,y,18,{maxWidth:170,minSize:12});
      drawEnglish(ctx,formatMoney(totals[i]),148,y,18,{maxWidth:180,minSize:12});
    });

    drawEnglish(ctx,formatMoney(grandTotal),214,958,28,{maxWidth:290,minSize:17});
    drawArabic(ctx,totalWords,500,1018,22,{maxWidth:850,minSize:14});

    drawArabic(ctx,data.invoiceTypeArabic,190,1108,16,{maxWidth:145,minSize:12});
    drawEnglish(ctx,data.invoiceNo,190,1134,15,{maxWidth:145,minSize:11});
    drawEnglish(ctx,formatDate(data.date),190,1160,14,{maxWidth:145,minSize:10});
    drawArabic(ctx,'نقداً',190,1186,16,{maxWidth:145,minSize:12});

    drawArabic(ctx,data.salesman,270,1298,19,{maxWidth:300,minSize:13});
    drawArabic(ctx,data.receivedBy,780,1298,19,{maxWidth:300,minSize:13});
    return canvas;
  }

  async function createPdfBlob() {
    const canvas = await createInvoiceCanvas();
    const pdf = new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
    pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,pdf.internal.pageSize.getWidth(),pdf.internal.pageSize.getHeight(),undefined,'FAST');
    return pdf.output('blob');
  }
  function getFileName() {
    const number = data.invoiceNo.trim().replace(/[\\/:*?"<>|]/g,'-');
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}-${String(now.getMilliseconds()).padStart(3,'0')}`;
    return number ? `invoice-${number}-${stamp}.pdf` : `invoice-${stamp}.pdf`;
  }
  async function savePDF() {
    if (busy) return;
    try {
      setBusy(true); saveData(false);
      const blob = await createPdfBlob(), base64 = await blobToBase64(blob), fileName = getFileName();
      try {
        await Filesystem.writeFile({path:fileName,data:base64,directory:Directory.Documents,recursive:true});
        alert(`تم حفظ PDF بنجاح\n${fileName}`);
      } catch {
        const url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href=url; a.download=fileName; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),1500);
      }
    } catch(e) { console.error(e); alert('حدث خطأ أثناء حفظ PDF'); }
    finally { setBusy(false); }
  }
  async function sharePDF() {
    if (busy) return;
    try {
      setBusy(true); saveData(false);
      const blob=await createPdfBlob(), base64=await blobToBase64(blob), fileName=getFileName();
      const result=await Filesystem.writeFile({path:fileName,data:base64,directory:Directory.Cache,recursive:true});
      await Share.share({title:'فاتورة عمل',text:'فاتورة عمل',url:result.uri,dialogTitle:'مشاركة الفاتورة'});
    } catch(e) { console.error(e); alert('تعذرت مشاركة الفاتورة'); }
    finally { setBusy(false); }
  }

  return <AppLayout><div dir="rtl" className="pb-24">
    <div className="flex items-center justify-between mb-5">
      <button type="button" onClick={()=>navigate(-1)} className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center"><ArrowRight className="w-5 h-5 text-white"/></button>
      <div className="text-center"><h1 className="text-lg font-black text-white">فاتورة عمل</h1><p className="text-[11px] text-slate-500 mt-1">تعديل ثم معاينة</p></div>
      <button type="button" onClick={resetInvoice} className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center"><RotateCcw className="w-5 h-5 text-red-400"/></button>
    </div>

    {!preview ? <>
      <Section title="بيانات الفاتورة">
        <div className="grid grid-cols-2 gap-3">
          <Field label="رقم الفاتورة" value={data.invoiceNo} inputMode="numeric" onChange={v=>setField('invoiceNo',v)}/>
          <DateField label="التاريخ" value={data.date} onChange={v=>setField('date',v)}/>
        </div>
        <Field label="المطلوب من السيد / السادة" value={data.customer} placeholder="مثال: شركة المياه الوطنية" onChange={v=>setField('customer',v)}/>
        <Field label="الموقع" value={data.locationText} placeholder="مثال: خميس مشيط - أبها" onChange={v=>setField('locationText',v)}/>
      </Section>

      <Section title="البيان والأسعار">
        <div className="space-y-4">{data.rows.map((row,index)=><div key={index} className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between mb-3"><span className="text-white text-sm font-black">السطر {index+1}</span><span className="text-emerald-400 text-xs font-black">{formatMoney(totals[index])||'0'} ر.س</span></div>
          <Field label="البيان" value={row.description} placeholder="مثال: إيجار كرين رفع حديد" onChange={v=>setRow(index,'description',v)}/>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Field label="الكمية" value={row.qty} inputMode="decimal" onChange={v=>setRow(index,'qty',v)}/>
            <Field label="سعر الوحدة" value={row.unitPrice} inputMode="decimal" onChange={v=>setRow(index,'unitPrice',v)}/>
          </div>
        </div>)}</div>
        <div className="mt-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4">
          <div className="flex items-center justify-between"><span className="text-slate-300 font-bold">المجموع النهائي</span><span className="text-2xl text-emerald-400 font-black">{formatMoney(grandTotal)||'0'} ر.س</span></div>
          <div className="mt-3 pt-3 border-t border-white/10"><div className="text-[11px] text-slate-400 mb-1">المبلغ كتابةً تلقائيًا</div><div className="text-white text-sm font-black leading-7">{totalWords||'سيظهر هنا تلقائيًا بعد إدخال الأسعار'}</div></div>
        </div>
      </Section>

      <Section title="التوقيع"><div className="grid grid-cols-2 gap-3">
        <Field label="المستلم" value={data.receivedBy} onChange={v=>setField('receivedBy',v)}/>
        <Field label="البائع" value={data.salesman} onChange={v=>setField('salesman',v)}/>
      </div></Section>

      <div className="grid grid-cols-2 gap-3 mt-5">
        <button type="button" onClick={()=>saveData(true)} className="h-14 rounded-2xl bg-slate-800 border border-white/10 text-white font-black flex items-center justify-center gap-2"><Save className="w-5 h-5"/>حفظ البيانات</button>
        <button type="button" onClick={async()=>{saveData(false);await ensureHacenFont();setPreview(true);setTimeout(()=>window.scrollTo({top:0,behavior:'smooth'}),50)}} className="h-14 rounded-2xl bg-blue-600 text-white font-black flex items-center justify-center gap-2"><Eye className="w-5 h-5"/>معاينة</button>
      </div>
    </> : <>
      <div className="mb-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 p-3 flex items-center justify-between">
        <div><div className="text-white text-sm font-black">معاينة الفاتورة</div><div className="text-slate-400 text-[11px] mt-1">تأكد من البيانات قبل الحفظ</div></div>
        <button type="button" onClick={()=>setPreview(false)} className="h-10 px-4 rounded-xl bg-white/10 text-white font-bold flex items-center gap-2"><X className="w-4 h-4"/>تعديل</button>
      </div>
      <InvoicePreview invoiceRef={invoiceRef} data={data} totals={totals} grandTotal={grandTotal} totalWords={totalWords}/>
      <div className="grid grid-cols-2 gap-3 mt-5">
        <button type="button" disabled={busy} onClick={savePDF} className="h-14 rounded-2xl bg-emerald-600 text-white font-black flex items-center justify-center gap-2 disabled:opacity-50"><FileDown className="w-5 h-5"/>{busy?'جاري الحفظ...':'حفظ PDF'}</button>
        <button type="button" disabled={busy} onClick={sharePDF} className="h-14 rounded-2xl bg-blue-600 text-white font-black flex items-center justify-center gap-2 disabled:opacity-50"><Share2 className="w-5 h-5"/>مشاركة</button>
      </div>
    </>}
  </div></AppLayout>;
}

function InvoicePreview({invoiceRef,data,totals,grandTotal,totalWords}:{invoiceRef:React.RefObject<HTMLDivElement|null>;data:InvoiceData;totals:number[];grandTotal:number;totalWords:string}) {
  return <div className="w-full"><div ref={invoiceRef} className="relative w-full bg-white overflow-hidden" style={{aspectRatio:`${TEMPLATE_WIDTH} / ${TEMPLATE_HEIGHT}`}}>
    <img src={`${TEMPLATE_URL}?v=4`} alt="فاتورة" draggable={false} className="absolute inset-0 w-full h-full object-fill select-none pointer-events-none"/>
    <svg viewBox={`0 0 ${TEMPLATE_WIDTH} ${TEMPLATE_HEIGHT}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
      <SvgEnglishText x={270} y={366} size={19}>{formatDate(data.date)}</SvgEnglishText>
      <SvgEnglishText x={938} y={366} size={20}>{data.invoiceNo}</SvgEnglishText>
      <SvgArabicText x={700} y={438} size={27} anchor="end">{data.customer}</SvgArabicText>

      <SvgArabicText x={159} y={579} size={18}>{data.invoiceTypeArabic}</SvgArabicText>
      <SvgEnglishText x={390} y={579} size={19}>{data.invoiceNo}</SvgEnglishText>
      <SvgEnglishText x={642} y={579} size={18}>{formatDate(data.date)}</SvgEnglishText>
      <SvgArabicText x={895} y={579} size={18}>{data.locationText}</SvgArabicText>

      {data.rows.map((row,i)=><React.Fragment key={i}>
        <SvgArabicText x={760} y={ROW_Y[i]} size={22}>{row.description}</SvgArabicText>
        <SvgEnglishText x={510} y={ROW_Y[i]} size={18}>{row.qty}</SvgEnglishText>
        <SvgEnglishText x={352} y={ROW_Y[i]} size={18}>{formatMoney(toNumber(row.unitPrice))}</SvgEnglishText>
        <SvgEnglishText x={148} y={ROW_Y[i]} size={18}>{formatMoney(totals[i])}</SvgEnglishText>
      </React.Fragment>)}

      <SvgEnglishText x={214} y={958} size={28}>{formatMoney(grandTotal)}</SvgEnglishText>
      <SvgArabicText x={500} y={1018} size={22}>{totalWords}</SvgArabicText>

      <SvgArabicText x={190} y={1108} size={16}>{data.invoiceTypeArabic}</SvgArabicText>
      <SvgEnglishText x={190} y={1134} size={15}>{data.invoiceNo}</SvgEnglishText>
      <SvgEnglishText x={190} y={1160} size={14}>{formatDate(data.date)}</SvgEnglishText>
      <SvgArabicText x={190} y={1186} size={16}>نقداً</SvgArabicText>

      <SvgArabicText x={270} y={1298} size={19}>{data.salesman}</SvgArabicText>
      <SvgArabicText x={780} y={1298} size={19}>{data.receivedBy}</SvgArabicText>
    </svg>
  </div></div>;
}
function SvgArabicText({children,x,y,size,anchor='middle'}:{children:React.ReactNode;x:number;y:number;size:number;anchor?:'start'|'middle'|'end'}) {
  return <text x={x} y={y} fill={INK} fontSize={size} fontWeight={400} textAnchor={anchor} dominantBaseline="middle" direction="rtl" unicodeBidi="plaintext" style={{fontFamily:`'${ARABIC_FONT_NAME}'`,fontWeight:400,fontStyle:'normal'}}>{children}</text>;
}
function SvgEnglishText({children,x,y,size}:{children:React.ReactNode;x:number;y:number;size:number}) {
  return <text x={x} y={y} fill={INK} fontSize={size} fontWeight={900} textAnchor="middle" dominantBaseline="middle" direction="ltr" style={{fontFamily:'Arial, sans-serif'}}>{children}</text>;
}
function Section({title,children}:{title:string;children:React.ReactNode}) {
  return <section className="mb-4 rounded-[22px] border border-white/10 bg-[#0b1524] p-4"><h2 className="text-white text-base font-black mb-4">{title}</h2><div className="space-y-3">{children}</div></section>;
}
function Field({label,value,onChange,placeholder='',dir='rtl',inputMode='text'}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;dir?:'rtl'|'ltr';inputMode?:'text'|'numeric'|'decimal'}) {
  return <label className="block"><span className="block mb-2 text-[12px] font-bold text-slate-400">{label}</span><input type="text" dir={dir} value={value} inputMode={inputMode} placeholder={placeholder} onChange={e=>onChange(e.target.value)} className="w-full h-12 px-3 rounded-xl bg-[#07111d] border border-white/10 text-white text-sm font-bold outline-none focus:border-blue-500/60"/></label>;
}
function DateField({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}) {
  return <label className="block"><span className="block mb-2 text-[12px] font-bold text-slate-400">{label}</span><input type="date" value={value} onChange={e=>onChange(e.target.value)} className="w-full h-12 px-3 rounded-xl bg-[#07111d] border border-white/10 text-white text-sm font-bold outline-none focus:border-blue-500/60"/></label>;
}
