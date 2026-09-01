import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  Delete,
  ShieldCheck,
  Mail,
  ArrowRight,
  KeyRound,
  LockKeyhole,
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

type RecoveryStep =
  | 'none'
  | 'send'
  | 'verify'
  | 'newPin'
  | 'confirmPin';

export function AppLockScreen({
  onUnlock,
}: AppLockScreenProps) {
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
      await verifyRecoveryCode(recoveryEmail, cleanCode);

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
      setRecoveryMessage('الرقمان غير متطابقين');
      setConfirmPin('');
      return;
    }

    setRecoveryLoading(true);
    setRecoveryMessage('');

    try {
      await resetPinAfterRecovery(newPin);

      await signOutRecovery();

      setRecoveryMessage('تم تغيير الرقم السري بنجاح');

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
      <div dir="rtl" style={screenStyle}>
        <Decorations />

        <div style={recoveryContainerStyle}>
          <button
            type="button"
            onClick={closeRecovery}
            style={backButtonStyle}
          >
            <ArrowRight size={20} />
            رجوع
          </button>

          <div style={recoveryContentStyle}>
            <GoldLogo
              icon={
                recoveryStep === 'newPin' ||
                recoveryStep === 'confirmPin' ? (
                  <KeyRound size={34} />
                ) : (
                  <Mail size={34} />
                )
              }
            />

            <h1 style={recoveryTitleStyle}>
              استعادة الرقم السري
            </h1>

            <div style={goldSmallLineStyle} />

            {recoveryStep === 'send' && (
              <>
                <p style={descriptionStyle}>
                  سيتم إرسال رمز تحقق إلى البريد المسجل
                </p>

                <div style={emailBoxStyle}>
                  <Mail size={18} color="#e7bd5a" />

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
                  <strong style={{ color: '#f5d77c' }}>
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
                  تم التحقق من بريدك بنجاح
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
              <div style={recoveryMessageStyle}>
                {recoveryMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" style={screenStyle}>
      <Decorations />

      <div style={mainContainerStyle}>
        <div style={topBrandStyle}>
          <BrandLogo />

          <h1 style={brandTitleStyle}>BAKR PRO</h1>

          <div style={brandSubtitleStyle}>
            تطبيق المحاسبة الاحترافي
          </div>

          <div style={phoneStyle}>
            0558995962
          </div>
        </div>

        <div style={securityBadgeStyle}>
          <ShieldCheck size={15} strokeWidth={2.3} />
          <span>التطبيق محمي</span>
        </div>

        <div style={goldDividerStyle}>
          <span />
          <div />
          <span />
        </div>

        <div style={lockIconStyle}>
          <LockKeyhole size={24} />
        </div>

        <h2 style={pinTitleStyle}>
          أدخل الرقم السري
        </h2>

        <p style={pinDescriptionStyle}>
          أدخل رمز PIN المكون من 4 أرقام
        </p>

        <div dir="ltr" style={pinDotsContainerStyle}>
          {[0, 1, 2, 3].map((index) => {
            const active = pin.length > index;

            return (
              <div
                key={index}
                style={{
                  width: active ? 16 : 14,
                  height: active ? 16 : 14,
                  borderRadius: '50%',
                  boxSizing: 'border-box',
                  background: active
                    ? 'linear-gradient(145deg,#fff1a8,#d49a24)'
                    : 'rgba(255,255,255,0.025)',
                  border: active
                    ? '2px solid #f3ca63'
                    : '2px solid rgba(229,184,75,0.65)',
                  boxShadow: active
                    ? '0 0 18px rgba(234,184,66,0.65)'
                    : '0 0 8px rgba(234,184,66,0.08)',
                  transition: 'all 120ms ease',
                }}
              />
            );
          })}
        </div>

        <div style={errorContainerStyle}>
          {error && (
            <div style={errorStyle}>
              {error}
            </div>
          )}
        </div>

        <div dir="ltr" style={keypadStyle}>
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
              ...deleteButtonStyle,
              opacity:
                checking || pin.length === 0
                  ? 0.35
                  : 1,
            }}
          >
            <Delete size={25} />
          </button>
        </div>

        <button
          type="button"
          onClick={openRecovery}
          style={forgotButtonStyle}
        >
          نسيت الرقم السري؟
        </button>

        <div style={bottomAreaStyle}>
          <div style={featuresStyle}>
            <Feature
              icon={<ShieldCheck size={15} />}
              text="أمان"
            />

            <Feature
              icon={<KeyRound size={15} />}
              text="حماية"
            />

            <Feature
              icon={<LockKeyhole size={15} />}
              text="خصوصية"
            />
          </div>

          <div style={copyrightStyle}>
            © BAKR_ALMASBHI — جميع حقوق التصميم محفوظة
          </div>
        </div>
      </div>
    </div>
  );
}

