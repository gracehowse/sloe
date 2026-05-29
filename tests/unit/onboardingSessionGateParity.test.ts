/**
 * ENG-672 / ENG-689 — onboarding signup session gate, web ↔ mobile parity.
 *
 * The shared `canAdvance("signup", …)` guard lives in
 * `src/lib/onboarding/state.ts` and is pinned behaviourally in
 * `onboardingState.test.ts`. Each platform shell must THREAD the live
 * session into that guard — otherwise the footer Continue stays enabled
 * and an unauthenticated user can walk the flow, losing every answer
 * on the terminal auth bounce.
 *
 * Step-level UX (confirm-email interstitial, Apple-only mobile) is covered
 * in `onboardingSignupSessionGate.test.tsx` (web + mobile). This file
 * pins the shell wiring both platforms share.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = resolve(__dirname, "../..");

const SHELLS = {
  web: resolve(REPO, "src/app/components/onboarding/web-flow.tsx"),
  mobile: resolve(REPO, "apps/mobile/components/onboarding/mobile-flow.tsx"),
  mobileEntry: resolve(REPO, "apps/mobile/app/onboarding.tsx"),
} as const;

describe("onboarding signup session gate — shell parity (ENG-672)", () => {
  it("web-flow threads hasSession from authedUserId into canAdvance", () => {
    const src = readFileSync(SHELLS.web, "utf8");
    expect(src).toMatch(/canAdvanceStep\(currentStepId,\s*state,\s*\{/);
    expect(src).toMatch(/hasSession:\s*authedUserId\s*!=\s*null/);
    // Footer must honour the recomputed gate, not the context default.
    expect(src).toMatch(/disabled=\{[^}]*!canAdvance/);
  });

  it("mobile-flow threads hasSession from userId into canAdvance", () => {
    const src = readFileSync(SHELLS.mobile, "utf8");
    expect(src).toMatch(/canAdvanceStep\(currentStepId,\s*state,\s*\{/);
    expect(src).toMatch(/hasSession:\s*userId\s*!=\s*null/);
    expect(src).toMatch(/disabled=\{[^}]*!canAdvance/);
  });

  it("mobile-flow auto-skips signup when userId is already present", () => {
    const src = readFileSync(SHELLS.mobile, "utf8");
    expect(src).toMatch(/if\s*\(\s*isSignup\s*&&\s*userId\s*\)/);
    expect(src).toMatch(/go\(1\)/);
  });

  it("canonical /onboarding route hosts MobileFlow under OnboardingProvider", () => {
    const src = readFileSync(SHELLS.mobileEntry, "utf8");
    expect(src).toMatch(/from\s+["']@\/components\/onboarding\/context["']/);
    expect(src).toMatch(/from\s+["']@\/components\/onboarding\/mobile-flow["']/);
    expect(src).toMatch(/<OnboardingProvider/);
    expect(src).toMatch(/<MobileFlow/);
  });
});
