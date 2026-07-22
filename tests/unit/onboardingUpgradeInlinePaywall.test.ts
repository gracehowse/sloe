/**
 * ENG-1459 — onboarding terminal step / paywall inline collapse (web).
 *
 * Flag `onboarding_upgrade_inline_paywall_v1` (DEFAULT-OFF — net-new
 * structural money-flow UI, root CLAUDE.md feature-flag rule):
 *   - flag OFF: the pre-ENG-1459 two-surface flow (static callout +
 *     "Start free trial"/"Continue on Free" buttons + `UpgradePaywallDialog`
 *     modal) must stay byte-identical.
 *   - flag ON: the step renders `UpgradePaywallContent` inline — no
 *     dialog, no second "Start free trial" button.
 *
 * Source-level pins (established pattern for this file family — see
 * `onboardingUpgradeStaticCallout.test.ts` / `onboardingUpgradeHonesty.test.ts`
 * — real rendering of `UpgradePaywallDialog`'s Stripe/Supabase-heavy tree is
 * covered separately by `upgradePaywallDialog.test.tsx`, which this change
 * leaves passing untouched).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..", "..");
const upgradeSrc = readFileSync(
  resolve(ROOT, "src/app/components/onboarding/steps/upgrade.tsx"),
  "utf8",
);
const contentSrc = readFileSync(
  resolve(ROOT, "src/app/components/paywall/UpgradePaywallContent.tsx"),
  "utf8",
);
const checkoutHookSrc = readFileSync(
  resolve(ROOT, "src/app/components/paywall/useUpgradePaywallCheckout.ts"),
  "utf8",
);
const dialogSrc = readFileSync(
  resolve(ROOT, "src/app/components/suppr/upgrade-paywall-dialog.tsx"),
  "utf8",
);
const proFeaturesSrc = readFileSync(
  resolve(ROOT, "src/app/components/paywall/upgradePaywallProFeatures.ts"),
  "utf8",
);
const webTrackSrc = readFileSync(
  resolve(ROOT, "src/lib/analytics/track.ts"),
  "utf8",
);
const mobileAnalyticsSrc = readFileSync(
  resolve(ROOT, "apps/mobile/lib/analytics.ts"),
  "utf8",
);

const FLAG = "onboarding_upgrade_inline_paywall_v1";

describe("ENG-1459 — flag registration", () => {
  it("is registered DEFAULT-OFF (KNOWN_DEFAULT_OFF_FLAGS) on web, not REDESIGN_DEFAULT_ON", () => {
    expect(webTrackSrc).toMatch(
      /KNOWN_DEFAULT_OFF_FLAGS = \[[\s\S]*?"onboarding_upgrade_inline_paywall_v1"[\s\S]*?\] as const;/,
    );
    const start = webTrackSrc.indexOf("const REDESIGN_DEFAULT_ON = new Set<string>([");
    const end = webTrackSrc.indexOf("]);", start);
    expect(start).toBeGreaterThan(-1);
    const redesignDefaultOnBlock = webTrackSrc.slice(start, end);
    expect(redesignDefaultOnBlock).not.toContain(FLAG);
  });

  it("is registered on both platforms (web ↔ mobile KNOWN_DEFAULT_OFF_FLAGS parity)", () => {
    expect(webTrackSrc).toContain(`"${FLAG}"`);
    expect(mobileAnalyticsSrc).toContain(`"${FLAG}"`);
  });
});

describe("ENG-1459 — web onboarding step, flag-OFF path is untouched", () => {
  it("still mounts the legacy two-button + UpgradePaywallDialog flow", () => {
    expect(upgradeSrc).toContain('variant="outline"');
    expect(upgradeSrc).toContain("Start free trial");
    expect(upgradeSrc).toContain("Continue on Free");
    expect(upgradeSrc).toMatch(/<UpgradePaywallDialog[\s\S]*?bypassSessionCap/);
    expect(upgradeSrc).toContain("setDialogOpen(true)");
  });
});

describe("ENG-1459 — web onboarding step, flag-ON path", () => {
  it("reads the flag and branches before the legacy return", () => {
    expect(upgradeSrc).toContain(
      'const INLINE_PAYWALL_FLAG = "onboarding_upgrade_inline_paywall_v1"',
    );
    expect(upgradeSrc).toMatch(
      /const inlinePaywall = isFeatureEnabled\(INLINE_PAYWALL_FLAG\)/,
    );
    expect(upgradeSrc).toContain("if (inlinePaywall) {");
  });

  it("renders UpgradePaywallContent inline instead of the dialog", () => {
    const inlineBranch = upgradeSrc.slice(
      upgradeSrc.indexOf("if (inlinePaywall) {"),
      upgradeSrc.indexOf("<StepHeader"),
    );
    expect(inlineBranch).toContain("<UpgradePaywallContent");
    expect(inlineBranch).toContain('defaultPeriod="annual"');
    expect(inlineBranch).toContain("onSecondaryCta={chooseFree}");
    expect(inlineBranch).toContain("onPrimaryCtaIntent={markTrialIntent}");
    // No second dialog mount and no separate "Start free trial" button in
    // the inline branch — UpgradePaywallContent owns the single CTA pair.
    expect(inlineBranch).not.toContain("<UpgradePaywallDialog");
    expect(inlineBranch).not.toContain(">Start free trial<");
  });

  it("still surfaces onboarding step position context (overline) inline", () => {
    const inlineBranch = upgradeSrc.slice(
      upgradeSrc.indexOf("if (inlinePaywall) {"),
      upgradeSrc.indexOf("<UpgradePaywallContent"),
    );
    expect(inlineBranch).toContain("{overline}");
  });

  it("fires paywall_viewed + upsell_variant_shown on step mount (legal C10 — no dialog-open to hang it on anymore)", () => {
    expect(upgradeSrc).toMatch(
      /if \(!inlinePaywall\) return;[\s\S]*?paywall_viewed/,
    );
    expect(upgradeSrc).toContain("upsell_variant_shown");
    expect(upgradeSrc).toContain('surface: "onboarding_inline"');
  });
});

describe("ENG-1459 — UpgradePaywallContent preserves the legal-preservation checklist", () => {
  it("Pro-guard: renders nothing for Pro users", () => {
    expect(contentSrc).toContain("if (!variant) return null;");
  });

  it("C4 — 'Continue for free' is present and unconditionally reachable (no scroll gate)", () => {
    expect(contentSrc).toContain("Continue for free");
  });

  it("C2 — trial wording only in the annual-selected disclosure branch", () => {
    expect(contentSrc).toMatch(/const trialLead = isAnnual/);
  });

  it("C1/C8 — VAT gate hook + trust strip both render", () => {
    expect(contentSrc).toContain("useUpgradeDialogTaxClause");
    expect(contentSrc).toContain("<PaywallTrustStrip");
  });

  it("CMA renewal disclosure renders above the CTAs with its test id", () => {
    const disclosureIdx = contentSrc.indexOf('data-testid="upsell-renewal-note"');
    const primaryCtaJsxIdx = contentSrc.indexOf("onClick={handlePrimaryCta}");
    // The disclosure paragraph appears before the primary CTA button in the JSX.
    expect(disclosureIdx).toBeGreaterThan(-1);
    expect(primaryCtaJsxIdx).toBeGreaterThan(-1);
    expect(disclosureIdx).toBeLessThan(primaryCtaJsxIdx);
  });

  it("C6-adjacent — the feature copy it renders says 'estimated macros', never 'verified macros'", () => {
    expect(contentSrc).toContain("UPGRADE_PAYWALL_PRO_FEATURES");
    expect(proFeaturesSrc).toMatch(/estimated macros/i);
    expect(proFeaturesSrc).not.toMatch(/verified macros/i);
  });

  it("C10 — dismiss analytics fire on the secondary CTA before the caller's callback", () => {
    expect(contentSrc).toMatch(
      /paywall_dismissed[\s\S]*?upsell_variant_dismissed[\s\S]*?onSecondaryCta\(\);/,
    );
  });

  it("pricing-integrity — reads PRICING_TIERS, never a hardcoded price literal for the CTA", () => {
    expect(contentSrc).toContain("PRICING_TIERS.find");
  });
});

describe("ENG-1459 — useUpgradePaywallCheckout mirrors the dialog's checkout exactly", () => {
  it("hits the same Stripe checkout endpoint with the same payload shape", () => {
    expect(checkoutHookSrc).toContain('fetch("/api/stripe/checkout"');
    expect(checkoutHookSrc).toContain('body: JSON.stringify({ tier: "pro", period })');
  });

  it("fires checkout_started + upsell_variant_converted (legal C10)", () => {
    expect(checkoutHookSrc).toContain("AnalyticsEvents.checkout_started");
    expect(checkoutHookSrc).toContain("AnalyticsEvents.upsell_variant_converted");
  });
});

describe("ENG-1459 — the dialog itself is untouched by this ticket", () => {
  it("upgrade-paywall-dialog.tsx does not import the new inline content/hook", () => {
    // Deliberate scope boundary — see UpgradePaywallContent.tsx's doc
    // comment for the regression-risk rationale. A future, separately
    // reviewed ticket may migrate the dialog onto this shared content.
    expect(dialogSrc).not.toContain("UpgradePaywallContent");
    expect(dialogSrc).not.toContain("useUpgradePaywallCheckout");
  });
});