function Decorations() {
  return (
    <>
      <div
        style={{
          position: 'fixed',
          width: 260,
          height: 260,
          borderRadius: '50%',
          top: -140,
          right: -110,
          background:
            'radial-gradient(circle, rgba(213,162,49,0.13) 0%, rgba(213,162,49,0) 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'fixed',
          width: 320,
          height: 320,
          borderRadius: '50%',
          bottom: -190,
          left: -160,
          background:
            'radial-gradient(circle, rgba(195,144,35,0.10) 0%, rgba(195,144,35,0) 72%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'fixed',
          top: 115,
          left: -50,
          width: 160,
          height: 1,
          background:
            'linear-gradient(90deg, transparent, rgba(221,174,64,0.28), transparent)',
          transform: 'rotate(-45deg)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'fixed',
          bottom: 155,
          right: -45,
          width: 170,
          height: 1,
          background:
            'linear-gradient(90deg, transparent, rgba(221,174,64,0.22), transparent)',
          transform: 'rotate(-45deg)',
          pointerEvents: 'none',
        }}
      />
    </>
  );
}

function BrandLogo() {
  return (
    <div style={brandLogoOuterStyle}>
      <div style={brandLogoInnerStyle}>
        <span
          style={{
            fontSize: 43,
            lineHeight: 1,
            fontWeight: 950,
            fontFamily:
              'Arial Black, Arial, sans-serif',
            letterSpacing: -4,
            background:
              'linear-gradient(180deg,#fff1a6 0%,#e4b74e 42%,#a96d0b 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter:
              'drop-shadow(0 4px 7px rgba(0,0,0,0.45))',
          }}
        >
          B
        </span>
      </div>
    </div>
  );
}

function GoldLogo({
  icon,
}: {
  icon: ReactNode;
}) {
  return (
    <div style={recoveryLogoOuterStyle}>
      <div style={recoveryLogoInnerStyle}>
        {icon}
      </div>
    </div>
  );
}

type PinButtonProps = {
  children: ReactNode;
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
        width: 70,
        height: 70,
        justifySelf: 'center',
        borderRadius: '50%',
        border:
          '1px solid rgba(229,184,75,0.65)',
        background:
          'radial-gradient(circle at 35% 25%, rgba(255,255,255,0.075), rgba(255,255,255,0.025) 48%, rgba(0,0,0,0.10) 100%)',
        color: '#f9e8ae',
        fontSize: 25,
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow:
          'inset 0 0 0 1px rgba(255,255,255,0.025), 0 7px 18px rgba(0,0,0,0.24), 0 0 10px rgba(212,158,38,0.07)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {children}
    </button>
  );
}

function Feature({
  icon,
  text,
}: {
  icon: ReactNode;
  text: string;
}) {
  return (
    <div style={featureItemStyle}>
      <div style={featureIconStyle}>
        {icon}
      </div>

      <span>{text}</span>
    </div>
  );
}

const screenStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 999999,
  minHeight: '100dvh',
  background:
    'radial-gradient(circle at 50% -15%, #182231 0%, #0c121b 31%, #070b11 64%, #040609 100%)',
  color: '#ffffff',
  display: 'flex',
  justifyContent: 'center',
  overflowY: 'auto',
  overflowX: 'hidden',
};

const mainContainerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: '100%',
  maxWidth: 430,
  minHeight: '100dvh',
  padding:
    'calc(env(safe-area-inset-top, 0px) + 27px) 24px calc(env(safe-area-inset-bottom, 0px) + 18px)',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const topBrandStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const brandLogoOuterStyle: CSSProperties = {
  width: 77,
  height: 77,
  borderRadius: 24,
  padding: 1,
  boxSizing: 'border-box',
  background:
    'linear-gradient(145deg,#f4d170,#9b6612,#f2cc64)',
  boxShadow:
    '0 13px 38px rgba(0,0,0,0.42), 0 0 26px rgba(214,162,42,0.12)',
};

const brandLogoInnerStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  borderRadius: 23,
  background:
    'linear-gradient(145deg,#121922,#080c12)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const brandTitleStyle: CSSProperties = {
  margin: '12px 0 0',
  fontSize: 27,
  lineHeight: 1,
  fontWeight: 950,
  letterSpacing: 1.3,
  textAlign: 'center',
  background:
    'linear-gradient(180deg,#fff1b0 0%,#e2b34b 55%,#a66c0e 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

const brandSubtitleStyle: CSSProperties = {
  marginTop: 6,
  color: '#d9c28c',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.1,
};

const phoneStyle: CSSProperties = {
  marginTop: 3,
  color: 'rgba(218,194,139,0.52)',
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: 1.3,
  direction: 'ltr',
};

const securityBadgeStyle: CSSProperties = {
  marginTop: 16,
  padding: '6px 14px',
  borderRadius: 999,
  border:
    '1px solid rgba(226,180,73,0.25)',
  background:
    'rgba(218,166,46,0.055)',
  color: '#dcb95e',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
  fontWeight: 800,
};

const goldDividerStyle: CSSProperties = {
  width: '100%',
  maxWidth: 300,
  marginTop: 15,
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  alignItems: 'center',
  gap: 8,
};

const lockIconStyle: CSSProperties = {
  marginTop: 14,
  width: 38,
  height: 38,
  borderRadius: 13,
  border:
    '1px solid rgba(227,181,72,0.28)',
  background:
    'linear-gradient(145deg,rgba(225,176,61,0.10),rgba(255,255,255,0.015))',
  color: '#e2b64e',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const pinTitleStyle: CSSProperties = {
  margin: '10px 0 0',
  fontSize: 19,
  lineHeight: 1.3,
  fontWeight: 900,
  color: '#f4f1e8',
};

const pinDescriptionStyle: CSSProperties = {
  margin: '5px 0 0',
  color: '#777d86',
  fontSize: 11,
};

const pinDotsContainerStyle: CSSProperties = {
  display: 'flex',
  gap: 18,
  marginTop: 18,
  height: 20,
  alignItems: 'center',
  justifyContent: 'center',
};

const errorContainerStyle: CSSProperties = {
  minHeight: 34,
  marginTop: 5,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const errorStyle: CSSProperties = {
  color: '#ffb3a8',
  fontSize: 11,
  fontWeight: 800,
  background: 'rgba(190,51,38,0.10)',
  border:
    '1px solid rgba(255,105,90,0.18)',
  borderRadius: 9,
  padding: '6px 12px',
  textAlign: 'center',
};

const keypadStyle: CSSProperties = {
  width: '100%',
  maxWidth: 290,
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 12,
  marginTop: 2,
};

const deleteButtonStyle: CSSProperties = {
  width: 70,
  height: 70,
  justifySelf: 'center',
  borderRadius: '50%',
  border:
    '1px solid rgba(229,184,75,0.65)',
  background:
    'linear-gradient(145deg,#f1cb67,#bd831c)',
  color: '#171006',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow:
    '0 8px 22px rgba(177,117,13,0.18)',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
};

const forgotButtonStyle: CSSProperties = {
  marginTop: 11,
  border: 'none',
  background: 'transparent',
  color: '#dcb558',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
  padding: '8px 16px',
};

const bottomAreaStyle: CSSProperties = {
  width: '100%',
  marginTop: 'auto',
  paddingTop: 13,
};

const featuresStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  display: 'flex',
  justifyContent: 'center',
  gap: 8,
  padding: '8px',
  borderRadius: 13,
  border:
    '1px solid rgba(224,177,67,0.16)',
  background:
    'linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.012))',
};

const featureItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  color: '#a99d82',
  fontSize: 9,
  fontWeight: 700,
};

