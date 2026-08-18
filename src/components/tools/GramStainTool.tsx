import React from 'react';
import { GRAM_STAIN_STEPS } from '../../utils/microbiology';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Layers } from 'lucide-react';

interface ToolProps {
  lang: Language;
}

export const GramStainTool: React.FC<ToolProps> = ({ lang }) => {
  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-4">
        <h4 className="font-bold text-sm text-[#12312B] flex items-center gap-2 border-b border-[#DDEDE8] pb-3">
          <Layers className="w-4 h-4 text-[#0F766E]" />
          {getTranslation(lang, 'tool_gram_stain_protocol')}
        </h4>

        <div className="space-y-4">
          {GRAM_STAIN_STEPS.map((step) => (
            <div
              key={step.step}
              className="p-4 bg-[#F3FAF7] border border-[#DDEDE8] rounded-2xl space-y-3"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#DDEDE8] pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#0F766E] text-white text-xs font-bold flex items-center justify-center">
                    {step.step}
                  </span>
                  <span className="font-bold text-xs text-[#12312B]">{step.reagent}</span>
                </div>
                <span className="text-xs font-mono font-bold text-[#0F766E] bg-white px-2.5 py-1 rounded-lg border border-[#DDEDE8]">
                  {getTranslation(lang, 'tool_duration')}: {step.duration}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Gram Positive Effect */}
                <div className="p-3 bg-white border border-[#DDEDE8] rounded-xl space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      style={{ backgroundColor: step.colorPos }}
                      className="w-3.5 h-3.5 rounded-full border border-black/20"
                    />
                    <strong className="text-[#581c87] font-bold">{getTranslation(lang, 'tool_gram_pos')} (+):</strong>
                  </div>
                  <p className="text-[#64748B] text-[11px] leading-relaxed">{step.effectGramPos}</p>
                </div>

                {/* Gram Negative Effect */}
                <div className="p-3 bg-white border border-[#DDEDE8] rounded-xl space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      style={{ backgroundColor: step.colorNeg }}
                      className="w-3.5 h-3.5 rounded-full border border-black/20"
                    />
                    <strong className="text-[#e11d48] font-bold">{getTranslation(lang, 'tool_gram_neg')} (-):</strong>
                  </div>
                  <p className="text-[#64748B] text-[11px] leading-relaxed">{step.effectGramNeg}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ScientificExplanation
        formula="Gram(+) = Deep Purple / Crystal Violet | Gram(-) = Pink/Red / Safranin"
        biologicalMeaning="Gram staining differentiates bacterial species based on cell wall architecture. Gram-positive bacteria possess a thick peptidoglycan layer that retains crystal violet-iodine complexes during alcohol decolorization. Gram-negative bacteria feature a thin peptidoglycan layer flanked by an outer lipopolysaccharide membrane."
        assumptions="Requires fresh bacterial culture log-phase growth (older cultures may give gram-variable results)."
        limitations="Over-decolorization with 95% ethanol can cause false Gram-negative results."
        lang={lang}
      />
    </div>
  );
};

