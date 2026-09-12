import React, { useEffect, useState } from 'react';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';

interface FunFactTickerProps {
  lang: Language;
}

const FACT_KEYS = ['authFunFact1', 'authFunFact2', 'authFunFact3', 'authFunFact4', 'authFunFact5', 'authFunFact6'];
const ROTATE_MS = 4500;

/**
 * A small, playful rotating strip of science one-liners. Purely decorative —
 * meant to take the edge off a standard login form, not to convey anything
 * load-bearing. Cycles on an interval; each fact re-triggers a short CSS
 * fade-in (see .animate-fact-fade-in in index.css) via a key change.
 */
export const FunFactTicker: React.FC<FunFactTickerProps> = ({ lang }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % FACT_KEYS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <p
      key={index}
      className="animate-fact-fade-in text-[11px] text-[#0F766E]/80 dark:text-teal-400/80 font-medium truncate"
    >
      {getTranslation(lang, FACT_KEYS[index])}
    </p>
  );
};
