import * as React from "react";
import { Icons } from "./icons";

/**
 * `<SearchResultConfidenceChip>` — the web twin of the mobile
 * `apps/mobile/components/ui/SearchResultConfidenceChip.tsx`. The legible
 * Verified / Estimated confidence chip from the 2026-05-31 search-results
 * redesign, shared across the web food-search, barcode, and voice-log result
 * surfaces so the chip language cannot drift between the three logging entry
 * points — or between web and mobile.
 *
 * Two honest tiers, each with its own glyph + colour:
 *   - "verified"  → soft-blue chip (`bg-primary/10 text-primary-solid`),
 *     Lucide `Check`. Authoritative source AND a strong match (caller derives
 *     this — the chip never invents it).
 *   - "estimated" → warm honey-amber chip (`--chip-estimated` /
 *     `--chip-estimated-soft`, #BF8324 — mirrors the mobile chip exactly),
 *     Lucide `Info`. Community / commercial / AI-estimated data, or a weak
 *     match. The estimated tint deliberately does NOT reuse the over-budget
 *     `--warning` orange (which paints the over-budget fat macro in the same
 *     row), so one colour can never mean both "estimated" and "over budget".
 *
 * CLAUDE.md trust posture: this component renders ONLY the tier the caller
 * passes. Callers must derive "verified" from a real provenance + match signal
 * (e.g. a verified USDA/OFF barcode row), never from a UI default. AI-estimated
 * surfaces (voice log) are always "estimated" — an estimate is never "Verified".
 *
 * Consolidated from formerly-inline copies of this exact markup (FoodSearchPanel,
 * today-barcode-dialog, and the new voice-log review row) into a single
 * primitive (ENG-1429). NOTE: distinct from `components/ui/confidence-chip.tsx`
 * (the neutral low/medium/high TDEE pill) — different role, different tokens.
 * Do not collapse the two.
 */

export type SearchResultConfidenceTier = "verified" | "estimated";

const DEFAULT_LABEL: Record<SearchResultConfidenceTier, string> = {
  verified: "Structured",
  estimated: "Estimated",
};

export interface SearchResultConfidenceChipProps {
  tier: SearchResultConfidenceTier;
  /** Optional label override. Defaults to "Structured" / "Estimated". */
  label?: string;
  /** Per-surface test hook. Defaults to `confidence-chip`. */
  testId?: string;
  /** Extra classes appended to the chip's base classes. */
  className?: string;
}

export function SearchResultConfidenceChip({
  tier,
  label,
  testId,
  className,
}: SearchResultConfidenceChipProps) {
  const displayLabel = label ?? DEFAULT_LABEL[tier];
  const Glyph = tier === "verified" ? Icons.check : Icons.info;
  return (
    <span
      data-testid={testId ?? "confidence-chip"}
      aria-label={`${displayLabel} nutrition data`}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-extrabold tracking-wide ${
        tier === "verified" ? "bg-primary/10 text-primary-solid" : ""
      }${className ? ` ${className}` : ""}`}
      style={
        tier === "verified"
          ? undefined
          : {
              color: "var(--chip-estimated)",
              backgroundColor: "var(--chip-estimated-soft)",
            }
      }
    >
      <Glyph className="h-2.5 w-2.5" aria-hidden />
      {displayLabel}
    </span>
  );
}

export default SearchResultConfidenceChip;
