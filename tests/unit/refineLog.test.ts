/**
 * Unit tests for the shared refine-by-describing module (ENG-974).
 *
 * Pins the trust posture at the PROMPT + VALIDATOR level (independent of the
 * route / model):
 *  - the prompts carry the current result + refinement text
 *  - the shared "never fabricate a confident number" guardrail is in both prompts
 *  - the photo validator reuses the strict range parser (drops negative/bad kcal
 *    exactly like the first analyse — a vague correction can't smuggle in a bad
 *    number)
 *  - the voice validator coerces name/amount/unit and drops nameless entries
 *  - the text + round clamps
 */
import { describe, expect, it } from "vitest";
import {
  buildPhotoRefinePrompt,
  buildVoiceRefinePrompt,
  clampRefineRound,
  normaliseRefinementText,
  parsePhotoRefineResponse,
  parseVoiceRefineResponse,
  REFINE_MAX_ROUNDS,
  REFINE_TEXT_MAX_CHARS,
  REFINE_TRUST_RULES,
} from "@/lib/nutrition/refineLog";
import type { PhotoLogItemRanged } from "@/lib/nutrition/photoLogRanges";

const items: PhotoLogItemRanged[] = [
  {
    id: "ai-0",
    name: "White rice",
    category: "Carbs",
    quantityHint: "~150g",
    calories: { low: 190, high: 210 },
    protein: { low: 3, high: 4 },
    carbs: { low: 42, high: 46 },
    fat: { low: 0, high: 1 },
    confidence: "high",
    source: "ai",
  },
];

describe("REFINE_TRUST_RULES", () => {
  it("forbids inventing a precise number for a vague correction", () => {
    expect(REFINE_TRUST_RULES).toContain("NEVER invent a precise number");
    expect(REFINE_TRUST_RULES).toMatch(/WIDEN|widen/);
    expect(REFINE_TRUST_RULES).toMatch(/low/);
  });
});

describe("buildPhotoRefinePrompt", () => {
  it("carries the current items + the refinement text and embeds the trust rules", () => {
    const { system, user } = buildPhotoRefinePrompt({
      items,
      refinementText: "no rice, add a fried egg",
      notes: "sauce not visible",
    });
    // Trust rules present in the system prompt.
    expect(system).toContain("NEVER invent a precise number");
    // Same-shape JSON contract taught to the model.
    expect(system).toContain('"calories": { "low": number, "high": number }');
    // Current result + correction present in the user turn.
    expect(user).toContain("White rice");
    expect(user).toContain("no rice, add a fried egg");
  });
});

describe("buildVoiceRefinePrompt", () => {
  it("tells the model NOT to estimate macros and carries the current foods + correction", () => {
    const { system, user } = buildVoiceRefinePrompt({
      items: [{ name: "Scrambled eggs", quantity: "2 large", calories: 180, protein: 12, carbs: 2, fat: 13 }],
      refinementText: "add a fried egg",
      transcript: "two scrambled eggs",
    });
    expect(system).toContain("You do NOT estimate calories or macros");
    expect(system).toContain("NEVER invent a precise number");
    expect(user).toContain("Scrambled eggs");
    expect(user).toContain("add a fried egg");
    expect(user).toContain("two scrambled eggs");
  });
});

describe("parsePhotoRefineResponse", () => {
  it("returns a corrected result and reuses the strict range validator", () => {
    const outcome = parsePhotoRefineResponse(
      {
        items: [
          { name: "Grilled chicken", category: "Protein", calories: { low: 190, high: 210 }, confidence: "high" },
        ],
      },
      "test-model",
    );
    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.response.items).toHaveLength(1);
      expect(outcome.response.items[0].name).toBe("Grilled chicken");
    }
  });

  it("drops an item with a negative calorie value (bad number can't leak through a refine)", () => {
    const outcome = parsePhotoRefineResponse(
      {
        items: [
          { name: "Bad", category: "X", calories: { low: -50, high: -10 }, confidence: "high" },
          { name: "Good", category: "Carbs", calories: { low: 100, high: 120 }, confidence: "medium" },
        ],
      },
      "test-model",
    );
    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.response.items.map((i) => i.name)).toEqual(["Good"]);
    }
  });

  it("derives LOW confidence from a wide range even when the model omits it", () => {
    // Ambiguous correction → wide range. The validator's spread rule flags it
    // low so the UI shows the estimate honestly, regardless of what the model
    // claimed. (Mirrors the route's ambiguous-refinement trust case.)
    const outcome = parsePhotoRefineResponse(
      { items: [{ name: "Rice", category: "Carbs", calories: { low: 150, high: 400 } }] },
      "test-model",
    );
    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.response.items[0].confidence).toBe("low");
    }
  });

  it("flags an emptied plate as no_items (kept-result signal)", () => {
    const outcome = parsePhotoRefineResponse({ items: [] }, "test-model");
    expect(outcome.kind).toBe("no_items");
  });
});

describe("parseVoiceRefineResponse", () => {
  it("coerces name/amount/unit with sane defaults and drops nameless entries", () => {
    const foods = parseVoiceRefineResponse({
      items: [
        { name: "Scrambled eggs", amount: "2", unit: "large" },
        { name: "  ", amount: "1", unit: "cup" }, // dropped — no name
        { name: "Rice" }, // defaults amount/unit
        { amount: "3" }, // dropped — no name
      ],
    });
    expect(foods).toEqual([
      { name: "Scrambled eggs", amount: "2", unit: "large" },
      { name: "Rice", amount: "1", unit: "serving" },
    ]);
  });

  it("returns [] for a non-object or missing items array", () => {
    expect(parseVoiceRefineResponse(null)).toEqual([]);
    expect(parseVoiceRefineResponse({ nope: true })).toEqual([]);
  });
});

describe("normaliseRefinementText", () => {
  it("trims, rejects empty, and caps length", () => {
    expect(normaliseRefinementText("  no rice  ")).toBe("no rice");
    expect(normaliseRefinementText("   ")).toBeNull();
    expect(normaliseRefinementText(123 as unknown)).toBeNull();
    const long = "x".repeat(REFINE_TEXT_MAX_CHARS + 50);
    expect(normaliseRefinementText(long)?.length).toBe(REFINE_TEXT_MAX_CHARS);
  });
});

describe("clampRefineRound", () => {
  it("clamps to [1, REFINE_MAX_ROUNDS]", () => {
    expect(clampRefineRound(0)).toBe(1);
    expect(clampRefineRound(3)).toBe(3);
    expect(clampRefineRound(REFINE_MAX_ROUNDS + 5)).toBe(REFINE_MAX_ROUNDS);
    expect(clampRefineRound("nope")).toBe(1);
  });
});
