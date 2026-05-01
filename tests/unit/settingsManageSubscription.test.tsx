/**
 * Settings — Pro users have an in-app cancel path on web (audit
 * 2026-04-30 P0-1).
 *
 * Pre-fix the "Your plan" card only rendered "View plans" when the
 * user wasn't Pro. Pro users had no way to manage their subscription
 * from the web — they had to email support or guess that there was a
 * `/account/billing` route. The fix surfaces a "Manage subscription"
 * link for Pro users that points at the existing
 * `/account/billing` server-component shell, which opens a single-use
 * Stripe Customer Portal session (with the new App Store fallback
 * branch for users who paid via RevenueCat → App Store, see
 * `accountBilling.test.tsx`).
 *
 * The tests below confirm:
 *   1. Pro users see "Manage subscription" pointing at /account/billing.
 *   2. Pro users do NOT see "View plans".
 *   3. Free users see "View plans" pointing at /pricing.
 *   4. Free users do NOT see "Manage subscription".
 *   5. The Pro link copy stays "Manage subscription" — Stripe / iOS
 *      Settings own the word "Cancel".
 *
 * Source-level structural test — keeps fast and avoids the deep
 * AppDataContext stack the full Settings tree depends on.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SETTINGS_PATH = resolve(__dirname, "../../src/app/components/Settings.tsx");
const SRC = readFileSync(SETTINGS_PATH, "utf8");

describe("Settings — Pro Manage subscription link (P0-1, 2026-04-30)", () => {
  it("renders a Manage subscription link with the canonical testID", () => {
    expect(SRC).toContain('data-testid="settings-manage-subscription-link"');
  });

  it("the Manage subscription link routes to /account/billing", () => {
    // The href + testid must travel together so the link is one
    // wired-up element, not two divergent strings.
    expect(SRC).toMatch(
      /href="\/account\/billing"[\s\S]{0,400}?data-testid="settings-manage-subscription-link"/,
    );
  });

  it("uses 'Manage subscription' copy (Stripe / iOS Settings own 'Cancel')", () => {
    // Find the JSX block for the Pro-tier link and confirm its label.
    const block = SRC.match(
      /\{userTier === "pro"[\s\S]*?<\/Link>\s*\)\}/,
    );
    expect(block).not.toBeNull();
    expect(block![0]).toContain("Manage subscription");
    expect(block![0]).not.toContain("Cancel");
  });

  it("the Pro link is only rendered when userTier === 'pro'", () => {
    // Conditional must be exact — defence against the regression where
    // a refactor flips the comparison and Free users start seeing the
    // billing link (which would 2/2b → /pricing in a loop).
    expect(SRC).toMatch(/\{userTier === "pro" && \(\s*<Link\s+href="\/account\/billing"/);
  });

  it("the View plans link is only rendered when userTier !== 'pro'", () => {
    // Mirror guard for the non-Pro branch.
    expect(SRC).toMatch(/\{userTier !== "pro" && \(\s*<Link\s+href="\/pricing"/);
  });
});
