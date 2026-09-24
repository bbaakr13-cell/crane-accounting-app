import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  Truck,
  Plus,
  Receipt,
  Image as ImageIcon,
  ChevronLeft,
  Bot,
  Sparkles,
  Search,
  X,
  Activity,
  LockKeyhole,
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';

import { AppLayout } from '@/components/layout/AppLayout';

import {
  TransactionItem,
  type Transaction,
} from '@/components/dashboard/TransactionItem';

import { formatSAR } from '@/lib/format';

import {
  fetchDashboardTotals,
  fetchAllTransactions,
  type DashboardTotals,
} from '@/lib/transactions';

const DASHBOARD_IMAGE_KEY =
  'baakr_pro_dashboard_image';

type ActionTone =
  | 'green'
  | 'red'
  | 'blue'
  | 'gold'
  | 'orange'
  | 'purple';

type ActionItem = {
  label: string;
  image: string;
  path: string;
  tone: ActionTone;
};

type SearchResult = {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  searchText: string;
  path: string;
};

const tones: Record<
  ActionTone,
  {
    background: string;
    color: string;
  }
> = {
  green: {
    background: 'rgba(34,197,94,0.11)',
    color: '#4ade80',
  },

  red: {
    background: 'rgba(239,68,68,0.11)',
    color: '#fb7185',
  },

  blue: {
    background: 'rgba(59,130,246,0.12)',
    color: '#60a5fa',
  },

  gold: {
    background: 'rgba(245,158,11,0.12)',
    color: '#fbbf24',
  },

  orange: {
    background: 'rgba(249,115,22,0.12)',
    color: '#fb923c',
  },

  purple: {
    background: 'rgba(168,85,247,0.12)',
    color: '#c084fc',
  },
};

function normalizeSearch(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function textFromObject(value: unknown) {
  try {
    if (typeof value === 'string') {
      return value;
    }

    return JSON.stringify(value);
  } catch {
    return String(value ?? '');
  }
}

function firstValue(
  object: Record<string, any>,
  keys: string[]
) {
  for (const key of keys) {
    const value = object?.[key];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ''
    ) {
      return String(value);
    }
  }

  return '';
}

function detectCategory(key: string) {
  const k = key.toLowerCase();

  if (
    k.includes('opportunit') ||
    k.includes('lead') ||
    k.includes('فرص') ||
    k.includes('bakr_pro_customers_opportunities')
  ) {
    return {
      category: 'العملاء والفرص',
      path: '/customers-opportunities',
    };
  }

  if (
    k.includes('customer') ||
    k.includes('client') ||
    k.includes('عميل')
  ) {
    return {
      category: 'العملاء',
      path: '/customers',
    };
  }

  if (
    k.includes('invoice') ||
    k.includes('فاتور')
  ) {
    return {
      category: 'الفواتير',
      path: '/invoices',
    };
  }

  if (
    k.includes('partner') ||
    k.includes('شريك')
  ) {
    return {
      category: 'حساب الشركاء',
      path: '/partners',
    };
  }

  if (
    k.includes('equipment') ||
    k.includes('crane') ||
    k.includes('truck') ||
    k.includes('machine') ||
    k.includes('كرين') ||
    k.includes('معدات')
  ) {
    return {
      category: 'المعدات',
      path: '/equipment',
    };
  }

  if (
    k.includes('driver') ||
    k.includes('operator') ||
    k.includes('سواق') ||
    k.includes('مشغل')
  ) {
    return {
      category: 'السواقين والمشغلين',
      path: '/drivers',
    };
  }

  if (
    k.includes('transaction') ||
    k.includes('income') ||
    k.includes('expense') ||
    k.includes('دخل') ||
    k.includes('مصروف')
  ) {
    return {
      category: 'الحركات المالية',
      path: '/transactions',
    };
  }

  if (
    k.includes('monthly') ||
    k.includes('month')
  ) {
    return {
      category: 'الحساب الشهري',
      path: '/monthly',
    };
  }

  return {
    category: 'بيانات أخرى',
    path: '/',
  };
}

