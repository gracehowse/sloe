/**
 * Settings — Sign Out colour — wave-2 (2026-04-30 audit-vs-competitors)
 * FIX 5.
 *
 * Sign Out is reversible: signing back in is a single tap. Red is
 * reserved for irreversible actions like Delete Account. The previous
 * row used `Accent.destructive` for both the label text and the
 * trailing icon; wave-2 swaps to neutral `colors.text` (default
 * rowLabel style) and `colors.textTertiary` for the icon — matching
 * every other row in the Account card.
 *
 * Structural source-level test (mounting Settings is heavy — see
 * `settingsSearch.test.ts` for the same pattern).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SETTINGS_PATH = resolve(__dirname, "../../app/(tabs)/settings.tsx");
const SRC = readFileSync(SETTINGS_PATH, "utf8");

describe("Settings — Sign Out colour (wave-2 FIX 5)", () => {
  it("renders the Sign Out label with the default rowLabel style (no destructive override)", () => {
    // Old:  <Text style={[styles.rowLabel, { color: Accent.destructive }]}>Sign Out</Text>
    // New:  <Text style={styles.rowLabel}>Sign Out</Text>
    expect(SRC).toMatch(/<Text style=\{styles\.rowLabel\}>Sign Out<\/Text>/);
    // Negative guard against the old destructive-coloured label.
    expect(SRC).not.toMatch(/Accent\.destructive[^}]*\}\]>Sign Out</);
  });

  it("renders the Sign Out trailing icon in textTertiary, not destructive", () => {
    // The LogOut icon's colour now matches the rest of the Account
    // card (Mail / Change Password row uses textTertiary too).
    expect(SRC).toMatch(/<LogOut\s+size=\{18\}\s+color=\{colors\.textTertiary\}/);
    // Negative guard.
    expect(SRC).not.toMatch(/<LogOut\s+size=\{18\}\s+color=\{Accent\.destructive\}/);
  });
});
