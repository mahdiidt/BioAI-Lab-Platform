import React from 'react';
import { PunnettResult } from '../../utils/genetics';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';

interface PunnettSquareVisualizerProps {
  result: PunnettResult;
  lang?: Language;
}

interface RatioItem {
  count: number;
  ratio: number;
  percent: number;
}

export const PunnettSquareVisualizer: React.FC<PunnettSquareVisualizerProps> = ({ result, lang = 'en' }) => {
  const { p1Gametes, p2Gametes, grid, genotypeRatios, phenotypeRatios, type } = result;

  const totalCells = type === 'monohybrid' ? 4 : 16;

  return (
    <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-2">
        <h4 className="font-bold text-sm text-[#12312B]">
          {getTranslation(lang, 'tool_punnett_interactive_header')} ({getTranslation(lang, type === 'monohybrid' ? 'tool_punnett_monohybrid' : 'tool_punnett_dihybrid')} {getTranslation(lang, 'tool_punnett_cross')})
        </h4>
        <span className="text-xs font-semibold text-[#0F766E] bg-[#ECFDF5] px-2.5 py-0.5 rounded-full border border-[#DDEDE8]">
          {result.p1} × {result.p2}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row items-start gap-6 justify-center">
        {/* Grid Table */}
        <div className="w-full lg:w-auto overflow-x-auto border-2 border-[#0F766E] rounded-xl bg-[#ECFDF5] p-3">
          <table className="border-collapse mx-auto">
            <thead>
              <tr>
                <th className="p-2 text-xs font-mono text-[#64748B]">{getTranslation(lang, 'tool_punnett_parent_axis')}</th>
                {p2Gametes.map((a, i) => (
                  <th key={i} className="p-2.5 font-mono font-bold text-sm text-[#0F766E] bg-white rounded border border-[#DDEDE8] min-w-[50px] text-center">
                    {a}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, rIdx) => (
                <tr key={rIdx}>
                  <td className="p-2.5 font-mono font-bold text-sm text-[#0F766E] bg-white rounded border border-[#DDEDE8] text-center">
                    {p1Gametes[rIdx]}
                  </td>
                  {row.map((genotype, cIdx) => (
                    <td
                      key={cIdx}
                      className="p-3 font-mono font-bold text-sm text-[#12312B] bg-white border border-[#DDEDE8] text-center rounded-lg shadow-2xs hover:bg-[#14B8A6]/10 transition-colors"
                    >
                      {genotype}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Breakdown Panel */}
        <div className="w-full lg:w-80 space-y-4">
          {/* Genotypes */}
          <div>
            <h5 className="font-bold text-xs text-[#0F766E] uppercase tracking-wider mb-2">
              {getTranslation(lang, 'tool_expected_genotypes')}
            </h5>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {Object.entries(genotypeRatios).map(([gt, info]) => {
                const item = info as RatioItem;
                return (
                  <div key={gt} className="p-2 bg-[#F3FAF7] border border-[#DDEDE8] rounded-lg flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-[#12312B]">{gt}</span>
                    <span className="font-semibold text-[#0F766E]">
                      {item.percent}% ({item.count}/{totalCells})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Phenotypes */}
          <div>
            <h5 className="font-bold text-xs text-[#8B5CF6] uppercase tracking-wider mb-2">
              {getTranslation(lang, 'tool_expected_phenotypes')}
            </h5>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {Object.entries(phenotypeRatios).map(([pheno, info]) => {
                const item = info as RatioItem;
                return (
                  <div key={pheno} className="p-2 bg-[#F5F3FF] border border-[#DDD6FE] rounded-lg flex items-center justify-between text-xs">
                    <span className="font-medium text-[#12312B] line-clamp-1">{pheno}</span>
                    <span className="font-bold text-[#8B5CF6] shrink-0 ml-2">
                      {item.percent}% ({item.count}/{totalCells})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
