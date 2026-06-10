/** Sloe wordmark for marketing + nav (no external assets). */
export function SupprLogoMark({ className = "" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Sloe"
      className={`font-[family-name:var(--font-newsreader)] font-medium tracking-tight text-foreground-brand shrink-0 ${className}`}
      style={{ fontSize: "inherit", lineHeight: 1, letterSpacing: "-0.02em" }}
    >
      sloe
    </span>
  );
}

export function SupprLogoWordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center font-semibold tracking-tight text-foreground ${className}`}
    >
      <SupprLogoMark className="text-[28px] sm:text-[36px]" />
    </span>
  );
}
