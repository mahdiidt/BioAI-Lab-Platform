import React, { useMemo, useState } from 'react';
import { layoutPedigree, inferInheritancePattern, Individual, InheritancePattern } from '../../utils/pedigree';
import { PedigreeVisualizer } from '../visualizers/PedigreeVisualizer';
import { ExportButton } from '../common/ExportButton';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Users, Plus, Trash2, Sparkles, AlertTriangle, XCircle } from 'lucide-react';

interface ToolProps {
  lang: Language;
}

const EXAMPLE_PEDIGREE: Individual[] = [
  { id: 'I-1', sex: 'M', generation: 1, affected: false },
  { id: 'I-2', sex: 'F', generation: 1, affected: false },
  { id: 'I-3', sex: 'M', generation: 1, affected: false },
  { id: 'I-4', sex: 'F', generation: 1, affected: false },
  { id: 'II-1', sex: 'F', generation: 2, affected: false, fatherId: 'I-1', motherId: 'I-2' },
  { id: 'II-2', sex: 'M', generation: 2, affected: true, fatherId: 'I-1', motherId: 'I-2' },
  { id: 'II-3', sex: 'M', generation: 2, affected: false, fatherId: 'I-3', motherId: 'I-4' },
  { id: 'III-1', sex: 'F', generation: 3, affected: true, fatherId: 'II-3', motherId: 'II-1' },
  { id: 'III-2', sex: 'M', generation: 3, affected: false, fatherId: 'II-3', motherId: 'II-1' },
];

const PATTERN_KEY: Record<InheritancePattern, string> = {
  autosomal_dominant: 'tool_pedigree_pattern_ad',
  autosomal_recessive: 'tool_pedigree_pattern_ar',
  x_linked_dominant: 'tool_pedigree_pattern_xd',
  x_linked_recessive: 'tool_pedigree_pattern_xr',
};

