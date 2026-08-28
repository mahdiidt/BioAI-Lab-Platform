import React, { useState } from 'react';
import { calculatePunnettSquare, calculateHardyWeinberg } from '../../utils/genetics';
import { PunnettSquareVisualizer } from '../visualizers/PunnettSquareVisualizer';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { ExportButton } from '../common/ExportButton';
import { Grid, Scale, Info } from 'lucide-react';

interface ToolProps {
  lang: Language;
  initialTab?: 'punnett' | 'hardy';
}

export const PunnettSquareTool: React.FC<ToolProps> = ({ lang, initialTab = 'punnett' }) => {
  const [activeTab, setActiveTab] = useState<'punnett' | 'hardy'>(initialTab);

  // Punnett state
  const [p1, setP1] = useState('AaBb');
  const [p2, setP2] = useState('AaBb');

  // Hardy-Weinberg state
  const [alleleP, setAlleleP] = useState<number>(0.6);
  const [alleleQ, setAlleleQ] = useState<number>(0.4);

  const punnettResult = calculatePunnettSquare(p1, p2);
  const hwResult = calculateHardyWeinberg(alleleP, alleleQ);

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      {/* Tab bar */}
      <div className="flex items-center gap-2 border-b border-[#DDEDE8] pb-3 flex-wrap">
        <button
          onClick={() => setActiveTab('punnett')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'punnett'
              ? 'bg-[#0F766E] text-white shadow-xs'
              : 'bg-white border border-[#DDEDE8] text-[#64748B] hover:text-[#12312B]'
          }`}
        >
          <Grid className="w-4 h-4" /> {getTranslation(lang, 'tool_punnett_tab')}
        </button>
        <button
          onClick={() => setActiveTab('hardy')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'hardy'
              ? 'bg-[#0F766E] text-white shadow-xs'
              : 'bg-white border border-[#DDEDE8] text-[#64748B] hover:text-[#12312B]'
          }`}
        >
          <Scale className="w-4 h-4" /> {getTranslation(lang, 'tool_hardy_tab')}
        </button>
      </div>

      {activeTab === 'punnett' && (
        <div className="space-y-6">
          <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#DDEDE8] pb-3">
              <h4 className="font-bold text-sm text-[#12312B]">{getTranslation(lang, 'tool_parental_cross')}</h4>
              <div className="flex items-center gap-2">
                {punnettResult && <ExportButton filename="punnett_square.json" data={punnettResult} format="json" lang={lang} />}
                <button
                  onClick={() => { setP1('Aa'); setP2('Aa'); }}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#ECFDF5] text-[#0F766E] border border-[#DDEDE8] hover:bg-[#d1fae5] cursor-pointer"
                >
                  {getTranslation(lang, 'tool_monohybrid_btn')}
                </button>
                <button
                  onClick={() => { setP1('AaBb'); setP2('AaBb'); }}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#F5F3FF] text-[#8B5CF6] border border-[#DDD6FE] hover:bg-[#ede9fe] cursor-pointer"
                >
                  {getTranslation(lang, 'tool_dihybrid_btn')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_parent1_genotype')}</label>
                <input
                  type="text"
                  value={p1}
                  onChange={(e) => setP1(e.target.value)}
                  placeholder="e.g. Aa or AaBb"
                  className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#12312B] bg-[#F3FAF7] focus:ring-2 focus:ring-[#0F766E]/20 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_parent2_genotype')}</label>
                <input
                  type="text"
                  value={p2}
                  onChange={(e) => setP2(e.target.value)}
                  placeholder="e.g. Aa or AaBb"
                  className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#12312B] bg-[#F3FAF7] focus:ring-2 focus:ring-[#0F766E]/20 outline-none"
                />
              </div>
            </div>
          </div>

          {punnettResult ? (
            <div className="space-y-4">
              <PunnettSquareVisualizer result={punnettResult} lang={lang} />

              <div className="p-4 bg-[#ECFDF5] border border-[#DDEDE8] rounded-2xl flex items-start gap-3 text-xs text-[#0F766E]">
                <Info className="w-5 h-5 shrink-0 text-[#0F766E] mt-0.5" />
                <div>
                  <strong className="block font-bold">{getTranslation(lang, 'tool_assumptions')}</strong>
                  {punnettResult.assumptions}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs font-semibold">
              {getTranslation(lang, 'tool_punnett_error')}
            </div>
          )}

          <ScientificExplanation
            formula="Monohybrid Ratio: 3:1 Phenotypic | Dihybrid Ratio: 9:3:3:1 Phenotypic"
            biologicalMeaning="Mendel's Law of Segregation states that allele pairs separate during gamete formation. Mendel's Law of Independent Assortment states that alleles of two different genes assort independently of one another during gamete formation."
            assumptions="Assumes autosomal complete dominance and independent assortment without genetic linkage or epistasis."
            limitations="Does not model sex-linked traits, incomplete dominance, codominance, or chromosomal crossovers."
            lang={lang}
          />
        </div>
      )}

      {activeTab === 'hardy' && (
        <div className="space-y-6">
          <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-4">
            <h4 className="font-bold text-sm text-[#12312B] border-b border-[#DDEDE8] pb-2">
              {getTranslation(lang, 'tool_allele_freq_inputs')}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_dominant_freq')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={alleleP}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    const p = isNaN(val) ? 0 : val;
                    setAlleleP(p);
                    setAlleleQ(Number((1 - p).toFixed(4)));
                  }}
                  className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#0F766E] bg-[#F3FAF7] focus:ring-2 focus:ring-[#0F766E]/20 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#64748B] block mb-1">{getTranslation(lang, 'tool_recessive_freq')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={alleleQ}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    const q = isNaN(val) ? 0 : val;
                    setAlleleQ(q);
                    setAlleleP(Number((1 - q).toFixed(4)));
                  }}
                  className="w-full p-2.5 rounded-xl border border-[#DDEDE8] font-mono text-sm font-bold text-[#8B5CF6] bg-[#F3FAF7] focus:ring-2 focus:ring-[#0F766E]/20 outline-none"
                />
              </div>
            </div>
          </div>

          {hwResult ? (
            <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-2">
                <h4 className="font-bold text-sm text-[#12312B]">
                  {getTranslation(lang, 'tool_genotype_freq_pop')}
                </h4>
                <ExportButton filename="hardy_weinberg.json" data={hwResult} format="json" lang={lang} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
                  <span className="text-[11px] font-bold text-[#64748B] block">{getTranslation(lang, 'tool_homo_dom')}</span>
                  <span className="text-lg font-bold text-[#0F766E] font-mono">{(hwResult.p2 * 100).toFixed(1)}%</span>
                  <span className="text-[10px] text-[#64748B] block mt-1">AA = {hwResult.p2}</span>
                </div>

                <div className="p-3.5 bg-[#F5F3FF] border border-[#DDD6FE] rounded-xl">
                  <span className="text-[11px] font-bold text-[#64748B] block">{getTranslation(lang, 'tool_hetero')}</span>
                  <span className="text-lg font-bold text-[#8B5CF6] font-mono">{(hwResult.twoPQ * 100).toFixed(1)}%</span>
                  <span className="text-[10px] text-[#64748B] block mt-1">Aa = {hwResult.twoPQ}</span>
                </div>

                <div className="p-3.5 bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl">
                  <span className="text-[11px] font-bold text-[#64748B] block">{getTranslation(lang, 'tool_homo_rec')}</span>
                  <span className="text-lg font-bold text-[#0EA5E9] font-mono">{(hwResult.q2 * 100).toFixed(1)}%</span>
                  <span className="text-[10px] text-[#64748B] block mt-1">aa = {hwResult.q2}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs font-semibold">
              {getTranslation(lang, 'tool_hw_error')}
            </div>
          )}

          <ScientificExplanation
            formula="p + q = 1  |  p² + 2pq + q² = 1"
            biologicalMeaning="The Hardy-Weinberg principle states that allele and genotype frequencies in a population will remain constant from generation to generation in the absence of evolutionary influences."
            assumptions="Assumes random mating, infinite population size, no mutation, no gene flow (migration), and no natural selection."
            limitations="Real biological populations rarely meet all 5 assumptions indefinitely."
            lang={lang}
          />
        </div>
      )}
    </div>
  );
};
