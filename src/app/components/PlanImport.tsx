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
 * Thin composition shell (400-line screen-file rule, ENG-621): state +
 * handlers live in `./plan-import/usePlanImport`; the review step is the
 * `./plan-import/PlanImportReview` child.
 *
 * Sub-issues delivered: ENG-648 (paste + plan-name → parse), ENG-650 (review
 * + dual-kcal rows), ENG-651 (assessment + nutrition-mode actions). ENG-647
 * (Generate-vs-Import entry) lives in `MealPlanner.tsx`; the ENG-653
 * Imported-plans Library chip lives in `Library.tsx`.
 *
 * PDF / photo import (the mobile `extract` step) is intentionally NOT in the
 * web spine for this pass — web ships the paste path to parity first; web
 * file sources are tracked under the Plan Import Sprint 2 (PDF + image)
 * project. See docs/planning/plan-import-linear-program.md "Web parity".
 */
import { ArrowLeft, RefreshCw } from "lucide-react";
import { SupprButton } from "./suppr/suppr-button.tsx";
import { PlanImportReview } from "./plan-import/PlanImportReview.tsx";
import { usePlanImport } from "./plan-import/usePlanImport.ts";

interface PlanImportProps {
  /** Return to the Plan surface. */
  onClose: () => void;
}

export function PlanImport({ onClose }: PlanImportProps) {
  const s = usePlanImport(onClose);

  if (s.step === "parsing") {
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

  if (s.step === "review" && s.parseResult) {
    return (
      <PlanImportReview
        parseResult={s.parseResult}
        displaySlots={s.displaySlots}
        avgKcal={s.avgKcal}
        targetKcal={s.targetKcal}
        planName={s.planName}
        setPlanName={s.setPlanName}
        nutritionMode={s.nutritionMode}
        setNutritionMode={s.setNutritionMode}
        importToLibrary={s.importToLibrary}
        setImportToLibrary={s.setImportToLibrary}
        autoRebalance={s.autoRebalance}
        setAutoRebalance={s.setAutoRebalance}
        committing={s.committing}
        activateOpen={s.activateOpen}
        setActivateOpen={s.setActivateOpen}
        onBack={() => s.setStep("paste")}
        onCommit={(activate) => void s.finishCommit(activate)}
      />
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
          value={s.pasteText}
          onChange={(e) => s.setPasteText(e.target.value)}
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
          value={s.planName}
          onChange={(e) => s.setPlanName(e.target.value)}
          className="w-full rounded-[var(--radius-card)] border border-border bg-card px-4 py-3 text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {s.parseError ? (
        <p role="alert" data-testid="plan-import-error" className="text-[13px] text-destructive">
          {s.parseError}
        </p>
      ) : null}

      <SupprButton
        variant="primary"
        className="w-full"
        onClick={() => void s.runParse()}
        data-testid="plan-import-parse"
      >
        Parse plan
      </SupprButton>
    </div>
  );
}

export default PlanImport;
