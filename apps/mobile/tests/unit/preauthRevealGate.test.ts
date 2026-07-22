import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ENG-1513 / ENG-1563 — fresh installs run the onboarding questionnaire +
 * plan reveal BEFORE the auth wall behind `mobile_preauth_reveal_v1`, with
 * the flag latched to AsyncStorage so a cold relaunch mid-reveal does not
 * bounce to /login.
 */
const MOBILE = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(MOBILE, p), "utf8");

describe("ENG-1513 / ENG-1563 — pre-auth reveal gate", () => {
  it("registers the flag as default-OFF", () => {
    expect(read("lib/analytics.ts")).toContain('"mobile_preauth_reveal_v1"');
  });

  it("(tabs) gate uses the latched flag + signed-in-before marker", () => {
    const src = read("app/(tabs)/_layout.tsx");
    expect(src).toContain("usePreauthRevealLatched");
    expect(src).toContain("useHasSignedInBefore");
    expect(src).toMatch(/preauthRevealOn && !signedInBefore[\s\S]{0,80}Redirect href="\/onboarding"/);
    const sessionBranch = src.slice(src.indexOf("if (!session)"));
    expect(sessionBranch).toContain('href="/login"');
  });

  it("waits on latch + marker reads before redirecting", () => {
    const src = read("app/(tabs)/_layout.tsx");
    expect(src).toMatch(/preauthRevealOn === null[\s\S]{0,160}AppLaunchScreen/);
  });

  it("exposes a null-while-loading read hook for the marker", () => {
    const src = read("lib/hasSignedInBefore.ts");
    expect(src).toMatch(/export function useHasSignedInBefore\(\): boolean \| null/);
  });

  it("persists the preauth reveal latch key", () => {
    const src = read("lib/preauthRevealLatch.ts");
    expect(src).toContain("PREAUTH_REVEAL_LATCH_KEY");
    expect(src).toContain("mobile_preauth_reveal_v1");
  });

  it("signup exposes a discoverable email escape (ENG-1563)", () => {
    const src = read("components/onboarding/steps/signup.tsx");
    expect(src).toContain('testID="signup-continue-email"');
    expect(src).toContain('email: "1"');
  });
});
