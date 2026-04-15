import { describe, expect, it } from "vitest";
import { parsePrepCookMinutesFromCaption } from "../../src/lib/recipe-import/extractSocialRecipe";

describe("parsePrepCookMinutesFromCaption", () => {
  it("parses prep and cook from common caption phrasing", () => {
    const t = "Easy dumplings! Prep: 15 min, cook 22 min. @chef";
    const r = parsePrepCookMinutesFromCaption(t);
    expect(r.prepTimeMin).toBe(15);
    expect(r.cookTimeMin).toBe(22);
  });

  it("parses prep time before the word prep", () => {
    const r = parsePrepCookMinutesFromCaption("20 min prep, 40 min cooking");
    expect(r.prepTimeMin).toBe(20);
    expect(r.cookTimeMin).toBe(40);
  });
});
