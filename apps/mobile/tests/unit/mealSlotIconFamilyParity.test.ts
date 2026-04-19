import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * F-12 parity pin (2026-04-19, in-session snack-parity report).
 *
 * Web's Snacks slot renders lucide-react `Cookie`
 * (`src/app/components/ui/icons.ts` → `snack: Cookie`). Mobile historically
 * used Ionicons `"cafe-outline"` (a coffee cup) which diverged from web.
 * F-12 aligned mobile onto MaterialCommunityIcons `cookie-outline`, which
 * is the closest cross-family match to web's lucide `Cookie`.
 *
 * A future PR could easily regress this in two ways:
 *   (a) drop MaterialCommunityIcons on mobile and revert Snacks to a
 *       coffee/cafe glyph (silent divergence from web).
 *   (b) change web's `snack: Cookie` mapping to something else without
 *       updating mobile (silent divergence in the other direction).
 *
 * The pins below fail loudly in either case.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");

function read(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

describe("meal-slot icon family parity (F-12)", () => {
  it("mobile Snacks slot uses MaterialCommunityIcons cookie-outline", () => {
    const src = read("apps/mobile/components/today/TodayMealsSection.tsx");
    // MaterialCommunityIcons must be imported from @expo/vector-icons.
    expect(src).toMatch(
      /import\s*\{[^}]*MaterialCommunityIcons[^}]*\}\s*from\s*["']@expo\/vector-icons["']/,
    );
    // The Snacks + Snack mappings must both declare the material-community
    // family with name "cookie-outline".
    expect(src).toMatch(
      /Snacks:\s*\{\s*family:\s*["']material-community["'],\s*name:\s*["']cookie-outline["']/,
    );
    expect(src).toMatch(
      /Snack:\s*\{\s*family:\s*["']material-community["'],\s*name:\s*["']cookie-outline["']/,
    );
    // No lingering "cafe-outline" on the Snacks slot (the regression glyph).
    expect(src).not.toMatch(/Snacks:\s*\{\s*family:\s*["']ionicons["'],\s*name:\s*["']cafe-outline["']/);
    expect(src).not.toMatch(/Snack:\s*\{\s*family:\s*["']ionicons["'],\s*name:\s*["']cafe-outline["']/);
  });

  it("mobile non-Snacks slots still use Ionicons", () => {
    const src = read("apps/mobile/components/today/TodayMealsSection.tsx");
    expect(src).toMatch(
      /Breakfast:\s*\{\s*family:\s*["']ionicons["'],\s*name:\s*["']cafe-outline["']/,
    );
    expect(src).toMatch(
      /Lunch:\s*\{\s*family:\s*["']ionicons["'],\s*name:\s*["']sunny-outline["']/,
    );
    expect(src).toMatch(
      /Dinner:\s*\{\s*family:\s*["']ionicons["'],\s*name:\s*["']restaurant-outline["']/,
    );
  });

  it("web Snacks slot still uses lucide Cookie", () => {
    const src = read("src/app/components/ui/icons.ts");
    // lucide-react must still import Cookie.
    expect(src).toMatch(/from\s*["']lucide-react["']/);
    expect(src).toMatch(/\bCookie\b/);
    // The icon-registry mapping snack -> Cookie must be intact.
    expect(src).toMatch(/snack:\s*Cookie\b/);
  });
});
