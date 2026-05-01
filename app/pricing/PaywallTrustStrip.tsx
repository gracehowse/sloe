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
        <div
          key={chip.label}
          aria-label={chip.a11yLabel}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/60 text-xs font-medium text-muted-foreground"
        >
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
          {chip.label}
        </div>
      ))}
    </div>
  );
}
