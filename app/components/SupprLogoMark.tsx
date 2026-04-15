/** Inline logo mark for marketing + nav (no external assets). */
export function SupprLogoMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      width={32}
      height={32}
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="var(--primary, #4c6ce0)" />
      <text
        x="16"
        y="22.5"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
        fontSize="17"
        fontWeight="800"
        fill="#fff"
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
