/**
 * ENG-979 — creator credit on the shared recipe card.
 *
 * Locks the behaviour of the "Reel → clean card" share helpers that
 * ship live in web `RecipeDetail.tsx`, mobile `recipe/[id].tsx`, and
 * mobile `import-shared.tsx`:
 *   - `formatRecipeCreatorCredit`  — author → source_name fallback,
 *     routed through `displayAttribution` (internal-seed filtering +
 *     "Suppr Kitchen" → "Sloe Kitchen" brand remap).
 *   - `formatRecipeShareMacroLine` — kcal/protein rounding + the
 *     ", estimated" suffix gate.
 *   - `creatorProfileUrl`          — `/creator/:id` gating on a present
 *     `creatorId`.
 *   - `buildRecipeShareCardMessage`— full message assembly, including
 *     the profile-URL line that only appears when BOTH a `creatorId`
 *     and a real credit exist.
 *
 * The feature was shipped under ENG-978/ENG-979 (commit `a77a34eb`);
 * this strengthens the original smoke test into branch-complete
 * coverage of the suffix gate, the profile-URL gating, the brand
 * remap, and the calorie guards.
 */
import { describe, expect, it } from "vitest";

import {
  buildRecipeShareCardMessage,
  creatorProfileUrl,
  formatRecipeCreatorCredit,
  formatRecipeShareMacroLine,
} from "@/lib/share/buildRecipeShareCard";

const ORIGIN = "https://app.suppr.com";

describe("formatRecipeCreatorCredit", () => {
  it("prefers the author display name over the source name", () => {
    expect(
      formatRecipeCreatorCredit({
        authorDisplayName: "Jamie Cooks",
        sourceName: "instagram.com",
      }),
    ).toBe("Recipe by Jamie Cooks");
  });

  it("falls back to the source name when there is no author", () => {
    expect(
      formatRecipeCreatorCredit({
        authorDisplayName: null,
        sourceName: "Bon Appétit",
      }),
    ).toBe("Recipe by Bon Appétit");
  });

  it("falls back to source when the author is blank whitespace", () => {
    expect(
      formatRecipeCreatorCredit({
        authorDisplayName: "   ",
        sourceName: "NYT Cooking",
      }),
    ).toBe("Recipe by NYT Cooking");
  });

  it("returns an empty string when neither author nor source is present", () => {
    expect(formatRecipeCreatorCredit({})).toBe("");
    expect(
      formatRecipeCreatorCredit({ authorDisplayName: null, sourceName: null }),
    ).toBe("");
  });

  it("suppresses internal seed-source strings (no developer attribution)", () => {
    expect(formatRecipeCreatorCredit({ sourceName: "Suppr onboarding" })).toBe(
      "",
    );
    expect(formatRecipeCreatorCredit({ authorDisplayName: "system" })).toBe("");
  });

  it("remaps the legal 'Suppr Kitchen' byline to the live 'Sloe Kitchen' brand", () => {
    expect(
      formatRecipeCreatorCredit({ authorDisplayName: "Suppr Kitchen" }),
    ).toBe("Recipe by Sloe Kitchen");
  });
});

describe("formatRecipeShareMacroLine", () => {
  it("formats kcal alone when there is no protein", () => {
    expect(formatRecipeShareMacroLine({ calories: 540 })).toBe(
      "~540 kcal, estimated",
    );
  });

  it("appends a protein clause when protein is present", () => {
    expect(formatRecipeShareMacroLine({ calories: 540, protein: 32 })).toBe(
      "~540 kcal · 32g protein, estimated",
    );
  });

  it("rounds calories and protein to whole numbers", () => {
    expect(formatRecipeShareMacroLine({ calories: 539.6, protein: 31.4 })).toBe(
      "~540 kcal · 31g protein, estimated",
    );
  });

  it("drops the ', estimated' suffix only when estimated is explicitly false", () => {
    expect(
      formatRecipeShareMacroLine({
        calories: 540,
        protein: 32,
        estimated: false,
      }),
    ).toBe("~540 kcal · 32g protein");
  });

  it("keeps the ', estimated' suffix when estimated is undefined (default) or true", () => {
    expect(formatRecipeShareMacroLine({ calories: 540 })).toContain(
      ", estimated",
    );
    expect(
      formatRecipeShareMacroLine({ calories: 540, estimated: true }),
    ).toContain(", estimated");
  });

  it("omits a non-positive protein clause but keeps kcal", () => {
    expect(formatRecipeShareMacroLine({ calories: 200, protein: 0 })).toBe(
      "~200 kcal, estimated",
    );
    expect(formatRecipeShareMacroLine({ calories: 200, protein: -5 })).toBe(
      "~200 kcal, estimated",
    );
  });

  it("returns null when calories are missing, non-finite, or non-positive", () => {
    expect(formatRecipeShareMacroLine({})).toBeNull();
    expect(formatRecipeShareMacroLine({ calories: null })).toBeNull();
    expect(formatRecipeShareMacroLine({ calories: 0 })).toBeNull();
    expect(formatRecipeShareMacroLine({ calories: -10 })).toBeNull();
    expect(formatRecipeShareMacroLine({ calories: Number.NaN })).toBeNull();
    expect(
      formatRecipeShareMacroLine({ calories: Number.POSITIVE_INFINITY }),
    ).toBeNull();
  });
});

