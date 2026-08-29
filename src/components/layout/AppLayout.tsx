import { ReactNode, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  Bell,
  Settings,
  X,
  Home,
  Users,
  Truck,
  FileBarChart,
  Receipt,
  CalendarClock,
  Calculator,
  UserRound,
  Info,
  DatabaseBackup,
  ChevronLeft,
  Plus,
} from 'lucide-react';

type AppLayoutProps = {
  children: ReactNode;
  showHeader?: boolean;
  showBottomNav?: boolean;
};

export function AppLayout({
  children,
  showHeader = true,
  showBottomNav = true,
}: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const menuItems = [
    {
      label: 'الرئيسية',
      icon: Home,
      path: '/',
    },
    {
      label: 'المعدات',
      icon: Truck,
      path: '/equipment',
    },
    {
      label: 'العملاء',
      icon: Users,
      path: '/customers',
    },
    {
      label: 'الحساب الشهري',
      icon: CalendarClock,
      path: '/monthly',
    },
    {
      label: 'التأجير الشهري',
      icon: CalendarClock,
      path: '/monthly-rental',
    },
    {
      label: 'السواقين والمشغلين',
      icon: UserRound,
      path: '/drivers',
    },
    {
      label: 'التقارير',
      icon: FileBarChart,
      path: '/reports',
    },
    {
      label: 'الفواتير',
      icon: Receipt,
      path: '/invoices',
    },
    {
      label: 'حساب اليوم',
      icon: Calculator,
      path: '/daily-calculator',
    },
    {
      label: 'النسخ الاحتياطي',
      icon: DatabaseBackup,
      path: '/backup',
    },
    {
      label: 'الإعدادات',
      icon: Settings,
      path: '/settings',
    },
    {
      label: 'حول التطبيق',
      icon: Info,
      path: '/about',
    },
  ];

  const goTo = (path: string) => {
    setMenuOpen(false);
    setNotificationsOpen(false);
    navigate(path);
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }

    return location.pathname.startsWith(path);
  };

  const bottomItemClass = (path: string) =>
    `flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
      isActive(path)
        ? 'text-amber-400'
        : 'text-slate-500'
    }`;

  return (
    <div
      dir="rtl"
      className="min-h-screen text-white"
      style={{
        background:
          'linear-gradient(180deg, #07101f 0%, #050b16 45%, #030811 100%)',
      }}
    >
      {/* =========================
          الهيدر الاحترافي
      ========================== */}

      {showHeader && (
        <header
          className="sticky top-0 z-40"
          style={{
            background:
              'linear-gradient(180deg, rgba(7,16,31,0.99) 0%, rgba(7,16,31,0.94) 100%)',
            backdropFilter: 'blur(18px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div
            className="px-4 pb-4"
            style={{
              paddingTop:
                'calc(env(safe-area-inset-top, 0px) + 12px)',
            }}
          >
            <div className="flex items-center justify-between">

              {/* يمين - القائمة */}
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="w-12 h-12 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
                style={{
                  background:
                    'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.025))',
                  border:
                    '1px solid rgba(255,255,255,0.10)',
                  boxShadow:
                    '0 8px 24px rgba(0,0,0,0.25)',
                }}
                aria-label="القائمة"
              >
                <Menu
                  className="w-6 h-6 text-white"
                  strokeWidth={2.1}
                />
              </button>

              {/* الوسط - هوية التطبيق */}
              <div className="flex-1 px-3 min-w-0">

                <div className="flex items-center justify-center gap-2">

                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background:
                        'linear-gradient(145deg, #fbbf24, #f97316)',
                      boxShadow:
                        '0 6px 20px rgba(245,158,11,0.22)',
                    }}
                  >
                    <Truck
                      className="w-5 h-5 text-slate-950"
                      strokeWidth={2.4}
                    />
                  </div>

                  <div className="min-w-0">
                    <h1 className="text-[16px] leading-tight font-black tracking-wide text-white">
                      BAAKR PRO
                    </h1>

                    <p className="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">
                      إدارة حسابات الكرينات
                    </p>
                  </div>

                </div>
              </div>

              {/* يسار - التنبيهات والإعدادات */}
              <div className="flex items-center gap-2">

                <button
                  type="button"
                  onClick={() =>
                    setNotificationsOpen(true)
                  }
                  className="relative w-11 h-11 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
                  style={{
                    background:
                      'rgba(255,255,255,0.045)',
                    border:
                      '1px solid rgba(255,255,255,0.08)',
                  }}
                  aria-label="التنبيهات"
                >
                  <Bell
                    className="w-5 h-5 text-slate-200"
                    strokeWidth={2}
                  />

                  <span
                    className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full"
                    style={{
                      background: '#f59e0b',
                      border: '2px solid #07101f',
                      boxShadow:
                        '0 0 10px rgba(245,158,11,0.6)',
                    }}
                  />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate('/settings')
                  }
                  className="w-11 h-11 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
                  style={{
                    background:
                      'rgba(255,255,255,0.045)',
                    border:
                      '1px solid rgba(255,255,255,0.08)',
                  }}
                  aria-label="الإعدادات"
                >
                  <Settings
                    className="w-5 h-5 text-slate-200"
                    strokeWidth={2}
                  />
                </button>

              </div>

            </div>
          </div>
        </header>
      )}

      {/* =========================
          محتوى التطبيق
      ========================== */}

      <main
        className={
          showBottomNav
            ? 'px-4 pt-4 pb-32'
            : 'px-4 pt-4 pb-8'
        }
      >
        <div className="w-full max-w-lg mx-auto">
          {children}
        </div>
      </main>

      {/* =========================
          القائمة الجانبية
      ========================== */}

      {menuOpen && (
        <div className="fixed inset-0 z-[10000]">

          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/75"
            style={{
              backdropFilter: 'blur(4px)',
            }}
            aria-label="إغلاق القائمة"
          />

          <aside
            className="absolute top-0 right-0 h-full w-[86%] max-w-[350px] overflow-y-auto shadow-2xl"
            style={{
              background:
                'linear-gradient(180deg, #0b1729 0%, #07101f 55%, #040b15 100%)',
              borderLeft:
                '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div
              className="p-5"
              style={{
                paddingTop:
                  'calc(env(safe-area-inset-top, 0px) + 22px)',
              }}
            >

              {/* هوية القائمة */}

              <div
                className="rounded-3xl p-4 mb-5"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(255,255,255,0.025))',
                  border:
                    '1px solid rgba(245,158,11,0.16)',
                }}
              >
                <div className="flex items-center justify-between">

                  <div className="flex items-center gap-3">

                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{
                        background:
                          'linear-gradient(145deg, #fbbf24, #f97316)',
                        boxShadow:
                          '0 8px 22px rgba(245,158,11,0.22)',
                      }}
                    >
                      <Truck
                        className="w-6 h-6 text-slate-950"
                        strokeWidth={2.3}
                      />
                    </div>

                    <div>
                      <h2 className="text-lg font-black text-white">
                        BAAKR PRO
                      </h2>

                      <p className="text-[11px] text-slate-400 mt-1">
                        نظام إدارة حسابات الكرينات
                      </p>
                    </div>

                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setMenuOpen(false)
                    }
                    className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center active:scale-95"
                  >
                    <X className="w-5 h-5" />
                  </button>

                </div>
              </div>

              {/* عناصر القائمة */}

              <div className="space-y-2">

                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);

                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() =>
                        goTo(item.path)
                      }
                      className="w-full flex items-center justify-between p-3 rounded-2xl text-right active:scale-[0.98] transition-all"
                      style={{
                        background: active
                          ? 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))'
                          : 'rgba(255,255,255,0.025)',

                        border: active
                          ? '1px solid rgba(245,158,11,0.20)'
                          : '1px solid rgba(255,255,255,0.055)',
                      }}
                    >

                      <div className="flex items-center gap-3">

                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{
                            background: active
                              ? 'rgba(245,158,11,0.16)'
                              : 'rgba(255,255,255,0.04)',
                          }}
                        >
                          <Icon
                            className={
                              active
                                ? 'w-5 h-5 text-amber-400'
                                : 'w-5 h-5 text-slate-400'
                            }
                          />
                        </div>

                        <span
                          className={
                            active
                              ? 'text-sm font-bold text-white'
                              : 'text-sm font-semibold text-slate-200'
                          }
                        >
                          {item.label}
                        </span>

                      </div>

                      <ChevronLeft
                        className="w-4 h-4 text-slate-600"
                      />

                    </button>
                  );
                })}

              </div>

              <div className="mt-7 pt-5 border-t border-white/10 text-center">

                <p className="text-xs font-bold text-slate-400">
                  BAAKR PRO
                </p>

                <p className="text-[10px] text-slate-600 mt-1">
                  إدارة أعمالك بشكل أسهل وأسرع
                </p>

              </div>

            </div>
          </aside>
        </div>
      )}

      {/* =========================
          نافذة التنبيهات
      ========================== */}

      {notificationsOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-start justify-center px-4"
          style={{
            paddingTop:
              'calc(env(safe-area-inset-top, 0px) + 85px)',
          }}
        >

          <button
            type="button"
            onClick={() =>
              setNotificationsOpen(false)
            }
            className="absolute inset-0 bg-black/75"
            style={{
              backdropFilter: 'blur(4px)',
            }}
            aria-label="إغلاق التنبيهات"
          />

          <div
            className="relative w-full max-w-md rounded-[28px] p-5 shadow-2xl"
            style={{
              background:
                'linear-gradient(180deg, #101d31 0%, #081322 100%)',
              border:
                '1px solid rgba(255,255,255,0.09)',
            }}
          >

            <div className="flex items-center justify-between mb-5">

              <div className="flex items-center gap-3">

                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center"
                  style={{
                    background:
                      'rgba(245,158,11,0.12)',
                  }}
                >
                  <Bell className="w-5 h-5 text-amber-400" />
                </div>

                <div>
                  <h3 className="text-base font-black">
                    التنبيهات
                  </h3>

                  <p className="text-[11px] text-slate-400 mt-0.5">
                    مركز تنبيهات BAAKR PRO
                  </p>
                </div>

              </div>

              <button
                type="button"
                onClick={() =>
                  setNotificationsOpen(false)
                }
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>

            </div>

            <div
              className="rounded-2xl p-6 text-center"
              style={{
                background:
                  'rgba(255,255,255,0.025)',
                border:
                  '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div
                className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3"
                style={{
                  background:
                    'rgba(255,255,255,0.04)',
                }}
              >
                <Bell className="w-7 h-7 text-slate-500" />
              </div>

              <p className="text-sm font-bold text-white">
                لا توجد تنبيهات جديدة
              </p>

              <p className="text-xs text-slate-500 mt-2">
                ستظهر هنا التنبيهات المهمة الخاصة بحساباتك
              </p>
            </div>

          </div>
        </div>
      )}

      {/* =========================
          شريط التنقل السفلي
      ========================== */}

      {showBottomNav && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-50"
          style={{
            background:
              'linear-gradient(180deg, rgba(8,18,33,0.97), rgba(5,12,23,0.995))',
            borderTop:
              '1px solid rgba(255,255,255,0.075)',
            boxShadow:
              '0 -10px 35px rgba(0,0,0,0.32)',
            paddingBottom:
              'env(safe-area-inset-bottom, 0px)',
          }}
        >

          <div className="max-w-lg mx-auto h-[78px] px-3 grid grid-cols-5 items-center">

            {/* الرئيسية */}

            <button
              type="button"
              onClick={() => navigate('/')}
              className={bottomItemClass('/')}
            >
              <Home
                className="w-[21px] h-[21px]"
                strokeWidth={
                  isActive('/') ? 2.5 : 2
                }
              />

              <span className="text-[10px] font-semibold">
                الرئيسية
              </span>
            </button>

            {/* الحركات */}

            <button
              type="button"
              onClick={() =>
                navigate('/transactions')
              }
              className={bottomItemClass(
                '/transactions'
              )}
            >
              <Receipt
                className="w-[21px] h-[21px]"
                strokeWidth={
                  isActive('/transactions')
                    ? 2.5
                    : 2
                }
              />

              <span className="text-[10px] font-semibold">
                الحركات
              </span>
            </button>

            {/* زر الإضافة */}

            <button
              type="button"
              onClick={() => navigate('/add')}
              className="relative flex flex-col items-center justify-center"
            >

              <div
                className="absolute -top-[40px] w-[62px] h-[62px] rounded-[22px] flex items-center justify-center active:scale-95 transition-transform"
                style={{
                  background:
                    'linear-gradient(145deg, #fbbf24 0%, #f59e0b 50%, #f97316 100%)',
                  border:
                    '5px solid #07101f',
                  boxShadow:
                    '0 10px 28px rgba(245,158,11,0.30)',
                }}
              >
                <Plus
                  className="w-7 h-7 text-slate-950"
                  strokeWidth={2.4}
                />
              </div>

              <span className="text-[10px] font-bold text-amber-400 mt-8">
                إضافة
              </span>

            </button>

            {/* العملاء */}

            <button
              type="button"
              onClick={() =>
                navigate('/customers')
              }
              className={bottomItemClass(
                '/customers'
              )}
            >
              <Users
                className="w-[21px] h-[21px]"
                strokeWidth={
                  isActive('/customers')
                    ? 2.5
                    : 2
                }
              />

              <span className="text-[10px] font-semibold">
                العملاء
              </span>
            </button>

            {/* التقارير */}

            <button
              type="button"
              onClick={() =>
                navigate('/reports')
              }
              className={bottomItemClass(
                '/reports'
              )}
            >
              <FileBarChart
                className="w-[21px] h-[21px]"
                strokeWidth={
                  isActive('/reports')
                    ? 2.5
                    : 2
                }
              />

              <span className="text-[10px] font-semibold">
                التقارير
              </span>
            </button>

          </div>
        </nav>
      )}

    </div>
  );
}
