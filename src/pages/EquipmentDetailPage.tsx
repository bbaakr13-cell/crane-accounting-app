import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import {
  Truck,
  Plus,
  CalendarClock,
  TrendingUp,
  TrendingDown,
  Wallet,
  Wrench,
  Hash,
  FileText,
  Pencil,
  Trash2,
  AlertTriangle,
  Receipt,
  ArrowDownLeft,
  ArrowUpLeft,
  FolderOpen,
  Image as ImageIcon,
  FilePlus2,
  Upload,
  X,
  Download,
  Share2,
  Eye,
  UserRound,
  CheckCircle2,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/dashboard/StatCard';
import {
  type Equipment,
  statusLabels,
  statusStyles,
  typeLabels,
  fetchEquipmentById,
  deleteEquipment,
} from '@/lib/equipment';
import { fetchEquipmentStats, type EquipmentStats } from '@/lib/transactions';
import { formatSAR } from '@/lib/format';
import { PDFDocument } from 'pdf-lib';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [stats, setStats] = useState<EquipmentStats>({ totalJobValue: 0, totalPaid: 0, totalRemaining: 0, totalExpenses: 0, netProfit: 0, jobsCount: 0 });
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const [eq, st] = await Promise.all([fetchEquipmentById(id), fetchEquipmentStats(id)]);
        setEquipment(eq);
        setStats(st);
      } catch {
        setEquipment(null);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteEquipment(id);
      navigate('/equipment');
    } catch {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <AppLayout showHeader={false} showBottomNav={false}>
        <div className="pt-4">
          <PageHeader title="المعدات" icon={Truck} onBack={() => navigate('/equipment')} />
          <Card className="p-8 text-center"><p className="text-sm text-slate-400">جاري التحميل...</p></Card>
        </div>
      </AppLayout>
    );
  }

  if (!equipment) {
    return (
      <AppLayout showHeader={false} showBottomNav={false}>
        <div className="pt-4">
          <PageHeader title="المعدات" icon={Truck} onBack={() => navigate('/equipment')} />
          <Card className="p-8 flex flex-col items-center text-center">
            <p className="text-sm text-slate-400">لم يتم العثور على هذه المعدة</p>
            <button onClick={() => navigate('/equipment')} className="mt-4 px-5 py-2.5 rounded-xl bg-gold-500/15 text-gold-300 font-semibold text-sm active:scale-95 transition-transform">العودة للمعدات</button>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const styles = statusStyles[equipment.status];

  const actionButtons = [
    { label: 'إضافة عمل', icon: ArrowDownLeft, onClick: () => navigate('/add'), tone: 'bg-income/10 text-income border-income/20' },
    { label: 'إضافة مصروف', icon: ArrowUpLeft, onClick: () => navigate('/add'), tone: 'bg-expense/10 text-expense border-expense/20' },
    { label: 'الحساب الشهري', icon: CalendarClock, onClick: () => navigate(`/monthly/${equipment.id}`), tone: 'bg-receivable/10 text-receivable border-receivable/20' },
    { label: 'مستندات الكرين والمشغل', icon: FolderOpen, onClick: () => setShowDocuments(true), tone: 'bg-blue-500/10 text-blue-300 border-blue-500/20' },
    { label: 'عرض الحركات', icon: Receipt, onClick: () => navigate('/transactions'), tone: 'bg-white/5 text-slate-200 border-white/10' },
    { label: 'كشف PDF', icon: FileText, onClick: () => navigate(`/monthly/${equipment.id}`), tone: 'bg-gold-500/10 text-gold-400 border-gold-500/20' },
    { label: 'تعديل المعدة', icon: Pencil, onClick: () => navigate(`/equipment/${equipment.id}/edit`), tone: 'bg-white/5 text-slate-200 border-white/10' },
  ];

  return (
    <AppLayout showHeader={false} showBottomNav={false}>
      <div className="pt-4">
        <PageHeader
          title={equipment.name}
          icon={Truck}
          onBack={() => navigate('/equipment')}
          action={
            <button onClick={() => navigate('/add')} className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-glow-gold active:scale-95 transition-transform flex-shrink-0">
              <Plus className="w-5 h-5 text-ink-950" strokeWidth={2.5} />
            </button>
          }
        />

        {/* Hero image */}
        <Card className="overflow-hidden mb-4 animate-scale-in">
          <div className="relative h-40">
            {equipment.image ? (
              <img src={equipment.image} alt={equipment.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-ink-900/60 flex items-center justify-center">
                <Truck className="w-12 h-12 text-slate-600" strokeWidth={1.5} />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-ink-850 via-ink-850/30 to-transparent" />
            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-ink-950/70 backdrop-blur-sm">
              <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
              <span className={`text-xs font-medium ${styles.text}`}>{statusLabels[equipment.status]}</span>
            </div>
            <div className="absolute bottom-3 right-3 left-3">
              <h3 className="text-lg font-bold text-white font-display">{equipment.name}</h3>
            </div>
          </div>
        </Card>

        {/* Action buttons grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {actionButtons.map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.label}
                onClick={btn.onClick}
                className={`py-3 rounded-xl border text-xs font-medium active:scale-95 transition-transform flex flex-col items-center gap-1.5 ${btn.tone}`}
              >
                <Icon className="w-5 h-5" strokeWidth={2} />
                {btn.label}
              </button>
            );
          })}
        </div>

        {/* Financial stats */}
        <section className="grid grid-cols-3 gap-2.5 mb-4">
          <StatCard label="قيمة الأعمال" amount={formatSAR(stats.totalJobValue)} icon={TrendingUp} tone="income" delay={0} />
          <StatCard label="المصروفات" amount={formatSAR(stats.totalExpenses)} icon={TrendingDown} tone="expense" delay={60} />
          <StatCard label="صافي الربح" amount={formatSAR(stats.netProfit)} icon={Wallet} tone="profit" delay={120} />
        </section>

        {/* Additional stats */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <Card className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-receivable/10 flex items-center justify-center flex-shrink-0">
              <Receipt className="w-4 h-4 text-receivable" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[11px] text-slate-500">المستحقات</p>
              <p className="text-sm font-bold text-receivable tabular-nums">{formatSAR(stats.totalRemaining)}</p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
              <Hash className="w-4 h-4 text-slate-400" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[11px] text-slate-500">عدد الأعمال</p>
              <p className="text-sm font-bold text-slate-200 tabular-nums">{stats.jobsCount}</p>
            </div>
          </Card>
        </div>

        {/* Info rows */}
        <Card className="divide-y divide-white/5 mb-4">
          {[
            { icon: Hash, label: 'رقم اللوحة', value: equipment.plateNumber || '—' },
            { icon: Wrench, label: 'الحمولة', value: equipment.capacity ? `${equipment.capacity} طن` : '—' },
            { icon: Truck, label: 'النوع', value: typeLabels[equipment.type] },
          ].map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.label} className="flex items-center gap-3 p-3.5">
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-slate-400" strokeWidth={2} />
                </div>
                <span className="text-sm text-slate-400 flex-1">{row.label}</span>
                <span className="text-sm font-semibold text-slate-100 tabular-nums">{row.value}</span>
              </div>
            );
          })}
        </Card>

        {/* Notes */}
        {equipment.notes && (
          <Card className="p-4 mb-4">
            <p className="text-xs text-slate-500 mb-1.5">ملاحظات</p>
            <p className="text-sm text-slate-200 leading-relaxed">{equipment.notes}</p>
          </Card>
        )}

        {/* Delete button */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full py-2.5 rounded-xl bg-expense/10 border border-expense/20 text-expense font-medium text-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" strokeWidth={2} />
          حذف المعدة
        </button>
      </div>

      {showDocuments && (
        <EquipmentDocumentsPanel
          equipmentId={equipment.id}
          equipmentName={equipment.name}
          onClose={() => setShowDocuments(false)}
        />
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink-950/80 backdrop-blur-sm animate-fade-in">
          <Card className="p-6 max-w-sm w-full">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-expense/10 flex items-center justify-center mb-4">
                <AlertTriangle className="w-7 h-7 text-expense" strokeWidth={2} />
              </div>
              <h3 className="text-base font-bold text-white font-display mb-2">تأكيد الحذف</h3>
              <p className="text-sm text-slate-400 mb-6">
                هل أنت متأكد من حذف "{equipment.name}"؟ سيتم حذف المعدة ولكن ستبقى الحركات المالية محفوظة.
              </p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-200 font-medium text-sm active:scale-95 transition-transform">إلغاء</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-expense text-white font-medium text-sm active:scale-95 transition-transform disabled:opacity-50">
                  {deleting ? 'جاري الحذف...' : 'حذف'}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}


type DocumentGroup = 'crane' | 'driver';
type EquipmentDocument = {
  id: string;
  group: DocumentGroup;
  title: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
};

const DEFAULT_CRANE_DOCS = ['رخصة سير الكرين', 'TUV الكرين', 'التأمين'];
const DEFAULT_DRIVER_DOCS = ['الإقامة', 'رخصة السائق', 'TUV السائق'];

function documentsStorageKey(equipmentId: string) {
  return `baakr-equipment-documents-v2-${equipmentId}`;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function loadEquipmentDocuments(equipmentId: string): EquipmentDocument[] {
  try {
    const raw = localStorage.getItem(documentsStorageKey(equipmentId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEquipmentDocuments(equipmentId: string, docs: EquipmentDocument[]) {
  localStorage.setItem(documentsStorageKey(equipmentId), JSON.stringify(docs));
}

function createCoverImage(equipmentName: string, docs: EquipmentDocument[]) {
  const canvas = document.createElement('canvas');
  canvas.width = 1240;
  canvas.height = 1754;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('تعذر إنشاء غلاف الملف');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#081321';
  ctx.fillRect(0, 0, canvas.width, 300);

  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 74px Arial';
  ctx.fillText('BAAKR PRO', 620, 120);
  ctx.font = 'bold 50px Arial';
  ctx.fillText('ملف مستندات الكرين والمشغل', 620, 210);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 52px Arial';
  ctx.fillText(equipmentName || 'المعدة', 620, 420);

  ctx.fillStyle = '#64748b';
  ctx.font = '32px Arial';
  ctx.fillText('ملف موحّد جاهز للإرسال إلى الشركات والمؤسسات والمقاولين', 620, 485);

  const craneDocs = docs.filter((d) => d.group === 'crane');
  const driverDocs = docs.filter((d) => d.group === 'driver');

  const drawSection = (title: string, list: EquipmentDocument[], y: number) => {
    ctx.fillStyle = '#eff6ff';
    ctx.fillRect(100, y, 1040, 90);
    ctx.fillStyle = '#1d4ed8';
    ctx.font = 'bold 38px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(title, 1080, y + 58);

    let yy = y + 145;
    ctx.fillStyle = '#111827';
    ctx.font = '32px Arial';
    for (const doc of list) {
      ctx.fillText(`• ${doc.title}`, 1080, yy);
      yy += 58;
    }
    if (!list.length) {
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('لا توجد مستندات محددة', 1080, yy);
      yy += 58;
    }
    return yy;
  };

  let y = drawSection('مستندات الكرين', craneDocs, 600);
  y += 50;
  drawSection('مستندات السائق / المشغل', driverDocs, y);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '26px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`تم إنشاء الملف بواسطة BAAKR PRO • ${new Date().toLocaleDateString('ar-SA')}`, 620, 1660);
  return canvas.toDataURL('image/png');
}

async function buildMergedPdf(equipmentName: string, docs: EquipmentDocument[]) {
  const merged = await PDFDocument.create();
  const coverDataUrl = createCoverImage(equipmentName, docs);
  const cover = await merged.embedPng(dataUrlToBytes(coverDataUrl));
  const coverPage = merged.addPage([595.28, 841.89]);
  coverPage.drawImage(cover, { x: 0, y: 0, width: 595.28, height: 841.89 });

  for (const doc of docs) {
    if (doc.mimeType === 'application/pdf' || doc.fileName.toLowerCase().endsWith('.pdf')) {
      try {
        const source = await PDFDocument.load(dataUrlToBytes(doc.dataUrl), { ignoreEncryption: true });
        const pages = await merged.copyPages(source, source.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
      } catch (e) {
        console.warn('تعذر دمج PDF:', doc.fileName, e);
      }
      continue;
    }

    try {
      const bytes = dataUrlToBytes(doc.dataUrl);
      const image = doc.mimeType.includes('png')
        ? await merged.embedPng(bytes)
        : await merged.embedJpg(bytes);
      const page = merged.addPage([595.28, 841.89]);
      const margin = 32;
      const maxW = 595.28 - margin * 2;
      const maxH = 841.89 - margin * 2;
      const ratio = Math.min(maxW / image.width, maxH / image.height);
      const w = image.width * ratio;
      const h = image.height * ratio;
      page.drawImage(image, { x: (595.28 - w) / 2, y: (841.89 - h) / 2, width: w, height: h });
    } catch (e) {
      console.warn('تعذر إضافة الصورة:', doc.fileName, e);
    }
  }

  return merged.save();
}

function EquipmentDocumentsPanel({
  equipmentId,
  equipmentName,
  onClose,
}: {
  equipmentId: string;
  equipmentName: string;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<EquipmentDocument[]>(() => loadEquipmentDocuments(equipmentId));
  const [pending, setPending] = useState<{ group: DocumentGroup; title: string } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    saveEquipmentDocuments(equipmentId, docs);
    setSelected((current) => current.filter((id) => docs.some((d) => d.id === id)));
  }, [docs, equipmentId]);

  useEffect(() => {
    setSelected(docs.map((d) => d.id));
  }, []);

  function existing(group: DocumentGroup, title: string) {
    return docs.find((d) => d.group === group && d.title === title);
  }

  function chooseFile(group: DocumentGroup, title: string) {
    setPending({ group, title });
    requestAnimationFrame(() => fileInputRef.current?.click());
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pending) return;

    if (!(file.type.startsWith('image/') || file.type === 'application/pdf')) {
      alert('اختر صورة أو ملف PDF فقط');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const next: EquipmentDocument = {
        id: existing(pending.group, pending.title)?.id || makeId(),
        group: pending.group,
        title: pending.title,
        fileName: file.name,
        mimeType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        dataUrl: String(reader.result || ''),
      };
      setDocs((current) => [
        ...current.filter((d) => !(d.group === pending.group && d.title === pending.title)),
        next,
      ]);
      setSelected((current) => Array.from(new Set([...current, next.id])));
      setPending(null);
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  }

  function addCustom(group: DocumentGroup) {
    const title = window.prompt('اكتب اسم المستند الجديد');
    if (!title?.trim()) return;
    chooseFile(group, title.trim());
  }

  function removeDoc(doc: EquipmentDocument) {
    if (!window.confirm(`حذف ${doc.title}؟`)) return;
    setDocs((current) => current.filter((d) => d.id !== doc.id));
  }

  function openDoc(doc: EquipmentDocument) {
    const w = window.open();
    if (w) w.location.href = doc.dataUrl;
  }

  function toggleSelected(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  async function exportPdf(mode: 'save' | 'share') {
    const chosen = docs.filter((d) => selected.includes(d.id));
    if (!chosen.length) {
      alert('حدد مستندًا واحدًا على الأقل');
      return;
    }
    if (busy) return;

    try {
      setBusy(true);
      const bytes = await buildMergedPdf(equipmentName, chosen);
      const safe = (equipmentName || 'equipment').replace(/[\\/:*?"<>|]/g, '-');
      const fileName = `BAAKR-PRO-${safe}-documents.pdf`;
      const base64 = bytesToBase64(bytes);

      if (mode === 'share') {
        try {
          const result = await Filesystem.writeFile({
            path: fileName,
            data: base64,
            directory: Directory.Cache,
            recursive: true,
          });
          await Share.share({
            title: 'مستندات الكرين والمشغل',
            text: `${equipmentName} - ملف المستندات`,
            url: result.uri,
            dialogTitle: 'مشاركة ملف المستندات',
          });
          return;
        } catch (e) {
          console.warn(e);
        }
      }

      try {
        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Documents,
          recursive: true,
        });
        alert(`تم حفظ الملف بنجاح\n${fileName}`);
      } catch {
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
      }
    } catch (e) {
      console.error(e);
      alert('تعذر إنشاء ملف PDF. تأكد أن ملفات PDF غير محمية بكلمة مرور.');
    } finally {
      setBusy(false);
    }
  }

  const renderCard = (group: DocumentGroup, title: string) => {
    const doc = existing(group, title);
    const isSelected = doc ? selected.includes(doc.id) : false;
    return (
      <div key={`${group}-${title}`} className="rounded-2xl border border-white/10 bg-[#0a1422] p-3">
        <div className="flex items-start gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${doc ? 'bg-blue-500/15' : 'bg-white/5'}`}>
            {doc?.mimeType === 'application/pdf' ? <FileText className="w-5 h-5 text-red-300" /> : <ImageIcon className="w-5 h-5 text-blue-300" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-black text-white truncate">{title}</p>
              {doc && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">مضاف</span>}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 truncate">{doc ? doc.fileName : 'صورة أو PDF'}</p>
          </div>
          {doc && (
            <button type="button" onClick={() => toggleSelected(doc.id)} className={`w-8 h-8 rounded-lg border flex items-center justify-center ${isSelected ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-white/5 border-white/10 text-slate-600'}`}>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {!doc ? (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button type="button" onClick={() => chooseFile(group, title)} className="h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-bold flex items-center justify-center gap-1.5"><ImageIcon className="w-4 h-4" /> إضافة صورة</button>
            <button type="button" onClick={() => chooseFile(group, title)} className="h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-bold flex items-center justify-center gap-1.5"><FileText className="w-4 h-4" /> إضافة PDF</button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 mt-3">
            <button type="button" onClick={() => openDoc(doc)} className="h-9 rounded-xl bg-white/5 border border-white/10 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1"><Eye className="w-3.5 h-3.5" /> عرض</button>
            <button type="button" onClick={() => chooseFile(group, title)} className="h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] font-bold flex items-center justify-center gap-1"><Upload className="w-3.5 h-3.5" /> تغيير</button>
            <button type="button" onClick={() => removeDoc(doc)} className="h-9 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] font-bold flex items-center justify-center gap-1"><Trash2 className="w-3.5 h-3.5" /> حذف</button>
          </div>
        )}
      </div>
    );
  };

  const customCrane = docs.filter((d) => d.group === 'crane' && !DEFAULT_CRANE_DOCS.includes(d.title));
  const customDriver = docs.filter((d) => d.group === 'driver' && !DEFAULT_DRIVER_DOCS.includes(d.title));

  return (
    <div className="fixed inset-0 z-[70] bg-[#050b14] overflow-y-auto" dir="rtl">
      <div className="max-w-xl mx-auto px-4 pt-4 pb-28">
        <div className="flex items-center justify-between mb-5 sticky top-0 z-10 bg-[#050b14]/95 backdrop-blur-xl py-3">
          <button type="button" onClick={onClose} className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><X className="w-5 h-5 text-white" /></button>
          <div className="text-center px-2">
            <h2 className="text-lg font-black text-white">مستندات الكرين والمشغل</h2>
            <p className="text-[11px] text-slate-500 mt-1">{equipmentName}</p>
          </div>
          <div className="w-11" />
        </div>

        <section className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center"><Truck className="w-4 h-4 text-orange-300" /></div>
            <div><h3 className="text-white font-black text-sm">مستندات الكرين</h3><p className="text-[10px] text-slate-500">كل مستند يقبل صورة أو PDF</p></div>
          </div>
          <div className="space-y-2">
            {DEFAULT_CRANE_DOCS.map((title) => renderCard('crane', title))}
            {customCrane.map((doc) => renderCard('crane', doc.title))}
          </div>
          <button type="button" onClick={() => addCustom('crane')} className="w-full h-11 mt-3 rounded-xl border border-dashed border-blue-500/30 bg-blue-500/5 text-blue-300 text-xs font-black flex items-center justify-center gap-2"><FilePlus2 className="w-4 h-4" /> إضافة مستند جديد للكرين</button>
        </section>

        <section className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center"><UserRound className="w-4 h-4 text-blue-300" /></div>
            <div><h3 className="text-white font-black text-sm">مستندات السائق / المشغل</h3><p className="text-[10px] text-slate-500">السائق منفصل تمامًا عن ملفات الكرين</p></div>
          </div>
          <div className="space-y-2">
            {DEFAULT_DRIVER_DOCS.map((title) => renderCard('driver', title))}
            {customDriver.map((doc) => renderCard('driver', doc.title))}
          </div>
          <button type="button" onClick={() => addCustom('driver')} className="w-full h-11 mt-3 rounded-xl border border-dashed border-blue-500/30 bg-blue-500/5 text-blue-300 text-xs font-black flex items-center justify-center gap-2"><FilePlus2 className="w-4 h-4" /> إضافة مستند جديد للسائق</button>
        </section>

        <div className="rounded-2xl bg-gradient-to-br from-blue-600/15 to-emerald-500/10 border border-blue-500/20 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-blue-500/15 flex items-center justify-center"><FileText className="w-5 h-5 text-blue-300" /></div>
            <div className="flex-1"><p className="text-white text-sm font-black">دمج المستندات وإصدار PDF</p><p className="text-[10px] text-slate-400 mt-1">المحدد: {selected.length} من {docs.length} مستند</p></div>
          </div>
          <p className="text-[11px] text-slate-400 leading-6 mb-3">ينشئ غلاف BAAKR PRO احترافي ثم يدمج الصور وملفات PDF المحددة في ملف واحد جاهز للشركات والمؤسسات والمقاولين.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => exportPdf('save')} className="h-11 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50"><Download className="w-4 h-4" /> {busy ? 'جاري التجهيز...' : 'حفظ PDF'}</button>
            <button type="button" disabled={busy} onClick={() => exportPdf('share')} className="h-11 rounded-xl bg-blue-600 text-white text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50"><Share2 className="w-4 h-4" /> مشاركة</button>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*,application/pdf,.pdf" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}
