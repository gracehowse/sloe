/**
 * fal.ai image generator (2026-06-08) — pins the LOCKED prompt assembly
 * (Template A = FLUX 2 Pro dish heroes; Template B = Nano Banana Pro single
 * ingredient, ONE representative subject) and the load-bearing GRACEFUL
 * DEGRADATION: with `FAL_KEY` unset, the generators return a typed error and
 * NEVER throw (so a fire-and-forget caller can't crash and a save can't be
 * blocked). No network is touched in these tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDishPrompt,
  buildIngredientPrompt,
  generateDishImage,
  generateIngredientImage,
  isFalConfigured,
} from "../../src/lib/server/falImageGenerator";

describe("buildDishPrompt — Template A (cooked-dish description, NOT a raw ingredient list)", () => {
  it("includes the recipe title and the finished-dish description verbatim", () => {
    const desc =
      "A golden set frittata with tender chicken and wilted spinach folded throughout, cut into wedges.";
    const p = buildDishPrompt("Chicken Frittata", desc);
    expect(p).toContain("Chicken Frittata");
    expect(p).toContain(desc);
  });

  it("does NOT list raw ingredients with a `featuring …` clause (the bug being fixed)", () => {
    // The old prompt did `…a finished plated dish featuring {ingredients}…`,
    // which made FLUX render raw eggs / loose powder on top. The new prompt
    // takes a cooked-dish description and must never reintroduce that clause.
    const p = buildDishPrompt("Chicken Frittata", "A golden set baked egg dish.");
    expect(p).not.toContain("featuring");
  });

  it("folds in the cooked-state guards so FLUX renders a cooked dish, nothing raw on top", () => {
    const p = buildDishPrompt("Protein Overnight Oats", "Creamy oats with the protein dissolved in.");
    expect(p).toContain("fully cooked and integrated");
    expect(p).toMatch(/no whole raw eggs/i);
    expect(p).toMatch(/no runny yolks on top/i);
    expect(p).toMatch(/no loose or dry powder/i);
    expect(p).toMatch(/nothing raw piled on the surface/i);
    expect(p).toMatch(/no people, no hands, no fingers/i);
  });

  it("carries the Sloe editorial anchor + the folded-in Avoid clause (no negative_prompt field on FLUX-2)", () => {
    const p = buildDishPrompt("Stew", "");
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
    expect(buildDishPrompt("Mango Smoothie", "")).toContain("matte ceramic glass");
    expect(buildDishPrompt("Seeded Sourdough Loaf", "")).toContain("matte ceramic wooden board");
    expect(buildDishPrompt("Lentil Stew", "")).toContain("matte ceramic bowl");
    expect(buildDishPrompt("Pan-Seared Salmon", "")).toContain("matte ceramic plate");
    expect(buildDishPrompt("Chicken Frittata", "")).toContain("matte ceramic skillet");
  });

  it("renders a coherent prompt even when the description is empty (generic finished dish)", () => {
    const p = buildDishPrompt("Lentil Stew", "");
    expect(p).toContain("Hyperreal editorial food photography of Lentil Stew.");
    // No dangling double-space artefact from the empty description clause.
    expect(p).not.toContain("  The finished dish");
  });

  it("handles an empty title gracefully", () => {
    expect(() => buildDishPrompt("", "")).not.toThrow();
    expect(buildDishPrompt("", "")).toContain("a home-cooked dish");
  });
});

describe("buildIngredientPrompt — Template B (Nano: ONE representative subject)", () => {
  // The white-background / lighting / shadow consistency now lives in the
  // FIXED Nano `system_prompt` (applied on every call), NOT in this per-image
  // line. The per-image prompt is just the ONE representative subject — never
  // the literal recipe quantity.
  it("renders a single subject for a solid food", () => {
    expect(buildIngredientPrompt("garlic")).toBe("A single garlic.");
    expect(buildIngredientPrompt("Cherry Tomato")).toBe("A single cherry tomato.");
    expect(buildIngredientPrompt("egg white")).toBe("A single egg white.");
  });

  it("renders loose / heap-forming foods as a small neat mound (one consistent treatment)", () => {
    expect(buildIngredientPrompt("salt")).toBe("A small neat mound of salt.");
    expect(buildIngredientPrompt("dry oregano")).toBe("A small neat mound of dry oregano.");
    expect(buildIngredientPrompt("flour")).toBe("A small neat mound of flour.");
    expect(buildIngredientPrompt("protein powder")).toBe("A small neat mound of protein powder.");
  });

  it("renders liquids / condiments as a small unlabelled portion in a clear vessel", () => {
    expect(buildIngredientPrompt("olive oil")).toBe(
      "A small unlabelled portion of olive oil in a simple clear vessel.",
    );
    expect(buildIngredientPrompt("soy sauce")).toBe(
      "A small unlabelled portion of soy sauce in a simple clear vessel.",
    );
    expect(buildIngredientPrompt("honey")).toBe(
      "A small unlabelled portion of honey in a simple clear vessel.",
    );
  });

  it("lowercases + strips a trailing period; never the literal quantity", () => {
    // input is the cleaned display name; we always render ONE representative
    // item ("A single …"), never the recipe count.
    expect(buildIngredientPrompt("Garlic.")).toBe("A single garlic.");
    expect(buildIngredientPrompt("RED ONION")).toBe("A single red onion.");
  });

  it("does not crash on an empty name", () => {
    expect(() => buildIngredientPrompt("")).not.toThrow();
    expect(buildIngredientPrompt("")).toBe("A single fresh ingredient.");
  });
});

describe("graceful degradation — FAL_KEY unset", () => {
  const originalFal = process.env.FAL_KEY;
  const originalAnthropic = process.env.ANTHROPIC_API_KEY;
  const originalOpenai = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.FAL_KEY;
    // Also clear the AI provider keys so the LLM dish-appearance step
    // inside generateDishImage short-circuits to its fallback string
    // WITHOUT making a network call — this test asserts no `fetch`.
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });
  afterEach(() => {
    if (originalFal === undefined) delete process.env.FAL_KEY;
    else process.env.FAL_KEY = originalFal;
    if (originalAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalAnthropic;
    if (originalOpenai === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenai;
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
    // It must never reach the network when the key is missing — neither
    // the LLM dish-appearance step (AI keys cleared above) nor fal.
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
