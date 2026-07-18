/**
 * Settings search — wave-2 (2026-04-30 audit-vs-competitors) FIX 6,
 * collapsed to single-shell on 2026-05-01
 * (`claude/settings-mobile-structural-fix`).
 *
 * After the structural collapse, `/(tabs)/settings.tsx` only renders
 * the search input + the canonical `<SettingsBundleContent>` body +
 * a single neutral Sign Out row. The legacy in-file sections (Plan /
 * Appearance / Account / Body & activity / Journal display /
 * Notifications / Tracking extras / About / Data) were duplicates of
 * the bundle and were deleted; tracking extras + Manage subscription
 * + promo-code redemption were absorbed into the bundle.
 *
 * The search now follows a simpler contract:
 *
 *   1. The search input is rendered (testID `settings-search-input`).
 *   2. When the query is non-empty the bundle is hidden — keeps the
 *      filter result honest until in-bundle search ships.
 *   3. When the query is empty the bundle renders + the single Sign
 *      Out row beneath it.
 *   4. The empty-state Text is rendered with
 *      `testID="settings-search-empty"` for a non-empty query.
 *   5. The search input clears via the "Clear" button.
 *   6. The search icon is the lucide `Search` glyph (P0-3).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SETTINGS_PATH = resolve(__dirname, "../../app/settings.tsx");
const SRC = readFileSync(SETTINGS_PATH, "utf8");

describe("Settings search (wave-2 FIX 6)", () => {
  it("renders a TextInput with testID 'settings-search-input'", () => {
    expect(SRC).toContain('testID="settings-search-input"');
  });

  it("declares searchQuery + setSearchQuery state via useState", () => {
    expect(SRC).toMatch(
      /const\s+\[searchQuery,\s*setSearchQuery\]\s*=\s*useState\(""\)/,
    );
  });

  it("uses the lucide Search icon — not the emoji magnifying glass (P0-3)", () => {
    expect(SRC).toMatch(/<Search\s+size=\{16\}/);
    expect(SRC).toContain('from "lucide-react-native"');
  });

  it("hides the SettingsBundleContent when the search query is non-empty", () => {
    // Either pattern is acceptable: a `trimmedQuery === ""` ternary
    // or a `searchQuery.trim() === ""` ternary. Both gate the bundle
    // render against an empty query.
    expect(SRC).toMatch(
      /(trimmedQuery|searchQuery\.trim\(\))\s*===\s*""[\s\S]{0,200}?<SettingsBundleContent/,
    );
  });

  it("renders the empty-state copy with testID='settings-search-empty'", () => {
    expect(SRC).toContain('testID="settings-search-empty"');
    expect(SRC).toMatch(/No matches for/);
  });

  it("renders a Clear button when the query is non-empty", () => {
    expect(SRC).toContain('accessibilityLabel="Clear search"');
  });

  it("mounts a single neutral Sign Out row beneath the bundle (P1-5)", () => {
    expect(SRC).toContain('testID="settings-sign-out-row"');
    expect(SRC).toMatch(/<LogOut\s+size=\{18\}\s+color=\{colors\.textTertiary\}/);
    expect(SRC).not.toMatch(/Accent\.destructive[^}]*\}\]?>Sign Out</);
    expect(SRC).toMatch(/supabase\.auth\.signOut\(\)/);
  });

  it("no longer renders the legacy in-file sections (P0-1)", () => {
    expect(SRC).not.toContain("<Text style={styles.sectionTitle}>Your plan</Text>");
    expect(SRC).not.toContain("<Text style={styles.sectionTitle}>Appearance</Text>");
    expect(SRC).not.toContain("<Text style={styles.sectionTitle}>Account</Text>");
    expect(SRC).not.toContain(
      "<Text style={styles.sectionTitle}>Body & activity</Text>",
    );
    expect(SRC).not.toContain(
      "<Text style={styles.sectionTitle}>Journal display</Text>",
    );
    expect(SRC).not.toContain(
      "<Text style={styles.sectionTitle}>Notifications</Text>",
    );
    expect(SRC).not.toContain(
      "<Text style={styles.sectionTitle}>Tracking extras</Text>",
    );
    expect(SRC).not.toContain("<Text style={styles.sectionTitle}>About</Text>");
    expect(SRC).not.toContain("<Text style={styles.sectionTitle}>Data</Text>");
  });

  it("does not render export rows in this file — the bundle owns export (P0-1, P0-2)", () => {
    expect(SRC).not.toContain("Export nutrition log (CSV)");
    expect(SRC).not.toContain("Export all data (JSON)");
    expect(SRC).not.toMatch(/Share\.share\(\s*\{\s*message:/);
  });
});
