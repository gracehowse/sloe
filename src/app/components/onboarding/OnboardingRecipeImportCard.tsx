"use client";

import * as React from "react";
import { Check, Link2, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useOnboarding } from "./context";
import { supabase } from "@/lib/supabase/browserClient";
import { track } from "@/lib/analytics/track";
import { AnalyticsEvents } from "@/lib/analytics/events";
import {
  saveImportedRecipe,
  type ApiImportedRecipe,
} from "@/lib/recipes/persistImportedRecipe";
import { ImportRunnerError } from "@/lib/recipes/recipeImportScheduler";
import {
  coerceImportErrorCode,
  IMPORT_ERROR_COPY,
} from "@/lib/recipes/importErrorCopy";
import {
  buildOnboardingRecipeImportSummary,
  ONBOARDING_RECIPE_IMPORT_PROGRESS,
  onboardingRecipeImportErrorMessage,
  useOnboardingRecipeImport,
} from "@/lib/onboarding/useOnboardingRecipeImport";

/**
 * ENG-1304 — real recipe import inside onboarding data-bridges (web).
 * Replaces the "try after setup" placeholder so the viral hook lands
 * during first-run. Mobile mirror:
 * `apps/mobile/components/onboarding/OnboardingRecipeImportCard.tsx`.
 */
export function OnboardingRecipeImportCard() {
  const { set } = useOnboarding();

  const runImport = React.useCallback(async (url: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id ?? null;
      if (!userId) {
        throw new Error(IMPORT_ERROR_COPY.client_signin_required_to_save);
      }

      let res: Response;
      try {
        res = await fetch("/api/recipe-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
      } catch {
        throw new ImportRunnerError("network_error");
      }

      const data = (await res.json()) as {
        ok?: boolean;
        recipe?: ApiImportedRecipe;
        message?: string;
        error?: string;
      };
      if (!data.ok || !data.recipe) {
        const code = coerceImportErrorCode(data.error, "no_recipe_extracted");
        throw new ImportRunnerError(code, data.message);
      }

      const saved = await saveImportedRecipe(supabase, userId, {
        ...data.recipe,
        sourceUrl: data.recipe.sourceUrl ?? url,
      });
      if ("error" in saved) {
        throw new Error(saved.error);
      }

      set({ dataBridgeChosen: "recipe" });
      track(AnalyticsEvents.onboarding_data_bridge_chosen, { option: "recipe" });
      let importHost = url;
      try {
        importHost = new URL(url).hostname;
      } catch {
        /* keep raw */
      }
      track(AnalyticsEvents.recipe_imported, {
        host: importHost,
        source: "url" as const,
      });
      track(AnalyticsEvents.recipe_import_saved_first, { platform: "web" as const });

      return buildOnboardingRecipeImportSummary(data.recipe, url);
    } catch (e) {
      throw new Error(onboardingRecipeImportErrorMessage(e));
    }
  }, [set]);

  const flow = useOnboardingRecipeImport(runImport);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex gap-3 items-start">
        <div className="size-9 rounded-lg flex items-center justify-center shrink-0 text-emerald-500 bg-emerald-500/15">
          <Link2 className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="flex-1 text-sm font-bold text-foreground tracking-tight">
              Recipe import
            </h3>
            {flow.phase === "success" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                <Check className="size-2.5" />
                Saved
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Paste a link from Instagram, TikTok, YouTube, or any recipe blog —
            Sloe parses ingredients and saves it to your Library.
          </p>
        </div>
      </div>

      {flow.phase === "idle" || flow.phase === "error" ? (
        <div className="mt-3">
          <label className="block rounded-md border border-border bg-input-background px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-1">
              Recipe URL
            </div>
            <div className="flex items-center gap-1.5">
              <Link2 className="size-3.5 text-muted-foreground shrink-0" />
              <input
                type="url"
                value={flow.url}
                onChange={(e) => flow.setUrl(e.target.value)}
                placeholder="https://www.instagram.com/reel/…"
                aria-label="Recipe URL"
                className="flex-1 min-w-0 bg-transparent border-0 outline-none text-base font-medium text-foreground placeholder:text-muted-foreground/60"
              />
            </div>
          </label>
          {flow.phase === "error" && flow.errorMessage ? (
            <p className="mt-2 text-[11px] text-amber-500 leading-relaxed">
              {flow.errorMessage}
            </p>
          ) : null}
          <div className="mt-3 flex flex-col gap-2">
            <Button
              type="button"
              size="sm"
              className="h-9 w-full"
              disabled={!flow.url.trim()}
              onClick={flow.importCurrentUrl}
            >
              {flow.url.trim() ? "Import this recipe" : "Paste a link to import"}
            </Button>
            <button
              type="button"
              onClick={flow.importSample}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Try a sample recipe
            </button>
          </div>
        </div>
      ) : null}

      {flow.phase === "importing" ? (
        <ImportProgress />
      ) : null}

      {flow.phase === "success" && flow.summary ? (
        <ImportSuccess
          summary={flow.summary}
          onImportAnother={flow.reset}
        />
      ) : null}
    </div>
  );
}