export const PedigreeAnalysisTool: React.FC<ToolProps> = ({ lang }) => {
  const [individuals, setIndividuals] = useState<Individual[]>(EXAMPLE_PEDIGREE);
  const [selected, setSelected] = useState<string | null>(null);

  const [newId, setNewId] = useState('');
  const [newSex, setNewSex] = useState<'M' | 'F'>('M');
  const [newGeneration, setNewGeneration] = useState('1');
  const [newAffected, setNewAffected] = useState(false);
  const [newFatherId, setNewFatherId] = useState('');
  const [newMotherId, setNewMotherId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const layout = useMemo(() => layoutPedigree(individuals), [individuals]);
  const inference = useMemo(() => inferInheritancePattern(individuals), [individuals]);

  const potentialFathers = individuals.filter((i) => i.sex === 'M');
  const potentialMothers = individuals.filter((i) => i.sex === 'F');

  const addIndividual = () => {
    setFormError(null);
    const id = newId.trim();
    if (!id) {
      setFormError(getTranslation(lang, 'tool_pedigree_error_id_required'));
      return;
    }
    if (individuals.some((i) => i.id === id)) {
      setFormError(getTranslation(lang, 'tool_pedigree_error_duplicate_id'));
      return;
    }
    const gen = parseInt(newGeneration, 10);
    if (!Number.isFinite(gen) || gen < 1) {
      setFormError(getTranslation(lang, 'tool_pedigree_error_bad_generation'));
      return;
    }
    setIndividuals((prev) => [
      ...prev,
      {
        id,
        sex: newSex,
        generation: gen,
        affected: newAffected,
        fatherId: newFatherId || undefined,
        motherId: newMotherId || undefined,
      },
    ]);
    setNewId('');
    setNewAffected(false);
    setNewFatherId('');
    setNewMotherId('');
  };

  const removeIndividual = (id: string) => {
    setIndividuals((prev) =>
      prev
        .filter((i) => i.id !== id)
        .map((i) => ({
          ...i,
          fatherId: i.fatherId === id ? undefined : i.fatherId,
          motherId: i.motherId === id ? undefined : i.motherId,
        }))
    );
    setSelected((prev) => (prev === id ? null : prev));
  };

  return (
    <div className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm text-[#12312B] flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#0F766E]" />
            {getTranslation(lang, 'tool_pedigree_add_person')}
          </h4>
          <button
            type="button"
            onClick={() => setIndividuals(EXAMPLE_PEDIGREE)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F3FAF7] border border-[#DDEDE8] text-xs font-bold text-[#0F766E] hover:bg-white cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {getTranslation(lang, 'tool_pedigree_load_example')}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <input
            type="text"
            placeholder="e.g. III-3"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#DDEDE8] bg-[#F3FAF7] text-xs font-semibold outline-none focus:border-[#0F766E]"
          />
          <select
            value={newSex}
            onChange={(e) => setNewSex(e.target.value as 'M' | 'F')}
            className="px-3 py-2 rounded-lg border border-[#DDEDE8] bg-[#F3FAF7] text-xs font-semibold outline-none focus:border-[#0F766E]"
          >
            <option value="M">{getTranslation(lang, 'tool_pedigree_male')}</option>
            <option value="F">{getTranslation(lang, 'tool_pedigree_female')}</option>
          </select>
          <input
            type="number"
            min={1}
            placeholder={getTranslation(lang, 'tool_pedigree_generation')}
            value={newGeneration}
            onChange={(e) => setNewGeneration(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#DDEDE8] bg-[#F3FAF7] text-xs font-mono font-semibold outline-none focus:border-[#0F766E]"
          />
          <select
            value={newFatherId}
            onChange={(e) => setNewFatherId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#DDEDE8] bg-[#F3FAF7] text-xs font-semibold outline-none focus:border-[#0F766E]"
          >
            <option value="">{getTranslation(lang, 'tool_pedigree_father')}</option>
            {potentialFathers.map((f) => (
              <option key={f.id} value={f.id}>{f.id}</option>
            ))}
          </select>
          <select
            value={newMotherId}
            onChange={(e) => setNewMotherId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#DDEDE8] bg-[#F3FAF7] text-xs font-semibold outline-none focus:border-[#0F766E]"
          >
            <option value="">{getTranslation(lang, 'tool_pedigree_mother')}</option>
            {potentialMothers.map((m) => (
              <option key={m.id} value={m.id}>{m.id}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#DDEDE8] bg-[#F3FAF7] text-xs font-semibold cursor-pointer">
            <input type="checkbox" checked={newAffected} onChange={(e) => setNewAffected(e.target.checked)} />
            {getTranslation(lang, 'tool_pedigree_affected')}
          </label>
        </div>

        {formError && (
          <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" /> {formError}
          </p>
        )}

        <button
          type="button"
          onClick={addIndividual}
          className="px-4 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-bold hover:opacity-90 cursor-pointer"
        >
          {getTranslation(lang, 'tool_pedigree_add')}
        </button>

        {individuals.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#DDEDE8]">
            {individuals.map((ind) => (
              <span
                key={ind.id}
                className={`flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-[11px] font-mono font-bold border ${
                  ind.affected ? 'bg-[#ECFDF5] border-[#0F766E] text-[#0F766E]' : 'bg-white border-[#DDEDE8] text-[#64748B]'
                }`}
              >
                {ind.id} ({ind.sex}, G{ind.generation})
                <button onClick={() => removeIndividual(ind.id)} type="button" className="hover:opacity-70 cursor-pointer">
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-3">
          <h4 className="font-bold text-sm text-[#12312B] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#0F766E]" />
            {getTranslation(lang, 'tool_pedigree_chart_title')}
          </h4>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 text-[10px] font-semibold text-[#64748B]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 border-2 border-[#12312B] bg-white inline-block" />{getTranslation(lang, 'tool_pedigree_male')}</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border-2 border-[#12312B] bg-white inline-block" />{getTranslation(lang, 'tool_pedigree_female')}</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#0F766E] inline-block" />{getTranslation(lang, 'tool_pedigree_affected')}</span>
            </div>
            <ExportButton filename="pedigree.json" data={{ individuals, inference }} format="json" lang={lang} />
          </div>
        </div>

        {individuals.length === 0 ? (
          <p className="text-xs text-[#94A3B8] py-8 text-center">{getTranslation(lang, 'tool_pedigree_no_individuals')}</p>
        ) : (
          <div className="overflow-x-auto">
            <PedigreeVisualizer layout={layout} onSelectIndividual={setSelected} />
          </div>
        )}

        {selected && (
          <div className="text-[11px] font-mono text-[#0F766E] bg-[#F0FDF9] rounded-lg px-3 py-1.5 inline-block">
            {selected}
          </div>
        )}
      </div>

      <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-4">
        <h4 className="font-bold text-sm text-[#12312B]">{getTranslation(lang, 'tool_pedigree_inference_title')}</h4>

        {inference.mostLikely.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{getTranslation(lang, 'tool_pedigree_most_likely')}</span>
            <div className="flex flex-wrap gap-2">
              {inference.mostLikely.map((p) => (
                <span key={p} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#ECFDF5] border border-[#0F766E] text-[#0F766E]">
                  {getTranslation(lang, PATTERN_KEY[p])}
                </span>
              ))}
            </div>
          </div>
        )}

        {inference.ruledOut.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{getTranslation(lang, 'tool_pedigree_ruled_out')}</span>
            <div className="space-y-1.5">
              {inference.ruledOut.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] text-[#64748B] bg-[#F8FAFC] rounded-lg p-2.5">
                  <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-400" />
                  <span>
                    <b className="text-[#475569]">{getTranslation(lang, PATTERN_KEY[r.pattern])}:</b> {r.reason}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {inference.notes && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{inference.notes}</span>
          </div>
        )}
      </div>

      <ScientificExplanation
        formula="Rule-based: (1) affected child + 2 unaffected parents -> recessive; (2) every affected individual has an affected parent -> dominant; (3) affected father + affected son -> rules out X-linkage (fathers pass Y, not X, to sons); (4) affected father + unaffected mother with all daughters affected and no sons affected -> X-linked dominant signature"
        biologicalMeaning="A pedigree records which relatives in a family are affected by a trait. Because autosomal vs. X-linked and dominant vs. recessive inheritance each produce a characteristically different pattern of affected relatives across generations, geneticists can often narrow down - though not always uniquely determine - the likely mode of inheritance just from who is affected and how they are related."
        assumptions="Assumes full penetrance (every individual carrying the causal genotype shows the phenotype), no new (de novo) mutations within the pedigree, and that the trait is caused by a single gene - real traits are sometimes more complex than this."
        limitations="Small pedigrees are often genuinely ambiguous between two or more inheritance patterns - this tool reports every pattern still consistent with the data rather than forcing a single answer, and explains exactly which observation ruled out each excluded pattern. It cannot detect carrier status of unaffected individuals, incomplete penetrance, or non-Mendelian inheritance (e.g. mitochondrial, polygenic, or imprinted traits)."
        lang={lang}
      />
    </div>
  );
};
