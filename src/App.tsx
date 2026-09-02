import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  Routes,
  Route,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  App as CapacitorApp,
} from '@capacitor/app';

import {
  DashboardPage,
} from '@/pages/DashboardPage';

import {
  TransactionsPage,
} from '@/pages/TransactionsPage';

import {
  AddPage,
} from '@/pages/AddPage';

import {
  AddEquipmentPage,
} from '@/pages/AddEquipmentPage';

import {
  EditEquipmentPage,
} from '@/pages/EditEquipmentPage';

import {
  CustomersPage,
} from '@/pages/CustomersPage';

import {
  CustomerDetailPage,
} from '@/pages/CustomerDetailPage';

import {
  EquipmentPage,
} from '@/pages/EquipmentPage';

import {
  EquipmentDetailPage,
} from '@/pages/EquipmentDetailPage';

import {
  MonthlyDetailPage,
} from '@/pages/MonthlyDetailPage';

import {
  ReportsPage,
} from '@/pages/ReportsPage';

import {
  InvoicesPage,
} from '@/pages/InvoicesPage-2-final-polished-FINAL';

import {
  WorkInvoicePage,
} from '@/pages/WorkInvoicePage';

import {
  SettingsPage,
} from '@/pages/SettingsPage';

import {
  DailyCalculatorPage,
} from '@/pages/DailyCalculatorPage';

import {
  DailyTripsPage,
} from '@/pages/DailyTripsPage';

import {
  CalculatorPage,
} from '@/pages/CalculatorPage';

import {
  MonthlyRentalPage,
} from '@/pages/MonthlyRentalPage';

import {
  DriversPage,
} from '@/pages/DriversPage-1';

import {
  QuotationPage,
} from '@/pages/QuotationPage';

import AboutPage from '@/pages/AboutPage';

import {
  BackupPage,
} from '@/pages/BackupPage';

import {
  AIAssistantPage,
} from '@/pages/AIAssistantPage';

import {
  AppLockScreen,
} from '@/components/AppLockScreen';

import {
  GoogleLoginScreen,
} from '@/components/GoogleLoginScreen';

import {
  runAutomaticBackup,
} from '@/lib/backup';

import {
  isAppLockEnabled,
} from '@/lib/appLock';

