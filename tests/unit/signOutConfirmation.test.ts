import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ENG-1517 — Sign Out must confirm before ending the session on both
 * platforms. It sits directly below the destructive Delete-account control, so
 * an instant no-confirm sign-out is a hazardous mis-tap. Source-inspection pins
 * so a regression to a direct `signOut()` on press/click breaks a test.
 */
const ROOT = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

describe("ENG-1517 — Sign Out is confirmed, not instant (web + mobile parity)", () => {
  it("mobile Settings sign-out row routes through an Alert confirmation", () => {
    const src = read("apps/mobile/app/(tabs)/settings.tsx");
    // The sign-out Pressable confirms via Alert before calling signOut().
    expect(src).toMatch(
      /testID="settings-sign-out-row"[\s\S]{0,500}?Alert\.alert\(\s*\n?\s*"Sign out\?"/,
    );
  });

  it("web Sign Out confirms via DestructiveConfirmDialog", () => {
    // Extracted to SignOutButton (to hold Profile.tsx's screen budget); Profile
    // renders it in place of the old instant-signOut button.
    const btn = read("src/app/components/settings/SignOutButton.tsx");
    expect(btn).toContain("DestructiveConfirmDialog");
    expect(btn).toMatch(/onClick=\{\(\) => setConfirmOpen\(true\)\}/);
    expect(btn).toMatch(/title="Sign out\?"/);
    expect(read("src/app/components/Profile.tsx")).toMatch(/<SignOutButton\s*\/>/);
  });
});
