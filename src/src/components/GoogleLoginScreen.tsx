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
  const [
    checking,
    setChecking,
  ] = useState(true);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');

  useEffect(() => {
    const check =
      async () => {
        try {
          const loggedIn =
            await checkGoogleLogin();

          if (loggedIn) {
            onAuthenticated();
            return;
          }
        } catch (
          checkError
        ) {
          console.error(
            checkError
          );
        }

        setChecking(false);
      };

    check();
  }, [
    onAuthenticated,
  ]);

  async function handleLogin() {
    if (loading) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      await loginWithGoogle();

      onAuthenticated();
    } catch (loginError) {
      console.error(
        'Google login error:',
        loginError
      );

      setError(
        'تعذر تسجيل الدخول بحساب Google. تأكد من الإنترنت ثم حاول مرة أخرى.'
      );
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div
        style={{
          minHeight:
            '100vh',

          background:
            'linear-gradient(160deg,#07101f,#0c1b31,#07101f)',

          display:
            'flex',

          alignItems:
            'center',

          justifyContent:
            'center',

          color:
            '#ffffff',

          fontFamily:
            'inherit',
        }}
      >
        <div
          style={{
            textAlign:
              'center',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,

              margin:
                '0 auto 18px',

              borderRadius:
                '50%',

              border:
                '4px solid rgba(255,255,255,0.14)',

              borderTopColor:
                '#d6a84b',

              animation:
                'spin 0.9s linear infinite',
            }}
          />

          <div
            style={{
              fontWeight:
                800,

              fontSize:
                15,
            }}
          >
            جاري التحقق...
          </div>

          <style>
            {`
              @keyframes spin {
                to {
                  transform: rotate(360deg);
                }
              }
            `}
          </style>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      style={{
        minHeight:
          '100vh',

        background:
          'linear-gradient(160deg,#07101f 0%,#10223d 50%,#07101f 100%)',

        display:
          'flex',

        alignItems:
          'center',

        justifyContent:
          'center',

        padding:
          24,

        color:
          '#ffffff',
      }}
    >
      <div
        style={{
          width:
            '100%',

          maxWidth:
            420,
        }}
      >
        <div
          style={{
            textAlign:
              'center',

            marginBottom:
              30,
          }}
        >
          <div
            style={{
              width: 92,
              height: 92,

              margin:
                '0 auto 18px',

              borderRadius:
                28,

              background:
                'linear-gradient(145deg,#d6a84b,#8e6422)',

              display:
                'flex',

              alignItems:
                'center',

              justifyContent:
                'center',

              boxShadow:
                '0 18px 50px rgba(214,168,75,0.20)',

              color:
                '#07101f',

              fontSize:
                40,

              fontWeight:
                950,

              letterSpacing:
                -2,
            }}
          >
            B
          </div>

          <h1
            style={{
              margin: 0,

              fontSize:
                30,

              fontWeight:
                950,

              letterSpacing:
                1,
            }}
          >
            BAAKR PRO
          </h1>

          <p
            style={{
              margin:
                '8px 0 0',

              color:
                '#94a3b8',

              fontSize:
                13,
            }}
          >
            نظام إدارة ومحاسبة المعدات
          </p>
        </div>

        <div
          style={{
            padding:
              22,

            borderRadius:
              26,

            background:
              'rgba(15,28,48,0.90)',

            border:
              '1px solid rgba(255,255,255,0.09)',

            boxShadow:
              '0 24px 70px rgba(0,0,0,0.28)',
          }}
        >
          <div
            style={{
              display:
                'flex',

              alignItems:
                'center',

              gap: 12,

              marginBottom:
                20,
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,

                borderRadius:
                  14,

                display:
                  'flex',

                alignItems:
                  'center',

                justifyContent:
                  'center',

                background:
                  'rgba(214,168,75,0.10)',
              }}
            >
              <ShieldCheck
                size={24}
                color="#d6a84b"
              />
            </div>

            <div>
              <div
                style={{
                  fontWeight:
                    850,

                  fontSize:
                    16,
                }}
              >
                تسجيل الدخول
              </div>

              <div
                style={{
                  marginTop:
                    3,

                  color:
                    '#94a3b8',

                  fontSize:
                    11,
                }}
              >
                استخدم حساب Google للدخول إلى التطبيق
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={
              loading
            }
            onClick={
              handleLogin
            }
            style={{
              width:
                '100%',

              minHeight:
                54,

              border:
                '1px solid rgba(255,255,255,0.14)',

              borderRadius:
                16,

              background:
                '#ffffff',

              color:
                '#172033',

              fontWeight:
                850,

              fontSize:
                14,

              display:
                'flex',

              alignItems:
                'center',

              justifyContent:
                'center',

              gap: 10,

              cursor:
                loading
                  ? 'default'
                  : 'pointer',

              opacity:
                loading
                  ? 0.7
                  : 1,
            }}
          >
            <LogIn
              size={20}
            />

            {loading
              ? 'جاري تسجيل الدخول...'
              : 'تسجيل الدخول بحساب Google'}
          </button>

          {error && (
            <div
              style={{
                marginTop:
                  14,

                padding:
                  '11px 13px',

                borderRadius:
                  12,

                background:
                  'rgba(239,68,68,0.10)',

                border:
                  '1px solid rgba(239,68,68,0.20)',

                color:
                  '#f87171',

                fontSize:
                  11,

                lineHeight:
                  1.7,

                textAlign:
                  'center',
              }}
            >
              {error}
            </div>
          )}

          <p
            style={{
              margin:
                '18px 0 0',

              textAlign:
                'center',

              color:
                '#64748b',

              fontSize:
                10,

              lineHeight:
                1.8,
            }}
          >
            يتم استخدام Google للتحقق من الحساب فقط.
            بيانات المحاسبة الخاصة بك تبقى داخل التطبيق.
          </p>
        </div>
      </div>
    </div>
  );
                }
