import {
  useEffect,
} from 'react';

import {
  ShieldCheck,
} from 'lucide-react';

type Props = {
  onAuthenticated: () => void;
};

export function GoogleLoginScreen({
  onAuthenticated,
}: Props) {
  useEffect(() => {
    onAuthenticated();
  }, [onAuthenticated]);

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#050b14] flex items-center justify-center p-5"
    >
      <div className="w-full max-w-sm text-center">

        <div className="w-24 h-24 mx-auto rounded-[28px] bg-gradient-to-br from-[#d7b45a] to-[#9b7628] flex items-center justify-center shadow-2xl">
          <ShieldCheck className="w-12 h-12 text-[#07101f]" />
        </div>

        <h1 className="mt-6 text-3xl font-black text-white">
          BAAKR PRO
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          نظام إدارة ومحاسبة المعدات
        </p>

        <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-4 h-4 text-green-400" />

          <span>
            يعمل محليًا بدون الحاجة للإنترنت
          </span>
        </div>

      </div>
    </div>
  );
}

export default GoogleLoginScreen;
