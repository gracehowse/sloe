/**
 * /household-settings — Ionicons → lucide swap (2026-05-01,
 * `claude/settings-mobile-structural-fix` P0-4).
 *
 * Pre-fix the file imported `@expo/vector-icons` and used Ionicons
 * for back / add / forward chevrons + the four meal-slot glyphs. The
 * rest of the mobile surface ships lucide-react-native, so the
 * Settings flow's icons looked alien from row to row. Mapping:
 *
 *   chevron-back       → ChevronLeft
 *   add                → Plus
 *   chevron-forward    → ChevronRight
 *   cafe-outline       → Coffee
 *   restaurant-outline → UtensilsCrossed
 *   moon-outline       → Moon
 *   nutrition-outline  → Cookie
 *   checkmark          → Check
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const HOUSEHOLD_PATH = resolve(
  __dirname,
  "../../app/household-settings.tsx",
);
const SRC = readFileSync(HOUSEHOLD_PATH, "utf8");

describe("/household-settings — lucide swap (P0-4)", () => {
  it("does not import @expo/vector-icons or render <Ionicons />", () => {
    expect(SRC).not.toMatch(/from\s+["']@expo\/vector-icons["']/);
    expect(SRC).not.toMatch(/<Ionicons\b/);
    expect(SRC).toContain('from "lucide-react-native"');
  });

  it("imports the 8 expected lucide glyphs", () => {
    const expected = [
      "Check",
      "ChevronLeft",
      "ChevronRight",
      "Coffee",
      "Cookie",
      "Moon",
      "Plus",
      "UtensilsCrossed",
    ];
    for (const name of expected) {
      expect(SRC).toMatch(new RegExp(`\\b${name}\\b`));
    }
  });

  it("uses Coffee / UtensilsCrossed / Moon / Cookie for the 4 meal slots", () => {
    expect(SRC).toMatch(/breakfast:\s*\{[^}]*icon:\s*Coffee/);
    expect(SRC).toMatch(/lunch:\s*\{[^}]*icon:\s*UtensilsCrossed/);
    expect(SRC).toMatch(/dinner:\s*\{[^}]*icon:\s*Moon/);
    expect(SRC).toMatch(/snack:\s*\{[^}]*icon:\s*Cookie/);
  });

  it("renders ChevronLeft / Plus / ChevronRight in the JSX (back / add / forward)", () => {
    expect(SRC).toMatch(/<ChevronLeft\b/);
    expect(SRC).toMatch(/<Plus\b/);
    expect(SRC).toMatch(/<ChevronRight\b/);
  });

  it("renders Check for the 'on' member-toggle state", () => {
    expect(SRC).toMatch(/<Check\b/);
  });
});
