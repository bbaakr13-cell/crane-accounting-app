import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/** Local BAKR PRO data only; secret authentication keys are intentionally excluded. */
export type FullBackup = {
  app: 'BAKR PRO';
  format: 'bakr-pro-full-v1';
  createdAt: string;
  items: number;
  checksum: string;
  data: Record<string, string>;
};
const fullFormat = 'bakr-pro-full-v1';
const secretKey = /(?:^|[_:\-])(token|password|passwd|secret|oauth|auth|session|credential|privatekey|apikey|refresh|biometric|pin)(?:$|[_:\-])/i;
const externalAuthKey = /^(sb-|supabase\.auth|firebase:auth|google[_-]?oauth)/i;
const privateAppKeys = /^(?:baakr_pro_(?:lock_|recovery_)|bakr_drive_|baakr_pro_last_backup_at)/i;
const appLabel = 'BAKR PRO';

function exportable(key: string) {
  return !secretKey.test(key) && !externalAuthKey.test(key) && !privateAppKeys.test(key);
}
function dataSnapshot() {
  const data: Record<string,string> = {};
  for (let i=0;i<localStorage.length;i++) {
    const key = localStorage.key(i);
    if (key && exportable(key)) {
      const value=localStorage.getItem(key);
      if (value !== null) data[key]=value;
    }
  }
  return Object.fromEntries(Object.entries(data).sort(([a],[b])=>a.localeCompare(b)));
}
// Accidental-corruption check. Not intended as a security signature.
function checksum(data: Record<string,string>) {
  const text=JSON.stringify(data);
  let h=2166136261;
  for(let i=0;i<text.length;i++) { h^=text.charCodeAt(i); h=Math.imul(h,16777619); }
  return (h>>>0).toString(16).padStart(8,'0');
}
export function makeFullBackup(): FullBackup {
  const data=dataSnapshot();
  return {app:appLabel,format:fullFormat,createdAt:new Date().toISOString(),items:Object.keys(data).length,checksum:checksum(data),data};
}
export function parseFullBackup(text:string): FullBackup {
  if(text.length > 100_000_000) throw new Error('ملف كبير جداً');
  const b: unknown=JSON.parse(text);
  if (!b || typeof b!=='object') throw new Error('ملف غير صالح');
  const o=b as Partial<FullBackup>;
  if(o.app!==appLabel || o.format!==fullFormat || !o.data || typeof o.data!=='object' || Array.isArray(o.data)) throw new Error('هذه ليست نسخة BAKR PRO الشاملة');
  if(Object.keys(o.data).length>40000 || Object.entries(o.data).some(([key,value]) => typeof value!=='string' || !exportable(key))) throw new Error('محتوى النسخة غير صالح');
  const normalized=Object.fromEntries(Object.entries(o.data).sort(([a],[b])=>a.localeCompare(b))) as Record<string,string>;
  if(o.checksum!==checksum(normalized)) throw new Error('ملف النسخة غير مكتمل أو تغيّر محتواه');
  return o as FullBackup;
}
function fileStamp(){return new Date().toISOString().slice(0,19).replace(/[T:]/g,'-');}
async function saveAndShare(name:string, data:string, mime:string, isBase64:boolean) {
  if (!Capacitor.isNativePlatform()) {
    const bytes = isBase64 ? Uint8Array.from(atob(data),c=>c.charCodeAt(0)) : data;
    const blob=new Blob([bytes],{type:mime});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
    return;
  }
  // Retain a local copy AND hand over the same file to Android Share / Google Drive.
  const opts:any={data,path:`BAKR_PRO/${name}`,directory:Directory.Documents,recursive:true};
  if(!isBase64) opts.encoding=Encoding.UTF8;
  try {await Filesystem.writeFile(opts);}catch(err){console.warn('Documents unavailable',err);}
  const cached:any={data,path:name,directory:Directory.Cache,recursive:true};
  if(!isBase64) cached.encoding=Encoding.UTF8;
  const result=await Filesystem.writeFile(cached);
  await Share.share({title:`${appLabel} — ${name}`,text:'اختر Google Drive لحفظ نسخة خارج الجوال',url:result.uri,dialogTitle:'حفظ أو مشاركة الملف'});
}
export async function exportFullBackup() {
  const backup=makeFullBackup();
  if(backup.items===0) throw new Error('لا توجد بيانات محفوظة للتصدير');
  const name=`BAKR-PRO-FULL-${fileStamp()}.json`;
  await saveAndShare(name,JSON.stringify(backup,null,2),'application/json',false);
  return {name,items:backup.items};
}
export async function restoreFullBackup(backup:FullBackup) {
  // Always verify again, even for callers that did not come from file import.
  parseFullBackup(JSON.stringify(backup));
  // First preserve current data BEFORE touching the phone's storage.
  const before=makeFullBackup();
  const safeName=`BAKR-PRO-BEFORE-RESTORE-${fileStamp()}.json`;
  const safeOpts={path:`BAKR_PRO/${safeName}`,data:JSON.stringify(before,null,2),directory:Directory.Data,encoding:Encoding.UTF8,recursive:true};
  await Filesystem.writeFile(safeOpts);
  const existing=dataSnapshot();
  try {
    // Replace only non-secret local BAKR PRO data. Authentication/session remains intact.
    Object.keys(existing).forEach(key=>localStorage.removeItem(key));
    Object.entries(backup.data).forEach(([key,value])=>localStorage.setItem(key,value));
  } catch(error) {
    // Automatic rollback if storage quota or disk error happens mid-restore.
    Object.keys(dataSnapshot()).forEach(key=>localStorage.removeItem(key));
    Object.entries(existing).forEach(([key,value])=>localStorage.setItem(key,value));
    throw error;
  }
  return true;
}

