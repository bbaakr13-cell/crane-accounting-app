import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  MapPin,
  Megaphone,
  MessageCircle,
  PencilLine,
  Plus,
  Save,
  Send,
  Settings2,
  Smartphone,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';

type Platform = {
  id: string;
  name: string;
  subtitle: string;
  accent: string;
  soft: string;
  externalUrl?: string;
};

type MarketingPost = {
  id: string;
  platformId: string;
  account: string;
  title: string;
  content: string;
  date: string;
  time: string;
  status: 'draft' | 'scheduled' | 'published';
  imageName?: string;
  createdAt: string;
};

const PLATFORM_KEY = 'bakr_pro_marketing_platforms_v1';
const POSTS_KEY = 'bakr_pro_marketing_posts_v1';

const DEFAULT_PLATFORMS: Platform[] = [
  {
    id: 'haraj',
    name: 'الحراج',
    subtitle: 'إعلانات الخدمات والعروض',
    accent: '#f59e0b',
    soft: 'rgba(245,158,11,.12)',
    externalUrl: 'https://haraj.com.sa',
  },
  {
    id: 'tiktok',
    name: 'تيك توك',
    subtitle: 'فيديوهات قصيرة ومنشورات',
    accent: '#22d3ee',
    soft: 'rgba(34,211,238,.10)',
  },
  {
    id: 'snapchat',
    name: 'سناب شات',
    subtitle: 'قصص وحالات يومية',
    accent: '#eab308',
    soft: 'rgba(234,179,8,.10)',
  },
  {
    id: 'facebook',
    name: 'فيسبوك',
    subtitle: 'منشورات وصفحات وإعلانات',
    accent: '#60a5fa',
    soft: 'rgba(96,165,250,.10)',
  },
  {
    id: 'whatsapp',
    name: 'واتساب',
    subtitle: 'حالات ورسائل تسويقية',
    accent: '#4ade80',
    soft: 'rgba(74,222,128,.10)',
  },
  {
    id: 'google-maps',
    name: 'خرائط Google',
    subtitle: 'تحديث النشاط والمنشورات',
    accent: '#a78bfa',
    soft: 'rgba(167,139,250,.10)',
  },
];

function safeLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('MarketingCenter save error', error);
  }
}

