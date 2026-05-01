/**
 * Mobile paywall — trust strip + receipt copy parity (audit 2026-04-30).
 *
 * Counter to the #1 user-sentiment pain across the 14-app competitor
 * scan. The mobile paywall must render the same three trust chips as
 * web /pricing (`PAYWALL_TRUST_CHIPS` in `src/lib/landing/paywallTrust.ts`),
 * and the post-purchase Alert must contain the four receipt trust
 * elements (cancel-anytime first, support email last).
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
      /from\s+"\.\.\/\.\.\/\.\.\/src\/lib\/landing\/paywallTrust"/,
    );
    expect(src).toContain("PAYWALL_TRUST_CHIPS");
    expect(src).toContain("buildReceiptTrustCopy");
  });

  it("imports ShieldCheck from lucide-react-native for the chip glyph", () => {
    expect(src).toMatch(/ShieldCheck.*from\s+"lucide-react-native"/s);
  });

  it("renders the trust strip wrapper with a stable testID", () => {
    expect(src).toContain('testID="paywall-trust-strip"');
  });

  it("maps PAYWALL_TRUST_CHIPS into chip Views", () => {
    expect(src).toMatch(/PAYWALL_TRUST_CHIPS\.map\(/);
  });

  it("trust strip is rendered ABOVE the billing toggle in the ScrollView", () => {
    // The strip must appear before the toggle/tier section so it's
    // visible without scrolling. This pins the order in the JSX
    // tree: the trust-strip testID block must appear BEFORE the
    // `style={styles.toggleWrap}` JSX use site (not the styles
    // definition, which appears earlier in the file via useMemo).
    const stripIdx = src.indexOf('testID="paywall-trust-strip"');
    const toggleJsxIdx = src.indexOf("style={styles.toggleWrap}");
    expect(stripIdx).toBeGreaterThan(0);
    expect(toggleJsxIdx).toBeGreaterThan(0);
    expect(stripIdx).toBeLessThan(toggleJsxIdx);
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
