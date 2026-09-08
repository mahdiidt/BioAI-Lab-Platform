import React, { useState } from 'react';
import { Mail, Send, ArrowLeft, AlertCircle } from 'lucide-react';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { isValidEmail } from '../../utils/authValidation';
import { useAuth } from '../../context/AuthContext';

interface ForgotPasswordViewProps {
  lang: Language;
  onBackToLogin: () => void;
  onSent: (email: string) => void;
}

const inputWrapperClass =
  'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-[#DDEDE8] dark:border-slate-700 bg-[#F3FAF7] dark:bg-slate-800/60 focus-within:ring-2 focus-within:ring-[#0F766E]/30 focus-within:border-[#0F766E] transition-all';
const inputFieldClass =
  'flex-1 bg-transparent outline-none text-sm text-[#12312B] dark:text-slate-100 placeholder:text-[#94A3B8] dark:placeholder:text-slate-500';

export const ForgotPasswordView: React.FC<ForgotPasswordViewProps> = ({ lang, onBackToLogin, onSent }) => {
  const { sendPasswordResetEmail, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const emailError = touched && email.length > 0 && !isValidEmail(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setFormError(null);
    if (!isValidEmail(email)) return;

    if (!configured) {
      setFormError(getTranslation(lang, 'authNotConfigured'));
      return;
    }

    setSubmitting(true);
    const { error } = await sendPasswordResetEmail(email);
    setSubmitting(false);

    if (error) {
      setFormError(error);
      return;
    }
    onSent(email);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <button
        type="button"
        onClick={onBackToLogin}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#0F766E] dark:hover:text-teal-400 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> {getTranslation(lang, 'authBackToLogin')}
      </button>

      <div className="space-y-1.5">
        <h3 className="text-lg font-extrabold text-[#12312B] dark:text-slate-100">
          {getTranslation(lang, 'authForgotPasswordTitle')}
        </h3>
        <p className="text-xs text-[#64748B] dark:text-slate-400">{getTranslation(lang, 'authForgotPasswordSubtitle')}</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="auth-forgot-email" className="text-xs font-semibold text-[#12312B] dark:text-slate-200">
          {getTranslation(lang, 'authEmailLabel')}
        </label>
        <div className={inputWrapperClass}>
          <Mail className="w-4 h-4 text-[#0F766E] dark:text-teal-400 shrink-0" />
          <input
            id="auth-forgot-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={getTranslation(lang, 'authEmailPlaceholder')}
            className={inputFieldClass}
            aria-invalid={emailError}
          />
        </div>
        {emailError && (
          <p className="flex items-center gap-1 text-[11px] text-[#EF4444]">
            <AlertCircle className="w-3 h-3 shrink-0" /> {getTranslation(lang, 'authInvalidEmail')}
          </p>
        )}
      </div>

      {formError && (
        <p className="flex items-center gap-1 text-[11px] text-[#EF4444]">
          <AlertCircle className="w-3 h-3 shrink-0" /> {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-tr from-[#0F766E] to-[#14B8A6] text-white text-sm font-bold shadow-md shadow-[#0F766E]/20 hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait"
      >
        <Send className="w-4 h-4" />
        {getTranslation(lang, submitting ? 'authSendingLink' : 'authSendResetLink')}
      </button>
    </form>
  );
};
