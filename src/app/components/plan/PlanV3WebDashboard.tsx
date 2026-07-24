"use client";

import * as React from "react";

import { ALL_MEAL_SLOTS } from "@/lib/nutrition/mealPlanAlgo";
import { isFeatureEnabled } from "@/lib/analytics/track";
import { formatQualifiedKcal } from "@/lib/nutrition/formatMacro";
import { isPlanWeekEmpty, type PlanWeekVerdict } from "@/lib/planning/planWeekStatus";
import {
  isPlanMealCooked,
  journalEntriesForPlanDate,
  type PlanJournalByDay,
} from "@/lib/planning/planCookedMeals";
import type { DayPlan } from "@/types/recipe";
import { PlanHeaderV3 } from "./PlanHeaderV3";
import { PlanMealCardV3 } from "./PlanMealCardV3";
import { PlanEmptySlotV3 } from "./PlanEmptySlotV3";
import { PlanEmptyWeekCard } from "./PlanEmptyWeekCard";
import {
  PlanHouseholdBannerV3,
  type PlanHouseholdBannerV3Props,
} from "./PlanHouseholdBannerV3";
import { PlanGhostWeekGrid } from "../suppr/plan-empty-week-grid";
import { PlanV3WebRail } from "./PlanV3WebRail";
import {
  WEEKDAY_LONG,
  useOpenSlots,
  useWeekStats,
  type WeekStat,
} from "./usePlanV3WebDashboardStats";

/**
 * PlanV3WebDashboard — the Sloe v3 Plan DESKTOP dashboard (ENG-1225 gap #13).
 *
 * The web Plan v3 column ({@link PlanV3Surface}) is the phone design; on a wide
 * screen it leaves the page empty either side. This is the prototype's desktop
 * Plan (`docs/ux/redesign/v3/Sloe-App.html` `WebPlan` ~L7581–7708): a two-column
 * `w-grid` — LEFT = the whole week stacked (each day a header + a row of meal
 * cards), RIGHT rail = a grounded "This week" insight card + a "Shopping list"
 * card — topped by the shared verdict header, a week-health stat strip, and the
 * household banner. `PlanV3Connected` renders this on `md+` and keeps the phone
 * column below `md`. Behind `sloe_v3_plan` (host-gated).
 *
 * Data is real: the insight rows derive from the actual plan (open slots, week
 * completeness) and the shopping card shows the live item/serving counts — no
 * fabricated suggestions. Web mirror has no mobile twin (mobile is phone-only).
 */
export interface PlanV3WebDashboardProps {
  plan: DayPlan[];
  targetKcal: number;
  weekDates: Date[];
  weekLabel: string;
  verdict: PlanWeekVerdict | null;
  household: Omit<PlanHouseholdBannerV3Props, "onPress"> | null;
  onGenerate: () => void;
  isGenerating?: boolean;
  onAdjust: () => void;
  onTemplates: () => void;
  onOpenHousehold: () => void;
  onOpenMeal: (dayIndex: number, slotIndex: number) => void;
  onAddToSlot: (dayIndex: number, slotIndex: number) => void;
  onOpenMealOptions?: (dayIndex: number, slotIndex: number) => void;
  shoppingItemCount: number;
  servingCount: number;
  onOpenShopping: () => void;
  onOpenBatchCook: () => void;
  batchCookSubtitle: string;
  nutritionByDay?: PlanJournalByDay;
}

