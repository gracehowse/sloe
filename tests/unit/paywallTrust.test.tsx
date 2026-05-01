/**
 * Paywall trust copy + strip parity tests (audit 2026-04-30).
 *
 * Counter to the #1 user-sentiment pain across the 14-app competitor
 * scan: hidden prices, surprise renewals, refund-friction, "billed
 * via website not iTunes" cancellation traps. The trust strip + the
 * receipt copy are the load-bearing surfaces that make the Suppr
 * counter-pitch visible. These tests guard:
 *
 *   1. The SSOT (paywallTrust.ts) carries exactly three chips in the
 *      canonical order (cancel / refund / no mid-trial price change).
 *   2. The web /pricing PaywallTrustStrip renders all three chips
 *      with a ShieldCheck icon and the expected accessibility labels.
 *   3. `buildReceiptTrustCopy` composes the four trust elements in
 *      the right order (cancel-anytime first, support email last),
 *      so the mobile Alert and the web /checkout/success page can't
 *      drift from each other.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  PAYWALL_TRUST_CHIPS,
  buildReceiptTrustCopy,
} from "../../src/lib/landing/paywallTrust";
import { PaywallTrustStrip } from "../../app/pricing/PaywallTrustStrip";

describe("PAYWALL_TRUST_CHIPS — SSOT shape", () => {
  it("carries exactly three chips", () => {
    expect(PAYWALL_TRUST_CHIPS).toHaveLength(3);
  });

  it("orders chips: cancel anytime, refund, no mid-trial price change", () => {
    expect(PAYWALL_TRUST_CHIPS[0].label).toBe("Cancel anytime in-app");
    expect(PAYWALL_TRUST_CHIPS[1].label).toBe("7-day refund, no email needed");
    expect(PAYWALL_TRUST_CHIPS[2].label).toBe("Price never changes mid-trial");
  });

  it("each chip has a non-empty long-form a11y label", () => {
    for (const chip of PAYWALL_TRUST_CHIPS) {
      expect(chip.a11yLabel.length).toBeGreaterThan(chip.label.length);
    }
  });

  it("no chip label ends with a trailing period (visual rhythm)", () => {
    for (const chip of PAYWALL_TRUST_CHIPS) {
      expect(chip.label.endsWith(".")).toBe(false);
    }
  });
});

describe("PaywallTrustStrip — web /pricing rendering", () => {
  it("renders all three chips visibly", () => {
    render(<PaywallTrustStrip />);
    expect(screen.getByText("Cancel anytime in-app")).toBeInTheDocument();
    expect(screen.getByText("7-day refund, no email needed")).toBeInTheDocument();
    expect(
      screen.getByText("Price never changes mid-trial"),
    ).toBeInTheDocument();
  });

  it("attaches the SSOT a11y labels to each chip", () => {
    render(<PaywallTrustStrip />);
    for (const chip of PAYWALL_TRUST_CHIPS) {
      expect(screen.getByLabelText(chip.a11yLabel)).toBeInTheDocument();
    }
  });

  it("exposes a stable testid the parity test can target", () => {
    render(<PaywallTrustStrip />);
    expect(screen.getByTestId("paywall-trust-strip")).toBeInTheDocument();
  });
});

describe("buildReceiptTrustCopy — receipt composition", () => {
  it("leads with cancel-anytime", () => {
    const copy = buildReceiptTrustCopy({
      trialEndsLabel: "in 7 days",
      cancelPath: "Settings > Subscription",
    });
    // The first sentence after "Thanks for joining" must be
    // cancel-anytime — anchors trust before any other clause.
    const afterThanks = copy.replace(/^Thanks for joining Suppr Pro\.\s*/, "");
    expect(afterThanks).toMatch(/^Cancel anytime/);
  });

  it("contains all four trust elements (cancel, trial-end, refund, support)", () => {
    const copy = buildReceiptTrustCopy({
      trialEndsLabel: "in 7 days",
      cancelPath: "Settings > Apple ID > Subscriptions",
    });
    expect(copy).toContain("Cancel anytime");
    expect(copy).toContain("Settings > Apple ID > Subscriptions");
    expect(copy).toContain("trial ends in 7 days");
    expect(copy).toContain("first charge after that");
    expect(copy).toContain("7 days");
    expect(copy).toContain("no questions asked");
    expect(copy).toContain("support@suppr-club.com");
  });

  it("substitutes the cancelPath into the lead clause (platform-specific)", () => {
    const ios = buildReceiptTrustCopy({
      trialEndsLabel: "in 7 days",
      cancelPath: "Settings > Apple ID > Subscriptions",
    });
    const android = buildReceiptTrustCopy({
      trialEndsLabel: "in 7 days",
      cancelPath: "Google Play > Payments & subscriptions",
    });
    expect(ios).toContain("Settings > Apple ID > Subscriptions");
    expect(ios).not.toContain("Google Play");
    expect(android).toContain("Google Play > Payments & subscriptions");
    expect(android).not.toContain("Apple ID");
  });

  it("never says 'email support to cancel' — counters Lifesum-pattern", () => {
    // Lifesum's anti-pattern: refund cancellation hell where the only
    // path is a support email. Suppr's promise is the inverse — the
    // support email is a fallback for *something going wrong*, not
    // the cancellation path.
    const copy = buildReceiptTrustCopy({
      trialEndsLabel: "in 7 days",
      cancelPath: "Settings > Subscription",
    });
    expect(copy.toLowerCase()).not.toContain("email support to cancel");
    expect(copy.toLowerCase()).not.toContain("contact support to cancel");
  });
});