function ImportProgress() {
  const steps = ONBOARDING_RECIPE_IMPORT_PROGRESS;
  const [cur, setCur] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(
      () => setCur((c) => Math.min(steps.length - 1, c + 1)),
      500,
    );
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <div className="mt-3 rounded-xl border border-border bg-input-background/40 p-4 text-center">
      <Loader2 className="size-8 mx-auto mb-3 animate-spin text-primary" />
      <div className="text-sm font-bold text-foreground mb-3">
        Importing your recipe
      </div>
      <div className="text-left max-w-[280px] mx-auto">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`flex gap-2.5 items-center py-1.5 transition-opacity ${
              i <= cur ? "opacity-100" : "opacity-35"
            }`}
          >
            {i < cur ? (
              <Check className="size-3.5 text-success" strokeWidth={2.5} />
            ) : (
              <div
                className={`size-3.5 rounded-full border-[1.5px] ${
                  i === cur
                    ? "border-primary bg-primary/20"
                    : "border-input"
                }`}
              />
            )}
            <span
              className={`text-xs ${
                i <= cur ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {s}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImportSuccess({
  summary,
  onImportAnother,
}: {
  summary: NonNullable<ReturnType<typeof useOnboardingRecipeImport>["summary"]>;
  onImportAnother: () => void;
}) {
  const meta = [
    summary.servings != null ? `${summary.servings} servings` : null,
    summary.totalMinutes != null ? `${summary.totalMinutes} min` : null,
    summary.sourceHost,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mt-3 rounded-xl border border-emerald-500/30 overflow-hidden">
      {summary.calories != null ? (
        <div className="p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-emerald-500 mb-2">
            <Check className="size-3.5" strokeWidth={2.5} />
            Saved to your Library
          </div>
          <div className="text-base font-bold text-foreground tracking-tight mb-1">
            {summary.title}
          </div>
          {meta ? (
            <div className="text-xs text-muted-foreground mb-3">{meta}</div>
          ) : null}
          <div className="grid grid-cols-4 gap-2 border-t border-border pt-3">
            <MiniStat n={String(Math.round(summary.calories ?? 0))} u="kcal" />
            <MiniStat n={String(Math.round(summary.protein ?? 0))} u="P g" />
            <MiniStat n={String(Math.round(summary.carbs ?? 0))} u="C g" />
            <MiniStat n={String(Math.round(summary.fat ?? 0))} u="F g" />
          </div>
          <button
            type="button"
            onClick={onImportAnother}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <RotateCcw className="size-3" />
            Import another
          </button>
        </div>
      ) : (
        <div className="p-4">
          <p className="text-sm font-semibold text-foreground">{summary.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Saved to your Library — open Recipes after setup to review it.
          </p>
        </div>
      )}
    </div>
  );
}

function MiniStat({ n, u }: { n: string; u: string }) {
  return (
    <div>
      <div className="text-[15px] font-bold text-foreground tabular-nums tracking-tight">
        {n}
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] mt-0.5 text-muted-foreground">
        {u}
      </div>
    </div>
  );
}
