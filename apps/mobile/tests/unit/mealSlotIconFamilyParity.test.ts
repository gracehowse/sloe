import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * F-12 → spec §1.5 update (2026-04-27).
 *
 * History
 * -------
 * Original F-12 (2026-04-19) pinned Snacks to MaterialCommunityIcons
 * `cookie-outline` because Ionicons had no cookie glyph and that was
 * the closest match to web's lucide-react `Cookie`.
 *
 * Spec §1.5 (2026-04-27) — production design spec — moves the entire
 * mobile glyph set onto `lucide-react-native` for cross-platform
 * parity with web. Slot icons are now:
 *   - Coffee  (Breakfast)
 *   - Sun     (Lunch)
 *   - UtensilsCrossed (Dinner)
 *   - Cookie  (Snack / Snacks)
 *
 * This test pins both platforms to the lucide names so silent drift
 * fails CI in either direction.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");

function read(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

describe("meal-slot icon parity (F-12 → spec §1.5)", () => {
  it("mobile slot icons use lucide-react-native glyphs from the §1.5 mapping", () => {
    const src = read("apps/mobile/components/today/TodayMealsSection.tsx");
    // The single import must come from lucide-react-native and include
    // the four canonical slot glyphs.
    expect(src).toMatch(/from\s*["']lucide-react-native["']/);
    expect(src).toMatch(/\bCoffee\b/);
    expect(src).toMatch(/\bSun\b/);
    expect(src).toMatch(/\bUtensilsCrossed\b/);
    expect(src).toMatch(/\bCookie\b/);
    // The SLOT_ICON record must wire the four slots to the lucide
    // components exactly as the spec table requires.
    expect(src).toMatch(/Breakfast:\s*Coffee\b/);
    expect(src).toMatch(/Lunch:\s*Sun\b/);
    expect(src).toMatch(/Dinner:\s*UtensilsCrossed\b/);
    expect(src).toMatch(/Snacks:\s*Cookie\b/);
    expect(src).toMatch(/Snack:\s*Cookie\b/);
  });

  it("mobile no longer imports Ionicons / MaterialCommunityIcons in this surface", () => {
    const src = read("apps/mobile/components/today/TodayMealsSection.tsx");
    // Strip block comments so the prose history doesn't trip pure-name
    // greps; the regex below only fails on real code references.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toMatch(/@expo\/vector-icons/);
    expect(code).not.toMatch(/\bIonicons\b/);
    expect(code).not.toMatch(/\bMaterialCommunityIcons\b/);
    // The previous F-12 cross-family workaround glyph is also gone.
    expect(code).not.toMatch(/cookie-outline/);
  });

  it("web Snacks slot still uses lucide-react Cookie (cross-platform parity)", () => {
    const src = read("src/app/components/ui/icons.ts");
    // lucide-react must still import Cookie.
    expect(src).toMatch(/from\s*["']lucide-react["']/);
    expect(src).toMatch(/\bCookie\b/);
    // The icon-registry mapping snack -> Cookie must be intact.
    expect(src).toMatch(/snack:\s*Cookie\b/);
  });
});
