"use client";

/**
 * PlanImport — web Plan-Import surface (ENG-696, parity with the mobile flow
 * at `apps/mobile/app/plan-import.tsx`).
 *
 * Spine: paste → parse → review (editable rows + dual-kcal trust display) →
 * assessment (avg vs target) → commit (template only / activate). Reuses the
 * SAME server route (`/api/plan-import/parse`) and the SAME shared commit
 * pipeline (`@/lib/planning/planImport/commitPlanImport`) the mobile flow
 * calls — the pipeline is not forked.
 *
 * Sub-issues delivered here:
 *   - ENG-648 — paste sheet + plan-name field → parse route.
 *   - ENG-650 — review screen: editable plan name + per-slot dual-kcal rows.
 *   - ENG-651 — assessment panel: avg vs target + nutrition-mode actions.
 * ENG-647 (Generate-vs-Import entry point) lives in `MealPlanner.tsx`; the
 * ENG-653 Imported-plans Library chip lives in `Library.tsx`.
 *
 * PDF / photo import (the mobile `extract` step) is intentionally NOT in the
 * web spine for this pass — web ships the paste path to parity first. Tracked
 * for the web file-source follow-up under the Plan Import initiative (Sprint 2
 * — PDF + image); see docs/product/plan-import.md.
 */
import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useAppData } from "../../context/AppDataContext.tsx";
import { supabase } from "../../lib/supabase/browserClient.ts";
import { track } from "../../lib/analytics/track.ts";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { SupprButton } from "./suppr/suppr-button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog.tsx";
import { toast } from "sonner";
import { commitPlanImport } from "../../lib/planning/planImport/commitPlanImport.ts";
import { rebalanceImportedPlanDays } from "../../lib/planning/planImport/rebalanceImportedPlan.ts";
import { DEFAULT_PLANNER_BANDS } from "../../lib/nutrition/mealPlanAlgo.ts";
import { MEAL_PREP_WEEK1_PASTE } from "../../lib/planning/planImport/fixtures/mealPrepWeek1.ts";
import type {
  PlanImportCompiledSlot,
  PlanImportNutritionMode,
  PlanImportParseResult,
  PlanImportVerifiedRecipe,
} from "../../lib/planning/planImport/types.ts";

type Step = "paste" | "parsing" | "review";

interface PlanImportProps {
  /** Return to the Plan surface. */
  onClose: () => void;
}

type ParseApiResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  planName?: string;
  recipes?: PlanImportVerifiedRecipe[];
  slots?: PlanImportCompiledSlot[];
  stats?: PlanImportParseResult["stats"];
};

const DEFAULT_PLAN_NAME = "Meal prep — Week 1";

