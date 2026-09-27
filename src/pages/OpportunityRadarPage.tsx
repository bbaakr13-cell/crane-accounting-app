import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BellRing,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  ExternalLink,
  Filter,
  Flame,
  Loader2,
  Map,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Radar,
  RefreshCw,
  Search,
  Settings2,
  Star,
  Truck,
  X,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';

type RadarOpportunity = {
  id: string;
  title: string;
  company?: string;
  city?: string;
  region?: string;
  address?: string;
  category?: string;
  description?: string;
  phone?: string;
  whatsapp?: string;
  sourceName?: string;
  sourceUrl?: string;
  publishedAt?: string;
  discoveredAt?: string;
  score?: number;
  distanceKm?: number;
  latitude?: number;
  longitude?: number;
  reason?: string;
  services?: string[];
  status?: 'new' | 'viewed' | 'saved' | 'hidden';
};

type RadarSettings = {
  autoSearch: boolean;
  priorityCities: string[];
  services: string[];
};

const RADAR_STORAGE_KEY = 'bakr_pro_radar_opportunities_v1';
const RADAR_SETTINGS_KEY = 'bakr_pro_radar_settings_v1';
const CUSTOMER_OPPORTUNITIES_KEY = 'bakr_pro_customers_opportunities_v1';
const RADAR_SEARCH_TIMEOUT_MS = 45000;

const DEFAULT_SETTINGS: RadarSettings = {
  autoSearch: false,
  priorityCities: ['خميس مشيط', 'أبها', 'عسير'],
  services: ['كرينات', 'بوم ترك', 'ونش', 'دينا', 'رافعات'],
};

const DEFAULT_API =
  (import.meta as any)?.env?.VITE_OPPORTUNITY_RADAR_API_URL ||
  'https://jeevugyeptmbqkyruxdl.supabase.co/functions/v1';

