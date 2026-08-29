import { useState } from 'react';
import { LockKeyhole, Delete, ShieldCheck } from 'lucide-react';
import { verifyAppPin } from '@/lib/appLock';

type AppLockScreenProps = {
  onUnlock: () => void;
};

export function AppLockScreen({ onUnlock }: AppLockScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  async function checkPin(value: string) {
    if (value.length !== 4 || checking) return;

    setChecking(true);
    setError('');

    try {
      const correct = await verifyAppPin(value);

      if (correct) {
        setPin('');
        onUnlock();
        return;
      }

      setError('الرقم السري غير صحيح');
      setPin('');

      if (navigator.vibrate) {
        navigator.vibrate([80, 50, 80]);
      }
    } catch (err) {
      console.error(err);
      setError('حدث خطأ، حاول مرة أخرى');
      setPin('');
    } finally {
      setChecking(false);
    }
  }

  function addNumber(number: string) {
    if (checking || pin.length >= 4) return;

    const nextPin = pin + number;
    setPin(nextPin);
    setError('');

    if (nextPin.length === 4) {
      window.setTimeout(() => {
        checkPin(nextPin);
      }, 120);
    }
  }

  function removeNumber() {
    if (checking) return;

    setPin((current) => current.slice(0, -1));
    setError('');
  }

  return (
    <div
      dir="rtl"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        minHeight: '100dvh',
        background:
          'radial-gradient(circle at top, #132a4a 0%, #07101f 45%, #030712 100%)',
        color: '#ffffff',
        display: 'flex',
        justifyContent: 'center',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 430,
          minHeight: '100dvh',
          padding:
            'calc(env(safe-area-inset-top, 0px) + 42px) 24px calc(env(safe-area-inset-bottom, 0px) + 30px)',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* الشعار */}
        <div
          style={{
            width: 86,
            height: 86,
            borderRadius: 28,
            background:
              'linear-gradient(145deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 18px 50px rgba(37,99,235,0.32)',
            marginBottom: 24,
          }}
        >
          <LockKeyhole size={42} strokeWidth={2.2} />
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 30,
            fontWeight: 900,
            textAlign: 'center',
          }}
        >
          BAAKR PRO
        </h1>

        <div
          style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: '#94a3b8',
            fontSize: 14,
          }}
        >
          <ShieldCheck size={16} />
          التطبيق محمي
        </div>

        <h2
          style={{
            margin: '36px 0 7px',
            fontSize: 20,
            fontWeight: 800,
          }}
        >
          أدخل الرقم السري
        </h2>

        <p
          style={{
            margin: 0,
            color: '#94a3b8',
            fontSize: 13,
          }}
        >
          أدخل رمز PIN المكون من 4 أرقام
        </p>

        {/* نقاط الرقم السري */}
        <div
          dir="ltr"
          style={{
            display: 'flex',
            gap: 18,
            marginTop: 30,
            height: 22,
            alignItems: 'center',
          }}
        >
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              style={{
                width: pin.length > index ? 17 : 14,
                height: pin.length > index ? 17 : 14,
                borderRadius: '50%',
                boxSizing: 'border-box',
                background:
                  pin.length > index ? '#3b82f6' : 'transparent',
                border:
                  pin.length > index
                    ? '2px solid #60a5fa'
                    : '2px solid #64748b',
                boxShadow:
                  pin.length > index
                    ? '0 0 16px rgba(59,130,246,0.65)'
                    : 'none',
                transition: 'all 0.15s ease',
              }}
            />
          ))}
        </div>

        {/* رسالة الخطأ */}
        <div
          style={{
            height: 40,
            marginTop: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {error && (
            <div
              style={{
                color: '#fca5a5',
                fontSize: 13,
                fontWeight: 700,
                background: 'rgba(239,68,68,0.10)',
                border: '1px solid rgba(239,68,68,0.18)',
                borderRadius: 10,
                padding: '7px 13px',
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* لوحة الأرقام */}
        <div
          dir="ltr"
          style={{
            width: '100%',
            maxWidth: 330,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 15,
            marginTop: 12,
          }}
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(
            (number) => (
              <PinButton
                key={number}
                disabled={checking}
                onClick={() => addNumber(number)}
              >
                {number}
              </PinButton>
            )
          )}

          <div />

          <PinButton
            disabled={checking}
            onClick={() => addNumber('0')}
          >
            0
          </PinButton>

          <button
            type="button"
            disabled={checking || pin.length === 0}
            onClick={removeNumber}
            aria-label="حذف رقم"
            style={{
              width: 76,
              height: 76,
              justifySelf: 'center',
              borderRadius: '50%',
              border: 'none',
              background: 'transparent',
              color: pin.length === 0 ? '#475569' : '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Delete size={28} />
          </button>
        </div>

        <div
          style={{
            marginTop: 'auto',
            paddingTop: 30,
            color: '#64748b',
            fontSize: 12,
            textAlign: 'center',
          }}
        >
          🔒 بياناتك محمية داخل BAAKR PRO
        </div>
      </div>
    </div>
  );
}

type PinButtonProps = {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

function PinButton({
  children,
  onClick,
  disabled,
}: PinButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 76,
        height: 76,
        justifySelf: 'center',
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.10)',
        background: 'rgba(255,255,255,0.055)',
        color: '#ffffff',
        fontSize: 27,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
                }
