import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Eye,
  FileDown,
  FileImage,
  MapPin,
  MessageCircle,
  Pencil,
  Printer,
  ReceiptText,
  Settings,
  Share2,
  Truck,
  UserRound,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

type Item = { description: string; qty: number; unitPrice: number };
type ScreenMode = 'edit' | 'preview';

type InvoiceData = {
  invoiceNo: string;
  date: string;
  customer: string;
  customerLocation: string;
  companyArabic: string;
  companyEnglish: string;
  activity: string;
  companyLocation: string;
  notes: string;
  paid: boolean;
  themeColor: string;
  logoDataUrl: string;
  items: Item[];
};

const STORAGE_KEY = 'professional-crane-invoice-v2';

const initialData: InvoiceData = {
  invoiceNo: '00125',
  date: new Date().toISOString().slice(0, 10),
  customer: '',
  customerLocation: 'خميس مشيط - أبها',
  companyArabic: 'رافعات الحديثة لتأجير المعدات الثقيلة',
  companyEnglish: 'RAFIEAT AL-HADITHA FOR HEAVY EQUIPMENT RENTAL',
  activity: 'تأجير المعدات الثقيلة',
  companyLocation: 'خميس مشيط - أبها',
  notes: 'يشمل السعر أجرة المعدات والسائق\nغير شامل ضريبة القيمة المضافة',
  paid: true,
  themeColor: '#082e73',
  logoDataUrl: '',
  items: [
    { description: 'تركيب برج', qty: 1, unitPrice: 0 },
    { description: 'شغل في هناجر', qty: 1, unitPrice: 0 },
    { description: 'تحميل حديد', qty: 1, unitPrice: 0 },
    { description: 'رفع خشب', qty: 1, unitPrice: 0 },
    { description: '', qty: 1, unitPrice: 0 },
    { description: '', qty: 1, unitPrice: 0 },
    { description: '', qty: 1, unitPrice: 0 },
  ],
};

function loadInvoice(): InvoiceData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return initialData;
    const parsed = JSON.parse(saved);
    return {
      ...initialData,
      ...parsed,
      items: Array.isArray(parsed.items) && parsed.items.length === 7 ? parsed.items : initialData.items,
    };
  } catch {
    return initialData;
  }
}

const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

function under1000(num: number): string {
  const parts: string[] = [];
  const h = Math.floor(num / 100);
  const rest = num % 100;
  if (h) parts.push(hundreds[h]);
  if (rest) {
    if (rest < 20) parts.push(ones[rest]);
    else {
      const u = rest % 10;
      const t = Math.floor(rest / 10);
      parts.push(u ? `${ones[u]} و${tens[t]}` : tens[t]);
    }
  }
  return parts.join(' و');
}

function numberToArabicWords(value: number): string {
  const num = Math.round(value);
  if (num === 0) return 'صفر ريال لا غير';
  const parts: string[] = [];
  const millions = Math.floor(num / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const rest = num % 1000;
  if (millions) parts.push(millions === 1 ? 'مليون' : millions === 2 ? 'مليونان' : `${under1000(millions)} مليون`);
  if (thousands) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) parts.push(`${under1000(thousands)} آلاف`);
    else parts.push(`${under1000(thousands)} ألف`);
  }
  if (rest) parts.push(under1000(rest));
  return `${parts.join(' و')} ريال لا غير`;
}

const colorOptions = ['#082e73', '#5b36d9', '#047857', '#0f6fbd', '#374151'];

