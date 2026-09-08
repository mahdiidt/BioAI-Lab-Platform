import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { isValidEmail, getPasswordStrength, passwordsMatch } from '../../utils/authValidation';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { useAuth } from '../../context/AuthContext';

interface RegisterViewProps {
  lang: Language;
  onSwitchToLogin: () => void;
  onRegistered: (email: string) => void;
}

const inputWrapperClass =
  'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-[#DDEDE8] dark:border-slate-700 bg-[#F3FAF7] dark:bg-slate-800/60 focus-within:ring-2 focus-within:ring-[#0F766E]/30 focus-within:border-[#0F766E] transition-all';
const inputFieldClass =
  'flex-1 bg-transparent outline-none text-sm text-[#12312B] dark:text-slate-100 placeholder:text-[#94A3B8] dark:placeholder:text-slate-500';

export const RegisterView: React.FC<RegisterViewProps> = ({ lang, onSwitchToLogin, onRegistered }) => {
  const { signUp, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const emailError = touched && email.length > 0 && !isValidEmail(email);
  const strength = getPasswordStrength(password);
  const confirmError = touched && confirmPassword.length > 0 && !passwordsMatch(password, confirmPassword);

  const isFormValid =
    isValidEmail(email) && strength.score >= 2 && passwordsMatch(password, confirmPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setFormError(null);
    if (!isFormValid) return;

    if (!configured) {
      setFormError(getTranslation(lang, 'authNotConfigured'));
      return;
    }

    setSubmitting(true);
    const { error } = await signUp(email, password);
    setSubmitting(false);

    if (error) {
      setFormError(error);
      return;
    }
    onRegistered(email);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <h3 className="text-lg font-extrabold text-[#12312B] dark:text-slate-100">
          {getTranslation(lang, 'authCreateAccountTitle')}
        </h3>
        <p className="text-xs text-[#64748B] dark:text-slate-400">{getTranslation(lang, 'authRegisterSubtitle')}</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="auth-register-email" className="text-xs font-semibold text-[#12312B] dark:text-slate-200">
          {getTranslation(lang, 'authEmailLabel')}
        </label>
        <div className={inputWrapperClass}>
          <Mail className="w-4 h-4 text-[#0F766E] dark:text-teal-400 shrink-0" />
          <input
            id="auth-register-email"
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

      <div className="space-y-1.5">
        <label htmlFor="auth-register-password" className="text-xs font-semibold text-[#12312B] dark:text-slate-200">
          {getTranslation(lang, 'authPasswordLabel')}
        </label>
        <div className={inputWrapperClass}>
          <Lock className="w-4 h-4 text-[#0F766E] dark:text-teal-400 shrink-0" />
          <input
            id="auth-register-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={inputFieldClass}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="shrink-0 text-[#64748B] dark:text-slate-400 hover:text-[#0F766E] dark:hover:text-teal-400 cursor-pointer"
            aria-label={getTranslation(lang, showPassword ? 'authHidePassword' : 'authShowPassword')}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <PasswordStrengthMeter password={password} lang={lang} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="auth-register-confirm" className="text-xs font-semibold text-[#12312B] dark:text-slate-200">
          {getTranslation(lang, 'authConfirmPasswordLabel')}
        </label>
        <div className={inputWrapperClass}>
          <Lock className="w-4 h-4 text-[#0F766E] dark:text-teal-400 shrink-0" />
          <input
            id="auth-register-confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="••••••••"
            className={inputFieldClass}
          />
          {confirmPassword.length > 0 && !confirmError && (
            <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0" />
          )}
        </div>
        {confirmError && (
          <p className="flex items-center gap-1 text-[11px] text-[#EF4444]">
            <AlertCircle className="w-3 h-3 shrink-0" /> {getTranslation(lang, 'authPasswordMismatch')}
          </p>
        )}
      </div>

      <p className="text-[11px] text-[#64748B] dark:text-slate-400 leading-relaxed">
        {getTranslation(lang, 'authPasswordRequirements')}
      </p>

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
        <UserPlus className="w-4 h-4" />
        {getTranslation(lang, submitting ? 'authCreatingAccount' : 'authCreateAccountButton')}
      </button>

      <p className="text-center text-xs text-[#64748B] dark:text-slate-400">
        {getTranslation(lang, 'authHaveAccount')}{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-bold text-[#0F766E] dark:text-teal-400 hover:underline cursor-pointer"
        >
          {getTranslation(lang, 'authSignInLink')}
        </button>
      </p>
    </form>
  );
};