function App() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  /* =========================
     GOOGLE LOGIN
  ========================= */

  const [
    googleAuthenticated,
    setGoogleAuthenticated,
  ] = useState(false);

  const handleGoogleAuthenticated =
    useCallback(() => {
      setGoogleAuthenticated(
        true
      );
    }, []);

  /* =========================
     BACK
  ========================= */

  const showBackButton =
    location.pathname !== '/';

  const [
    showExitHint,
    setShowExitHint,
  ] = useState(false);

  const [
    lastBackPress,
    setLastBackPress,
  ] = useState(0);

  /* =========================
     APP LOCK
  ========================= */

  const [
    locked,
    setLocked,
  ] = useState(() => {
    return isAppLockEnabled();
  });

  /* =========================
     AUTO BACKUP
  ========================= */

  useEffect(() => {
    if (
      googleAuthenticated
    ) {
      runAutomaticBackup();
    }
  }, [
    googleAuthenticated,
  ]);

  /* =========================
     LOCK WHEN APP GOES
     TO BACKGROUND
  ========================= */

  useEffect(() => {
    if (
      !googleAuthenticated
    ) {
      return;
    }

    let listener: {
      remove:
        () => Promise<void>;
    } | null = null;

    const setup =
      async () => {
        listener =
          await CapacitorApp.addListener(
            'appStateChange',

            ({
              isActive,
            }) => {
              if (
                !isActive &&
                isAppLockEnabled()
              ) {
                setLocked(
                  true
                );
              }
            }
          );
      };

    setup();

    return () => {
      listener?.remove();
    };
  }, [
    googleAuthenticated,
  ]);

  /* =========================
     BACK BUTTON
  ========================= */

  const handleBack =
    () => {
      if (
        window.history.length >
        1
      ) {
        navigate(-1);
      } else {
        navigate('/');
      }
    };

  useEffect(() => {
    if (
      !googleAuthenticated
    ) {
      return;
    }

    let exitHintTimer:
      | ReturnType<
          typeof setTimeout
        >
      | undefined;

    let activeListener:
      | {
          remove:
            () => Promise<void>;
        }
      | undefined;

    const setupBackButton =
      async () => {
        const listener =
          await CapacitorApp.addListener(
            'backButton',

            () => {
              if (locked) {
                return;
              }

              if (
                location.pathname !==
                '/'
              ) {
                navigate(-1);
                return;
              }

              const now =
                Date.now();

              if (
                now -
                  lastBackPress <
                2000
              ) {
                CapacitorApp.exitApp();

                return;
              }

              setLastBackPress(
                now
              );

              setShowExitHint(
                true
              );

              if (
                exitHintTimer
              ) {
                clearTimeout(
                  exitHintTimer
                );
              }

              exitHintTimer =
                setTimeout(
                  () => {
                    setShowExitHint(
                      false
                    );
                  },
                  1800
                );
            }
          );

        activeListener =
          listener;
      };

    setupBackButton();

    return () => {
      if (
        exitHintTimer
      ) {
        clearTimeout(
          exitHintTimer
        );
      }

      activeListener?.remove();
    };
  }, [
    googleAuthenticated,
    location.pathname,
    navigate,
    lastBackPress,
    locked,
  ]);

  /* =========================
     GOOGLE LOGIN SCREEN
  ========================= */

  if (
    !googleAuthenticated
  ) {
    return (
      <GoogleLoginScreen
        onAuthenticated={
          handleGoogleAuthenticated
        }
      />
    );
  }

  /* =========================
     APP LOCK
  ========================= */

  if (locked) {
    return (
      <AppLockScreen
        onUnlock={() => {
          setLocked(false);
        }}
      />
    );
  }

  return (
    <>
      {showBackButton && (
        <button
          type="button"
          onClick={
            handleBack
          }
          aria-label="رجوع"
          style={{
            position:
              'fixed',

            top:
              'calc(env(safe-area-inset-top, 0px) + 12px)',

            left: 14,

            zIndex:
              9999,

            width: 44,
            height: 44,

            borderRadius:
              14,

            border:
              '1px solid rgba(255,255,255,0.16)',

            background:
              'rgba(10, 25, 48, 0.94)',

            color:
              '#ffffff',

            fontSize:
              24,

            fontWeight:
              900,

            display:
              'flex',

            alignItems:
              'center',

            justifyContent:
              'center',

            boxShadow:
              '0 8px 24px rgba(0,0,0,0.24)',

            cursor:
              'pointer',
          }}
        >
          ←
        </button>
      )}

      {showExitHint && (
        <div
          role="status"
          style={{
            position:
              'fixed',

            left:
              '50%',

            bottom:
              'calc(env(safe-area-inset-bottom, 0px) + 28px)',

            transform:
              'translateX(-50%)',

            zIndex:
              10000,

            background:
              'rgba(15, 23, 42, 0.96)',

            color:
              '#ffffff',

            border:
              '1px solid rgba(255,255,255,0.14)',

            borderRadius:
              14,

            padding:
              '11px 16px',

            fontSize:
              14,

            fontWeight:
              700,

            whiteSpace:
              'nowrap',

            boxShadow:
              '0 10px 30px rgba(0,0,0,0.28)',
          }}
        >
          اضغط رجوع مرة أخرى للخروج
        </div>
      )}

      <Routes>

        <Route
          path="/"
          element={
            <DashboardPage />
          }
        />

        <Route
          path="/ai"
          element={
            <AIAssistantPage />
          }
        />

        <Route
          path="/transactions"
          element={
            <TransactionsPage />
          }
        />

        <Route
          path="/add"
          element={
            <AddPage />
          }
        />

        <Route
          path="/equipment/add"
          element={
            <AddEquipmentPage />
          }
        />

        <Route
          path="/equipment/:id/edit"
          element={
            <EditEquipmentPage />
          }
        />

        <Route
          path="/equipment"
          element={
            <EquipmentPage />
          }
        />

        <Route
          path="/equipment/:id"
          element={
            <EquipmentDetailPage />
          }
        />

        <Route
          path="/customers"
          element={
            <CustomersPage />
          }
        />

        <Route
          path="/customers/:id"
          element={
            <CustomerDetailPage />
          }
        />

        <Route
          path="/monthly"
          element={
            <MonthlyDetailPage />
          }
        />

        <Route
          path="/monthly/:id"
          element={
            <MonthlyDetailPage />
          }
        />

        <Route
          path="/daily-trips"
          element={
            <DailyTripsPage />
          }
        />

        <Route
          path="/monthly-rental"
          element={
            <MonthlyRentalPage />
          }
        />

        <Route
          path="/drivers"
          element={
            <DriversPage />
          }
        />

        <Route
          path="/reports"
          element={
            <ReportsPage />
          }
        />

        <Route
          path="/invoices"
          element={
            <InvoicesPage />
          }
        />

        <Route
          path="/work-invoice"
          element={
            <WorkInvoicePage />
          }
        />

        <Route
          path="/quotation"
          element={
            <QuotationPage />
          }
        />

        <Route
          path="/daily-calculator"
          element={
            <DailyCalculatorPage />
          }
        />

        <Route
          path="/calculator"
          element={
            <CalculatorPage />
          }
        />

        <Route
          path="/backup"
          element={
            <BackupPage />
          }
        />

        <Route
          path="/settings"
          element={
            <SettingsPage />
          }
        />

        <Route
          path="/about"
          element={
            <AboutPage />
          }
        />

      </Routes>
    </>
  );
}

export default App;