export function InvoicesPage() {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<InvoiceData>(() => loadInvoice());
  const [mode, setMode] = useState<ScreenMode>('edit');

  const total = useMemo(() => data.items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.unitPrice || 0), 0), [data.items]);
  const totalWords = useMemo(() => numberToArabicWords(total), [total]);
  const theme = data.themeColor || '#082e73';

  function updateData<K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) {
    setData((old) => ({ ...old, [key]: value }));
  }

  function updateItem(index: number, key: keyof Item, value: string | number) {
    setData((old) => {
      const items = [...old.items];
      items[index] = { ...items[index], [key]: value };
      return { ...old, items };
    });
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function previewInvoice() {
    saveData();
    setMode('preview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function editInvoice() {
    setMode('edit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateData('logoDataUrl', typeof reader.result === 'string' ? reader.result : '');
    reader.readAsDataURL(file);
  }

  async function createPdf() {
    if (!invoiceRef.current) throw new Error('Invoice not found');
    const canvas = await html2canvas(invoiceRef.current, { scale: 2.2, backgroundColor: '#ffffff', useCORS: true, logging: false });
    const image = canvas.toDataURL('image/jpeg', 0.96);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 3;
    const width = pageWidth - margin * 2;
    const height = (canvas.height * width) / canvas.width;
    pdf.addImage(image, 'JPEG', margin, margin, width, Math.min(height, pageHeight - margin * 2), undefined, 'FAST');
    return pdf;
  }

  async function savePdf() {
    try {
      const pdf = await createPdf();
      const fileName = `invoice-${data.invoiceNo || Date.now()}.pdf`;
      if (Capacitor.isNativePlatform()) {
        const base64 = pdf.output('datauristring').split(',')[1];
        await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Documents });
        alert(`تم حفظ PDF\n${fileName}`);
      } else pdf.save(fileName);
    } catch (error) {
      console.error(error);
      alert('تعذر حفظ PDF');
    }
  }

  async function sharePdf() {
    try {
      const pdf = await createPdf();
      const fileName = `invoice-${data.invoiceNo || Date.now()}.pdf`;
      if (Capacitor.isNativePlatform()) {
        const base64 = pdf.output('datauristring').split(',')[1];
        const result = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
        await Share.share({ title: `فاتورة ${data.invoiceNo}`, text: `فاتورة ${data.companyArabic}`, url: result.uri, dialogTitle: 'مشاركة الفاتورة' });
      } else pdf.save(fileName);
    } catch (error) {
      console.error(error);
      alert('تعذر مشاركة الفاتورة');
    }
  }

  function openWhatsApp() {
    const text = [`فاتورة رقم: ${data.invoiceNo}`, `العميل: ${data.customer || '—'}`, `المجموع: ${total.toLocaleString()} ريال`, data.companyArabic].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  function printInvoice() {
    if (!invoiceRef.current) return;
    const win = window.open('', '_blank');
    if (!win) return alert('تعذر فتح نافذة الطباعة');
    win.document.write(`<!doctype html><html dir="rtl"><head><meta charset="UTF-8"/><title>فاتورة ${data.invoiceNo}</title><style>body{margin:0;background:white;font-family:Arial,Tahoma,sans-serif}*{box-sizing:border-box}@page{size:A4;margin:5mm}</style></head><body>${invoiceRef.current.outerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }

  return (
    <AppLayout>
      <div dir="rtl" style={pageShell}>
        {mode === 'edit' ? (
          <>
            <div style={pageHeader}>
              <div style={headerIcon(theme)}><ReceiptText size={28} /></div>
              <div><h1 style={pageTitle}>إنشاء فاتورة جديدة</h1><p style={pageSubtitle}>أدخل البيانات ثم عاين الفاتورة قبل الحفظ أو المشاركة</p></div>
            </div>

            <SectionCard title="بيانات الفاتورة" icon={<CalendarDays size={20} />} theme={theme}>
              <div style={twoColumns}>
                <Field label="رقم الفاتورة" value={data.invoiceNo} onChange={(v) => updateData('invoiceNo', v)} placeholder="00125" />
                <Field label="التاريخ" type="date" value={data.date} onChange={(v) => updateData('date', v)} />
                <Field label="المطلوب من السيد / السادة" value={data.customer} onChange={(v) => updateData('customer', v)} placeholder="اسم العميل أو المؤسسة" />
                <Field label="الموقع" value={data.customerLocation} onChange={(v) => updateData('customerLocation', v)} placeholder="خميس مشيط - أبها" />
              </div>
            </SectionCard>

            <SectionCard title="بيانات المؤسسة" icon={<Building2 size={20} />} theme={theme}>
              <div style={twoColumns}>
                <Field label="اسم المؤسسة بالعربي" value={data.companyArabic} onChange={(v) => updateData('companyArabic', v)} />
                <Field label="اسم المؤسسة بالإنجليزي" value={data.companyEnglish} onChange={(v) => updateData('companyEnglish', v)} />
                <Field label="نوع النشاط" value={data.activity} onChange={(v) => updateData('activity', v)} />
                <Field label="الموقع" value={data.companyLocation} onChange={(v) => updateData('companyLocation', v)} />
              </div>
            </SectionCard>

            <SectionCard title="بيانات الأعمال" icon={<Truck size={20} />} theme={theme}>
              <div style={{ display: 'grid', gap: 10 }}>
                {data.items.map((item, index) => {
                  const rowTotal = Number(item.qty || 0) * Number(item.unitPrice || 0);
                  return (
                    <div key={index} style={workRow}>
                      <div style={rowNumber(theme)}>{index + 1}</div>
                      <div><label style={miniLabel}>البيان</label><input style={inputStyle} value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} placeholder={index < 4 ? initialData.items[index].description : '—'} /></div>
                      <div><label style={miniLabel}>الكمية</label><input type="number" min="0" style={inputStyle} value={item.qty} onChange={(e) => updateItem(index, 'qty', Number(e.target.value))} /></div>
                      <div><label style={miniLabel}>سعر الوحدة</label><input type="number" min="0" style={inputStyle} value={item.unitPrice} onChange={(e) => updateItem(index, 'unitPrice', Number(e.target.value))} /></div>
                      <div style={totalBox}><span style={miniLabel}>السعر الإجمالي</span><strong>{rowTotal.toLocaleString()} ر.س</strong></div>
                    </div>
                  );
                })}
              </div>
              <div style={grandTotal(theme)}><span>الإجمالي</span><strong>{total.toLocaleString()} ر.س</strong></div>
            </SectionCard>

            <SectionCard title="الشروط والملاحظات" icon={<ReceiptText size={20} />} theme={theme}>
              <textarea style={textareaStyle} value={data.notes} onChange={(e) => updateData('notes', e.target.value)} placeholder="اكتب الشروط والملاحظات هنا..." />
            </SectionCard>

            <SectionCard title="حالة الدفع" icon={<CheckCircle2 size={20} />} theme={theme}>
              <div style={paymentRow}>
                <button type="button" onClick={() => updateData('paid', true)} style={data.paid ? activeChoice('#138a44') : inactiveChoice}>مدفوع</button>
                <button type="button" onClick={() => updateData('paid', false)} style={!data.paid ? activeChoice('#c92a2a') : inactiveChoice}>غير مدفوع</button>
              </div>
            </SectionCard>

            <SectionCard title="الإعدادات" icon={<Settings size={20} />} theme={theme}>
              <div style={settingsGrid}>
                <div style={settingBox}>
                  <span style={settingTitle}>شعار المؤسسة</span>
                  <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
                  <button type="button" style={secondaryButton(theme)} onClick={() => logoInputRef.current?.click()}><FileImage size={18} />تغيير الشعار</button>
                  {data.logoDataUrl && <div style={logoPreviewBox}><img src={data.logoDataUrl} alt="شعار المؤسسة" style={logoPreviewImage} /></div>}
                </div>
                <div style={settingBox}>
                  <span style={settingTitle}>لون القالب</span>
                  <div style={colorPickerRow}>{colorOptions.map((color) => <button key={color} type="button" aria-label={`لون ${color}`} onClick={() => updateData('themeColor', color)} style={colorButton(color, data.themeColor === color)} />)}</div>
                </div>
              </div>
            </SectionCard>

            <button type="button" onClick={previewInvoice} style={previewButton(theme)}><Eye size={22} />معاينة الفاتورة</button>
          </>
        ) : (
          <>
            <div style={previewTopBar}><button type="button" onClick={editInvoice} style={backButton}><ArrowRight size={19} />تعديل الفاتورة</button><div style={previewTitle}>معاينة الفاتورة</div></div>
            <InvoicePreview ref={invoiceRef} data={data} total={total} totalWords={totalWords} theme={theme} />
            <div style={actionBar}>
              <button type="button" onClick={editInvoice} style={actionButton(theme)}><Pencil size={18} />تعديل الفاتورة</button>
              <button type="button" onClick={savePdf} style={actionButton(theme)}><FileDown size={18} />حفظ PDF</button>
              <button type="button" onClick={sharePdf} style={actionButton(theme)}><Share2 size={18} />مشاركة</button>
              <button type="button" onClick={openWhatsApp} style={whatsappAction}><MessageCircle size={18} />واتساب</button>
              <button type="button" onClick={printInvoice} style={actionButton(theme)}><Printer size={18} />طباعة</button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function SectionCard({ title, icon, theme, children }: { title: string; icon: React.ReactNode; theme: string; children: React.ReactNode }) {
  return <section style={sectionCard}><div style={sectionHeading(theme)}><div style={{ color: theme, display: 'flex' }}>{icon}</div><strong>{title}</strong></div>{children}</section>;
}

function Field({ label, value, placeholder, type = 'text', onChange }: { label: string; value: string; placeholder?: string; type?: string; onChange: (value: string) => void }) {
  return <label style={fieldWrap}><span style={fieldLabel}>{label}</span><input style={inputStyle} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>;
}

const InvoicePreview = React.forwardRef<HTMLDivElement, { data: InvoiceData; total: number; totalWords: string; theme: string }>(({ data, total, totalWords, theme }, ref) => (
  <div ref={ref} style={invoiceStyle}>
    <div style={{ height: 7, borderRadius: 5, marginBottom: 10, background: theme }} />
    <div style={invoiceHeader}>
      <div style={craneVisual(theme)}>{data.logoDataUrl ? <img src={data.logoDataUrl} alt="شعار" style={invoiceLogoImage} /> : <Truck size={76} strokeWidth={1.35} />}</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: theme, fontWeight: 900, fontSize: 31 }}>{data.companyArabic}</div>
        <div style={{ color: theme, fontWeight: 900, fontSize: 17, marginTop: 4 }}>{data.companyEnglish}</div>
        <div style={{ background: theme, color: '#fff', padding: '7px 18px', display: 'inline-block', marginTop: 8, borderRadius: 8, fontWeight: 900 }}>{data.activity}</div>
        <div style={{ color: theme, marginTop: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontWeight: 800 }}><MapPin size={16} />{data.companyLocation}</div>
      </div>
      <div style={craneVisual(theme)}><Truck size={76} strokeWidth={1.35} /></div>
    </div>
    <div style={{ width: 260, margin: '12px auto 14px', color: '#fff', borderRadius: 18, padding: '13px 15px', textAlign: 'center', display: 'flex', flexDirection: 'column', background: theme, fontSize: 21 }}><strong>فاتورة نقداً</strong><span>CASH INVOICE</span></div>
    <div style={invoiceMeta}><div><span style={{ color: theme, fontWeight: 800 }}>No</span><div style={{ fontSize: 27, fontWeight: 900 }}>{data.invoiceNo}</div></div><div style={{ textAlign: 'right' }}><div style={{ color: theme, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 5 }}><CalendarDays size={16} />التاريخ</div><strong>{data.date}</strong><div style={{ marginTop: 8 }}>المطلوب من السيد / السادة</div></div></div>
    <div style={infoCards}>
      <div style={{ ...invoiceInfoCard, borderColor: theme }}><div style={{ color: theme, fontWeight: 900, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><UserRound size={18} />بيانات العميل</div><strong>{data.customer || '—'}</strong><div style={{ marginTop: 6, fontSize: 13 }}>{data.customerLocation || '—'}</div></div>
      <div style={{ ...invoiceInfoCard, borderColor: theme }}><div style={{ color: theme, fontWeight: 900, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Building2 size={18} />بيانات المؤسسة</div><strong>{data.companyArabic}</strong><div dir="ltr" style={{ fontSize: 12, marginTop: 5 }}>{data.companyEnglish}</div><div style={{ marginTop: 6, fontSize: 13 }}>{data.companyLocation}</div></div>
    </div>
    <div style={{ overflow: 'hidden', border: `1.5px solid ${theme}`, borderRadius: 10 }}><table style={invoiceTable}><thead><tr><th style={invoiceTh(theme)}>م</th><th style={invoiceTh(theme)}>البيان<small style={englishSmall}>Description</small></th><th style={invoiceTh(theme)}>الكمية<small style={englishSmall}>Qty.</small></th><th style={invoiceTh(theme)}>سعر الوحدة<small style={englishSmall}>Unit Price S.R.</small></th><th style={invoiceTh(theme)}>السعر الإجمالي<small style={englishSmall}>Total Price S.R.</small></th></tr></thead><tbody>{data.items.map((item, index) => { const rowTotal = Number(item.qty || 0) * Number(item.unitPrice || 0); return <tr key={index}><td style={invoiceTd}>{index + 1}</td><td style={{ ...invoiceTd, textAlign: 'right', paddingRight: 12 }}>{item.description || '—'}</td><td style={invoiceTd}>{item.qty || 0}</td><td style={invoiceTd}>{Number(item.unitPrice || 0).toLocaleString()}</td><td style={invoiceTd}>{rowTotal.toLocaleString()}</td></tr>; })}</tbody></table></div>
    <div style={invoiceBottomGrid}>
      <div style={{ border: `1.5px solid ${theme}`, borderRadius: 10, overflow: 'hidden' }}>
        <SummaryRow theme={theme} label="المجموع"><strong>{total.toLocaleString()} ر.س</strong></SummaryRow>
        <SummaryRow theme={theme} label="المبلغ كتابة"><span>{totalWords}</span></SummaryRow>
        <SummaryRow theme={theme} label="ملاحظات"><span style={{ whiteSpace: 'pre-line' }}>{data.notes}</span></SummaryRow>
        <SummaryRow theme={theme} label="حالة الدفع"><span style={data.paid ? invoicePaid : invoiceUnpaid}>{data.paid ? 'مدفوع' : 'غير مدفوع'}</span></SummaryRow>
      </div>
      <div style={{ border: `1.5px solid ${theme}`, borderRadius: 10, padding: 12 }}><div style={{ color: theme, fontWeight: 900, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Settings size={18} />تفاصيل الفاتورة</div><DetailRow label="نوع الفاتورة" value="نقداً"/><DetailRow label="رقم الفاتورة" value={data.invoiceNo}/><DetailRow label="تاريخ الفاتورة" value={data.date}/><DetailRow label="الموقع" value={data.customerLocation}/></div>
    </div>
    <div style={invoiceSignatures}><div><strong>توقيع المستلم</strong><div style={{ width: 160, borderBottom: `2px dotted ${theme}`, marginTop: 32 }} /></div><div><strong>توقيع البائع</strong><div style={{ width: 160, borderBottom: `2px dotted ${theme}`, marginTop: 32 }} /></div></div>
    <div style={{ textAlign: 'center', fontSize: 21, fontWeight: 900, marginTop: 16, paddingBottom: 8, borderBottom: `2px solid ${theme}`, color: theme }}>• شكراً لتعاملكم معنا •</div>
  </div>
));
InvoicePreview.displayName = 'InvoicePreview';

function SummaryRow({ theme, label, children }: { theme: string; label: string; children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', minHeight: 44, borderBottom: '1px solid #d6dbe2', alignItems: 'stretch' }}><strong style={{ background: theme, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>{label}</strong><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>{children}</div></div>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '105px 15px 1fr', gap: 4, lineHeight: 1.8, fontSize: 13 }}><strong>{label}</strong><span>:</span><span>{value || '—'}</span></div>;
}

const pageShell: React.CSSProperties = { maxWidth: 980, margin: '0 auto', padding: '18px 14px 90px', color: '#f8fafc' };
const pageHeader: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 };
const headerIcon = (theme: string): React.CSSProperties => ({ width: 54, height: 54, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${theme}22`, color: theme, border: `1px solid ${theme}55` });
const pageTitle: React.CSSProperties = { margin: 0, fontSize: 26, fontWeight: 900, color: '#fff' };
const pageSubtitle: React.CSSProperties = { margin: '5px 0 0', color: '#94a3b8', fontSize: 13 };
const sectionCard: React.CSSProperties = { background: '#091525', border: '1px solid #22324a', borderRadius: 18, padding: 14, marginBottom: 14, boxShadow: '0 12px 30px rgba(0,0,0,.16)' };
const sectionHeading = (theme: string): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 9, color: '#fff', fontSize: 18, marginBottom: 14, borderBottom: `1px solid ${theme}33`, paddingBottom: 10 });
const twoColumns: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 11 };
const fieldWrap: React.CSSProperties = { display: 'grid', gap: 6 };
const fieldLabel: React.CSSProperties = { color: '#cbd5e1', fontSize: 13, fontWeight: 700 };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: '#06101e', color: '#fff', border: '1px solid #2b3d56', borderRadius: 11, padding: '11px 12px', fontSize: 14, outline: 'none' };
const textareaStyle: React.CSSProperties = { ...inputStyle, minHeight: 125, resize: 'vertical', lineHeight: 1.7 };
const workRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: '38px minmax(160px,1.8fr) minmax(80px,.7fr) minmax(100px,.9fr) minmax(120px,1fr)', gap: 8, alignItems: 'end', padding: 9, border: '1px solid #1f3047', borderRadius: 13, background: '#07111f', overflowX: 'auto' };
const rowNumber = (theme: string): React.CSSProperties => ({ width: 34, height: 34, borderRadius: 10, background: `${theme}22`, border: `1px solid ${theme}55`, color: theme, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, marginBottom: 2 });
const miniLabel: React.CSSProperties = { display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 5, fontWeight: 700 };
const totalBox: React.CSSProperties = { minHeight: 43, borderRadius: 11, border: '1px solid #2b3d56', background: '#0c1929', padding: '7px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center', color: '#fff' };
const grandTotal = (theme: string): React.CSSProperties => ({ marginTop: 12, padding: '12px 14px', borderRadius: 13, background: `${theme}1f`, border: `1px solid ${theme}55`, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 17 });
const paymentRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
const inactiveChoice: React.CSSProperties = { border: '1px solid #334155', background: '#07111f', color: '#cbd5e1', borderRadius: 12, padding: 12, fontWeight: 800 };
const activeChoice = (color: string): React.CSSProperties => ({ border: `1px solid ${color}`, background: `${color}22`, color, borderRadius: 12, padding: 12, fontWeight: 900 });
const settingsGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 };
const settingBox: React.CSSProperties = { border: '1px solid #22324a', borderRadius: 13, padding: 12, background: '#07111f' };
const settingTitle: React.CSSProperties = { display: 'block', color: '#cbd5e1', fontWeight: 800, marginBottom: 10 };
const secondaryButton = (theme: string): React.CSSProperties => ({ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 11, borderRadius: 11, border: `1px solid ${theme}66`, background: `${theme}1c`, color: '#fff', fontWeight: 800 });
const logoPreviewBox: React.CSSProperties = { marginTop: 10, height: 78, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' };
const logoPreviewImage: React.CSSProperties = { maxWidth: '90%', maxHeight: 65, objectFit: 'contain' };
const colorPickerRow: React.CSSProperties = { display: 'flex', gap: 12, flexWrap: 'wrap' };
const colorButton = (color: string, selected: boolean): React.CSSProperties => ({ width: 38, height: 38, borderRadius: '50%', background: color, border: selected ? '4px solid #fff' : '2px solid #475569', boxShadow: selected ? `0 0 0 3px ${color}55` : 'none' });
const previewButton = (theme: string): React.CSSProperties => ({ width: '100%', minHeight: 58, border: 0, borderRadius: 15, background: `linear-gradient(135deg, ${theme}, #6d3ce7)`, color: '#fff', fontWeight: 900, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: `0 12px 26px ${theme}35` });
const previewTopBar: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 };
const previewTitle: React.CSSProperties = { color: '#fff', fontWeight: 900, fontSize: 20 };
const backButton: React.CSSProperties = { border: '1px solid #334155', borderRadius: 11, background: '#0b1626', color: '#fff', padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 7, fontWeight: 800 };
const invoiceStyle: React.CSSProperties = { width: '100%', maxWidth: 794, minHeight: 1120, margin: '0 auto', background: '#fff', color: '#101827', padding: 16, fontFamily: 'Arial, Tahoma, "Noto Sans Arabic", sans-serif', boxSizing: 'border-box', boxShadow: '0 20px 50px rgba(0,0,0,.22)' };
const invoiceHeader: React.CSSProperties = { display: 'grid', gridTemplateColumns: '150px 1fr 150px', alignItems: 'center', gap: 10 };
const craneVisual = (theme: string): React.CSSProperties => ({ minHeight: 116, borderRadius: 16, background: 'linear-gradient(145deg,#f8fafc,#e9eef6)', color: theme, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' });
const invoiceLogoImage: React.CSSProperties = { maxWidth: '92%', maxHeight: 100, objectFit: 'contain' };
const invoiceMeta: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, margin: '12px 8px' };
const infoCards: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 };
const invoiceInfoCard: React.CSSProperties = { border: '1.5px solid', borderRadius: 12, padding: 12, minHeight: 110, textAlign: 'center' };
const invoiceTable: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' };
const invoiceTh = (theme: string): React.CSSProperties => ({ background: theme, color: '#fff', padding: '9px 4px', borderLeft: '1px solid rgba(255,255,255,.55)', fontSize: 13 });
const englishSmall: React.CSSProperties = { display: 'block', fontSize: 9, marginTop: 3, fontWeight: 500 };
const invoiceTd: React.CSSProperties = { border: '1px solid #cbd1d9', padding: '8px 4px', textAlign: 'center', height: 42, fontWeight: 700, fontSize: 13 };
const invoiceBottomGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10, marginTop: 12 };
const invoicePaid: React.CSSProperties = { display: 'inline-flex', margin: '8px auto', alignItems: 'center', justifyContent: 'center', background: '#dcfce7', color: '#15803d', borderRadius: 20, padding: '4px 18px', fontWeight: 900 };
const invoiceUnpaid: React.CSSProperties = { ...invoicePaid, background: '#fee2e2', color: '#b91c1c' };
const invoiceSignatures: React.CSSProperties = { display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginTop: 20 };
const actionBar: React.CSSProperties = { maxWidth: 794, margin: '12px auto 0', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 7 };
const actionButton = (theme: string): React.CSSProperties => ({ border: `1px solid ${theme}66`, background: '#0a1727', color: '#fff', borderRadius: 11, padding: '10px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, fontWeight: 800 });
const whatsappAction: React.CSSProperties = { border: '1px solid #22c55e66', background: '#0c2918', color: '#fff', borderRadius: 11, padding: '10px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, fontWeight: 800 };
