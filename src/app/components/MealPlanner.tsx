import { memo, useMemo, useState } from "react";
import {
  Coffee,
  Cookie,
  Lock,
  RefreshCw,
  ShoppingCart,
  Sun,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAppData } from "../../context/AppDataContext.tsx";
import { isMealPlanPlaceholderLikeTitle } from "../../lib/nutrition/portionMultiplier.ts";
import {
  isSameCalendarDay,
  planCalendarDateForIndex,
  shortWeekdayLabel,
} from "../../lib/planning/planDayLabel.ts";
import { computePlanWeekSummaryScore } from "../../lib/planning/planWeekSummary.ts";
import {
  buildDayTotalVsGoalLine,
  type DayTotalTone,
} from "../../lib/planning/dayTotalVsGoal.ts";
import {
  recipeFitsMealSlot,
  type PlannerMealSlot,
} from "../../lib/planning/generateMealPlan.ts";
import type { DayPlan } from "../../types/recipe.ts";

interface MealPlannerProps {
  userTier: "free" | "base" | "pro";
  onUpgrade?: () => void;
  onNavigate?: (view: "discover" | "library" | "shopping") => void;
  /** Opens recipe detail. */
  onOpenRecipe?: (recipeId: string) => void;
  /** Opens recipe detail in cook mode directly. */
  onCookRecipe?: (recipeId: string, portionMultiplier?: number) => void;
}

/** F2-A (audit 2026-04-28) — slot iteration includes Snacks on web,
 *  matching the mobile canonical set (`apps/mobile/app/(tabs)/planner.tsx`
 *  `ALL_MEAL_SLOTS`). The web grid renders all four slots when the
 *  generated plan carries them. */
type SlotKey = "breakfast" | "lunch" | "dinner" | "snacks";
const SLOTS: readonly SlotKey[] = ["breakfast", "lunch", "dinner", "snacks"] as const;

/** Slot icons — lucide-react parity with the mobile lucide-react-native
 *  set so the visual treatment lines up across platforms. */
const SLOT_ICONS: Record<SlotKey, LucideIcon> = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: UtensilsCrossed,
  snacks: Cookie,
};

type SwapTarget = { day: number; slot: SlotKey; mealIndex: number };

/** F2-E (2026-04-28) — tone → tailwind class for the day-total
 *  delta cells. Symmetric over/under bands per
 *  `src/lib/planning/dayTotalVsGoal.ts` (10% / 20% bands; "amber"
 *  for over-budget per `project_prototype_carryover_rules.md` —
 *  never red). */
function toneClasses(tone: DayTotalTone): string {
  if (tone === "neutral") return "bg-muted text-muted-foreground";
  if (tone === "amber") return "bg-warning-soft text-warning";
  // For "red" we still use the warning palette (over-budget = amber
  // not destructive per the prototype carryover rule).
  return "bg-warning-soft text-warning";
}

/** F2-E (2026-04-28) — portion-multiplier display label, hidden at
 *  1×. Mirrors the mobile pill at `apps/mobile/app/(tabs)/planner.tsx:2318-2340`. */
function formatPortionMultiplier(mult: number | null | undefined): string | null {
  if (typeof mult !== "number" || !Number.isFinite(mult) || mult <= 0) return null;
  if (Math.abs(mult - 1) < 0.01) return null;
  // Trim trailing zeros: 0.5 → "0.5×"; 1.5 → "1.5×"; 2 → "2×".
  const rounded = Math.round(mult * 100) / 100;
  const fixed = rounded.toString();
  return `${fixed}×`;
}

