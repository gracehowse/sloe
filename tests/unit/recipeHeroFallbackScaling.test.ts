import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ENG-1552 — the photo-less hero fallback glyph must scale with its container
 * (it read as a lost dot / broken image at hero widths). Pins the responsive
 * sizing on both platforms so a regression to a fixed px glyph breaks a test.
 */
const ROOT = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

describe("ENG-1552 — hero fallback glyph scales with the container (web + mobile)", () => {
  it("web fallback uses a container-query-scaled glyph, not a fixed px size", () => {
    const src = read("src/app/components/suppr/RecipeHeroFallback.tsx");
    expect(src).toContain('containerType: "size"');
    expect(src).toContain("clamp(${iconSize}px, 30cqmin, 112px)");
    // The glyph no longer renders at a bare fixed width={iconSize}.
    expect(src).not.toMatch(/<Glyph\s+width=\{iconSize\}/);
  });

  it("mobile fallback measures the slab and scales the glyph from its smaller side", () => {
    const src = read("apps/mobile/components/RecipeHeroFallback.tsx");
    expect(src).toContain("onLayout=");
    expect(src).toContain("Math.max(iconSize, Math.min(112, 0.3 * Math.min(box.w, box.h)))");
    expect(src).toMatch(/<Glyph size=\{glyphSize\}/);
  });
});
