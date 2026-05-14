import { ShieldCheck } from "lucide-react";
import { PAYWALL_TRUST_CHIPS } from "../../src/lib/landing/paywallTrust.ts";

/**
 * Three-chip trust strip rendered above the pricing tier grid.
 *
 * Counters the #1 user-sentiment pain ("billing trauma") flagged by
 * the 2026-04-30 14-app competitor audit. Cal AI hides price until
 * the end of onboarding; Lose It runs "trial ends" banners for
 * weeks; Lifesum auto-renews at full sticker. Suppr leads with
 * the inverse: cancel-anytime, refundable, no-surprise.
 *
 * Copy lives in `src/lib/landing/paywallTrust.ts` (leaf SSOT) so
 * the mobile paywall renders the same three chips with identical
 * wording. Subtle styling — small chips, secondary text colour, no
 * jarring colours — so the strip reads as supporting context, not
 * an interruptive banner.
 */
export function PaywallTrustStrip() {
  return (
    <div
      data-testid="paywall-trust-strip"
      className="mb-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4"
    >
      {PAYWALL_TRUST_CHIPS.map((chip) => (
        // 2026-05-13 (premium-bar audit DC4 polish — dark-mode contrast
        // audit on the green check glyph): emerald-500 was the same
        // colour in both modes; on the dark `bg-card/60` it read as
        // muted. Lift to emerald-400 in dark for better contrast.
        // Body text bumped from text-muted-foreground to a slightly
        // stronger slate so the chip reads as a confident assurance,
        // not a footnote.
        <div
          key={chip.label}
          aria-label={chip.a11yLabel}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/60 text-xs font-medium text-slate-700 dark:text-slate-200"
        >
          <ShieldCheck
            className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
          {chip.label}
        </div>
      ))}
    </div>
  );
}
