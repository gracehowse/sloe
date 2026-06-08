/**
 * Mobile paywall — trust strip + receipt copy parity (audit 2026-04-30).
 *
 * Counter to the #1 user-sentiment pain across the 14-app competitor
 * scan. The mobile paywall must render trust chips matched to the
 * platform (mobile chips have iOS cancel-path copy that the web set
 * doesn't), and the post-purchase Alert must contain the four receipt
 * trust elements (cancel-anytime first, support email last).
 *
 * 2026-05-15: refactored from a static `PAYWALL_TRUST_CHIPS` constant
 * to `getPaywallTrustChips(platform)` so the cancel-anytime chip can
 * read "Cancel anytime in iOS Settings" on mobile vs "Cancel anytime
 * in Stripe Portal" on web (ENG-225 resolved). Tests updated.
 *
 * Source-level checks (same pattern as `paywallCopyParity.test.ts` and
 * `paywallHeroGradient.test.ts`) — the full paywall tree pulls
 * `react-native-purchases` + safe-area-context + expo-router which
 * aren't mountable under vitest.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PAYWALL_PATH = resolve(__dirname, "../../app/paywall.tsx");

describe("mobile paywall — trust strip render", () => {
  const src = readFileSync(PAYWALL_PATH, "utf8");

  it("imports the SSOT trust chips + receipt builder", () => {
    expect(src).toMatch(
      /from\s+"@suppr\/shared\/landing\/paywallTrust"/,
    );
    // 2026-05-15: was `PAYWALL_TRUST_CHIPS` static import; now
    // `getPaywallTrustChips` for platform-aware copy. SSOT root is
    // still `paywallTrust.ts` (asserted above).
    expect(src).toContain("getPaywallTrustChips");
    expect(src).toContain("buildReceiptTrustCopy");
  });

  it("imports ShieldCheck from lucide-react-native for the chip glyph", () => {
    expect(src).toMatch(/ShieldCheck.*from\s+"lucide-react-native"/s);
  });

  it("renders the trust strip wrapper with a stable testID", () => {
    expect(src).toContain('testID="paywall-trust-strip"');
  });

  it("calls getPaywallTrustChips with the mobile platform tag", () => {
    // 2026-05-15: was `PAYWALL_TRUST_CHIPS.map(`; now
    // `getPaywallTrustChips("mobile")` resolves the chip list at
    // render time so the mobile cancel-path string differs from web.
    expect(src).toMatch(/getPaywallTrustChips\(["']mobile["']\)/);
    // The result is mapped into chip Views via a local `trustChips`
    // memo (see paywall.tsx line 385).
    expect(src).toMatch(/trustChips\.map\(/);
  });

  it("trust strip + plan selector sit above the CTA (Figma 284:2)", () => {
    // Figma `284:2` rebuild (2026-06-08): the segmented billing toggle
    // + the big Pro TierCard were replaced by a two-row plan selector
    // (`PaywallPlanSelector`) and a standalone CTA (`PaywallCta`). The
    // trust chips moved to a compact centred row directly ABOVE the CTA
    // (the frame's trust-row position). Source order to pin:
    //   plan selector → trust strip → CTA.
    const planSelectorIdx = src.indexOf("<PaywallPlanSelector");
    const stripIdx = src.indexOf('testID="paywall-trust-strip"');
    const ctaIdx = src.indexOf("<PaywallCta");
    expect(planSelectorIdx).toBeGreaterThan(0);
    expect(stripIdx).toBeGreaterThan(0);
    expect(ctaIdx).toBeGreaterThan(0);
    // Plan selector first, then the trust strip, then the CTA.
    expect(planSelectorIdx).toBeLessThan(stripIdx);
    expect(stripIdx).toBeLessThan(ctaIdx);
  });
});

describe("mobile paywall — post-purchase trust Alert", () => {
  const src = readFileSync(PAYWALL_PATH, "utf8");

  it("invokes buildReceiptTrustCopy on entitled purchase success", () => {
    // Source-level guard: the success branch must compose its message
    // through the SSOT, not a hand-rolled string. Drift would mean the
    // mobile Alert and the web /checkout/success page can render
    // different copy.
    expect(src).toMatch(/buildReceiptTrustCopy\(\{[\s\S]*?cancelPath/);
  });

  it("uses platform-specific cancel paths (iOS vs Android)", () => {
    expect(src).toContain("Settings > Apple ID > Subscriptions");
    expect(src).toContain("Google Play > Payments & subscriptions");
  });

  it("opens an Alert with title 'You\\'re in' so the success message is acknowledged before navigation", () => {
    // Pre-audit the success path called router.replace immediately —
    // user never saw confirmation. The Alert.alert(...) call below
    // adds the explicit acknowledgement step. The button label is
    // 'Continue' so the user actively dismisses the trust copy
    // rather than racing past it.
    expect(src).toMatch(/Alert\.alert\(\s*"You're in"/);
    expect(src).toMatch(/text:\s*"Continue"/);
  });
});
