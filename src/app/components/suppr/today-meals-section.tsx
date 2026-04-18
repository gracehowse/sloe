"use client";

import * as React from "react";
import { toast } from "sonner";
import { Icons } from "../ui/icons";
import { IconBox } from "../ui/icon-box";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import NutritionSourceBadge from "../../../components/NutritionSourceBadge";
import type { UserTier } from "../../../types/recipe";
import { distributeMealBudget } from "../../../lib/nutrition/mealBudget";
import {
  isMealPlanPlaceholderLikeTitle,
  scaledMacro,
} from "../../../lib/nutrition/portionMultiplier";
import { normalizeJournalSlotName } from "../../../lib/nutrition/journalSlot";
import { DestructiveConfirmDialog } from "./destructive-confirm-dialog";

/**
 * TodayMealsSection — per-slot meal list + empty-state plan log.
 *
 * Extracted from `NutritionTracker.tsx` (audit H3, 2026-04-18). The
 * section owns no data — it reads what the host passes and fires
 * callbacks back up. State that crosses cards (collapsed slots, copy
 * target id, duplicate-day visibility, save-combo dialog) stays in
 * the composition root.
 */

export type TodayMealSectionMeal = {
  id: string;
  name: string;
  recipeTitle: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portionMultiplier?: number;
  source?: string | null;
};

export type TodayMealSectionPlanEntry = {
  name: string;
  recipeTitle: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  isPlaceholder?: boolean;
};

export interface TodayMealsSectionProps {
  mealsGrouped: Array<{ name: string; meals: TodayMealSectionMeal[] }>;
  mealsForSelectedDate: TodayMealSectionMeal[];
  effectiveCalorieTarget: number;
  fiberTarget: number;
  collapsedSlots: Set<string>;
  onToggleSlot: (name: string) => void;
  onOpenAddForSlot: (slot: string) => void;
  onOpenSaveCombo: (slot: string) => void;
  onOpenDuplicateDay: () => void;
  onRequestCopyMeal: (mealId: string) => void;
  onDeleteMeal: (mealId: string, recipeTitle: string) => void;
  mealPlanFirstDay: { meals: TodayMealSectionPlanEntry[] } | null;
  onLogPlanMeal: (meal: TodayMealSectionPlanEntry) => void;
  onOpenAddCustom: () => void;
  onOpenPhotoLog: () => void;
  onOpenVoiceLog: () => void;
  userTier: UserTier;
}

function getMealIcon(name: string): { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; tone: "warning" | "success" | "primary" | "fat" } {
  if (name === "Breakfast") return { icon: Icons.breakfast as React.ComponentType<React.SVGProps<SVGSVGElement>>, tone: "warning" };
  if (name === "Lunch") return { icon: Icons.lunch as React.ComponentType<React.SVGProps<SVGSVGElement>>, tone: "success" };
  if (name === "Dinner") return { icon: Icons.dinner as React.ComponentType<React.SVGProps<SVGSVGElement>>, tone: "primary" };
  if (name === "Snacks") return { icon: Icons.snack as React.ComponentType<React.SVGProps<SVGSVGElement>>, tone: "fat" };
  return { icon: Icons.add as React.ComponentType<React.SVGProps<SVGSVGElement>>, tone: "primary" };
}

