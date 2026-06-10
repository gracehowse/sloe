import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarRange,
  Coffee,
  Cookie,
  Lock,
  Plus,
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
import { shouldShowRecipeRemovedBadge } from "../../lib/nutrition/recipeRemovedBadge.ts";
import {
  isSameCalendarDay,
  planCalendarDateForIndex,
  shortWeekdayLabel,
} from "../../lib/planning/planDayLabel.ts";
import {
  buildPlanWeekSummarySubtitle,
  computePlanWeekSummaryScore,
  planWeekHeadlineTone,
  type PlanWeekHeadlineTone,
} from "../../lib/planning/planWeekSummary.ts";
import { SupprCard } from "./ui/suppr-card";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { DestructiveConfirmDialog } from "./suppr/destructive-confirm-dialog";
import { TextPromptDialog } from "./suppr/text-prompt-dialog";
import { HouseholdBar } from "./HouseholdBar.tsx";
import {
  buildDayTotalVsGoalLine,
  type DayTotalTone,
} from "../../lib/planning/dayTotalVsGoal.ts";
import {
  recipeFitsMealSlot,
  type PlannerMealSlot,
} from "../../lib/planning/generateMealPlan.ts";
import { isFeatureEnabled } from "../../lib/analytics/track.ts";
import {
  type PlanSourceMode,
  DEFAULT_PLAN_SOURCE_MODE,
  canGenerateFromSource,
} from "../../lib/planning/planSource.ts";
import { PlanSourceSelector } from "./PlanSourceSelector.tsx";
import {
  DEFAULT_PLANNER_BANDS,
  refitDayMealsToTargets,
  scaleMacros,
} from "../../lib/nutrition/mealPlanAlgo.ts";
import { coerceMacrosWhenCaloriesButNoGrams } from "../../lib/nutrition/coerceRecipeMacrosForPlanning.ts";
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

/** F2-I (2026-04-28) — capitalised slot names for newly-inserted
 *  empty-slot meals (parity with mobile `ALL_MEAL_SLOTS`). The grid's
 *  bySlot lookup lowercases on read, so either case is safe to write
 *  — capitalised is the convention. */
