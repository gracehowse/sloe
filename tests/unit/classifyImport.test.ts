/**
 * classifyImport (ENG-1225 #3) — the shared "detect-anything" classifier for the
 * unified Import sheet. Pins each kind's detection + the conservative fallback so
 * the one entry point routes a pasted blob to the right existing flow.
 */
import { describe, expect, it } from "vitest";
import { classifyImport } from "../../src/lib/recipe-import/classifyImport";

describe("classifyImport", () => {
  it("empty / whitespace → empty", () => {
    expect(classifyImport("").kind).toBe("empty");
    expect(classifyImport("   \n  ").kind).toBe("empty");
  });

  it("social URLs → social, with platform + label", () => {
    const ig = classifyImport("check this https://www.instagram.com/reel/Cabc123/");
    expect(ig.kind).toBe("social");
    expect(ig.platform).toBe("instagram");
    expect(ig.label).toBe("Instagram reel");
    expect(ig.url).toBe("https://www.instagram.com/reel/Cabc123/");

    expect(classifyImport("https://vm.tiktok.com/ZMabc/").platform).toBe("tiktok");
    expect(classifyImport("https://youtu.be/abc123").label).toBe("YouTube video");
  });

  it("saved IG/TikTok collection URLs → collection, not social", () => {
    const igSaved = classifyImport("https://www.instagram.com/chef/saved/recipes/1234567890/");
    expect(igSaved.kind).toBe("collection");
    expect(igSaved.platform).toBe("instagram");
    expect(igSaved.label).toBe("Instagram saved collection");

    const igAll = classifyImport("instagram.com/me/saved/all-posts/");
    expect(igAll.kind).toBe("collection");
    expect(igAll.platform).toBe("instagram");

    const tt = classifyImport("https://www.tiktok.com/@chef/collection/dinner-7297251424885377835");
    expect(tt.kind).toBe("collection");
    expect(tt.platform).toBe("tiktok");
    expect(tt.label).toBe("TikTok collection");

    const ttRoot = classifyImport("https://www.tiktok.com/collection/7297251424885377835");
    expect(ttRoot.kind).toBe("collection");
    expect(ttRoot.platform).toBe("tiktok");
  });

  it("strips trailing punctuation off the URL", () => {
    expect(classifyImport("see (https://tiktok.com/@x/video/1).").url).toBe(
      "https://tiktok.com/@x/video/1",
    );
  });

  it("detects scheme-less shared/pasted URLs (https:// often dropped)", () => {
    // The common share-sheet case — no scheme.
    expect(classifyImport("tiktok.com/@a/video/9").kind).toBe("social");
    expect(classifyImport("tiktok.com/@a/video/9").platform).toBe("tiktok");
    expect(classifyImport("www.instagram.com/reel/Cabc/").platform).toBe("instagram");
    expect(classifyImport("bbcgoodfood.com/recipes/lasagne").kind).toBe("recipe-url");
  });

  it("does NOT treat a bare domain in prose (no path) as a URL", () => {
    expect(classifyImport("My favourite is the one from tiktok obviously").kind).not.toBe("social");
    expect(classifyImport("Recipe text without any link").kind).toBe("recipe-text");
  });

  it("a non-social URL → recipe-url", () => {
    const r = classifyImport("https://www.bbcgoodfood.com/recipes/lasagne");
    expect(r.kind).toBe("recipe-url");
    expect(r.label).toBe("Recipe link");
    expect(r.platform).toBeNull();
  });

  it("a MyFitnessPal-style CSV → csv", () => {
    const csv = [
      "Date,Meal,Food,Calories,Protein (g),Carbs (g),Fat (g)",
      "2026-06-20,Breakfast,Oats,320,12,54,6",
      "2026-06-20,Lunch,Chicken salad,440,38,20,18",
    ].join("\n");
    expect(classifyImport(csv).kind).toBe("csv");
    expect(classifyImport(csv).label).toBe("Nutrition export (CSV)");
  });

  it("does NOT mistake prose-with-commas for a CSV", () => {
    expect(
      classifyImport("Mix the flour, sugar, and butter, then bake.").kind,
    ).not.toBe("csv");
  });

  it("a pasted multi-day meal plan → plan-text", () => {
    const plan = [
      "Monday",
      "Breakfast: eggs and toast",
      "Lunch: chicken salad",
      "Tuesday",
      "Breakfast: oats",
      "Dinner: salmon and rice",
    ].join("\n");
    expect(classifyImport(plan).kind).toBe("plan-text");
    expect(classifyImport(plan).label).toBe("Meal plan");
  });

  it("freeform recipe text → recipe-text (the safe fallback)", () => {
    const recipe = [
      "Tahini bowl",
      "2 tbsp tahini",
      "1 can chickpeas",
      "Roast the chickpeas, whisk the tahini, combine.",
    ].join("\n");
    expect(classifyImport(recipe).kind).toBe("recipe-text");
  });

  it("a single line of plain text → recipe-text, not plan/csv", () => {
    expect(classifyImport("Grandma's banana bread").kind).toBe("recipe-text");
  });
});
