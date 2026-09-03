import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Camera, Save } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import {
  type EquipmentStatus,
  type EquipmentType,
  statusLabels,
  typeLabels,
  createEquipment,
  type EquipmentInput,
} from '@/lib/equipment';

const statusOptions: EquipmentStatus[] = [
  'active',
  'maintenance',
  'idle',
];

const typeOptions: EquipmentType[] = [
  'crane',
  'boom_truck',
  'other',
];

/* ضغط وتصغير الصورة قبل حفظها */
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('تعذر قراءة الصورة'));
    };

    reader.onload = () => {
      const img = new Image();

      img.onerror = () => {
        reject(new Error('تعذر معالجة الصورة'));
      };

      img.onload = () => {
        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 1280;

        let width = img.width;
        let height = img.height;

        if (
          width > MAX_WIDTH ||
          height > MAX_HEIGHT
        ) {
          const ratio = Math.min(
            MAX_WIDTH / width,
            MAX_HEIGHT / height
          );

          width = Math.round(
            width * ratio
          );

          height = Math.round(
            height * ratio
          );
        }

        const canvas =
          document.createElement('canvas');

        canvas.width = width;
        canvas.height = height;

        const ctx =
          canvas.getContext('2d');

        if (!ctx) {
          reject(
            new Error(
              'تعذر تجهيز الصورة'
            )
          );
          return;
        }

        ctx.drawImage(
          img,
          0,
          0,
          width,
          height
        );

        const compressed =
          canvas.toDataURL(
            'image/jpeg',
            0.7
          );

        resolve(compressed);
      };

      img.src =
        reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}

export function AddEquipmentPage() {
  const navigate = useNavigate();

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [name, setName] =
    useState('');

  const [type, setType] =
    useState<EquipmentType>('crane');

  const [capacity, setCapacity] =
    useState('');

  const [plateNumber, setPlateNumber] =
    useState('');

  const [notes, setNotes] =
    useState('');

  const [status, setStatus] =
    useState<EquipmentStatus>('active');

  const [image, setImage] =
    useState('');

  const [saving, setSaving] =
    useState(false);

  const [
    processingImage,
    setProcessingImage,
  ] = useState(false);

  const [error, setError] =
    useState('');

  async function handleImageSelect(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      e.target.files?.[0];

    if (!file) {
      return;
    }

    setError('');

    if (!file.type.startsWith('image/')) {
      setError(
        'الملف المحدد ليس صورة'
      );
      return;
    }

    setProcessingImage(true);

    try {
      const compressed =
        await compressImage(file);

      setImage(compressed);
    } catch (err) {
      console.error(
        'Image processing error:',
        err
      );

      setError(
        'تعذر تجهيز الصورة. اختر صورة أخرى.'
      );
    } finally {
      setProcessingImage(false);

      e.target.value = '';
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError(
        'الرجاء إدخال اسم المعدة'
      );
      return;
    }

    if (processingImage) {
      setError(
        'انتظر حتى ينتهي تجهيز الصورة'
      );
      return;
    }

    setSaving(true);
    setError('');

    try {
      const input: EquipmentInput = {
        name: name.trim(),
        type,
        capacity:
          capacity.trim(),
        plateNumber:
          plateNumber.trim(),
        status,
        notes:
          notes.trim(),
        image,
      };

      await createEquipment(input);

      navigate('/equipment');
    } catch (err) {
      console.error(
        'Equipment save error:',
        err
      );

      setError(
        'حدث خطأ أثناء الحفظ. حاول مرة أخرى.'
      );

      setSaving(false);
    }
  }

  return (
    <AppLayout
      showHeader={false}
      showBottomNav={false}
    >
      <div className="pt-4">

        <PageHeader
          title="إضافة معدة جديدة"
          subtitle="أدخل بيانات المعدة"
          icon={Truck}
          onBack={() =>
            navigate('/equipment')
          }
        />

        {/* Image upload */}
        <Card className="overflow-hidden mb-4">
          <div
            className="relative h-48 bg-ink-900/60 flex items-center justify-center cursor-pointer"
            onClick={() => {
              if (!processingImage) {
                fileInputRef.current?.click();
              }
            }}
          >
            {processingImage ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-slate-500 border-t-gold-400 animate-spin" />

                <span className="text-sm text-slate-400">
                  جاري تجهيز الصورة...
                </span>
              </div>
            ) : image ? (
              <>
                <img
                  src={image}
                  alt="معاينة"
                  className="w-full h-full object-cover"
                />

                <div className="absolute inset-0 bg-ink-950/30" />

                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ink-950/70 backdrop-blur-sm">
                  <Camera className="w-4 h-4 text-gold-400" />

                  <span className="text-xs text-slate-200">
                    تغيير الصورة
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                  <Camera
                    className="w-8 h-8 text-slate-500"
                    strokeWidth={1.5}
                  />
                </div>

                <span className="text-sm text-slate-400">
                  إضافة صورة
                </span>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
        </Card>

        <div className="space-y-4">

          {/* Name */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">
              اسم المعدة
            </label>

            <input
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              placeholder="مثال: كرين 25 طن"
              className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/40 transition-colors"
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">
              نوع المعدة
            </label>

            <div className="flex gap-2">
              {typeOptions.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    setType(t)
                  }
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    type === t
                      ? 'bg-gold-500/15 text-gold-300 border border-gold-500/30'
                      : 'bg-white/5 text-slate-400 border border-white/5'
                  }`}
                >
                  {typeLabels[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Capacity */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">
              الحمولة (طن)
            </label>

            <input
              value={capacity}
              onChange={(e) =>
                setCapacity(
                  e.target.value
                )
              }
              inputMode="decimal"
              placeholder="مثال: 25"
              className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/40 transition-colors"
            />
          </div>

          {/* Plate number */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">
              رقم اللوحة (اختياري)
            </label>

            <input
              value={plateNumber}
              onChange={(e) =>
                setPlateNumber(
                  e.target.value
                )
              }
              placeholder="مثال: أ ب ج 1234"
              className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/40 transition-colors"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">
              ملاحظات (اختياري)
            </label>

            <textarea
              value={notes}
              onChange={(e) =>
                setNotes(
                  e.target.value
                )
              }
              rows={3}
              placeholder="أي ملاحظات إضافية..."
              className="w-full bg-ink-850/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/40 transition-colors resize-none"
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">
              حالة المعدة
            </label>

            <div className="flex gap-2">
              {statusOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    setStatus(s)
                  }
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    status === s
                      ? 'bg-gold-500/15 text-gold-300 border border-gold-500/30'
                      : 'bg-white/5 text-slate-400 border border-white/5'
                  }`}
                >
                  {statusLabels[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-expense text-center">
              {error}
            </p>
          )}

          {/* Save */}
          <button
            type="button"
            onClick={handleSave}
            disabled={
              saving ||
              processingImage
            }
            className="w-full py-3.5 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-ink-950 font-bold text-sm shadow-glow-gold active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <span>
                جاري الحفظ...
              </span>
            ) : processingImage ? (
              <span>
                جاري تجهيز الصورة...
              </span>
            ) : (
              <>
                <Save
                  className="w-5 h-5"
                  strokeWidth={2.5}
                />

                حفظ المعدة
              </>
            )}
          </button>

        </div>
      </div>
    </AppLayout>
  );
            }
