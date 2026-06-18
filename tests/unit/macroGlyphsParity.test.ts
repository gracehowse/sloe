/**
 * ENG-986 — shared macro-icon mapping SSOT.
 *
 * Pins web `Icons.*` and mobile `MacroIconRow` to the canonical lucide
 * glyph names in `src/lib/nutrition/macroGlyphs.ts` so protein cannot
 * drift back to Beef on web while mobile uses Dumbbell (Figma `654:101`).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Icons } from "../../src/app/components/ui/icons";
import { MACRO_GLYPH_KEYS, MACRO_ROW_GLYPH_ROLES } from "../../src/lib/nutrition/macroGlyphs";

const ROOT = resolve(__dirname, "../..");
const WEB_ICONS_SRC = readFileSync(resolve(ROOT, "src/app/components/ui/icons.ts"), "utf8");
const MOBILE_MACRO_ROW_SRC = readFileSync(
  resolve(ROOT, "apps/mobile/components/nutrition/MacroIconRow.tsx"),
  "utf8");

function componentName(Component: { name?: string; displayName?: string }): string {
  return Component.displayName ?? Component.name ?? "";
}

describe("MACRO_GLYPH_KEYS — canonical map", () => {
  it("uses Dumbbell for protein (Figma 654:101, not Beef)", () => {
    expect(MACRO_GLYPH_KEYS.protein).toBe("Dumbbell");
  });

  it("lists the standard macro-row roles", () => {
    expect(MACRO_ROW_GLYPH_ROLES).toEqual(["protein", "carbs", "fat", "fiber"]);
  });
});

describe("web Icons — macro glyphs match SSOT", () => {
  it("maps each macro role to the canonical lucide export", () => {
    for (const role of ["calories", "protein", "carbs", "fat", "fiber", "water"] as const) {
      const iconKey = role === "fiber" ? "fiber" : role;
      expect(componentName(Icons[iconKey as keyof typeof Icons] as { name?: string }), role).toBe(
        MACRO_GLYPH_KEYS[role],
      );
    }
  });

  it("does not register Beef as the protein glyph", () => {
    expect(WEB_ICONS_SRC).not.toMatch(/protein:\s*Beef/);
    expect(WEB_ICONS_SRC).toMatch(/protein:\s*Dumbbell/);
  });
});

describe("mobile MacroIconRow — macro glyphs match SSOT", () => {
  it("imports the shared macroGlyphs module", () => {
    expect(MOBILE_MACRO_ROW_SRC).toMatch(/@suppr\/shared\/nutrition\/macroGlyphs/);
  });

  for (const role of MACRO_ROW_GLYPH_ROLES) {
    it(`uses ${MACRO_GLYPH_KEYS[role]} for ${role}`, () => {
      expect(MOBILE_MACRO_ROW_SRC).toContain(MACRO_GLYPH_KEYS[role]);
    });
  }
});
