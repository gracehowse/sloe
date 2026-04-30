/**
 * Group G IA Batches B + D — `SettingsBundleContent` is the single
 * render surface for the legacy "More" sections (Membership, Goals &
 * targets, Connections, Recipes, Household, Legal, Build, Danger
 * zone, Sign Out + 6 modals). Mounted on `/(tabs)/settings`.
 *
 * Batch D (2026-04-30): `/(tabs)/more` is now a redirect to
 * `/(tabs)/settings`; the bundle is no longer rendered there. This
 * test still pins:
 *   1. The bundle file exists and exports `SettingsBundleContent`.
 *   2. Every row that Apple Health / Daily targets / Delete account
 *      / Reset / Caffeine / Alcohol / Weekly recap depends on is
 *      present (testIDs pinned).
 *   3. `settings.tsx` imports the bundle.
 *   4. `more.tsx` is a thin <Redirect href="/(tabs)/settings" />.
 *   5. The 6 modals (reset, dashboard widgets, week start, caffeine,
 *      alcohol, weekly recap) are still rendered inside the bundle
 *      so they self-portal correctly.
 *
 * Source-level structural check — no React rendering.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const BUNDLE_PATH = resolve(
  ROOT,
  "components/settings/SettingsBundleContent.tsx",
);
const MORE_PATH = resolve(ROOT, "app/(tabs)/more.tsx");
const SETTINGS_PATH = resolve(ROOT, "app/(tabs)/settings.tsx");

const bundle = readFileSync(BUNDLE_PATH, "utf8");
const more = readFileSync(MORE_PATH, "utf8");
const settings = readFileSync(SETTINGS_PATH, "utf8");

describe("SettingsBundleContent — parity contract", () => {
  it("exports the SettingsBundleContent component", () => {
    expect(bundle).toMatch(/export\s+function\s+SettingsBundleContent/);
    expect(bundle).toMatch(/export\s+default\s+SettingsBundleContent/);
  });

  it("renders all load-bearing settings rows by testID", () => {
    const expectedTestIds = [
      "settings-bundle-upgrade-row",
      "settings-bundle-daily-targets-row",
      "settings-bundle-dashboard-widgets-row",
      "settings-bundle-week-start-row",
      "settings-bundle-caffeine-row",
      "settings-bundle-alcohol-row",
      "settings-bundle-apple-health-row",
      "settings-bundle-notifications-row",
      "settings-bundle-weekly-recap-row",
      "settings-bundle-create-recipe-row",
      "settings-bundle-export-csv-row",
      "settings-bundle-export-json-row",
      "settings-bundle-help-row",
      "settings-bundle-privacy-row",
      "settings-bundle-terms-row",
      "settings-bundle-reset-row",
      "settings-bundle-delete-account-row",
      "settings-bundle-sign-out",
    ];
    for (const id of expectedTestIds) {
      expect(bundle).toContain(`testID="${id}"`);
    }
  });

  it("renders the 6 modals (reset, widgets, week-start, caffeine, alcohol, weekly recap)", () => {
    expect(bundle).toContain("setResetModalOpen");
    expect(bundle).toContain("setWidgetPickerOpen");
    expect(bundle).toContain("setWeekStartPickerOpen");
    expect(bundle).toContain("setCaffeineTargetPickerOpen");
    expect(bundle).toContain("setAlcoholTargetPickerOpen");
    expect(bundle).toContain("setWeeklyRecapPushPickerOpen");
    // 6 <Modal> mounts, one per picker.
    const modalCount = (bundle.match(/<Modal\b/g) ?? []).length;
    expect(modalCount).toBe(6);
  });

  it("delete-account flow still posts to /api/account/delete with bearer token", () => {
    expect(bundle).toMatch(/fetch\(`\$\{base\}\/api\/account\/delete`/);
    expect(bundle).toContain('method: "DELETE"');
    expect(bundle).toMatch(/Authorization:\s*`Bearer/);
  });

  it("delete-account flow still requires typing 'delete' to confirm", () => {
    // Two-step deliberate confirm: Alert → Alert.prompt → typed 'delete'.
    expect(bundle).toMatch(/Alert\.prompt\?\.\(/);
    expect(bundle).toContain('!== "delete"');
  });

  it("reset modal still surfaces both reset-plan and erase-data paths", () => {
    expect(bundle).toContain("Reset Plan (Keep My Data)");
    expect(bundle).toContain("Erase all app data");
    expect(bundle).toContain("nukeAllUserAppData");
    expect(bundle).toContain("clearStructuredMealPlans");
  });

  it("/settings imports and mounts the bundle", () => {
    expect(settings).toContain(
      'from "@/components/settings/SettingsBundleContent"',
    );
    expect(settings).toContain('<SettingsBundleContent context="settings"');
  });

  it("/more is a thin redirect to /(tabs)/settings (Batch D)", () => {
    // Batch D collapsed the More wrapper into a redirect so push
    // notifications, bookmarks, and any external system that still
    // deep-links to suppr:///more continues to resolve. Batch E
    // deletes the file after one release of grace period.
    expect(more).toContain('from "expo-router"');
    expect(more).toMatch(/<Redirect\s+href="\/\(tabs\)\/settings"\s*\/>/);
    // No bundle render on /more anymore — the screen MUST be a pure
    // redirect with zero state, fetches, or duplicate UI. (The doc
    // comment may still reference the bundle component path; we match
    // on the JSX usage <SettingsBundleContent ... /> which is the
    // load-bearing signal.)
    expect(more).not.toMatch(/<SettingsBundleContent\b/);
    expect(more).not.toContain("supabase");
    expect(more).not.toContain("ScrollView");
  });

  it("self-routing 'Settings' row in the bundle is gated for the legacy More context", () => {
    // The bundle still carries a context-gated Palette icon row that
    // would have routed to /(tabs)/settings when rendered on /more.
    // Post-Batch D the bundle never renders with context="more", but
    // the gate stays in place to keep the bundle revertible (Batch D
    // is the only batch that flipped /more → redirect).
    expect(bundle).toMatch(/context === "more" \?[\s\S]*?Palette/);
  });
});
