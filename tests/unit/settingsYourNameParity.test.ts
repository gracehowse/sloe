/**
 * settingsYourNameParity — pins the "Your name" Settings field as a
 * matched pair across web + mobile.
 *
 * The field lets a user set the display name the Today greeting
 * personalises from ("Morning, Grace"). It writes the auth user's
 * `user_metadata.full_name` via the shared `saveDisplayName` helper
 * (`src/lib/account/displayName.ts`) — NOT a `profiles` column. Both
 * platforms must:
 *   1. render an editable name field (not the read-only Display Name),
 *   2. persist through the shared `saveDisplayName` helper,
 *   3. refresh the session after a successful save so the greeting
 *      updates without a restart,
 *   4. NOT write the name into a `profiles` column (tier-lockdown
 *      trigger + the greeting reads metadata anyway).
 *
 * Source-level structural check — no React rendering. Mirrors the
 * existing cross-platform parity tests (e.g. `todayCopyParity.test.ts`,
 * `logSheetWebMobileParity.test.ts`).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = process.cwd();
const WEB = readFileSync(
  resolve(REPO, "src/app/components/Settings.tsx"),
  "utf8",
);
const MOBILE = readFileSync(
  resolve(REPO, "apps/mobile/components/settings/SettingsBundleContent.tsx"),
  "utf8",
);
const HELPER = readFileSync(
  resolve(REPO, "src/lib/account/displayName.ts"),
  "utf8",
);

describe("Your name field — web/mobile parity", () => {
  it("both platforms render an editable 'Your name' field", () => {
    // Web: labelled input + save button.
    expect(WEB).toContain('data-testid="settings-name-input"');
    expect(WEB).toContain('data-testid="settings-name-save"');
    expect(WEB).toMatch(/>\s*Your name\s*</);
    // Mobile: TextInput + Save control.
    expect(MOBILE).toContain('testID="settings-bundle-name-input"');
    expect(MOBILE).toContain('testID="settings-bundle-name-save"');
    // The name field carries a "Your name" label inside the Personal
    // card (the heading is "Personal" — see the parity test below).
    expect(MOBILE).toMatch(/>\s*Your name\s*</);
  });

  it("the name field lives inside a 'Personal' settings group on both platforms", () => {
    // 2026-06-04 (Grace): the name field was relocated from a lone
    // "Your name" card into a general "Personal" settings group so it
    // sits among the user's personal preferences (identity-first, top of
    // the list). Web nests it as the first row of the "Personal" card
    // (previously "Account"); mobile renders a "Personal" section heading
    // above the name card. Both group names must match (sync-enforcer).
    expect(WEB).toMatch(/<h3[^>]*>\s*Personal\s*<\/h3>/);
    expect(MOBILE).toContain('title="Personal"');
    // The name card / first row is the SettingsCard tagged
    // `settings-card-name` on mobile and the labelled input on web.
    expect(MOBILE).toContain('testID="settings-card-name"');
    expect(WEB).toContain('data-testid="settings-name-input"');
  });

  it("both platforms persist through the shared saveDisplayName helper", () => {
    expect(WEB).toContain("saveDisplayName");
    expect(MOBILE).toContain("saveDisplayName");
    // Neither screen should call auth.updateUser inline for the name —
    // the shared helper owns that single write path.
    expect(HELPER).toMatch(/auth\.updateUser/);
    expect(HELPER).toMatch(/full_name:\s*trimmed/);
  });

  it("the helper writes ONLY user_metadata.full_name (no profiles column)", () => {
    // The payload to updateUser is exactly `{ full_name }` — nothing
    // that would touch a profiles/entitlement column.
    expect(HELPER).toMatch(/data:\s*\{\s*full_name:\s*trimmed\s*\}/);
    // The name field never writes a profiles row.
    expect(WEB).not.toMatch(/full_name[\s\S]{0,80}\.from\("profiles"\)/);
    expect(MOBILE).not.toMatch(/full_name[\s\S]{0,80}\.from\("profiles"\)/);
  });

  it("both platforms refresh the session after a successful save", () => {
    // getSession() re-emits the updated metadata to the greeting.
    expect(WEB).toMatch(/result\.changed[\s\S]{0,200}getSession\(\)/);
    expect(MOBILE).toMatch(/result\.changed[\s\S]{0,200}getSession\(\)/);
  });

  it("the field is wired to commit on blur on both platforms", () => {
    expect(WEB).toMatch(/onBlur=\{\(\)\s*=>\s*void handleSaveName\(\)\}/);
    expect(MOBILE).toMatch(/onBlur=\{[\s\S]{0,60}handleSaveName\(\)/);
  });
});
