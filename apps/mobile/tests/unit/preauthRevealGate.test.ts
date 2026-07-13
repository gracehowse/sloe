import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ENG-1513 — fresh installs run the onboarding questionnaire + plan reveal
 * BEFORE the auth wall (match web / ENG-962), behind the default-OFF flag
 * `mobile_preauth_reveal_v1`. A returning (signed-out) device still lands on
 * /login. Source-inspection pins the gate wiring so a regression to the
 * unconditional auth-first redirect breaks a test.
 */
const MOBILE = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(MOBILE, p), "utf8");

describe("ENG-1513 — pre-auth reveal gate", () => {
  it("registers the flag as default-OFF", () => {
    expect(read("lib/analytics.ts")).toContain('"mobile_preauth_reveal_v1"');
  });

  it("(tabs) gate routes a fresh install to /onboarding when the flag is on, else /login", () => {
    const src = read("app/(tabs)/_layout.tsx");
    expect(src).toContain("isFeatureEnabled('mobile_preauth_reveal_v1')");
    expect(src).toContain("useHasSignedInBefore");
    // flag-on + fresh install (marker false) → onboarding reveal
    expect(src).toMatch(/if \(!signedInBefore\)\s*\{\s*return <Redirect href="\/onboarding"/);
    // the !session branch still falls through to /login (returning user / flag OFF)
    const sessionBranch = src.slice(src.indexOf("if (!session)"));
    expect(sessionBranch).toContain('href="/login"');
  });

  it("waits on the marker read before redirecting (no login↔onboarding flash)", () => {
    const src = read("app/(tabs)/_layout.tsx");
    expect(src).toMatch(/signedInBefore === null[\s\S]{0,120}AppLaunchScreen/);
  });

  it("exposes a null-while-loading read hook for the marker", () => {
    const src = read("lib/hasSignedInBefore.ts");
    expect(src).toMatch(/export function useHasSignedInBefore\(\): boolean \| null/);
  });
});
