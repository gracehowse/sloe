/** Sloe wordmark for marketing + nav (no external assets). Lowercase "sloe"
 *  in Fraunces Light per the v3 prototype's LOCKED Fraunces-only wordmark. */
export function SupprLogoMark({ className = "" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Sloe"
      className={`font-[family-name:var(--font-brand)] font-light tracking-tight text-foreground-brand shrink-0 lowercase ${className}`}
      style={{ fontSize: "inherit", lineHeight: 1, letterSpacing: "-0.01em" }}
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
