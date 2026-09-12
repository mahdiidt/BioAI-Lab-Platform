import React from 'react';

/**
 * A small rotating 3D DNA helix for the auth modal header. This reuses the
 * exact `.dna-3d-container` / `.dna-3d-helix` CSS animation already defined
 * in index.css and used on the homepage Hero — just at a smaller scale —
 * so the auth page feels lively without introducing any new visual language.
 */
export const MiniHelix3D: React.FC = () => {
  return (
    <div className="dna-3d-container relative shrink-0" aria-hidden="true">
      <div className="dna-3d-helix flex flex-col items-center space-y-1.5">
        {[1, 2, 3, 4].map((step) => {
          const angle = step * 50;
          return (
            <div
              key={step}
              style={{ transform: `rotateY(${angle}deg)` }}
              className="w-9 h-1.5 flex items-center justify-between"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#0F766E] shadow-sm shadow-[#0F766E]" />
              <div className="flex-1 h-px bg-gradient-to-r from-[#0F766E] via-[#14B8A6] to-[#0EA5E9] mx-0.5 opacity-80" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9] shadow-sm shadow-[#0EA5E9]" />
            </div>
          );
        })}
      </div>
    </div>
  );
};
