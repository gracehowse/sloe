/**
 * fal.ai image generator (2026-06-08) — pins the LOCKED prompt assembly
 * (Template A + Template B BOTH on Nano Banana Pro from 2026-06-08: dish heroes
 * are the dish title + an LLM cooked-dish description with the editorial house
 * style + cooked-state guards on a FIXED system prompt; ingredient tiles are
 * ONE representative subject) and the load-bearing GRACEFUL DEGRADATION: with
 * `FAL_KEY` unset, the generators return a typed error and NEVER throw (so a
 * fire-and-forget caller can't crash and a save can't be blocked). No network
 * is touched in these tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DISH_SYSTEM_PROMPT,
  buildDishPrompt,
  buildIngredientPrompt,
  generateDishImage,
  generateIngredientImage,
  isFalConfigured,
} from "../../src/lib/server/falImageGenerator";

describe("buildDishPrompt — Template A (short per-dish line: title + cooked-dish description)", () => {
  // The editorial house style + cooked-state guards now live in the FIXED
  // DISH_SYSTEM_PROMPT (Nano honours a true Gemini-3 system instruction), NOT
  // in this per-dish line — exactly like the ingredient approach. The per-dish
  // line is just the dish title + the LLM cooked-dish description.
  it("includes the recipe title and the finished-dish description verbatim", () => {
    const desc =
      "A golden set frittata with tender chicken and wilted spinach folded throughout, cut into wedges.";
    const p = buildDishPrompt("Chicken Frittata", desc);
    expect(p).toContain("Chicken Frittata");
    expect(p).toContain(desc);
  });

  it("is the exact `Hyperreal editorial food photography of {TITLE}. {DESCRIPTION}` shape", () => {
    expect(buildDishPrompt("Chicken Frittata", "A golden set baked egg dish.")).toBe(
      "Hyperreal editorial food photography of Chicken Frittata. A golden set baked egg dish.",
    );
  });

  it("does NOT list raw ingredients with a `featuring …` clause (the bug being fixed)", () => {
    // The old prompt did `…a finished plated dish featuring {ingredients}…`,
    // which rendered raw eggs / loose powder on top. The new per-dish line
    // takes a cooked-dish description and must never reintroduce that clause.
    const p = buildDishPrompt("Chicken Frittata", "A golden set baked egg dish.");
    expect(p).not.toContain("featuring");
  });

  it("does NOT carry the house style in the per-dish line (it rides on the system prompt now)", () => {
    // These all moved to DISH_SYSTEM_PROMPT — the per-dish line stays short so
    // the system prompt is the single consistency lever (mirroring ingredients).
    const p = buildDishPrompt("Lentil Stew", "A rich brothy lentil stew.");
    expect(p).not.toContain("@thelittleplantation");
    expect(p).not.toContain("Sloe brand imagery");
    expect(p).not.toContain("Avoid:");
    expect(p).not.toContain("matte ceramic");
    expect(p).not.toMatch(/fully cooked and integrated/i);
  });

  it("renders a coherent prompt even when the description is empty (title only, no trailing space)", () => {
    const p = buildDishPrompt("Lentil Stew", "");
    expect(p).toBe("Hyperreal editorial food photography of Lentil Stew.");
    // No dangling trailing space from the empty description clause.
    expect(p).not.toMatch(/\s$/);
  });

  it("handles an empty title gracefully", () => {
    expect(() => buildDishPrompt("", "")).not.toThrow();
    expect(buildDishPrompt("", "")).toContain("a home-cooked dish");
  });
});

describe("DISH_SYSTEM_PROMPT — the FIXED Template-A house style + cooked-state guards", () => {
  // This is where the raw-eggs protection lives now. If anyone strips the
  // cooked-state guards, these break — the whole point of the migration.
  it("locks the warm editorial register (the hyper-realism + brand consistency lever)", () => {
    expect(DISH_SYSTEM_PROMPT).toMatch(/Soft moody natural window light/i);
    expect(DISH_SYSTEM_PROMPT).toMatch(/shallow depth of field/i);
    expect(DISH_SYSTEM_PROMPT).toContain("@thelittleplantation");
    expect(DISH_SYSTEM_PROMPT).toContain("@_foodstories_");
    expect(DISH_SYSTEM_PROMPT).toMatch(/Ultra-realistic photograph/i);
    expect(DISH_SYSTEM_PROMPT).toMatch(/never 3D-rendered, never glossy CGI/i);
  });

  it("keeps the cooked-state guards (no raw ingredients / raw eggs / loose powder on top)", () => {
    expect(DISH_SYSTEM_PROMPT).toMatch(/fully cooked and integrated/i);
    expect(DISH_SYSTEM_PROMPT).toMatch(/no raw or uncooked ingredients/i);
    expect(DISH_SYSTEM_PROMPT).toMatch(/no whole raw eggs/i);
    expect(DISH_SYSTEM_PROMPT).toMatch(/no loose powder/i);
    expect(DISH_SYSTEM_PROMPT).toMatch(/nothing raw piled on top/i);
  });

  it("keeps the no-people / no-text guards", () => {
    expect(DISH_SYSTEM_PROMPT).toMatch(/no people, no hands, no fingers/i);
    expect(DISH_SYSTEM_PROMPT).toMatch(/no text, no logo, no watermark/i);
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