/**
 * Web Meal Planner — prototype rewrite (2026-04-20).
 *
 * Paste-level fidelity to `docs/ux/claude-design-bundles/prototype/
 * project/screens-web.jsx` `WebPlan` (lines 250–323): 24px title,
 * 13px subtitle with hits-target count, 7-column `grid-cols-7 gap-3`
 * of day cards, `breakfast / lunch / dinner` slot blocks (snacks
 * intentionally omitted — not in the prototype grid), 22×22
 * `refresh-cw` swap button, and a two-button Shopping-list / Regenerate
 * CTA row below.
 *
 * Mobile-web (< md) stacks the 7 day cards vertically.
 *
 * Intentionally cut vs prior builds (per Grace 2026-04-20):
 *  - Plan summary / daily average card
 *  - Today's plan compact block
 *  - DailyRing / MacroCard imports
 *  - Logging your day helper card
 *  - Horizontal day scroller + compact day strip
 *  - Per-day P/C/F pills + day-total kcal
 *  - "This week summary" card
 *  - Named plans card (moves to More/settings)
 *  - Pre-generation settings accordion + target band editor
 *  - Drag-drop, Move dialog, portion stepper, Cook/Log/Recipe buttons,
 *    per-day detailed macro breakdown, Smart suggestions, templates,
 *    leftover confirm modal.
 *
 * Live data flow retained:
 *  - `mealPlan` / `setMealPlan` — live plan, persists on swap
 *  - `generateMealPlan` — Regenerate week CTA
 *  - `generateShoppingListFromPlan` + `onNavigate("shopping")` —
 *    Shopping list CTA
 *  - `onOpenRecipe` — slot-body click
 *  - Swap modal reuses `discoverRecipes` (prototype maps one-to-one
 *    to the catalog the design surfaces in its swap list).
 */
