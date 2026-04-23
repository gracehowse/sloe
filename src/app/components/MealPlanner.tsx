import { memo, useMemo, useState } from "react";
import { RefreshCw, ShoppingCart, X } from "lucide-react";
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

type SwapTarget = { day: number; slot: "breakfast" | "lunch" | "dinner"; mealIndex: number };

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
  userTier: _userTier,
  onUpgrade: _onUpgrade,
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
      await generateMealPlan();
      await generateShoppingListFromPlan();
      toast.success("Plan regenerated");
    } catch {
      toast.error("Could not regenerate plan. Save more recipes and try again.");
    } finally {
      setIsGenerating(false);
    }
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
  const swapPool = useMemo(() => {
    if (!swapFor) return [];
    const pool = [...discoverRecipes, ...savedRecipesForLibrary];
    const slot = swapFor.slot as PlannerMealSlot;
    const fits = pool.filter((r) => recipeFitsMealSlot(r, slot));
    return fits.length > 0 ? fits : pool;
  }, [swapFor, discoverRecipes, savedRecipesForLibrary]);

  const plan = mealPlan ?? [];
  // Prototype shows 7 day cards always — pad when plan is shorter so the
  // grid never collapses to a single column with stray data.
  const days: DayPlan[] = Array.from({ length: 7 }, (_, i) => {
    return plan[i] ?? ({ day: i + 1, meals: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } } as DayPlan);
  });

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

      <div
        data-testid="planner-desktop-kanban"
        className="grid grid-cols-1 md:grid-cols-7"
        style={{ gap: 12 }}
      >
        {days.map((dp, di) => {
          const dayDate = planCalendarDateForIndex(di);
          const dayLabel = shortWeekdayLabel(dayDate);
          const isTodayCol = isSameCalendarDay(dayDate, new Date());
          const bySlot = new Map<
            "breakfast" | "lunch" | "dinner",
            { mealIndex: number; meal: DayPlan["meals"][number] } | null
          >();
          bySlot.set("breakfast", null);
          bySlot.set("lunch", null);
          bySlot.set("dinner", null);
          dp.meals.forEach((m, i) => {
            const key = String(m.name ?? "").toLowerCase() as
              | "breakfast"
              | "lunch"
              | "dinner";
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
              {(["breakfast", "lunch", "dinner"] as const).map((slot) => {
                const entry = bySlot.get(slot);
                if (!entry) {
                  return (
                    <div
                      key={slot}
                      className="rounded-xl bg-muted relative"
                      style={{ padding: 10 }}
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
                      <p
                        className="text-foreground"
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          lineHeight: 1.3,
                          marginBottom: 4,
                          paddingRight: 20,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {isPlaceholder ? "Empty slot" : meal.recipeTitle}
                      </p>
                      <p
                        className="text-muted-foreground tabular-nums"
                        style={{ fontSize: 10 }}
                      >
                        {isPlaceholder ? "— kcal · — P" : `${kcal} kcal · ${prot} P`}
                      </p>
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