const featureIconStyle: CSSProperties = {
  color: '#d8aa42',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const copyrightStyle: CSSProperties = {
  marginTop: 8,
  textAlign: 'center',
  color: '#595b5f',
  fontSize: 8,
  letterSpacing: 0.15,
};

const recoveryContainerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: '100%',
  maxWidth: 430,
  minHeight: '100dvh',
  padding:
    'calc(env(safe-area-inset-top, 0px) + 30px) 24px calc(env(safe-area-inset-bottom, 0px) + 28px)',
  boxSizing: 'border-box',
};

const backButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#c9a957',
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  padding: 0,
};

const recoveryContentStyle: CSSProperties = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  marginTop: 38,
};

const recoveryLogoOuterStyle: CSSProperties = {
  width: 78,
  height: 78,
  borderRadius: 24,
  padding: 1,
  background:
    'linear-gradient(145deg,#f1ce6d,#9e6914,#e7b94f)',
  boxSizing: 'border-box',
  boxShadow:
    '0 16px 40px rgba(0,0,0,0.35)',
};

const recoveryLogoInnerStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  borderRadius: 23,
  background:
    'linear-gradient(145deg,#141b24,#080c12)',
  color: '#e7ba50',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const recoveryTitleStyle: CSSProperties = {
  fontSize: 23,
  margin: '20px 0 8px',
  fontWeight: 900,
  textAlign: 'center',
  color: '#f2e9d0',
};

const goldSmallLineStyle: CSSProperties = {
  width: 44,
  height: 2,
  borderRadius: 10,
  background:
    'linear-gradient(90deg,#8e5a08,#f0cd6c,#8e5a08)',
  marginBottom: 10,
};

const inputStyle: CSSProperties = {
  width: '100%',
  height: 55,
  boxSizing: 'border-box',
  marginTop: 22,
  borderRadius: 14,
  border:
    '1px solid rgba(226,180,73,0.30)',
  background:
    'rgba(255,255,255,0.035)',
  color: '#f7e7b2',
  outline: 'none',
  padding: '0 16px',
  fontSize: 16,
  textAlign: 'center',
  boxShadow:
    'inset 0 0 18px rgba(0,0,0,0.16)',
};

const primaryButtonStyle: CSSProperties = {
  width: '100%',
  height: 53,
  marginTop: 18,
  border:
    '1px solid rgba(255,224,139,0.45)',
  borderRadius: 14,
  background:
    'linear-gradient(145deg,#edc761,#b67a18)',
  color: '#151006',
  fontSize: 14,
  fontWeight: 900,
  cursor: 'pointer',
  boxShadow:
    '0 10px 26px rgba(173,112,13,0.18)',
};

const secondaryButtonStyle: CSSProperties = {
  width: '100%',
  height: 48,
  marginTop: 10,
  borderRadius: 14,
  border:
    '1px solid rgba(226,180,73,0.25)',
  background:
    'rgba(255,255,255,0.025)',
  color: '#d9b758',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
};

const emailBoxStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 20,
  padding: '15px',
  borderRadius: 14,
  background:
    'rgba(218,165,45,0.055)',
  border:
    '1px solid rgba(226,180,73,0.22)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 9,
  color: '#e0c77e',
};

const descriptionStyle: CSSProperties = {
  color: '#8c9198',
  textAlign: 'center',
  lineHeight: 1.8,
  fontSize: 13,
  marginTop: 10,
};

const recoveryMessageStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 17,
  padding: '11px 14px',
  borderRadius: 12,
  background:
    'rgba(218,165,45,0.055)',
  border:
    '1px solid rgba(226,180,73,0.18)',
  color: '#e4c979',
  fontSize: 12,
  textAlign: 'center',
  lineHeight: 1.7,
};
