/**
 * fal.ai FLUX-2-pro image generator (2026-06-08) — pins the LOCKED
 * prompt assembly (Template A / B) and the load-bearing GRACEFUL
 * DEGRADATION: with `FAL_KEY` unset, the generators return a typed
 * error and NEVER throw (so a fire-and-forget caller can't crash and a
 * save can't be blocked). No network is touched in these tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDishPrompt,
  buildIngredientPrompt,
  generateDishImage,
  generateIngredientImage,
  isFalConfigured,
} from "../../src/lib/server/falImageGenerator";

describe("buildDishPrompt — Template A (verbatim from the locked template)", () => {
  it("includes the recipe title and key ingredients", () => {
    const p = buildDishPrompt("Crispy Gochujang Salmon Bowl", [
      "salmon",
      "rice",
      "cucumber",
    ]);
    expect(p).toContain("Crispy Gochujang Salmon Bowl");
    expect(p).toContain("featuring salmon, rice, cucumber");
  });

  it("carries the Sloe editorial anchor + the folded-in Avoid clause (no negative_prompt field on FLUX-2)", () => {
    const p = buildDishPrompt("Stew", []);
    expect(p).toContain("Hyperreal editorial food photography");
    expect(p).toContain("@thelittleplantation");
    expect(p).toContain("Sloe brand imagery");
    // §5 never-list folded into the positive as constraints.
    expect(p).toContain("Avoid:");
    expect(p).toMatch(/no people|people, hands/i);
    expect(p).toMatch(/watercolour/i);
    expect(p).toMatch(/text, words, letters/i);
  });

  it("infers a plating noun from the dish (drink → glass, bread → board, default → bowl)", () => {
    expect(buildDishPrompt("Mango Smoothie", [])).toContain("matte ceramic glass");
    expect(buildDishPrompt("Seeded Sourdough Loaf", [])).toContain("matte ceramic wooden board");
    expect(buildDishPrompt("Lentil Stew", [])).toContain("matte ceramic bowl");
    expect(buildDishPrompt("Pan-Seared Salmon", [])).toContain("matte ceramic plate");
  });

  it("caps key ingredients at 6", () => {
    const p = buildDishPrompt("Big Salad", ["a", "b", "c", "d", "e", "f", "g", "h"]);
    expect(p).toContain("featuring a, b, c, d, e, f");
    expect(p).not.toContain(", g,");
  });

  it("handles an empty title gracefully", () => {
    expect(() => buildDishPrompt("", [])).not.toThrow();
    expect(buildDishPrompt("", [])).toContain("a home-cooked dish");
  });
});

describe("buildIngredientPrompt — Template B (single subject on pure white)", () => {
  it("places the subject on a pure white seamless background, 1:1 daylight", () => {
    const p = buildIngredientPrompt("a small bunch of fresh coriander");
    expect(p).toContain("a small bunch of fresh coriander");
    expect(p).toContain("pure white seamless background");
    expect(p).toContain("Soft natural daylight");
    expect(p).toContain("Sloe brand imagery");
    expect(p).toContain("Avoid:");
  });

  it("does not crash on an empty name", () => {
    expect(() => buildIngredientPrompt("")).not.toThrow();
    expect(buildIngredientPrompt("")).toContain("a single fresh ingredient");
  });
});

describe("graceful degradation — FAL_KEY unset", () => {
  const original = process.env.FAL_KEY;

  beforeEach(() => {
    delete process.env.FAL_KEY;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.FAL_KEY;
    else process.env.FAL_KEY = original;
    vi.restoreAllMocks();
  });

  it("isFalConfigured() is false with no key", () => {
    expect(isFalConfigured()).toBe(false);
  });

  it("generateDishImage returns a typed fal_not_configured error and never throws", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await generateDishImage("Test Recipe", ["egg"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("fal_not_configured");
    }
    // It must never reach the network when the key is missing.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("generateIngredientImage returns a typed fal_not_configured error and never throws", async () => {
    const result = await generateIngredientImage("garlic");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("fal_not_configured");
    }
  });

  it("an empty-string key is treated as unconfigured (trim → null)", () => {
    process.env.FAL_KEY = "   ";
    expect(isFalConfigured()).toBe(false);
  });
});
