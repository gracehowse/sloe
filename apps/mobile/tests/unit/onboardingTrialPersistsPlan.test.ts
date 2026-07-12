/**
 * ENG-1507 — the trial-path persist hole.
 *
 * The terminal `upgrade` step's "Start free trial" used to push
 * `/paywall?from=onboarding` WITHOUT persisting: every from=onboarding
 * paywall exit replaces straight to `/(tabs)` (unmounting the flow), so
 * the navigation-coupled `complete()` handler never ran on that path.
 * Result: the paywall's personalised-plan card rendered the PREVIOUS
 * run's profiles row ("for lose weight" against a just-selected
 * build-muscle plan), and for refresh-plan users the new plan was
 * silently discarded forever.
 *
 * These pins guard the fix: persist BEFORE the paywall push, via the
 * context's `persist()` (the persist-without-navigation split of
 * `handleComplete`), with a real async-commit CTA state.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");

const upgradeSrc = read("components/onboarding/steps/upgrade.tsx");
const flowSrc = read("components/onboarding/mobile-flow.tsx");
const completionSrc = read("components/onboarding/useOnboardingCompletion.ts");
const contextSrc = read("components/onboarding/context.tsx");

describe("ENG-1507 — Start free trial persists the plan before the paywall", () => {
  it("chooseTrial awaits persist() BEFORE router.push('/paywall?from=onboarding')", () => {
    const body = upgradeSrc.slice(
      upgradeSrc.indexOf("const chooseTrial"),
      upgradeSrc.indexOf("return ("),
    );
    const persistIdx = body.indexOf("await persist()");
    const pushIdx = body.indexOf('router.push("/paywall?from=onboarding"');
    expect(persistIdx).toBeGreaterThan(-1);
    expect(pushIdx).toBeGreaterThan(-1);
    expect(persistIdx).toBeLessThan(pushIdx);
  });

  it("a failed persist stays on-step (no paywall push on the failure path)", () => {
    const body = upgradeSrc.slice(
      upgradeSrc.indexOf("const chooseTrial"),
      upgradeSrc.indexOf("return ("),
    );
    // The push is gated on the persist result resolving true.
    expect(body).toMatch(/const persisted = await persist\(\);\s*\n\s*if \(!persisted\) return;/);
  });

  it("the CTA is a real async commit: disabled + busy while saving", () => {
    expect(upgradeSrc).toContain("disabled={savingPlan}");
    expect(upgradeSrc).toContain("accessibilityState={{ busy: savingPlan, disabled: savingPlan }}");
    expect(upgradeSrc).toContain("ActivityIndicator");
  });

  it("the flow shell registers a persist-without-navigation handler", () => {
    expect(contextSrc).toContain("registerPersist");
    expect(contextSrc).toMatch(/persist: \(\) => Promise<boolean>/);
    expect(flowSrc).toContain("registerPersist(async () => {");
    // The split lives in useOnboardingCompletion: persistAndSeed owns
    // persist + seed + analytics (no navigation); handleComplete
    // navigates on top of it.
    expect(completionSrc).toContain("const persistAndSeed = React.useCallback");
    const persistBody = completionSrc.slice(
      completionSrc.indexOf("const persistAndSeed"),
      completionSrc.indexOf("const handleComplete"),
    );
    expect(persistBody).toContain("persistOnboarding");
    expect(persistBody).not.toContain("router.replace");
  });
});

describe("ENG-1507 review round — persisted-once re-entry guard + reset-flag preservation", () => {
  const persistBody = completionSrc.slice(
    completionSrc.indexOf("const persistAndSeed"),
    completionSrc.indexOf("const handleComplete"),
  );
  const completeBody = completionSrc.slice(
    completionSrc.indexOf("const handleComplete"),
  );

  it("a successful persistAndSeed run is cached; re-entry skips persist + seed + analytics", () => {
    // Paywall back-out + "Continue on Free" runs complete() →
    // persistAndSeed AGAIN. The guard returns the cached result before
    // setCompleting/persistOnboarding, so onboarding_completed can never
    // double-fire and seeds/plan are never rebuilt.
    expect(completionSrc).toContain("const persistedOnceRef = React.useRef<");
    const guardIdx = persistBody.indexOf("persistedOnceRef.current?.userId === userId");
    const busyIdx = persistBody.indexOf("setCompleting(true)");
    const persistIdx = persistBody.indexOf("persistOnboarding");
    expect(guardIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(busyIdx);
    expect(guardIdx).toBeLessThan(persistIdx);
    // Only SUCCESS is cached (failures stay retryable) — the cache write
    // sits with the ok:true result construction.
    expect(persistBody).toContain("persistedOnceRef.current = { userId, result }");
    expect(persistBody).toMatch(/ok: true as const/);
  });

  it("persistAndSeed reads but does NOT consume the reset-plan prompt flag", () => {
    // The trial path (persist → paywall) never shows the Keep/Clear
    // prompt; deleting the flag there silently discarded the choice.
    expect(persistBody).toContain('getItem("suppr.reset-plan-pending-prompt")');
    expect(persistBody).not.toContain('removeItem("suppr.reset-plan-pending-prompt")');
  });

  it("handleComplete consumes the flag only when the prompt actually shows", () => {
    const promptIdx = completeBody.indexOf("Keep my logs and weight history?");
    const removeIdx = completeBody.indexOf('removeItem("suppr.reset-plan-pending-prompt")');
    expect(removeIdx).toBeGreaterThan(-1);
    expect(promptIdx).toBeGreaterThan(-1);
    // The consume sits inside the refreshPlanPending branch, right before
    // the Alert renders.
    const branchIdx = completeBody.indexOf("if (persisted.refreshPlanPending)");
    expect(branchIdx).toBeGreaterThan(-1);
    expect(removeIdx).toBeGreaterThan(branchIdx);
    expect(removeIdx).toBeLessThan(promptIdx);
  });
});
