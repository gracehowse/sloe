/**
 * LLM dish-appearance describer (2026-06-08) — the cure for FLUX
 * rendering RAW ingredients on top of a cooked dish.
 *
 * Covers:
 *   - `sanitizeDishDescription` — strips lead-ins / quotes / fences /
 *     newlines and caps length so the description drops cleanly into the
 *     FLUX positive prompt (pure function, no network).
 *   - `describeDishAppearance` — returns the model's cleaned description
 *     on success, and ALWAYS falls back to the generic cooked clause on
 *     ANY failure (unconfigured, error result, junk reply, thrown budget
 *     error) so image generation is never blocked.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock the AI provider so no real network call is made. Each test sets
// the implementation it needs.
vi.mock("../../src/lib/server/aiProvider", () => ({
  callAiText: vi.fn(),
}));

import { callAiText } from "../../src/lib/server/aiProvider";
import {
  FALLBACK_DISH_APPEARANCE,
  describeDishAppearance,
  sanitizeDishDescription,
} from "../../src/lib/server/llmDishAppearance";

const mockCallAiText = vi.mocked(callAiText);

function aiOk(text: string) {
  return { ok: true as const, text, vendor: "openai" as const, modelVersion: "gpt-4o-mini" };
}
function aiErr(error: "ai_not_configured" | "ai_timeout" | "ai_rate_limited") {
  return {
    ok: false as const,
    error,
    status: 503,
    message: "x",
    vendor: "openai" as const,
    modelVersion: "gpt-4o-mini",
    upstreamStatus: null,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("sanitizeDishDescription", () => {
  it("passes clean prose through unchanged (trimmed)", () => {
    const s = "A golden set frittata, cut into wedges to reveal a custardy interior.";
    expect(sanitizeDishDescription(`  ${s}  `)).toBe(s);
  });

  it("strips a wrapping pair of straight or curly quotes", () => {
    expect(sanitizeDishDescription('"Creamy oats with berries."')).toBe(
      "Creamy oats with berries.",
    );
    expect(sanitizeDishDescription("“Creamy oats with berries.”")).toBe(
      "Creamy oats with berries.",
    );
  });

  it("strips a 'Here is the description:' style lead-in", () => {
    expect(
      sanitizeDishDescription("Here is the description: A golden baked frittata."),
    ).toBe("A golden baked frittata.");
    expect(sanitizeDishDescription("Caption: Creamy soaked oats.")).toBe(
      "Creamy soaked oats.",
    );
  });

  it("does NOT eat a colon mid-sentence", () => {
    const s = "Served simply: a wedge of frittata beside a green salad.";
    expect(sanitizeDishDescription(s)).toBe(s);
  });

  it("strips code fences and collapses internal newlines/whitespace", () => {
    const raw = "```\nA creamy   bowl of\noats with berries.\n```";
    expect(sanitizeDishDescription(raw)).toBe("A creamy bowl of oats with berries.");
  });

  it("caps overly long output at a sentence boundary, never mid-word", () => {
    const long =
      "A beautifully plated dish. " +
      "It is rich and golden and inviting and warm and considered. ".repeat(20);
    const out = sanitizeDishDescription(long);
    expect(out.length).toBeLessThanOrEqual(420);
    // Did not cut mid-word (ends on a sentence stop or full word).
    expect(out).toMatch(/[.!]$|\w$/);
    expect(out.endsWith(" ")).toBe(false);
  });
});

describe("describeDishAppearance — success path", () => {
  it("returns the cleaned model description", async () => {
    mockCallAiText.mockResolvedValueOnce(
      aiOk('"A golden set frittata with chicken and spinach folded throughout."'),
    );
    const out = await describeDishAppearance("Chicken Frittata", ["egg", "chicken", "spinach"]);
    expect(out).toBe("A golden set frittata with chicken and spinach folded throughout.");
  });

  it("uses a cheap fast model + low temperature + small token cap", async () => {
    mockCallAiText.mockResolvedValueOnce(aiOk("Creamy soaked oats topped with berries."));
    await describeDishAppearance("Protein Overnight Oats", ["oats", "protein powder"], {
      userId: "user-123",
    });
    expect(mockCallAiText).toHaveBeenCalledTimes(1);
    const arg = mockCallAiText.mock.calls[0][0];
    expect(arg.callSite).toBe("describeDishAppearance");
    expect(arg.userId).toBe("user-123");
    expect(arg.expectJson).toBe(false);
    expect(arg.temperature).toBeLessThanOrEqual(0.3);
    expect(arg.maxTokens).toBeLessThanOrEqual(200);
    expect(arg.openaiModel).toBe("gpt-4o-mini");
    // The key ingredients must be passed to the LLM (to inform the
    // description) — this is where they belong, NOT in the FLUX prompt.
    expect(arg.userText).toContain("protein powder");
  });
});

describe("describeDishAppearance — fail-safe (never blocks generation)", () => {
  it("falls back when the AI provider is not configured", async () => {
    mockCallAiText.mockResolvedValueOnce(aiErr("ai_not_configured"));
    const out = await describeDishAppearance("Chicken Frittata", ["egg"]);
    expect(out).toBe(FALLBACK_DISH_APPEARANCE);
  });

  it("falls back on a timeout / rate-limit error", async () => {
    mockCallAiText.mockResolvedValueOnce(aiErr("ai_timeout"));
    expect(await describeDishAppearance("Stew", [])).toBe(FALLBACK_DISH_APPEARANCE);
    mockCallAiText.mockResolvedValueOnce(aiErr("ai_rate_limited"));
    expect(await describeDishAppearance("Stew", [])).toBe(FALLBACK_DISH_APPEARANCE);
  });

  it("falls back when the model returns junk / too-short output", async () => {
    mockCallAiText.mockResolvedValueOnce(aiOk("."));
    expect(await describeDishAppearance("Stew", [])).toBe(FALLBACK_DISH_APPEARANCE);
    mockCallAiText.mockResolvedValueOnce(aiOk("   "));
    expect(await describeDishAppearance("Stew", [])).toBe(FALLBACK_DISH_APPEARANCE);
  });

  it("falls back (never throws) when callAiText throws a budget error", async () => {
    mockCallAiText.mockRejectedValueOnce(new Error("AiBudgetExceededError: global_spend"));
    const out = await describeDishAppearance("Chicken Frittata", ["egg"]);
    expect(out).toBe(FALLBACK_DISH_APPEARANCE);
  });

  it("falls back on an empty title without calling the model at all", async () => {
    const out = await describeDishAppearance("   ", ["egg"]);
    expect(out).toBe(FALLBACK_DISH_APPEARANCE);
    expect(mockCallAiText).not.toHaveBeenCalled();
  });

  it("the fallback clause itself steers away from the raw-pile failure mode", () => {
    expect(FALLBACK_DISH_APPEARANCE).toMatch(/fully cooked/i);
    expect(FALLBACK_DISH_APPEARANCE).toMatch(/nothing raw or uncooked/i);
  });
});
