import { useState } from 'react';
import {
  LockKeyhole,
  Delete,
  ShieldCheck,
  Mail,
  ArrowRight,
  KeyRound,
} from 'lucide-react';

import {
  verifyAppPin,
  getRecoveryEmail,
  hasRecoveryEmail,
  maskRecoveryEmail,
  setRecoveryVerified,
  resetPinAfterRecovery,
} from '@/lib/appLock';

import {
  sendRecoveryCode,
  verifyRecoveryCode,
  signOutRecovery,
} from '@/lib/recoveryAuth';

type AppLockScreenProps = {
  onUnlock: () => void;
};

type RecoveryStep = 'none' | 'send' | 'verify' | 'newPin' | 'confirmPin';

export function AppLockScreen({ onUnlock }: AppLockScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const [recoveryStep, setRecoveryStep] =
    useState<RecoveryStep>('none');

  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const recoveryEmail = getRecoveryEmail();

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

  function openRecovery() {
    setError('');
    setRecoveryMessage('');
    setRecoveryCode('');
    setNewPin('');
    setConfirmPin('');

    if (!hasRecoveryEmail()) {
      setError(
        'لم يتم تسجيل بريد للاسترجاع. افتح الإعدادات وسجل بريد الاسترجاع أولاً.'
      );
      return;
    }

    setRecoveryStep('send');
  }

  function closeRecovery() {
    setRecoveryStep('none');
    setRecoveryMessage('');
    setRecoveryCode('');
    setNewPin('');
    setConfirmPin('');
    setError('');
  }

  async function handleSendCode() {
    if (!recoveryEmail) {
      setRecoveryMessage('لا يوجد بريد استرجاع مسجل');
      return;
    }

    setRecoveryLoading(true);
    setRecoveryMessage('');

    try {
      await sendRecoveryCode(recoveryEmail);

      setRecoveryMessage(
        'تم إرسال رمز التحقق إلى بريدك الإلكتروني'
      );

      setRecoveryStep('verify');
    } catch (err) {
      console.error(err);

      setRecoveryMessage(
        err instanceof Error
          ? err.message
          : 'تعذر إرسال رمز التحقق'
      );
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function handleVerifyCode() {
    const cleanCode = recoveryCode.trim();

    if (!cleanCode) {
      setRecoveryMessage('أدخل رمز التحقق');
      return;
    }

    setRecoveryLoading(true);
    setRecoveryMessage('');

    try {
      await verifyRecoveryCode(
        recoveryEmail,
        cleanCode
      );

      setRecoveryVerified(true);

      setRecoveryMessage('تم التحقق من البريد بنجاح');

      setRecoveryStep('newPin');
    } catch (err) {
      console.error(err);

      setRecoveryMessage(
        'رمز التحقق غير صحيح أو انتهت صلاحيته'
      );
    } finally {
      setRecoveryLoading(false);
    }
  }

  function handleNewPin() {
    if (!/^\d{4}$/.test(newPin)) {
      setRecoveryMessage(
        'الرقم السري الجديد يجب أن يكون 4 أرقام'
      );
      return;
    }

    setRecoveryMessage('');
    setRecoveryStep('confirmPin');
  }

  async function handleResetPin() {
    if (!/^\d{4}$/.test(confirmPin)) {
      setRecoveryMessage(
        'أدخل تأكيد الرقم السري من 4 أرقام'
      );
      return;
    }

    if (newPin !== confirmPin) {
      setRecoveryMessage(
        'الرقمان غير متطابقين'
      );
      setConfirmPin('');
      return;
    }

    setRecoveryLoading(true);
    setRecoveryMessage('');

    try {
      await resetPinAfterRecovery(newPin);

      await signOutRecovery();

      setRecoveryMessage(
        'تم تغيير الرقم السري بنجاح'
      );

      window.setTimeout(() => {
        setRecoveryStep('none');
        setNewPin('');
        setConfirmPin('');
        setRecoveryCode('');
        onUnlock();
      }, 800);
    } catch (err) {
      console.error(err);

      setRecoveryMessage(
        err instanceof Error
          ? err.message
          : 'تعذر تغيير الرقم السري'
      );
    } finally {
      setRecoveryLoading(false);
    }
  }

  if (recoveryStep !== 'none') {
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
              'calc(env(safe-area-inset-top, 0px) + 35px) 24px calc(env(safe-area-inset-bottom, 0px) + 30px)',
            boxSizing: 'border-box',
          }}
        >
          <button
            type="button"
            onClick={closeRecovery}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 14,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <ArrowRight size={20} />
            رجوع
          </button>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginTop: 40,
            }}
          >
            <div
              style={{
                width: 82,
                height: 82,
                borderRadius: 26,
                background:
                  'linear-gradient(145deg,#3b82f6,#1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow:
                  '0 18px 50px rgba(37,99,235,0.30)',
              }}
            >
              {recoveryStep === 'newPin' ||
              recoveryStep === 'confirmPin' ? (
                <KeyRound size={40} />
              ) : (
                <Mail size={40} />
              )}
            </div>

            <h1
              style={{
                fontSize: 25,
                margin: '24px 0 8px',
                fontWeight: 900,
                textAlign: 'center',
              }}
            >
              استعادة الرقم السري
            </h1>

            {recoveryStep === 'send' && (
              <>
                <p
                  style={{
                    color: '#94a3b8',
                    textAlign: 'center',
                    lineHeight: 1.8,
                    fontSize: 14,
                  }}
                >
                  سيتم إرسال رمز تحقق إلى البريد
                </p>

                <div style={emailBoxStyle}>
                  <Mail size={19} color="#60a5fa" />

                  <span>
                    {maskRecoveryEmail(recoveryEmail)}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={recoveryLoading}
                  onClick={handleSendCode}
                  style={primaryButtonStyle}
                >
                  {recoveryLoading
                    ? 'جاري الإرسال...'
                    : 'إرسال رمز التحقق'}
                </button>
              </>
            )}

            {recoveryStep === 'verify' && (
              <>
                <p style={descriptionStyle}>
                  أدخل رمز التحقق الذي تم إرساله إلى
                  <br />
                  <strong style={{ color: '#ffffff' }}>
                    {maskRecoveryEmail(recoveryEmail)}
                  </strong>
                </p>

                <input
                  value={recoveryCode}
                  onChange={(e) =>
                    setRecoveryCode(
                      e.target.value.replace(/\D/g, '')
                    )
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="رمز التحقق"
                  style={inputStyle}
                />

                <button
                  type="button"
                  disabled={recoveryLoading}
                  onClick={handleVerifyCode}
                  style={primaryButtonStyle}
                >
                  {recoveryLoading
                    ? 'جاري التحقق...'
                    : 'تحقق من الرمز'}
                </button>

                <button
                  type="button"
                  disabled={recoveryLoading}
                  onClick={handleSendCode}
                  style={secondaryButtonStyle}
                >
                  إعادة إرسال الرمز
                </button>
              </>
            )}

            {recoveryStep === 'newPin' && (
              <>
                <p style={descriptionStyle}>
                  تم التحقق من بريدك.
                  <br />
                  اختر رقمًا سريًا جديدًا
                </p>

                <input
                  value={newPin}
                  onChange={(e) =>
                    setNewPin(
                      e.target.value
                        .replace(/\D/g, '')
                        .slice(0, 4)
                    )
                  }
                  inputMode="numeric"
                  type="password"
                  maxLength={4}
                  placeholder="PIN جديد من 4 أرقام"
                  style={inputStyle}
                />

                <button
                  type="button"
                  onClick={handleNewPin}
                  style={primaryButtonStyle}
                >
                  متابعة
                </button>
              </>
            )}

            {recoveryStep === 'confirmPin' && (
              <>
                <p style={descriptionStyle}>
                  أعد كتابة الرقم السري الجديد للتأكيد
                </p>

                <input
                  value={confirmPin}
                  onChange={(e) =>
                    setConfirmPin(
                      e.target.value
                        .replace(/\D/g, '')
                        .slice(0, 4)
                    )
                  }
                  inputMode="numeric"
                  type="password"
                  maxLength={4}
                  placeholder="تأكيد PIN الجديد"
                  style={inputStyle}
                />

                <button
                  type="button"
                  disabled={recoveryLoading}
                  onClick={handleResetPin}
                  style={primaryButtonStyle}
                >
                  {recoveryLoading
                    ? 'جاري الحفظ...'
                    : 'حفظ الرقم السري الجديد'}
                </button>
              </>
            )}

            {recoveryMessage && (
              <div
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  marginTop: 18,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'rgba(59,130,246,0.10)',
                  border:
                    '1px solid rgba(96,165,250,0.20)',
                  color: '#bfdbfe',
                  fontSize: 13,
                  textAlign: 'center',
                  lineHeight: 1.7,
                }}
              >
                {recoveryMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    );
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
        <div
          style={{
            width: 86,
            height: 86,
            borderRadius: 28,
            background:
              'linear-gradient(145deg,#3b82f6,#1d4ed8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow:
              '0 18px 50px rgba(37,99,235,0.32)',
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
                  pin.length > index
                    ? '#3b82f6'
                    : 'transparent',
                border:
                  pin.length > index
                    ? '2px solid #60a5fa'
                    : '2px solid #64748b',
                boxShadow:
                  pin.length > index
                    ? '0 0 16px rgba(59,130,246,0.65)'
                    : 'none',
              }}
            />
          ))}
        </div>

        <div
          style={{
            minHeight: 40,
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
                border:
                  '1px solid rgba(239,68,68,0.18)',
                borderRadius: 10,
                padding: '7px 13px',
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}
        </div>

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
          {[
            '1',
            '2',
            '3',
            '4',
            '5',
            '6',
            '7',
            '8',
            '9',
          ].map((number) => (
            <PinButton
              key={number}
              disabled={checking}
              onClick={() => addNumber(number)}
            >
              {number}
            </PinButton>
          ))}

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
              color:
                pin.length === 0
                  ? '#475569'
                  : '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Delete size={28} />
          </button>
        </div>

        <button
          type="button"
          onClick={openRecovery}
          style={{
            marginTop: 24,
            border: 'none',
            background: 'transparent',
            color: '#60a5fa',
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
            padding: '10px 16px',
          }}
        >
          نسيت الرقم السري؟
        </button>

        <div
          style={{
            marginTop: 'auto',
            paddingTop: 20,
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 56,
  boxSizing: 'border-box',
  marginTop: 24,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.055)',
  color: '#ffffff',
  outline: 'none',
  padding: '0 16px',
  fontSize: 17,
  textAlign: 'center',
};

const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  height: 54,
  marginTop: 18,
  border: 'none',
  borderRadius: 14,
  background:
    'linear-gradient(145deg,#3b82f6,#2563eb)',
  color: '#ffffff',
  fontSize: 15,
  fontWeight: 800,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  width: '100%',
  height: 48,
  marginTop: 10,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.04)',
  color: '#93c5fd',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};

const emailBoxStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 22,
  padding: '16px',
  borderRadius: 14,
  background: 'rgba(59,130,246,0.08)',
  border: '1px solid rgba(96,165,250,0.18)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  color: '#bfdbfe',
};

const descriptionStyle: React.CSSProperties = {
  color: '#94a3b8',
  textAlign: 'center',
  lineHeight: 1.8,
  fontSize: 14,
  marginTop: 10,
};
