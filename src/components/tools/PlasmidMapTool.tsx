import React, { useMemo, useState } from 'react';
import { SequenceInput } from '../common/SequenceInput';
import { ExportButton } from '../common/ExportButton';
import { ScientificExplanation } from '../common/ScientificExplanation';
import { PlasmidMapVisualizer, SelectedFeature } from '../visualizers/PlasmidMapVisualizer';
import { analyzePlasmid, CustomFeature } from '../../utils/plasmidMap';
import { COMMON_ENZYMES } from '../../utils/restriction';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';
import { Scissors, Dna as DnaIcon, Plus, Trash2, Download, Info, Orbit, Tag } from 'lucide-react';

interface ToolProps {
  lang: Language;
}

const SAMPLE_PLASMID =
  'ACTCCAAACGAGTGTCCGCTTGAAGTTCAATTCGTAATAGGAATTCGTCTGACACACATTCGGAAGGACACCACC' +
  'ATGGAAGCTTTTAAAAAACTGGAATGGGAACCACATGCTGCTGAAAAAAAATGGCCAGCTTGGAAATGGCATAAA' +
  'ACGCCATTTGCTCTGCATGGCTTTCTGAAAGGCGAAGAACATGAAGGCGGCCCATTTGCTACGTGGGAACATGAA' +
  'TGGTTTCCAGGCCCAAAAGAAGCTAAATTTGAATAAACAGACGGGACCACCCCGAACAGAAGATTATCCGGGGAT' +
  'CCGGATCTATAAGAGATCACAGTCCGGCGGGAACAAAACTAGGACGG';

const FEATURE_COLORS = ['#0F766E', '#8B5CF6', '#F59E0B', '#EC4899', '#0EA5E9', '#DC2626'];

