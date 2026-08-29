import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

  return (
    <div dir="rtl" className="min-h-screen bg-ink-950 text-white">

      {/* الشريط العلوي */}
      {showHeader && (
        <header
          className="sticky top-0 z-40 border-b border-white/10"
          style={{
            background: 'rgba(5, 13, 28, 0.96)',
            backdropFilter: 'blur(14px)',
          }}
        >
          <div
            className="flex items-center justify-between px-4 pb-3"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
            }}
          >

            {/* القائمة */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center active:scale-95 transition-transform"
              aria-label="القائمة"
            >
              <Menu className="w-6 h-6 text-white" />
            </button>

            <div className="flex items-center gap-2">

              {/* التنبيهات */}
              <button
                type="button"
                onClick={() => setNotificationsOpen(true)}
                className="relative w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center active:scale-95 transition-transform"
                aria-label="التنبيهات"
              >
                <Bell className="w-5 h-5 text-white" />

                <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-gold-400 border-2 border-ink-950" />
              </button>

              {/* الإعدادات */}
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center active:scale-95 transition-transform"
                aria-label="الإعدادات"
              >
                <Settings className="w-5 h-5 text-white" />
              </button>

            </div>
          </div>
        </header>
      )}

      {/* محتوى التطبيق */}
      <main
        className={
          showBottomNav
            ? 'px-4 pb-28'
            : 'px-4 pb-8'
        }
      >
        {children}
      </main>

      {/* القائمة الجانبية */}
      {menuOpen && (
        <div className="fixed inset-0 z-[10000]">

          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/70"
            aria-label="إغلاق القائمة"
          />

          <div
            className="absolute top-0 right-0 h-full w-[82%] max-w-[340px] border-l border-white/10 shadow-2xl overflow-y-auto"
            style={{
              background:
                'linear-gradient(180deg, #0b172a 0%, #07101f 100%)',
            }}
          >

            <div
              className="p-5"
              style={{
                paddingTop:
                  'calc(env(safe-area-inset-top, 0px) + 20px)',
              }}
            >

              <div className="flex items-center justify-between mb-6">

                <div>
                  <h2 className="text-xl font-bold text-white">
                    BAAKR PRO
                  </h2>

                  <p className="text-xs text-slate-400 mt-1">
                    إدارة حسابات الكرينات
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>

              </div>

              <div className="space-y-2">

                {menuItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => goTo(item.path)}
                      className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-right active:scale-[0.98] transition-transform"
                    >

                      <div className="w-10 h-10 rounded-xl bg-gold-500/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-gold-400" />
                      </div>

                      <span className="text-sm font-semibold text-white">
                        {item.label}
                      </span>

                    </button>
                  );
                })}

              </div>

              <div className="mt-8 pt-5 border-t border-white/10 text-center">
                <p className="text-xs text-slate-500">
                  BAAKR PRO
                </p>

                <p className="text-[10px] text-slate-600 mt-1">
                  نظام إدارة حسابات الكرينات
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* نافذة التنبيهات */}
      {notificationsOpen && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center px-4 pt-24">

          <button
            type="button"
            onClick={() => setNotificationsOpen(false)}
            className="absolute inset-0 bg-black/70"
            aria-label="إغلاق التنبيهات"
          />

          <div
            className="relative w-full max-w-md rounded-3xl border border-white/10 p-5 shadow-2xl"
            style={{
              background:
                'linear-gradient(180deg, #102039 0%, #081426 100%)',
            }}
          >

            <div className="flex items-center justify-between mb-5">

              <div className="flex items-center gap-3">

                <div className="w-11 h-11 rounded-xl bg-gold-500/10 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-gold-400" />
                </div>

                <div>
                  <h3 className="text-lg font-bold">
                    التنبيهات
                  </h3>

                  <p className="text-xs text-slate-400">
                    تنبيهات BAAKR PRO
                  </p>
                </div>

              </div>

              <button
                type="button"
                onClick={() => setNotificationsOpen(false)}
                className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>

            </div>

            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-5 text-center">

              <Bell className="w-8 h-8 text-slate-500 mx-auto mb-3" />

              <p className="text-sm font-semibold text-white">
                لا توجد تنبيهات جديدة
              </p>

              <p className="text-xs text-slate-500 mt-2">
                ستظهر هنا التنبيهات المهمة
              </p>

            </div>

          </div>
        </div>
      )}

      {/* الشريط السفلي */}
      {showBottomNav && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10"
          style={{
            background: 'rgba(7, 16, 31, 0.97)',
            paddingBottom:
              'env(safe-area-inset-bottom, 0px)',
          }}
        >

          <div className="max-w-lg mx-auto h-20 px-4 grid grid-cols-5 items-center">

            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex flex-col items-center gap-1 text-gold-400"
            >
              <Home className="w-5 h-5" />

              <span className="text-[10px]">
                الرئيسية
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/transactions')}
              className="flex flex-col items-center gap-1 text-slate-400"
            >
              <Receipt className="w-5 h-5" />

              <span className="text-[10px]">
                الحركات
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/add')}
              className="flex flex-col items-center justify-center"
            >

              <div className="w-14 h-14 -mt-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-ink-950 flex items-center justify-center text-3xl font-light shadow-lg">
                +
              </div>

              <span className="text-[10px] text-gold-400 mt-1">
                إضافة
              </span>

            </button>

            <button
              type="button"
              onClick={() => navigate('/customers')}
              className="flex flex-col items-center gap-1 text-slate-400"
            >
              <Users className="w-5 h-5" />

              <span className="text-[10px]">
                العملاء
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/reports')}
              className="flex flex-col items-center gap-1 text-slate-400"
            >
              <FileBarChart className="w-5 h-5" />

              <span className="text-[10px]">
                التقارير
              </span>
            </button>

          </div>
        </nav>
      )}

    </div>
  );
}
