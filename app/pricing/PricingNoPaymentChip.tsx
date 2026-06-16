import { PAYWALL_NO_PAYMENT_DUE_CHIP } from "../../src/lib/landing/paywallTrust.ts";

/** ENG-970 — web parity for the trial honesty chip above the Pro CTA. */
export function PricingNoPaymentChip() {
  return (
    <p
      data-testid={PAYWALL_NO_PAYMENT_DUE_CHIP.testId}
      className="mb-2 text-center text-xs font-semibold text-[var(--accent-success-solid)]"
      aria-label={PAYWALL_NO_PAYMENT_DUE_CHIP.a11yLabel}
    >
      {PAYWALL_NO_PAYMENT_DUE_CHIP.label}
    </p>
  );
}