const SLOT_TITLE: Record<SlotKey, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

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
    addLoggedMeal,
    // F2-G (audit 2026-04-28): named-slot switcher — let the user
    // keep multiple meal plans (e.g. "Cutting", "Maintenance",
    // "Holiday") and flip between them. The API surface is already
    // wired here in AppDataContext; this batch exposes it on web.
    mealPlanSlots,
    activeMealPlanSlotId,
    switchMealPlanSlot,
    createMealPlanSlot,
    renameMealPlanSlot,
    deleteMealPlanSlot,
  } = useAppData();

  const [isGenerating, setIsGenerating] = useState(false);
  // ENG-790 (2026-05-31) — "Plan from" source selector. When the flag is
  // on, the user chooses whether a generated plan draws from their saved
  // library, library + Suppr's discover pool (default), or discovery only;
  // the choice threads into `generateMealPlan({ source })`. Off → the legacy
  // saved-only path with the hard 0-saved gate. Mobile twin:
  // `apps/mobile/app/(tabs)/planner.tsx`.
  const planSourceSelector = isFeatureEnabled("plan_source_selector");
  const [planSource, setPlanSource] = useState<PlanSourceMode>(
    DEFAULT_PLAN_SOURCE_MODE,
  );
  const [swapFor, setSwapFor] = useState<SwapTarget | null>(null);
  // Audit 2026-04-30 — themed-dialog migration. Replaces the prior
  // `window.prompt` (rename + new plan) and `window.confirm` (delete
  // plan) calls with `TextPromptDialog` + `DestructiveConfirmDialog`.
  // Native browser dialogs were unthemed (broken in dark mode), fired
  // twice on some iOS Safari versions for `window.confirm`, and were
  // blocked outright in cross-origin iframes.
  const [renameSlotTarget, setRenameSlotTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteSlotTarget, setDeleteSlotTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  // F2-B (audit 2026-04-28) — day-count picker. Mobile parity:
  // `apps/mobile/app/(tabs)/planner.tsx` exposes 1 / 3 / 7 day options.
  // Default to 7 so the existing 7-column grid layout stays the
  // primary surface; a Free user is gated at 1 (F2-C below).
  const [planDays, setPlanDays] = useState<1 | 3 | 7>(7);
  // F2-C (audit 2026-04-28) — Free-tier lock on day-count picker
  // (closes F5: "free-tier 7-day plan lock divergence"). Mobile
  // gates `d > 1` for Free; web now matches.
  const isFree = userTier === "free";
  // F2-D (audit 2026-04-28) — start-date picker. 0 = Today,
  // 1 = Tomorrow, 7 = Next week. The shared
  // `planCalendarDateForIndex(idx, startOffset)` helper already
  // accepts the offset; pre-fix the web planner always passed 0.
  const [startOffset, setStartOffset] = useState<0 | 1 | 7>(0);
  // F2-H (audit 2026-04-28) — which canonical slots to include in
  // the next regenerate. Mobile parity at
  // `apps/mobile/app/(tabs)/planner.tsx:1775-1793`. Defaults to all
  // four; toggling Snacks off (the most common case) regenerates
  // without snack rows.
  const [enabledSlots, setEnabledSlots] = useState<Set<SlotKey>>(
    () => new Set<SlotKey>(SLOTS),
  );

  const targetCalories = nutritionTargets.calories;

  // ENG-790 — discover-pool size for the "Plan from" count badge, de-duped
  // against the saved library so the combined total can't double-count a
  // recipe that's both saved and discoverable (mirrors `selectPlanPool`).
  const discoverCount = useMemo(() => {
    const savedIds = new Set(savedRecipesForLibrary.map((r) => r.id));
    return discoverRecipes.filter((r) => !savedIds.has(r.id)).length;
  }, [discoverRecipes, savedRecipesForLibrary]);
  const libraryCount = savedRecipesForLibrary.length;
  const sourceCanGenerate = planSourceSelector
    ? canGenerateFromSource(planSource, { libraryCount, discoverCount })
    : true;

  const summary = useMemo(
    () => computePlanWeekSummaryScore(mealPlan ?? [], targetCalories),
    [mealPlan, targetCalories],
  );

  const weekOfLabel = useMemo(() => {
    // F2-D (2026-04-28): the "Week of {date}" subtitle now reflects
    // the chosen start offset (Today / Tomorrow / Next week) instead
    // of always anchoring to today. The `mealPlan[0].day` offset still
    // contributes for backwards-compat with plans persisted before
    // the picker existed.
    const first = planCalendarDateForIndex(0, startOffset);
    if (mealPlan && mealPlan.length > 0 && typeof mealPlan[0]?.day === "number") {
      first.setDate(first.getDate() + (mealPlan[0]!.day - 1));
    }
    return first.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  }, [mealPlan, startOffset]);

  const subtitle = summary
    ? `Week of ${weekOfLabel} · hits targets ${summary.hits} of ${summary.total} day${summary.total === 1 ? "" : "s"}`
    : `Week of ${weekOfLabel}`;

  /** F2-F (2026-04-28) — week summary card. Promotes the subtitle's
   *  "hits targets" line into a dedicated card with a worst-short-day
   *  diagnosis + Shopping list / Regenerate CTAs. Mobile parity:
   *  `apps/mobile/app/(tabs)/planner.tsx:1639-1698`. Hidden on empty
   *  plans (no score) or when targets aren't set; the bottom CTA row
   *  takes over in those cases so the user can still kick off
   *  generation. */
  const worstShortDayLabel = useMemo(() => {
    if (!summary?.worstShort) return null;
    const date = planCalendarDateForIndex(summary.worstShort.dayIndex, startOffset);
    return shortWeekdayLabel(date);
  }, [summary, startOffset]);
  const summarySubtitle = summary
    ? buildPlanWeekSummarySubtitle(summary, worstShortDayLabel)
    : null;
  const showSummaryCard = summary !== null && (mealPlan?.length ?? 0) > 0;

  // ENG-820 (Plan win-moment, Redesign — Design Direction 2026) — make the
  // "Hits your targets N of 7" headline state-aware, mirroring mobile
  // `apps/mobile/app/(tabs)/planner.tsx`. Behind `redesign_winmoment` the
  // headline colours by tone, kept distinct so the landmark reads as a win:
  //   - win (every day lands)    → `--accent-win` (the reserved win gold)
  //   - progress (some days land) → `--warning` (amber, never red)
  //   - calm (no day lands yet)   → `--muted-foreground` (informative)
  // Flag OFF keeps today's `text-foreground`. There is no haptic analog on web
  // (no Haptics API); the colour shift + the subtitle carry the payoff.
  const winMomentsEnabled = isFeatureEnabled("redesign_winmoment");
  const summaryTone = planWeekHeadlineTone(summary);
  const summaryHeadlineColor = !winMomentsEnabled
    ? undefined
    : summaryTone === "win"
      ? "var(--accent-win)"
      : summaryTone === "progress"
        ? "var(--warning)"
        : "var(--muted-foreground)";

  // ENG-822 (design_system_elevation, Redesign — Design Direction 2026) —
  // Summary card, empty-state, and per-day kanban cards are now routed
  // through the canonical SupprCard primitive, which owns the elevation
  // flag-gate internally (flag ON → soft shadow, border dropped;
  // flag OFF → prior flat `--elev-card` + hairline, byte-for-byte).
  // Today-column distinction: tone="primary" on SupprCard gives the tinted bg
  // + primary border accent in flag-off; flag-on drops the border, tint carries.

  // ENG-820 (Plan win-moment) — rising-edge scale pulse when the week first
  // crosses into a 7/7 win, mirroring the mobile one-shot spring at
  // `apps/mobile/app/(tabs)/planner.tsx` (`summaryPulse` + `prevSummaryToneRef`).
  // Web has no haptic, so the payoff is the brief scale pulse on the headline
  // (plus the steady-state colour shift already wired above). Gated behind
  // `redesign_winmoment`; the static-colour path is the flag-off else.
  const prevSummaryToneRef = useRef<PlanWeekHeadlineTone | null>(null);
  const [winPulse, setWinPulse] = useState(false);
  useEffect(() => {
    const prev = prevSummaryToneRef.current;
    prevSummaryToneRef.current = summaryTone;
    if (!winMomentsEnabled) return;
    // Only celebrate the rising edge INTO win (prev was a real non-win tone),
    // so re-mounting an already-7/7 plan never replays the pulse — matching the
    // mobile rising-edge guard exactly.
    if (summaryTone === "win" && prev !== null && prev !== "win") {
      setWinPulse(true);
      // One-shot — clear after the keyframe duration so a later regenerate that
      // re-enters win can replay it. `@media (prefers-reduced-motion)` disables
      // the transform in CSS, so this stays inert for reduced-motion users.
      const t = setTimeout(() => setWinPulse(false), 320);
      return () => clearTimeout(t);
    }
  }, [winMomentsEnabled, summaryTone]);

  const handleRegenerate = async () => {
    setIsGenerating(true);
    try {
      // F2-B (2026-04-28): pass through the chosen plan length. The
      // shared `generateMealPlan({ days })` API at `AppDataContext.tsx`
      // already accepts the option; pre-fix the call was a no-arg
      // invocation that defaulted to 1 day, which was the F2 root
      // cause for "web Planner is ~30% of mobile's surface".
      const days = isFree ? 1 : planDays;
      // F2-H (2026-04-28): pass through the user's enabled-slot set.
      // The shared `generatePlanFromLibrary` accepts `slots?: string[]`;
      // we pass capitalised names ("Breakfast" etc.) so the algorithm's
      // `recipeFitsMealSlot` lookup works. When all four slots are
      // enabled we omit the option so the lib's default kicks in.
      const slotsList: string[] = SLOTS.filter((s) => enabledSlots.has(s)).map(
        (s) => SLOT_TITLE[s],
      );
      const useSlotOverride =
        slotsList.length > 0 && slotsList.length < SLOTS.length;
      await generateMealPlan({
        days,
        ...(useSlotOverride ? { slots: slotsList } : {}),
        ...(planSourceSelector ? { source: planSource } : {}),
      });
      await generateShoppingListFromPlan();
      toast.success("Plan regenerated");
    } catch {
      toast.error("Could not regenerate plan. Save more recipes and try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  /** F2-H (2026-04-28) — toggle a slot in the enabled set. Disallows
   *  empty selection: at least one slot must remain enabled, since
   *  zero slots = an empty plan and a confusing UX. */
  const handleSlotToggle = (slot: SlotKey) => {
    setEnabledSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) {
        if (next.size === 1) return prev; // can't disable last slot
        next.delete(slot);
      } else {
        next.add(slot);
      }
      return next;
    });
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

  /** F2-I (2026-04-28) — add an empty slot back to a day. Mirrors
   *  the mobile flow at `apps/mobile/app/(tabs)/planner.tsx:2451-2522`.
   *  The slot is inserted as a placeholder; the user then taps Swap
   *  to fill it. Recomputes day totals. */
  const handleAddSlotBack = (dayIndex: number, slot: SlotKey) => {
    setMealPlan((prev) => {
      if (!prev) return prev;
      return prev.map((dpRow, di) => {
        if (di !== dayIndex) return dpRow;
        // Don't duplicate if the slot is already present (case-
        // insensitive match — see bySlot lookup).
        if (dpRow.meals.some((m) => String(m.name ?? "").toLowerCase() === slot)) {
          return dpRow;
        }
        const newMeal: DayPlan["meals"][number] = {
          name: SLOT_TITLE[slot],
          recipeTitle: "",
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          isPlaceholder: true,
        };
        const meals = [...dpRow.meals, newMeal];
        const totals = meals.reduce(
          (acc, m) => ({
            calories: acc.calories + (Number(m.calories) || 0),
            protein: acc.protein + (Number(m.protein) || 0),
            carbs: acc.carbs + (Number(m.carbs) || 0),
            fat: acc.fat + (Number(m.fat) || 0),
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 },
        );
        return { ...dpRow, meals, totals };
      });
    });
  };

  /** F2-M (2026-04-28) — log a planned meal to today's tracker.
   *  Mirrors the mobile flow at
   *  `apps/mobile/app/(tabs)/planner.tsx:2406-2447`. The macros on
   *  the planner row are already post-portion (per the F30 fix), so
   *  we pass `portionMultiplier: undefined` to avoid double-applying
   *  the scale — `LoggedMeal.portionMultiplier` is display-only and
   *  must reflect already-scaled macros. */
  const handleLogToday = (meal: DayPlan["meals"][number]) => {
    if (isMealPlanPlaceholderLikeTitle(meal.recipeTitle, { isPlaceholder: meal.isPlaceholder })) {
      return;
    }
    const slotName = String(meal.name ?? "").trim() || "Meal";
    const cal = Math.max(0, Math.round(Number(meal.calories) || 0));
    const protein = Math.max(0, Math.round(Number(meal.protein) || 0));
    const carbs = Math.max(0, Math.round(Number(meal.carbs) || 0));
    const fat = Math.max(0, Math.round(Number(meal.fat) || 0));
    // Tracking-extras autoupdate (2026-05-01) — forward caffeine /
    // alcohol micros if the planner row carries them so the F-13 daily
    // bump fires inside `addLoggedMeal`. Mirrors the mobile planner
    // tap-to-log wiring at `apps/mobile/app/(tabs)/index.tsx`. The
    // planner row carries `micros` only when the underlying recipe was
    // verified with ingredient-level caffeine / alcohol; fallback is
    // no-op.
    const plannerMicros = (meal as { micros?: Record<string, number> | null }).micros;
    const micros: Record<string, number> = {};
    const caff = plannerMicros && typeof plannerMicros === "object" ? Number(plannerMicros.caffeineMg ?? 0) : 0;
    const alc = plannerMicros && typeof plannerMicros === "object" ? Number(plannerMicros.alcoholG ?? 0) : 0;
    if (Number.isFinite(caff) && caff > 0) micros.caffeineMg = caff;
    if (Number.isFinite(alc) && alc > 0) micros.alcoholG = alc;
    addLoggedMeal({
      name: slotName,
      recipeTitle: meal.recipeTitle,
      time: slotName,
      calories: cal,
      protein,
      carbs,
      fat,
      ...(typeof (meal as { fiberG?: number }).fiberG === "number"
        ? { fiberG: (meal as { fiberG?: number }).fiberG }
        : {}),
      ...(Object.keys(micros).length > 0 ? { micros } : {}),
    });
    toast.success(`Logged ${slotName} to today`);
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
    const pool = [...discoverRecipes, ...savedRecipesForLibrary];
    const next = pool.find((r) => r.id === recipeId);
    if (!next) {
      setSwapFor(null);
      return;
    }
    const baseFromRecipe = (r: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiberG?: number;
    }) => {
      const c = coerceMacrosWhenCaloriesButNoGrams({
        calories: r.calories,
        protein: r.protein,
        carbs: r.carbs,
        fat: r.fat,
        fiberG: r.fiberG,
      });
      return {
        calories: c.calories,
        protein: c.protein,
        carbs: c.carbs,
        fat: c.fat,
        fiberG: c.fiberG ?? 0,
      };
    };
    const plannerTargets = {
      calories: nutritionTargets.calories,
      protein: nutritionTargets.protein,
      carbs: nutritionTargets.carbs,
      fat: nutritionTargets.fat,
      fiber: nutritionTargets.fiber ?? 28,
      ...DEFAULT_PLANNER_BANDS,
    };
    setMealPlan((prev) => {
      if (!prev) return prev;
      return prev.map((dp) => {
        if (dp.day !== swapFor.day) return dp;
        const baseRecipes = dp.meals.map((m, mi) => {
          if (mi === swapFor.mealIndex) return baseFromRecipe(next);
          const ref = pool.find((r) => r.id === m.recipeId);
          if (ref) return baseFromRecipe(ref);
          return {
            calories: m.calories,
            protein: m.protein,
            carbs: m.carbs,
            fat: m.fat,
            fiberG: (m as { fiberG?: number }).fiberG ?? 0,
          };
        });
        const fit = refitDayMealsToTargets({ recipes: baseRecipes, targets: plannerTargets });
        const newMeals = dp.meals.map((m, mi) => {
          const scaled = scaleMacros(baseRecipes[mi]!, fit.multipliers[mi] ?? 1);
          return {
            ...m,
            ...(mi === swapFor.mealIndex
              ? {
                  recipeTitle: next.title,
                  recipeId: next.id,
                }
              : {}),
            calories: scaled.calories,
            protein: scaled.protein,
            carbs: scaled.carbs,
            fat: scaled.fat,
            portionMultiplier: undefined,
          };
        });
        const totals = newMeals.reduce(
          (acc, m) => {
            acc.calories += Math.max(0, Math.round(Number(m.calories) || 0));
            acc.protein += Math.max(0, Math.round(Number(m.protein) || 0));
            acc.carbs += Math.max(0, Math.round(Number(m.carbs) || 0));
            acc.fat += Math.max(0, Math.round(Number(m.fat) || 0));
            return acc;
          },
          { calories: 0, protein: 0, carbs: 0, fat: 0 },
        );
        return {
          ...dp,
          meals: newMeals,
          totals,
          ...(fit.residualProteinGap < 0 ? { residualProteinGap: fit.residualProteinGap } : {}),
        };
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

  /**
   * Recipe-wave (2026-05-10): "Defaults to recipes that don't exist".
   *
   * `meal_plans.plan` is JSONB with no FK against `recipes.id`, so a
   * `recipeId` baked into a plan row stays referenceable after the
   * underlying recipe is deleted from the library. Pre-fix the card
   * silently disabled the click handler (line ~970) but kept rendering
   * the title — read as a half-broken card.
   *
   * This Set carries every recipe id known to the current session
   * (Discover seed pack + the user's saved library). When a meal's
   * `recipeId` isn't in the set, the card surfaces a "Recipe removed"
   * badge so the user understands the state and can swap or delete it.
   */
  const knownRecipeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of discoverRecipes) ids.add(r.id);
    for (const r of savedRecipesForLibrary) ids.add(r.id);
    return ids;
  }, [discoverRecipes, savedRecipesForLibrary]);

  const plan = mealPlan ?? [];
  const isPlanEmpty = plan.length === 0 || plan.every((d) => d.meals.length === 0);
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
    <div className="product-shell py-pm-6 space-y-5">
      <div className="hidden md:block">
      {/* Sloe DS (Figma 523:2 / ENG-919) — page title reads in Newsreader
          serif plum (`text-foreground-brand`), matching the Today / Progress /
          Settings landmark headings. Replaces the prior Inter-bold ink H1 so
          the Plan tab speaks the same warm-editorial language. */}
      <h1
        className="font-[family-name:var(--font-headline)] text-3xl font-medium tracking-tight text-foreground-brand"
        style={{ margin: "0 0 4px" }}
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
      </div>

      {/* F2-L (audit 2026-04-28): household bar — mobile parity at
          `apps/mobile/app/(tabs)/planner.tsx:1708 <HouseholdSummaryRow />`.
          The web `HouseholdBar` is the existing simplified-vs-original
          component (member-picker chips + Manage link); it self-hides
          for solo users (`!data?.household || members.length === 0`),
          so adding it unconditionally on the planner page costs nothing
          for accounts without a household. */}
      <HouseholdBar />

      {/* F2-F (2026-04-28): week summary card. Mobile parity at
          `apps/mobile/app/(tabs)/planner.tsx:1639-1698`. Carries the
          "hits targets N of M days" headline + worst-short-day
          diagnosis + Shopping list / Regenerate CTAs. Hidden when no
          plan exists; the bottom CTA row takes over. */}
      {showSummaryCard && summary ? (
        <SupprCard
          data-testid="planner-week-summary-card"
          // One-treatment soft lift (2026-06-09, docs/decisions/2026-06-09-one-
          // card-treatment-soft-elevation.md): the week summary slab sits
          // directly on the Plan page ground, so it lifts soft (`.card-slab`)
          // like every other resting card — mirrors mobile `summaryCard`
          // `lift="soft"`. Was the flat default.
          elevation="card"
          padding="lg"
          radius="xl"
          className="mb-4"
        >
          {/* ENG-820 — one-shot scale-pulse keyframe for the win rising edge.
              Scoped inline (mirrors `AppLoadingSkeleton`) so no theme.css edit
              is needed; the `prefers-reduced-motion` guard disables the
              transform for motion-sensitive users, matching the hook's intent. */}
          <style>{`
            @keyframes planner-win-pulse {
              0% { transform: scale(1); }
              40% { transform: scale(1.06); }
              100% { transform: scale(1); }
            }
            .planner-win-pulse {
              animation: planner-win-pulse 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
              transform-origin: left center;
            }
            @media (prefers-reduced-motion: reduce) {
              .planner-win-pulse { animation: none; }
            }
          `}</style>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              {/* ENG-820 — state-aware headline. Inline `color` (when the win
                  flag is on) wins over `text-foreground`; flag-off leaves the
                  class colour. `data-tone` + testid let the parity test pin the
                  tone without reading a computed colour. The colour-only change
                  animates via `transition-colors` so a regenerate that flips
                  the tone eases rather than snaps. The `planner-win-pulse` class
                  is applied only on the rising edge into a 7/7 win (the web
                  analog of the mobile scale spring + success haptic). */}
              {/* Sloe DS (523:2) — the win-moment headline is a card-title
                  landmark, so it reads in Newsreader serif. Flag-OFF resolves
                  to plum (`text-foreground-brand`, the card-title ink);
                  flag-ON the ENG-820 state-aware `summaryHeadlineColor`
                  (win gold / progress amber / calm muted) still wins via the
                  inline `color`, and the rising-edge pulse is untouched. */}
              <p
                data-testid="planner-week-summary-headline"
                data-tone={winMomentsEnabled ? summaryTone : "off"}
                data-pulse={winMomentsEnabled && winPulse ? "win" : undefined}
                className={`font-[family-name:var(--font-headline)] font-medium tracking-tight text-foreground-brand transition-colors${
                  winMomentsEnabled && winPulse ? " planner-win-pulse" : ""
                }`}
                style={{
                  fontSize: 17,
                  ...(summaryHeadlineColor ? { color: summaryHeadlineColor } : {}),
                }}
              >
                Hits your targets {summary.hits} of {`${summary.total} day${summary.total === 1 ? "" : "s"}`}
              </p>
              {summarySubtitle ? (
                <p
                  className="text-muted-foreground mt-1"
                  style={{ fontSize: 12, lineHeight: 1.4 }}
                >
                  {summarySubtitle}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleShoppingList}
              className="inline-flex items-center gap-1.5 rounded-xl bg-transparent border-[1.5px] border-primary-solid text-primary-solid font-semibold hover:bg-primary/5 transition-colors"
              style={{ padding: "8px 14px", fontSize: 13 }}
            >
              <ShoppingCart size={14} strokeWidth={2} />
              Shopping list
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 rounded-xl bg-card border border-border text-foreground font-semibold hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ padding: "8px 14px", fontSize: 13 }}
            >
              <RefreshCw
                size={14}
                strokeWidth={2}
                className={isGenerating ? "animate-spin" : ""}
              />
              Regenerate
            </button>
          </div>
        </SupprCard>
      ) : null}

      {/* F2-G (2026-04-28): named-slot switcher. Mobile parity at
          `apps/mobile/app/(tabs)/planner.tsx:1500-1626`. Renders a
          horizontal pill row with one chip per saved plan + a
          New chip. The API (mealPlanSlots / switch / create / rename
          / delete) is wired in AppDataContext; web previously didn't
          render it at all. Hidden when there's only the default slot
          and no meaningful state to switch to. */}
      {mealPlanSlots.length > 1 || (mealPlanSlots.length === 1 && (mealPlan?.length ?? 0) > 0) ? (
        <div
          data-testid="planner-slot-switcher"
          className="flex items-center gap-2 mb-3 flex-wrap"
        >
          <span className="text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground mr-1">
            Plan
          </span>
          {mealPlanSlots.map((s) => {
            const active = s.id === activeMealPlanSlotId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => switchMealPlanSlot(s.id)}
                onDoubleClick={() =>
                  setRenameSlotTarget({ id: s.id, name: s.name })
                }
                title="Click to switch · double-click to rename"
                data-testid={`planner-slot-chip-${s.id}`}
                className={[
                  "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all",
                  active
                    ? "border-primary bg-primary/10 text-primary-solid"
                    : "border-border text-foreground hover:bg-muted/60",
                ].join(" ")}
              >
                {s.name}
                {active && mealPlanSlots.length > 1 ? (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Delete ${s.name}`}
                    data-testid={`planner-slot-delete-${s.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteSlotTarget({ id: s.id, name: s.name });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteSlotTarget({ id: s.id, name: s.name });
                      }
                    }}
                    className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-destructive/15 hover:text-destructive cursor-pointer"
                  >
                    <X size={11} aria-hidden />
                  </span>
                ) : null}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setNewPlanOpen(true)}
            data-testid="planner-slot-new"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold border border-dashed border-border text-muted-foreground hover:bg-muted/60 transition-all"
          >
            + New
          </button>
        </div>
      ) : null}

      {/* ENG-790 (2026-05-31): "Plan from" source selector sits above
          Days / Slots / Start so the user picks where the plan draws
          recipes from before tuning length. Flag-gated; off → the
          legacy controls only. Mobile parity: the same control at the
          top of the generate form in `app/(tabs)/planner.tsx`. */}
      {planSourceSelector ? (
        <div className="mb-3">
          <PlanSourceSelector
            mode={planSource}
            onChange={setPlanSource}
            libraryCount={libraryCount}
            discoverCount={discoverCount}
          />
        </div>
      ) : null}

      {/* F2-B (2026-04-28): day-count picker. Mobile parity at
          `apps/mobile/app/(tabs)/planner.tsx:1734-1757`. F2-C: Free
          tier sees a lock glyph on 3-day and 7-day chips and tapping
          routes to upgrade. */}
      <div
        data-testid="planner-day-count-row"
        className="flex items-center gap-2 mb-3 flex-wrap"
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
                  ? "border-primary bg-primary/10 text-primary-solid"
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

      {/* F2-H (2026-04-28): slot toggles. Mobile parity at
          `apps/mobile/app/(tabs)/planner.tsx:1775-1793`. Toggle off
          slots you don't want the regenerator to fill (e.g. Snacks).
          At least one slot must stay enabled — the toggle no-ops when
          asked to disable the last one. */}
      <div
        data-testid="planner-slot-toggles-row"
        className="flex items-center gap-2 mb-3 flex-wrap"
        role="group"
        aria-label="Slots to include when regenerating"
      >
        <span className="text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground mr-1">
          Slots
        </span>
        {SLOTS.map((slot) => {
          const SlotIcon = SLOT_ICONS[slot];
          const enabled = enabledSlots.has(slot);
          const isLast = enabled && enabledSlots.size === 1;
          return (
            <button
              key={slot}
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-disabled={isLast}
              onClick={() => handleSlotToggle(slot)}
              data-testid={`planner-slot-toggle-${slot}`}
              className={[
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all capitalize",
                enabled
                  ? "border-primary bg-primary/10 text-primary-solid"
                  : "border-border text-muted-foreground hover:bg-muted/60",
                isLast ? "cursor-not-allowed opacity-80" : "",
              ].join(" ")}
              title={isLast ? "At least one slot must stay enabled" : undefined}
            >
              <SlotIcon size={11} aria-hidden />
              {slot}
            </button>
          );
        })}
      </div>

      {/* F2-D (2026-04-28): start-date picker. Mobile parity at
          `apps/mobile/app/(tabs)/planner.tsx:1759-1774`. */}
      <div
        data-testid="planner-start-date-row"
        className="flex items-center gap-2 mb-4 flex-wrap"
        role="radiogroup"
        aria-label="Start date"
      >
        <span className="text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground mr-1">
          Start
        </span>
        {([
          { offset: 0 as const, label: "Today" },
          { offset: 1 as const, label: "Tomorrow" },
          { offset: 7 as const, label: "Next week" },
        ]).map(({ offset, label }) => {
          const active = startOffset === offset;
          return (
            <button
              key={offset}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setStartOffset(offset)}
              data-testid={`planner-start-${offset}`}
              className={[
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold border transition-all",
                active
                  ? "border-primary bg-primary/10 text-primary-solid"
                  : "border-border text-foreground hover:bg-muted/60",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>

      {isPlanEmpty ? (
        <SupprCard
          data-testid="planner-empty-state"
          // One-treatment soft lift (2026-06-09): the empty-state slab is
          // page-ground, so it lifts soft like the summary card + the mobile
          // `PlanEmptyState` twin. Was the flat default.
          elevation="card"
          padding="none"
          radius="xl"
          className="flex flex-col items-center justify-center"
          style={{ padding: "48px 24px", minHeight: 320 }}
        >
          <div
            className="flex items-center justify-center rounded-2xl bg-primary/10"
            style={{ width: 64, height: 64, marginBottom: 20 }}
          >
            <CalendarRange size={28} className="text-primary" strokeWidth={1.5} />
          </div>
          {/* Sloe DS (Figma 321:2 S8 — Plan empty) — empty-state headline
              reads in Newsreader serif plum, matching the Recipes / Shopping
              empty states. */}
          <p
            className="font-[family-name:var(--font-headline)] font-medium text-foreground-brand text-center"
            style={{ fontSize: 20, marginBottom: 8 }}
          >
            Ready to plan your week?
          </p>
          <p
            className="text-muted-foreground text-center"
            style={{ fontSize: 13, lineHeight: "1.5", maxWidth: 340, marginBottom: 24 }}
          >
            {planSourceSelector
              ? `Pick where your recipes come from above, then hit generate — Suppr balances a ${planDays}-day plan to your calorie and macro targets.`
              : `Hit generate and we'll build a ${planDays}-day meal plan from your saved recipes, balanced to your calorie and macro targets.`}
          </p>
          <button
            data-testid="planner-empty-generate-btn"
            /* Sloe treatment §1: primary inline CTA = aubergine OUTLINE
               (transparent fill, 1.5px primarySolid border + label). */
            className="rounded-full bg-transparent border-[1.5px] border-primary-solid text-primary-solid hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontSize: 14, fontWeight: 600, padding: "10px 28px" }}
            onClick={handleRegenerate}
            disabled={isGenerating || !sourceCanGenerate}
          >
            {isGenerating ? "Generating…" : "Generate meal plan"}
          </button>
          {/* ENG-790: the only way generate is blocked under the flag is
              "My library" picked at 0 saves — point the user back at the
              selector (Discovery always has recipes) so 0 saved isn't a
              dead end. Mobile parity: the `libraryEmptySubcase` hint. */}
          {planSourceSelector && !sourceCanGenerate ? (
            <p
              data-testid="planner-empty-source-hint"
              className="text-muted-foreground text-center"
              style={{ fontSize: 12, lineHeight: "1.4", maxWidth: 320, marginTop: 12 }}
            >
              Save a recipe to plan from your library — or pick{" "}
              <span className="font-semibold text-foreground">Library &amp; discovery</span> above to use Suppr&apos;s recipes.
            </p>
          ) : null}
        </SupprCard>
      ) : (
      <div
        data-testid="planner-desktop-kanban"
        className={`grid grid-cols-1 ${gridColsClass}`}
        style={{ gap: 12 }}
      >
        {days.map((dp, di) => {
          // F2-D (2026-04-28): each day's calendar date now anchors
          // off `startOffset` so a "Next week" plan renders the
          // correct weekday labels rather than always starting from
          // today.
          const dayDate = planCalendarDateForIndex(di, startOffset);
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
            // One-treatment soft lift (2026-06-09, docs/decisions/2026-06-09-
            // one-card-treatment-soft-elevation.md): each per-day kanban column
            // sits directly in the page-ground grid (not nested in another
            // card), so it lifts soft (`.card-slab`) like every other resting
            // card. The Today column keeps tone="primary" — the soft shadow
            // composes with the tint (border dropped, tint carries). Was the
            // flat default. (Mobile renders Plan days as a continuous list, not
            // cards — that layout divergence predates this sweep; the rule
            // applies to whatever cards sit on each platform's page ground.)
            <SupprCard
              key={`day-${dp.day}`}
              elevation="card"
              padding="none"
              radius="xl"
              tone={isTodayCol ? "primary" : "neutral"}
              className="flex flex-col p-3.5 gap-2.5"
            >
              <div className="flex items-center justify-between">
                <p className="text-foreground" style={{ fontSize: 13, fontWeight: 700 }}>
                  {dayLabel}
                </p>
                {isTodayCol ? (
                  <span
                    data-testid={`planner-desktop-today-pill-${dp.day}`}
                    /* Sloe treatment §9: today marker = calm aubergine
                       soft-tint status pill (was a saturated filled pill). */
                    className="inline-flex items-center rounded-full bg-primary/10 text-primary-solid uppercase"
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
                  `apps/mobile/app/(tabs)/planner.tsx:2053-2089`.
                  F2 follow-up #3 (2026-04-28, see
                  `docs/decisions/2026-04-28-plan-day-summary-strip-web-divergence.md`):
                  added a slim per-day progress bar that ports the
                  one signal the mobile day-summary strip carries
                  beyond what the grid already shows. The strip
                  itself stays mobile-only (web 7-column grid serves
                  the same spatial function). */}
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
                  <div
                    data-testid={`planner-day-progress-${dp.day}`}
                    role="progressbar"
                    aria-valuenow={Math.round(dayTotalLine.totals.calories)}
                    aria-valuemin={0}
                    aria-valuemax={Math.round(nutritionTargets.calories)}
                    aria-label={`Calories progress for ${dayLabel}`}
                    className={`h-1 rounded-full overflow-hidden ${
                      dayTotalLine.cells[0].tone === "neutral"
                        ? "bg-muted"
                        : "bg-warning-soft"
                    }`}
                  >
                    <div
                      className={`h-full transition-all ${
                        dayTotalLine.cells[0].tone === "neutral"
                          ? "bg-primary"
                          : "bg-warning"
                      }`}
                      style={{
                        width:
                          nutritionTargets.calories > 0
                            ? `${Math.min(100, (dayTotalLine.totals.calories / nutritionTargets.calories) * 100)}%`
                            : "0%",
                      }}
                    />
                  </div>
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
                      // Audit 2026-04-30 visual-qa P1 #13 — `p-2.5`
                      // replaces inline `padding: 10` for token parity
                      // with the surrounding day-card spacing.
                      className="rounded-xl bg-muted relative p-2.5"
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
                      <p className="text-[11px] text-muted-foreground">
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
                // Recipe-wave (2026-05-10) — detect a stale recipeId
                // (set on the plan row but no longer in the library /
                // discover pool). Surfaced as a "Recipe removed"
                // badge below so the card explains itself instead of
                // half-rendering. Placeholder rows (`isPlaceholder`)
                // intentionally have no recipeId; that case stays
                // silent.
                // ENG-766 — gate on the library being hydrated (a non-empty
                // known-id set) so a row never flashes "Recipe removed"
                // before the recipe pool loads. AppDataContext exposes no
                // loading flag, so `size > 0` is the hydrated proxy.
                const recipeMissing = shouldShowRecipeRemovedBadge({
                  hasRecipe: Boolean(recipeId),
                  recipeId,
                  knownRecipeIds,
                  libraryLoaded: knownRecipeIds.size > 0,
                });
                // F2-E (2026-04-28): per-meal portion-multiplier
                // badge. Hidden at 1× (the silent default) so cards
                // stay clean when no portion adjustment was made.
                // The post-portion macros are already baked into
                // `meal.calories` (per the F30 fix), so this badge
                // is display-only — it explains, doesn't multiply.
                const portionLabel = formatPortionMultiplier(
                  (meal as { portionMultiplier?: number }).portionMultiplier,
                );
                // F2-J (2026-04-28): leftover badge. The leftover
                // distribution pass at `src/lib/nutrition/leftoversPlanner.ts`
                // tags downstream slots with `leftoverOf: recipeId` and
                // `isLeftover: true` when a recipe yields multiple
                // servings. Display-only badge so the user sees that
                // a slot is a leftover portion rather than a fresh
                // cook. Data already exists in the plan JSON; pre-fix
                // the web grid silently rendered leftovers as if they
                // were independent meals.
                const isLeftover = Boolean(
                  (meal as { isLeftover?: boolean }).isLeftover ||
                    (meal as { leftoverOf?: string }).leftoverOf,
                );
                return (
                  <div
                    key={slot}
                    // Audit 2026-04-30 visual-qa P1 #13 — `p-2.5`
                    // replaces inline `padding: 10` for token parity.
                    className="rounded-xl bg-muted relative p-2.5"
                  >
                    <button
                      type="button"
                      disabled={isPlaceholder || !recipeId || recipeMissing}
                      onClick={() => {
                        if (isPlaceholder || !recipeId || recipeMissing) return;
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
                      {/* Recipe-wave (2026-05-10) — "Recipe removed"
                          badge for plan rows whose `recipeId` no
                          longer resolves to a live recipe. Pre-fix
                          the card silently disabled itself; now the
                          state is explained so the user knows to
                          swap or remove the slot. */}
                      {recipeMissing && (
                        <span
                          data-testid="meal-planner-recipe-removed-badge"
                          className="inline-flex items-center rounded-full bg-muted-foreground/15 text-muted-foreground"
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "1px 6px",
                            marginBottom: 4,
                          }}
                          aria-label="Recipe no longer in your library"
                        >
                          Recipe removed
                        </span>
                      )}
                      {isLeftover ? (
                        <span
                          className="inline-flex items-center rounded-full bg-success/15 text-success"
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "1px 6px",
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            marginBottom: 4,
                          }}
                          aria-label="Leftover portion"
                        >
                          Leftover
                        </span>
                      ) : null}
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
                    {/* F2-M (2026-04-28): "Log today" button on each
                        meal row. Mobile parity at
                        `apps/mobile/app/(tabs)/planner.tsx:2406-2447`.
                        Audit 2026-04-29 papercut #11: previously a
                        bold text link in saturated `text-primary`,
                        which screamed for attention with 2-4 of these
                        visible per day card. Demoted to a subtle-fill
                        pill (8% primary bg + primary text, semibold
                        not bold) so the button reads as a tappable
                        affordance without dominating the row. Mirrors
                        the mobile change. Disabled when the slot is a
                        placeholder. */}
                    {!isPlaceholder ? (
                      <button
                        type="button"
                        onClick={() => handleLogToday(meal)}
                        /* Sloe treatment: quiet off-white log pill (mobile
                           `mealLogBtn` parity) — off-white fill + hairline
                           border + muted label, not an accent tint. */
                        className="inline-flex items-center justify-center rounded-md bg-background-secondary border border-border px-3 py-1 text-muted-foreground font-semibold mt-1.5 hover:bg-muted/60 transition-colors"
                        style={{ fontSize: 12 }}
                        data-testid={`planner-log-today-${dp.day}-${slot}`}
                      >
                        Log today
                      </button>
                    ) : null}
                  </div>
                );
              })}
              {/* F2-I (2026-04-28): "Add slot back" chips for any
                  canonical slot missing from this day. Mobile parity:
                  `apps/mobile/app/(tabs)/planner.tsx:2451-2522`.
                  Hidden when all four slots are present — keeps the
                  card lean. */}
              {(() => {
                const presentLower = new Set(
                  dp.meals.map((m) => String(m.name ?? "").toLowerCase()),
                );
                const missing = SLOTS.filter((s) => !presentLower.has(s));
                if (missing.length === 0) return null;
                return (
                  <div
                    className="border-t border-border px-3 py-2 mt-1 flex items-center gap-2"
                    data-testid={`planner-add-slot-back-${dp.day}`}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
                      Add
                    </span>
                    <div className="flex flex-1 min-w-0 flex-nowrap gap-1.5">
                    {missing.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => handleAddSlotBack(di, slot)}
                        /* Sloe treatment: quiet add-slot chip = off-white fill +
                           hairline border + muted label (mobile `addSlotChip`
                           parity), not an accent-tinted chip. */
                        className="flex-1 min-w-0 inline-flex items-center justify-center gap-0.5 px-1.5 py-1 rounded-md text-muted-foreground border border-border bg-card hover:bg-muted/60 transition-colors"
                        style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.02em" }}
                        aria-label={`Add ${SLOT_TITLE[slot]} slot`}
                      >
                        <Plus size={10} aria-hidden className="shrink-0" />
                        <span className="truncate">{SLOT_TITLE[slot]}</span>
                      </button>
                    ))}
                    </div>
                  </div>
                );
              })()}
            </SupprCard>
          );
        })}
      </div>
      )}

      {/* F2-F (2026-04-28): bottom CTA row only renders when the
          summary card isn't taking the lead — i.e. on empty plans
          (so the user can still kick off generation) and when the
          score isn't computable (no targets / no plan). When the
          summary card is up, its in-card CTAs are the canonical
          way to regenerate or open the shopping list. */}
      <div
        data-testid="planner-desktop-cta-row"
        // Audit 2026-04-30 visual-qa P1 #7 — Tailwind JIT can purge
        // a class only injected via interpolation (`${... ? "hidden" : ""}`).
        // Both branches are explicit literals now so the class always
        // ends up in the production CSS.
        className={showSummaryCard ? "hidden" : "flex"}
        style={{ gap: 8, marginTop: 20 }}
      >
        <button
          type="button"
          onClick={handleShoppingList}
          className="inline-flex items-center gap-1.5 rounded-xl bg-transparent border-[1.5px] border-primary-solid text-primary-solid font-semibold hover:bg-primary/5 transition-colors"
          style={{ padding: "8px 16px", fontSize: 13 }}
        >
          <ShoppingCart size={14} strokeWidth={2} />
          Shopping list
        </button>
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={isGenerating || !sourceCanGenerate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-card border border-border text-foreground font-semibold hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ padding: "8px 16px", fontSize: 13 }}
        >
          <RefreshCw
            size={14}
            strokeWidth={2}
            className={isGenerating ? "animate-spin" : ""}
          />
          {/* DC12 (2026-05-14, premium-bar audit) — when no plan
              exists yet this is the empty-state CTA; the verb
              "Regenerate" misreads at that moment (nothing has
              been generated to re-do). The summary-card path
              keeps the regenerate verb since a plan IS visible
              there. Mobile parity:
              `apps/mobile/app/(tabs)/planner.tsx` "Generate my
              plan". */}
          {plan.length > 0 ? "Regenerate week" : "Generate my plan"}
        </button>
      </div>

      {/* Modal-dismissibility audit (2026-04-30) — migrated from a
          custom fixed-overlay div to Radix Dialog so the swap picker
          dismisses via Escape, the visible Radix close X, AND
          backdrop click (including iOS Safari touch, where the prior
          synthetic-click + stopPropagation combo silently swallowed
          backdrop taps). DialogContent ships its own corner X, so the
          custom close button was removed to avoid a double-X. */}
      <Dialog
        open={swapFor !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSwapFor(null);
        }}
      >
        <DialogContent className="max-w-[440px] w-[calc(100vw-2rem)] p-5 gap-0 max-h-[80vh] overflow-y-auto bg-card">
          <div style={{ marginBottom: 14 }}>
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
            <DialogTitle
              className="font-[family-name:var(--font-headline)] font-medium text-foreground-brand capitalize"
              style={{ margin: "4px 0 0", fontSize: 18 }}
            >
              {swapFor
                ? `${shortWeekdayLabel(
                    planCalendarDateForIndex(
                      Math.max(
                        0,
                        plan.findIndex((d) => d.day === swapFor.day),
                      ),
                    ),
                  )} · ${swapFor.slot}`
                : "Swap meal"}
            </DialogTitle>
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
                      {`${r.servings ?? 1} serving${(r.servings ?? 1) === 1 ? "" : "s"}`}
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
        </DialogContent>
      </Dialog>

      {/* Audit 2026-04-30 — themed dialogs replace the prior
          `window.prompt` (rename + new plan) and `window.confirm`
          (delete plan) calls. Native browser prompts were unthemed
          (broken in dark mode), inconsistent across browsers (iOS
          Safari fires `confirm` twice on some versions), and blocked
          in cross-origin iframes. */}
      <TextPromptDialog
        open={renameSlotTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameSlotTarget(null);
        }}
        title="Rename plan"
        description="Give this plan a new name."
        inputLabel="Plan name"
        placeholder="e.g. Cutting"
        currentValue={renameSlotTarget?.name ?? ""}
        confirmLabel="Save"
        onConfirm={(nextName) => {
          if (renameSlotTarget && nextName !== renameSlotTarget.name) {
            renameMealPlanSlot(renameSlotTarget.id, nextName);
          }
        }}
      />
      <TextPromptDialog
        open={newPlanOpen}
        onOpenChange={setNewPlanOpen}
        title="New plan"
        description="Name your new plan so you can switch between it and your other plans."
        inputLabel="Plan name"
        placeholder={`Plan ${mealPlanSlots.length + 1}`}
        currentValue=""
        confirmLabel="Create"
        onConfirm={(name) => {
          createMealPlanSlot(name);
        }}
      />
      <DestructiveConfirmDialog
        open={deleteSlotTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteSlotTarget(null);
        }}
        title={
          deleteSlotTarget
            ? `Delete "${deleteSlotTarget.name}"?`
            : "Delete plan?"
        }
        description="Your other plans stay intact. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteSlotTarget) {
            deleteMealPlanSlot(deleteSlotTarget.id);
          }
        }}
      />
    </div>
  );
});
