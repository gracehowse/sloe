"use client";

/**
 * PlanImportReview — the review step of the web Plan-Import surface (ENG-696,
 * ENG-650/651). Editable plan name + per-slot rows with the dual-kcal trust
 * display (author vs Sloe calc), the avg-vs-target assessment panel, nutrition
 * mode + toggles, and the activate/save-template dialog. Presentation only —
 * all state + the commit handler come from `usePlanImport`.
 */
import { ArrowLeft } from "lucide-react";
import { SupprButton } from "../suppr/suppr-button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog.tsx";
import type {
  PlanImportCompiledSlot,
  PlanImportNutritionMode,
  PlanImportParseResult,
} from "../../../lib/planning/planImport/types.ts";

interface PlanImportReviewProps {
  parseResult: PlanImportParseResult;
  displaySlots: PlanImportCompiledSlot[];
  avgKcal: number;
  targetKcal: number;
  /** ENG-1422 — flag gate for the excluded-line advisory (default-ON). */
  showExcludedLines: boolean;
  planName: string;
  setPlanName: (v: string) => void;
  nutritionMode: PlanImportNutritionMode;
  setNutritionMode: (m: PlanImportNutritionMode) => void;
  importToLibrary: boolean;
  setImportToLibrary: (v: boolean) => void;
  autoRebalance: boolean;
  setAutoRebalance: (v: boolean) => void;
  committing: boolean;
  activateOpen: boolean;
  setActivateOpen: (v: boolean) => void;
  onBack: () => void;
  onCommit: (activate: boolean) => void;
}

export function PlanImportReview({
  parseResult,
  displaySlots,
  avgKcal,
  targetKcal,
  showExcludedLines,
  planName,
  setPlanName,
  nutritionMode,
  setNutritionMode,
  importToLibrary,
  setImportToLibrary,
  autoRebalance,
  setAutoRebalance,
  committing,
  activateOpen,
  setActivateOpen,
  onBack,
  onCommit,
}: PlanImportReviewProps) {
  const excludedCount = parseResult.stats.excludedLineCount ?? 0;
  return (
    <div data-testid="plan-import-review" className="product-shell py-pm-6 space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
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
          Plan averages <span className="font-semibold">{avgKcal} kcal/day</span> (Sloe calc) · Your
          target <span className="font-semibold">{targetKcal}</span>
        </p>
        <p className="text-[13px] text-muted-foreground mt-2">
          {parseResult.stats.recipeCount} recipes · {parseResult.stats.slotCount} slots ·{" "}
          {parseResult.stats.blockedCount} blocked
        </p>
        {/* ENG-1422 — the tier alone hid how incomplete the totals are (excluded
            lines RAISED the accepted-average). Surface the count so the user sees
            what's missing before importing. */}
        {showExcludedLines && excludedCount > 0 ? (
          <p
            data-testid="plan-import-excluded-note"
            className="text-[13px] text-warning-solid mt-2 font-medium"
          >
            {excludedCount} low-confidence {excludedCount === 1 ? "line" : "lines"} left out of these
            totals — review before importing.
          </p>
        ) : null}
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
          const shownKcal = nutritionMode === "author" && authorKcal ? authorKcal : supprKcal;
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
                    Sloe-calc figure exist, show the one NOT currently in use
                    so the user can see the gap they're trusting. */}
                {authorKcal != null && authorKcal !== supprKcal ? (
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {nutritionMode === "author" ? `Sloe ${supprKcal}` : `author ${authorKcal}`}
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
              onClick={() => onCommit(true)}
              data-testid="plan-import-activate"
            >
              Activate imported plan
            </SupprButton>
            <SupprButton
              variant="ghost"
              className="w-full"
              disabled={committing}
              onClick={() => onCommit(false)}
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

export default PlanImportReview;