function uid(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function MarketingCenterPage() {
  const navigate = useNavigate();

  const [platforms, setPlatforms] = useState<Platform[]>(() => {
    const saved = safeLoad<Platform[]>(PLATFORM_KEY, []);
    return saved.length ? saved : DEFAULT_PLATFORMS;
  });

  const [posts, setPosts] = useState<MarketingPost[]>(() =>
    safeLoad<MarketingPost[]>(POSTS_KEY, [])
  );

  const [selectedPlatformId, setSelectedPlatformId] = useState('haraj');
  const [account, setAccount] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [imageName, setImageName] = useState('');
  const [addPlatformOpen, setAddPlatformOpen] = useState(false);
  const [newPlatformName, setNewPlatformName] = useState('');

  const selectedPlatform =
    platforms.find(p => p.id === selectedPlatformId) || platforms[0];

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      today: posts.filter(p => p.date === today).length,
      scheduled: posts.filter(p => p.status === 'scheduled').length,
      draft: posts.filter(p => p.status === 'draft').length,
      platforms: platforms.length,
    };
  }, [posts, platforms]);

  function persistPlatforms(next: Platform[]) {
    setPlatforms(next);
    saveJson(PLATFORM_KEY, next);
  }

  function persistPosts(next: MarketingPost[]) {
    setPosts(next);
    saveJson(POSTS_KEY, next);
  }

  function resetComposer() {
    setAccount('');
    setTitle('');
    setContent('');
    setDate('');
    setTime('');
    setImageName('');
  }

  function createPost(status: MarketingPost['status']) {
    if (!selectedPlatform) return;
    if (!title.trim() && !content.trim()) {
      alert('اكتب عنوان الإعلان أو نص المنشور أولاً');
      return;
    }

    const now = new Date().toISOString();
    const post: MarketingPost = {
      id: uid('marketing'),
      platformId: selectedPlatform.id,
      account: account.trim(),
      title: title.trim(),
      content: content.trim(),
      date,
      time,
      status,
      imageName,
      createdAt: now,
    };

    persistPosts([post, ...posts]);
    resetComposer();
    alert(status === 'scheduled' ? 'تم حفظ المنشور في الجدول' : 'تم حفظ المسودة');
  }

  function addPlatform() {
    const name = newPlatformName.trim();
    if (!name) return;

    const exists = platforms.some(
      p => p.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      alert('المنصة موجودة مسبقاً');
      return;
    }

    const nextPlatform: Platform = {
      id: uid('platform'),
      name,
      subtitle: 'منصة مضافة يدويًا',
      accent: '#94a3b8',
      soft: 'rgba(148,163,184,.10)',
    };

    const next = [...platforms, nextPlatform];
    persistPlatforms(next);
    setSelectedPlatformId(nextPlatform.id);
    setNewPlatformName('');
    setAddPlatformOpen(false);
  }

  function removePlatform(id: string) {
    if (DEFAULT_PLATFORMS.some(p => p.id === id)) {
      alert('هذه منصة أساسية داخل مركز التسويق');
      return;
    }
    const next = platforms.filter(p => p.id !== id);
    persistPlatforms(next);
    if (selectedPlatformId === id) setSelectedPlatformId('haraj');
  }

  function removePost(id: string) {
    persistPosts(posts.filter(p => p.id !== id));
  }

  async function copyPostText() {
    const text = [title.trim(), content.trim()].filter(Boolean).join('\n\n');
    if (!text) {
      alert('لا يوجد نص للنسخ');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      alert('تم نسخ نص الإعلان');
    } catch {
      alert('تعذر النسخ تلقائياً');
    }
  }

  function openSelectedPlatform() {
    if (!selectedPlatform?.externalUrl) {
      alert('هذه المنصة مضافة للتنظيم داخل التطبيق فقط حالياً');
      return;
    }
    window.open(selectedPlatform.externalUrl, '_blank');
  }

  return (
    <AppLayout showBottomNav={false}>
      <div
        dir="rtl"
        className="min-h-screen pb-28"
        style={{
          background:
            'radial-gradient(circle at 50% -12%, rgba(245,158,11,.10), transparent 30%), linear-gradient(180deg,#07111f,#030813 76%)',
        }}
      >
        <div className="max-w-[760px] mx-auto px-3 pt-3">
          <section
            className="rounded-[26px] p-5 overflow-hidden relative"
            style={{
              background:
                'linear-gradient(135deg,rgba(31,41,55,.98),rgba(10,20,36,.98) 55%,rgba(6,14,27,.99))',
              border: '1px solid rgba(245,158,11,.20)',
              boxShadow: '0 18px 44px rgba(0,0,0,.30)',
            }}
          >
            <div className="flex items-center gap-3 relative">
              <div
                className="w-14 h-14 rounded-[18px] flex items-center justify-center shrink-0"
                style={{
                  background: 'rgba(245,158,11,.10)',
                  border: '1px solid rgba(251,191,36,.20)',
                }}
              >
                <Megaphone className="w-7 h-7 text-amber-300" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-[22px] font-black text-white">
                    مركز التسويق
                  </h1>
                  <span
                    className="px-2 py-1 rounded-full text-[9px] font-black"
                    style={{
                      background: 'rgba(74,222,128,.10)',
                      border: '1px solid rgba(74,222,128,.18)',
                      color: '#86efac',
                    }}
                  >
                    BAKR PRO
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  إدارة الحراج والمنصات وجدولة المحتوى في مكان واحد
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-11 h-11 rounded-[14px] flex items-center justify-center"
                style={{
                  background: 'rgba(255,255,255,.04)',
                  border: '1px solid rgba(255,255,255,.07)',
                }}
              >
                <ChevronLeft className="w-5 h-5 text-slate-300" />
              </button>
            </div>
          </section>

          <section className="grid grid-cols-4 gap-2 mt-4">
            <StatCard label="اليوم" value={stats.today} icon={<CalendarDays className="w-4 h-4" />} />
            <StatCard label="مجدول" value={stats.scheduled} icon={<Clock3 className="w-4 h-4" />} />
            <StatCard label="مسودات" value={stats.draft} icon={<FileText className="w-4 h-4" />} />
            <StatCard label="منصات" value={stats.platforms} icon={<LayoutGrid className="w-4 h-4" />} />
          </section>

          <section className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-[15px] font-black text-white">المنصات</h2>
                <p className="text-[9px] text-slate-500 mt-1">اختر أين تريد تجهيز المنشور</p>
              </div>

              <button
                type="button"
                onClick={() => setAddPlatformOpen(true)}
                className="h-9 px-3 rounded-[12px] flex items-center gap-1.5 text-[10px] font-black text-slate-100"
                style={{
                  background: 'rgba(255,255,255,.045)',
                  border: '1px solid rgba(255,255,255,.08)',
                }}
              >
                <Plus className="w-4 h-4" />
                إضافة منصة
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {platforms.map(platform => {
                const active = platform.id === selectedPlatformId;
                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => setSelectedPlatformId(platform.id)}
                    className="relative rounded-[20px] p-3.5 text-right min-h-[102px] active:scale-[.98] transition-transform"
                    style={{
                      background: active
                        ? `linear-gradient(145deg,${platform.soft},rgba(9,18,31,.98))`
                        : 'linear-gradient(145deg,rgba(20,31,47,.90),rgba(8,16,28,.97))',
                      border: active
                        ? `1px solid ${platform.accent}55`
                        : '1px solid rgba(255,255,255,.06)',
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className="w-10 h-10 rounded-[13px] flex items-center justify-center shrink-0"
                        style={{ background: platform.soft, color: platform.accent }}
                      >
                        {platform.id === 'haraj' ? (
                          <Megaphone className="w-5 h-5" />
                        ) : platform.id === 'whatsapp' ? (
                          <MessageCircle className="w-5 h-5" />
                        ) : platform.id === 'google-maps' ? (
                          <MapPin className="w-5 h-5" />
                        ) : (
                          <Smartphone className="w-5 h-5" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-black text-white truncate">{platform.name}</p>
                        <p className="text-[9px] leading-[14px] text-slate-500 mt-1">{platform.subtitle}</p>
                      </div>

                      {active && <CheckCircle2 className="w-4 h-4" style={{ color: platform.accent }} />}
                    </div>

                    {!DEFAULT_PLATFORMS.some(p => p.id === platform.id) && (
                      <span
                        role="button"
                        onClick={event => {
                          event.stopPropagation();
                          removePlatform(platform.id);
                        }}
                        className="absolute left-2 bottom-2 w-7 h-7 rounded-[9px] flex items-center justify-center"
                        style={{ background: 'rgba(239,68,68,.08)' }}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-300" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {selectedPlatform?.id === 'haraj' && (
            <section
              className="mt-4 rounded-[22px] p-4"
              style={{
                background: 'linear-gradient(145deg,rgba(64,45,10,.34),rgba(8,17,30,.98))',
                border: '1px solid rgba(245,158,11,.18)',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-[14px] flex items-center justify-center bg-amber-500/10">
                  <Megaphone className="w-5 h-5 text-amber-300" />
                </div>
                <div className="flex-1">
                  <h3 className="text-[14px] font-black text-white">الحراج</h3>
                  <p className="text-[9px] text-slate-400 mt-1">جهّز عنوان الإعلان والوصف والصورة ثم افتح الحراج للنشر</p>
                </div>
                <button
                  type="button"
                  onClick={openSelectedPlatform}
                  className="h-10 px-3 rounded-[12px] flex items-center gap-1.5 text-[9px] font-black text-amber-200"
                  style={{
                    background: 'rgba(245,158,11,.10)',
                    border: '1px solid rgba(245,158,11,.20)',
                  }}
                >
                  فتح الحراج
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </section>
          )}

          <section className="mt-5 rounded-[24px] p-4" style={{ background: 'rgba(12,24,41,.88)', border: '1px solid rgba(255,255,255,.07)' }}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-[15px] font-black text-white">إنشاء منشور</h2>
                <p className="text-[9px] text-slate-500 mt-1">المنصة الحالية: {selectedPlatform?.name}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/ai')}
                className="h-9 px-3 rounded-[12px] flex items-center gap-1.5 text-[9px] font-black text-purple-200"
                style={{ background: 'rgba(168,85,247,.10)', border: '1px solid rgba(192,132,252,.18)' }}
              >
                <Sparkles className="w-4 h-4" />
                BAKR AI
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Field label="الحساب أو الصفحة">
                <input value={account} onChange={e => setAccount(e.target.value)} placeholder="مثال: حساب الحراج الرئيسي" className="marketing-input" />
              </Field>

              <Field label={selectedPlatform?.id === 'haraj' ? 'عنوان إعلان الحراج' : 'عنوان المنشور'}>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="اكتب عنواناً قصيراً وواضحاً" className="marketing-input" />
              </Field>

              <Field label="نص المنشور">
                <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="اكتب الوصف أو نص الإعلان هنا..." className="marketing-input min-h-[120px] resize-none py-3" />
              </Field>

              <div className="grid grid-cols-2 gap-2.5">
                <Field label="تاريخ النشر">
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="marketing-input" />
                </Field>
                <Field label="الوقت">
                  <input type="time" value={time} onChange={e => setTime(e.target.value)} className="marketing-input" />
                </Field>
              </div>

              <Field label="صورة المنشور">
                <label className="h-12 rounded-[13px] px-3 flex items-center gap-2 cursor-pointer" style={{ background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.08)' }}>
                  <ImageIcon className="w-4 h-4 text-slate-400" />
                  <span className="text-[10px] text-slate-400 flex-1 truncate">{imageName || 'اختر صورة من الجهاز'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => setImageName(e.target.files?.[0]?.name || '')}
                  />
                </label>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <button type="button" onClick={() => createPost('draft')} className="h-12 rounded-[14px] flex items-center justify-center gap-2 text-[11px] font-black text-slate-200" style={{ background: 'rgba(255,255,255,.045)', border: '1px solid rgba(255,255,255,.08)' }}>
                <Save className="w-4 h-4" />
                حفظ مسودة
              </button>

              <button type="button" onClick={() => createPost('scheduled')} className="h-12 rounded-[14px] flex items-center justify-center gap-2 text-[11px] font-black text-slate-950" style={{ background: 'linear-gradient(135deg,#fbbf24,#f59e0b)' }}>
                <CalendarDays className="w-4 h-4" />
                حفظ في الجدول
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <button type="button" onClick={copyPostText} className="h-11 rounded-[13px] flex items-center justify-center gap-2 text-[10px] font-black text-sky-200" style={{ background: 'rgba(56,189,248,.08)', border: '1px solid rgba(56,189,248,.15)' }}>
                <Copy className="w-4 h-4" />
                نسخ النص
              </button>
              <button type="button" onClick={openSelectedPlatform} className="h-11 rounded-[13px] flex items-center justify-center gap-2 text-[10px] font-black text-emerald-200" style={{ background: 'rgba(74,222,128,.08)', border: '1px solid rgba(74,222,128,.15)' }}>
                <Send className="w-4 h-4" />
                فتح المنصة
              </button>
            </div>
          </section>

          <section className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-[15px] font-black text-white">خطة النشر</h2>
                <p className="text-[9px] text-slate-500 mt-1">المسودات والمنشورات المحفوظة</p>
              </div>
              <span className="text-[9px] text-slate-500">{posts.length} عنصر</span>
            </div>

            <div className="space-y-2.5">
              {posts.length === 0 ? (
                <div className="rounded-[20px] p-6 text-center" style={{ background: 'rgba(255,255,255,.025)', border: '1px dashed rgba(255,255,255,.08)' }}>
                  <PencilLine className="w-6 h-6 text-slate-600 mx-auto" />
                  <p className="text-[11px] font-bold text-slate-400 mt-2">لا توجد منشورات محفوظة بعد</p>
                </div>
              ) : (
                posts.map(post => {
                  const platform = platforms.find(p => p.id === post.platformId);
                  return (
                    <div key={post.id} className="rounded-[18px] p-3.5" style={{ background: 'rgba(15,27,45,.86)', border: '1px solid rgba(255,255,255,.06)' }}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: platform?.soft || 'rgba(148,163,184,.10)', color: platform?.accent || '#94a3b8' }}>
                          <Megaphone className="w-4 h-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[11px] font-black text-white truncate">{post.title || 'بدون عنوان'}</p>
                            <span className="px-2 py-0.5 rounded-full text-[8px] font-black" style={{ background: post.status === 'scheduled' ? 'rgba(74,222,128,.09)' : 'rgba(148,163,184,.09)', color: post.status === 'scheduled' ? '#86efac' : '#cbd5e1' }}>
                              {post.status === 'scheduled' ? 'مجدول' : 'مسودة'}
                            </span>
                          </div>
                          <p className="text-[9px] text-slate-500 mt-1">{platform?.name || 'منصة'}{post.account ? ` • ${post.account}` : ''}</p>
                          <p className="text-[9px] leading-[14px] text-slate-400 mt-2 line-clamp-2">{post.content || 'لا يوجد وصف'}</p>
                          {(post.date || post.time) && (
                            <p className="text-[8.5px] text-amber-300/80 mt-2">{[post.date, post.time].filter(Boolean).join(' • ')}</p>
                          )}
                        </div>

                        <button type="button" onClick={() => removePost(post.id)} className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: 'rgba(239,68,68,.07)' }}>
                          <Trash2 className="w-3.5 h-3.5 text-rose-300" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <style>{`
          .marketing-input {
            width: 100%;
            height: 48px;
            border-radius: 13px;
            padding-inline: 12px;
            background: rgba(255,255,255,.035);
            border: 1px solid rgba(255,255,255,.08);
            color: #f8fafc;
            font-size: 11px;
            outline: none;
          }
          .marketing-input:focus {
            border-color: rgba(245,158,11,.36);
            box-shadow: 0 0 0 3px rgba(245,158,11,.06);
          }
          .marketing-input::placeholder { color: #64748b; }
        `}</style>

        {addPlatformOpen && (
          <div className="fixed inset-0 z-[10020] flex items-end sm:items-center justify-center p-3" style={{ background: 'rgba(2,6,23,.78)', backdropFilter: 'blur(7px)' }} onClick={() => setAddPlatformOpen(false)}>
            <div dir="rtl" className="w-full max-w-[520px] rounded-[24px] p-4" style={{ background: '#081423', border: '1px solid rgba(255,255,255,.08)' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-[15px] font-black text-white">إضافة منصة جديدة</h3>
                  <p className="text-[9px] text-slate-500 mt-1">أضف أي منصة تحتاجها لاحقاً</p>
                </div>
                <button type="button" onClick={() => setAddPlatformOpen(false)} className="w-9 h-9 rounded-[11px] flex items-center justify-center bg-white/5">
                  <X className="w-4 h-4 text-slate-300" />
                </button>
              </div>

              <input value={newPlatformName} onChange={e => setNewPlatformName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addPlatform(); }} placeholder="مثال: إنستغرام" className="marketing-input" />

              <button type="button" onClick={addPlatform} className="mt-3 w-full h-12 rounded-[14px] font-black text-slate-950" style={{ background: 'linear-gradient(135deg,#fbbf24,#f59e0b)' }}>
                + إضافة المنصة
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-black text-slate-300 mb-2">{label}</span>
      {children}
    </label>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-[17px] px-2 py-3 text-center" style={{ background: 'rgba(255,255,255,.032)', border: '1px solid rgba(255,255,255,.06)' }}>
      <div className="w-7 h-7 rounded-[10px] flex items-center justify-center mx-auto text-amber-300" style={{ background: 'rgba(245,158,11,.08)' }}>
        {icon}
      </div>
      <div className="text-[17px] font-black text-white mt-1.5">{value}</div>
      <div className="text-[8px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
