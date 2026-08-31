import React, { useState } from 'react';
import {
  oneSampleTTest,
  twoSampleTTest,
  chiSquareGoodnessOfFit,
  chiSquareIndependence,
} from '../../utils/statistics';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { ExportButton } from '../common/ExportButton';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Sigma, AlertTriangle, TrendingUp, Grid3x3 } from 'lucide-react';

interface ToolProps {
  lang: Language;
}

type TabId = 'one_sample' | 'two_sample' | 'chi_gof' | 'chi_indep';

function parseNumberList(text: string): number[] {
  return text
    .split(/[,\s\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => parseFloat(s))
    .filter((n) => Number.isFinite(n));
}

function parseTable(text: string): number[][] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => parseNumberList(line));
}

function formatP(p: number | undefined): string {
  if (p === undefined || !Number.isFinite(p)) return '—';
  if (p < 0.0001) return p.toExponential(2);
  return p.toFixed(4);
}

export const StatisticalTestTool: React.FC<ToolProps> = ({ lang }) => {
  const [activeTab, setActiveTab] = useState<TabId>('one_sample');
  const [alpha] = useState<number>(0.05);

  // One-sample
  const [sample1Text, setSample1Text] = useState('51, 55, 45, 58, 60, 52, 49');
  const [popMean, setPopMean] = useState<number>(50);

  // Two-sample
  const [sampleAText, setSampleAText] = useState('23, 25, 21, 26, 24, 22');
  const [sampleBText, setSampleBText] = useState('30, 32, 28, 31, 29, 33');
  const [equalVariance, setEqualVariance] = useState(false);

  // Chi-square goodness-of-fit
  const [observedText, setObservedText] = useState('10, 20, 30, 40');
  const [expectedText, setExpectedText] = useState('25, 25, 25, 25');

  // Chi-square independence
  const [tableText, setTableText] = useState('10, 20\n30, 40');

  const sample1 = parseNumberList(sample1Text);
  const oneSampleResult = oneSampleTTest(sample1, popMean);

  const sampleA = parseNumberList(sampleAText);
  const sampleB = parseNumberList(sampleBText);
  const twoSampleResult = twoSampleTTest(sampleA, sampleB, equalVariance);

  const observed = parseNumberList(observedText);
  const expected = parseNumberList(expectedText);
  const gofResult = chiSquareGoodnessOfFit(observed, expected);

  const table = parseTable(tableText);
  const indepResult = table.length > 0 ? chiSquareIndependence(table) : { isValid: false, errorMessage: 'Enter at least a 2x2 table.' };

  const tabs: { id: TabId; icon: React.ReactNode; labelKey: string }[] = [
    { id: 'one_sample', icon: <Sigma className="w-4 h-4" />, labelKey: 'tool_one_sample_ttest' },
    { id: 'two_sample', icon: <TrendingUp className="w-4 h-4" />, labelKey: 'tool_two_sample_ttest' },
    { id: 'chi_gof', icon: <Grid3x3 className="w-4 h-4" />, labelKey: 'tool_chi_gof' },
    { id: 'chi_indep', icon: <Grid3x3 className="w-4 h-4" />, labelKey: 'tool_chi_indep' },
  ];

  const textareaClass =
    'w-full p-3 text-xs font-mono bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl text-[#12312B] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 resize-y sequence-mono-ltr';

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      <div role="tablist" className="flex items-center gap-2 border-b border-[#DDEDE8] pb-3 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-[#0F766E] text-white shadow-xs'
                : 'bg-white border border-[#DDEDE8] text-[#64748B] hover:text-[#12312B]'
            }`}
          >
            {tab.icon} {getTranslation(lang, tab.labelKey)}
          </button>
        ))}
      </div>

      {/* ONE-SAMPLE T-TEST */}
      {activeTab === 'one_sample' && (
        <div className="space-y-4">
          <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-3">
            <label className="text-xs font-bold text-[#12312B] block">{getTranslation(lang, 'tool_sample_data')}</label>
            <textarea
              value={sample1Text}
              onChange={(e) => setSample1Text(e.target.value)}
              rows={3}
              placeholder={getTranslation(lang, 'tool_comma_separated_numbers')}
              className={textareaClass}
            />
            <div>
              <label className="text-xs font-bold text-[#12312B] block mb-1">{getTranslation(lang, 'tool_population_mean_h0')}</label>
              <input
                type="number"
                value={popMean}
                onChange={(e) => setPopMean(parseFloat(e.target.value) || 0)}
                className="w-40 p-2 text-xs font-bold font-mono bg-[#F3FAF7] border border-[#DDEDE8] rounded-xl text-center text-[#0F766E]"
              />
            </div>
          </div>

          {!oneSampleResult.isValid && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-medium">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{oneSampleResult.errorMessage}</span>
            </div>
          )}

          {oneSampleResult.isValid && (
            <ResultsPanel
              lang={lang}
              alpha={alpha}
              pValue={oneSampleResult.pValue!}
              exportData={oneSampleResult}
              exportFilename="one_sample_t_test.json"
              rows={[
                [getTranslation(lang, 'tool_n'), oneSampleResult.n!.toString()],
                [getTranslation(lang, 'tool_sample_mean'), oneSampleResult.mean!.toFixed(4)],
                [getTranslation(lang, 'tool_sample_sd'), oneSampleResult.sd!.toFixed(4)],
                ['t', oneSampleResult.t!.toFixed(4)],
                [getTranslation(lang, 'tool_df'), oneSampleResult.df!.toString()],
              ]}
            />
          )}
        </div>
      )}

      {/* TWO-SAMPLE T-TEST */}
      {activeTab === 'two_sample' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-2">
              <label className="text-xs font-bold text-[#12312B] block">{getTranslation(lang, 'tool_group_a')}</label>
              <textarea value={sampleAText} onChange={(e) => setSampleAText(e.target.value)} rows={3} className={textareaClass} />
            </div>
            <div className="p-4 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-2">
              <label className="text-xs font-bold text-[#12312B] block">{getTranslation(lang, 'tool_group_b')}</label>
              <textarea value={sampleBText} onChange={(e) => setSampleBText(e.target.value)} rows={3} className={textareaClass} />
            </div>
          </div>

          <div role="group" className="flex items-center gap-2 p-1 bg-[#F3FAF7] rounded-xl border border-[#DDEDE8] w-fit">
            <button
              type="button"
              aria-pressed={!equalVariance}
              onClick={() => setEqualVariance(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !equalVariance ? 'bg-[#0F766E] text-white' : 'text-[#64748B] hover:text-[#12312B]'
              }`}
            >
              {getTranslation(lang, 'tool_welch_unequal_var')}
            </button>
            <button
              type="button"
              aria-pressed={equalVariance}
              onClick={() => setEqualVariance(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                equalVariance ? 'bg-[#0F766E] text-white' : 'text-[#64748B] hover:text-[#12312B]'
              }`}
            >
              {getTranslation(lang, 'tool_student_equal_var')}
            </button>
          </div>

          {!twoSampleResult.isValid && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-medium">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{twoSampleResult.errorMessage}</span>
            </div>
          )}

          {twoSampleResult.isValid && (
            <ResultsPanel
              lang={lang}
              alpha={alpha}
              pValue={twoSampleResult.pValue!}
              exportData={twoSampleResult}
              exportFilename="two_sample_t_test.json"
              rows={[
                [getTranslation(lang, 'tool_mean_a'), twoSampleResult.meanA!.toFixed(4)],
                [getTranslation(lang, 'tool_mean_b'), twoSampleResult.meanB!.toFixed(4)],
                ['t', twoSampleResult.t!.toFixed(4)],
                [getTranslation(lang, 'tool_df'), twoSampleResult.df!.toFixed(2)],
              ]}
            />
          )}
        </div>
      )}

      {/* CHI-SQUARE GOODNESS OF FIT */}
      {activeTab === 'chi_gof' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-2">
              <label className="text-xs font-bold text-[#12312B] block">{getTranslation(lang, 'tool_observed_counts')}</label>
              <textarea value={observedText} onChange={(e) => setObservedText(e.target.value)} rows={2} className={textareaClass} />
            </div>
            <div className="p-4 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-2">
              <label className="text-xs font-bold text-[#12312B] block">{getTranslation(lang, 'tool_expected_counts')}</label>
              <textarea value={expectedText} onChange={(e) => setExpectedText(e.target.value)} rows={2} className={textareaClass} />
            </div>
          </div>

          {!gofResult.isValid && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-medium">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{gofResult.errorMessage}</span>
            </div>
          )}

          {gofResult.isValid && (
            <ResultsPanel
              lang={lang}
              alpha={alpha}
              pValue={gofResult.pValue!}
              exportData={gofResult}
              exportFilename="chi_square_goodness_of_fit.json"
              rows={[
                ['χ²', gofResult.chiSquare!.toFixed(4)],
                [getTranslation(lang, 'tool_df'), gofResult.df!.toString()],
              ]}
            />
          )}
        </div>
      )}

      {/* CHI-SQUARE INDEPENDENCE */}
      {activeTab === 'chi_indep' && (
        <div className="space-y-4">
          <div className="p-4 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-2">
            <label className="text-xs font-bold text-[#12312B] block">{getTranslation(lang, 'tool_contingency_table')}</label>
            <textarea
              value={tableText}
              onChange={(e) => setTableText(e.target.value)}
              rows={4}
              placeholder={getTranslation(lang, 'tool_one_row_per_line')}
              className={textareaClass}
            />
            <p className="text-[10px] text-[#64748B]">{getTranslation(lang, 'tool_one_row_per_line')}</p>
          </div>

          {!indepResult.isValid && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-medium">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{indepResult.errorMessage}</span>
            </div>
          )}

          {indepResult.isValid && (
            <ResultsPanel
              lang={lang}
              alpha={alpha}
              pValue={indepResult.pValue!}
              exportData={indepResult}
              exportFilename="chi_square_independence.json"
              rows={[
                ['χ²', indepResult.chiSquare!.toFixed(4)],
                [getTranslation(lang, 'tool_df'), indepResult.df!.toString()],
              ]}
            />
          )}
        </div>
      )}

      <ScientificExplanation
        formula="t = (x̄ - μ) / (s/√n)  |  Welch t = (x̄A - x̄B) / √(sA²/nA + sB²/nB)  |  χ² = Σ (O - E)² / E"
        biologicalMeaning="These are general-purpose statistical significance tests used across experimental biology: t-tests compare group means (e.g., treatment vs control measurements), while chi-square tests compare observed vs expected categorical frequencies (e.g., genetic cross ratios, or association between two categorical variables in a contingency table)."
        assumptions="t-tests assume the underlying data is approximately normally distributed (or the sample size is large enough for the Central Limit Theorem to apply). Welch's t-test (the default here) does not assume equal variance between groups, unlike the classic Student's t-test. Chi-square tests assume expected cell counts are not too small (a common rule of thumb is expected count ≥ 5 in most cells)."
        limitations="p-values are computed via numerically-approximated incomplete beta/gamma functions (standard series and continued-fraction methods), validated here against textbook critical values, but for publication-grade analysis always cross-check with an established statistics package (R, Python/SciPy, GraphPad Prism, etc.). This tool does not perform multiple-comparison correction — if you run many tests, consider a correction such as Bonferroni or FDR."
        lang={lang}
      />
    </div>
  );
};

const ResultsPanel: React.FC<{
  lang: Language;
  alpha: number;
  pValue: number;
  rows: [string, string][];
  exportData: object;
  exportFilename: string;
}> = ({ lang, alpha, pValue, rows, exportData, exportFilename }) => {
  const isSignificant = pValue < alpha;

  return (
    <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-3">
        <h4 className="font-bold text-sm text-[#12312B]">{getTranslation(lang, 'resultsHeader')}</h4>
        <ExportButton filename={exportFilename} data={exportData} format="json" lang={lang} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="p-3 bg-slate-50 border border-[#DDEDE8] rounded-xl">
            <span className="text-[10px] font-semibold text-[#64748B] block">{label}</span>
            <span className="text-sm font-bold text-[#12312B] font-mono">{value}</span>
          </div>
        ))}
      </div>

      <div
        className={`p-4 rounded-xl border flex items-center justify-between flex-wrap gap-2 ${
          isSignificant ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-[#DDEDE8]'
        }`}
      >
        <div>
          <span className="text-[11px] font-semibold text-[#64748B] block">p-value</span>
          <span className={`text-xl font-bold font-mono ${isSignificant ? 'text-emerald-700' : 'text-[#12312B]'}`}>
            {formatP(pValue)}
          </span>
        </div>
        <span
          className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
            isSignificant
              ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
              : 'bg-slate-100 text-slate-600 border-slate-300'
          }`}
        >
          {isSignificant
            ? getTranslation(lang, 'tool_significant_at_alpha')
            : getTranslation(lang, 'tool_not_significant_at_alpha')}{' '}
          (α={alpha})
        </span>
      </div>
    </div>
  );
};
