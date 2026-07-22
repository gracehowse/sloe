/**
 * ENG-1459 — onboarding terminal step / paywall inline collapse (mobile).
 *
 * Flag `onboarding_upgrade_inline_paywall_v1` (DEFAULT-OFF — net-new
 * structural money-flow UI, root CLAUDE.md feature-flag rule):
 *   - flag OFF: the pre-ENG-1459 flow (static callout + "Start free
 *     trial" → `persist()` → `router.push("/paywall?from=onboarding")` +
 *     "Continue on Free" → `complete()`) must stay byte-identical — see
 *     `onboardingNoPaywallShock.test.ts`'s source pins, which this change
 *     leaves passing untouched.
 *   - flag ON: the step renders `PaywallContent` fed by
 *     `useOnboardingInlinePaywall` — no `router.push("/paywall...")`.
 *
 * `apps/mobile/app/paywall.tsx` (the standalone route every OTHER
 * `/paywall?from=X` call site still uses) is UNCHANGED by this ticket —
 * see `PaywallContent.tsx`'s doc comment for the regression-risk
 * rationale. Source-level pins (established pattern for this file
 * family — see `onboardingNoPaywallShock.test.ts`).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// __dirname = apps/mobile/tests/unit — mirrors onboardingNoPaywallShock.test.ts's
// relative-path convention (../../ reaches apps/mobile).
const upgradeSrc = readFileSync(
  resolve(__dirname, "../../components/onboarding/steps/upgrade.tsx"),
  "utf8",
);
const hookSrc = readFileSync(
  resolve(__dirname, "../../components/paywall/useOnboardingInlinePaywall.ts"),
  "utf8",
);
const contentSrc = readFileSync(
  resolve(__dirname, "../../components/paywall/PaywallContent.tsx"),
  "utf8",
);
const paywallRouteSrc = readFileSync(
  resolve(__dirname, "../../app/paywall.tsx"),
  "utf8",
);
const mobileAnalyticsSrc = readFileSync(
  resolve(__dirname, "../../lib/analytics.ts"),
  "utf8",
);
const webTrackSrc = readFileSync(
  resolve(__dirname, "../../../../src/lib/analytics/track.ts"),
  "utf8",
);

const FLAG = "onboarding_upgrade_inline_paywall_v1";

describe("ENG-1459 — flag registration (mobile)", () => {
  it("is registered DEFAULT-OFF (KNOWN_DEFAULT_OFF_FLAGS), not REDESIGN_DEFAULT_ON", () => {
    expect(mobileAnalyticsSrc).toMatch(
      /KNOWN_DEFAULT_OFF_FLAGS = \[[\s\S]*?"onboarding_upgrade_inline_paywall_v1"[\s\S]*?\] as const;/,
    );
    const start = mobileAnalyticsSrc.indexOf(
      "const REDESIGN_DEFAULT_ON = new Set<string>([",
    );
    const end = mobileAnalyticsSrc.indexOf("]);", start);
    expect(start).toBeGreaterThan(-1);
    expect(mobileAnalyticsSrc.slice(start, end)).not.toContain(FLAG);
  });

  it("is registered on both platforms (web ↔ mobile parity)", () => {
    expect(mobileAnalyticsSrc).toContain(`"${FLAG}"`);
    expect(webTrackSrc).toContain(`"${FLAG}"`);
  });
});

describe("ENG-1459 — mobile onboarding step, flag-OFF path is untouched", () => {
  it("still persists, then pushes /paywall?from=onboarding", () => {
    const chooseTrialBody = upgradeSrc.slice(
      upgradeSrc.indexOf("const chooseTrial = React.useCallback"),
      upgradeSrc.indexOf("if (inlinePaywall) {"),
    );
    expect(chooseTrialBody).toContain("await persist()");
    expect(chooseTrialBody).toContain('router.push("/paywall?from=onboarding"');
  });

  it("apps/mobile/app/paywall.tsx (the standalone route) is not imported or modified by the inline wiring", () => {
    expect(upgradeSrc).not.toMatch(/from ["']@\/app\/paywall["']/);
    // The standalone route still owns onboardingForwardExit — unchanged.
    expect(paywallRouteSrc).toContain("onboardingForwardExit");
  });
});

describe("ENG-1459 — mobile onboarding step, flag-ON path", () => {
  it("reads the flag and branches before the legacy return", () => {
    expect(upgradeSrc).toContain(
      'const INLINE_PAYWALL_FLAG = "onboarding_upgrade_inline_paywall_v1"',
    );
    expect(upgradeSrc).toMatch(
      /const inlinePaywall = isFeatureEnabled\(INLINE_PAYWALL_FLAG\)/,
    );
    expect(upgradeSrc).toContain("if (inlinePaywall) {");
  });

  it("renders PaywallContent fed by useOnboardingInlinePaywall — no route push", () => {
    const inlineBranch = upgradeSrc.slice(
      upgradeSrc.indexOf("if (inlinePaywall) {"),
      upgradeSrc.indexOf("return (\n    <MobileStepBody>\n      <MobileStepHeader"),
    );
    expect(inlineBranch).toContain("<PaywallContent offer={inlineOffer} />");
    expect(inlineBranch).not.toContain("router.push");
    expect(inlineBranch).not.toContain("/paywall?from=onboarding");
  });

  it("wires onExit to complete() and onContinueFree to chooseFree (same terminal completion path)", () => {
    const wiring = upgradeSrc.slice(
      upgradeSrc.indexOf("const inlineOffer = useOnboardingInlinePaywall("),
      upgradeSrc.indexOf("const chooseTrial ="),
    );
    expect(wiring).toContain("onExit: complete");
    expect(wiring).toContain("onContinueFree: chooseFree");
    expect(wiring).toContain("onPrimaryCtaIntent: markTrialIntent");
  });

  it("keeps the onboarding step-position overline visible inline", () => {
    const branchStart = upgradeSrc.indexOf("if (inlinePaywall) {");
    const inlineBranch = upgradeSrc.slice(
      branchStart,
      upgradeSrc.indexOf("<PaywallContent offer={inlineOffer} />", branchStart),
    );
    expect(inlineBranch).toContain("{overline}");
  });
});

describe("ENG-1459 — useOnboardingInlinePaywall preserves the legal-preservation checklist", () => {
  it("already-entitled users exit before any sell content or analytics fires", () => {
    expect(hookSrc).toMatch(/isProEntitled\(info\)[\s\S]{0,80}setAlreadyEntitled\(true\)/);
    const guardIdx = hookSrc.indexOf("setAlreadyEntitled(true)");
    const viewedIdx = hookSrc.indexOf("AnalyticsEvents.paywall_viewed");
    expect(guardIdx).toBeGreaterThan(-1);
    expect(viewedIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(viewedIdx);
  });

  it("paywall_viewed is deduped per mount (viewedRef guard)", () => {
    expect(hookSrc).toContain("viewedRef.current");
  });

  it("fires checkout_started / checkout_completed / paywall_period_changed with honest surface tagging", () => {
    expect(hookSrc).toContain("AnalyticsEvents.checkout_started");
    expect(hookSrc).toContain("AnalyticsEvents.checkout_completed");
    expect(hookSrc).toContain("AnalyticsEvents.paywall_period_changed");
    expect(hookSrc).toContain('surface: "onboarding_inline"');
  });

  it("disclosure includes the full CMA six-element set + UK/EU 14-day + 7-day refund + platform cancel path", () => {
    expect(hookSrc).toMatch(/renews automatically at/);
    expect(hookSrc).toContain("Starts your 7-day free trial");
    expect(hookSrc).toContain("Prices include any applicable VAT");
    expect(hookSrc).toContain("7-day refund policy: support@getsloe.com");
    expect(hookSrc).toContain(
      "under the Consumer Contracts Regulations 2013 and Directive 2011/83/EU you have a 14-day right to cancel for a full refund",
    );
    expect(hookSrc).toContain("Settings > Apple ID > Subscriptions");
    expect(hookSrc).toContain("Google Play > Payments & subscriptions");
  });

  it("only RC priceString renders as money text — FALLBACK_PRICES is the only literal-price fallback", () => {
    expect(hookSrc).toContain("product.priceString");
    expect(hookSrc).toContain("FALLBACK_PRICES");
  });
});

describe("ENG-1459 — PaywallContent preserves the legal-preservation checklist", () => {
  it("already-entitled guard renders nothing", () => {
    expect(contentSrc).toContain("if (offer.alreadyEntitled) return null;");
  });

  it("Restore purchase affordance is present", () => {
    expect(contentSrc).toContain("Restore previous purchase");
    expect(contentSrc).toContain("Restore purchase");
  });

  it("Continue for free is present and unconditional", () => {
    expect(contentSrc).toContain("Continue for free");
  });

  it("auto-renew disclosure + nutrition-estimate note render with their test ids", () => {
    expect(contentSrc).toContain('testID="paywall-autorenew-disclosure"');
    expect(contentSrc).toContain('testID="paywall-nutrition-estimate-note"');
  });

  it("trust strip renders with platform-correct chips", () => {
    expect(hookSrc).toContain('getPaywallTrustChips("mobile")');
    expect(contentSrc).toContain("<PaywallTrustStrip");
  });
});
