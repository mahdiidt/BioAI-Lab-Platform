import React, { useEffect, useState } from 'react';
import { X, Dna } from 'lucide-react';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { AuthBackgroundAccent } from './AuthBackgroundAccent';
import { LoginView } from './LoginView';
import { RegisterView } from './RegisterView';
import { ForgotPasswordView } from './ForgotPasswordView';
import { ResetPasswordView } from './ResetPasswordView';
import { CheckEmailView } from './CheckEmailView';

type AuthView = 'login' | 'register' | 'forgot' | 'reset' | 'check_email';

interface AuthModalProps {
  lang: Language;
  initialView?: AuthView;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ lang, initialView = 'login', onClose }) => {
  const [view, setView] = useState<AuthView>(initialView);
  const [checkEmailMode, setCheckEmailMode] = useState<'verify' | 'reset'>('verify');
  const [pendingEmail, setPendingEmail] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleRegistered = (email: string) => {
    setPendingEmail(email);
    setCheckEmailMode('verify');
    setView('check_email');
  };

  const handleForgotSent = (email: string) => {
    setPendingEmail(email);
    setCheckEmailMode('reset');
    setView('check_email');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 bg-[#121826]/40 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
      dir={lang === 'fa' ? 'rtl' : 'ltr'}
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="relative overflow-hidden p-6 pb-5 border-b border-[#DDEDE8] dark:border-slate-800 bg-[#ECFDF5] dark:bg-slate-800/60">
          <AuthBackgroundAccent />
          <div className="relative flex items-start justify-between gap-3">
            <div
              id="auth-modal-title"
              className="flex items-center gap-2.5"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0F766E] to-[#14B8A6] flex items-center justify-center text-white shadow-md shadow-[#0F766E]/20 shrink-0">
                <Dna className="w-5 h-5" />
              </div>
              <div>
                <span className="block font-extrabold text-sm text-[#12312B] dark:text-slate-100">BioAI.Lab</span>
                <span className="block text-[11px] text-[#64748B] dark:text-slate-400">
                  {getTranslation(lang, 'authBrandTagline')}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              type="button"
              className="p-1.5 rounded-lg bg-white/70 dark:bg-slate-900/70 border border-[#DDEDE8] dark:border-slate-700 text-[#64748B] dark:text-slate-400 hover:text-[#0F766E] dark:hover:text-teal-400 transition-colors cursor-pointer shrink-0"
              aria-label={getTranslation(lang, 'clear')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {view === 'login' && (
            <LoginView
              lang={lang}
              onSwitchToRegister={() => setView('register')}
              onSwitchToForgot={() => setView('forgot')}
              onSignedIn={onClose}
            />
          )}

          {view === 'register' && (
            <RegisterView lang={lang} onSwitchToLogin={() => setView('login')} onRegistered={handleRegistered} />
          )}

          {view === 'forgot' && (
            <ForgotPasswordView lang={lang} onBackToLogin={() => setView('login')} onSent={handleForgotSent} />
          )}

          {view === 'reset' && <ResetPasswordView lang={lang} onReset={() => setView('login')} />}

          {view === 'check_email' && (
            <CheckEmailView
              lang={lang}
              email={pendingEmail}
              mode={checkEmailMode}
              onBackToLogin={() => setView('login')}
              onHaveResetLink={checkEmailMode === 'reset' ? () => setView('reset') : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
};
