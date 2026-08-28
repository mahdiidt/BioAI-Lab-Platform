import React from 'react';
import { parseNewick, PhyloNode } from '../../utils/newickParser';
import { Network, AlertCircle } from 'lucide-react';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';

interface PhylogeneticTreeVisualizerProps {
  newickString: string;
  lang?: Language;
}

export const PhylogeneticTreeVisualizer: React.FC<PhylogeneticTreeVisualizerProps> = ({ newickString, lang = 'en' }) => {
  const parsed = parseNewick(newickString);

  if (!parsed.isValid || !parsed.root) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-medium flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
        <span>{parsed.errorMessage || getTranslation(lang, 'tool_phylo_invalid_format')}</span>
      </div>
    );
  }

  const root = parsed.root;

  // Flatten leaf nodes to calculate Y layout
  const leaves: PhyloNode[] = [];
  const collectLeaves = (node: PhyloNode) => {
    if (node.children.length === 0) leaves.push(node);
    else node.children.forEach(collectLeaves);
  };
  collectLeaves(root);

  const numLeaves = Math.max(leaves.length, 1);
  const rowHeight = 36;
  const width = 500;
  const height = Math.max(200, numLeaves * rowHeight + 40);

  // Assign Y positions to leaves
  const yMap = new Map<PhyloNode, number>();
  leaves.forEach((leaf, idx) => {
    yMap.set(leaf, 30 + idx * rowHeight);
  });

  // Calculate Y position for internal nodes
  const calculateY = (node: PhyloNode): number => {
    if (node.children.length === 0) {
      return yMap.get(node) || 30;
    }
    const childrenY = node.children.map(calculateY);
    const avgY = childrenY.reduce((a, b) => a + b, 0) / childrenY.length;
    yMap.set(node, avgY);
    return avgY;
  };
  calculateY(root);

  // Render SVG branches recursively
  let nodeCounter = 0;
  const renderBranches = (node: PhyloNode, currentX: number, depth: number): React.ReactNode[] => {
    nodeCounter++;
    const keyId = `node-${nodeCounter}-${node.name || depth}`;
    const nodeY = yMap.get(node) || 30;
    const branchLen = node.branchLength !== undefined ? Math.max(30, node.branchLength * 200) : 60;
    const nextX = currentX + branchLen;

    const elements: React.ReactNode[] = [];

    if (node.children.length > 0) {
      const childYMin = Math.min(...node.children.map((c) => yMap.get(c) || 30));
      const childYMax = Math.max(...node.children.map((c) => yMap.get(c) || 30));

      // Horizontal stem
      elements.push(
        <line
          key={`stem-${keyId}`}
          x1={currentX}
          y1={nodeY}
          x2={nextX}
          y2={nodeY}
          stroke="#0F766E"
          strokeWidth="2"
        />
      );

      // Vertical junction line
      elements.push(
        <line
          key={`vert-${keyId}`}
          x1={nextX}
          y1={childYMin}
          x2={nextX}
          y2={childYMax}
          stroke="#0F766E"
          strokeWidth="2"
        />
      );

      // Render children
      node.children.forEach((child) => {
        elements.push(...renderBranches(child, nextX, depth + 1));
      });
    } else {
      // Leaf Node
      elements.push(
        <g key={`leaf-${keyId}`}>
          <line x1={currentX} y1={nodeY} x2={nextX} y2={nodeY} stroke="#0F766E" strokeWidth="2" />
          <circle cx={nextX} cy={nodeY} r="4" fill="#14B8A6" />
          <text x={nextX + 8} y={nodeY + 4} fill="#12312B" fontSize="11" fontWeight="bold" fontFamily="monospace">
            {node.name || getTranslation(lang, 'tool_phylo_taxon_fallback')}
            {node.branchLength !== undefined && (
              <tspan fill="#64748B" fontSize="9" fontWeight="normal"> ({node.branchLength})</tspan>
            )}
          </text>
        </g>
      );
    }

    return elements;
  };

  return (
    <div className="p-5 bg-white border border-[#DDEDE8] rounded-2xl shadow-sm space-y-3">
      <div className="flex items-center justify-between text-xs font-bold text-[#12312B] border-b border-[#DDEDE8] pb-2">
        <span className="flex items-center gap-2">
          <Network className="w-4 h-4 text-[#0F766E]" /> {getTranslation(lang, 'tool_phylo_cladogram_header')}
        </span>
        <span className="text-[#0F766E] font-mono bg-[#ECFDF5] px-2.5 py-0.5 rounded-full border border-[#DDEDE8]">
          {leaves.length} {getTranslation(lang, 'tool_phylo_taxa_leaves')}
        </span>
      </div>

      {parsed.warning && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{parsed.warning}</span>
        </div>
      )}

      <div className="flex justify-center overflow-x-auto p-2">
        <svg width={width} height={height} className="font-mono text-xs">
          {renderBranches(root, 20, 0)}
        </svg>
      </div>
    </div>
  );
};
