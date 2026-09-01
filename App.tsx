import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  Routes,
  Route,
} from 'react-router-dom';

import {
  Fingerprint,
  ScanFace,
  ShieldCheck,
} from 'lucide-react';

import {
  BiometricAuth,
  AndroidBiometryStrength,
} from '@aparajita/capacitor-biometric-auth';

import { DashboardPage } from '@/pages/DashboardPage';
import { TransactionsPage } from '@/pages/TransactionsPage';
import { AddPage } from '@/pages/AddPage';
import { AddEquipmentPage } from '@/pages/AddEquipmentPage';
import { EditEquipmentPage } from '@/pages/EditEquipmentPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { CustomerDetailPage } from '@/pages/CustomerDetailPage';
import { EquipmentPage } from '@/pages/EquipmentPage';
import { EquipmentDetailPage } from '@/pages/EquipmentDetailPage';
import { MonthlyPage } from '@/pages/MonthlyPage';
import { MonthlyDetailPage } from '@/pages/MonthlyDetailPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { InvoicesPage } from '@/pages/InvoicesPage';
import { SettingsPage } from '@/pages/SettingsPage';

const BIOMETRIC_ENABLED_KEY =
  'baakr_pro_biometric_enabled';

function isBiometricEnabled() {
  try {
    return (
      localStorage.getItem(
        BIOMETRIC_ENABLED_KEY
      ) === 'true'
    );
  } catch {
    return false;
  }
}

function App() {
  const [
    biometricLocked,
    setBiometricLocked,
  ] = useState(
    isBiometricEnabled()
  );

  const [
    checkingBiometric,
    setCheckingBiometric,
  ] = useState(
    isBiometricEnabled()
  );

  const [
    biometricError,
    setBiometricError,
  ] = useState('');

  const authenticateBiometric =
    useCallback(async () => {
      if (!isBiometricEnabled()) {
        setBiometricLocked(false);
        setCheckingBiometric(false);

        return;
      }

      setCheckingBiometric(true);
      setBiometricError('');

      try {
        const info =
          await BiometricAuth.checkBiometry();

        if (!info.isAvailable) {
          setBiometricLocked(true);

          setBiometricError(
            'البصمة أو الوجه غير متاحين حاليًا. تأكد من تسجيل البصمة أو الوجه في إعدادات الجوال.'
          );

          return;
        }

        await BiometricAuth.authenticate({
          reason:
            'فتح تطبيق BAAKR PRO',

          cancelTitle:
            'إلغاء',

          allowDeviceCredential:
            false,

          androidTitle:
            'BAAKR PRO',

          androidSubtitle:
            'استخدم بصمة الإصبع أو الوجه لفتح التطبيق',

          androidConfirmationRequired:
            false,

          androidBiometryStrength:
            AndroidBiometryStrength.weak,
        });

        setBiometricLocked(
          false
        );

        setBiometricError('');
      } catch (error) {
        console.error(
          'Biometric authentication error:',
          error
        );

        setBiometricLocked(
          true
        );

        setBiometricError(
          'لم يتم التحقق من البصمة أو الوجه'
        );
      } finally {
        setCheckingBiometric(
          false
        );
      }
    }, []);

  useEffect(() => {
    if (
      isBiometricEnabled()
    ) {
      authenticateBiometric();
    } else {
      setBiometricLocked(
        false
      );

      setCheckingBiometric(
        false
      );
    }
  }, [
    authenticateBiometric,
  ]);

  /*
   * عند رجوع التطبيق من الخلفية
   * نعيد طلب البصمة أو الوجه.
   */
  useEffect(() => {
    let removeListener:
      | (() => Promise<void>)
      | undefined;

    async function setupResumeListener() {
      try {
        /*
         * يجب فحص البصمة مرة واحدة
         * قبل إضافة Resume Listener.
         */
        await BiometricAuth.checkBiometry();

        const listener =
          await BiometricAuth.addResumeListener(
            async () => {
              if (
                isBiometricEnabled()
              ) {
                setBiometricLocked(
                  true
                );

                await authenticateBiometric();
              }
            }
          );

        removeListener =
          listener.remove;
      } catch (error) {
        console.error(
          'Biometric resume listener error:',
          error
        );
      }
    }

    setupResumeListener();

    return () => {
      if (removeListener) {
        removeListener();
      }
    };
  }, [
    authenticateBiometric,
  ]);

  if (
    biometricLocked
  ) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-ink-950 flex items-center justify-center px-6"
      >
        <div className="w-full max-w-sm">

          <div className="text-center mb-8">
            <div className="mx-auto w-24 h-24 rounded-[28px] bg-gold-500/10 border border-gold-500/20 flex items-center justify-center relative">

              <Fingerprint className="w-12 h-12 text-gold-400" />

              <div className="absolute -bottom-2 -left-2 w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/20 flex items-center justify-center">
                <ScanFace className="w-6 h-6 text-blue-400" />
              </div>

            </div>

            <h1 className="mt-6 text-2xl font-bold text-white">
              BAAKR PRO
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              التطبيق مقفل
            </p>

            <p className="mt-1 text-xs text-slate-500">
              استخدم بصمة الإصبع أو الوجه للمتابعة
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-white/5 border border-white/10">

            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-green-500/10 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-green-400" />
              </div>

              <div>
                <b className="text-sm text-white">
                  الحماية الحيوية
                </b>

                <p className="text-[11px] text-slate-500 mt-0.5">
                  مصادقة آمنة من نظام Android
                </p>
              </div>
            </div>

            {biometricError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                {biometricError}
              </div>
            )}

            <button
              type="button"
              disabled={
                checkingBiometric
              }
              onClick={
                authenticateBiometric
              }
              className="w-full h-14 rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 text-ink-950 font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Fingerprint className="w-5 h-5" />

              {checkingBiometric
                ? 'جاري التحقق...'
                : 'فتح بالبصمة أو الوجه'}
            </button>

            <p className="text-[10px] text-slate-500 text-center mt-4">
              يتم التحقق من هويتك بواسطة نظام الجوال
            </p>

          </div>
        </div>
      </div>
    );
  }

  return (
    <Routes>

      <Route
        path="/"
        element={
          <DashboardPage />
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
        path="/monthly"
        element={
          <MonthlyPage />
        }
      />

      <Route
        path="/monthly/:id"
        element={
          <MonthlyDetailPage />
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
        path="/settings"
        element={
          <SettingsPage />
        }
      />

    </Routes>
  );
}

export default App;
