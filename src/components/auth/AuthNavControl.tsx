import React, { useState } from 'react';
import { LogIn, LogOut, User as UserIcon, ChevronDown } from 'lucide-react';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';

interface AuthNavControlProps {
  lang: Language;
  onOpenAuth: () => void;
  variant?: 'desktop' | 'mobile';
}

export const AuthNavControl: React.FC<AuthNavControlProps> = ({ lang, onOpenAuth, variant = 'desktop' }) => {
  const { user, profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) {
    return (
      <button
        onClick={onOpenAuth}
        type="button"
        className={
          variant === 'desktop'
            ? 'flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-tr from-[#0F766E] to-[#14B8A6] text-white hover:opacity-95 transition-all cursor-pointer shadow-md shadow-[#0F766E]/20 text-xs font-bold'
            : 'w-full py-2.5 px-3 rounded-lg bg-gradient-to-tr from-[#0F766E] to-[#14B8A6] text-white font-bold text-xs flex items-center justify-center gap-2'
        }
      >
        <LogIn className={variant === 'desktop' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        <span>{getTranslation(lang, 'navSignIn')}</span>
      </button>
    );
  }

  const label = user.email ?? getTranslation(lang, 'authAccount');
  const planLabel =
    profile?.plan && profile.plan !== 'free' ? getTranslation(lang, 'authPlanPro') : getTranslation(lang, 'authPlanFree');

  if (variant === 'mobile') {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#ECFDF5] dark:bg-slate-900 text-xs">
          <span className="truncate text-[#12312B] dark:text-slate-100 font-medium">{label}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white dark:bg-slate-800 text-[#0F766E] dark:text-teal-400 border border-[#DDEDE8] dark:border-slate-700">
            {planLabel}
          </span>
        </div>
        <button
          onClick={() => signOut()}
          type="button"
          className="w-full py-2.5 px-3 rounded-lg border border-[#DDEDE8] dark:border-slate-800 text-red-600 dark:text-red-400 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>{getTranslation(lang, 'authSignOutBtn')}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((prev) => !prev)}
        type="button"
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[#DDEDE8] dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-[#ECFDF5] dark:hover:bg-slate-800 hover:border-[#14B8A6] transition-all cursor-pointer shadow-2xs"
      >
        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#0F766E] to-[#14B8A6] flex items-center justify-center text-white shrink-0">
          <UserIcon className="w-3.5 h-3.5" />
        </div>
        <span className="max-w-[9rem] truncate text-xs font-semibold text-[#12312B] dark:text-slate-100">{label}</span>
        <ChevronDown className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400" />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-[#DDEDE8] dark:border-slate-800 rounded-xl shadow-xl z-20 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-[#DDEDE8] dark:border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-[#64748B] dark:text-slate-400">{getTranslation(lang, 'authAccount')}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] dark:bg-slate-800 text-[#0F766E] dark:text-teal-400 border border-[#DDEDE8] dark:border-slate-700">
                {planLabel}
              </span>
            </div>
            <button
              onClick={() => {
                setMenuOpen(false);
                signOut();
              }}
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{getTranslation(lang, 'authSignOutBtn')}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
