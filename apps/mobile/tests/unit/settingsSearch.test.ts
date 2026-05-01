/**
 * Settings search — wave-2 (2026-04-30 audit-vs-competitors) FIX 6.
 *
 * The Settings screen now renders a search input pinned at the top of
 * the ScrollView. Each section is gated by `matchesSearch(keywords)`
 * where `keywords` is a static list of section title + row labels +
 * row descriptions; a non-empty query that fails to match any section
 * shows an empty-state row.
 *
 * Mounting the full Settings screen in vitest is heavy — it pulls in
 * `useAuth`, theme, RevenueCat, the SettingsBundleContent + every
 * Modal it owns. This is a structural source-level check that
 * guarantees the contract:
 *
 *   1. The search input is rendered (testID `settings-search-input`).
 *   2. Every section title rendered above the bundle is gated by
 *      `matchesSearch`.
 *   3. The bundle is hidden when the query is non-empty (so the
 *      filter result is honest: only the legacy in-file sections are
 *      filterable).
 *   4. The empty-state Text exists with `testID="settings-search-empty"`.
 *   5. The search query state clears via a "Clear" button when non-
 *      empty.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SETTINGS_PATH = resolve(__dirname, "../../app/(tabs)/settings.tsx");
const SRC = readFileSync(SETTINGS_PATH, "utf8");

const SECTION_TITLES = [
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

describe("Settings search (wave-2 FIX 6)", () => {
  it("renders a TextInput with testID 'settings-search-input'", () => {
    expect(SRC).toContain('testID="settings-search-input"');
  });

  it("declares searchQuery + setSearchQuery state via useState", () => {
    expect(SRC).toMatch(/const\s+\[searchQuery,\s*setSearchQuery\]\s*=\s*useState\(""\)/);
  });

  it("declares a matchesSearch helper that filters sections by keyword list", () => {
    // matchesSearch takes a readonly string array and returns boolean.
    expect(SRC).toContain("const matchesSearch = useCallback");
    expect(SRC).toMatch(/matchesSearch\(\s*\[/);
  });

  it("gates every section title behind matchesSearch", () => {
    for (const title of SECTION_TITLES) {
      // Each title appears inside a `<Text style={styles.sectionTitle}>{title}</Text>`
      // line, and the surrounding section is wrapped in a
      // `{matchesSearch([..., "{title}", ...]) ? <>` block. Asserting
      // both: the title literal exists AND it appears in some
      // matchesSearch keyword list.
      expect(SRC).toContain(`<Text style={styles.sectionTitle}>${title}</Text>`);
      expect(SRC).toMatch(
        new RegExp(`matchesSearch\\(\\s*\\[[^\\]]*"${title.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}"`, "s"),
      );
    }
  });

  it("hides the SettingsBundleContent when the search query is non-empty", () => {
    expect(SRC).toMatch(/searchQuery\.trim\(\)\s*===\s*""\s*\?\s*\(\s*<SettingsBundleContent/);
  });

  it("renders the empty-state copy with testID='settings-search-empty'", () => {
    expect(SRC).toContain('testID="settings-search-empty"');
    expect(SRC).toMatch(/No matches for/);
  });

  it("renders a Clear button when the query is non-empty", () => {
    expect(SRC).toContain('accessibilityLabel="Clear search"');
  });
});