function StatStrip({ stats }: { stats: WeekStat[] }) {
  return (
    // Nested stat band inside the Plan dashboard — 12px inner standard
    // (12-inside-24 concentric, card-grammar ruling ENG-1498).
    <div className="mt-4 grid grid-cols-4 gap-2 rounded-[12px] border border-border bg-card p-3">
      {stats.map((s) => (
        <div key={s.label} className="text-center">
          <div className="text-[18px] font-semibold tabular-nums text-foreground">
            {s.value}
          </div>
          <div className="mt-0.5 text-[11px] text-foreground-tertiary">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PlanV3WebDashboard({
  plan,
  targetKcal,
  weekDates,
  weekLabel,
  verdict,
  household,
  onGenerate,
  isGenerating = false,
  onAdjust,
  onTemplates,
  onOpenHousehold,
  onOpenMeal,
  onAddToSlot,
  onOpenMealOptions,
  shoppingItemCount,
  servingCount,
  onOpenShopping,
  onOpenBatchCook,
  batchCookSubtitle,
  nutritionByDay,
}: PlanV3WebDashboardProps) {
  const stats = useWeekStats(plan, targetKcal);
  const openDays = useOpenSlots(plan, weekDates);

  // ENG-1547 — law 3 (ENG-1372): a week with nothing planned yet shows NO
  // verdict ("0 of 7 days on target" is derived noise on an empty week, and it
  // duplicates the 0/7 stat below). Mobile's PlanV3Surface already gates
  // this; the desktop dashboard never did. Same predicate + flag as mobile.
  const weekIsEmpty =
    isFeatureEnabled("empty_state_grammar_v1") &&
    isPlanWeekEmpty(
      plan.map((dp) =>
        dp.meals.map((m, j) => ({
          slot: ALL_MEAL_SLOTS[j] ?? "Snacks",
          kcal: m.calories,
          empty: m.isPlaceholder,
        })),
      ),
    );

  // Design-consistency pass 2026-07-24. The desktop empty Plan was the worst
  // instance of the problem: a top-anchored invitation card followed by ~700px
  // of nothing, with no picture of what "Generate this week" produces. The
  // ghosted week draws that shape at full width; the header's Sparkles chip
  // stands down because the card's filled CTA already fires `onGenerate`.
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");
  // The slots the generator will actually fill — the plan's own slot count.
  const ghostSlots = React.useMemo(
    () => ALL_MEAL_SLOTS.slice(0, Math.max(1, plan[0]?.meals.length ?? 3)),
    [plan],
  );
  return (
    <div>
      <PlanHeaderV3
        dateRangeLabel={weekLabel}
        verdict={weekIsEmpty ? null : verdict}
        onGenerate={onGenerate}
        onAdjust={onAdjust}
        onTemplates={onTemplates}
        showGenerate={!(unifiedChrome && weekIsEmpty)}
      />
      {!weekIsEmpty ? <StatStrip stats={stats} /> : null}
      {household ? (
        <div className="mt-4">
          <PlanHouseholdBannerV3 {...household} onPress={onOpenHousehold} />
        </div>
      ) : null}

      {weekIsEmpty ? (
        <>
          <PlanEmptyWeekCard
            onGenerate={onGenerate}
            isGenerating={isGenerating}
            onAddMealsAsYouGo={() => onAddToSlot(0, 0)}
          />
          {unifiedChrome ? (
            <PlanGhostWeekGrid weekDates={weekDates} slots={ghostSlots} />
          ) : null}
        </>
      ) : (
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Left: the whole week stacked — each day a header + its meal cards. */}
        <div className="space-y-6">
          {weekDates.map((date, dayIndex) => {
            const day = plan[dayIndex];
            const dayKcal = Math.round(day?.totals?.calories ?? 0);
            // ENG-1417 — a day total is only as trustworthy as its least-
            // verified contributing meal; the "~" qualifier fires if ANY
            // non-placeholder meal that day is unverified.
            const dayIsFullyVerified =
              day?.meals.filter((m) => !m.isPlaceholder).every((m) => m.isVerified) ?? true;
            const dayKcalDisplay = isFeatureEnabled("kcal_trust_qualifier_v1")
              ? formatQualifiedKcal(dayKcal, dayIsFullyVerified)
              : String(dayKcal);
            return (
              <section key={dayIndex} aria-label={`${WEEKDAY_LONG[date.getDay()]} ${date.getDate()}`}>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-[15px] font-semibold text-foreground">
                    {WEEKDAY_LONG[date.getDay()] ?? "Day"} {date.getDate()}
                  </h3>
                  <span className="text-[11px] tabular-nums text-foreground-tertiary">
                    {dayKcal > 0 ? `${dayKcalDisplay} / ${targetKcal.toLocaleString()} kcal` : "—"}
                  </span>
                </div>
                {ALL_MEAL_SLOTS.map((slot, slotIndex) => {
                  const meal = day?.meals[slotIndex];
                  const logged = journalEntriesForPlanDate(nutritionByDay, date);
                  if (meal && !meal.isPlaceholder) {
                    const cooked = isPlanMealCooked(
                      {
                        recipeId: meal.recipeId,
                        recipeTitle: meal.recipeTitle || meal.name,
                        isPlaceholder: meal.isPlaceholder,
                      },
                      logged,
                    );
                    return (
                      <PlanMealCardV3
                        key={slot}
                        slot={slot}
                        name={meal.recipeTitle || meal.name}
                        kcal={Math.round(meal.calories)}
                        isVerified={meal.isVerified}
                        isLocked={meal.isLocked}
                        isCooked={cooked}
                        onPress={() => onOpenMeal(dayIndex, slotIndex)}
                        onOpenOptions={
                          onOpenMealOptions
                            ? () => onOpenMealOptions(dayIndex, slotIndex)
                            : undefined
                        }
                      />
                    );
                  }
                  return (
                    <PlanEmptySlotV3
                      key={slot}
                      slot={slot}
                      onPress={() => onAddToSlot(dayIndex, slotIndex)}
                    />
                  );
                })}
              </section>
            );
          })}
        </div>

        {/* Right rail: grounded insight + batch cook + shopping. */}
        <PlanV3WebRail
          openDays={openDays}
          onGenerate={onGenerate}
          batchCookSubtitle={batchCookSubtitle}
          onOpenBatchCook={onOpenBatchCook}
          shoppingItemCount={shoppingItemCount}
          servingCount={servingCount}
          onOpenShopping={onOpenShopping}
        />
      </div>
      )}
    </div>
  );
}

export default PlanV3WebDashboard;
