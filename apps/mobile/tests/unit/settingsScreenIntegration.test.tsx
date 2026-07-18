/**
 * Settings screen — structural integration pins (2026-05-01,
 * `claude/settings-mobile-structural-fix`).
 *
 * After the structural collapse, `/(tabs)/settings.tsx` has only one
 * job: render the search input, the canonical
 * `<SettingsBundleContent>` body, and a single neutral Sign Out row.
 * This test is a source-level structural check — mounting the full
 * screen is heavy because the bundle pulls in `useFocusEffect` /
 * `expo-router` / `useAuth` / RevenueCat / a HealthKit probe / six
 * modals. The pattern matches `settingsSearch.test.ts` and
 * `settingsBundleParity.test.ts`.
 *
 * Pins:
 *   - The legacy duplicate "Export nutrition log (CSV)" row in
 *     `/(tabs)/settings.tsx` is gone; only the bundle's row remains.
 *   - There are no Ionicons imports in the file or in
 *     `app/household-settings.tsx` (P0-4 lucide swap).
 *   - The search icon is the lucide `Search` glyph (P0-3).
 *   - The single neutral Sign Out row exists with `testID`
 *     `settings-sign-out-row` and lucide `LogOut` icon (P1-5).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const SETTINGS = readFileSync(resolve(ROOT, "app/settings.tsx"), "utf8");
const HOUSEHOLD = readFileSync(
  resolve(ROOT, "app/household-settings.tsx"),
  "utf8",
);
const BUNDLE = readFileSync(
  resolve(ROOT, "components/settings/SettingsBundleContent.tsx"),
  "utf8",
);

describe("/(tabs)/settings — structural integration", () => {
  it("renders Export nutrition log (CSV) once across the screen", () => {
    const settingsHits = (SETTINGS.match(/Export nutrition log \(CSV\)/g) ?? [])
      .length;
    const bundleHits = (BUNDLE.match(/Export nutrition log \(CSV\)/g) ?? [])
      .length;
    expect(settingsHits).toBe(0);
    expect(bundleHits).toBe(1);
  });

  it("does not import Ionicons anywhere on the Settings surface", () => {
    expect(SETTINGS).not.toMatch(/from\s+["']@expo\/vector-icons["']/);
    expect(SETTINGS).not.toMatch(/<Ionicons\b/);
    expect(HOUSEHOLD).not.toMatch(/from\s+["']@expo\/vector-icons["']/);
    expect(HOUSEHOLD).not.toMatch(/<Ionicons\b/);
  });

  it("uses the lucide Search icon in the search input row (P0-3)", () => {
    expect(SETTINGS).toMatch(/<Search\s+size=\{16\}/);
  });

  it("mounts the SettingsBundleContent canonical body", () => {
    expect(SETTINGS).toContain(
      'from "@/components/settings/SettingsBundleContent"',
    );
    expect(SETTINGS).toContain('<SettingsBundleContent context="settings"');
  });

  it("uses shared pushed-screen chrome with the standard overline", () => {
    expect(SETTINGS).toContain(
      'from "@/components/suppr/screen-section-chrome"',
    );
    expect(SETTINGS).toContain('<ScreenSectionChrome');
    expect(SETTINGS).toContain('overline={consistencyChrome ? "Your account" : null}');
    expect(SETTINGS).toContain('testID="settings-screen-chrome"');
  });

  it("renders a single neutral Sign Out row beneath the bundle (P1-5)", () => {
    expect(SETTINGS).toContain('testID="settings-sign-out-row"');
    const noComments = SETTINGS.replace(/\/\/[^\n]*\n/g, "\n").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    const visibleLabels = (noComments.match(/>\s*Sign Out\s*</g) ?? []).length;
    expect(visibleLabels).toBe(1);
  });

  it("does not render the legacy in-file sections (P0-1)", () => {
    const banishedSectionTitles = [
      "Your plan",
      "Appearance",
      "Account",
      "Body & activity",
      "Journal display",
      "Notifications",
      "Tracking extras",
      "About",
      "Data",
    ];
    for (const title of banishedSectionTitles) {
      expect(SETTINGS).not.toContain(
        `<Text style={styles.sectionTitle}>${title}</Text>`,
      );
    }
  });
});
