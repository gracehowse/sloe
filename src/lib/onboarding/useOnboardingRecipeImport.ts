import { useCallback, useState } from "react";
import type { ApiImportedRecipe } from "../recipes/persistImportedRecipe";
import { ImportRunnerError } from "../recipes/recipeImportScheduler";
import {
  IMPORT_ERROR_COPY,
  userFacingImportError,
} from "../recipes/importErrorCopy";

/**
 * ENG-1304 — stable blog URL with JSON-LD for the onboarding "Try a sample
 * recipe" affordance. Cookie and Kate is in `scripts/seed-recipe-urls.txt`
 * and reliably parses through the HTML importer (no social-caption path).
 */
export const ONBOARDING_SAMPLE_RECIPE_URL =
  "https://cookieandkate.com/best-lentil-soup-recipe/";

export const ONBOARDING_RECIPE_IMPORT_PROGRESS = [
  "Fetching recipe…",
  "Parsing ingredients",
  "Matching against USDA / OFF",
  "Calculating macros",
] as const;

export type OnboardingRecipeImportPhase =
  | "idle"
  | "importing"
  | "success"
  | "error";

export interface OnboardingRecipeImportSummary {
  title: string;
  servings: number | null;
  totalMinutes: number | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  sourceHost: string;
}

export function buildOnboardingRecipeImportSummary(
  recipe: ApiImportedRecipe,
  sourceUrl: string,
): OnboardingRecipeImportSummary {
  let sourceHost = sourceUrl;
  try {
    sourceHost = new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    /* keep raw */
  }
  const prep = recipe.prepTimeMin ?? null;
  const cook = recipe.cookTimeMin ?? null;
  const totalMinutes =
    prep != null || cook != null ? (prep ?? 0) + (cook ?? 0) : null;
  return {
    title: recipe.title?.trim() || "Imported recipe",
    servings: recipe.servings ?? null,
    totalMinutes,
    calories: recipe.calories ?? null,
    protein: recipe.protein ?? null,
    carbs: recipe.carbs ?? null,
    fat: recipe.fat ?? null,
    sourceHost,
  };
}

/**
 * Shared state machine for the onboarding data-bridges recipe-import card.
 * Platform shells inject `runImport` (fetch + persist + analytics).
 */
export function useOnboardingRecipeImport(
  runImport: (url: string) => Promise<OnboardingRecipeImportSummary>,
) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<OnboardingRecipeImportPhase>("idle");
  const [summary, setSummary] = useState<OnboardingRecipeImportSummary | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startImport = useCallback(
    async (rawUrl: string) => {
      const trimmed = rawUrl.trim();
      if (!trimmed) return;
      setPhase("importing");
      setErrorMessage(null);
      setSummary(null);
      try {
        const result = await runImport(trimmed);
        setSummary(result);
        setPhase("success");
      } catch (e) {
        setPhase("error");
        setErrorMessage(
          e instanceof Error
            ? e.message
            : "Couldn't import that recipe. Try another link.",
        );
      }
    },
    [runImport],
  );

  const importCurrentUrl = useCallback(() => {
    return startImport(url);
  }, [startImport, url]);

  const importSample = useCallback(() => {
    setUrl(ONBOARDING_SAMPLE_RECIPE_URL);
    void startImport(ONBOARDING_SAMPLE_RECIPE_URL);
  }, [startImport]);

  const reset = useCallback(() => {
    setPhase("idle");
    setSummary(null);
    setErrorMessage(null);
  }, []);

  return {
    url,
    setUrl,
    phase,
    summary,
    errorMessage,
    importCurrentUrl,
    importSample,
    reset,
  };
}

/** Map import failures to user-facing copy at the card boundary. */
export function onboardingRecipeImportErrorMessage(err: unknown): string {
  if (err instanceof ImportRunnerError) {
    return (
      IMPORT_ERROR_COPY[err.code] ??
      userFacingImportError({ error: err.code, message: err.message })
    );
  }
  if (err instanceof Error) return err.message;
  return IMPORT_ERROR_COPY.import_failed;
}
