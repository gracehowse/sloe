/**
 * Recipe-wave (2026-05-10) — unit tests for the recipe-import pipeline
 * telemetry helper. Verifies that each stage emits the expected
 * payload to PostHog via `serverTrack` (mocked).
 *
 * The goal of the instrumentation: when a tester reports "wrong
 * carbs" on an imported recipe, we can correlate the PostHog trace
 * to the exact stage (extraction / parsing / nutrition / caption)
 * that produced the bad number — without having to repro blind.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnalyticsEvents } from "@/lib/analytics/events";

vi.mock("@/lib/analytics/serverTrack", () => ({
  serverTrack: vi.fn(async () => ({ ok: true })),
}));

import { serverTrack } from "@/lib/analytics/serverTrack";
import {
  traceAcquisition,
  traceExtraction,
  traceParsing,
  traceNutritionLookup,
  traceCaptionNutrition,
} from "@/lib/analytics/recipeImportPipelineTrace";

const serverTrackMock = serverTrack as unknown as ReturnType<typeof vi.fn>;

describe("recipeImportPipelineTrace", () => {
  beforeEach(() => {
    serverTrackMock.mockClear();
  });

  describe("traceAcquisition", () => {
    it("emits fallback + not_configured when Supadata is unconfigured (ENG-1115)", () => {
      traceAcquisition("user-1", {
        outcome: "fallback",
        adapter: "supadata",
        platform: "blog",
        reason: "not_configured",
      });
      expect(serverTrackMock).toHaveBeenCalledWith(
        AnalyticsEvents.recipe_acquisition,
        "user-1",
        {
          adapter: "supadata",
          kind: null,
          platform: "blog",
          outcome: "fallback",
          reason: "not_configured",
        },
      );
    });
  });

  describe("traceExtraction", () => {
    it("emits extraction stage with method + counts for the image path", () => {
      traceExtraction("user-1", "image", "ai_vision", { ingredientCount: 5, stepCount: 3 });
      expect(serverTrackMock).toHaveBeenCalledTimes(1);
      expect(serverTrackMock).toHaveBeenCalledWith(
        AnalyticsEvents.recipe_import_pipeline_stage,
        "user-1",
        {
          importPath: "image",
          stage: "extraction",
          extractionMethod: "ai_vision",
          extractedIngredientCount: 5,
          extractedStepCount: 3,
        },
      );
    });

    it("emits schema_org method for URL-import success", () => {
      traceExtraction("u", "url", "schema_org", { ingredientCount: 12, stepCount: 6 });
      expect(serverTrackMock).toHaveBeenCalledWith(
        AnalyticsEvents.recipe_import_pipeline_stage,
        "u",
        expect.objectContaining({ importPath: "url", extractionMethod: "schema_org" }),
      );
    });

    it("emits ai_caption method for the caption-text path", () => {
      traceExtraction("u", "caption", "ai_caption", { ingredientCount: 4, stepCount: 0 });
      expect(serverTrackMock).toHaveBeenCalledWith(
        AnalyticsEvents.recipe_import_pipeline_stage,
        "u",
        expect.objectContaining({ importPath: "caption", extractionMethod: "ai_caption" }),
      );
    });
  });

  describe("traceParsing", () => {
    it("emits the parsed ingredient count for each import path", () => {
      traceParsing("u", "image", 5);
      traceParsing("u", "url", 12);
      traceParsing("u", "caption", 4);
      expect(serverTrackMock).toHaveBeenCalledTimes(3);
      const calls = serverTrackMock.mock.calls;
      expect(calls[0]?.[2]).toMatchObject({ importPath: "image", stage: "ingredient_parsing", parsedIngredientCount: 5 });
      expect(calls[1]?.[2]).toMatchObject({ importPath: "url", parsedIngredientCount: 12 });
      expect(calls[2]?.[2]).toMatchObject({ importPath: "caption", parsedIngredientCount: 4 });
    });
  });

  describe("traceNutritionLookup", () => {
    it("aggregates per-source counts + confidence stats from verified[]", () => {
      traceNutritionLookup("u", "url", {
        verified: [
          { source: "USDA", confidence: 0.95 },
          { source: "USDA", confidence: 0.92 },
          { source: "FatSecret", confidence: 0.81 },
          { source: "Estimated", confidence: 0.4 },
        ],
        primarySource: "USDA",
        perServing: { calories: 412, protein: 32, carbs: 41, fat: 12 },
        servings: 4,
      });
      expect(serverTrackMock).toHaveBeenCalledWith(
        AnalyticsEvents.recipe_import_pipeline_stage,
        "u",
        {
          importPath: "url",
          stage: "nutrition_lookup",
          verifiedCount: 4,
          primarySource: "USDA",
          sourceCounts: { USDA: 2, FatSecret: 1, Estimated: 1 },
          avgConfidence: 0.77,
          minConfidence: 0.4,
          fallbackUsed: true,
          totalCalories: 412,
          totalProteinG: 32,
          totalCarbsG: 41,
          totalFatG: 12,
          servings: 4,
        },
      );
    });

    it("flags fallbackUsed=false when no ingredient hit the Estimated fallback", () => {
      traceNutritionLookup("u", "image", {
        verified: [
          { source: "USDA", confidence: 0.95 },
          { source: "OFF", confidence: 0.88 },
        ],
        primarySource: "USDA",
        perServing: { calories: 200, protein: 10, carbs: 20, fat: 5 },
        servings: 1,
      });
      const payload = serverTrackMock.mock.calls[0]?.[2] as Record<string, unknown>;
      expect(payload.fallbackUsed).toBe(false);
    });

    it("treats a null source as Unverified in source counts", () => {
      traceNutritionLookup("u", "caption", {
        verified: [
          { source: null, confidence: 0.5 },
          { source: undefined, confidence: 0.6 },
        ],
        primarySource: null,
        perServing: { calories: 100, protein: 5, carbs: 10, fat: 3 },
        servings: 2,
      });
      const payload = serverTrackMock.mock.calls[0]?.[2] as Record<string, unknown>;
      expect(payload.sourceCounts).toEqual({ Unverified: 2 });
      expect(payload.primarySource).toBeNull();
    });

    it("handles an empty verified[] without divide-by-zero", () => {
      traceNutritionLookup("u", "image", {
        verified: [],
        primarySource: null,
        perServing: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        servings: 1,
      });
      const payload = serverTrackMock.mock.calls[0]?.[2] as Record<string, unknown>;
      expect(payload.verifiedCount).toBe(0);
      expect(payload.avgConfidence).toBe(0);
    });
  });

  describe("traceCaptionNutrition", () => {
    it("flags captionExtracted=true when any claim field is non-null", () => {
      traceCaptionNutrition("u", "url", {
        caloriesPerServing: 350,
        proteinG: null,
        carbsG: null,
        fatG: null,
      });
      const payload = serverTrackMock.mock.calls[0]?.[2] as Record<string, unknown>;
      expect(payload.captionExtracted).toBe(true);
      expect(payload.captionCalories).toBe(350);
    });

    it("flags captionExtracted=false when claim is null or all-null", () => {
      traceCaptionNutrition("u", "url", null);
      let payload = serverTrackMock.mock.calls[0]?.[2] as Record<string, unknown>;
      expect(payload.captionExtracted).toBe(false);

      serverTrackMock.mockClear();
      traceCaptionNutrition("u", "caption", {
        caloriesPerServing: null,
        proteinG: null,
        carbsG: null,
        fatG: null,
      });
      payload = serverTrackMock.mock.calls[0]?.[2] as Record<string, unknown>;
      expect(payload.captionExtracted).toBe(false);
    });
  });

  describe("fire-and-forget posture", () => {
    it("no-ops when userId is null (no anonymous traces)", () => {
      traceExtraction(null, "image", "ai_vision", { ingredientCount: 1, stepCount: 0 });
      traceParsing(null, "image", 1);
      traceNutritionLookup(null, "image", {
        verified: [{ source: "USDA", confidence: 0.9 }],
        primarySource: "USDA",
        perServing: { calories: 100 },
        servings: 1,
      });
      traceCaptionNutrition(null, "caption", { caloriesPerServing: 200 });
      expect(serverTrackMock).not.toHaveBeenCalled();
    });
  });
});
