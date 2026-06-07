/**
 * Login must not block signed-in users on a profiles fetch. Onboarding
 * routing lives in `(tabs)/_layout.tsx`; login only forwards to tabs.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const LOGIN_FILE = join(__dirname, "..", "..", "app", "login.tsx");

describe("login auth redirect", () => {
  it("redirects signed-in users straight to tabs (no Signing you in gate)", () => {
    const src = readFileSync(LOGIN_FILE, "utf8");
    expect(src).toMatch(/session\?\.user\?\.id/);
    expect(src).toMatch(/Redirect\s+href=["']\/\(tabs\)["']/);
    expect(src).not.toMatch(/AppLaunchScreen/);
    expect(src).not.toContain("onboardingChecked");
  });
});
