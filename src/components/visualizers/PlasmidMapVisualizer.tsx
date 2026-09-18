import React from 'react';
import {
  PlasmidMapResult,
  CustomFeature,
  bpToAngleDeg,
  angleToPoint,
  describeArcPath,
} from '../../utils/plasmidMap';

export type SelectedFeature =
  | { kind: 'site'; enzymeName: string; position: number }
  | { kind: 'orf'; index: number }
  | { kind: 'custom'; id: string }
  | null;

interface PlasmidMapVisualizerProps {
  result: PlasmidMapResult;
  plasmidName: string;
  customFeatures: CustomFeature[];
  showOrfs: boolean;
  showSites: boolean;
  uniqueCuttersOnly: boolean;
  onSelectFeature: (f: SelectedFeature) => void;
}

const SIZE = 600;
const C = SIZE / 2;

const R_BP_LABEL = 284;
const R_BP_TICK_OUT = 272;
const R_BP_TICK_IN = 263;
const R_BACKBONE = 250;
const R_SITE_TICK_OUT = 259;
const R_SITE_TICK_IN = 244;
const R_SITE_LABEL = 266;
const R_ORF = 222;
const ORF_WIDTH = 15;
const R_CUSTOM = 182;
const CUSTOM_WIDTH = 13;
const R_GC_OUT = 152;
const R_GC_IN = 112;

function niceTickInterval(length: number): number {
  const candidates = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  const target = length / 16; // aim for roughly a dozen-ish ticks
  return candidates.reduce((best, c) => (Math.abs(c - target) < Math.abs(best - target) ? c : best), candidates[0]);
}

function arrowheadPolygon(angleDeg: number, r: number, width: number, clockwise: boolean): string {
  const tip = angleToPoint(C, C, r, angleDeg);
  const backAngle = angleDeg - (clockwise ? 1 : -1) * ((width * 1.3) / r) * (180 / Math.PI);
  const b1 = angleToPoint(C, C, r - width / 2, backAngle);
  const b2 = angleToPoint(C, C, r + width / 2, backAngle);
  return `${tip.x},${tip.y} ${b1.x},${b1.y} ${b2.x},${b2.y}`;
}

function gcColor(pct: number, avg: number): string {
  const delta = pct - avg;
  if (delta >= 0) {
    const t = Math.min(1, delta / 15);
    return `rgba(239, 68, 68, ${0.15 + t * 0.65})`; // above-average -> warm
  }
  const t = Math.min(1, -delta / 15);
  return `rgba(14, 165, 233, ${0.15 + t * 0.65})`; // below-average -> cool
}

