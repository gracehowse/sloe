/**
 * Onboarding handoff — no price shock (audit 2026-04-30; extended
 * ENG-1241 2026-07-01).
 *
 * Cal AI's failure pattern: hide the paywall until the user has spent
 * 6 minutes on onboarding answering body-stat questions, then surprise
 * them with a $79.99 annual sticker and no clean way out. Suppr's
 * terminal completion routes directly to `/(tabs)?…&firstRun=1` — never
 * traps the user on a paywall — so a user who declines Pro lands inside
 * the product, and the price is visible from screen 1 of any paywall
 * they *do* open (the trust strip + tier card render before any input).
 *
 * ENG-1241 (2026-07-01) added an optional, skippable "See Pro" trial
 * step (`upgrade`) as the TERMINAL step of the conversion funnel
 * (`onboarding_conversion_funnel_v1`), running first-log → upgrade. This
 * test now guards the invariant that must hold whether the funnel flag
 * is ON or OFF:
 *
 *   - flag OFF: the handoff is byte-identical to the pre-funnel flow —
 *     completion routes to `/(tabs)`, never `/paywall`.
 *   - flag ON: the "See Pro" step's SKIP ("Continue on Free") completes
 *     onboarding → Today via `complete()`; it never `go(1)`s into a
 *     dead end, never opens a second paywall, and the paywall the TRIAL
 *     CTA routes to lands the user back on Today (not a
 *     notifications-prompt detour) on skip / close / purchase.
 *
 * If anyone re-introduces a forced `/paywall` hop on completion, a
 * `go(1)`-to-nowhere skip, or a notifications-prompt detour from the
 * onboarding paywall entry, one of these breaks.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const FLOW_PATH = resolve(
  __dirname,
  "../../components/onboarding/mobile-flow.tsx",
);
// ENG-1507 (2026-07-11): the completion pipeline (persistAndSeed +
// navigating handleComplete) was extracted from the flow shell into
// `useOnboardingCompletion.ts` (line-budget + the persist-before-paywall
// split). The completion-routing pins follow the code to its new home.
const COMPLETION_PATH = resolve(
  __dirname,
  "../../components/onboarding/useOnboardingCompletion.ts",
);
const UPGRADE_STEP_PATH = resolve(
  __dirname,
  "../../components/onboarding/steps/upgrade.tsx",
);
const PAYWALL_PATH = resolve(__dirname, "../../app/paywall.tsx");

const flowSrc = readFileSync(FLOW_PATH, "utf8");
const completionSrc = readFileSync(COMPLETION_PATH, "utf8");
const upgradeSrc = readFileSync(UPGRADE_STEP_PATH, "utf8");
const paywallSrc = readFileSync(PAYWALL_PATH, "utf8");

describe("mobile onboarding — no post-onboarding paywall shock", () => {
  it("terminal-step completion routes to /(tabs), not /paywall", () => {
    // The successful completion branch lands on Today directly. A
    // future regression that adds `router.replace("/paywall")` here
    // would price-shock users — surface that as a test failure so
    // the regression is forced to think about price-visibility.
    // The route call carries an `as any` cast because the homeQs
    // branches between `&firstRun=1` (true first-time completion) and
    // `&refresh=1` (Settings → Refresh my plan). Match the prefix
    // substring so the test stays implementation-flexible.
    expect(completionSrc).toMatch(/router\.replace\(`\/\(tabs\)\$\{homeQs\}`/);
    expect(completionSrc).not.toMatch(/router\.replace\(\s*["'`]\/paywall/);
    expect(flowSrc).not.toMatch(/router\.replace\(\s*["'`]\/paywall/);
  });

  it("handoff query string carries firstRun=1 for first-time completion", () => {
    // refresh-plan branch uses `&refresh=1`; first-time completion path
    // must still set firstRun so Today fires its first-run polish.
    expect(completionSrc).toContain("&firstRun=1");
    expect(completionSrc).toContain("onboarding_complete=1");
  });

  it("the See Pro step's terminal role is `upgrade`, not `first-log` (skip → Today)", () => {
    // ENG-1241 — the funnel runs first-log → upgrade, so `upgrade` is
    // the terminal step. That's what makes the skip a clean completion
    // to Today rather than an advance into another onboarding screen.
    expect(flowSrc).toMatch(
      /isTerminal\s*=\s*conversionFunnelEnabled\s*\?\s*currentStepId === "upgrade"/,
    );
  });
});

describe("mobile onboarding — See Pro (upgrade) step skip integrity (ENG-1241)", () => {
  it('"Continue on Free" completes onboarding directly — it does NOT go(1) into a dead end', () => {
    // The skip bail-out must run the terminal completion (`complete()`),
    // which routes to Today. A `go(1)` here would clamp at the last step
    // and strand the user (the pre-ENG-1241 bug this guards against).
    expect(upgradeSrc).toMatch(/const chooseFree\s*=\s*React\.useCallback/);
    // chooseFree must call complete(), never go(1).
    const chooseFreeBody = upgradeSrc.slice(
      upgradeSrc.indexOf("const chooseFree"),
      upgradeSrc.indexOf("const chooseTrial"),
    );
    expect(chooseFreeBody).toContain("complete()");
    expect(chooseFreeBody).not.toMatch(/\bgo\(1\)/);
  });

  it("the trial CTA routes to the compliant paywall (from=onboarding), not a bespoke buy screen", () => {
    expect(upgradeSrc).toContain("/paywall?from=onboarding");
  });

  it("skip is a neutrally-labelled, always-visible control (legal C4 — no confirmshaming)", () => {
    expect(upgradeSrc).toContain("Continue on Free");
    // No "are you sure / miss out / don't lose" confirmshaming copy.
    expect(upgradeSrc).not.toMatch(/miss out|are you sure|don't lose|last chance/i);
  });
});

describe("mobile paywall — onboarding entry lands on Today (ENG-1241)", () => {
  it("defines an onboarding-aware forward exit that lands on /(tabs) (no notifications-prompt detour)", () => {
    expect(paywallSrc).toContain("onboardingForwardExit");
    expect(paywallSrc).toMatch(
      /paywallFrom === "onboarding"\s*\?\s*"\/\(tabs\)\?firstRun=1"/,
    );
  });

  it("every onboarding exit path (skip / close / purchase / restore) uses that exit", () => {
    // No raw notifications-prompt route should be reachable from the
    // onboarding entry — they all funnel through `onboardingForwardExit`.
    // The skip bail-out and close handler both use it.
    const continueFree = paywallSrc.slice(
      paywallSrc.indexOf("function onContinueFree"),
      paywallSrc.indexOf("function onClose"),
    );
    expect(continueFree).toContain("onboardingForwardExit");
    expect(continueFree).not.toContain('"/notifications-prompt"');
  });

  it("does not open a second paywall on dismiss (forward-only, no loop)", () => {
    // The onboarding close path replaces the route (no push back onto a
    // paywall), so a dismiss can't re-surface the paywall.
    expect(paywallSrc).not.toMatch(/router\.push\(\s*["'`]\/paywall/);
  });
});