function buildLocalSearchItems(): SearchResult[] {
  const results: SearchResult[] = [];

  try {
    for (
      let storageIndex = 0;
      storageIndex < localStorage.length;
      storageIndex += 1
    ) {
      const key = localStorage.key(storageIndex);

      if (!key) continue;

      const raw = localStorage.getItem(key);

      if (!raw || raw.length > 2_000_000) {
        continue;
      }

      let parsed: any;

      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }

      const info = detectCategory(key);

      const records = Array.isArray(parsed)
        ? parsed
        : parsed &&
            typeof parsed === 'object'
          ? [parsed]
          : [];

      records.slice(0, 300).forEach(
        (record: any, index: number) => {
          if (
            !record ||
            typeof record !== 'object'
          ) {
            return;
          }

          const title =
            firstValue(record, [
              'name',
              'customerName',
              'companyName',
              'clientName',
              'partnerName',
              'driverName',
              'operatorName',
              'equipmentName',
              'equipment',
              'craneName',
              'invoiceNumber',
              'invoiceNo',
              'number',
              'title',
              'description',
              'phone',
            ]) ||
            `${info.category} ${index + 1}`;

          const phone = firstValue(record, [
            'phone',
            'mobile',
            'phoneNumber',
            'customerPhone',
          ]);

          const description = firstValue(
            record,
            [
              'description',
              'workType',
              'projectLocation',
              'city',
              'notes',
              'note',
              'equipment',
              'type',
              'category',
              'date',
            ]
          );

          const subtitle = [
            phone,
            description,
          ]
            .filter(Boolean)
            .join(' • ');

          results.push({
            id: `local-${key}-${index}`,
            category: info.category,
            title,
            subtitle,
            searchText: normalizeSearch(
              `${key} ${textFromObject(record)}`
            ),
            path: info.path,
          });
        }
      );
    }
  } catch (error) {
    console.error(
      'Local search error:',
      error
    );
  }

  return results;
}

function buildTransactionSearchItems(
  transactions: Transaction[]
): SearchResult[] {
  return transactions.map(
    (tx: any, index) => {
      const data =
        tx?.data &&
        typeof tx.data === 'object'
          ? tx.data
          : tx;

      const title =
        firstValue(data, [
          'customerName',
          'name',
          'description',
          'title',
          'equipment',
          'category',
          'type',
        ]) || `حركة مالية ${index + 1}`;

      const amount = firstValue(data, [
        'amount',
        'total',
        'value',
        'price',
      ]);

      const date = firstValue(data, [
        'date',
        'createdAt',
        'created_at',
      ]);

      const subtitle = [
        amount ? `${amount} ر.س` : '',
        date,
      ]
        .filter(Boolean)
        .join(' • ');

      return {
        id: `tx-${data?.id ?? index}`,
        category: 'الحركات المالية',
        title,
        subtitle,
        searchText: normalizeSearch(
          textFromObject(tx)
        ),
        path: '/transactions',
      };
    }
  );
}