export const MealPlanner = memo(function MealPlanner({
  userTier,
  onUpgrade,
  onNavigate,
  onOpenRecipe,
  onCookRecipe: _onCookRecipe,
}: MealPlannerProps) {
  const {
    mealPlan,
    setMealPlan,
    generateMealPlan,
    generateShoppingListFromPlan,
    savedRecipesForLibrary,
    discoverRecipes,
    nutritionTargets,
  } = useAppData();

  const [isGenerating, setIsGenerating] = useState(false);
  const [swapFor, setSwapFor] = useState<SwapTarget | null>(null);
  // F2-B (audit 2026-04-28) — day-count picker. Mobile parity:
  // `apps/mobile/app/(tabs)/planner.tsx` exposes 1 / 3 / 7 day options.
  // Default to 7 so the existing 7-column grid layout stays the
  // primary surface; a Free user is gated at 1 (F2-C below).
  const [planDays, setPlanDays] = useState<1 | 3 | 7>(7);
  // F2-C (audit 2026-04-28) — Free-tier lock on day-count picker
  // (closes F5: "free-tier 7-day plan lock divergence"). Mobile
  // gates `d > 1` for Free; web now matches.
  const isFree = userTier === "free";

  const targetCalories = nutritionTargets.calories;

  const summary = useMemo(
    () => computePlanWeekSummaryScore(mealPlan ?? [], targetCalories),
    [mealPlan, targetCalories],
  );

  const weekOfLabel = useMemo(() => {
    const first = new Date();
    if (mealPlan && mealPlan.length > 0 && typeof mealPlan[0]?.day === "number") {
      first.setDate(first.getDate() + (mealPlan[0]!.day - 1));
    }
    return first.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  }, [mealPlan]);

  const subtitle = summary
    ? `Week of ${weekOfLabel} · hits targets ${summary.hits} of ${summary.total} day${summary.total === 1 ? "" : "s"}`
    : `Week of ${weekOfLabel}`;

  const handleRegenerate = async () => {
    setIsGenerating(true);
    try {
      // F2-B (2026-04-28): pass through the chosen plan length. The
      // shared `generateMealPlan({ days })` API at `AppDataContext.tsx`
      // already accepts the option; pre-fix the call was a no-arg
      // invocation that defaulted to 1 day, which was the F2 root
      // cause for "web Planner is ~30% of mobile's surface".
      const days = isFree ? 1 : planDays;
      await generateMealPlan({ days });
      await generateShoppingListFromPlan();
      toast.success("Plan regenerated");
    } catch {
      toast.error("Could not regenerate plan. Save more recipes and try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  /** F2-C (2026-04-28) — clicking a Pro-locked day-count chip routes
   *  the user to the upgrade paywall instead of silently no-op'ing.
   *  Mirrors the mobile Alert at `planner.tsx:1742-1751`. */
  const handleDayCountSelect = (next: 1 | 3 | 7) => {
    if (isFree && next > 1) {
      onUpgrade?.();
      return;
    }
    setPlanDays(next);
  };

  const handleShoppingList = () => {
    void generateShoppingListFromPlan();
    onNavigate?.("shopping");
  };

  const openSwap = (day: number, slot: SwapTarget["slot"], mealIndex: number) => {
    setSwapFor({ day, slot, mealIndex });
  };

  const pickSwap = (recipeId: string) => {
    if (!swapFor) return;
    const next = [...discoverRecipes, ...savedRecipesForLibrary].find((r) => r.id === recipeId);
    if (!next) {
      setSwapFor(null);
      return;
    }
    setMealPlan((prev) => {
      if (!prev) return prev;
      return prev.map((dp) => {
        if (dp.day !== swapFor.day) return dp;
        const meals = dp.meals.map((m, idx) =>
          idx === swapFor.mealIndex
            ? {
                ...m,
                recipeTitle: next.title,
                recipeId: next.id,
                calories: next.calories,
                protein: next.protein,
                carbs: next.carbs,
                fat: next.fat,
                portionMultiplier: 1,
              }
            : m,
        );
        const totals = meals.reduce(
          (acc, m) => {
            acc.calories += Math.max(0, Math.round(Number(m.calories) || 0));
            acc.protein += Math.max(0, Math.round(Number(m.protein) || 0));
            acc.carbs += Math.max(0, Math.round(Number(m.carbs) || 0));
            acc.fat += Math.max(0, Math.round(Number(m.fat) || 0));
            return acc;
          },
          { calories: 0, protein: 0, carbs: 0, fat: 0 },
        );
        return { ...dp, meals, totals };
      });
    });
    toast.success("Swapped meal");
    setSwapFor(null);
  };

  // Build the swap-picker pool — filter to recipes that fit the target
  // slot when possible, falling back to the full pool if nothing
  // matches (parity with the prior swap flow).
  // F2-A (2026-04-28): the lookup-key is capitalised ("Breakfast")
  // because `PlannerMealSlot` is the capitalised enum from
  // `src/types/recipe.ts`. The pre-fix cast was incorrectly using
  // the lowercase web key directly, which made the slot filter a
  // no-op (no recipe ever matched), and the pool always fell
  // through to the un-filtered everything-list branch.
  const swapPool = useMemo(() => {
    if (!swapFor) return [];
    const pool = [...discoverRecipes, ...savedRecipesForLibrary];
    const slotMap: Record<SlotKey, PlannerMealSlot> = {
      breakfast: "Breakfast",
      lunch: "Lunch",
      dinner: "Dinner",
      snacks: "Snacks",
    };
    const slot = slotMap[swapFor.slot];
    const fits = pool.filter((r) => recipeFitsMealSlot(r, slot));
    return fits.length > 0 ? fits : pool;
  }, [swapFor, discoverRecipes, savedRecipesForLibrary]);

  const plan = mealPlan ?? [];
  // F2-B (2026-04-28): the rendered grid follows the actual plan
  // length now that day-count is user-selectable (1 / 3 / 7). Pre-
  // fix the grid was hardcoded to 7 columns regardless of how many
  // days the sampler produced. Empty plans still render the full
  // 7-column placeholder grid so the regenerate target is visible
  // before the user has any plan data.
  const renderDayCount = plan.length > 0 ? plan.length : 7;
  const days: DayPlan[] = Array.from({ length: renderDayCount }, (_, i) => {
    return plan[i] ?? ({ day: i + 1, meals: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } } as DayPlan);
  });
  // Tailwind `grid-cols-N` arbitrary values: pin the grid columns to
  // match the actual day count up to 7 so a 3-day plan renders 3
  // columns rather than 7 with 4 empty placeholders.
  const gridColsClass =
    renderDayCount <= 1
      ? "md:grid-cols-1"
      : renderDayCount <= 3
        ? "md:grid-cols-3"
        : "md:grid-cols-7";

  return (
    <div className="max-w-6xl mx-auto px-pm-5 py-pm-5">
      <h1
        className="text-foreground font-bold -tracking-[0.02em]"
        style={{ fontSize: 24, margin: "0 0 4px" }}
      >
        Meal plan
      </h1>
      <p
        data-testid="planner-desktop-subtitle"
        className="text-muted-foreground"
        style={{ fontSize: 13, marginBottom: 20 }}
      >
        {subtitle}
      </p>

      {/* F2-B (2026-04-28): day-count picker. Mobile parity at
          `apps/mobile/app/(tabs)/planner.tsx:1734-1757`. F2-C: Free
          tier sees a lock glyph on 3-day and 7-day chips and tapping
          routes to upgrade. */}
      <div
        data-testid="planner-day-count-row"
        className="flex items-center gap-2 mb-4"
        role="radiogroup"
        aria-label="Plan length"
      >
        <span className="text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground mr-1">
          Plan length
        </span>
        {([1, 3, 7] as const).map((d) => {
          const locked = isFree && d > 1;
          const active = planDays === d;
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => handleDayCountSelect(d)}
              data-testid={`planner-day-count-${d}`}
              className={[
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold border transition-all",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-foreground hover:bg-muted/60",
                locked ? "opacity-60" : "",
              ].join(" ")}
            >
              {d} {d === 1 ? "day" : "days"}
              {locked ? <Lock size={11} aria-label="Pro" /> : null}
            </button>
          );
        })}
      </div>

      <div
        data-testid="planner-desktop-kanban"
        className={`grid grid-cols-1 ${gridColsClass}`}
        style={{ gap: 12 }}
      >
        {days.map((dp, di) => {
          const dayDate = planCalendarDateForIndex(di);
          const dayLabel = shortWeekdayLabel(dayDate);
          const isTodayCol = isSameCalendarDay(dayDate, new Date());
          // F2-E (2026-04-28): day-total vs goal line — kcal header +
          // P/C/F delta chips. Skipped on days with zero meals to
          // keep the empty-day card lean.
          const dayTotalLine = buildDayTotalVsGoalLine(dp.meals, {
            calories: nutritionTargets.calories,
            protein: nutritionTargets.protein,
            carbs: nutritionTargets.carbs,
            fat: nutritionTargets.fat,
          });
          const renderTotals = dayTotalLine.hasTargets && dp.meals.length > 0;
          // F2-A (2026-04-28): bySlot now indexes all four canonical
          // slots (Breakfast / Lunch / Dinner / Snacks) so the grid
          // renders Snacks when the generated plan carries it. Pre-
          // fix the web grid silently dropped any snack rows the
          // sampler produced.
          const bySlot = new Map<
            SlotKey,
            { mealIndex: number; meal: DayPlan["meals"][number] } | null
          >();
          for (const s of SLOTS) bySlot.set(s, null);
          dp.meals.forEach((m, i) => {
            const key = String(m.name ?? "").toLowerCase() as SlotKey;
            if (bySlot.has(key) && bySlot.get(key) == null) {
              bySlot.set(key, { mealIndex: i, meal: m });
            }
          });
          return (
            <div
              key={`day-${dp.day}`}
              className={`rounded-2xl border flex flex-col ${
                isTodayCol
                  ? "bg-primary/10 border-primary/30"
                  : "bg-card border-border"
              }`}
              style={{ padding: 14, gap: 10 }}
            >
              <div className="flex items-center justify-between">
                <p className="text-foreground" style={{ fontSize: 13, fontWeight: 700 }}>
                  {dayLabel}
                </p>
                {isTodayCol ? (
                  <span
                    data-testid={`planner-desktop-today-pill-${dp.day}`}
                    className="inline-flex items-center rounded-full bg-primary text-primary-foreground uppercase"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      padding: "2px 8px",
                    }}
                  >
                    Today
                  </span>
                ) : null}
              </div>
              {/* F2-E (2026-04-28): day total vs goal — calories
                  header + P/C/F delta chips. Mobile parity at
                  `apps/mobile/app/(tabs)/planner.tsx:2053-2089`. */}
              {renderTotals ? (
                <div
                  data-testid={`planner-day-totals-${dp.day}`}
                  className="flex flex-col gap-1.5"
                  aria-label={`Day total · ${Math.round(dayTotalLine.totals.calories)} of ${Math.round(nutritionTargets.calories)} kcal`}
                >
                  <p
                    className={`tabular-nums inline-flex items-center rounded-md ${toneClasses(dayTotalLine.cells[0].tone)}`}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      alignSelf: "flex-start",
                    }}
                  >
                    {Math.round(dayTotalLine.totals.calories)} / {Math.round(nutritionTargets.calories)} kcal
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {dayTotalLine.cells.slice(1).map((cell) => (
                      <span
                        key={cell.key}
                        className={`tabular-nums inline-flex items-center rounded-full ${toneClasses(cell.tone)}`}
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "1px 6px",
                          letterSpacing: "0.02em",
                        }}
                      >
                        {cell.label} {Math.round(cell.actual)}/{Math.round(cell.goal)}g
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {SLOTS.map((slot) => {
                const SlotIcon = SLOT_ICONS[slot];
                const entry = bySlot.get(slot);
                if (!entry) {
                  return (
                    <div
                      key={slot}
                      className="rounded-xl bg-muted relative"
                      style={{ padding: 10 }}
                    >
                      <p
                        className="text-muted-foreground uppercase inline-flex items-center gap-1.5"
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: "0.1em",
                          marginBottom: 4,
                        }}
                      >
                        <SlotIcon size={11} aria-hidden />
                        {slot}
                      </p>
                      <p className="text-muted-foreground" style={{ fontSize: 12 }}>
                        Empty slot
                      </p>
                    </div>
                  );
                }
                const { mealIndex, meal } = entry;
                const isPlaceholder = isMealPlanPlaceholderLikeTitle(meal.recipeTitle, {
                  isPlaceholder: meal.isPlaceholder,
                });
                const kcal = Math.round(Math.max(0, Number(meal.calories) || 0));
                const prot = Math.round(Math.max(0, Number(meal.protein) || 0));
                const recipeId = (meal as { recipeId?: string }).recipeId;
                // F2-E (2026-04-28): per-meal portion-multiplier
                // badge. Hidden at 1× (the silent default) so cards
                // stay clean when no portion adjustment was made.
                // The post-portion macros are already baked into
                // `meal.calories` (per the F30 fix), so this badge
                // is display-only — it explains, doesn't multiply.
                const portionLabel = formatPortionMultiplier(
                  (meal as { portionMultiplier?: number }).portionMultiplier,
                );
                return (
                  <div
                    key={slot}
                    className="rounded-xl bg-muted relative"
                    style={{ padding: 10 }}
                  >
                    <button
                      type="button"
                      disabled={isPlaceholder || !recipeId}
                      onClick={() => {
                        if (isPlaceholder || !recipeId) return;
                        onOpenRecipe?.(recipeId);
                      }}
                      className="text-left w-full bg-transparent border-0 p-0 cursor-pointer disabled:cursor-default"
                      style={{ color: "inherit", fontFamily: "inherit" }}
                    >
                      <p
                        className="text-muted-foreground uppercase"
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: "0.1em",
                          marginBottom: 4,
                        }}
                      >
                        {slot}
                      </p>
                      <div className="flex items-start gap-1 mb-1" style={{ paddingRight: 20 }}>
                        <p
                          className="text-foreground flex-1 min-w-0"
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            lineHeight: 1.3,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {isPlaceholder ? "Empty slot" : meal.recipeTitle}
                        </p>
                        {portionLabel ? (
                          <span
                            className="shrink-0 inline-flex items-center rounded-full bg-primary/15 text-primary tabular-nums"
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              padding: "1px 6px",
                            }}
                            aria-label={`${portionLabel} portion`}
                          >
                            {portionLabel}
                          </span>
                        ) : null}
                      </div>
                      <p
                        className="text-muted-foreground tabular-nums"
                        style={{ fontSize: 10 }}
                      >
                        {isPlaceholder ? "— kcal · — P" : `${kcal} kcal · ${prot} P`}
                      </p>
                      {!isPlaceholder &&
                        (meal as { macrosAreEstimated?: boolean }).macrosAreEstimated && (
                          // P1-19 (2026-04-25): the recipe has stated calories
                          // but P/C/F that don't explain them; the planner is
                          // showing a neutral 28/42/30 split, not real data.
                          // Chip routes the user to the recipe verifier.
                          <span
                            className="inline-flex items-center"
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: "var(--accent-warning, #b8860b)",
                              backgroundColor: "var(--accent-warning-bg, rgba(232, 160, 32, 0.12))",
                              borderRadius: 999,
                              padding: "2px 8px",
                              marginTop: 6,
                              gap: 4,
                            }}
                            title="Macros are an estimated split — open the recipe and tap Verify to lock real values."
                            aria-label="Estimated macros — open the recipe to verify"
                          >
                            Estimated · verify
                          </span>
                        )}
                    </button>
                    <button
                      type="button"
                      onClick={() => openSwap(dp.day, slot, mealIndex)}
                      aria-label={`Swap ${slot}`}
                      title="Swap"
                      className="absolute grid place-items-center bg-card text-muted-foreground hover:text-foreground"
                      style={{
                        top: 8,
                        right: 8,
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                      }}
                    >
                      <RefreshCw size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div
        data-testid="planner-desktop-cta-row"
        className="flex"
        style={{ gap: 8, marginTop: 20 }}
      >
        <button
          type="button"
          onClick={handleShoppingList}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all"
          style={{ padding: "8px 16px", fontSize: 13 }}
        >
          <ShoppingCart size={14} strokeWidth={2} />
          Shopping list
        </button>
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={isGenerating}
          className="inline-flex items-center gap-1.5 rounded-xl bg-card border border-border text-foreground font-semibold hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ padding: "8px 16px", fontSize: 13 }}
        >
          <RefreshCw
            size={14}
            strokeWidth={2}
            className={isGenerating ? "animate-spin" : ""}
          />
          Regenerate week
        </button>
      </div>

      {swapFor ? (
        <div
          onClick={() => setSwapFor(null)}
          className="fixed inset-0 grid place-items-center"
          style={{
            background: "var(--overlay, rgba(0,0,0,0.5))",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl"
            style={{
              width: 440,
              maxWidth: "100%",
              maxHeight: "80vh",
              overflowY: "auto",
              padding: 20,
            }}
          >
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: 14 }}
            >
              <div>
                <p
                  className="text-muted-foreground uppercase"
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                  }}
                >
                  Swap
                </p>
                <h3
                  className="text-foreground capitalize"
                  style={{ margin: "4px 0 0", fontSize: 16 }}
                >
                  {shortWeekdayLabel(
                    planCalendarDateForIndex(
                      Math.max(
                        0,
                        plan.findIndex((d) => d.day === swapFor.day),
                      ),
                    ),
                  )}{" "}
                  · {swapFor.slot}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSwapFor(null)}
                className="bg-muted text-foreground grid place-items-center"
                style={{
                  border: 0,
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  cursor: "pointer",
                }}
                aria-label="Close swap picker"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex flex-col" style={{ gap: 6 }}>
              {swapPool.length === 0 ? (
                <p className="text-muted-foreground" style={{ fontSize: 13 }}>
                  No recipes available to swap in.
                </p>
              ) : (
                swapPool.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => pickSwap(r.id)}
                    className="grid bg-muted text-foreground text-left"
                    style={{
                      gridTemplateColumns: "1fr auto",
                      gap: 10,
                      padding: "12px 14px",
                      border: 0,
                      borderRadius: 10,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</p>
                      <p
                        className="text-muted-foreground"
                        style={{ fontSize: 11, marginTop: 2 }}
                      >
                        {r.servings ?? 1} serving{(r.servings ?? 1) === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div
                      className="tabular-nums text-right"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      <p style={{ fontSize: 13, fontWeight: 700 }}>
                        {Math.round(r.calories)}
                      </p>
                      <p
                        className="text-muted-foreground"
                        style={{ fontSize: 10 }}
                      >
                        {Math.round(r.protein)} P · {Math.round(r.carbs)} C
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
});
