"use client";

import * as React from "react";
import { Flame, ShoppingCart, Sparkles } from "lucide-react";

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
import {
  PlanHouseholdBannerV3,
  type PlanHouseholdBannerV3Props,
} from "./PlanHouseholdBannerV3";

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
const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export interface PlanV3WebDashboardProps {
  plan: DayPlan[];
  targetKcal: number;
  weekDates: Date[];
  weekLabel: string;
  verdict: PlanWeekVerdict | null;
  household: Omit<PlanHouseholdBannerV3Props, "onPress"> | null;
  onGenerate: () => void;
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

type WeekStat = { value: string; label: string };

/** Derive the week-health stat strip from the real plan (planned days, the
 *  week's average calories + protein over planned days, and the daily target). */
function useWeekStats(plan: DayPlan[], targetKcal: number): WeekStat[] {
  return React.useMemo(() => {
    const plannedDays = plan.filter((d) =>
      d.meals.some((m) => !m.isPlaceholder),
    );
    const n = plannedDays.length;
    const avg = (pick: (d: DayPlan) => number) =>
      n === 0 ? 0 : Math.round(plannedDays.reduce((s, d) => s + pick(d), 0) / n);
    return [
      { value: `${n}/7`, label: "Days planned" },
      { value: String(avg((d) => d.totals?.calories ?? 0)), label: "Avg cal" },
      { value: `${avg((d) => d.totals?.protein ?? 0)}g`, label: "Avg protein" },
      { value: String(targetKcal), label: "Daily target" },
    ];
  }, [plan, targetKcal]);
}

/** Open dinner/lunch/etc. slots, grouped into a single grounded nudge. */
function useOpenSlots(plan: DayPlan[], weekDates: Date[]) {
  return React.useMemo(() => {
    const openDays: string[] = [];
    plan.forEach((day, i) => {
      const hasOpen = day.meals.some((m) => m.isPlaceholder);
      if (hasOpen) {
        const d = weekDates[i];
        openDays.push(d ? (WEEKDAY_LONG[d.getDay()] ?? "A day") : "A day");
      }
    });
    return openDays;
  }, [plan, weekDates]);
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

function InsightCard({
  openDays,
  onGenerate,
}: {
  /** Non-empty — the card only renders when there are open slots to nudge. */
  openDays: string[];
  onGenerate: () => void;
}) {
  // A single honest, plan-derived nudge to finish the week. When the week is
  // already complete the host hides this card (the verdict header confirms the
  // success; the shopping card carries the next action) — no invented advice.
  const headline =
    openDays.length === 1
      ? `${openDays[0]} still needs a meal`
      : `${openDays.length} days still need a meal`;
  return (
    <div className="rounded-card-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full"
          style={{ backgroundColor: "var(--accent-primary-soft)" }}
          aria-hidden
        >
          <Sparkles
            className="size-3.5"
            style={{ color: "var(--primary)" }}
            strokeWidth={2}
          />
        </span>
        <h3 className="text-[13px] font-semibold text-foreground">This week</h3>
      </div>
      <p className="mt-2 text-[13px] font-semibold text-foreground">{headline}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-foreground-tertiary">
        Let Sloe fill the open slots around your targets, or add meals yourself.
      </p>
      <button
        type="button"
        onClick={onGenerate}
        className="mt-3 h-9 w-full rounded-full bg-primary text-[13px] font-semibold text-primary-foreground transition-[transform,opacity] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.99]"
      >
        Fill the open slots
      </button>
    </div>
  );
}

function BatchCookCard({
  subtitle,
  onOpenBatchCook,
}: {
  subtitle: string;
  onOpenBatchCook: () => void;
}) {
  return (
    <div className="rounded-card-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full"
          style={{ backgroundColor: "var(--background-secondary)" }}
          aria-hidden
        >
          <Flame className="size-3.5 text-foreground" strokeWidth={1.9} />
        </span>
        <h3 className="text-[13px] font-semibold text-foreground">Batch cook</h3>
      </div>
      <p className="mt-2 text-[11px] text-foreground-tertiary">{subtitle}</p>
      <button
        type="button"
        onClick={onOpenBatchCook}
        className="mt-3 h-9 w-full rounded-full border border-border bg-card text-[13px] font-semibold text-foreground transition-[background-color] hover:bg-[var(--background-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        Plan a batch
      </button>
    </div>
  );
}

function ShoppingCard({
  itemCount,
  servingCount,
  onOpenShopping,
}: {
  itemCount: number;
  servingCount: number;
  onOpenShopping: () => void;
}) {
  return (
    <div className="rounded-card-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full"
          style={{ backgroundColor: "var(--background-secondary)" }}
          aria-hidden
        >
          <ShoppingCart
            className="size-3.5 text-foreground"
            strokeWidth={1.9}
          />
        </span>
        <h3 className="text-[13px] font-semibold text-foreground">Shopping list</h3>
      </div>
      <p className="mt-2 text-[11px] text-foreground-tertiary">
        {itemCount > 0
          ? `${itemCount} item${itemCount === 1 ? "" : "s"} · for ${servingCount > 1 ? `${servingCount} people` : "you"}`
          : "Your shopping list builds from the week's recipes."}
      </p>
      <button
        type="button"
        onClick={onOpenShopping}
        className="mt-3 h-9 w-full rounded-full border border-border bg-card text-[13px] font-semibold text-foreground transition-[background-color] hover:bg-[var(--background-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        Open shopping list
      </button>
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
  // verdict ("0 of 7 days land" is derived noise on an empty week, and it
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

  return (
    <div>
      <PlanHeaderV3
        dateRangeLabel={weekLabel}
        verdict={weekIsEmpty ? null : verdict}
        onGenerate={onGenerate}
        onAdjust={onAdjust}
        onTemplates={onTemplates}
      />
      <StatStrip stats={stats} />
      {household ? (
        <div className="mt-4">
          <PlanHouseholdBannerV3 {...household} onPress={onOpenHousehold} />
        </div>
      ) : null}

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
                    {dayKcal > 0 ? `${dayKcalDisplay} / ${targetKcal} kcal` : "—"}
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

        {/* Right rail: grounded insight + shopping. Sticks while the week scrolls. */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          {openDays.length > 0 ? (
            <InsightCard openDays={openDays} onGenerate={onGenerate} />
          ) : null}
          <BatchCookCard subtitle={batchCookSubtitle} onOpenBatchCook={onOpenBatchCook} />
          <ShoppingCard
            itemCount={shoppingItemCount}
            servingCount={servingCount}
            onOpenShopping={onOpenShopping}
          />
        </aside>
      </div>
    </div>
  );
}

export default PlanV3WebDashboard;
