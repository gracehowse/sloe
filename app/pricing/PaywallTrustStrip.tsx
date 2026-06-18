import { Calendar, Lock, ShieldCheck } from "lucide-react";
import { isFeatureEnabled } from "../../src/lib/analytics/track.ts";
import {
  getPaywallTrustChips,
  PAYWALL_TRUST_SECURE_CHECKOUT,
} from "../../src/lib/landing/paywallTrust.ts";
import {
  BARCODE_FREE_PAYWALL_CHIP,
  BARCODE_FREE_PAYWALL_CHIP_TEST_ID,
} from "../../src/lib/nutrition/barcodeFreePromise.ts";

/**
 * Trust strip rendered above the pricing tier grid (web /pricing).
 *
 * ENG-901 — when `paywall_trust_inline_v1` is on, matches Figma `284:2`:
 * a compact centred row with Lock/Calendar glyphs and · separators instead
 * of pill chips. Chip copy stays on the SSOT (`paywallTrust.ts`).
 */
export function PaywallTrustStrip() {
  const chips = getPaywallTrustChips("web");
  const inline = isFeatureEnabled("paywall_trust_inline_v1");

  if (inline) {
    return (
      <div
        data-testid="paywall-trust-strip"
        className="mb-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[11px] font-medium text-muted-foreground"
        role="list"
      >
        <span
          role="listitem"
          aria-label={PAYWALL_TRUST_SECURE_CHECKOUT.a11yLabel}
          className="inline-flex items-center gap-1"
        >
          <Lock className="h-3 w-3 shrink-0" aria-hidden />
          {PAYWALL_TRUST_SECURE_CHECKOUT.label}
        </span>
        <span aria-hidden className="text-muted-foreground/70">
          ·
        </span>
        <span
          role="listitem"
          aria-label={chips[0]?.a11yLabel}
          className="inline-flex items-center gap-1"
        >
          <Calendar className="h-3 w-3 shrink-0" aria-hidden />
          {chips[0]?.label}
        </span>
        {chips.slice(1).map((chip) => (
          <span key={chip.label} role="presentation" className="inline-flex items-center gap-2">
            <span aria-hidden className="text-muted-foreground/70">
              ·
            </span>
            <span role="listitem" aria-label={chip.a11yLabel}>
              {chip.label}
            </span>
          </span>
        ))}
        <span role="presentation" className="inline-flex items-center gap-2">
          <span aria-hidden className="text-muted-foreground/70">
            ·
          </span>
          <span
            role="listitem"
            data-testid={BARCODE_FREE_PAYWALL_CHIP_TEST_ID}
            aria-label={BARCODE_FREE_PAYWALL_CHIP.a11yLabel}
            className="inline-flex items-center gap-1"
          >
            <ShieldCheck
              className="h-3 w-3 shrink-0"
              style={{ color: "var(--accent-success-solid)" }}
              aria-hidden
            />
            {BARCODE_FREE_PAYWALL_CHIP.label}
          </span>
        </span>
      </div>
    );
  }

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
        <div
          key={chip.label}
          aria-label={chip.a11yLabel}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-foreground"
          style={{ background: "var(--background-secondary)" }}
        >
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