export const PlasmidMapVisualizer: React.FC<PlasmidMapVisualizerProps> = ({
  result,
  plasmidName,
  customFeatures,
  showOrfs,
  showSites,
  uniqueCuttersOnly,
  onSelectFeature,
}) => {
  const { length, enzymeSites, uniqueCutters, orfs, gcWindow, gcContentOverall } = result;
  const tickInterval = niceTickInterval(length);
  const ticks: number[] = [];
  for (let bp = tickInterval; bp <= length; bp += tickInterval) ticks.push(bp);

  const sitesToShow = showSites ? (uniqueCuttersOnly ? uniqueCutters : enzymeSites) : [];

  return (
    <svg
      id="plasmid-map-svg"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="w-full h-auto select-none"
      role="img"
      aria-label="Circular plasmid map"
    >
      {/* GC content ring */}
      {gcWindow.map((pt, i) => (
        <path
          key={`gc-${i}`}
          d={describeArcPath(C, C, (R_GC_OUT + R_GC_IN) / 2, pt.startBp, pt.endBp, length)}
          stroke={gcColor(pt.gcPercent, gcContentOverall)}
          strokeWidth={R_GC_OUT - R_GC_IN}
          fill="none"
        >
          <title>{`GC ${pt.gcPercent.toFixed(0)}% (bp ${pt.startBp}-${pt.endBp})`}</title>
        </path>
      ))}
      <circle cx={C} cy={C} r={R_GC_OUT} fill="none" stroke="#E2E8F0" strokeWidth={1} />
      <circle cx={C} cy={C} r={R_GC_IN} fill="none" stroke="#E2E8F0" strokeWidth={1} />

      {/* Custom features */}
      {customFeatures.map((f) => (
        <g key={f.id} className="cursor-pointer" onClick={() => onSelectFeature({ kind: 'custom', id: f.id })}>
          <path
            d={describeArcPath(C, C, R_CUSTOM, f.start, f.end, length)}
            stroke={f.color}
            strokeWidth={CUSTOM_WIDTH}
            fill="none"
            strokeLinecap="round"
          >
            <title>{`${f.label} (${f.start}-${f.end})`}</title>
          </path>
        </g>
      ))}

      {/* ORF arrows */}
      {showOrfs &&
        orfs.map((orf, i) => {
          const clockwise = orf.strand === 1;
          const tipBp = clockwise ? orf.end : orf.start;
          const tipAngle = bpToAngleDeg(tipBp, length);
          return (
            <g key={`orf-${i}`} className="cursor-pointer" onClick={() => onSelectFeature({ kind: 'orf', index: i })}>
              <path
                d={describeArcPath(C, C, R_ORF, orf.start, orf.end, length)}
                stroke={clockwise ? '#0F766E' : '#8B5CF6'}
                strokeWidth={ORF_WIDTH}
                fill="none"
                opacity={0.88}
              >
                <title>{`ORF ${orf.frame} — ${orf.lengthAa} aa (bp ${orf.start}-${orf.end})`}</title>
              </path>
              <polygon points={arrowheadPolygon(tipAngle, R_ORF, ORF_WIDTH + 6, clockwise)} fill={clockwise ? '#0F766E' : '#8B5CF6'} opacity={0.95} />
            </g>
          );
        })}

      {/* Plasmid backbone */}
      <circle cx={C} cy={C} r={R_BACKBONE} fill="none" stroke="#334155" strokeWidth={2.5} />

      {/* Restriction sites */}
      {sitesToShow.flatMap((site) =>
        site.positions.map((pos, pIdx) => {
          const angle = bpToAngleDeg(pos, length);
          const pIn = angleToPoint(C, C, R_SITE_TICK_IN, angle);
          const pOut = angleToPoint(C, C, R_SITE_TICK_OUT, angle);
          const pLabel = angleToPoint(C, C, R_SITE_LABEL, angle);
          return (
            <g
              key={`site-${site.enzymeName}-${pIdx}`}
              className="cursor-pointer"
              onClick={() => onSelectFeature({ kind: 'site', enzymeName: site.enzymeName, position: pos })}
            >
              <line
                x1={pIn.x}
                y1={pIn.y}
                x2={pOut.x}
                y2={pOut.y}
                stroke={site.isUniqueCutter ? '#DC2626' : '#94A3B8'}
                strokeWidth={site.isUniqueCutter ? 2.4 : 1.4}
              >
                <title>{`${site.enzymeName} (${site.site}) — bp ${pos}${site.isUniqueCutter ? ' — unique cutter' : ''}`}</title>
              </line>
              <text
                x={pLabel.x}
                y={pLabel.y}
                fontSize={9}
                fontWeight={site.isUniqueCutter ? 800 : 500}
                fill={site.isUniqueCutter ? '#DC2626' : '#64748B'}
                textAnchor={Math.cos((angle * Math.PI) / 180) > 0 ? 'start' : 'end'}
                dominantBaseline="middle"
                transform={`rotate(${angle > 90 && angle < 270 ? angle + 180 : angle}, ${pLabel.x}, ${pLabel.y})`}
              >
                {site.enzymeName}
              </text>
            </g>
          );
        })
      )}

      {/* Position ticks + bp labels */}
      {ticks.map((bp) => {
        const angle = bpToAngleDeg(bp, length);
        const pIn = angleToPoint(C, C, R_BP_TICK_IN, angle);
        const pOut = angleToPoint(C, C, R_BP_TICK_OUT, angle);
        const pLabel = angleToPoint(C, C, R_BP_LABEL, angle);
        return (
          <g key={`tick-${bp}`}>
            <line x1={pIn.x} y1={pIn.y} x2={pOut.x} y2={pOut.y} stroke="#CBD5E1" strokeWidth={1.2} />
            <text
              x={pLabel.x}
              y={pLabel.y}
              fontSize={8.5}
              fill="#94A3B8"
              fontWeight={600}
              textAnchor={Math.cos((angle * Math.PI) / 180) > 0.15 ? 'start' : Math.cos((angle * Math.PI) / 180) < -0.15 ? 'end' : 'middle'}
              dominantBaseline="middle"
            >
              {bp >= 1000 ? `${(bp / 1000).toFixed(bp % 1000 === 0 ? 0 : 1)}k` : bp}
            </text>
          </g>
        );
      })}

      {/* Center label */}
      <text x={C} y={C - 8} textAnchor="middle" fontSize={17} fontWeight={800} fill="#12312B">
        {plasmidName || 'Untitled Plasmid'}
      </text>
      <text x={C} y={C + 14} textAnchor="middle" fontSize={12} fontWeight={600} fill="#64748B">
        {length.toLocaleString()} bp
      </text>
    </svg>
  );
};
