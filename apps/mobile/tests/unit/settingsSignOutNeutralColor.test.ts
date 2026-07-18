/**
 * Settings — Sign Out colour — wave-2 (2026-04-30 audit-vs-competitors)
 * FIX 5, re-anchored to the single neutral row 2026-05-01
 * (`claude/settings-mobile-structural-fix` P1-5).
 *
 * Sign Out is reversible: signing back in is a single tap. Red is
 * reserved for irreversible actions like Delete Account. After the
 * structural collapse the legacy in-file Account section is gone —
 * the single Sign Out row now lives beneath `<SettingsBundleContent>`
 * in `/(tabs)/settings.tsx` with neutral colours
 * (`colors.text` label + `colors.textTertiary` icon).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SETTINGS_PATH = resolve(__dirname, "../../app/settings.tsx");
const BUNDLE_PATH = resolve(
  __dirname,
  "../../components/settings/SettingsBundleContent.tsx",
);
const SETTINGS = readFileSync(SETTINGS_PATH, "utf8");
const BUNDLE = readFileSync(BUNDLE_PATH, "utf8");

describe("Settings — Sign Out colour (wave-2 FIX 5 / P1-5)", () => {
  it("renders the single neutral Sign Out row in /(tabs)/settings.tsx", () => {
    expect(SETTINGS).toMatch(
      /<Text\s+style=\{\{[^}]*color:\s*colors\.text[^}]*\}\}\s*>\s*Sign Out\s*</,
    );
    expect(SETTINGS).toMatch(
      /<LogOut\s+size=\{18\}\s+color=\{colors\.textTertiary\}/,
    );
    expect(SETTINGS).toContain('testID="settings-sign-out-row"');
  });

  it("does not colour the Sign Out row in destructive red", () => {
    expect(SETTINGS).not.toMatch(/Accent\.destructive[^}]*\}\]?>Sign Out</);
    expect(SETTINGS).not.toMatch(
      /<LogOut\s+size=\{18\}\s+color=\{Accent\.destructive\}/,
    );
  });

  it("the bundle no longer renders its own destructive-bordered Sign Out", () => {
    expect(BUNDLE).not.toContain('testID="settings-bundle-sign-out"');
    expect(BUNDLE).not.toMatch(
      /borderColor:\s*t\.red\s*\+\s*"40"[\s\S]{0,200}Sign Out/,
    );
  });
});