export function PlanImport({ onClose }: PlanImportProps) {
  const { userId, nutritionTargets, setMealPlan } = useAppData();

  const [step, setStep] = useState<Step>("paste");
  const [pasteText, setPasteText] = useState(MEAL_PREP_WEEK1_PASTE);
  const [planName, setPlanName] = useState(DEFAULT_PLAN_NAME);
  const [parseResult, setParseResult] = useState<PlanImportParseResult | null>(null);
  const [slots, setSlots] = useState<PlanImportCompiledSlot[]>([]);
  const [recipes, setRecipes] = useState<PlanImportVerifiedRecipe[]>([]);
  const [nutritionMode, setNutritionMode] = useState<PlanImportNutritionMode>("match");
  const [importToLibrary, setImportToLibrary] = useState(true);
  const [autoRebalance, setAutoRebalance] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const targetKcal = nutritionTargets.calories;

  const runParse = useCallback(async () => {
    if (!userId) {
      toast.error("Sign in to import a meal plan.");
      return;
    }
    const text = pasteText.trim();
    if (!text) {
      setParseError("Paste your weekly plan and recipe sections first.");
      return;
    }
    setParseError(null);
    setStep("parsing");
    try {
      const res = await fetch("/api/plan-import/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text, planName }),
      });
      let json: ParseApiResponse;
      try {
        json = (await res.json()) as ParseApiResponse;
      } catch {
        setParseError(
          res.status === 503
            ? "Plan import is paused right now. Try again shortly."
            : "Something went wrong reading your plan. Try again in a moment.",
        );
        setStep("paste");
        return;
      }
      if (!res.ok || !json.ok || !json.planName || !json.recipes || !json.slots || !json.stats) {
        setParseError(
          json.error === "unauthorized"
            ? "Your session expired — sign in again to import."
            : (json.message ?? "Could not parse that plan. Include recipes with ingredients or per-meal kcal."),
        );
        setStep("paste");
        return;
      }
      const result: PlanImportParseResult = {
        planName: json.planName,
        recipes: json.recipes,
        slots: json.slots,
        stats: json.stats,
      };
      setParseResult(result);
      setPlanName(result.planName);
      setRecipes(result.recipes);
      setSlots(result.slots);
      setStep("review");
    } catch {
      setParseError("Check your connection and try again.");
      setStep("paste");
    }
  }, [userId, pasteText, planName]);

  // Match mode + opt-in → scale linked-slot portions toward the user's real
  // target before display + commit. Mirror mobile, but seed the joint fitter
  // from the user's actual macro targets rather than a placeholder.
  const displaySlots = useMemo(() => {
    if (!autoRebalance || nutritionMode !== "match") return slots;
    return rebalanceImportedPlanDays({
      slots,
      mode: nutritionMode,
      targets: {
        calories: targetKcal,
        protein: nutritionTargets.protein,
        carbs: nutritionTargets.carbs,
        fat: nutritionTargets.fat,
        fiber: nutritionTargets.fiber,
        calorieBandPct: DEFAULT_PLANNER_BANDS.calorieBandPct,
        carbFatBandPct: DEFAULT_PLANNER_BANDS.carbFatBandPct,
      },
    });
  }, [slots, autoRebalance, nutritionMode, targetKcal, nutritionTargets]);

  const avgKcal = useMemo(() => {
    const byDay = new Map<number, number>();
    for (const s of displaySlots) {
      const k =
        nutritionMode === "author" && s.authorNutrition?.calories
          ? s.authorNutrition.calories
          : s.supprNutrition.calories ?? 0;
      byDay.set(s.dayIndex, (byDay.get(s.dayIndex) ?? 0) + k);
    }
    const totals = [...byDay.values()];
    return totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0;
  }, [displaySlots, nutritionMode]);

  const finishCommit = useCallback(
    async (activate: boolean) => {
      if (!userId || !parseResult) return;
      setCommitting(true);
      const res = await commitPlanImport({
        supabase,
        userId,
        planName: planName.trim() || parseResult.planName,
        recipes,
        slots: displaySlots,
        nutritionMode,
        importToLibrary,
      });
      setCommitting(false);
      setActivateOpen(false);
      if (!res.ok) {
        toast.error("Could not save", { description: res.error });
        return;
      }
      track(AnalyticsEvents.plan_template_created, {
        dayCount: res.dayPlan.length,
        slotCount: displaySlots.length,
        source: "plan_import",
      });
      if (activate) {
        setMealPlan(res.dayPlan);
        toast.success(`"${planName}" is now your active plan.`);
      } else {
        toast.success(`"${planName}" saved to templates — switch anytime from Plan.`);
      }
      onClose();
    },
    [
      userId,
      parseResult,
      planName,
      recipes,
      displaySlots,
      nutritionMode,
      importToLibrary,
      setMealPlan,
      onClose,
    ],
  );

  if (step === "parsing") {
    return (
      <div
        data-testid="plan-import-parsing"
        className="product-shell py-pm-6 flex flex-col items-center justify-center min-h-[60vh] text-center gap-3"
      >
        <RefreshCw className="size-7 animate-spin text-primary-solid" aria-hidden />
        <p className="font-[family-name:var(--font-headline)] text-[22px] text-foreground-brand">
          Building your plan…
        </p>
        <p className="text-[13px] text-muted-foreground max-w-sm">
          Recipes first — ingredients matched to Sloe — then the weekly schedule is compiled.
        </p>
      </div>
    );
  }

  if (step === "review" && parseResult) {
    return (
      <div data-testid="plan-import-review" className="product-shell py-pm-6 space-y-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStep("paste")}
            aria-label="Back to paste"
            className="rounded-full p-2 text-muted-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          <h1 className="font-[family-name:var(--font-headline)] text-[28px] text-foreground-brand">
            Review import
          </h1>
        </div>

        {/* Assessment panel (ENG-651): avg vs target + the parse stats. */}
        <div
          data-testid="plan-import-assessment"
          className="bg-card border border-border rounded-[var(--radius-card-lg)] p-5"
        >
          <p className="text-[15px] text-foreground leading-relaxed">
            Plan averages{" "}
            <span className="font-semibold">{avgKcal} kcal/day</span> (Sloe calc) · Your target{" "}
            <span className="font-semibold">{targetKcal}</span>
          </p>
          <p className="text-[13px] text-muted-foreground mt-2">
            {parseResult.stats.recipeCount} recipes · {parseResult.stats.slotCount} slots ·{" "}
            {parseResult.stats.blockedCount} blocked
          </p>
        </div>

        {/* Nutrition handling — author's numbers vs match & verify. */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Nutrition handling
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(["author", "match"] as const).map((mode) => {
              const active = nutritionMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  data-testid={`plan-import-mode-${mode}`}
                  onClick={() => setNutritionMode(mode)}
                  aria-pressed={active}
                  className={[
                    "rounded-[var(--radius-card)] px-4 py-3 text-[13px] font-semibold transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    active
                      ? "bg-primary-soft text-primary-solid"
                      : "bg-card border border-border text-muted-foreground hover:bg-muted/60",
                  ].join(" ")}
                >
                  {mode === "author" ? "Author's numbers" : "Match & verify"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Toggles — import-to-library + (match-only) auto-rebalance. */}
        <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
          <span className="text-[15px] font-medium text-foreground">Import all recipes to Library</span>
          <input
            type="checkbox"
            data-testid="plan-import-tolibrary"
            checked={importToLibrary}
            onChange={(e) => setImportToLibrary(e.target.checked)}
            className="size-5 rounded accent-[var(--primary-solid)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>
        {nutritionMode === "match" ? (
          <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
            <span className="text-[15px] font-medium text-foreground">Auto-rebalance portions</span>
            <input
              type="checkbox"
              data-testid="plan-import-rebalance"
              checked={autoRebalance}
              onChange={(e) => setAutoRebalance(e.target.checked)}
              className="size-5 rounded accent-[var(--primary-solid)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
        ) : null}

        {/* Editable plan name (ENG-650). */}
        <div className="space-y-2">
          <label
            htmlFor="plan-import-name"
            className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
          >
            Plan name
          </label>
          <input
            id="plan-import-name"
            data-testid="plan-import-name"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            className="w-full rounded-[var(--radius-card)] border border-border bg-card px-4 py-3 text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Per-slot rows with dual-kcal trust display (ENG-650). */}
        <div className="bg-card border border-border rounded-[var(--radius-card-lg)] divide-y divide-border">
          {displaySlots.map((slot, idx) => {
            const supprKcal = slot.supprNutrition.calories ?? 0;
            const authorKcal = slot.authorNutrition?.calories ?? null;
            const shownKcal =
              nutritionMode === "author" && authorKcal ? authorKcal : supprKcal;
            return (
              <div
                key={`${slot.dayIndex}-${slot.slot}-${idx}`}
                data-testid="plan-import-slot-row"
                className="flex items-start gap-3 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-foreground truncate">{slot.title}</p>
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    {slot.dayLabel} · {slot.slot}
                    {slot.linkStatus === "blocked" ? " · needs recipe" : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[18px] font-bold text-foreground tabular-nums">{shownKcal}</p>
                  {/* Dual-kcal trust line: when both an author figure and a
                      Sloe-calc figure exist, show the one NOT currently in
                      use so the user can see the gap they're trusting. */}
                  {authorKcal != null && authorKcal !== supprKcal ? (
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {nutritionMode === "author"
                        ? `Sloe ${supprKcal}`
                        : `author ${authorKcal}`}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Single filled CTA per screen → Save (opens activate dialog). */}
        <SupprButton
          variant="primary"
          className="w-full"
          loading={committing}
          onClick={() => setActivateOpen(true)}
          data-testid="plan-import-save"
        >
          Save as template
        </SupprButton>

        <Dialog open={activateOpen} onOpenChange={(o) => !committing && setActivateOpen(o)}>
          <DialogContent data-testid="plan-import-activate-dialog">
            <DialogHeader>
              <DialogTitle>Activate imported plan?</DialogTitle>
              <DialogDescription>
                Save as a template and optionally replace your current week.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <SupprButton
                variant="primary"
                className="w-full"
                loading={committing}
                onClick={() => void finishCommit(true)}
                data-testid="plan-import-activate"
              >
                Activate imported plan
              </SupprButton>
              <SupprButton
                variant="ghost"
                className="w-full"
                disabled={committing}
                onClick={() => void finishCommit(false)}
                data-testid="plan-import-template-only"
              >
                Save template only
              </SupprButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Paste step (ENG-648).
  return (
    <div data-testid="plan-import-paste" className="product-shell py-pm-6 space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to plan"
          className="rounded-full p-2 text-muted-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <h1 className="font-[family-name:var(--font-headline)] text-[28px] text-foreground-brand">
          Import meal plan
        </h1>
      </div>
      <p className="text-[15px] text-muted-foreground leading-relaxed">
        Paste a weekly plan and its recipes. Each meal needs recipes with ingredients or a per-meal
        kcal figure so Sloe can verify the numbers.
      </p>

      <div className="bg-primary-soft/40 border border-primary-soft rounded-[var(--radius-card-lg)] p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-primary-solid">
          What works
        </p>
        <p className="text-[13px] text-muted-foreground">Meal-prep paste — batch recipes with ingredients</p>
        <p className="text-[13px] text-muted-foreground">Coach plan — schedule + recipe appendix</p>
        <p className="text-[13px] text-muted-foreground">Program copy — week grid + recipe kcal panels</p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="plan-import-paste-field"
          className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
        >
          Plan + recipes
        </label>
        <textarea
          id="plan-import-paste-field"
          data-testid="plan-import-paste-field"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={10}
          spellCheck={false}
          className="w-full rounded-[var(--radius-card)] border border-border bg-card px-4 py-3 text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y min-h-[200px]"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="plan-import-name-paste"
          className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
        >
          Plan name
        </label>
        <input
          id="plan-import-name-paste"
          data-testid="plan-import-name-paste"
          value={planName}
          onChange={(e) => setPlanName(e.target.value)}
          className="w-full rounded-[var(--radius-card)] border border-border bg-card px-4 py-3 text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {parseError ? (
        <p role="alert" data-testid="plan-import-error" className="text-[13px] text-destructive">
          {parseError}
        </p>
      ) : null}

      <SupprButton
        variant="primary"
        className="w-full"
        onClick={() => void runParse()}
        data-testid="plan-import-parse"
      >
        Parse plan
      </SupprButton>
    </div>
  );
}

export default PlanImport;
