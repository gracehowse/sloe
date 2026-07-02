"use client";

import * as React from "react";
import { Flame, ShoppingCart, Sparkles } from "lucide-react";

import { ALL_MEAL_SLOTS } from "@/lib/nutrition/mealPlanAlgo";
import {
  computePlanDayDetail,
  computePlanDayStatus,
  type PlanDayStatus,
  type PlanWeekVerdict,
} from "@/lib/planning/planWeekStatus";
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
 * `w-grid` — LEFT = the whole week stacked (each day a CARD with a day-total
 * numeral + calorie progress bar and its meal rows), RIGHT rail = a grounded
 * "This week" insight card + a "Shopping list" card — topped by the wide
 * verdict header ("Hits your targets N of 7 days", prototype L7627), the
 * `wpweek` week-health strip (7-day target-status bars folded with the
 * summary stats, L7630–7640), and the household banner. `PlanV3Connected`
 * renders this at `lg+` and keeps the phone column below `lg`. UNGATED since
 * ENG-1303 (v3 ratified canonical under ENG-1247).
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
  /** Today (for the week-strip highlight) — injected for deterministic tests. */
  today?: Date;
}

type WeekStat = { value: string; label: string };

/**
 * Derive the week-health summary stats from the real plan (planned days, the
 * week's average calories + protein over planned days, and the daily target).
 *
 * The prototype's fourth stat ("£48 est. shop", `WebPlan` ~L7636) is
 * intentionally omitted — the data layer carries no ingredient pricing, and a
 * fabricated estimate would violate the trust posture — not a gap. The daily
 * target takes its slot so every numeral is real.
 */
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
      {
        value: avg((d) => d.totals?.calories ?? 0).toLocaleString("en-US"),
        label: "Avg kcal",
      },
      { value: `${avg((d) => d.totals?.protein ?? 0)}g`, label: "Avg protein" },
      { value: targetKcal.toLocaleString("en-US"), label: "Daily target" },
    ];
  }, [plan, targetKcal]);
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function weekStripBarStyle(status: PlanDayStatus): React.CSSProperties {
  if (status === "full") return { backgroundColor: "var(--accent-success)" };
  if (status === "part") return { backgroundColor: "var(--warning)" };
  return {
    backgroundColor: "var(--background-secondary)",
    boxShadow: "inset 0 0 0 1px var(--border-strong)",
  };
}

/**
 * WeekHealthStrip — the prototype `wpweek` (WebPlan ~L7630–7640): one card
 * folding the 7-day target-status strip (day label + full/part/empty bar,
 * today's label in the brand accent) with the summary-stat row (serif
 * numerals, hairline dividers). Statuses come from the shared
 * `computePlanDayStatus`, so the bars can never disagree with the phone
 * column's week-strip rings or the header verdict.
 */
function WeekHealthStrip({
  plan,
  weekDates,
  stats,
  today,
}: {
  plan: DayPlan[];
  weekDates: Date[];
  stats: WeekStat[];
  today?: Date;
}) {
  const now = today ?? new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  return (
    <div className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-4">
      {weekDates.map((date, i) => {
        const meals = plan[i]?.meals ?? [];
        const status = computePlanDayStatus(
          meals.map((m, j) => ({
            slot: ALL_MEAL_SLOTS[j] ?? "Snacks",
            kcal: m.calories,
            empty: m.isPlaceholder,
          })),
        );
        const isToday = isSameDay(date, now);
        return (
          <div
            key={i}
            data-testid={`plan-web-week-strip-day-${i}`}
            data-status={status}
            className="flex min-w-[30px] flex-1 flex-col items-center gap-2"
          >
            <span
              className="text-[11px] font-semibold"
              style={{
                color: isToday
                  ? "var(--primary)"
                  : "var(--foreground-tertiary)",
              }}
            >
              {WEEKDAY_SHORT[date.getDay()]}
            </span>
            <span
              aria-hidden
              className="block h-1.5 w-full rounded-full"
              style={weekStripBarStyle(status)}
            />
          </div>
        );
      })}
      <div className="ml-2 flex divide-x divide-border border-l border-border pl-2">
        {stats.map((s) => (
          <div key={s.label} className="px-3 text-center">
            <div className="font-[family-name:var(--font-headline)] text-[18px] font-medium leading-none tabular-nums text-foreground">
              {s.value}
            </div>
            <div className="mt-1 text-[11px] text-foreground-tertiary">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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
    <div className="rounded-2xl border border-border bg-card p-4">
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
    <div className="rounded-2xl border border-border bg-card p-4">
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
    <div className="rounded-2xl border border-border bg-card p-4">
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
  today,
}: PlanV3WebDashboardProps) {
  const stats = useWeekStats(plan, targetKcal);
  const openDays = useOpenSlots(plan, weekDates);

  return (
    <div>
      <PlanHeaderV3
        dateRangeLabel={weekLabel}
        verdict={verdict}
        onGenerate={onGenerate}
        onAdjust={onAdjust}
        onTemplates={onTemplates}
        wide
      />
      <WeekHealthStrip
        plan={plan}
        weekDates={weekDates}
        stats={stats}
        today={today}
      />
      {household ? (
        <div className="mt-4">
          <PlanHouseholdBannerV3 {...household} onPress={onOpenHousehold} />
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Left: the whole week stacked — each day a CARD (prototype `w-card`,
            WebPlan ~L7659): header (day name + "total / target" numeral), the
            `plan-day-bar` calorie progress bar, then the slot rows. Flat
            bordered card — the one treatment every card on this surface uses
            (right-rail siblings included). */}
        <div className="space-y-5">
          {weekDates.map((date, dayIndex) => {
            const day = plan[dayIndex];
            const dayKcal = Math.round(day?.totals?.calories ?? 0);
            const plannedCount =
              day?.meals.filter((m) => !m.isPlaceholder).length ?? 0;
            // Shared thresholds (planWeekStatus): bar fill capped at target,
            // amber only when meaningfully over (> target + 200) — never red.
            const detail = computePlanDayDetail(
              dayKcal,
              targetKcal,
              plannedCount,
              0,
            );
            return (
              <section
                key={dayIndex}
                data-testid={`plan-web-day-card-${dayIndex}`}
                aria-label={`${WEEKDAY_LONG[date.getDay()]} ${date.getDate()}`}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="text-[15px] font-semibold text-foreground">
                    {WEEKDAY_LONG[date.getDay()] ?? "Day"} {date.getDate()}
                  </h3>
                  <span className="text-[13px] tabular-nums text-foreground-tertiary">
                    {dayKcal > 0 ? (
                      <>
                        {dayKcal.toLocaleString("en-US")}{" "}
                        <span className="opacity-70">
                          / {targetKcal.toLocaleString("en-US")}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
                <div
                  aria-hidden
                  className="mb-2 mt-3 h-[7px] overflow-hidden rounded-full"
                  style={{ backgroundColor: "var(--background-secondary)" }}
                >
                  <i
                    data-testid={`plan-web-day-bar-${dayIndex}`}
                    className="block h-full rounded-full transition-[width] duration-700"
                    style={{
                      width: `${Math.round(detail.barPct * 100)}%`,
                      backgroundColor:
                        detail.tone === "warning"
                          ? "var(--warning)"
                          : "var(--accent-success)",
                    }}
                  />
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