describe("creatorProfileUrl", () => {
  it("builds a /creator/:id link with an encoded id", () => {
    expect(creatorProfileUrl({ creatorId: "abc 123", appOrigin: ORIGIN })).toBe(
      "https://app.suppr.com/creator/abc%20123",
    );
  });

  it("strips a trailing slash from the origin", () => {
    expect(
      creatorProfileUrl({
        creatorId: "c1",
        appOrigin: "https://app.suppr.com/",
      }),
    ).toBe("https://app.suppr.com/creator/c1");
  });

  it("returns null when the creator id is absent or blank", () => {
    expect(creatorProfileUrl({ appOrigin: ORIGIN })).toBeNull();
    expect(creatorProfileUrl({ creatorId: null, appOrigin: ORIGIN })).toBeNull();
    expect(creatorProfileUrl({ creatorId: "  ", appOrigin: ORIGIN })).toBeNull();
  });
});

describe("buildRecipeShareCardMessage", () => {
  it("assembles title, macro, credit, attribution, deep link, and profile URL", () => {
    const message = buildRecipeShareCardMessage({
      recipeId: "rec-1",
      title: "Miso Glazed Salmon",
      calories: 540,
      protein: 32,
      sourceName: "instagram.com",
      authorDisplayName: "Jamie Cooks",
      creatorId: "creator-9",
      appOrigin: ORIGIN,
    });
    expect(message).toBe(
      [
        "Miso Glazed Salmon",
        "~540 kcal · 32g protein, estimated",
        "Recipe by Jamie Cooks",
        "",
        "made with Sloe",
        "https://app.suppr.com/home?view=discover&recipe=rec-1",
        "https://app.suppr.com/creator/creator-9",
      ].join("\n"),
    );
  });

  it("omits the profile URL when there is a creatorId but no credit", () => {
    const message = buildRecipeShareCardMessage({
      recipeId: "rec-2",
      title: "Plain Toast",
      calories: 120,
      creatorId: "creator-9",
      appOrigin: ORIGIN,
    });
    expect(message).toBe(
      [
        "Plain Toast",
        "~120 kcal, estimated",
        "",
        "made with Sloe",
        "https://app.suppr.com/home?view=discover&recipe=rec-2",
      ].join("\n"),
    );
    expect(message).not.toContain("/creator/");
  });

  it("omits the profile URL when there is a credit but no creatorId", () => {
    const message = buildRecipeShareCardMessage({
      recipeId: "rec-3",
      title: "Garden Salad",
      calories: 200,
      authorDisplayName: "Jamie Cooks",
      appOrigin: ORIGIN,
    });
    expect(message).toContain("Recipe by Jamie Cooks");
    expect(message).not.toContain("/creator/");
  });

  it("omits the macro line when calories are unavailable", () => {
    const message = buildRecipeShareCardMessage({
      recipeId: "rec-4",
      title: "Mystery Dish",
      authorDisplayName: "Jamie Cooks",
      creatorId: "creator-9",
      appOrigin: ORIGIN,
    });
    expect(message).not.toContain("kcal");
    // Credit + profile URL still ship because both creatorId and credit exist.
    expect(message).toContain("Recipe by Jamie Cooks");
    expect(message).toContain("https://app.suppr.com/creator/creator-9");
  });

  it("falls back to a 'Recipe' title and normalises the origin trailing slash", () => {
    const message = buildRecipeShareCardMessage({
      recipeId: "rec-5",
      title: "   ",
      calories: 300,
      appOrigin: "https://app.suppr.com/",
    });
    expect(message.startsWith("Recipe\n")).toBe(true);
    expect(message).toContain(
      "https://app.suppr.com/home?view=discover&recipe=rec-5",
    );
    // No double slash leaked from the trailing-slash origin.
    expect(message).not.toContain("suppr.com//");
  });

  it("always ends the body with the 'made with Sloe' attribution + deep link block", () => {
    const message = buildRecipeShareCardMessage({
      recipeId: "rec-6",
      title: "Eggs",
      calories: 150,
      protein: 13,
      appOrigin: ORIGIN,
    });
    expect(message).toContain(
      "\nmade with Sloe\nhttps://app.suppr.com/home?view=discover&recipe=rec-6",
    );
  });
});
