/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/server/aiProvider", () => ({
  callAiText: vi.fn(),
  AiBudgetExceededError: class AiBudgetExceededError extends Error {
    retryAfterSec = 3600;
  },
}));

vi.mock("@/lib/nutrition/verifyIngredients", () => ({
  verifyIngredients: vi.fn(async () => ({
    avgIngredientConfidence: 0.82,
    perServing: { calories: 200, protein: 20, carbs: 10, fat: 8, fiberG: 2 },
    verified: [],
  })),
}));

import { callAiText, AiBudgetExceededError } from "@/lib/server/aiProvider";
import { verifyIngredients } from "@/lib/nutrition/verifyIngredients";
import {
  COOKBOOK_MAX_TEXT_LEN,
  parseCookbookFromText,
} from "@/lib/planning/planImport/parseCookbookFromText";
import {
  COOKBOOK_EXCERPT_PARSED,
  COOKBOOK_EXCERPT_TEXT,
} from "@/lib/planning/planImport/fixtures/cookbookExcerpt";

const mockCallAiText = callAiText as ReturnType<typeof vi.fn>;
const mockVerifyIngredients = verifyIngredients as ReturnType<typeof vi.fn>;

describe("parseCookbookFromText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallAiText.mockResolvedValue({
      ok: true,
      text: JSON.stringify(COOKBOOK_EXCERPT_PARSED),
    });
    mockVerifyIngredients.mockResolvedValue({
      avgIngredientConfidence: 0.82,
      perServing: { calories: 200, protein: 20, carbs: 10, fat: 8, fiberG: 2 },
      verified: [],
    });
  });

  it("returns missing_text for blank input", async () => {
    const result = await parseCookbookFromText({ text: "  ", userId: "u1" });
    expect(result).toMatchObject({ ok: false, error: "missing_text" });
  });

  it("returns text_too_long when excerpt exceeds cap", async () => {
    const result = await parseCookbookFromText({
      text: "x".repeat(COOKBOOK_MAX_TEXT_LEN + 1),
      userId: "u1",
    });
    expect(result).toMatchObject({ ok: false, error: "text_too_long" });
  });

  it("parses cookbook text and verifies recipes", async () => {
    const result = await parseCookbookFromText({
      text: COOKBOOK_EXCERPT_TEXT,
      userId: "u1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bookName).toBe("Fast 800");
    expect(result.recipes).toHaveLength(3);
    expect(result.chunkCount).toBeGreaterThan(0);
    expect(mockCallAiText).toHaveBeenCalled();
  });

  it("returns no_content_parsed when model finds no recipes", async () => {
    mockCallAiText.mockResolvedValue({
      ok: true,
      text: JSON.stringify({ bookName: "Empty", recipes: [] }),
    });
    const result = await parseCookbookFromText({ text: "Some text", userId: "u1" });
    expect(result).toMatchObject({ ok: false, error: "no_content_parsed" });
  });

  it("surfaces ai_capacity_reached on budget errors", async () => {
    mockCallAiText.mockRejectedValue(new AiBudgetExceededError("per_user_calls", 3600));
    const result = await parseCookbookFromText({ text: COOKBOOK_EXCERPT_TEXT, userId: "u1" });
    expect(result).toMatchObject({ ok: false, error: "ai_capacity_reached", status: 503 });
  });

  it("returns ai_request_failed when the model call fails with a status", async () => {
    mockCallAiText.mockResolvedValue({
      ok: false,
      error: "upstream_error",
      message: "Model unavailable",
      status: 502,
    });
    const result = await parseCookbookFromText({ text: COOKBOOK_EXCERPT_TEXT, userId: "u1" });
    expect(result).toMatchObject({
      ok: false,
      error: "ai_request_failed",
      message: "Model unavailable",
      status: 502,
    });
  });

  it("returns unparseable_model_output when JSON is invalid", async () => {
    mockCallAiText.mockResolvedValue({ ok: true, text: "not-json" });
    const result = await parseCookbookFromText({ text: COOKBOOK_EXCERPT_TEXT, userId: "u1" });
    expect(result).toMatchObject({
      ok: false,
      error: "ai_request_failed",
      status: 502,
      message: "Could not read the cookbook format. Try a clearer PDF.",
    });
  });

  it("continues with chunk_parse_failed warning when one chunk fails transiently", async () => {
    const page = `${COOKBOOK_EXCERPT_TEXT}\n${"z".repeat(30_000)}`;
    mockCallAiText
      .mockRejectedValueOnce(new Error("transient chunk failure"))
      .mockResolvedValueOnce({
        ok: true,
        text: JSON.stringify(COOKBOOK_EXCERPT_PARSED),
      });
    const result = await parseCookbookFromText({
      text: `${page}\f${page}`,
      userId: "u1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parseWarnings).toContain("chunk_parse_failed");
    expect(result.recipes.length).toBeGreaterThan(0);
  });

  it("uses the provided bookName when supplied", async () => {
    const result = await parseCookbookFromText({
      text: COOKBOOK_EXCERPT_TEXT,
      userId: "u1",
      bookName: "My Custom Cookbook",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bookName).toBe("My Custom Cookbook");
  });

  it("adds truncated_recipes warning when the model returns more than the cap", async () => {
    const recipes = Array.from({ length: 101 }, (_, i) => ({
      key: `recipe-${i}`,
      title: `Recipe ${i}`,
      serves: 1,
      ingredients: ["1 egg"],
    }));
    mockCallAiText.mockResolvedValue({
      ok: true,
      text: JSON.stringify({ bookName: "Huge book", recipes }),
    });
    const result = await parseCookbookFromText({ text: "Cookbook text", userId: "u1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipes).toHaveLength(100);
    expect(result.parseWarnings).toContain("truncated_recipes");
  });

  it("adds low_confidence_recipes when most verified recipes are low confidence", async () => {
    mockVerifyIngredients.mockResolvedValue({
      avgIngredientConfidence: 0.2,
      perServing: { calories: 100, protein: 5, carbs: 10, fat: 3, fiberG: 1 },
      verified: [],
    });
    const result = await parseCookbookFromText({ text: COOKBOOK_EXCERPT_TEXT, userId: "u1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lowConfidenceCount).toBeGreaterThan(result.recipes.length / 2);
    expect(result.parseWarnings).toContain("low_confidence_recipes");
  });

  it("falls back to author nutrition when verifyIngredients throws", async () => {
    mockVerifyIngredients.mockRejectedValue(new Error("nutrition provider down"));
    const result = await parseCookbookFromText({ text: COOKBOOK_EXCERPT_TEXT, userId: "u1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipes[0]?.confidence).toBe("low");
    expect(result.recipes[0]?.supprNutrition.calories).toBe(
      Math.round(COOKBOOK_EXCERPT_PARSED.recipes[0]!.authorNutrition!.calories!),
    );
  });
});