export const PlasmidMapTool: React.FC<ToolProps> = ({ lang }) => {
  const [sequence, setSequence] = useState(SAMPLE_PLASMID);
  const [plasmidName, setPlasmidName] = useState('pDemo-1');
  const [selectedEnzymes, setSelectedEnzymes] = useState<string[]>(
    COMMON_ENZYMES.map((e) => e.name)
  );
  const [minOrfAa, setMinOrfAa] = useState(40);
  const [showOrfs, setShowOrfs] = useState(true);
  const [showSites, setShowSites] = useState(true);
  const [uniqueOnly, setUniqueOnly] = useState(false);
  const [customFeatures, setCustomFeatures] = useState<CustomFeature[]>([]);
  const [newFeatureLabel, setNewFeatureLabel] = useState('');
  const [newFeatureStart, setNewFeatureStart] = useState('1');
  const [newFeatureEnd, setNewFeatureEnd] = useState('100');
  const [selected, setSelected] = useState<SelectedFeature>(null);

  const result = useMemo(
    () => analyzePlasmid(sequence, selectedEnzymes, minOrfAa),
    [sequence, selectedEnzymes, minOrfAa]
  );

  const toggleEnzyme = (name: string) => {
    setSelectedEnzymes((prev) => (prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name]));
  };

  const addCustomFeature = () => {
    const start = parseInt(newFeatureStart, 10);
    const end = parseInt(newFeatureEnd, 10);
    if (!newFeatureLabel.trim() || !Number.isFinite(start) || !Number.isFinite(end)) return;
    const color = FEATURE_COLORS[customFeatures.length % FEATURE_COLORS.length];
    setCustomFeatures((prev) => [
      ...prev,
      { id: `feat-${Date.now()}`, label: newFeatureLabel.trim(), start, end, strand: 1, color },
    ]);
    setNewFeatureLabel('');
  };

  const removeCustomFeature = (id: string) => {
    setCustomFeatures((prev) => prev.filter((f) => f.id !== id));
    setSelected((prev) => (prev && prev.kind === 'custom' && prev.id === id ? null : prev));
  };

  const downloadSvg = () => {
    const svgEl = document.getElementById('plasmid-map-svg');
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgEl);
    if (!source.includes('xmlns=')) {
      source = source.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(plasmidName || 'plasmid_map').replace(/\s+/g, '_')}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const selectedDetail = useMemo(() => {
    if (!selected || !result.isValid) return null;
    if (selected.kind === 'site') {
      const site = result.enzymeSites.find((s) => s.enzymeName === selected.enzymeName);
      if (!site) return null;
      return {
        title: `${site.enzymeName} (${site.site})`,
        lines: [
          `${getTranslation(lang, 'tool_cut_pos')}: ${selected.position} bp`,
          site.isUniqueCutter ? getTranslation(lang, 'tool_plasmid_unique_cutter') : `${site.positions.length}× ${getTranslation(lang, 'tool_plasmid_cuts')}`,
        ],
      };
    }
    if (selected.kind === 'orf') {
      const orf = result.orfs[selected.index];
      if (!orf) return null;
      return {
        title: `ORF ${orf.frame} — ${orf.lengthAa} aa`,
        lines: [
          `${getTranslation(lang, 'tool_cut_pos')}: ${orf.start}–${orf.end} bp (${orf.lengthBp} bp)`,
          orf.proteinSequence.slice(0, 60) + (orf.proteinSequence.length > 60 ? '…' : ''),
        ],
      };
    }
    const feat = customFeatures.find((f) => f.id === selected.id);
    if (!feat) return null;
    return {
      title: feat.label,
      lines: [`${feat.start}–${feat.end} bp (${feat.end - feat.start + 1} bp)`],
    };
  }, [selected, result, customFeatures, lang]);

  return (
    <div className="space-y-6">
      <SequenceInput
        value={sequence}
        onChange={setSequence}
        sampleSequence={SAMPLE_PLASMID}
        sampleLabel={getTranslation(lang, 'tool_load_sample_plasmid')}
        allowedCharsRegex={/^[ATCG\s]+$/i}
        lang={lang}
      />

      <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#12312B] flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#0F766E]" /> {getTranslation(lang, 'tool_plasmid_name')}
            </label>
            <input
              type="text"
              value={plasmidName}
              onChange={(e) => setPlasmidName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#DDEDE8] bg-[#F3FAF7] text-sm font-semibold text-[#12312B] outline-none focus:border-[#0F766E]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#12312B]">{getTranslation(lang, 'tool_plasmid_min_orf_aa')}</label>
            <input
              type="number"
              min={5}
              max={1000}
              value={minOrfAa}
              onChange={(e) => setMinOrfAa(Math.max(5, parseInt(e.target.value, 10) || 5))}
              className="w-full px-3 py-2 rounded-lg border border-[#DDEDE8] bg-[#F3FAF7] text-sm font-mono font-semibold text-[#12312B] outline-none focus:border-[#0F766E]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {[
            { key: 'showOrfs', val: showOrfs, set: setShowOrfs, label: getTranslation(lang, 'tool_plasmid_show_orfs') },
            { key: 'showSites', val: showSites, set: setShowSites, label: getTranslation(lang, 'tool_plasmid_show_sites') },
            { key: 'uniqueOnly', val: uniqueOnly, set: setUniqueOnly, label: getTranslation(lang, 'tool_plasmid_unique_only') },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={t.val}
              onClick={() => t.set(!t.val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                t.val
                  ? 'bg-[#0F766E] text-white border-[#0F766E] shadow-2xs'
                  : 'bg-[#F3FAF7] text-[#64748B] border-[#DDEDE8] hover:bg-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="border-t border-[#DDEDE8] pt-3.5 space-y-2">
          <label className="text-xs font-bold text-[#12312B] flex items-center gap-1.5">
            <Scissors className="w-3.5 h-3.5 text-[#0F766E]" /> {getTranslation(lang, 'tool_select_restriction_enzymes')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {COMMON_ENZYMES.map((ez) => {
              const isChecked = selectedEnzymes.includes(ez.name);
              return (
                <button
                  key={ez.name}
                  type="button"
                  onClick={() => toggleEnzyme(ez.name)}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    isChecked
                      ? 'bg-[#ECFDF5] border-[#0F766E] text-[#0F766E] font-bold shadow-2xs'
                      : 'bg-[#F3FAF7] border-[#DDEDE8] text-[#64748B] hover:bg-white'
                  }`}
                >
                  <span className="block text-[11px] font-mono">{ez.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[#DDEDE8] pt-3.5 space-y-2.5">
          <label className="text-xs font-bold text-[#12312B] flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-[#0F766E]" /> {getTranslation(lang, 'tool_plasmid_custom_features')}
          </label>
          <div className="flex flex-wrap gap-2 items-end">
            <input
              type="text"
              placeholder={getTranslation(lang, 'tool_plasmid_feature_label')}
              value={newFeatureLabel}
              onChange={(e) => setNewFeatureLabel(e.target.value)}
              className="flex-1 min-w-[140px] px-3 py-2 rounded-lg border border-[#DDEDE8] bg-[#F3FAF7] text-xs font-semibold outline-none focus:border-[#0F766E]"
            />
            <input
              type="number"
              min={1}
              value={newFeatureStart}
              onChange={(e) => setNewFeatureStart(e.target.value)}
              className="w-20 px-2 py-2 rounded-lg border border-[#DDEDE8] bg-[#F3FAF7] text-xs font-mono outline-none focus:border-[#0F766E]"
            />
            <span className="text-xs text-[#94A3B8]">–</span>
            <input
              type="number"
              min={1}
              value={newFeatureEnd}
              onChange={(e) => setNewFeatureEnd(e.target.value)}
              className="w-20 px-2 py-2 rounded-lg border border-[#DDEDE8] bg-[#F3FAF7] text-xs font-mono outline-none focus:border-[#0F766E]"
            />
            <button
              type="button"
              onClick={addCustomFeature}
              className="px-3 py-2 rounded-lg bg-[#0F766E] text-white text-xs font-bold hover:opacity-90 cursor-pointer"
            >
              {getTranslation(lang, 'tool_plasmid_add_feature')}
            </button>
          </div>
          {customFeatures.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {customFeatures.map((f) => (
                <span
                  key={f.id}
                  className="flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: f.color }}
                >
                  {f.label} ({f.start}-{f.end})
                  <button type="button" onClick={() => removeCustomFeature(f.id)} className="hover:opacity-70 cursor-pointer">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {!result.isValid ? (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-medium flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{result.errorMessage}</span>
        </div>
      ) : (
        <>
          <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#DDEDE8] pb-3">
              <h4 className="font-bold text-sm text-[#12312B] flex items-center gap-2">
                <Orbit className="w-4 h-4 text-[#0F766E]" />
                {getTranslation(lang, 'tool_plasmid_map_title')}
              </h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadSvg}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F3FAF7] border border-[#DDEDE8] text-xs font-bold text-[#0F766E] hover:bg-white cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> SVG
                </button>
                <ExportButton filename="plasmid_map.json" data={result} format="json" lang={lang} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5">
              <div>
                <PlasmidMapVisualizer
                  result={result}
                  plasmidName={plasmidName}
                  customFeatures={customFeatures}
                  showOrfs={showOrfs}
                  showSites={showSites}
                  uniqueCuttersOnly={uniqueOnly}
                  onSelectFeature={setSelected}
                />
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
                    <span className="text-[10px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_total_seq_length')}</span>
                    <span className="text-sm font-bold text-[#0F766E] font-mono">{result.length.toLocaleString()} bp</span>
                  </div>
                  <div className="p-2.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
                    <span className="text-[10px] font-semibold text-[#64748B] block">GC</span>
                    <span className="text-sm font-bold text-[#0F766E] font-mono">{result.gcContentOverall.toFixed(1)}%</span>
                  </div>
                  <div className="p-2.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
                    <span className="text-[10px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_plasmid_unique_cutters')}</span>
                    <span className="text-sm font-bold text-[#DC2626] font-mono">{result.uniqueCutters.length}</span>
                  </div>
                  <div className="p-2.5 bg-[#ECFDF5] border border-[#DDEDE8] rounded-xl">
                    <span className="text-[10px] font-semibold text-[#64748B] block">{getTranslation(lang, 'tool_plasmid_orfs_found')}</span>
                    <span className="text-sm font-bold text-[#8B5CF6] font-mono">{result.orfs.length}</span>
                  </div>
                </div>

                {selectedDetail && (
                  <div className="p-3 bg-[#F3FAF7] border border-[#0F766E] rounded-xl space-y-1">
                    <span className="text-xs font-extrabold text-[#12312B] block">{selectedDetail.title}</span>
                    {selectedDetail.lines.map((l, i) => (
                      <span key={i} className="text-[11px] text-[#334155] block font-mono break-all">
                        {l}
                      </span>
                    ))}
                  </div>
                )}

                {result.uniqueCutters.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-[#12312B]">{getTranslation(lang, 'tool_plasmid_unique_cutters')}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {result.uniqueCutters.map((s) => (
                        <span
                          key={s.enzymeName}
                          className="px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-[10px] font-mono font-bold text-red-700"
                        >
                          {s.enzymeName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {result.orfs.length > 0 && (
            <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-xs space-y-3">
              <h4 className="font-bold text-sm text-[#12312B] flex items-center gap-2">
                <DnaIcon className="w-4 h-4 text-[#0F766E]" /> {getTranslation(lang, 'tool_plasmid_orfs_found')}
              </h4>
              <div className="border border-[#DDEDE8] rounded-xl overflow-hidden bg-[#F3FAF7]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#ECFDF5] text-[#12312B] border-b border-[#DDEDE8]">
                    <tr>
                      <th className="p-2.5 font-bold">{getTranslation(lang, 'tool_frame')}</th>
                      <th className="p-2.5 font-bold">{getTranslation(lang, 'tool_cut_pos')}</th>
                      <th className="p-2.5 font-bold">aa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDEDE8]">
                    {result.orfs.slice(0, 15).map((orf, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-white/60 transition-colors cursor-pointer"
                        onClick={() => setSelected({ kind: 'orf', index: idx })}
                      >
                        <td className="p-2.5 font-mono font-bold text-[#8B5CF6]">{orf.frame}</td>
                        <td className="p-2.5 font-mono text-[#0F766E]">{orf.start}–{orf.end}</td>
                        <td className="p-2.5 font-mono text-[#64748B]">{orf.lengthAa}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <ScientificExplanation
        formula="Angle(bp) = -90° + ((bp - 1) / length) × 360°, swept clockwise from the top"
        biologicalMeaning="A plasmid map lays a circular DNA molecule's key features - restriction sites, open reading frames, GC content - onto its physical, circular coordinate system. 'Unique cutters' (enzymes that cut exactly once) are the most practically important restriction sites: they let you linearize the plasmid, or cut it open at exactly one known point, without destroying it elsewhere."
        assumptions="Restriction site search and ORF detection both require a fully resolved A/C/G/T sequence. ORF detection scans linearly and does not currently detect a gene whose reading frame spans the circular origin (wraps from the end of the sequence back to the start)."
        limitations="This map shows sequence-derived features only (restriction sites, ORFs, GC content) plus any features you add manually - it does not know a vector's real annotated identity (e.g. which resistance gene or origin of replication it actually is) unless you label that yourself with a custom feature."
        lang={lang}
      />
    </div>
  );
};
