import React, { useState } from 'react';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { getTranslation } from '../../i18n';
import { Language } from '../../types';

interface CopyButtonProps {
  textToCopy: string;
  lang?: Language;
  className?: string;
  label?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ textToCopy, lang = 'en', className = '', label }) => {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const currentLang: Language = (lang as Language) || 'en';

  const handleCopy = async () => {
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#DDEDE8] bg-white text-[#0F766E] hover:bg-[#ECFDF5] transition-all cursor-pointer ${className}`}
      title={getTranslation(currentLang, 'copy')}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-[#22C55E]" />
          <span>{getTranslation(currentLang, 'copied')}</span>
        </>
      ) : copyFailed ? (
        <>
          <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
          <span className="text-rose-600">{getTranslation(currentLang, 'copyFailed')}</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          <span>{label || getTranslation(currentLang, 'copy')}</span>
        </>
      )}
    </button>
  );
};
