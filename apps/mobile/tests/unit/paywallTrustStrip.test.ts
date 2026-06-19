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
const STRIP_PATH = resolve(__dirname, "../../components/paywall/PaywallTrustStrip.tsx");

describe("mobile paywall — trust strip render", () => {
  const src = readFileSync(PAYWALL_PATH, "utf8");
  const stripSrc = readFileSync(STRIP_PATH, "utf8");

  it("imports the SSOT trust chips + receipt builder", () => {
    expect(src).toMatch(
      /from\s+"@suppr\/shared\/landing\/paywallTrust"/,
    );
    expect(src).toContain("getPaywallTrustChips");
    expect(src).toContain("buildReceiptTrustCopy");
  });

  it("imports ShieldCheck from lucide-react-native for the chip glyph", () => {
    expect(stripSrc).toMatch(/ShieldCheck.*from\s+"lucide-react-native"/s);
  });

  it("renders the trust strip wrapper with a stable testID", () => {
    expect(stripSrc).toContain('testID="paywall-trust-strip"');
  });

  it("calls getPaywallTrustChips with the mobile platform tag", () => {
    expect(src).toMatch(/getPaywallTrustChips\(["']mobile["']\)/);
    expect(src).toMatch(/<PaywallTrustStrip/);
  });

  it("gates Figma inline trust row behind paywall_trust_inline_v1", () => {
    expect(stripSrc).toMatch(/paywall_trust_inline_v1/);
  });

  it("plan selector → trust strip render in order; CTA is a sticky footer (Figma 284:2 / ENG-1161)", () => {
    const planSelectorIdx = src.indexOf("<PaywallPlanSelector");
    const stripIdx = src.indexOf("<PaywallTrustStrip");
    expect(planSelectorIdx).toBeGreaterThan(0);
    expect(stripIdx).toBeGreaterThan(0);
    expect(planSelectorIdx).toBeLessThan(stripIdx);
    expect(src).toContain('testID="paywall-sticky-primary-cta"');
  });
});

describe("mobile paywall — post-purchase trust Alert", () => {
  const src = readFileSync(PAYWALL_PATH, "utf8");

  it("invokes buildReceiptTrustCopy on entitled purchase success", () => {
    expect(src).toMatch(/buildReceiptTrustCopy\(\{[\s\S]*?cancelPath/);
  });

  it("uses platform-specific cancel paths (iOS vs Android)", () => {
    expect(src).toContain("Settings > Apple ID > Subscriptions");
    expect(src).toContain("Google Play > Payments & subscriptions");
  });

  it("opens an Alert with title 'You\\'re in' so the success message is acknowledged before navigation", () => {
    expect(src).toMatch(/Alert\.alert\(\s*"You're in"/);
    expect(src).toMatch(/text:\s*"Continue"/);
  });
});
