/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/recipe-import/extractSocialRecipe", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/recipe-import/extractSocialRecipe")
  >("@/lib/recipe-import/extractSocialRecipe");
  return {
    ...actual,
    extractRecipeFromCaption: vi.fn(),
  };
});

import {
  parseCaption,
  normaliseStepToImperative,
  CaptionTooShortError,
} from "@/lib/recipes/parseCaption";
import { extractRecipeFromCaption } from "@/lib/recipe-import/extractSocialRecipe";

const mockExtract = extractRecipeFromCaption as ReturnType<typeof vi.fn>;

describe("normaliseStepToImperative", () => {
  it("strips first-person 'I' voice", () => {
    expect(normaliseStepToImperative("I heat the oil in a pan over medium heat")).toBe(
      "Heat the oil in a pan over medium heat.",
    );
    expect(normaliseStepToImperative("we add the garlic")).toBe("Add the garlic.");
  });

  it("strips conversational filler at the start", () => {
    expect(normaliseStepToImperative("Okay, now add the salt")).toBe("Add the salt.");
    expect(normaliseStepToImperative("So basically you want to whisk the eggs")).toBe(
      "Whisk the eggs.",
    );
    expect(normaliseStepToImperative("Then, stir for 2 minutes")).toBe("Stir for 2 minutes.");
    expect(normaliseStepToImperative("And then we mix everything")).toBe("Mix everything.");
  });

  it("strips 'I'm going to' / 'Let's' lead-ins", () => {
    expect(normaliseStepToImperative("I'm going to whisk the eggs together")).toBe(
      "Whisk the eggs together.",
    );
    expect(normaliseStepToImperative("Let's just chop the onion")).toBe("Chop the onion.");
  });

  it("strips 'You want to' / 'You need to' lead-ins", () => {
    expect(normaliseStepToImperative("You want to fold the egg whites in gently")).toBe(
      "Fold the egg whites in gently.",
    );
    expect(normaliseStepToImperative("You need to bake at 180C for 20 minutes")).toBe(
      "Bake at 180C for 20 minutes.",
    );
  });

  it("capitalises the first letter and ensures terminating period", () => {
    expect(normaliseStepToImperative("heat the oil")).toBe("Heat the oil.");
    expect(normaliseStepToImperative("Heat the oil")).toBe("Heat the oil.");
  });

  it("preserves an existing terminator", () => {
    expect(normaliseStepToImperative("Heat the oil!")).toBe("Heat the oil!");
    expect(normaliseStepToImperative("Heat the oil?")).toBe("Heat the oil?");
  });

  it("returns empty for empty / whitespace input", () => {
    expect(normaliseStepToImperative("")).toBe("");
    expect(normaliseStepToImperative("   ")).toBe("");
  });

  it("collapses whitespace", () => {
    expect(normaliseStepToImperative("Heat   the\n\noil")).toBe("Heat the oil.");
  });
});

describe("parseCaption", () => {
  beforeEach(() => {
    mockExtract.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects empty captions with CaptionTooShortError", async () => {
    await expect(
      parseCaption({
        captionText: "",
        sourceUrl: "https://www.instagram.com/p/ABC/",
        platform: "instagram",
        openaiKey: "sk-test",
      }),
    ).rejects.toBeInstanceOf(CaptionTooShortError);

    await expect(
      parseCaption({
        captionText: "   too short  ",
        sourceUrl: "https://www.instagram.com/p/ABC/",
        platform: "instagram",
        openaiKey: "sk-test",
      }),
    ).rejects.toBeInstanceOf(CaptionTooShortError);
  });

  it("normalises every extracted step to imperative voice (legal guardrail)", async () => {
    mockExtract.mockResolvedValueOnce({
      title: "Garlic pasta",
      ingredients: ["200g pasta", "2 cloves garlic"],
      steps: [
        "I heat the olive oil",
        "Then we add the garlic",
        "Okay so basically you want to toss the pasta in the sauce",
      ],
      notes: null,
      servings: 2,
      prepTimeMin: null,
      cookTimeMin: 10,
    });

    const result = await parseCaption({
      captionText: "Quick garlic pasta. Heat oil, add garlic, toss with cooked pasta.",
      sourceUrl: "https://www.instagram.com/p/ABC/",
      platform: "instagram",
      openaiKey: "sk-test",
    });

    expect(result.instructions).toEqual([
      "Heat the olive oil.",
      "Add the garlic.",
      "Toss the pasta in the sauce.",
    ]);
    // None of the steps echo the LLM's first-person framing
    for (const step of result.instructions) {
      expect(step).not.toMatch(/^I\b/);
      expect(step).not.toMatch(/^we\b/i);
      expect(step).not.toMatch(/^okay\b/i);
      expect(step).not.toMatch(/^then\b/i);
    }
  });

  it("passes through ingredients verbatim (facts, not copyrightable)", async () => {
    mockExtract.mockResolvedValueOnce({
      title: "Soup",
      ingredients: ["1 onion", "2 carrots", "500ml stock"],
      steps: ["Cook everything"],
      notes: null,
      servings: 4,
      prepTimeMin: 5,
      cookTimeMin: 30,
    });

    const result = await parseCaption({
      captionText: "Easy carrot soup. 1 onion, 2 carrots, stock. Cook 30 mins.",
      sourceUrl: "https://www.tiktok.com/@cook/video/1",
      platform: "tiktok",
      openaiKey: "sk-test",
    });

    expect(result.ingredients).toEqual(["1 onion", "2 carrots", "500ml stock"]);
  });

  it("attributes the recipe to the platform + creator handle in caption", async () => {
    mockExtract.mockResolvedValueOnce({
      title: "Recipe",
      ingredients: ["1 thing"],
      steps: ["Cook"],
      notes: null,
      servings: 1,
      prepTimeMin: null,
      cookTimeMin: null,
    });

    const result = await parseCaption({
      captionText:
        "Beautiful one-pot pasta — recipe by @chefmaria, follow for more weeknight meals!!! includes garlic and oil details.",
      sourceUrl: "https://www.instagram.com/p/XYZ/",
      platform: "instagram",
      openaiKey: "sk-test",
    });

    expect(result.sourceName).toBe("@chefmaria");
    expect(result.sourcePlatform).toBe("instagram");
    expect(result.sourceUrl).toBe("https://www.instagram.com/p/XYZ/");
  });

  it("returns the platform value the caller passed in", async () => {
    mockExtract.mockResolvedValue({
      title: "x",
      ingredients: ["a"],
      steps: ["b"],
      notes: null,
      servings: 1,
      prepTimeMin: null,
      cookTimeMin: null,
    });
    for (const platform of ["instagram", "tiktok", "youtube"] as const) {
      const r = await parseCaption({
        captionText: "Some recipe with enough text to clear the minimum length threshold",
        sourceUrl: `https://${platform}.com/x`,
        platform,
        openaiKey: "sk-test",
      });
      expect(r.sourcePlatform).toBe(platform);
    }
  });

  it("filters out empty steps after normalisation", async () => {
    mockExtract.mockResolvedValueOnce({
      title: "Recipe",
      ingredients: ["thing"],
      steps: ["", "   ", "Heat the oil"],
      notes: null,
      servings: 1,
      prepTimeMin: null,
      cookTimeMin: null,
    });
    const r = await parseCaption({
      captionText: "Some long enough caption to clear the threshold for parsing.",
      sourceUrl: "https://www.youtube.com/watch?v=x",
      platform: "youtube",
      openaiKey: "sk-test",
    });
    expect(r.instructions).toEqual(["Heat the oil."]);
  });
});
