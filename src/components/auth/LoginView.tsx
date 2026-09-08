import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, LogIn, Chrome, AlertCircle } from 'lucide-react';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { isValidEmail } from '../../utils/authValidation';
import { useAuth } from '../../context/AuthContext';

interface LoginViewProps {
  lang: Language;
  onSwitchToRegister: () => void;
  onSwitchToForgot: () => void;
  onSignedIn: () => void;
}

const inputWrapperClass =
  'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-[#DDEDE8] dark:border-slate-700 bg-[#F3FAF7] dark:bg-slate-800/60 focus-within:ring-2 focus-within:ring-[#0F766E]/30 focus-within:border-[#0F766E] transition-all';
const inputFieldClass =
  'flex-1 bg-transparent outline-none text-sm text-[#12312B] dark:text-slate-100 placeholder:text-[#94A3B8] dark:placeholder:text-slate-500';

export const LoginView: React.FC<LoginViewProps> = ({ lang, onSwitchToRegister, onSwitchToForgot, onSignedIn }) => {
  const { signIn, signInWithGoogle, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const emailError = touched && email.length > 0 && !isValidEmail(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setFormError(null);
    if (!isValidEmail(email) || password.length === 0) return;

    if (!configured) {
      setFormError(getTranslation(lang, 'authNotConfigured'));
      return;
    }

    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);

    if (error) {
      setFormError(error);
      return;
    }
    onSignedIn();
  };

  const handleGoogle = async () => {
    setFormError(null);
    if (!configured) {
      setFormError(getTranslation(lang, 'authNotConfigured'));
      return;
    }
    const { error } = await signInWithGoogle();
    if (error) setFormError(error);
    // On success, Supabase redirects the browser away to Google — nothing
    // else to do here.
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <h3 className="text-lg font-extrabold text-[#12312B] dark:text-slate-100">
          {getTranslation(lang, 'authWelcomeBack')}
        </h3>
        <p className="text-xs text-[#64748B] dark:text-slate-400">{getTranslation(lang, 'authLoginSubtitle')}</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="auth-login-email" className="text-xs font-semibold text-[#12312B] dark:text-slate-200">
          {getTranslation(lang, 'authEmailLabel')}
        </label>
        <div className={inputWrapperClass}>
          <Mail className="w-4 h-4 text-[#0F766E] dark:text-teal-400 shrink-0" />
          <input
            id="auth-login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={getTranslation(lang, 'authEmailPlaceholder')}
            className={inputFieldClass}
            aria-invalid={emailError}
            aria-describedby={emailError ? 'auth-login-email-error' : undefined}
          />
        </div>
        {emailError && (
          <p id="auth-login-email-error" className="flex items-center gap-1 text-[11px] text-[#EF4444]">
            <AlertCircle className="w-3 h-3 shrink-0" /> {getTranslation(lang, 'authInvalidEmail')}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="auth-login-password" className="text-xs font-semibold text-[#12312B] dark:text-slate-200">
            {getTranslation(lang, 'authPasswordLabel')}
          </label>
          <button
            type="button"
            onClick={onSwitchToForgot}
            className="text-[11px] font-semibold text-[#0F766E] dark:text-teal-400 hover:underline cursor-pointer"
          >
            {getTranslation(lang, 'authForgotPasswordLink')}
          </button>
        </div>
        <div className={inputWrapperClass}>
          <Lock className="w-4 h-4 text-[#0F766E] dark:text-teal-400 shrink-0" />
          <input
            id="auth-login-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
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
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-[#DDEDE8] text-[#0F766E] focus:ring-[#0F766E]/30"
        />
        <span className="text-xs text-[#64748B] dark:text-slate-400">{getTranslation(lang, 'authRememberMe')}</span>
      </label>

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
        <LogIn className="w-4 h-4" />
        {getTranslation(lang, submitting ? 'authSigningIn' : 'authSignInButton')}
      </button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[#DDEDE8] dark:bg-slate-700" />
        <span className="text-[11px] text-[#94A3B8] dark:text-slate-500">{getTranslation(lang, 'authOrDivider')}</span>
        <div className="h-px flex-1 bg-[#DDEDE8] dark:bg-slate-700" />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#DDEDE8] dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-[#12312B] dark:text-slate-100 hover:bg-[#F3FAF7] dark:hover:bg-slate-800 transition-all cursor-pointer"
      >
        <Chrome className="w-4 h-4 text-[#0F766E] dark:text-teal-400" />
        {getTranslation(lang, 'authContinueWithGoogle')}
      </button>

      <p className="text-center text-xs text-[#64748B] dark:text-slate-400">
        {getTranslation(lang, 'authNoAccount')}{' '}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="font-bold text-[#0F766E] dark:text-teal-400 hover:underline cursor-pointer"
        >
          {getTranslation(lang, 'authCreateAccountLink')}
        </button>
      </p>
    </form>
  );
};