function safeJson<T>(value: string | null, fallback: T): T {
  try {
    if (!value) return fallback;
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function sanitizeOpportunity(value: any): RadarOpportunity | null {
  if (!value || typeof value !== 'object') return null;

  const id = String(value.id || '').trim();
  const title = String(value.title || '').trim();
  if (!id || !title) return null;

  const services = Array.isArray(value.services)
    ? value.services.map((x: any) => String(x || '').trim()).filter(Boolean)
    : [];

  const status: RadarOpportunity['status'] =
    value.status === 'viewed' ||
    value.status === 'saved' ||
    value.status === 'hidden'
      ? value.status
      : 'new';

  const numberOrUndefined = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  return {
    id,
    title,
    company: String(value.company || ''),
    city: String(value.city || ''),
    region: String(value.region || ''),
    address: String(value.address || ''),
    category: String(value.category || ''),
    description: String(value.description || ''),
    phone: String(value.phone || ''),
    whatsapp: String(value.whatsapp || ''),
    sourceName: String(value.sourceName || ''),
    sourceUrl: String(value.sourceUrl || ''),
    publishedAt: String(value.publishedAt || ''),
    discoveredAt: String(value.discoveredAt || ''),
    score: numberOrUndefined(value.score),
    distanceKm: numberOrUndefined(value.distanceKm),
    latitude: numberOrUndefined(value.latitude),
    longitude: numberOrUndefined(value.longitude),
    reason: String(value.reason || ''),
    services,
    status,
  };
}

function sanitizeOpportunityList(value: any): RadarOpportunity[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(sanitizeOpportunity)
    .filter((item): item is RadarOpportunity => Boolean(item));
}

function normalizePhone(value?: string) {
  let phone = String(value || '').replace(/[^\d+]/g, '');
  if (phone.startsWith('00966')) phone = `+966${phone.slice(5)}`;
  if (phone.startsWith('05')) phone = `+966${phone.slice(1)}`;
  if (phone.startsWith('5') && phone.length === 9) phone = `+966${phone}`;
  return phone;
}

function displayDate(value?: string) {
  if (!value) return 'غير محدد';
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function scoreLabel(score = 0) {
  if (score >= 85) return 'فرصة ساخنة';
  if (score >= 70) return 'فرصة قوية';
  if (score >= 50) return 'فرصة محتملة';
  return 'للمراجعة';
}

function scoreTone(score = 0) {
  if (score >= 85) return {
    bg: 'rgba(239,68,68,.13)',
    border: 'rgba(248,113,113,.30)',
    color: '#fca5a5',
  };
  if (score >= 70) return {
    bg: 'rgba(34,197,94,.12)',
    border: 'rgba(74,222,128,.26)',
    color: '#86efac',
  };
  if (score >= 50) return {
    bg: 'rgba(245,158,11,.12)',
    border: 'rgba(251,191,36,.25)',
    color: '#fcd34d',
  };
  return {
    bg: 'rgba(96,165,250,.10)',
    border: 'rgba(96,165,250,.22)',
    color: '#93c5fd',
  };
}

function uniqueById(items: RadarOpportunity[]) {
  const map = new Map<string, RadarOpportunity>();
  for (const item of items) {
    if (!item?.id) continue;
    const current = map.get(item.id);
    map.set(item.id, current ? { ...current, ...item } : item);
  }
  return Array.from(map.values());
}

function queryForMap(item: RadarOpportunity) {
  return [
    item.address,
    item.city,
    item.region,
    item.company,
    item.title,
  ].filter(Boolean).join('، ');
}

function googleMapsUrl(item: RadarOpportunity) {
  if (
    typeof item.latitude === 'number' &&
    typeof item.longitude === 'number'
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryForMap(item))}`;
}

function osmEmbedUrl(item: RadarOpportunity) {
  if (
    typeof item.latitude !== 'number' ||
    typeof item.longitude !== 'number'
  ) {
    return '';
  }

  const lat = item.latitude;
  const lon = item.longitude;
  const delta = 0.018;
  const bbox = [
    lon - delta,
    lat - delta,
    lon + delta,
    lat + delta,
  ].join(',');

  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
    bbox
  )}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lon}`)}`;
}

function OpportunityRadarPageInner() {
  const [items, setItems] = useState<RadarOpportunity[]>(() => {
    const stored = safeJson<any>(
      localStorage.getItem(RADAR_STORAGE_KEY),
      []
    );
    return sanitizeOpportunityList(stored);
  });

  const [settings, setSettings] = useState<RadarSettings>(() => {
    const saved = safeJson<Partial<RadarSettings>>(
      localStorage.getItem(RADAR_SETTINGS_KEY),
      {}
    );

    return {
      autoSearch: false,
      priorityCities: Array.isArray(saved.priorityCities)
        ? saved.priorityCities.map(String).filter(Boolean)
        : DEFAULT_SETTINGS.priorityCities,
      services: Array.isArray(saved.services)
        ? saved.services.map(String).filter(Boolean)
        : DEFAULT_SETTINGS.services,
    };
  });

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'hot' | 'new' | 'near' | 'saved'>('all');
  const [loading, setLoading] = useState(false);
  const [lastSearchAt, setLastSearchAt] = useState('');
  const [error, setError] = useState('');
  const [mapItem, setMapItem] = useState<RadarOpportunity | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newService, setNewService] = useState('');
  const [newCity, setNewCity] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(RADAR_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Radar localStorage write failed', e);
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(RADAR_SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Radar settings write failed', e);
    }
  }, [settings]);

  async function refreshRadar(manual = false) {
    if (loading) return;

    setLoading(true);
    setError('');

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, RADAR_SEARCH_TIMEOUT_MS);

    try {
      const cities = Array.isArray(settings.priorityCities)
        ? settings.priorityCities.map(String).filter(Boolean)
        : [];

      const services = Array.isArray(settings.services)
        ? settings.services.map(String).filter(Boolean)
        : [];

      const params = new URLSearchParams({
        priority: cities.join(','),
        services: services.join(','),
        refresh: manual ? '1' : '0',
        limit: '100',
      });

      const endpoint = `${DEFAULT_API.replace(/\/$/, '')}/opportunities?${params.toString()}`;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Radar API ${response.status}`);
      }

      const rawText = await response.text();
      let data: any = {};

      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new Error('Radar API returned invalid JSON');
      }

      const rawItems = Array.isArray(data)
        ? data
        : Array.isArray(data?.opportunities)
          ? data.opportunities
          : [];

      const next = sanitizeOpportunityList(rawItems);

      // استبدال النتائج القديمة بدل دمج بيانات قديمة قد تكون تالفة.
      setItems(next);
      setLastSearchAt(String(data?.searchedAt || new Date().toISOString()));

      if (next.length === 0) {
        const accepted = Number(data?.scan?.acceptedCount ?? 0);
        const rejected = Number(data?.scan?.rejectedCount ?? 0);

        if (accepted === 0 && rejected > 0) {
          setError(`تم البحث بنجاح ولم توجد فرصة مطابقة الآن. تم استبعاد ${rejected} نتيجة غير مناسبة.`);
        }
      }
    } catch (e: any) {
      console.error('Radar search failed', e);

      if (e?.name === 'AbortError') {
        setError('استغرق البحث وقتاً أطول من المتوقع. حاول مرة أخرى.');
      } else {
        setError('تعذر إكمال البحث الآن. الصفحة ما زالت تعمل ويمكنك المحاولة مرة أخرى.');
      }
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  function addService() {
    const value = newService.trim();
    if (!value) return;

    const exists = settings.services.some(
      service => service.trim().toLowerCase() === value.toLowerCase()
    );

    if (exists) {
      alert('الخدمة موجودة مسبقاً');
      return;
    }

    setSettings(old => ({
      ...old,
      services: [...old.services, value],
    }));
    setNewService('');
  }

  function removeService(index: number) {
    setSettings(old => ({
      ...old,
      services: old.services.filter((_, i) => i !== index),
    }));
  }

  function addCity() {
    const value = newCity.trim();
    if (!value) return;

    const exists = settings.priorityCities.some(
      city => city.trim().toLowerCase() === value.toLowerCase()
    );

    if (exists) {
      alert('المدينة أو المنطقة موجودة مسبقاً');
      return;
    }

    setSettings(old => ({
      ...old,
      priorityCities: [...old.priorityCities, value],
    }));
    setNewCity('');
  }

  function removeCity(index: number) {
    setSettings(old => ({
      ...old,
      priorityCities: old.priorityCities.filter((_, i) => i !== index),
    }));
  }

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    return items
      .filter(item => item.status !== 'hidden')
      .filter(item => {
        if (filter === 'hot') return Number(item.score || 0) >= 85;
        if (filter === 'new') return (item.status || 'new') === 'new';
        if (filter === 'near') {
          return typeof item.distanceKm === 'number' && item.distanceKm <= 80;
        }
        if (filter === 'saved') return item.status === 'saved';
        return true;
      })
      .filter(item => {
        if (!q) return true;
        return [
          item.title,
          item.company,
          item.city,
          item.region,
          item.address,
          item.category,
          item.description,
          item.reason,
          ...(item.services || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
        if (scoreDiff) return scoreDiff;
        return String(b.discoveredAt || '').localeCompare(
          String(a.discoveredAt || '')
        );
      });
  }, [items, query, filter]);

  const stats = useMemo(() => {
    const active = items.filter(x => x.status !== 'hidden');
    return {
      total: active.length,
      hot: active.filter(x => Number(x.score || 0) >= 85).length,
      newCount: active.filter(x => (x.status || 'new') === 'new').length,
      near: active.filter(
        x => typeof x.distanceKm === 'number' && x.distanceKm <= 80
      ).length,
    };
  }, [items]);

  function updateItem(id: string, patch: Partial<RadarOpportunity>) {
    setItems(old =>
      old.map(item => item.id === id ? { ...item, ...patch } : item)
    );
  }

  function openPhone(item: RadarOpportunity) {
    const phone = normalizePhone(item.phone || item.whatsapp);
    if (!phone) return alert('لا يوجد رقم اتصال متاح لهذه الفرصة');
    window.location.href = `tel:${phone}`;
  }

  function openWhatsApp(item: RadarOpportunity) {
    const phone = normalizePhone(item.whatsapp || item.phone).replace('+', '');
    if (!phone) return alert('لا يوجد رقم واتساب متاح لهذه الفرصة');

    const text = [
      'السلام عليكم ورحمة الله وبركاته،',
      'نوفر خدمات تأجير الكرينات والبوم ترك والونش والدينا والرافعات،',
      item.title ? `وتواصلنا معكم بخصوص: ${item.title}` : '',
      item.city ? `الموقع: ${item.city}` : '',
      '',
      'جاهزون لخدمتكم وتنفيذ أعمال الرفع والنقل باحترافية وسرعة.',
    ].filter(Boolean).join('\n');

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
      '_blank'
    );
  }

  function saveToCustomers(item: RadarOpportunity) {
    const existing = safeJson<any[]>(
      localStorage.getItem(CUSTOMER_OPPORTUNITIES_KEY),
      []
    );

    const duplicate = existing.some(x =>
      (item.phone && normalizePhone(x?.phone) === normalizePhone(item.phone)) ||
      (item.company && String(x?.companyName || '').trim() === item.company.trim())
    );

    if (!duplicate) {
      const now = new Date().toISOString();

      existing.unshift({
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `radar-${Date.now()}`,
        customerName: '',
        companyName: item.company || item.title || 'فرصة من رادار الفرص',
        phone: normalizePhone(item.phone || item.whatsapp),
        city: item.city || item.region || '',
        projectLocation: item.address || item.city || '',
        workType: item.category || (item.services || []).join('، ') || item.title,
        quoteValue: 0,
        status: 'new',
        source: 'أخرى',
        lastContact: new Date().toISOString().slice(0, 10),
        nextFollowUp: '',
        notes: [
          'تمت إضافتها من رادار الفرص.',
          item.reason ? `سبب الترشيح: ${item.reason}` : '',
          item.sourceName ? `المصدر: ${item.sourceName}` : '',
          item.sourceUrl ? `الرابط: ${item.sourceUrl}` : '',
        ].filter(Boolean).join('\n'),
        createdAt: now,
        updatedAt: now,
      });

      localStorage.setItem(
        CUSTOMER_OPPORTUNITIES_KEY,
        JSON.stringify(existing)
      );
    }

    updateItem(item.id, { status: 'saved' });
    alert(
      duplicate
        ? 'الفرصة موجودة مسبقاً في العملاء والفرص'
        : 'تم حفظ الفرصة في العملاء والفرص'
    );
  }

  return (
    <AppLayout showBottomNav={false}>
      <div
        dir="rtl"
        className="min-h-screen pb-28"
        style={{
          background:
            'radial-gradient(circle at 50% -10%, rgba(14,165,233,.15), transparent 32%), linear-gradient(180deg,#07111f,#030813 75%)',
        }}
      >
        <div className="max-w-[760px] mx-auto px-3 pt-3">
          <section
            className="relative overflow-hidden rounded-[26px] p-5"
            style={{
              background:
                'linear-gradient(135deg,rgba(12,74,110,.92),rgba(7,23,42,.98) 60%,rgba(17,24,39,.99))',
              border: '1px solid rgba(56,189,248,.24)',
              boxShadow: '0 18px 44px rgba(0,0,0,.35)',
            }}
          >
            <div
              className="absolute -left-10 -top-12 w-44 h-44 rounded-full"
              style={{
                background: 'rgba(14,165,233,.11)',
                filter: 'blur(3px)',
              }}
            />

            <div className="relative flex items-start gap-3">
              <div
                className="w-14 h-14 rounded-[18px] grid place-items-center shrink-0"
                style={{
                  background: 'rgba(56,189,248,.12)',
                  border: '1px solid rgba(125,211,252,.24)',
                }}
              >
                <Radar className="w-8 h-8 text-sky-300" strokeWidth={1.8} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-[21px] font-black text-white">
                    رادار الفرص
                  </h1>

                  <span
                    className="px-2 py-1 rounded-full text-[9px] font-black"
                    style={{
                      background: settings.autoSearch
                        ? 'rgba(34,197,94,.13)'
                        : 'rgba(148,163,184,.12)',
                      border: settings.autoSearch
                        ? '1px solid rgba(74,222,128,.28)'
                        : '1px solid rgba(148,163,184,.20)',
                      color: settings.autoSearch ? '#86efac' : '#cbd5e1',
                    }}
                  >
                    {settings.autoSearch ? '● تلقائي' : 'متوقف'}
                  </span>
                </div>

                <p className="text-[11px] leading-6 text-slate-300 mt-1">
                  يبحث عن فرص الكرينات والبوم ترك والونش والدينا والرافعات،
                  مع أولوية لخميس مشيط وأبها وعسير ثم بقية المملكة.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="w-10 h-10 rounded-xl grid place-items-center active:scale-95"
                style={{
                  background: 'rgba(255,255,255,.06)',
                  border: '1px solid rgba(255,255,255,.10)',
                }}
                aria-label="إعدادات رادار الفرص"
              >
                <Settings2 className="w-5 h-5 text-slate-200" />
              </button>
            </div>

            <div className="relative mt-4 grid grid-cols-4 gap-2">
              <StatBox label="الكل" value={stats.total} icon={<BriefcaseBusiness className="w-4 h-4" />} />
              <StatBox label="ساخنة" value={stats.hot} icon={<Flame className="w-4 h-4" />} />
              <StatBox label="جديدة" value={stats.newCount} icon={<BellRing className="w-4 h-4" />} />
              <StatBox label="قريبة" value={stats.near} icon={<Navigation className="w-4 h-4" />} />
            </div>

            <div className="relative mt-4 flex gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => refreshRadar(true)}
                className="flex-1 h-12 rounded-[15px] font-black text-[13px] flex items-center justify-center gap-2 active:scale-[.98] disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg,#0ea5e9,#2563eb)',
                  color: '#fff',
                  boxShadow: '0 10px 24px rgba(37,99,235,.24)',
                }}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <RefreshCw className="w-5 h-5" />
                )}
                {loading ? 'جاري البحث...' : 'بحث الآن'}
              </button>

              <button
                type="button"
                onClick={() => setFilter('hot')}
                className="h-12 px-4 rounded-[15px] font-black text-[12px] flex items-center gap-2 active:scale-[.98]"
                style={{
                  background: 'rgba(239,68,68,.10)',
                  border: '1px solid rgba(248,113,113,.22)',
                  color: '#fecaca',
                }}
              >
                <Flame className="w-4 h-4" />
                الأقوى
              </button>
            </div>

            <div className="relative mt-3 text-[10px] text-slate-400 flex items-center gap-2">
              <Clock3 className="w-3.5 h-3.5" />
              آخر تحديث:{' '}
              {lastSearchAt ? displayDate(lastSearchAt) : 'لم يتم البحث بعد'}
            </div>
          </section>

          {error && (
            <div
              className="mt-3 rounded-[18px] px-4 py-3 text-[11px] leading-6"
              style={{
                background: 'rgba(245,158,11,.08)',
                border: '1px solid rgba(251,191,36,.18)',
                color: '#fde68a',
              }}
            >
              {error}
            </div>
          )}

          <section className="mt-4">
            <div
              className="h-12 rounded-[16px] flex items-center gap-2 px-3"
              style={{
                background: 'rgba(15,23,42,.82)',
                border: '1px solid rgba(148,163,184,.15)',
              }}
            >
              <Search className="w-5 h-5 text-slate-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="ابحث باسم المشروع، الشركة، المدينة، نوع العمل..."
                className="flex-1 bg-transparent outline-none text-[12px] text-white placeholder:text-slate-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="w-8 h-8 rounded-lg grid place-items-center"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              )}
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="كل الفرص" />
              <FilterChip active={filter === 'hot'} onClick={() => setFilter('hot')} label="ساخنة" />
              <FilterChip active={filter === 'new'} onClick={() => setFilter('new')} label="جديدة" />
              <FilterChip active={filter === 'near'} onClick={() => setFilter('near')} label="قريبة" />
              <FilterChip active={filter === 'saved'} onClick={() => setFilter('saved')} label="محفوظة" />
            </div>
          </section>

          <section className="mt-4 space-y-3">
            {visibleItems.length === 0 ? (
              <EmptyState apiReady={Boolean(DEFAULT_API)} />
            ) : (
              visibleItems.map(item => (
                <OpportunityCard
                  key={item.id}
                  item={item}
                  onMap={() => {
                    updateItem(item.id, { status: item.status === 'new' ? 'viewed' : item.status });
                    setMapItem(item);
                  }}
                  onPhone={() => openPhone(item)}
                  onWhatsApp={() => openWhatsApp(item)}
                  onSave={() => saveToCustomers(item)}
                  onOpenSource={() => {
                    if (!item.sourceUrl) {
                      alert('لا يوجد رابط مصدر متاح');
                      return;
                    }
                    window.open(item.sourceUrl, '_blank');
                  }}
                  onHide={() => updateItem(item.id, { status: 'hidden' })}
                />
              ))
            )}
          </section>
        </div>
      </div>

      {mapItem && (
        <div
          className="fixed inset-0 z-[10020] flex items-end sm:items-center justify-center p-3"
          style={{ background: 'rgba(2,6,23,.78)', backdropFilter: 'blur(7px)' }}
          onClick={() => setMapItem(null)}
        >
          <div
            dir="rtl"
            className="w-full max-w-[720px] rounded-[26px] overflow-hidden"
            style={{
              background: '#07111f',
              border: '1px solid rgba(125,211,252,.20)',
              boxShadow: '0 24px 70px rgba(0,0,0,.55)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 flex items-start gap-3">
              <div className="flex-1">
                <div className="text-[15px] font-black text-white">
                  {mapItem.title}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {[mapItem.company, mapItem.address || mapItem.city]
                    .filter(Boolean)
                    .join(' • ')}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMapItem(null)}
                className="w-10 h-10 rounded-xl grid place-items-center"
                style={{
                  background: 'rgba(255,255,255,.06)',
                  border: '1px solid rgba(255,255,255,.10)',
                }}
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {osmEmbedUrl(mapItem) ? (
              <iframe
                title="موقع الفرصة"
                src={osmEmbedUrl(mapItem)}
                className="w-full h-[310px] border-0"
                loading="lazy"
              />
            ) : (
              <div className="h-[230px] grid place-items-center px-6 text-center">
                <div>
                  <MapPin className="w-10 h-10 text-sky-300 mx-auto" />
                  <p className="text-[12px] text-slate-300 mt-3 leading-6">
                    الإحداثيات الدقيقة غير متوفرة في المصدر، لكن يمكن فتح
                    موقع المشروع بالاسم والعنوان على الخريطة.
                  </p>
                </div>
              </div>
            )}

            <div className="p-4">
              <button
                type="button"
                onClick={() => window.open(googleMapsUrl(mapItem), '_blank')}
                className="w-full h-12 rounded-[15px] font-black text-[13px] flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg,#0284c7,#2563eb)',
                  color: '#fff',
                }}
              >
                <Navigation className="w-5 h-5" />
                فتح الاتجاهات في الخريطة
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div
          className="fixed inset-0 z-[10030] flex items-end justify-center p-3"
          style={{ background: 'rgba(2,6,23,.78)', backdropFilter: 'blur(7px)' }}
          onClick={() => setSettingsOpen(false)}
        >
          <div
            dir="rtl"
            className="w-full max-w-[620px] rounded-[26px] p-5"
            style={{
              background: '#07111f',
              border: '1px solid rgba(148,163,184,.16)',
              boxShadow: '0 24px 70px rgba(0,0,0,.55)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <Settings2 className="w-6 h-6 text-sky-300" />
              <div className="flex-1">
                <div className="font-black text-white">إعدادات رادار الفرص</div>
                <div className="text-[10px] text-slate-400 mt-1">
                  اضبط الأولويات بدون تغيير بقية تطبيق BAKR PRO.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="w-9 h-9 grid place-items-center rounded-xl"
                style={{ background: 'rgba(255,255,255,.06)' }}
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div
              className="mt-5 rounded-[18px] p-4 flex items-center gap-3"
              style={{
                background: 'rgba(15,23,42,.72)',
                border: '1px solid rgba(148,163,184,.14)',
              }}
            >
              <div className="flex-1">
                <div className="text-[13px] font-black text-white">
                  البحث داخل التطبيق
                </div>
                <div className="text-[10px] text-slate-400 mt-1 leading-5">
                  البحث التلقائي عند فتح الصفحة متوقف مؤقتاً لمنع الشاشة السوداء. استخدم زر «بحث الآن».
                </div>
              </div>

              <span
                className="px-3 py-2 rounded-xl text-[10px] font-black"
                style={{
                  background: 'rgba(245,158,11,.10)',
                  border: '1px solid rgba(251,191,36,.18)',
                  color: '#fde68a',
                }}
              >
                يدوي حالياً
              </span>
            </div>

            <div className="mt-4">
              <div className="text-[11px] font-black text-slate-300 mb-2">
                أولوية البحث
              </div>

              <div className="flex gap-2 flex-wrap">
                {settings.priorityCities.map((city, index) => (
                  <div
                    key={`${city}-${index}`}
                    className="h-10 px-3 rounded-xl flex items-center gap-2"
                    style={{
                      background: 'rgba(14,165,233,.10)',
                      border: '1px solid rgba(56,189,248,.18)',
                      color: '#bae6fd',
                    }}
                  >
                    <span className="text-[11px] font-black">{city}</span>
                    <button
                      type="button"
                      onClick={() => removeCity(index)}
                      className="w-6 h-6 rounded-lg grid place-items-center active:scale-95"
                      style={{ background: 'rgba(239,68,68,.12)' }}
                      aria-label={`حذف ${city}`}
                    >
                      <X className="w-3.5 h-3.5 text-red-300" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={newCity}
                  onChange={e => setNewCity(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addCity();
                  }}
                  placeholder="أضف مدينة أو منطقة: تثليث، جدة، النماص..."
                  className="flex-1 min-w-0 h-12 rounded-xl px-3 text-[11px] text-white outline-none placeholder:text-slate-500"
                  style={{
                    background: 'rgba(15,23,42,.78)',
                    border: '1px solid rgba(56,189,248,.20)',
                  }}
                />
                <button
                  type="button"
                  onClick={addCity}
                  className="h-12 px-4 rounded-xl font-black text-[11px] text-white active:scale-95"
                  style={{ background: 'linear-gradient(135deg,#0ea5e9,#2563eb)' }}
                >
                  + إضافة
                </button>
              </div>

              <div className="text-[9px] text-slate-500 mt-2">
                المناطق التي تضيفها تُحفظ في إعدادات الرادار وتُرسل مع طلب البحث.
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[11px] font-black text-slate-300 mb-2">
                الخدمات المستهدفة
              </div>

              <div className="flex gap-2 flex-wrap">
                {settings.services.map((service, index) => (
                  <div
                    key={`${service}-${index}`}
                    className="h-10 px-3 rounded-xl flex items-center gap-2"
                    style={{
                      background: 'rgba(245,158,11,.09)',
                      border: '1px solid rgba(251,191,36,.16)',
                      color: '#fde68a',
                    }}
                  >
                    <span className="text-[11px] font-black">{service}</span>
                    <button
                      type="button"
                      onClick={() => removeService(index)}
                      className="w-6 h-6 rounded-lg grid place-items-center active:scale-95"
                      style={{ background: 'rgba(239,68,68,.12)' }}
                      aria-label={`حذف ${service}`}
                    >
                      <X className="w-3.5 h-3.5 text-red-300" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={newService}
                  onChange={e => setNewService(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addService();
                  }}
                  placeholder="أضف خدمة: كرين 25 طن، سطحة، معدات ثقيلة..."
                  className="flex-1 min-w-0 h-12 rounded-xl px-3 text-[11px] text-white outline-none placeholder:text-slate-500"
                  style={{
                    background: 'rgba(15,23,42,.78)',
                    border: '1px solid rgba(251,191,36,.18)',
                  }}
                />
                <button
                  type="button"
                  onClick={addService}
                  className="h-12 px-4 rounded-xl font-black text-[11px] text-white active:scale-95"
                  style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
                >
                  + إضافة
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="mt-5 w-full h-12 rounded-[15px] font-black text-white"
              style={{
                background: 'linear-gradient(135deg,#0ea5e9,#2563eb)',
              }}
            >
              حفظ
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

class RadarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error: any) {
    return {
      hasError: true,
      message: String(error?.message || error || 'خطأ غير معروف'),
    };
  }

  componentDidCatch(error: any, info: any) {
    console.error('OpportunityRadarPage crashed', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <AppLayout showBottomNav={false}>
          <div
            dir="rtl"
            className="min-h-screen p-4 flex items-center justify-center"
            style={{ background: '#030813' }}
          >
            <div
              className="w-full max-w-[620px] rounded-[24px] p-5 text-center"
              style={{
                background: 'rgba(15,23,42,.95)',
                border: '1px solid rgba(248,113,113,.25)',
              }}
            >
              <div className="text-white text-[17px] font-black">
                حصل خطأ داخل رادار الفرص
              </div>
              <div className="text-slate-400 text-[11px] mt-2 leading-6 break-words">
                {this.state.message}
              </div>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem(RADAR_STORAGE_KEY);
                  } catch {}
                  window.location.reload();
                }}
                className="mt-4 w-full h-12 rounded-[15px] text-white font-black"
                style={{ background: 'linear-gradient(135deg,#0ea5e9,#2563eb)' }}
              >
                تنظيف بيانات الرادار وإعادة الفتح
              </button>
            </div>
          </div>
        </AppLayout>
      );
    }

    return this.props.children;
  }
}

export function OpportunityRadarPage() {
  return (
    <RadarErrorBoundary>
      <OpportunityRadarPageInner />
    </RadarErrorBoundary>
  );
}

function StatBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="rounded-[15px] px-2 py-3 text-center"
      style={{
        background: 'rgba(2,6,23,.34)',
        border: '1px solid rgba(255,255,255,.08)',
      }}
    >
      <div className="flex items-center justify-center gap-1 text-sky-300">
        {icon}
        <span className="text-[9px] font-bold">{label}</span>
      </div>
      <div className="text-[20px] font-black text-white mt-1">{value}</div>
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 px-4 h-10 rounded-[13px] text-[11px] font-black"
      style={{
        background: active ? 'rgba(14,165,233,.17)' : 'rgba(15,23,42,.70)',
        border: active
          ? '1px solid rgba(56,189,248,.34)'
          : '1px solid rgba(148,163,184,.12)',
        color: active ? '#bae6fd' : '#94a3b8',
      }}
    >
      {label}
    </button>
  );
}

function OpportunityCard({
  item,
  onMap,
  onPhone,
  onWhatsApp,
  onSave,
  onOpenSource,
  onHide,
}: {
  item: RadarOpportunity;
  onMap: () => void;
  onPhone: () => void;
  onWhatsApp: () => void;
  onSave: () => void;
  onOpenSource: () => void;
  onHide: () => void;
}) {
  const score = Number(item.score || 0);
  const tone = scoreTone(score);

  return (
    <article
      className="rounded-[22px] p-4"
      style={{
        background:
          'linear-gradient(145deg,rgba(15,23,42,.91),rgba(7,17,31,.97))',
        border: '1px solid rgba(148,163,184,.13)',
        boxShadow: '0 12px 30px rgba(0,0,0,.18)',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-[16px] grid place-items-center shrink-0"
          style={{
            background: tone.bg,
            border: `1px solid ${tone.border}`,
            color: tone.color,
          }}
        >
          {score >= 85 ? (
            <Flame className="w-6 h-6" />
          ) : (
            <Building2 className="w-6 h-6" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[14px] font-black text-white leading-6">
              {item.title}
            </h3>
            <span
              className="px-2 py-1 rounded-full text-[9px] font-black"
              style={{
                background: tone.bg,
                border: `1px solid ${tone.border}`,
                color: tone.color,
              }}
            >
              {scoreLabel(score)} {score ? `• ${score}%` : ''}
            </span>
          </div>

          {item.company && (
            <div className="text-[11px] text-slate-300 mt-1 font-bold">
              {item.company}
            </div>
          )}

          <div className="mt-2 flex gap-2 flex-wrap text-[10px] text-slate-400">
            {(item.city || item.region) && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-sky-400" />
                {[item.city, item.region].filter(Boolean).join('، ')}
              </span>
            )}

            {typeof item.distanceKm === 'number' && (
              <span className="flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                {item.distanceKm.toFixed(0)} كم
              </span>
            )}

            {item.category && (
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-amber-400" />
                {item.category}
              </span>
            )}
          </div>
        </div>
      </div>

      {(item.reason || item.description) && (
        <div
          className="mt-3 rounded-[15px] px-3 py-3 text-[10px] leading-6 text-slate-300"
          style={{
            background: 'rgba(2,6,23,.30)',
            border: '1px solid rgba(148,163,184,.08)',
          }}
        >
          {item.reason && (
            <div>
              <span className="font-black text-sky-300">لماذا فرصة مناسبة؟ </span>
              {item.reason}
            </div>
          )}
          {item.description && (
            <div className={item.reason ? 'mt-1' : ''}>
              {item.description}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-4 gap-2">
        <MiniAction label="الخريطة" icon={<Map className="w-4 h-4" />} onClick={onMap} />
        <MiniAction label="اتصال" icon={<Phone className="w-4 h-4" />} onClick={onPhone} />
        <MiniAction label="واتساب" icon={<MessageCircle className="w-4 h-4" />} onClick={onWhatsApp} />
        <MiniAction
          label={item.status === 'saved' ? 'محفوظة' : 'حفظ'}
          icon={
            item.status === 'saved'
              ? <CheckCircle2 className="w-4 h-4" />
              : <Star className="w-4 h-4" />
          }
          onClick={onSave}
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSource}
          className="flex-1 h-10 rounded-[12px] px-3 flex items-center justify-between text-[10px] font-bold"
          style={{
            background: 'rgba(30,41,59,.55)',
            border: '1px solid rgba(148,163,184,.10)',
            color: '#cbd5e1',
          }}
        >
          <span className="truncate">
            المصدر: {item.sourceName || 'غير محدد'}
          </span>
          <ExternalLink className="w-4 h-4 shrink-0" />
        </button>

        <button
          type="button"
          onClick={onHide}
          className="h-10 px-3 rounded-[12px] text-[10px] font-bold text-slate-400"
          style={{
            background: 'rgba(30,41,59,.40)',
            border: '1px solid rgba(148,163,184,.08)',
          }}
        >
          إخفاء
        </button>
      </div>

      <div className="mt-2 text-[9px] text-slate-500">
        اكتشفها الرادار: {displayDate(item.discoveredAt || item.publishedAt)}
      </div>
    </article>
  );
}

function MiniAction({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-11 rounded-[13px] flex flex-col items-center justify-center gap-0.5 active:scale-95"
      style={{
        background: 'rgba(14,165,233,.08)',
        border: '1px solid rgba(56,189,248,.13)',
        color: '#bae6fd',
      }}
    >
      {icon}
      <span className="text-[9px] font-black">{label}</span>
    </button>
  );
}

function EmptyState({ apiReady }: { apiReady: boolean }) {
  return (
    <div
      className="rounded-[24px] p-8 text-center"
      style={{
        background: 'rgba(15,23,42,.72)',
        border: '1px dashed rgba(148,163,184,.20)',
      }}
    >
      <div
        className="w-20 h-20 rounded-full mx-auto grid place-items-center"
        style={{
          background: 'rgba(14,165,233,.08)',
          border: '1px solid rgba(56,189,248,.15)',
        }}
      >
        <Radar className="w-10 h-10 text-sky-300" />
      </div>

      <div className="text-[15px] font-black text-white mt-4">
        {apiReady ? 'لا توجد فرص مطابقة الآن' : 'واجهة الرادار جاهزة'}
      </div>

      <p className="text-[11px] text-slate-400 leading-6 mt-2">
        {apiReady
          ? 'اضغط «بحث الآن» أو غيّر الفلتر لعرض النتائج المحفوظة.'
          : 'محرك البحث السحابي مربوط. البحث التلقائي بالخادم سنفعّله بعد اختبار الربط داخل التطبيق.'}
      </p>
    </div>
  );
}