type Row={title:string;value:string};
function flatten(prefix:string,value:unknown,rows:Row[],depth=0) {
  if(depth>16){rows.push({title:prefix,value:JSON.stringify(value)});return;}
  if(Array.isArray(value)) {
    if(value.length===0) rows.push({title:prefix,value:'[]'});
    value.forEach((v,i)=>flatten(`${prefix} [${i+1}]`,v,rows,depth+1));return;
  }
  if(value && typeof value==='object') {
    const entries=Object.entries(value as Record<string,unknown>);
    if(entries.length===0)rows.push({title:prefix,value:'{}'});
    entries.forEach(([k,v])=>flatten(`${prefix} › ${k}`,v,rows,depth+1));return;
  }
  let v=String(value ?? '');
  if(v.startsWith('data:') || v.length > 350000) v='[مرفق رقمي — محفوظ داخل نسخة الاستعادة JSON]';
  // Split long text into multiple table rows; do not cut ordinary values.
  if(v.length<=200){rows.push({title:prefix,value:v});return;}
  for(let i=0;i<v.length;i+=200)rows.push({title:i===0?prefix:`${prefix} (تابع)`,value:v.slice(i,i+200)});
}
function reportRows(backup:FullBackup){
  const rows:Row[]=[];
  for(const [key,raw] of Object.entries(backup.data)) {
    try {flatten(key,JSON.parse(raw),rows);} catch {flatten(key,raw,rows);}
  }
  return rows;
}
function escapeHtml(s:string){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function chunkRows(rows: Row[]) {
  // Keep each A4 page readable even when a customer has long notes.
  // ~800px page width; reserve header, footer and page margins.
  const pages: Row[][] = [];
  let current: Row[] = [];
  let used = 0;
  const maxHeight = 770;
  for (const row of rows) {
    const titleLines = Math.max(1, Math.ceil(row.title.length / 85));
    const valueLines = Math.max(1, row.value.split('\n').reduce((a, part) => a + Math.max(1, Math.ceil(part.length / 68)), 0));
    const estimatedHeight = 30 + titleLines * 18 + valueLines * 24;
    if (current.length && used + estimatedHeight > maxHeight) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(row);
    used += estimatedHeight;
  }
  if (current.length) pages.push(current);
  return pages;
}
/** Multi-page Arabic-friendly rendered PDF; uses the browser's Arabic font via html2canvas. */
export async function exportFullPdf(onProgress?:(current:number,total:number)=>void) {
  const backup=makeFullBackup();
  const rows=reportRows(backup);
  if(!rows.length)throw new Error('لا توجد بيانات للتقرير');
  const pages=chunkRows(rows);
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
  const maxPages=2500;
  if(pages.length>maxPages)throw new Error('التقرير كبير جداً. احفظ نسخة الاستعادة الشاملة أولاً.');
  if(document.fonts?.ready) await document.fonts.ready;
  for(let page=0;page<pages.length;page++) {
    const el=document.createElement('div');
    el.setAttribute('dir','rtl');
    el.style.cssText='position:fixed;top:0;left:0;z-index:-10;width:800px;box-sizing:border-box;padding:34px;background:white;color:#17233c;font-family:Tahoma,Arial,sans-serif;line-height:1.7;';
    el.innerHTML=`<div style="padding:17px 20px;background:#101e34;border-bottom:6px solid #caa354;color:white;border-radius:12px">
     <div style="font-size:27px;font-weight:900">BAKR PRO <span style="color:#e0bd63"> | التقرير الشامل</span></div>
     <div style="font-size:15px">بيانات السواقين والمعدات والحسابات والعملاء والمشاوير والفواتير وغيرها</div>
     </div><div style="display:flex;justify-content:space-between;padding:14px 4px;color:#64748b;font-size:13px">
     <b>تاريخ التصدير: ${escapeHtml(backup.createdAt.slice(0,19).replace('T',' '))}</b><b>الصفحة ${page+1} من ${pages.length}</b></div>
     <div style="font-size:14px;font-weight:800;background:#f4eee0;padding:10px;margin-bottom:10px;border-radius:8px">تقرير قراءة وطباعة فقط — الاستعادة تتم من ملف JSON منفصل</div>
     ${pages[page].map((r,idx)=>`<div style="margin:0 0 9px;padding:10px 12px;border-radius:8px;background:${idx%2?'#f1f5f9':'#f8fafc'};border-right:4px solid #c89b42;overflow-wrap:anywhere"><div style="font-size:12px;font-weight:800;color:#34445f">${escapeHtml(r.title)}</div><div style="font-size:14px;white-space:pre-wrap">${escapeHtml(r.value)}</div></div>`).join('')}
     <div style="color:#94a3b8;font-size:12px;margin-top:14px;border-top:1px solid #cbd5e1;padding-top:8px">BAKR PRO • نسخة للقراءة والطباعة • المعلومات الأصلية تُحفظ بملف النسخة الاحتياطية</div>`;
    document.body.appendChild(el);
    try {
      const canvas=await html2canvas(el,{scale:1.45,useCORS:true,backgroundColor:'#ffffff',logging:false});
      const image=canvas.toDataURL('image/jpeg',.9);
      if(page>0)doc.addPage();
      const w=190,h=Math.min(277,canvas.height*190/canvas.width);
      doc.addImage(image,'JPEG',10,10,w,h,undefined,'FAST');
    } finally {el.remove();}
    onProgress?.(page+1,pages.length);
  }
  const name=`BAKR-PRO-ALL-DATA-${fileStamp()}.pdf`;
  const base64=doc.output('datauristring').split(',')[1];
  await saveAndShare(name,base64,'application/pdf',true);
  return {name,pages:pages.length,records:rows.length};
}
