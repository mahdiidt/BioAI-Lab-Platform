import React, { useRef } from 'react';
import { Trash2, FileUp, Sparkles, AlertTriangle } from 'lucide-react';
import { getTranslation } from '../../i18n';
import { Language } from '../../types';
import { CopyButton } from './CopyButton';
import { normalizeSequenceInput } from '../../utils/sequenceValidator';

interface SequenceInputProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  placeholder?: string;
  sampleSequence?: string;
  sampleLabel?: string;
  allowedCharsRegex?: RegExp;
  lang?: Language;
  rows?: number;
}

export const SequenceInput: React.FC<SequenceInputProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Paste or type DNA, RNA, or Protein sequence here...',
  sampleSequence,
  sampleLabel = 'Load Sample',
  allowedCharsRegex,
  lang = 'en',
  rows = 4,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentLang: Language = (lang as Language) || 'en';

  const { sequence: cleanSequenceStr } = normalizeSequenceInput(value);
  const length = cleanSequenceStr.length;

  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 5 MB.`);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        onChange(text);
      }
    };
    reader.readAsText(file);
  };

  // Check invalid characters if regex is provided
  let invalidChars: string[] = [];
  if (allowedCharsRegex && cleanSequenceStr) {
    const nonMatches = cleanSequenceStr.split('').filter((c) => !allowedCharsRegex.test(c));
    invalidChars = Array.from(new Set(nonMatches));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-semibold text-[#12312B] dark:text-slate-200 uppercase tracking-wider">
          {label || getTranslation(currentLang, 'inputSequence')}
        </label>
        <div className="flex items-center gap-2">
          {sampleSequence && (
            <button
              onClick={() => onChange(sampleSequence)}
              type="button"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-[#ECFDF5] dark:bg-slate-800 text-[#0F766E] dark:text-teal-300 border border-[#DDEDE8] dark:border-slate-700 hover:bg-[#d1fae5] dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-[#14B8A6]" />
              <span>{sampleLabel}</span>
            </button>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            type="button"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-white dark:bg-slate-900 text-[#64748B] dark:text-slate-300 border border-[#DDEDE8] dark:border-slate-700 hover:text-[#0F766E] dark:hover:text-teal-300 hover:bg-[#ECFDF5] dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <FileUp className="w-3 h-3" />
            <span>{getTranslation(currentLang, 'tool_upload_fasta')}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".fasta,.fa,.txt,.seq"
            onChange={handleFileUpload}
            className="hidden"
          />

          {value && (
            <>
              <CopyButton textToCopy={value} lang={currentLang} />
              <button
                onClick={() => onChange('')}
                type="button"
                className="p-1 rounded text-[#EF4444] hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                title={getTranslation(currentLang, 'clear')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="w-full p-3.5 rounded-xl border border-[#DDEDE8] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#12312B] dark:text-teal-300 focus:ring-2 focus:ring-[#14B8A6] focus:border-transparent outline-none transition-all sequence-mono-ltr text-xs tracking-wider font-mono shadow-inner resize-y"
        />

        <div className="absolute bottom-2.5 right-3 px-2 py-0.5 rounded bg-[#ECFDF5] dark:bg-slate-800 border border-[#DDEDE8] dark:border-slate-700 text-[10px] font-mono text-[#0F766E] dark:text-teal-300 font-medium pointer-events-none">
          {length.toLocaleString()} {length === 1 ? 'base' : 'bases'}
        </div>
      </div>

      {invalidChars.length > 0 && (
        <div className="p-2.5 bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-900 rounded-lg flex items-center gap-2 text-xs text-[#EF4444] dark:text-rose-300">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {getTranslation(currentLang, 'invalidSequence')} <strong>{invalidChars.join(', ')}</strong>
          </span>
        </div>
      )}
    </div>
  );
};