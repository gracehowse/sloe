import { ShieldCheck } from "lucide-react";
import { getPaywallTrustChips } from "../../src/lib/landing/paywallTrust.ts";
import {
  BARCODE_FREE_PAYWALL_CHIP,
  BARCODE_FREE_PAYWALL_CHIP_TEST_ID,
} from "../../src/lib/nutrition/barcodeFreePromise.ts";

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
 *
 * DC4 (premium-bar audit 2026-05-14): the cancellation chip on web
 * names the Stripe Customer Portal explicitly — generic "in-app"
 * obscured whether web users cancelled through Apple, Stripe, or
 * a support email. `getPaywallTrustChips("web")` resolves the web
 * variant from the SSOT. The strip's bottom margin is reduced from
 * `mb-10` → `mb-2` so the guarantees sit adjacent to (~8px above)
 * the price grid that follows, per the Stripe Checkout precedent
 * of putting trust copy directly next to the price digit.
 */
export function PaywallTrustStrip() {
  const chips = getPaywallTrustChips("web");
  return (
    <div
      data-testid="paywall-trust-strip"
      className="mb-2 flex flex-wrap items-center justify-center gap-3 sm:gap-4"
    >
      <div
        data-testid={BARCODE_FREE_PAYWALL_CHIP_TEST_ID}
        aria-label={BARCODE_FREE_PAYWALL_CHIP.a11yLabel}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/25 text-xs font-medium text-foreground"
        style={{ background: "color-mix(in oklab, var(--primary) 8%, var(--background-secondary))" }}
      >
        <ShieldCheck
          className="h-3.5 w-3.5 shrink-0"
          style={{ color: "var(--accent-success-solid)" }}
          aria-hidden="true"
        />
        {BARCODE_FREE_PAYWALL_CHIP.label}
      </div>
      {chips.map((chip) => (
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
          // Canonical 2026-05-22: trust chips use --background-secondary,
          // NOT --input-background. Inputs and chips have different
          // roles; they were sharing a token by accident.
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-foreground"
          style={{ background: "var(--background-secondary)" }}
        >
          {/* SLOE DS: shield-check in the sage "on-track / secure" hue. */}
          <ShieldCheck
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: "var(--accent-success-solid)" }}
            aria-hidden="true"
          />
          {chip.label}
        </div>
      ))}
    </div>
  );
}