export function DashboardPage() {
  const navigate = useNavigate();

  const [totals, setTotals] =
    useState<DashboardTotals>({
      totalIncome: 0,
      totalExpenses: 0,
      netProfit: 0,
      receivables: 0,
    });

  const [recentTxs, setRecentTxs] =
    useState<Transaction[]>([]);

  const [allTxs, setAllTxs] =
    useState<Transaction[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [heroImage, setHeroImage] =
    useState('');

  const [searchQuery, setSearchQuery] =
    useState('');

  const [searchOpen, setSearchOpen] =
    useState(false);

  const [
    localSearchItems,
    setLocalSearchItems,
  ] = useState<SearchResult[]>([]);

  const load = useCallback(async () => {
    try {
      const [t, txs] = await Promise.all([
        fetchDashboardTotals(),
        fetchAllTransactions(),
      ]);

      setTotals(t);
      setAllTxs(txs);
      setRecentTxs(txs.slice(0, 5));
    } catch (error) {
      console.error(
        'Dashboard load error:',
        error
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSearchData =
    useCallback(() => {
      setLocalSearchItems(
        buildLocalSearchItems()
      );
    }, []);

  const loadHeroImage =
    useCallback(() => {
      try {
        const savedImage =
          localStorage.getItem(
            DASHBOARD_IMAGE_KEY
          ) || '';

        setHeroImage(savedImage);
      } catch (error) {
        console.error(
          'Dashboard image load error:',
          error
        );

        setHeroImage('');
      }
    }, []);

  useEffect(() => {
    load();
    loadHeroImage();
    refreshSearchData();

    const handleStorage = () => {
      loadHeroImage();
      refreshSearchData();
    };

    const handleFocus = () => {
      loadHeroImage();
      refreshSearchData();
      load();
    };

    window.addEventListener(
      'storage',
      handleStorage
    );

    window.addEventListener(
      'focus',
      handleFocus
    );

    return () => {
      window.removeEventListener(
        'storage',
        handleStorage
      );

      window.removeEventListener(
        'focus',
        handleFocus
      );
    };
  }, [
    load,
    loadHeroImage,
    refreshSearchData,
  ]);

  const transactionSearchItems =
    useMemo(
      () =>
        buildTransactionSearchItems(
          allTxs
        ),
      [allTxs]
    );

  const searchResults = useMemo(() => {
    const query =
      normalizeSearch(searchQuery);

    if (query.length < 1) {
      return [];
    }

    const words = query
      .split(' ')
      .filter(Boolean);

    const allItems = [
      ...transactionSearchItems,
      ...localSearchItems,
    ];

    const unique =
      new Map<string, SearchResult>();

    allItems.forEach((item) => {
      if (!unique.has(item.id)) {
        unique.set(item.id, item);
      }
    });

    return Array.from(unique.values())
      .filter((item) => {
        return words.every((word) =>
          item.searchText.includes(word)
        );
      })
      .slice(0, 50);
  }, [
    searchQuery,
    localSearchItems,
    transactionSearchItems,
  ]);

  const groupedSearchResults =
    useMemo(() => {
      const groups: Record<
        string,
        SearchResult[]
      > = {};

      searchResults.forEach((item) => {
        if (!groups[item.category]) {
          groups[item.category] = [];
        }

        groups[item.category].push(item);
      });

      return groups;
    }, [searchResults]);

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery('');
  }

  function openSearch() {
    refreshSearchData();
    setSearchOpen(true);
  }

  function openSearchResult(
    item: SearchResult
  ) {
    closeSearch();

    if (item.path === '/') {
      return;
    }

    navigate(item.path);
  }

  const liveSummary = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayKey = `${y}-${m}-${d}`;
    let trips = 0;
    let income = 0;
    let expenses = 0;

    allTxs.forEach((tx: any) => {
      const data = tx?.data && typeof tx.data === 'object' ? tx.data : tx;
      const date = String(data?.date || data?.createdAt || data?.created_at || '');
      if (!date.startsWith(todayKey)) return;
      const amount = Number(data?.amount ?? data?.total ?? data?.value ?? data?.price ?? 0) || 0;
      const kind = normalizeSearch(`${data?.type || ''} ${data?.category || ''} ${data?.transactionType || ''}`);
      if (kind.includes('مصروف') || kind.includes('expense')) expenses += amount;
      else { income += amount; trips += 1; }
    });

    return { trips, income, expenses, net: income - expenses };
  }, [allTxs]);

  const [dayClosed, setDayClosed] = useState(() => {
    try {
      const now = new Date();
      const key = `baakr-live-closed-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      return Boolean(localStorage.getItem(key));
    } catch { return false; }
  });

  function toggleDayClose() {
    const now = new Date();
    const key = `baakr-live-closed-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    if (dayClosed) {
      if (!window.confirm('فتح يوم العمل مرة أخرى؟')) return;
      localStorage.removeItem(key);
      setDayClosed(false);
      return;
    }
    if (!window.confirm(`إنهاء يوم العمل؟\nالمشاوير: ${liveSummary.trips}\nالدخل: ${formatSAR(liveSummary.income)}\nالمصروفات: ${formatSAR(liveSummary.expenses)}\nالصافي: ${formatSAR(liveSummary.net)}`)) return;
    localStorage.setItem(key, JSON.stringify({ closedAt: new Date().toISOString(), ...liveSummary }));
    setDayClosed(true);
  }

  const actions: ActionItem[] = [
    {
      label: 'BAKR AI',
      image: '/icons/bakr-ai.png',
      path: '/ai',
      tone: 'purple',
    },
    {
      label: 'إضافة دخل',
      image: '/icons/monthly-account.png',
      path: '/add',
      tone: 'green',
    },
    {
      label: 'إضافة مصروف',
      image: '/icons/operating-expenses.png',
      path: '/add',
      tone: 'red',
    },
    {
      label: 'العملاء',
      image: '/icons/customers.png',
      path: '/customers',
      tone: 'blue',
    },
    {
      label: 'العملاء والفرص',
      image: '/icons/customers.png',
      path: '/customers-opportunities',
      tone: 'green',
    },
    {
      label: 'المعدات',
      image: '/icons/equipment.png',
      path: '/equipment',
      tone: 'gold',
    },
    {
      label: 'مستندات الكرين والمشغل',
      image: '/icons/equipment-documents.png',
      path: '/equipment-documents',
      tone: 'blue',
    },
    {
      label: 'حساب المصاريف',
      image: '/icons/operating-expenses.png',
      path: '/expenses',
      tone: 'orange',
    },
    {
      label: 'مشاوير يومية',
      image: '/icons/daily-trips.png',
      path: '/daily-trips',
      tone: 'green',
    },
    {
      label: 'الحساب الشهري',
      image: '/icons/monthly-account.png',
      path: '/monthly',
      tone: 'orange',
    },

    {
      label: 'حساب الشركاء',
      image: '/icons/partners.png',
      path: '/partners',
      tone: 'blue',
    },

    {
      label: 'التأجير الشهري',
      image: '/icons/monthly-rental.png',
      path: '/monthly-rental',
      tone: 'purple',
    },
    {
      label: 'السواقين والمشغلين',
      image:
        '/icons/drivers-operators.png',
      path: '/drivers',
      tone: 'gold',
    },
    {
      label:
        'مصاريف السواقين والمعدات',
      image:
        '/icons/operating-expenses.png',
      path: '/operating-expenses',
      tone: 'red',
    },
    {
      label: 'التقارير',
      image: '/icons/reports.png',
      path: '/reports',
      tone: 'blue',
    },
    {
      label: 'الفواتير',
      image: '/icons/invoices.png',
      path: '/invoices',
      tone: 'purple',
    },
    {
      label: 'فاتورة عمل',
      image: '/icons/work-invoice.png',
      path: '/work-invoice',
      tone: 'blue',
    },
    {
      label: 'عرض سعر',
      image: '/icons/quotation.png',
      path: '/quotation',
      tone: 'green',
    },
    {
      label: 'حساب اليوم',
      image:
        '/icons/daily-calculator.png',
      path: '/daily-calculator',
      tone: 'gold',
    },
    {
      label: 'الحاسبة',
      image: '/icons/calculator.png',
      path: '/calculator',
      tone: 'purple',
    },
    {
      label: 'الإعدادات',
      image: '/icons/settings.png',
      path: '/settings',
      tone: 'red',
    },
    {
      label: 'سلة المحذوفات',
      image: '/icons/recycle-bin.svg',
      path: '/recycle-bin',
      tone: 'red',
    },
    {
      label: 'النسخ الاحتياطي',
      image: '/icons/backup.png',
      path: '/backup',
      tone: 'blue',
    },
  ];

  return (
    <AppLayout>
      <div dir="rtl" className="w-full">
        <section className="mb-4">
          <div
            className="relative overflow-hidden rounded-[25px] w-full"
            style={{
              aspectRatio: '16 / 7',
              border:
                '1px solid rgba(255,255,255,0.09)',
              boxShadow:
                '0 14px 35px rgba(0,0,0,0.28)',
              background:
                'linear-gradient(135deg,#15243b,#081321)',
            }}
          >
            {heroImage ? (
              <img
                src={heroImage}
                alt="صورة واجهة BAKR PRO"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-end px-5"
                style={{
                  background:
                    'radial-gradient(circle at left, rgba(245,158,11,0.18), transparent 45%), linear-gradient(135deg,#17263b,#07111e)',
                }}
              >
                <Truck
                  className="w-24 h-24 text-amber-400/20"
                  strokeWidth={1}
                />
              </div>
            )}

            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(90deg, rgba(3,8,17,0.22) 0%, rgba(3,8,17,0.50) 48%, rgba(3,8,17,0.94) 100%)',
              }}
            />

            <div className="absolute inset-0 p-5 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold text-amber-400 tracking-[0.16em]">
                  BAKR PRO
                </p>

                <h2 className="text-[21px] font-black text-white mt-1">
                  إدارة حسابات الكرينات
                </h2>

                <p className="text-[11px] text-slate-300 mt-1">
                  دقة • سرعة • احترافية
                </p>
              </div>

              <div className="flex items-end justify-between">
                <div className="flex gap-2">
                  <div className="px-2.5 py-1.5 rounded-xl bg-black/35 border border-white/10 text-[9px] text-slate-200">
                    🔒 آمن
                  </div>

                  <div className="px-2.5 py-1.5 rounded-xl bg-black/35 border border-white/10 text-[9px] text-slate-200">
                    ⚡ سريع
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate('/settings')
                  }
                  className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center active:scale-95"
                  aria-label="تغيير صورة الواجهة"
                >
                  <ImageIcon className="w-5 h-5 text-amber-400" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-5">
          <button
            type="button"
            onClick={openSearch}
            className="w-full rounded-[19px] px-4 h-[58px] flex items-center gap-3 text-right active:scale-[0.99] transition-transform"
            style={{
              background:
                'linear-gradient(145deg,rgba(15,29,49,0.96),rgba(7,17,31,0.98))',
              border:
                '1px solid rgba(245,158,11,0.18)',
              boxShadow:
                '0 8px 24px rgba(0,0,0,0.17)',
            }}
          >
            <div className="w-10 h-10 rounded-[13px] bg-amber-500/10 flex items-center justify-center shrink-0">
              <Search className="w-5 h-5 text-amber-400" />
            </div>

            <div className="flex-1">
              <p className="text-[12px] font-black text-white">
                البحث الشامل
              </p>

              <p className="text-[9px] text-slate-500 mt-0.5">
                عميل • فرصة • فاتورة • كرين • سائق • مبلغ • جوال
              </p>
            </div>

            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </button>
        </section>

        <section className="mb-5">
          <button
            type="button"
            onClick={() => navigate('/ai')}
            className="relative w-full overflow-hidden rounded-[22px] p-4 text-right active:scale-[0.98] transition-transform"
            style={{
              background:
                'linear-gradient(135deg, rgba(88,28,135,0.92), rgba(76,29,149,0.72), rgba(17,24,39,0.96))',
              border:
                '1px solid rgba(192,132,252,0.24)',
              boxShadow:
                '0 12px 30px rgba(88,28,135,0.20)',
            }}
          >
            <div className="relative flex items-center gap-3">
              <div
                className="w-14 h-14 shrink-0 rounded-[18px] flex items-center justify-center"
                style={{
                  background:
                    'linear-gradient(135deg,rgba(168,85,247,0.28),rgba(124,58,237,0.14))',
                  border:
                    '1px solid rgba(216,180,254,0.20)',
                }}
              >
                <Bot className="w-8 h-8 text-purple-300" />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-[16px] font-black text-white">
                    BAKR AI
                  </h2>

                  <Sparkles className="w-4 h-4 text-purple-300" />
                </div>

                <p className="text-[11px] text-purple-100/80 mt-1">
                  مساعدك الذكي لإدارة الحسابات والكرينات
                </p>

                <p className="text-[9px] text-purple-200/60 mt-1">
                  اسأل عن الدخل • الأرباح • المستحقات • التقارير
                </p>
              </div>

              <ChevronLeft className="w-5 h-5 text-purple-300" />
            </div>
          </button>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-black text-white">
              نظرة عامة
            </h2>

            <span className="text-[10px] text-slate-500">
              الحسابات الحالية
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MoneyCard
              label="إجمالي الدخل"
              value={formatSAR(
                totals.totalIncome
              )}
              icon={TrendingUp}
              color="#4ade80"
              bg="rgba(34,197,94,0.10)"
              border="rgba(34,197,94,0.17)"
              onClick={() =>
                navigate('/transactions')
              }
            />

            <MoneyCard
              label="إجمالي المصروفات"
              value={formatSAR(
                totals.totalExpenses
              )}
              icon={TrendingDown}
              color="#fb7185"
              bg="rgba(239,68,68,0.10)"
              border="rgba(239,68,68,0.17)"
              onClick={() =>
                navigate('/transactions')
              }
            />

            <MoneyCard
              label="صافي الربح"
              value={formatSAR(
                totals.netProfit
              )}
              icon={Wallet}
              color="#60a5fa"
              bg="rgba(59,130,246,0.10)"
              border="rgba(59,130,246,0.17)"
              onClick={() =>
                navigate('/reports')
              }
            />

            <MoneyCard
              label="المستحقات"
              value={formatSAR(
                totals.receivables
              )}
              icon={Clock}
              color="#fb923c"
              bg="rgba(249,115,22,0.10)"
              border="rgba(249,115,22,0.17)"
              onClick={() =>
                navigate('/customers')
              }
            />
          </div>
        </section>

        <section className="mt-5">
          <button
            type="button"
            onClick={() => navigate('/customers-opportunities')}
            className="w-full rounded-[22px] p-4 text-right active:scale-[0.98] transition-transform"
            style={{
              background:
                'linear-gradient(135deg,rgba(16,85,65,.92),rgba(11,35,49,.98))',
              border:
                '1px solid rgba(74,222,128,.22)',
              boxShadow:
                '0 12px 30px rgba(0,0,0,.18)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-[18px] overflow-hidden shrink-0"
                style={{
                  background: 'rgba(34,197,94,.10)',
                  border: '1px solid rgba(74,222,128,.20)',
                }}
              >
                <img
                  src="/icons/customers.png"
                  alt="العملاء والفرص"
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              </div>

              <div className="flex-1">
                <h2 className="text-[15px] font-black text-white">
                  العملاء والفرص
                </h2>

                <p className="text-[10px] text-emerald-100/75 mt-1">
                  تابع العملاء • عروض السعر • المشاريع • المتابعة القادمة
                </p>
              </div>

              <ChevronLeft className="w-5 h-5 text-emerald-300" />
            </div>
          </button>
        </section>

        <section className="mt-5">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                navigate('/daily-trips')
              }
              className="relative w-full overflow-hidden rounded-[20px] active:scale-[0.97] transition-transform"
              style={{
                aspectRatio: '2.25 / 1',
                border:
                  '1px solid rgba(34,197,94,0.30)',
                background: '#07131f',
              }}
            >
              <img
                src="/icons/daily-trips-3d.png"
                alt="مشاوير يومية"
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false}
              />
            </button>

            <button
              type="button"
              onClick={() =>
                navigate(
                  '/operating-expenses'
                )
              }
              className="relative w-full overflow-hidden rounded-[20px] active:scale-[0.97] transition-transform"
              style={{
                aspectRatio: '2.25 / 1',
                border:
                  '1px solid rgba(239,68,68,0.32)',
                background: '#07131f',
              }}
            >
              <img
                src="/icons/operating-expenses-3d.png"
                alt="مصاريف السواقين والمعدات"
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false}
              />
            </button>
          </div>
        </section>

        <section className="mt-5">
          <div className="rounded-[25px] p-4" style={{background:'linear-gradient(145deg,rgba(8,28,43,.98),rgba(5,14,27,.99))',border:'1px solid rgba(34,197,94,.20)',boxShadow:'0 14px 34px rgba(0,0,0,.22)'}}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-[13px] bg-emerald-500/10 border border-emerald-400/15 flex items-center justify-center"><Activity className="w-5 h-5 text-emerald-400" /></div>
                <div><div className="flex items-center gap-2"><h2 className="text-[16px] font-black text-white">BAKR LIVE</h2><span className="text-[8px] font-black text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-500/10">مباشر</span></div><p className="text-[9px] text-slate-500 mt-0.5">مركز اليوم والتشغيل</p></div>
              </div>
              <span className="text-[9px] text-slate-500">اليوم</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mt-4">
              {[
                ['مشاوير اليوم', String(liveSummary.trips), '#60a5fa'],
                ['دخل اليوم', formatSAR(liveSummary.income), '#4ade80'],
                ['مصروف اليوم', formatSAR(liveSummary.expenses), '#fb7185'],
                ['صافي اليوم', formatSAR(liveSummary.net), liveSummary.net >= 0 ? '#fbbf24' : '#fb7185'],
              ].map(([label,value,color]) => (
                <div key={label} className="rounded-[16px] p-3 min-h-[78px]" style={{background:'rgba(255,255,255,.028)',border:'1px solid rgba(255,255,255,.055)'}}>
                  <p className="text-[9px] text-slate-500">{label}</p>
                  <p className="text-[13px] font-black mt-3 truncate" style={{color}}>{value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3">
              <button type="button" onClick={() => navigate('/daily-trips')} className="h-[46px] rounded-[14px] text-[10px] font-black text-emerald-300 bg-emerald-500/10 border border-emerald-400/15 active:scale-95">+ مشوار</button>
              <button type="button" onClick={() => navigate('/operating-expenses')} className="h-[46px] rounded-[14px] text-[10px] font-black text-rose-300 bg-rose-500/10 border border-rose-400/15 active:scale-95">+ مصروف</button>
              <button type="button" onClick={toggleDayClose} className="h-[46px] rounded-[14px] flex items-center justify-center gap-1 text-[10px] font-black active:scale-95" style={{color:dayClosed?'#86efac':'#fde68a',background:dayClosed?'rgba(34,197,94,.10)':'rgba(245,158,11,.10)',border:dayClosed?'1px solid rgba(34,197,94,.18)':'1px solid rgba(245,158,11,.18)'}}><LockKeyhole className="w-4 h-4" />{dayClosed?'اليوم مقفل':'إنهاء اليوم'}</button>
            </div>
          </div>
        </section>

        <section className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-black text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-400" />
              حالة المعدات اليوم
            </h2>
            <button type="button" onClick={() => navigate('/equipment')} className="text-[10px] font-bold text-blue-400">
              عرض الكل
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              {name:'المعدات والكرينات', shortName:'المعدات', image:'/icons/equipment.png', status:'عرض المعدات', color:'#4ade80', path:'/equipment'},
              {name:'مستندات المعدات', shortName:'المستندات', image:'/icons/equipment-documents.png', status:'الرخص و TUV', color:'#60a5fa', path:'/equipment-documents'},
              {name:'السواقين والمشغلين', shortName:'السواقين', image:'/icons/drivers-operators.png', status:'الملفات والحسابات', color:'#c084fc', path:'/drivers'},
            ].map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => navigate(item.path)}
                className="min-w-0 overflow-hidden rounded-[17px] text-center active:scale-[0.97] transition-transform"
                style={{
                  background:'linear-gradient(145deg,#0d1b2f,#07111f)',
                  border:`1px solid ${item.color}32`,
                }}
              >
                <div className="w-full aspect-[1.35/1] bg-slate-900/60 overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </div>
                <div className="p-2 min-w-0">
                  <p className="text-[10px] font-black text-white truncate">{item.shortName}</p>
                  <div className="mt-1.5 flex items-center justify-center gap-1 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:item.color}} />
                    <span className="text-[7.5px] font-bold truncate" style={{color:item.color}}>{item.status}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-5 grid grid-cols-1 gap-3">
          <div className="rounded-[22px] p-4" style={{background:'linear-gradient(145deg,#0d1b2f,#07111f)',border:'1px solid rgba(245,158,11,.17)'}}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-black text-white">🔔 التنبيهات المهمة</h2>
              <button type="button" onClick={() => navigate('/equipment-documents')} className="text-[10px] text-blue-400 font-bold">عرض المستندات</button>
            </div>
            {[
              ['🛡️','تأمين ورخص المعدات','راجع تواريخ الانتهاء والتنبيهات','/equipment-documents'],
              ['🔧','صيانة المعدات','تابع حالة الكرين ومصاريف الصيانة','/expenses'],
              ['📄','TUV السائق والكرين','جميع مستندات الفحص في مكان واحد','/equipment-documents'],
              ['🎯','فرص العملاء','راجع المتابعات وعروض السعر والفرص الجديدة','/customers-opportunities'],
              ['🗑️','سلة المحذوفات','استعادة العناصر المحذوفة قبل حذفها نهائيًا','/recycle-bin'],
              ['💰','المستحقات','راجع المبالغ المستحقة للعملاء','/customers'],
            ].map(([icon,title,sub,path],i) => (
              <button key={title} type="button" onClick={() => navigate(path)} className={`w-full py-3 flex items-center gap-3 text-right ${i ? 'border-t border-white/5' : ''}`}>
                <span className="text-[20px]">{icon}</span>
                <div className="flex-1 min-w-0"><p className="text-[11px] font-bold text-slate-100">{title}</p><p className="text-[9px] text-slate-500 mt-1 truncate">{sub}</p></div>
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
            ))}
          </div>

          <div className="rounded-[22px] p-4" style={{background:'linear-gradient(145deg,#0d1b2f,#07111f)',border:'1px solid rgba(96,165,250,.17)'}}>
            <div className="flex items-center justify-between mb-3"><h2 className="text-[15px] font-black text-white">📁 المستندات السريعة</h2><button type="button" onClick={() => navigate('/equipment-documents')} className="text-[10px] text-blue-400 font-bold">عرض الكل</button></div>
            <div className="grid grid-cols-4 gap-2">
              {[
                ['📄','الفواتير','/invoices','#4ade80'],
                ['🪪','رخص المعدات','/equipment-documents','#60a5fa'],
                ['👥','السائقين','/drivers','#c084fc'],
                ['📝','العقود','/monthly-rental','#fbbf24'],
              ].map(([icon,label,path,color]) => (
                <button key={label} type="button" onClick={() => navigate(path)} className="min-h-[88px] rounded-[15px] flex flex-col items-center justify-center gap-2 active:scale-95" style={{background:`${color}10`,border:`1px solid ${color}30`}}>
                  <span className="text-[25px]">{icon}</span><span className="text-[9px] font-bold text-slate-200 text-center">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-black text-white">
              الاختصارات السريعة
            </h2>

            <span className="text-amber-400">
              ⚡
            </span>
          </div>

          <div
            className="rounded-[25px] p-3"
            style={{
              background:
                'linear-gradient(180deg, rgba(17,31,53,0.75), rgba(8,19,34,0.92))',
              border:
                '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <div className="grid grid-cols-3 gap-2">
              {actions
                .filter(
                  (item) =>
                    item.path !== '/add'
                )
                .map((item) => {
                  const tone =
                    tones[item.tone];

                  return (
                    <button
                      key={`${item.path}-${item.label}`}
                      type="button"
                      onClick={() =>
                        navigate(item.path)
                      }
                      className="min-h-[120px] rounded-[20px] flex flex-col items-center justify-center gap-2.5 px-1 active:scale-[0.95] transition-transform overflow-hidden"
                      style={{
                        background:
                          item.path === '/ai'
                            ? 'linear-gradient(145deg,rgba(88,28,135,0.22),rgba(255,255,255,0.025))'
                            : item.path === '/customers-opportunities'
                              ? 'linear-gradient(145deg,rgba(34,197,94,0.12),rgba(255,255,255,0.018))'
                              : 'linear-gradient(145deg,rgba(255,255,255,0.04),rgba(255,255,255,0.018))',
                        border:
                          item.path === '/ai'
                            ? '1px solid rgba(192,132,252,0.18)'
                            : item.path === '/customers-opportunities'
                              ? '1px solid rgba(74,222,128,0.18)'
                              : '1px solid rgba(255,255,255,0.055)',
                      }}
                    >
                      <div
                        className="relative w-[72px] h-[72px] rounded-[20px] overflow-hidden shrink-0"
                        style={{
                          background:
                            tone.background,
                          border:
                            `1px solid ${tone.color}35`,
                        }}
                      >
                        <img
                          src={item.image}
                          alt={item.label}
                          className="absolute inset-0 w-full h-full object-cover"
                          draggable={false}
                        />
                      </div>

                      <span className="text-[10px] leading-[15px] font-bold text-slate-200 text-center">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-black text-white">
              أحدث الحركات
            </h2>

            <button
              type="button"
              onClick={() =>
                navigate('/transactions')
              }
              className="flex items-center gap-1 text-[11px] font-bold text-amber-400"
            >
              عرض الكل
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="rounded-[22px] p-7 text-center">
              <div className="w-9 h-9 mx-auto rounded-full border-2 border-white/10 border-t-amber-400 animate-spin" />

              <p className="text-[11px] text-slate-500 mt-3">
                جاري التحميل...
              </p>
            </div>
          ) : recentTxs.length === 0 ? (
            <div className="rounded-[24px] p-7 text-center">
              <div className="w-14 h-14 rounded-[18px] bg-amber-500/10 flex items-center justify-center mx-auto">
                <Receipt className="w-7 h-7 text-amber-400" />
              </div>

              <p className="text-sm font-bold text-white mt-4">
                لا توجد حركات حتى الآن
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate('/add')
                }
                className="mt-4 px-5 py-2.5 rounded-xl font-bold text-[12px] text-slate-950 bg-gradient-to-br from-amber-400 to-orange-500 inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                إضافة حركة
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentTxs.map(
                (tx, i) => (
                  <TransactionItem
                    key={tx.data.id}
                    tx={tx}
                    delay={i * 50}
                  />
                )
              )}
            </div>
          )}
        </section>

        <div className="h-4" />

        {searchOpen && (
          <div
            className="fixed inset-0 z-[99999] flex justify-center"
            style={{
              background:
                'rgba(2,6,15,0.94)',
              backdropFilter:
                'blur(10px)',
            }}
          >
            <div
              dir="rtl"
              className="w-full max-w-[430px] min-h-[100dvh] overflow-y-auto px-4 pb-8"
              style={{
                paddingTop:
                  'calc(env(safe-area-inset-top, 0px) + 18px)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[20px] font-black text-white">
                    البحث الشامل
                  </h2>

                  <p className="text-[10px] text-slate-500 mt-1">
                    ابحث في بيانات BAKR PRO
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeSearch}
                  className="w-10 h-10 rounded-[13px] flex items-center justify-center bg-white/5"
                >
                  <X className="w-5 h-5 text-slate-300" />
                </button>
              </div>

              <div className="h-[58px] rounded-[18px] px-4 flex items-center gap-3 bg-slate-900">
                <Search className="w-5 h-5 text-amber-400 shrink-0" />

                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(event) =>
                    setSearchQuery(
                      event.target.value
                    )
                  }
                  placeholder="اسم، فرصة، جوال، فاتورة، كرين، مبلغ..."
                  className="flex-1 bg-transparent outline-none text-white text-[13px]"
                />

                {searchQuery && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearchQuery('')
                    }
                  >
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                )}
              </div>

              {searchQuery &&
                searchResults.length ===
                  0 && (
                  <div className="mt-16 text-center">
                    <Search className="w-8 h-8 text-amber-400/50 mx-auto" />

                    <p className="text-[14px] font-bold text-white mt-4">
                      لا توجد نتائج
                    </p>
                  </div>
                )}

              {searchQuery &&
                searchResults.length >
                  0 && (
                  <div className="mt-5 space-y-5">
                    {Object.entries(
                      groupedSearchResults
                    ).map(
                      ([
                        category,
                        items,
                      ]) => (
                        <section
                          key={
                            category
                          }
                        >
                          <h3 className="text-[12px] font-black text-slate-300 mb-2">
                            {
                              category
                            }
                          </h3>

                          <div className="space-y-2">
                            {items.map(
                              (
                                item
                              ) => (
                                <button
                                  key={
                                    item.id
                                  }
                                  type="button"
                                  onClick={() =>
                                    openSearchResult(
                                      item
                                    )
                                  }
                                  className="w-full rounded-[16px] p-3.5 flex items-center gap-3 text-right bg-slate-900"
                                >
                                  <Search className="w-4 h-4 text-amber-400" />

                                  <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-bold text-white truncate">
                                      {
                                        item.title
                                      }
                                    </p>

                                    {item.subtitle && (
                                      <p className="text-[9px] text-slate-500 mt-1 truncate">
                                        {
                                          item.subtitle
                                        }
                                      </p>
                                    )}
                                  </div>

                                  {item.path !==
                                    '/' && (
                                    <ChevronLeft className="w-4 h-4 text-slate-600" />
                                  )}
                                </button>
                              )
                            )}
                          </div>
                        </section>
                      )
                    )}
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

type MoneyCardProps = {
  label: string;
  value: string;
  icon: any;
  color: string;
  bg: string;
  border: string;
  onClick: () => void;
};

function MoneyCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
  border,
  onClick,
}: MoneyCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[116px] rounded-[22px] p-3.5 text-right active:scale-[0.98] transition-transform"
      style={{
        background:
          'linear-gradient(145deg, rgba(13,27,47,0.94), rgba(7,17,31,0.98))',
        border: `1px solid ${border}`,
        boxShadow:
          '0 10px 25px rgba(0,0,0,0.18)',
      }}
    >
      <div className="flex items-start justify-between">
        <p className="text-[10px] text-slate-400">
          {label}
        </p>

        <div
          className="w-10 h-10 rounded-[14px] flex items-center justify-center"
          style={{
            background: bg,
          }}
        >
          <Icon
            className="w-5 h-5"
            style={{ color }}
            strokeWidth={2.1}
          />
        </div>
      </div>

      <p
        className="text-[15px] font-black mt-4 leading-tight"
        style={{ color }}
      >
        {value}
      </p>
    </button>
  );
}
