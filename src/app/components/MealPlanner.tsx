import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRightLeft,
  CalendarRange,
  ChevronDown,
  Coffee,
  Cookie,
  LayoutTemplate,
  Lock,
  LockOpen,
  MoreHorizontal,
  Package,
  Plus,
  RefreshCw,
  Scale,
  ShoppingCart,
  Sliders,
  Sparkles,
  Sun,
  Upload,
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
import { SupprButton } from "./suppr/suppr-button";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
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
import { isFeatureEnabled, track } from "../../lib/analytics/track.ts";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { useAuthSession } from "../../context/AuthSessionContext.tsx";
import { useHouseholdBanner } from "../../hooks/useHouseholdBanner.ts";
import { supabase } from "../../lib/supabase/browserClient.ts";
import { moveMealInPlan } from "../../lib/nutrition/leftoversPlanner.ts";
import {
  applyTemplateToWeek,
  buildTemplateFromWeek,
  type PlanTemplate,
} from "../../lib/nutrition/planTemplates.ts";
import {
  createPlanTemplate,
  deletePlanTemplate,
  listPlanTemplates,
} from "../../lib/nutrition/planTemplatesClient.ts";
import { PlanMoveMealDialog } from "./suppr/plan-move-meal-dialog.tsx";
import { PlanPortionDialog, planMealDisplayMultiplier } from "./suppr/plan-portion-dialog.tsx";
import { PlanTemplatesDialog } from "./suppr/plan-templates-dialog.tsx";
import { PlanV3Connected } from "./plan/PlanV3Connected.tsx";
import { BatchCookSheet } from "./plan/BatchCookSheet.tsx";
import { ResetPlanSheet } from "./plan/ResetPlanSheet.tsx";
import { useMealPlanRegenerate } from "./plan/useMealPlanRegenerate.ts";
import { useMealSlotConfig } from "./plan/useMealSlotConfig.ts";
import {
  batchShoppingMultiplier,
  defaultBatchCookToolSubtitle,
  isBatchCookCandidate,
  recipeTotalTimeMin,
  type BatchCookRecipeCandidate,
} from "../../lib/planning/batchCook.ts";
import { filterShoppingItemsByPantry } from "../../lib/planning/pantryStaples.ts";
import { generateShoppingListFromRecipeEntriesAsync } from "../../lib/planning/generateShoppingList.ts";
import { upsertShoppingListJsonItems } from "../../lib/supabase/shoppingJsonFallback.ts";
import { AdjustConstraintsSheet } from "./plan/AdjustConstraintsSheet.tsx";
import { computeSmartRecipeSuggestions } from "../../lib/planning/smartSuggestions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useCalmMode } from "../../lib/preferences/useCalmMode.ts";
import {
  type PlanSourceMode,
  DEFAULT_PLAN_SOURCE_MODE,
  canGenerateFromSource,
} from "../../lib/planning/planSource.ts";
import {
  DEFAULT_PLAN_ADJUST_CONSTRAINTS,
  enabledSlotsForMealsPerDay,
  mealsPerDayFromEnabledSlots,
  type PlanAdjustConstraints,
} from "../../lib/planning/planAdjustConstraints.ts";
import { PlanSourceSelector } from "./PlanSourceSelector.tsx";
import {
  DEFAULT_PLANNER_BANDS,
  refitDayMealsToTargets,
  scaleMacros,
  slotMacroTargets,
} from "../../lib/nutrition/mealPlanAlgo.ts";
import { coerceMacrosWhenCaloriesButNoGrams } from "../../lib/nutrition/coerceRecipeMacrosForPlanning.ts";
import { planSlotAimKcal } from "../../lib/nutrition/mealSlotAim.ts";
import {
  EmptyMealSlotAimLine,
  PlanAbsentMealSlotRow,
} from "./suppr/empty-meal-slot-row.tsx";
import type { DayPlan } from "../../types/recipe.ts";

