import React from 'react';
import { Download } from 'lucide-react';
import { getTranslation } from '../../i18n';
import { Language } from '../../types';

interface ExportButtonProps {
  filename: string;
  data: string | object;
  format?: 'txt' | 'json' | 'fasta';
  lang?: Language;
  className?: string;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  filename,
  data,
  format = 'txt',
  lang = 'en',
  className = '',
}) => {
  const currentLang: Language = (lang as Language) || 'en';

  const handleExport = () => {
    let content = '';
    let mimeType = 'text/plain';

    if (format === 'json') {
      content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      mimeType = 'application/json';
    } else if (format === 'fasta') {
      const raw = typeof data === 'string' ? data.trim() : String(data);
      content = raw.startsWith('>') ? raw : `>sequence\n${raw}`;
      mimeType = 'text/plain';
    } else {
      content = typeof data === 'string' ? data : String(data);
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith(`.${format}`) ? filename : `${filename}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      type="button"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#DDEDE8] bg-white text-[#64748B] hover:text-[#0F766E] hover:bg-[#ECFDF5] transition-all cursor-pointer ${className}`}
    >
      <Download className="w-3.5 h-3.5" />
      <span>{getTranslation(currentLang, 'export')}</span>
    </button>
  );
};
