/** Inline logo mark for marketing + nav (no external assets).
 *
 * 2026-05-22 (DRIFT-01 fix): aligned with the 2026-05-19 brand-mark
 * decision — black-on-cream (light) and white-on-black (dark) via
 * `--brand-mark-bg` / `--brand-mark-ring`, not the previous primary
 * indigo. Matches the canonical SupprMark at
 * `src/app/components/ui/suppr-mark.tsx` and mobile
 * `apps/mobile/components/SupprMark.tsx`.
 */
export function SupprLogoMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      width={32}
      height={32}
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="var(--brand-mark-bg)" />
      <text
        x="16"
        y="22.5"
        textAnchor="middle"
        fontFamily='"Inter", system-ui, -apple-system, Segoe UI, sans-serif'
        fontSize="20"
        fontWeight="800"
        letterSpacing="-0.02em"
        fill="var(--brand-mark-ring)"
      >
        S
      </text>
    </svg>
  );
}

export function SupprLogoWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-semibold tracking-tight text-foreground ${className}`}>
      <SupprLogoMark className="h-10 w-10 shrink-0 sm:h-14 sm:w-14" />
      <span>Suppr</span>
    </span>
  );
}