interface MealPlannerProps {
  userTier: "free" | "base" | "pro";
  onUpgrade?: () => void;
  onNavigate?: (view: "discover" | "library" | "shopping" | "plan-import") => void;
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

/** ENG-1278 — icon for any slot: classic map for named slots, neutral cutlery
 *  glyph for numbered-preset labels ("Meal 1" … "Meal N"). */
function slotIconFor(slot: string): LucideIcon {
  return SLOT_ICONS[slot.toLowerCase() as SlotKey] ?? UtensilsCrossed;
}

// ENG-1278 — `slot` widened to string so a numbered-preset slot label
// ("Meal N") can drive a swap; classic slots still resolve their slot-fit pool.
type SwapTarget = { day: number; slot: string; mealIndex: number };

/** F2-E (2026-04-28) — tone → tailwind class for the day-total
 *  delta cells. Symmetric over/under bands per
 *  `src/lib/planning/dayTotalVsGoal.ts` (10% / 20% bands; "amber"
 *  for over-budget per `project_prototype_carryover_rules.md` —
 *  never red). */
function toneClasses(tone: DayTotalTone): string {
  if (tone === "neutral") return "bg-muted text-muted-foreground";
  if (tone === "amber") return "bg-warning-soft text-warning-solid";
  // For "red" we still use the warning palette (over-budget = amber
  // not destructive per the prototype carryover rule).
  return "bg-warning-soft text-warning-solid";
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
 * project/screens-web.jsx` `WebPlan` (lines 250–323): serif title
 * (the page subtitle was retired in ENG-1020 — the week-date now rides
 * the summary-card eyebrow; the hits-target count is the card headline),
 * 7-column `grid-cols-7 gap-3`
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
    toggleSaveRecipe,
    setShoppingItems,
    pantryStaples,
    nutritionByDay,
  } = useAppData();

  const [isGenerating, setIsGenerating] = useState(false);
  // ENG-790 (2026-05-31) — "Plan from" source selector. When the flag is
  // on, the user chooses whether a generated plan draws from their saved
  // library, library + Suppr's discover pool (default), or discovery only;
  // the choice threads into `generateMealPlan({ source })`. Off → the legacy
  // saved-only path with the hard 0-saved gate. Mobile twin:
  // `apps/mobile/app/(tabs)/planner.tsx`.
  const planSourceSelector = isFeatureEnabled("plan_source_selector");
  // ENG-1225 — the v3 Plan surface (header verdict + week strip + day detail +
  // meal filter/cards + shopping tool), mirroring the SEE-validated mobile Plan.
  // ON → <PlanV3Connected> replaces the legacy body; OFF → the legacy body. The
  // swap/templates/shopping/generate dialogs stay live (they back the v3 taps).
  const sloeV3Plan = isFeatureEnabled("sloe_v3_plan");
  // ENG-1092 increment 2 ("Purposeful empties") — empty Plan day-card slots
  // state "Aim ~X kcal" (static per-slot dietitian share) instead of bare
  // "Empty slot". Same flag as Today (increment 1). OFF → legacy "Empty slot".
  const planAimEmptyOn = isFeatureEnabled("plan_today_aim_empty_v1");
  // ENG-1092 increment 3 — collapse the always-open Plan-length / Slots / Start
  // chip rows behind ONE "Adjust plan" control (web parity catch-up to mobile).
  // Trigger shows current settings ("7 days · Today · All meals"); popover holds
  // the pickers. OFF → the three inline rows. Web-only, default-OFF.
  const planAdjustCollapsed = isFeatureEnabled("plan_adjust_collapsed_v1");
  // ENG-1131 — web Plan parity: move-meal, templates, portion stepper (mobile
  // already ships these; web catches up behind one flag). Default-on; off → swap-
  // only slot affordance and no templates entry point.
  const planWebParity = isFeatureEnabled("plan_web_parity_v1");
  // ENG-956 — per-meal lock ("keep this meal", Refresh the rest). Default-OFF.
  // On → each meal row gets a quiet Lock glyph + a "Keep this meal" action, and
  // Regenerate keeps locked meals while re-rolling only the unlocked ones
  // (label becomes "Refresh the rest" when ≥1 meal is locked). Off → the legacy
  // all-or-nothing Regenerate; no lock affordance.
  const mealLockEnabled = isFeatureEnabled("plan_meal_lock_v1");
  // ENG-696 / ENG-647 — "Import existing plan" entry point. Same flag the
  // mobile Plan tab + deep link gate on (`plan_import_enabled`). Off → the
  // Import affordance is hidden and the Plan surface keeps the
  // Generate-from-library-only flow.
  const planImportEnabled = isFeatureEnabled("plan_import_enabled");
  const { authedUserId } = useAuthSession();
  const householdBanner = useHouseholdBanner(authedUserId); // ENG-1247 — v3 Plan "Cooking for N" banner
  // ENG-1098 "Calm mode" — when on, quiet the per-slot "Aim ~X kcal" numbers
  // (the empty-slot rows still render; only the number is hidden). Client-side
  // display preference (no DB), shared key with mobile.
  const [calmMode] = useCalmMode();
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
  // ENG-1177 — numbered meal-slot presets (4–6 "Meal N") drive plan generation
  // directly; classic returns null and keeps the `enabledSlots` toggle. See hook.
  const { numberedPresetSlots } = useMealSlotConfig(authedUserId);
  // ENG-1278 — the day-card grid + empty-slot aims iterate the user's REAL
  // configured slots (numbered preset labels, else classic four titles).
  const daySlots = useMemo<string[]>(
    () => numberedPresetSlots ?? SLOTS.map((s) => SLOT_TITLE[s]),
    [numberedPresetSlots],
  );
  const [allowBatchLeftovers, setAllowBatchLeftovers] = useState(true);
  const [planCalorieFloor, setPlanCalorieFloor] = useState(
    DEFAULT_PLAN_ADJUST_CONSTRAINTS.calorieFloor,
  );
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [batchCookOpen, setBatchCookOpen] = useState(false);
  const [batchCookSaving, setBatchCookSaving] = useState(false);
  const [moveFrom, setMoveFrom] = useState<{ day: number; slotIndex: number } | null>(
    null,
  );
  const [portionTarget, setPortionTarget] = useState<{
    day: number;
    mealIndex: number;
  } | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [planTemplates, setPlanTemplates] = useState<PlanTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesLoadAttempt, setTemplatesLoadAttempt] = useState(0);
  const [applyTemplateTarget, setApplyTemplateTarget] = useState<PlanTemplate | null>(
    null,
  );
  const [suggestionIngredients, setSuggestionIngredients] = useState<
    Map<string, string[]>
  >(() => new Map());

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

  // ENG-1092 / ENG-1278 — static per-slot aim keyed by lowercased slot.
  // `slotMacroTargets` over the user's REAL `daySlots` (classic → dietitian
  // ratio 25/30/35/10; numbered → even 1/N). null on optional Snacks / no
  // target. Used for every empty slot (absent-slot card AND placeholder row).
  const canonicalSlotAim = useMemo<Record<string, number | null>>(() => {
    // ENG-1098: Calm mode → no aims at all (empty cells fall back to "Empty slot").
    if (!planAimEmptyOn || calmMode || !(nutritionTargets.calories > 0)) return {};
    const targets = {
      calories: nutritionTargets.calories,
      protein: nutritionTargets.protein,
      carbs: nutritionTargets.carbs,
      fat: nutritionTargets.fat,
      fiber: nutritionTargets.fiber ?? 28,
      ...DEFAULT_PLANNER_BANDS,
    };
    const perSlot = slotMacroTargets(daySlots, targets);
    return Object.fromEntries(
      daySlots.map((s, i) => [s.toLowerCase(), planSlotAimKcal(s, perSlot[i]!.calories)]),
    );
  }, [planAimEmptyOn, calmMode, nutritionTargets, daySlots]);

  // ENG-1020 (2026-06-13): the week-date moved off a page subtitle and onto
  // the summary card as a "{start} – {end} · Meal plan" eyebrow, mirroring
  // mobile `apps/mobile/app/(tabs)/planner.tsx` `summaryOverline`. Previously
  // the page subtitle read "Week of {date} · hits targets N of M days", which
  // duplicated the "Hits your targets N of M days" headline sitting directly
  // below it in the summary card. Mobile resolved the same duplication on the
  // 2026-06-10 e2e walk by dropping its page subheader and keeping only the
  // card eyebrow; web now matches. Falls back to "This week" when the date
  // math can't resolve (defensive — mirrors mobile).
  const weekRangeEyebrow = useMemo(() => {
    try {
      const planLen = mealPlan?.length ?? 0;
      // F2-D (2026-04-28): reflect the chosen start offset (Today / Tomorrow /
      // Next week). The persisted `mealPlan[0].day` offset still contributes
      // for backwards-compat with plans saved before the picker existed.
      const first = planCalendarDateForIndex(0, startOffset);
      if (planLen > 0 && typeof mealPlan?.[0]?.day === "number") {
        first.setDate(first.getDate() + (mealPlan[0]!.day - 1));
      }
      const last = planCalendarDateForIndex(Math.max(planLen - 1, 0), startOffset);
      if (planLen > 0 && typeof mealPlan?.[0]?.day === "number") {
        last.setDate(last.getDate() + (mealPlan[0]!.day - 1));
      }
      const fmt = (d: Date) =>
        d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (first.getMonth() === last.getMonth()) {
        return `${fmt(first)} – ${last.getDate()} · Meal plan`;
      }
      return `${fmt(first)} – ${fmt(last)} · Meal plan`;
    } catch {
      return "This week";
    }
  }, [mealPlan, startOffset]);

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
  // e2e walk 2026-06-10 (mirror of mobile planner): a freshly-created plan
  // is all placeholder slots — don't score the empty week or advise on
  // meals that don't exist; invite the user to Generate instead.
  const planHasRealMeals = useMemo(
    () => (mealPlan ?? []).some((dp) => dp.meals.some((m) => !m.isPlaceholder && !!m.recipeTitle)),
    [mealPlan],
  );
  const lockedMealCount = useMemo(
    () =>
      mealLockEnabled
        ? (mealPlan ?? []).reduce(
            (a, dp) => a + dp.meals.filter((m) => m.isLocked).length,
            0,
          )
        : 0,
    [mealLockEnabled, mealPlan],
  );
  const {
    resetPlan,
    handleRegenerate,
    requestRegenerate,
    handleResetPlanConfirm,
  } = useMealPlanRegenerate({
    isFree,
    planDays,
    enabledSlots,
    slots: SLOTS,
    slotTitle: (key) => SLOT_TITLE[key as SlotKey],
    slotsOverride: numberedPresetSlots,
    mealLockEnabled,
    lockedMealCount,
    planSourceSelector,
    planSource,
    allowBatchLeftovers,
    planHasRealMeals,
    generateMealPlan,
    generateShoppingListFromPlan,
    setIsGenerating,
  });
  // ENG-956 — the primary regenerate CTA's verb. "Refresh the rest" when ≥1
  // meal is locked (we keep those + re-roll the rest); otherwise the existing
  // Generate (empty plan) / Regenerate (populated plan) wording.
  const regenerateLabel = (populated: boolean): string => {
    if (lockedMealCount > 0) return "Refresh the rest";
    return populated ? "Regenerate" : "Generate";
  };
  const summarySubtitle = summary
    ? planHasRealMeals
      ? buildPlanWeekSummarySubtitle(summary, worstShortDayLabel)
      : `Generate fills all ${summary.total} day${summary.total === 1 ? "" : "s"} around your targets — or add meals to any day below.`
    : null;
  const showSummaryCard = summary !== null && (mealPlan?.length ?? 0) > 0;

  // ENG-820 (Plan win-moment) — behind `redesign_winmoment` the "Hits your
  // targets N of 7" headline colours by tone (mobile parity): win → `--accent-win`
  // (gold), progress → `--warning` (amber, never red), calm → `--muted-foreground`.
  // Flag OFF keeps `text-foreground`. No haptic analog on web — colour + subtitle
  // carry the payoff.
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
            // ENG-1150 — keep fiber in the day total so adding a slot back
            // doesn't reset the day's fiber cell to 0.
            fiberG: acc.fiberG + (Number((m as { fiberG?: number }).fiberG) || 0),
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0 },
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

  useEffect(() => {
    if (!planWebParity || !templatesOpen || !authedUserId) return;
    let cancelled = false;
    setTemplatesLoading(true);
    void listPlanTemplates(supabase, authedUserId).then(({ templates, error }) => {
      if (cancelled) return;
      if (error) {
        toast.error("Could not load templates", { description: error });
      } else {
        setPlanTemplates(templates);
      }
      setTemplatesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [planWebParity, templatesOpen, authedUserId, templatesLoadAttempt]);

  const handleMoveMeal = useCallback(
    (from: { day: number; slotIndex: number }, to: { day: number; slotIndex: number }) => {
      if (from.day === to.day && from.slotIndex === to.slotIndex) return;
      setMealPlan((prev) => {
        if (!prev) return prev;
        const fromDp = prev.find((d) => d.day === from.day);
        const toDp = prev.find((d) => d.day === to.day);
        const fromSlot = fromDp?.meals[from.slotIndex]?.name ?? "";
        const toSlot = toDp?.meals[to.slotIndex]?.name ?? "";
        const next = moveMealInPlan(prev, from, to);
        track(AnalyticsEvents.meal_moved_in_plan, {
          fromSlot,
          toSlot,
          crossDay: from.day !== to.day,
        });
        return next;
      });
      toast.success("Meal moved");
    },
    [setMealPlan],
  );

  // ENG-956 — toggle the per-meal lock ("keep this meal"). Pure local plan
  // mutation; persists through the same slot-plan store as swap/move/portion.
  const toggleMealLock = useCallback(
    (day: number, mealIndex: number, slotName: string) => {
      let nextLocked = false;
      let lockedCount = 0;
      setMealPlan((prev) => {
        if (!prev) return prev;
        const next = prev.map((dp) => {
          if (dp.day !== day) return dp;
          return {
            ...dp,
            meals: dp.meals.map((m, mi) =>
              mi === mealIndex ? { ...m, isLocked: !m.isLocked } : m,
            ),
          };
        });
        const target = next
          .find((dp) => dp.day === day)
          ?.meals[mealIndex];
        nextLocked = Boolean(target?.isLocked);
        lockedCount = next.reduce(
          (a, dp) => a + dp.meals.filter((m) => m.isLocked).length,
          0,
        );
        return next;
      });
      track(AnalyticsEvents.plan_meal_lock_toggled, {
        locked: nextLocked,
        slot: slotName,
        lockedCount,
        platform: "web",
      });
    },
    [setMealPlan],
  );

  const handlePortionSelect = useCallback(
    (multiplier: number) => {
      if (!portionTarget) return;
      const recipePool = [...discoverRecipes, ...savedRecipesForLibrary].map((r) => ({
        id: r.id,
        title: r.title,
        calories: r.calories,
      }));
      setMealPlan((prev) => {
        if (!prev) return prev;
        return prev.map((dp) => {
          if (dp.day !== portionTarget.day) return dp;
          const newMeals = dp.meals.map((m, mi) => {
            if (mi !== portionTarget.mealIndex) return m;
            const cur = planMealDisplayMultiplier(m, recipePool);
            const baseCals = m.calories / cur;
            const basePro = m.protein / cur;
            const baseCarbs = m.carbs / cur;
            const baseFat = m.fat / cur;
            const baseFiber = ((m as { fiberG?: number }).fiberG ?? 0) / cur;
            return {
              ...m,
              portionMultiplier: multiplier,
              calories: Math.round(baseCals * multiplier),
              protein: Math.round(basePro * multiplier),
              carbs: Math.round(baseCarbs * multiplier),
              fat: Math.round(baseFat * multiplier),
              fiberG: Math.round(baseFiber * multiplier * 10) / 10,
            };
          });
          const totals = newMeals.reduce(
            (acc, m) => ({
              calories: acc.calories + (Number(m.calories) || 0),
              protein: acc.protein + (Number(m.protein) || 0),
              carbs: acc.carbs + (Number(m.carbs) || 0),
              fat: acc.fat + (Number(m.fat) || 0),
              fiberG:
                acc.fiberG + (Number((m as { fiberG?: number }).fiberG) || 0),
            }),
            { calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0 },
          );
          return { ...dp, meals: newMeals, totals };
        });
      });
      toast.success("Portion updated");
    },
    [portionTarget, discoverRecipes, savedRecipesForLibrary, setMealPlan],
  );

  const templateSourceMealCount = useMemo(() => {
    if (!planWebParity) return 0;
    return (mealPlan ?? []).reduce(
      (n, d) =>
        n +
        d.meals.filter(
          (m) =>
            !isMealPlanPlaceholderLikeTitle(m.recipeTitle, { isPlaceholder: m.isPlaceholder }) &&
            !(m as { leftoverOf?: string }).leftoverOf,
        ).length,
      0,
    );
  }, [planWebParity, mealPlan]);

  const moveDayLabels = useMemo(
    () =>
      (mealPlan ?? []).map((_, idx) =>
        shortWeekdayLabel(planCalendarDateForIndex(idx, startOffset)),
      ),
    [mealPlan, startOffset],
  );

  const portionRecipePool = useMemo(
    () =>
      [...discoverRecipes, ...savedRecipesForLibrary].map((r) => ({
        id: r.id,
        title: r.title,
        calories: r.calories,
      })),
    [discoverRecipes, savedRecipesForLibrary],
  );

  const recipeTitleToId = useCallback(
    (title: string) => {
      const pool = [...discoverRecipes, ...savedRecipesForLibrary];
      return pool.find((r) => r.title === title)?.id ?? null;
    },
    [discoverRecipes, savedRecipesForLibrary],
  );

  const suggestionPoolIds = useMemo(
    () => savedRecipesForLibrary.map((r) => r.id),
    [savedRecipesForLibrary],
  );
  const suggestionPoolKey = suggestionPoolIds.join(",");

  useEffect(() => {
    if (!planWebParity || !authedUserId || suggestionPoolIds.length === 0) {
      setSuggestionIngredients(new Map());
      return;
    }
    let cancelled = false;
    void supabase
      .from("recipe_ingredients")
      .select("recipe_id, name")
      .in("recipe_id", suggestionPoolIds)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) return;
        const map = new Map<string, string[]>();
        for (const row of data ?? []) {
          const recipeId = String((row as { recipe_id: string }).recipe_id ?? "");
          const name = String((row as { name: string }).name ?? "");
          if (!recipeId || !name) continue;
          const bucket = map.get(recipeId) ?? [];
          bucket.push(name);
          map.set(recipeId, bucket);
        }
        setSuggestionIngredients(map);
      });
    return () => {
      cancelled = true;
    };
  }, [planWebParity, authedUserId, suggestionPoolKey, suggestionPoolIds]);

  const smartSuggestions = useMemo(() => {
    if (!planWebParity || !planHasRealMeals) return [];
    return computeSmartRecipeSuggestions({
      mealPlan,
      titleToId: recipeTitleToId,
      dbIngredientsByRecipeId: suggestionIngredients,
      extraRecipePool: savedRecipesForLibrary,
      max: 4,
    });
  }, [
    planWebParity,
    planHasRealMeals,
    mealPlan,
    recipeTitleToId,
    suggestionIngredients,
    savedRecipesForLibrary,
  ]);

  const handleSaveSmartSuggestion = useCallback(
    (recipeId: string) => {
      const saved = toggleSaveRecipe(recipeId, userTier);
      if (saved) {
        track(AnalyticsEvents.smart_suggestion_saved, {
          recipeId,
          platform: "web",
        });
        toast.success("Saved to your library");
      }
    },
    [toggleSaveRecipe, userTier],
  );

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
            // ENG-1150 — write the scaled new-recipe fibre onto the row (parity
            // with the mobile swap handler) so the row and the day total carry
            // the swapped meal's fibre, not the previous recipe's stale value.
            fiberG: scaled.fiberG ?? (m as { fiberG?: number }).fiberG,
            portionMultiplier: undefined,
          };
        });
        const totals = newMeals.reduce(
          (acc, m) => {
            acc.calories += Math.max(0, Math.round(Number(m.calories) || 0));
            acc.protein += Math.max(0, Math.round(Number(m.protein) || 0));
            acc.carbs += Math.max(0, Math.round(Number(m.carbs) || 0));
            acc.fat += Math.max(0, Math.round(Number(m.fat) || 0));
            // ENG-1150 — carry fiber through a swap so the day-total fiber
            // cell doesn't drop to 0 after swapping a meal.
            acc.fiberG += Math.max(
              0,
              Math.round((Number((m as { fiberG?: number }).fiberG) || 0) * 10) / 10,
            );
            return acc;
          },
          { calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0 },
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
    // ENG-1278 — numbered slots ("Meal N") have no classic slot-fit → full pool.
    const slot = slotMap[swapFor.slot.toLowerCase() as SlotKey];
    if (!slot) return pool;
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

  const batchCookCandidates = useMemo<BatchCookRecipeCandidate[]>(() => {
    return savedRecipesForLibrary
      .filter((r) =>
        isBatchCookCandidate({
          prepTimeMin: r.prepTimeMin ?? null,
          cookTimeMin: r.cookTimeMin ?? null,
        }),
      )
      .slice(0, 12)
      .map((r) => ({
        id: r.id,
        title: r.title,
        calories: r.calories ?? 0,
        protein: r.protein ?? 0,
        timeMin: recipeTotalTimeMin(r.prepTimeMin, r.cookTimeMin),
        servings: r.servings ?? 1,
        imageUrl: r.image ?? null,
      }));
  }, [savedRecipesForLibrary]);

  const scaleBatchCookToShopping = useCallback(
    async (recipe: BatchCookRecipeCandidate, portions: number) => {
      if (!authedUserId) {
        toast.error("Sign in to update your shopping list.");
        return false;
      }
      const { data: ingredients, error } = await supabase
        .from("recipe_ingredients")
        .select("name, amount, unit, recipe_id")
        .eq("recipe_id", recipe.id);
      if (error || !ingredients?.length) {
        toast.error("This recipe has no ingredient lines to scale yet.");
        return false;
      }
      const multiplier = batchShoppingMultiplier(portions, recipe.servings);
      const titleToId = (title: string) => (title === recipe.title ? recipe.id : null);
      const ingredientsByRecipeId = new Map<
        string,
        Array<{ name: string; amount: string; unit: string }>
      >([
        [
          recipe.id,
          ingredients.map((ing) => ({
            name: String(ing.name ?? ""),
            amount: ing.amount != null ? String(ing.amount) : "",
            unit: String(ing.unit ?? ""),
          })),
        ],
      ]);
      const generated = await generateShoppingListFromRecipeEntriesAsync({
        entries: [{ title: recipe.title, multiplier }],
        recipeTitleToId: titleToId,
        fetchDbIngredients: async (recipeId) => ingredientsByRecipeId.get(recipeId) ?? [],
        fetchDbIngredientsBatch: async () => ingredientsByRecipeId,
      });
      const filtered = filterShoppingItemsByPantry(generated, pantryStaples);
      setShoppingItems(filtered);
      const items = filtered.map((it) => ({
        name: it.name,
        amount: it.amount,
        unit: it.unit,
        category: it.category,
        checked: false,
      }));
      const { error: upErr } = await upsertShoppingListJsonItems(supabase, authedUserId, items);
      if (upErr) {
        toast.error(upErr.message);
        return false;
      }
      return true;
    },
    [authedUserId, pantryStaples, setShoppingItems],
  );

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

  const adjustInitial = useMemo<PlanAdjustConstraints>(
    () => ({
      source: planSource,
      calorieFloor: planCalorieFloor,
      mealsPerDay: mealsPerDayFromEnabledSlots(enabledSlots),
      allowBatchLeftovers,
    }),
    [planSource, planCalorieFloor, enabledSlots, allowBatchLeftovers],
  );

  const handleAdjustSave = useCallback(
    async (next: PlanAdjustConstraints) => {
      setPlanSource(next.source);
      setEnabledSlots(
        enabledSlotsForMealsPerDay(next.mealsPerDay) as Set<SlotKey>,
      );
      setAllowBatchLeftovers(next.allowBatchLeftovers);
      setPlanCalorieFloor(next.calorieFloor);
      setAdjustOpen(false);
      setIsGenerating(true);
      try {
        const days = isFree ? 1 : planDays;
        const slotsList: string[] = SLOTS.filter((s) =>
          enabledSlotsForMealsPerDay(next.mealsPerDay).has(s),
        ).map((s) => SLOT_TITLE[s]);
        // ENG-1177 — numbered preset overrides; else classic per-slot toggle.
        const slotsOverride =
          numberedPresetSlots ??
          (slotsList.length > 0 && slotsList.length < SLOTS.length ? slotsList : null);
        await generateMealPlan({
          days,
          ...(slotsOverride ? { slots: slotsOverride } : {}),
          ...(planSourceSelector ? { source: next.source } : {}),
          allowLeftovers: next.allowBatchLeftovers,
          calorieFloorMin: next.calorieFloor,
        });
        await generateShoppingListFromPlan();
        toast.success("Constraints saved — plan regenerated");
      } catch {
        toast.error("Could not regenerate plan. Save more recipes and try again.");
      } finally {
        setIsGenerating(false);
      }
    },
    [
      generateMealPlan,
      generateShoppingListFromPlan,
      isFree,
      planDays,
      planSourceSelector,
      numberedPresetSlots,
    ],
  );

  return (
    <div className="product-shell py-pm-6 space-y-5">
      {sloeV3Plan ? (
        <PlanV3Connected
          plan={plan}
          targetCalories={targetCalories}
          startOffset={startOffset}
          household={householdBanner}
          onGenerate={requestRegenerate}
          onAdjust={() => setAdjustOpen(true)}
          onTemplates={() => setTemplatesOpen(true)}
          onOpenHousehold={() => setTemplatesOpen(true)}
          onOpenShopping={handleShoppingList}
          onOpenBatchCook={() => setBatchCookOpen(true)}
          batchCookSubtitle={defaultBatchCookToolSubtitle()}
          nutritionByDay={nutritionByDay}
          onSwapSlot={(day, slotIndex) =>
            openSwap(day, SLOTS[slotIndex] ?? "snacks", slotIndex)
          }
        />
      ) : (
        <>
      <div className="hidden md:block">
      {/* Sloe DS (Figma 523:2 / ENG-919) — page title reads in Newsreader
          serif plum (`text-foreground-brand`), matching the Today / Progress /
          Settings landmark headings. Replaces the prior Inter-bold ink H1 so
          the Plan tab speaks the same warm-editorial language. */}
      {/* ENG-1020 (2026-06-13): the page subtitle ("Week of {date} · hits
          targets N of M days") was dropped — it duplicated the summary card's
          "Hits your targets N of M days" headline below, and the week-date
          now rides the card's "{start} – {end} · Meal plan" eyebrow. Mirrors
          mobile `planner.tsx`, where the page subheader was dropped on the
          2026-06-10 e2e walk in favour of the single card eyebrow. */}
      <h1
        className="font-[family-name:var(--font-headline)] text-3xl font-medium tracking-tight text-foreground-brand"
        style={{ margin: "0 0 20px" }}
      >
        Meal plan
      </h1>
      </div>

      {/* F2-L (audit 2026-04-28): legacy household bar — v3-OFF path only (the
          v3 surface uses the `household` banner prop, ENG-1247). Self-hides for
          solo users. Mobile parity: planner.tsx `<HouseholdSummaryRow />`. */}
      <HouseholdBar />

      {/* F2-F (2026-04-28): week summary card. Mobile parity at planner.tsx
          :1639-1698. "hits targets N of M days" headline + worst-short diagnosis
          + Shopping/Regenerate CTAs. Hidden when no plan (bottom CTA takes over). */}
      {showSummaryCard && summary ? (
        <SupprCard
          data-testid="planner-week-summary-card"
          // One-treatment soft lift (2026-06-09): page-ground slab → soft
          // `.card-slab` like every resting card (mirrors mobile `lift="soft"`).
          elevation="card"
          padding="lg"
          radius="xl"
          className="mb-4"
        >
          {/* ENG-820 — one-shot scale-pulse keyframe for the win rising edge.
              Scoped inline (no theme.css edit); prefers-reduced-motion disables it. */}
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
              {/* ENG-1020 (2026-06-13): week-range eyebrow. Mirrors mobile
                  `summaryOverline` ("{start} – {end} · Meal plan") and takes
                  over the week-date that used to sit in the page subtitle.
                  Web eyebrow grammar (uppercase / 0.1em tracking / muted),
                  matching the slot-switcher + add-slot eyebrows on this
                  surface. */}
              <p
                data-testid="planner-week-summary-eyebrow"
                className="text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground mb-1"
              >
                {weekRangeEyebrow}
              </p>
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
                {planHasRealMeals
                  ? `Hits your targets ${summary.hits} of ${summary.total} day${summary.total === 1 ? "" : "s"}`
                  : "Plan your week"}
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
          {/* Cohesion wave (2026-06-13, ENG-1080): Regenerate is this card's
              ONE primary action → solid `SupprButton` primary; Shopping list
              is the secondary → `ghost`. Was an outline pill + beige
              `bg-card` slab. Mobile parity: summary card's primary
              Generate + ghost Adjust pairing. */}
          <div className="flex flex-wrap gap-2">
            <SupprButton
              variant="primary"
              loading={isGenerating}
              onClick={requestRegenerate}
            >
              <RefreshCw size={14} strokeWidth={2} />
              {/* DC12 parity (2026-06-13): "Regenerate" misreads in the
                  placeholder-slots / no-real-meals form of this card — nothing
                  has been generated yet. Use "Generate" there, matching mobile's
                  summary-card verb + the bottom-row CTA's plan-state flip.
                  ENG-956: "Refresh the rest" when ≥1 meal is locked. */}
              {regenerateLabel(planHasRealMeals)}
            </SupprButton>
            <SupprButton variant="ghost" onClick={handleShoppingList}>
              <ShoppingCart size={14} strokeWidth={2} />
              Shopping list
            </SupprButton>
            {planWebParity ? (
              <SupprButton variant="ghost" onClick={() => setTemplatesOpen(true)}>
                <LayoutTemplate size={14} strokeWidth={2} />
                Templates
              </SupprButton>
            ) : null}
            {planImportEnabled ? (
              <SupprButton
                variant="ghost"
                onClick={() => onNavigate?.("plan-import")}
                data-testid="plan-import-entry"
              >
                <Upload size={14} strokeWidth={2} />
                Import plan
              </SupprButton>
            ) : null}
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
                // Chip grammar (web parity 2026-06-10, ENG-1022): selected =
                // `bg-primary-soft` fill + `primary-solid` label +
                // `font-semibold`, NO ring/border; unselected = quiet `bg-card`
                // + muted label, NO border. Was `border-primary bg-primary/10`
                // selected / `border-border` unselected.
                className={[
                  "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  active
                    ? "bg-primary-soft text-primary-solid font-semibold"
                    : "bg-card text-muted-foreground font-medium hover:bg-muted/60",
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

      {(() => {
      // ENG-1092 inc 3 — the three config rows, defined once so they render
      // either inline (flag off) or inside the "Adjust plan" popover (flag on).
      const startLabel =
        startOffset === 0 ? "Today" : startOffset === 1 ? "Tomorrow" : "Next week";
      const enabledList = SLOTS.filter((s) => enabledSlots.has(s));
      const SHORT_SLOT: Record<string, string> = {
        breakfast: "Brk",
        lunch: "Lun",
        dinner: "Din",
        snacks: "Snk",
      };
      const mealsLabel =
        enabledList.length === SLOTS.length
          ? "All meals"
          : enabledList.length === 0
          ? "No meals"
          : enabledList.map((s) => SHORT_SLOT[s] ?? s).join(" · ");
      const planSummaryLabel = `${planDays} day${planDays > 1 ? "s" : ""} · ${startLabel} · ${mealsLabel}`;
      const configRows = (
      <>
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
              // §7 option-pill grammar (web parity 2026-06-12, ENG-1022): the
              // tint IS the selection signal — `bg-primary/10` fill +
              // `border-primary/10` (a 10% tint edge, NO solid accent ring) +
              // `primary-solid` label. Mirror of the mobile `dayBtnActivePrimary`
              // (`tint + "1A"` border + fill, `primarySolid` label). Was a solid
              // `border-primary` accent ring — the §7 drift this pass converges.
              className={[
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold border transition-all",
                active
                  ? "border-primary/10 bg-primary/10 text-primary-solid"
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

      {/* F2-H (2026-04-28): slot toggles (mobile parity). Toggle off slots the
          regenerator shouldn't fill (e.g. Snacks); ≥1 must stay enabled.
          ENG-1278 — classic-only: numbered presets set slot count in Settings. */}
      {numberedPresetSlots ? null : (
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
              // §7 option-pill grammar (web parity 2026-06-12, ENG-1022): tint
              // IS the signal — `bg-primary/10` + `border-primary/10` (no solid
              // accent ring) + `primary-solid` label. Same treatment as the
              // Plan-length + Start pills, and the mobile slot toggle reuses the
              // same `dayBtnActivePrimary` style. Was `border-primary`.
              className={[
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all capitalize",
                enabled
                  ? "border-primary/10 bg-primary/10 text-primary-solid"
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
      )}

      {/* F2-D (2026-04-28): start-date picker (mobile parity). */}
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
              // §7 option-pill grammar (web parity 2026-06-12, ENG-1022):
              // tint IS the signal — `bg-primary/10` + `border-primary/10`
              // (no solid accent ring) + `primary-solid` label. Identical
              // treatment to the "Plan length" pills above. Was `border-primary`.
              className={[
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold border transition-all",
                active
                  ? "border-primary/10 bg-primary/10 text-primary-solid"
                  : "border-border text-foreground hover:bg-muted/60",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>
      </>
      );
      if (!planAdjustCollapsed) return configRows;
      // Collapsed: one ghost "Adjust plan" control showing the current settings
      // (defaults stay loud), opening a popover with the full pickers.
      return (
        <div className="mb-3">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                data-testid="planner-adjust-plan"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={`Adjust plan — currently ${planSummaryLabel}`}
              >
                <Sliders size={14} aria-hidden />
                <span className="tabular-nums">{planSummaryLabel}</span>
                <ChevronDown size={14} aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 space-y-1.5">
              {configRows}
            </PopoverContent>
          </Popover>
        </div>
      );
      })()}

      {/* ONE-CTA LAW (ENG-1080 cohesion wave, 2026-06-13): the big empty-state
          card carries its own solid Generate, so it must NOT co-render with the
          summary card (which also leads with a solid Generate/Regenerate). When
          a summary card is showing — including its "Plan your week" /
          placeholder-slots form (`showSummaryCard` true, `planHasRealMeals`
          false) — the summary card is the lead and we drop to the kanban, whose
          7 empty day columns + add chips mirror mobile's empty day rows exactly.
          The empty-state card only leads when there is NO summary card (truly no
          plan/targets). Without `&& !showSummaryCard` both cards rendered two
          solid primaries on the most-seen Plan state. */}
      {isPlanEmpty && !showSummaryCard ? (
        <SupprCard
          data-testid="planner-empty-state"
          // Flat-card surfaces (2026-06-12, Withings grammar): `elevation="card"`
          // now resolves to the flat `.card-slab` (zero shadow/border) — the
          // soft lift was retired with the flat-card decision. White-on-cream
          // contrast is the separation. Matches the mobile `PlanEmptyState` twin.
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
              ? `Pick where your recipes come from above, then hit generate — Sloe balances a ${planDays}-day plan to your calorie and macro targets.`
              : `Hit generate and we'll build a ${planDays}-day meal plan from your saved recipes, balanced to your calorie and macro targets.`}
          </p>
          {/* Cohesion wave (2026-06-13, ENG-1080): the empty-state Generate
              is this surface's ONE action → solid `SupprButton` primary
              (aubergine fill, white sans label, pill). Was the retired
              aubergine OUTLINE pill. `loading` disables + spins; the
              source-blocked case stays disabled via `disabled`. Mobile
              parity: `planner.tsx` `plan-generate-menu` solid primary. */}
          <SupprButton
            data-testid="planner-empty-generate-btn"
            variant="primary"
            loading={isGenerating}
            disabled={!sourceCanGenerate}
            onClick={() => void handleRegenerate()}
          >
            {isGenerating ? "Generating…" : "Generate meal plan"}
          </SupprButton>
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
              <span className="font-semibold text-foreground">Library &amp; discovery</span> above to use Sloe&apos;s recipes.
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
          // e2e walk 2026-06-10 (mobile parity): gate the kcal header +
          // P/C/F delta chips on the day having a REAL meal (recipe chosen,
          // not a placeholder), not merely a non-empty slot list. A
          // placeholder-only day has `meals.length > 0` but all-zero totals,
          // which rendered a wall of "P 0g −99g" delta chips under a blank
          // day. Same per-day predicate as `planHasRealMeals` and mobile
          // `dp.meals.some(planMealHasRecipe)`.
          const dayHasRealMeal = dp.meals.some(
            (m) => !m.isPlaceholder && !!m.recipeTitle,
          );
          const renderTotals = dayTotalLine.hasTargets && dayHasRealMeal;
          // F2-A (2026-04-28) / ENG-1278: bySlot indexes the user's REAL
          // configured slots (classic four OR a numbered 4-/6-meal preset),
          // keyed by lowercased label so both "Snacks" and "Meal 5" match. Pre-
          // fix the grid dropped snack rows (F2-A) + every numbered meal (1278).
          const bySlot = new Map<
            string,
            { mealIndex: number; meal: DayPlan["meals"][number] } | null
          >();
          for (const s of daySlots) bySlot.set(s.toLowerCase(), null);
          dp.meals.forEach((m, i) => {
            const key = String(m.name ?? "").toLowerCase();
            if (bySlot.has(key) && bySlot.get(key) == null) {
              bySlot.set(key, { mealIndex: i, meal: m });
            }
          });
          return (
            // One-treatment soft lift (2026-06-09, one-card-treatment-soft-
            // elevation.md): each per-day column sits on the page-ground grid →
            // soft `.card-slab`; Today keeps tone="primary". Mobile renders Plan
            // days as a continuous list — that layout divergence predates this.
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
              {/* F2-E (2026-04-28): day total vs goal — calories header + P/C/F
                  delta chips (mobile parity). F2 follow-up #3 added a slim per-
                  day progress bar (see 2026-04-28-plan-day-summary-strip-web-
                  divergence.md); the mobile day-summary strip stays mobile-only
                  (the web 7-column grid serves the same spatial function). */}
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
              {daySlots.map((slot) => {
                // ENG-1278 — `slot` is the display label (classic title OR
                // "Meal N"); lookups (bySlot, aim map) key by its lowercase form.
                const slotKey = slot.toLowerCase();
                const SlotIcon = slotIconFor(slot);
                const entry = bySlot.get(slotKey);
                if (!entry) {
                  const emptyAim = canonicalSlotAim[slotKey] ?? null;
                  return (
                    <PlanAbsentMealSlotRow
                      key={slot}
                      slot={slot}
                      SlotIcon={SlotIcon}
                      aimKcal={emptyAim}
                    />
                  );
                }
                const { mealIndex, meal } = entry;
                const isPlaceholder = isMealPlanPlaceholderLikeTitle(meal.recipeTitle, {
                  isPlaceholder: meal.isPlaceholder,
                });
                // ENG-1092 — aim for this empty (placeholder) slot; null on the
                // optional Snacks slot, no target, or a populated row.
                const slotAim = isPlaceholder ? (canonicalSlotAim[slotKey] ?? null) : null;
                const kcal = Math.round(Math.max(0, Number(meal.calories) || 0));
                const prot = Math.round(Math.max(0, Number(meal.protein) || 0));
                const recipeId = (meal as { recipeId?: string }).recipeId;
                // Recipe-wave (2026-05-10) — a stale recipeId (set on the row
                // but no longer in the library/discover pool) shows a "Recipe
                // removed" badge below; placeholder rows (no recipeId) stay
                // silent. ENG-766 — gate on a hydrated library (`size > 0`, the
                // only loading proxy AppDataContext exposes) so a row never
                // flashes the badge before the pool loads.
                const recipeMissing = shouldShowRecipeRemovedBadge({
                  hasRecipe: Boolean(recipeId),
                  recipeId,
                  knownRecipeIds,
                  libraryLoaded: knownRecipeIds.size > 0,
                });
                // F2-E (2026-04-28): per-meal portion-multiplier badge. Hidden
                // at 1× (silent default); display-only — post-portion macros are
                // already baked into `meal.calories` (F30 fix), so it explains,
                // doesn't multiply.
                const portionLabel = formatPortionMultiplier(
                  (meal as { portionMultiplier?: number }).portionMultiplier,
                );
                // F2-J (2026-04-28): leftover badge. `leftoversPlanner.ts` tags
                // downstream slots (`leftoverOf` / `isLeftover`) when a recipe
                // yields multiple servings; display-only so a leftover portion
                // reads as a repeat, not an independent meal.
                const isLeftover = Boolean(
                  (meal as { isLeftover?: boolean }).isLeftover ||
                    (meal as { leftoverOf?: string }).leftoverOf,
                );
                // ENG-956 — per-meal lock. Only meaningful on populated,
                // non-leftover rows (a placeholder / leftover has no recipe to
                // keep). Gated by the `plan_meal_lock_v1` flag.
                const lockAvailable = mealLockEnabled && !isPlaceholder && !isLeftover;
                const mealLocked = Boolean((meal as { isLocked?: boolean }).isLocked);
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
                      {/* ENG-1092: an empty slot with an aim drops the "Empty
                          slot" title — the slot eyebrow above + the "Aim ~X
                          kcal" line below carry it. Populated rows + no-aim
                          empties keep the title. */}
                      {isPlaceholder && slotAim != null ? null : (
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
                            className="shrink-0 inline-flex items-center rounded-full bg-primary/15 text-primary-solid tabular-nums"
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
                      )}
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
                      {/* ENG-808 web parity (2026-06-12): match the
                          mobile planner leftover badge — Lucide Package
                          glyph in the warning/amber accent, not the old
                          text-only success green (wrong semantics: a
                          leftover is a "caution, this is a repeat" note,
                          not a "good" state). Mobile renders
                          `<Package size={10} color={Accent.warning} />`
                          at apps/mobile/app/(tabs)/planner.tsx. */}
                      {isLeftover ? (
                        <span
                          data-testid="meal-planner-leftover-badge"
                          className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning-solid"
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "1px 6px",
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            marginBottom: 4,
                          }}
                          aria-label={`Leftover of ${meal.recipeTitle || "meal"}`}
                        >
                          <Package className="h-2.5 w-2.5" aria-hidden="true" />
                          Leftover
                        </span>
                      ) : null}
                      {isPlaceholder && slotAim != null ? (
                        <EmptyMealSlotAimLine
                          slot={slot}
                          aimKcal={slotAim}
                          surface="plan"
                          density="compact"
                        />
                      ) : (
                        <p
                          className="text-muted-foreground tabular-nums"
                          style={{ fontSize: 10 }}
                        >
                          {isPlaceholder ? "— kcal · — P" : `${kcal} kcal · ${prot} P`}
                        </p>
                      )}
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
                    {/* ENG-956 — quiet per-row lock glyph. Muted when unlocked
                        (a subtle "you could keep this"), foreground when locked.
                        Sits to the LEFT of the action menu (right:38 = 8 + 22 +
                        8) so the two top-right affordances don't overlap; falls
                        back to right:8 when the parity menu isn't rendered. */}
                    {lockAvailable ? (
                      <button
                        type="button"
                        data-testid="meal-planner-lock-toggle"
                        onClick={() => toggleMealLock(dp.day, mealIndex, slot)}
                        aria-label={mealLocked ? `Unlock ${slot}` : `Keep ${slot}`}
                        aria-pressed={mealLocked}
                        title={mealLocked ? "Locked — won't change on Refresh" : "Keep this meal"}
                        className={`absolute grid place-items-center bg-card ${
                          mealLocked
                            ? "text-foreground"
                            : "text-muted-foreground/60 hover:text-foreground"
                        }`}
                        style={{
                          top: 8,
                          right: planWebParity ? 38 : 8,
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          cursor: "pointer",
                        }}
                      >
                        {mealLocked ? <Lock size={11} /> : <LockOpen size={11} />}
                      </button>
                    ) : null}
                    {planWebParity ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Actions for ${slot}`}
                            title="Meal actions"
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
                            <MoreHorizontal size={11} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border">
                          {/* ENG-956 — "Keep this meal" is the first-class lock
                              action; the row's Lock glyph is the quick toggle. */}
                          {lockAvailable ? (
                            <DropdownMenuItem
                              onClick={() => toggleMealLock(dp.day, mealIndex, slot)}
                              className="cursor-pointer"
                            >
                              {mealLocked ? (
                                <LockOpen size={14} className="mr-2" />
                              ) : (
                                <Lock size={14} className="mr-2" />
                              )}
                              {mealLocked ? "Unlock this meal" : "Keep this meal"}
                            </DropdownMenuItem>
                          ) : null}
                          {!isPlaceholder ? (
                            <>
                              <DropdownMenuItem
                                onClick={() => handleLogToday(meal)}
                                className="cursor-pointer"
                              >
                                Log today
                              </DropdownMenuItem>
                              {recipeId && !recipeMissing ? (
                                <DropdownMenuItem
                                  onClick={() => onOpenRecipe?.(recipeId)}
                                  className="cursor-pointer"
                                >
                                  View recipe
                                </DropdownMenuItem>
                              ) : null}
                            </>
                          ) : null}
                          <DropdownMenuItem
                            onClick={() => openSwap(dp.day, slot, mealIndex)}
                            className="cursor-pointer"
                          >
                            <RefreshCw size={14} className="mr-2" />
                            Swap meal
                          </DropdownMenuItem>
                          {!isPlaceholder ? (
                            <DropdownMenuItem
                              onClick={() =>
                                setPortionTarget({ day: dp.day, mealIndex })
                              }
                              className="cursor-pointer"
                            >
                              <Scale size={14} className="mr-2" />
                              Change portion size…
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            onClick={() =>
                              setMoveFrom({ day: dp.day, slotIndex: mealIndex })
                            }
                            className="cursor-pointer"
                          >
                            <ArrowRightLeft size={14} className="mr-2" />
                            Move to different slot
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
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
                    )}
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
                    {!isPlaceholder && !planWebParity ? (
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
              {/* F2-I (2026-04-28): "Add slot back" chips for any canonical slot
                  missing from this day (mobile parity). ENG-1278 — classic-only:
                  numbered presets manage their slot count in Settings, not via
                  per-day chips, so the classic add-back is suppressed for them. */}
              {numberedPresetSlots ? null : (() => {
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

      {planWebParity && planHasRealMeals && smartSuggestions.length > 0 ? (
        <SupprCard
          data-testid="planner-smart-suggestions"
          elevation="card"
          padding="lg"
          radius="xl"
          className="mt-2"
        >
          <div className="flex items-start gap-2 mb-3">
            <Sparkles size={16} className="text-primary-solid mt-0.5 shrink-0" aria-hidden />
            <div>
              <h2 className="text-base font-semibold text-foreground">Smart suggestions</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Recipes that share ingredients already in your plan — less waste, fewer one-off buys.
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {smartSuggestions.map((s) => {
              const overlap = s.sharedIngredients.slice(0, 3).join(", ");
              const extra =
                s.sharedIngredients.length > 3
                  ? ` +${s.sharedIngredients.length - 3} more`
                  : "";
              return (
                <li
                  key={s.recipe.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onOpenRecipe?.(s.recipe.id)}
                      className="text-left text-[13px] font-semibold text-foreground hover:text-primary-solid transition-colors truncate max-w-full"
                    >
                      {s.recipe.title}
                    </button>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      Also uses {overlap}
                      {extra}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {Math.round(s.recipe.calories)} kcal
                    </span>
                    {s.recipe.isSaved ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Saved
                      </span>
                    ) : (
                      <SupprButton
                        variant="ghost"
                        className="h-8 px-2 text-[11px]"
                        onClick={() => handleSaveSmartSuggestion(s.recipe.id)}
                      >
                        Save
                      </SupprButton>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </SupprCard>
      ) : null}

      {/* F2-F (2026-04-28): bottom CTA row only renders when the
          summary card isn't taking the lead AND the plan isn't empty —
          i.e. a plan exists but the score isn't computable (no targets).
          When the summary card is up, its in-card CTAs are canonical;
          when the plan is EMPTY, the empty-state card owns the sole
          Generate CTA (ENG-1080 cohesion wave, 2026-06-13: excluding
          `isPlanEmpty` here keeps exactly ONE solid primary on the empty
          state — without it the empty-state Generate + this row both
          rendered two solid primaries, breaking the one-CTA law. Mirrors
          mobile `planner.tsx` `!plan` exclusivity). */}
      <div
        data-testid="planner-desktop-cta-row"
        // Audit 2026-04-30 visual-qa P1 #7 — Tailwind JIT can purge
        // a class only injected via interpolation (`${... ? "hidden" : ""}`).
        // Both branches are explicit literals now so the class always
        // ends up in the production CSS.
        className={showSummaryCard || isPlanEmpty ? "hidden" : "flex"}
        style={{ gap: 8, marginTop: 20 }}
      >
        {/* Cohesion wave (2026-06-13, ENG-1080): Generate/Regenerate is the
            ONE primary action on this row → solid `SupprButton` primary;
            Shopping list → `ghost`. Was an outline pill + beige `bg-card`
            slab. Primary leads. Mobile parity: planner solid Generate. */}
        <SupprButton
          variant="primary"
          loading={isGenerating}
          disabled={!sourceCanGenerate}
          onClick={requestRegenerate}
        >
          <RefreshCw size={14} strokeWidth={2} />
          {/* DC12 (2026-05-14, premium-bar audit) — no-plan empty state uses
              "Generate my plan" ("Regenerate" misreads when nothing exists yet);
              the summary-card path keeps the regenerate verb (a plan IS visible).
              ENG-956: "Refresh the rest" when ≥1 meal is locked. */}
          {lockedMealCount > 0
            ? "Refresh the rest"
            : plan.length > 0
              ? "Regenerate week"
              : "Generate my plan"}
        </SupprButton>
        <SupprButton variant="ghost" onClick={handleShoppingList}>
          <ShoppingCart size={14} strokeWidth={2} />
          Shopping list
        </SupprButton>
        {planImportEnabled ? (
          <SupprButton
            variant="ghost"
            onClick={() => onNavigate?.("plan-import")}
            data-testid="plan-import-entry-empty"
          >
            <Upload size={14} strokeWidth={2} />
            Import plan
          </SupprButton>
        ) : null}
      </div>
        </>
      )}

      {/* Modal-dismissibility audit (2026-04-30) — Radix Dialog so the swap
          picker dismisses via Escape, the Radix close X, AND backdrop click
          (incl. iOS Safari touch). DialogContent ships its own X (no double-X). */}
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

      {planWebParity ? (
        <>
          <PlanMoveMealDialog
            open={moveFrom !== null}
            onOpenChange={(open) => {
              if (!open) setMoveFrom(null);
            }}
            plan={plan}
            from={moveFrom}
            dayLabels={moveDayLabels}
            onMove={(to) => {
              if (!moveFrom) return;
              handleMoveMeal(moveFrom, to);
              setMoveFrom(null);
            }}
          />
          <PlanPortionDialog
            open={portionTarget !== null}
            onOpenChange={(open) => {
              if (!open) setPortionTarget(null);
            }}
            plan={plan}
            target={portionTarget}
            recipePool={portionRecipePool}
            onSelect={handlePortionSelect}
          />
          <PlanTemplatesDialog
            open={templatesOpen}
            onOpenChange={setTemplatesOpen}
            sourceMealCount={templateSourceMealCount}
            maxDayCount={plan.length || 1}
            templates={planTemplates}
            loading={templatesLoading}
            onSave={async (name, dayCount) => {
              if (!authedUserId) {
                return { ok: false, error: "Sign in to save templates." };
              }
              const draft = buildTemplateFromWeek(mealPlan, name, dayCount);
              if (!draft) {
                return { ok: false, error: "This plan has no meals to save." };
              }
              const { template, error } = await createPlanTemplate(
                supabase,
                authedUserId,
                draft,
              );
              if (error || !template) {
                return { ok: false, error: error ?? "Could not save template." };
              }
              track(AnalyticsEvents.plan_template_created, {
                dayCount: draft.dayCount,
                slotCount: draft.slots.length,
              });
              setPlanTemplates((prev) => [
                template,
                ...prev.filter((t) => t.id !== template.id),
              ]);
              return { ok: true };
            }}
            onApply={(templateId) => {
              const tmpl = planTemplates.find((t) => t.id === templateId);
              if (tmpl) setApplyTemplateTarget(tmpl);
            }}
            onDelete={async (templateId) => {
              if (!authedUserId) return { ok: false, error: "Sign in required." };
              const { error } = await deletePlanTemplate(supabase, authedUserId, templateId);
              if (error) return { ok: false, error };
              setPlanTemplates((prev) => prev.filter((t) => t.id !== templateId));
              return { ok: true };
            }}
          />
          <DestructiveConfirmDialog
            open={applyTemplateTarget !== null}
            onOpenChange={(open) => {
              if (!open) setApplyTemplateTarget(null);
            }}
            title={
              applyTemplateTarget
                ? `Apply "${applyTemplateTarget.name}"?`
                : "Apply template?"
            }
            description="Replace this week's plan with the template meals. This can't be undone."
            confirmLabel="Apply"
            onConfirm={() => {
              if (!applyTemplateTarget) return;
              const next = applyTemplateToWeek(applyTemplateTarget);
              setMealPlan(next);
              track(AnalyticsEvents.plan_template_applied, {
                dayCount: applyTemplateTarget.dayCount,
                slotCount: applyTemplateTarget.slots.length,
              });
              setTemplatesOpen(false);
              setApplyTemplateTarget(null);
              toast.success("Template applied");
            }}
          />
        </>
      ) : null}
      {sloeV3Plan ? (
        <AdjustConstraintsSheet
          open={adjustOpen}
          onOpenChange={setAdjustOpen}
          initial={adjustInitial}
          libraryCount={savedRecipesForLibrary.length}
          discoverCount={discoverCount}
          saving={isGenerating}
          onSave={(next) => void handleAdjustSave(next)}
        />
      ) : null}
      {sloeV3Plan ? (
        <BatchCookSheet
          open={batchCookOpen}
          onOpenChange={setBatchCookOpen}
          recipes={batchCookCandidates}
          saving={batchCookSaving}
          onSave={async (recipe, portions) => {
            setBatchCookSaving(true);
            try {
              const ok = await scaleBatchCookToShopping(recipe, portions);
              if (ok) {
                toast.success("Shopping list scaled to your batch.");
                setBatchCookOpen(false);
                handleShoppingList();
              }
            } finally {
              setBatchCookSaving(false);
            }
          }}
          onCook={async (recipe, portions) => {
            setBatchCookSaving(true);
            try {
              await scaleBatchCookToShopping(recipe, portions);
            } finally {
              setBatchCookSaving(false);
            }
            setBatchCookOpen(false);
            onOpenRecipe?.(recipe.id);
          }}
        />
      ) : null}
      <ResetPlanSheet
        open={resetPlan.open}
        onOpenChange={resetPlan.setOpen}
        loading={isGenerating}
        onConfirm={handleResetPlanConfirm}
      />
    </div>
  );
});