export function TodayMealsSection({
  mealsGrouped,
  mealsForSelectedDate,
  effectiveCalorieTarget,
  fiberTarget,
  collapsedSlots,
  onToggleSlot,
  onOpenAddForSlot,
  onOpenSaveCombo,
  onOpenDuplicateDay,
  onRequestCopyMeal,
  onDeleteMeal,
  mealPlanFirstDay,
  onLogPlanMeal,
  onOpenAddCustom,
  onOpenPhotoLog,
  onOpenVoiceLog,
  userTier,
}: TodayMealsSectionProps) {
  // Audit M7 (2026-04-18) — themed destructive-confirm dialog
  // replacing the prior `window.confirm` on the Delete overflow item.
  const [deleteCandidate, setDeleteCandidate] = React.useState<
    { id: string; recipeTitle: string } | null
  >(null);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Meals</h3>
        {mealsForSelectedDate.length > 0 && (
          <button
            type="button"
            onClick={onOpenDuplicateDay}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-md border border-border bg-card"
            aria-label="Duplicate this day to another day"
          >
            <Icons.copyPlus className="w-3.5 h-3.5" />
            Duplicate day…
          </button>
        )}
      </div>
      <div className="rounded-card bg-card border border-border overflow-hidden">
        {mealsGrouped.map(({ name: sectionName, meals: sectionMeals }) => {
          // Preserve the distributeMealBudget call so any downstream
          // analytics side-effects remain identical. Result is unused
          // today but this mirrors the pre-H3 source exactly.
          const consumed: Record<string, number> = {};
          for (const gm of mealsGrouped) {
            const cals = gm.meals.reduce((a, m) => a + scaledMacro(m.calories, m.portionMultiplier ?? 1), 0);
            if (cals > 0) consumed[gm.name] = cals;
          }
          distributeMealBudget(effectiveCalorieTarget, fiberTarget, consumed);

          const mealIconInfo = getMealIcon(sectionName);

          return (
            <div key={sectionName} className="border-b border-border last:border-b-0">
              {/* Meal header row */}
              <div
                className="flex items-center gap-2.5 px-3.5 py-3 border-b border-border cursor-pointer select-none"
                onClick={() => onToggleSlot(sectionName)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggleSlot(sectionName);
                  }
                }}
                aria-expanded={!collapsedSlots.has(sectionName)}
              >
                <IconBox size="sm" tone={mealIconInfo.tone}>
                  <mealIconInfo.icon />
                </IconBox>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">{sectionName}</p>
                  <p className="text-[11px] text-muted-foreground">{sectionMeals.length} item{sectionMeals.length !== 1 ? "s" : ""}</p>
                </div>
                <span className="text-sm font-bold text-foreground tabular-nums">
                  {Math.round(sectionMeals.reduce((sum, m) => sum + scaledMacro(m.calories, m.portionMultiplier ?? 1), 0))}
                </span>
                <span className="text-[10px] text-muted-foreground mr-1">kcal</span>
                {/* Batch 2.6 — "Save these as a meal" when the slot has 2+ items. */}
                {sectionMeals.length >= 2 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenSaveCombo(sectionName);
                    }}
                    className="mr-1 inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/40"
                    aria-label={`Save ${sectionName} items as a meal combo`}
                    title="Save these as a meal"
                  >
                    Save combo
                  </button>
                )}
                <Icons.down className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${collapsedSlots.has(sectionName) ? "-rotate-90" : ""}`} />
              </div>

              {/* Expanded meal items */}
              {!collapsedSlots.has(sectionName) && sectionMeals.length > 0 && (
                <div>
                  {sectionMeals.map((meal) => (
                    <div
                      key={meal.id}
                      className="flex items-center justify-between px-4 py-2.5 border-b border-border/10"
                      style={{ paddingLeft: 56 }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                        <span className="text-xs text-foreground truncate">{meal.recipeTitle}</span>
                        {meal.source && <NutritionSourceBadge source={meal.source} />}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-xs text-muted-foreground tabular-nums">{Math.round(meal.calories)}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-foreground px-1"
                              aria-label={`More actions for ${meal.recipeTitle}`}
                            >
                              <Icons.more className="w-3.5 h-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => onRequestCopyMeal(meal.id)}>
                              Copy to another day…
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                setDeleteCandidate({ id: meal.id, recipeTitle: meal.recipeTitle });
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty meal: dimmed slot with "Tap to add" matching mobile */}
              {!collapsedSlots.has(sectionName) && sectionMeals.length === 0 && (
                <button
                  type="button"
                  onClick={() => onOpenAddForSlot(sectionName)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-3 opacity-45 hover:opacity-70 transition-opacity"
                >
                  <span className="size-7 rounded-lg bg-muted flex items-center justify-center">
                    <Icons.add className="size-3.5 text-muted-foreground" />
                  </span>
                  <span className="text-xs text-muted-foreground">Tap to add</span>
                </button>
              )}
            </div>
          );
        })}

        {mealsForSelectedDate.length === 0 && (
          <div className="py-8">
            {/* Quick-log from plan if plan exists for day 1 */}
            {mealPlanFirstDay &&
            mealPlanFirstDay.meals.filter(
              (m) => !isMealPlanPlaceholderLikeTitle(m.recipeTitle, { isPlaceholder: m.isPlaceholder }),
            ).length > 0 ? (
              <div className="mb-6">
                <p className="text-sm font-medium text-muted-foreground mb-3 text-center">Log from today&apos;s plan</p>
                <div className="space-y-2">
                  {mealPlanFirstDay.meals
                    .filter(
                      (m) => !isMealPlanPlaceholderLikeTitle(m.recipeTitle, { isPlaceholder: m.isPlaceholder }),
                    )
                    .map((meal, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          onLogPlanMeal(meal);
                          toast.success(`Logged ${meal.recipeTitle}`);
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors text-left"
                      >
                        <div>
                          <span className="text-xs font-medium text-primary">{normalizeJournalSlotName(meal.name)}</span>
                          <p className="text-sm font-medium text-foreground">{meal.recipeTitle}</p>
                        </div>
                        <span className="text-xs font-mono tabular-nums text-muted-foreground">{Math.round(meal.calories)} kcal</span>
                      </button>
                    ))}
                </div>
              </div>
            ) : null}
            <div className="text-center">
              <p className="mb-4 text-muted-foreground">
                {mealPlanFirstDay ? "Or add a custom meal" : "No meals logged on this day"}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onOpenAddCustom}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-pm hover:bg-primary/90"
                >
                  <Icons.add className="h-5 w-5" />
                  {mealPlanFirstDay ? "Add custom meal" : "Log your first meal"}
                </button>
                <button
                  type="button"
                  onClick={onOpenPhotoLog}
                  aria-label={
                    userTier === "pro"
                      ? "AI photo log — snap a meal for nutrition estimates"
                      : "AI photo log — Pro feature"
                  }
                  title="Photos are sent to our servers and processed with AI to estimate nutrition. Pro only."
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/30 px-5 py-3 font-semibold text-primary hover:bg-primary/5 transition-colors"
                >
                  <Icons.camera className="h-5 w-5" />
                  Photo log
                  {userTier !== "pro" && <Icons.lock className="h-3.5 w-3.5" aria-hidden />}
                </button>
                <button
                  type="button"
                  onClick={onOpenVoiceLog}
                  aria-label={userTier === "pro" ? "Record voice log" : "Voice log — Pro feature"}
                  title="Voice and typed descriptions are processed with AI on our servers. Pro only."
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/30 px-5 py-3 font-semibold text-primary hover:bg-primary/5 transition-colors"
                >
                  <Icons.mic className="h-5 w-5" />
                  Voice log
                  {userTier !== "pro" && <Icons.lock className="h-3.5 w-3.5" aria-hidden />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <DestructiveConfirmDialog
        open={deleteCandidate != null}
        onOpenChange={(o) => {
          if (!o) setDeleteCandidate(null);
        }}
        title={
          deleteCandidate ? `Remove "${deleteCandidate.recipeTitle}"?` : "Remove meal?"
        }
        description="This removes the meal from today's log."
        confirmLabel="Remove"
        onConfirm={async () => {
          if (deleteCandidate) onDeleteMeal(deleteCandidate.id, deleteCandidate.recipeTitle);
        }}
      />
    </div>
  );
}
