import React, { useState } from 'react';
import { MailCheck, ArrowLeft, KeyRound } from 'lucide-react';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';

interface CheckEmailViewProps {
  lang: Language;
  email: string;
  mode: 'verify' | 'reset';
  onBackToLogin: () => void;
  onHaveResetLink?: () => void;
}

export const CheckEmailView: React.FC<CheckEmailViewProps> = ({
  lang,
  email,
  mode,
  onBackToLogin,
  onHaveResetLink,
}) => {
  const { resendVerificationEmail, sendPasswordResetEmail } = useAuth();
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    setResent(false);
    if (mode === 'verify') {
      await resendVerificationEmail(email);
    } else {
      await sendPasswordResetEmail(email);
    }
    setResent(true);
  };

  return (
    <div className="space-y-5 text-center py-2">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-[#ECFDF5] dark:bg-slate-800 border border-[#DDEDE8] dark:border-slate-700 flex items-center justify-center">
        <MailCheck className="w-7 h-7 text-[#0F766E] dark:text-teal-400" />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-lg font-extrabold text-[#12312B] dark:text-slate-100">
          {getTranslation(lang, 'authCheckEmailTitle')}
        </h3>
        <p className="text-xs text-[#64748B] dark:text-slate-400 leading-relaxed">
          {getTranslation(lang, mode === 'verify' ? 'authCheckEmailVerifyDesc' : 'authCheckEmailResetDesc')}
        </p>
      </div>

      <div className="px-4 py-2.5 rounded-xl bg-[#F3FAF7] dark:bg-slate-800/60 border border-[#DDEDE8] dark:border-slate-700 inline-block">
        <span className="text-sm font-bold text-[#0F766E] dark:text-teal-400 font-mono break-all">{email}</span>
      </div>

      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={handleResend}
          className="w-full py-2.5 rounded-xl border border-[#DDEDE8] dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-[#12312B] dark:text-slate-100 hover:bg-[#F3FAF7] dark:hover:bg-slate-800 transition-all cursor-pointer"
        >
          {getTranslation(lang, resent ? 'authEmailResent' : 'authResendEmail')}
        </button>

        {mode === 'reset' && onHaveResetLink && (
          <button
            type="button"
            onClick={onHaveResetLink}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-[#0F766E] dark:text-teal-400 hover:underline cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" /> {getTranslation(lang, 'authEnterResetLinkManually')}
          </button>
        )}

        <button
          type="button"
          onClick={onBackToLogin}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#0F766E] dark:hover:text-teal-400 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {getTranslation(lang, 'authBackToLogin')}
        </button>
      </div>
    </div>
  );
};
