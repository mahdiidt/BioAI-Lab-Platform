import React from 'react';
import { getPasswordStrength } from '../../utils/authValidation';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';

interface PasswordStrengthMeterProps {
  password: string;
  lang: Language;
}

const SEGMENT_COLORS = ['bg-slate-200 dark:bg-slate-700', '#EF4444', '#F59E0B', '#0EA5E9', '#22C55E'];
const LABEL_KEYS: Record<string, string> = {
  empty: '',
  weak: 'authPwStrengthWeak',
  fair: 'authPwStrengthFair',
  good: 'authPwStrengthGood',
  strong: 'authPwStrengthStrong',
};

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password, lang }) => {
  const result = getPasswordStrength(password);

  if (!password) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4].map((seg) => (
          <div
            key={seg}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{
              backgroundColor: seg <= result.score ? SEGMENT_COLORS[result.score] : undefined,
            }}
          >
            {seg > result.score && <div className="h-1 w-full rounded-full bg-slate-200 dark:bg-slate-700" />}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[#64748B] dark:text-slate-400">
        {getTranslation(lang, LABEL_KEYS[result.label] || 'authPwStrengthWeak')}
      </p>
    </div>
  );
};
