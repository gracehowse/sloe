/**
 * ENG-1139 / ENG-1016 — web Discover recipe cards route primary taps through
 * PressableScale (mobile parity: discoverPressableScale.test.ts).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  resolve(__dirname, "../../src/app/components/DiscoverFeed.tsx"),
  "utf8",
);

describe("DiscoverFeed (web) — PressableScale on recipe cards (ENG-1139)", () => {
  it("imports PressableScale and uses confirm haptic on recipe card opens", () => {
    expect(SRC).toMatch(/import \{ PressableScale \} from "\.\/ui\/pressable-scale"/);
    expect(SRC).toMatch(
      /PressableScale[\s\S]{0,120}haptic="confirm"[\s\S]{0,160}setSelectedRecipe\(recipe\)/,
    );
  });

  it("does not leave raw <button> wrappers on the three mobile-web recipe card paths", () => {
    // Category pills + reset filters still use plain buttons — only recipe
    // openers should be PressableScale.
    const recipeHeroBlock = SRC.match(
      /Recipe ideas[\s\S]{0,2500}?More ideas/,
    )?.[0];
    expect(recipeHeroBlock).toBeTruthy();
    expect(recipeHeroBlock).toMatch(/PressableScale/);
    expect(recipeHeroBlock).not.toMatch(/<button[\s\S]{0,200}setSelectedRecipe/);
  });
});
