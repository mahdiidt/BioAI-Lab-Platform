import React from 'react';

/**
 * A very subtle, decorative background accent for the auth card header:
 * a faint double-helix-like sine pattern plus a soft dot grid. Intentionally
 * low-opacity and non-interactive (aria-hidden) — it should read as "quiet
 * scientific texture", not as a graphic element competing with the form.
 */
export const AuthBackgroundAccent: React.FC = () => {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 w-full h-full opacity-[0.07] dark:opacity-[0.1] pointer-events-none"
      viewBox="0 0 400 160"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id="auth-dot-grid" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="1.2" cy="1.2" r="1.2" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="400" height="160" fill="url(#auth-dot-grid)" className="text-[#0F766E]" />
      {/* Two gently sinusoidal strands, evoking a double helix without being literal */}
      <path
        d="M0,40 C40,10 80,70 120,40 C160,10 200,70 240,40 C280,10 320,70 360,40 C380,25 395,35 400,40"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-[#0F766E]"
      />
      <path
        d="M0,80 C40,110 80,50 120,80 C160,110 200,50 240,80 C280,110 320,50 360,80 C380,95 395,85 400,80"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-[#14B8A6]"
      />
    </svg>
  );
};
