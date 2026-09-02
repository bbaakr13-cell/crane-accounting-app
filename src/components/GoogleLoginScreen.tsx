import {
  useEffect,
  useState,
} from 'react';

import {
  LogIn,
  ShieldCheck,
} from 'lucide-react';

import {
  checkGoogleLogin,
  loginWithGoogle,
} from '@/lib/googleAuth';

type Props = {
  onAuthenticated: () => void;
};

export function GoogleLoginScreen({
  onAuthenticated,
}: Props) {
  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  useEffect(() => {
    let active = true;

    async function checkLogin() {
      try {
        const loggedIn =
          await checkGoogleLogin();

        if (
          active &&
          loggedIn
        ) {
          onAuthenticated();
        }
      } catch (err) {
        console.error(
          'Google login check error:',
          err
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    checkLogin();

    return () => {
      active = false;
    };
  }, [onAuthenticated]);

  async function handleLogin() {
    if (loading) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user =
        await loginWithGoogle();

      if (!user) {
        throw new Error(
          'لم يتم تسجيل الدخول'
        );
      }

      onAuthenticated();
    } catch (err) {
      console.error(
        'Google login error:',
        err
      );

      const message =
        err instanceof Error
          ? err.message
          : '';

      if (
        message
          .toLowerCase()
          .includes('cancel')
      ) {
        setError(
          'تم إلغاء تسجيل الدخول'
        );
      } else {
        setError(
          'تعذر تسجيل الدخول بحساب Google. حاول مرة أخرى.'
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#050b14] flex items-center justify-center p-5"
    >
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto rounded-[28px] bg-gradient-to-br from-[#d7b45a] to-[#9b7628] flex items-center justify-center shadow-2xl">
            <ShieldCheck className="w-12 h-12 text-[#07101f]" />
          </div>

          <h1 className="mt-6 text-3xl font-black text-white">
            BAAKR PRO
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            نظام إدارة ومحاسبة المعدات
          </p>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-2xl">

          <div className="text-center mb-6">
            <h2 className="text-lg font-bold text-white">
              تسجيل الدخول
            </h2>

            <p className="text-xs text-slate-400 mt-2 leading-6">
              سجّل الدخول بحساب Google
              للوصول إلى BAAKR PRO
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleLogin}
            className="w-full h-14 rounded-2xl bg-white text-slate-900 font-bold flex items-center justify-center gap-3 disabled:opacity-60 active:scale-[0.98] transition"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />

                <span>
                  جاري التحقق...
                </span>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center font-black text-lg">
                  G
                </div>

                <LogIn className="w-5 h-5" />

                <span>
                  الدخول بحساب Google
                </span>
              </>
            )}
          </button>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-green-400" />

            <span>
              تسجيل دخول آمن إلى BAAKR PRO
            </span>
          </div>

        </div>

        <p className="mt-5 text-center text-[10px] text-slate-600">
          BAAKR PRO • Secure Access
        </p>

      </div>
    </div>
  );
}

export default GoogleLoginScreen;
