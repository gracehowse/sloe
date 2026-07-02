/**
 * Flat-card surfaces (2026-06-12, docs/decisions/2026-06-12-flat-card-surfaces.md)
 * — parity pin (source-level, labelled as a pin): the "What to eat next"
 * north-star HERO is a resting card and must stay FLAT on BOTH platforms.
 * Added per the flat-card wave review (M1: web hero kept its lift after the
 * mobile twin was flattened — this pin makes that drift impossible).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

describe("north-star hero — flat on both platforms (flat-card surfaces)", () => {
  it("web hero button carries no shadow utility", () => {
    const src = readFileSync(
      resolve(ROOT, "src/app/components/suppr/north-star-figma-hero.tsx"),
      "utf8",
    );
    const heroIdx = src.indexOf("h-80 rounded-2xl");
    expect(heroIdx).toBeGreaterThan(-1);
    expect(src.slice(heroIdx - 400, heroIdx + 400)).not.toMatch(/shadow-\[|shadow-lg|shadow-md/);
  });

  it("mobile figmaHeroCard carries no shadow/elevation literals", () => {
    const src = readFileSync(
      resolve(ROOT, "apps/mobile/components/today/NorthStarFigmaHero.tsx"),
      "utf8",
    );
    const idx = src.indexOf("figmaHeroCard");
    expect(idx).toBeGreaterThan(-1);
    expect(src.slice(idx, idx + 600)).not.toMatch(/shadowOpacity|shadowRadius|Elevation\.|elevation:/);
  });
});
