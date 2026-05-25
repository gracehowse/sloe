import { AiBudgetExceededError, callAiText } from "../../server/aiProvider.ts";
import { buildCookbookParsePrompt } from "./buildCookbookParsePrompt.ts";
import { chunkTextForCookbookParse } from "./chunkTextForCookbookParse.ts";
import { mergeCookbookRecipes } from "./mergeCookbookRecipes.ts";
import { normalizeLlmPayload } from "./normalizeLlmPayload.ts";
import { verifyImportRecipe } from "./verifyImportRecipe.ts";
import type { PlanImportParsedRecipe, PlanImportVerifiedRecipe } from "./types.ts";

export const COOKBOOK_MAX_RECIPES = 100;
export const COOKBOOK_MAX_TEXT_LEN = 512_000;

export type CookbookParseWarning =
  | "truncated_recipes"
  | "chunk_parse_failed"
  | "low_confidence_recipes";

export type ParseCookbookFromTextInput = {
  text: string;
  bookName?: string;
  userId: string;
};

export type ParseCookbookFromTextResult =
  | {
      ok: true;
      bookName: string;
      recipes: PlanImportVerifiedRecipe[];
      parseWarnings: CookbookParseWarning[];
      chunkCount: number;
      lowConfidenceCount: number;
    }
  | { ok: false; error: string; message?: string; retryAfterSec?: number; status?: number };

function parseModelJson(raw: string): unknown {
  const cleaned = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    throw Object.assign(new Error("unparseable_model_output"), {
      status: 502,
      message: "Could not read the cookbook format. Try a clearer PDF.",
    });
  }
}

async function parseChunk(
  chunk: string,
  userId: string,
): Promise<{ recipes: PlanImportParsedRecipe[]; bookName: string | null }> {
  const aiResult = await callAiText({
    callSite: "cookbook-import-parse",
    userId,
    userText: buildCookbookParsePrompt(chunk),
    expectJson: true,
    temperature: 0.2,
    maxTokens: 8000,
  });
  if (!aiResult.ok) {
    throw Object.assign(new Error(aiResult.error), {
      status: aiResult.status,
      message: aiResult.message,
    });
  }
  const parsedRaw = parseModelJson(aiResult.text);
  const normalized = normalizeLlmPayload(parsedRaw);
  const root =
    parsedRaw && typeof parsedRaw === "object"
      ? (parsedRaw as Record<string, unknown>)
      : {};
  const bookName =
    typeof root.bookName === "string"
      ? root.bookName.trim()
      : typeof root.book_name === "string"
        ? root.book_name.trim()
        : normalized.planName?.trim() || null;
  return { recipes: normalized.recipes, bookName };
}

/** Chunked recipes-only parse + per-recipe nutrition verify. */
export async function parseCookbookFromText(
  input: ParseCookbookFromTextInput,
): Promise<ParseCookbookFromTextResult> {
  const text = input.text.trim();
  if (!text) {
    return { ok: false, error: "missing_text", message: "Paste or extract cookbook text first." };
  }
  if (text.length > COOKBOOK_MAX_TEXT_LEN) {
    return {
      ok: false,
      error: "text_too_long",
      message: "This file is too large. Try a shorter excerpt or split the PDF.",
    };
  }

  const chunks = chunkTextForCookbookParse(text);
  const parseWarnings: CookbookParseWarning[] = [];
  const parsedBatches: PlanImportParsedRecipe[][] = [];
  let inferredBookName: string | null = null;

  for (const chunk of chunks) {
    try {
      const { recipes, bookName } = await parseChunk(chunk, input.userId);
      parsedBatches.push(recipes);
      if (!inferredBookName && bookName) inferredBookName = bookName;
    } catch (err) {
      if (err instanceof AiBudgetExceededError) {
        return {
          ok: false,
          error: "ai_capacity_reached",
          message: "AI is temporarily at capacity. Try again in a few hours.",
          retryAfterSec: err.retryAfterSec,
          status: 503,
        };
      }
      const e = err as { status?: number; message?: string; error?: string };
      if (e.status && e.status >= 400) {
        return {
          ok: false,
          error: String(e.error ?? "ai_request_failed"),
          message: e.message,
          status: e.status,
        };
      }
      parseWarnings.push("chunk_parse_failed");
    }
  }

  const merged = mergeCookbookRecipes(parsedBatches);
  if (merged.length === 0) {
    return {
      ok: false,
      error: "no_content_parsed",
      message: "No recipes found. The PDF needs readable recipe pages with ingredients.",
      status: 422,
    };
  }

  const bookName = (
    input.bookName?.trim() ||
    inferredBookName ||
    "Imported cookbook"
  ).slice(0, 80);

  const toVerify = merged.slice(0, COOKBOOK_MAX_RECIPES);
  if (merged.length > COOKBOOK_MAX_RECIPES) {
    parseWarnings.push("truncated_recipes");
  }

  const verified: PlanImportVerifiedRecipe[] = [];
  let lowConfidenceCount = 0;
  for (const r of toVerify) {
    try {
      const v = await verifyImportRecipe(r);
      verified.push(v);
      if (v.confidence === "low") lowConfidenceCount += 1;
    } catch {
      verified.push({
        ...r,
        supprNutrition: {
          calories: Math.round(r.authorNutrition?.calories ?? 0),
          protein: r.authorNutrition?.protein ?? 0,
          carbs: r.authorNutrition?.carbs ?? 0,
          fat: r.authorNutrition?.fat ?? 0,
          fiberG: r.authorNutrition?.fiberG ?? 0,
        },
        confidence: "low",
        confidenceTier: "low",
        ingredientCount: r.ingredients.length,
      });
      lowConfidenceCount += 1;
    }
  }

  if (lowConfidenceCount > verified.length / 2) {
    parseWarnings.push("low_confidence_recipes");
  }

  return {
    ok: true,
    bookName,
    recipes: verified,
    parseWarnings,
    chunkCount: chunks.length,
    lowConfidenceCount,
  };
}
