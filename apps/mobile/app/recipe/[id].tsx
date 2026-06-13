import { useFocusEffect } from "@react-navigation/native";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { SupprButton } from "@/components/ui/SupprButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Constants from "expo-constants";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Play, X } from "lucide-react-native";

import { useAuth } from "@/context/auth";
import { useSavedRecipes } from "@/lib/recipes";
import { setRecipePublishedWithPrompt } from "@/lib/goPublicRecipe";
import RecipeEditSheet, { type RecipeEditSavePayload } from "@/components/recipe/RecipeEditSheet";
import { canEditRecipe } from "@suppr/shared/recipes/recipeEdit";
import { displayAttribution } from "@suppr/shared/recipes/displayAttribution";
import { supabase } from "@/lib/supabase";
import { dateKeyFromDate, newMealId, type JournalMeal } from "@/lib/nutritionJournal";
import { buildNutritionEntryRow } from "@/lib/nutritionEntryRow";
import { snapshotDailyTargetIfMissing } from "@suppr/shared/nutrition/dailyTargetSnapshot";
import { writeMealToHealthKitIfEnabled } from "@/lib/healthKitMealWriter";
import {
  recipeAggregateHasFatSecret,
  scrubFatSecretMacros,
  ZEROED_RECIPE_AGGREGATE,
} from "@suppr/shared/nutrition/fatsecretCacheGuard";
import { decodeEntities } from "@/lib/decodeEntities";
import { normaliseRecipeDisplayTitle } from "@suppr/shared/recipe/normaliseDisplayTitle";
import { fetchIngredientImages } from "@suppr/shared/recipe/ingredientImages";
import { enqueueIngredientImages } from "@suppr/shared/recipe/enqueueIngredientImages";
import { normalizeRecipeTitle } from "@suppr/shared/recipes/normalizeRecipeTitle";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { Accent, Spacing, Radius, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useSafeBack } from "@/hooks/use-safe-back";
import { useCardElevation } from "@/hooks/useCardElevation";
import { getSupprApiBase } from "@/lib/supprWeb";
import { authedFetch } from "@/lib/authedFetch";
import { track, isFeatureEnabled } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { webRecipeDeepLink } from "@suppr/shared/share/recipeDeepLink";
import { instagramHandleFromPostUrl, tiktokHandleFromPostUrl } from "@suppr/shared/recipe-import/socialUrlHelpers";
import { journalSlotFromMealTypes } from "@suppr/shared/nutrition/recipeJournalSlot";
import { normaliseInstructions } from "@suppr/shared/recipes/normaliseInstructions";
import { sanitizeRecipeDescription } from "@suppr/shared/recipes/sanitizeRecipeDescription";
import { isImportedRecipe, importSourceDisclaimer } from "@suppr/shared/recipes/importSourceDisclaimer";
import {
  pickHeroImageUrl,
  extractVideoHost,
} from "@suppr/shared/recipes/heroImageFallback";
import { formatMacroValue } from "@suppr/shared/nutrition/formatMacro";
// GW-08 (audit 2026-04-28): `computeRecipeFitPercent` import dropped
// when the always-85% pill was removed. Helper is still callable from
// other surfaces (web Library card) where targets are passed for real.
import { allocateIngredientMacrosFromLines } from "@suppr/shared/nutrition/allocateIngredientMacrosFromLines";
import {
  findSeedRecipeById,
  isSeedRecipeId,
} from "@suppr/shared/recipes/seedRecipesV2";
import {
  flatMacroRowsFromVerifyJson,
  mergeVerifiedMacroRows,
  overallConfidenceFromVerifyJson,
  perServingFromVerifyJson,
} from "@suppr/shared/nutrition/verifyRecipeResponse";
import { structuredIngredientsForVerify } from "@suppr/shared/recipe-ingredients/structuredIngredientsForVerify";
import { isStructuredSource } from "@suppr/shared/nutrition/structuredSourceGate";
import {
  formatContainsLine,
  normaliseAllergenIds,
} from "../../../../src/constants/regulatedAllergens";
import { ingredientVerifyNeedsReview } from "@suppr/shared/nutrition/verifyConfidencePolicy";
import { scaleStepText } from "@suppr/shared/nutrition/scaleStepText";
import {
  deriveIngredientVerificationTier,
  ingredientShouldShowVerifyCta,
} from "@suppr/shared/recipe-ingredients/ingredientVerificationStatus";
import { wouldCoerceMacros } from "@suppr/shared/nutrition/coerceRecipeMacrosForPlanning";
// PR1 (Paprika parity, 2026-05-02 customer-lens audit) — viewing-
// servings stepper helpers. Mobile uses the same module as web so
// bounds + clamp + debounce stay in lock-step.
import {
  RECIPE_VIEW_SERVINGS_MAX,
  RECIPE_VIEW_SERVINGS_MIN,
  RECIPE_VIEW_STEPPER_DEBOUNCE_MS,
  initialViewServings,
  stepViewServings,
  viewMultiplier as computeViewMultiplier,
} from "@suppr/shared/nutrition/recipeViewScale";
import { carbsLabel, netCarbsForRow } from "@suppr/shared/nutrition/netCarbs";
import { RecipeNotesCard } from "../../components/RecipeNotesCard";
// Phase 4 / B3.X — trust posture sweep (D-2026-04-27-16).
import { TrustChip } from "../../components/ui/TrustChip";
import { FatSecretBadge } from "../../components/ui/FatSecretBadge";
// GW-08 (audit 2026-04-28): `aggregateRecipeTrust` import dropped
// when the source TrustChip was removed from this screen. The gluten
// classifier is still load-bearing — it's a real ingredient-keyword
// scan, not a fabricated source claim.
import { classifyRecipeGluten } from "@/lib/recipeTrust";
import {
  composeRecipeMeta,
  computeFitsYourDayVerdict,
} from "../../lib/recipe/recipeDetailLayout";
import { RecipeDetailHero } from "../../components/recipe/RecipeDetailHero";
import { RecipeTitleBlock } from "../../components/recipe/RecipeTitleBlock";
import { RecipeActionPills } from "../../components/recipe/RecipeActionPills";
import { RecipeMacroStrip } from "../../components/recipe/RecipeMacroStrip";
import { RecipeMetaRow } from "../../components/recipe/RecipeMetaRow";
import {
  RecipeIngredientGrid,
  type RecipeGridIngredient,
} from "../../components/recipe/RecipeIngredientGrid";
import { RecipeMethodSteps } from "../../components/recipe/RecipeMethodSteps";
import { RecipeServingsFooter } from "../../components/recipe/RecipeServingsFooter";
import {
  IngredientInfoSheet,
  type IngredientInfo,
} from "../../components/recipe/IngredientInfoSheet";

function verifyJsonNeedsReviewNudge(json: Record<string, unknown>): boolean {
  const avg = json.avgIngredientConfidence;
  const min = json.minIngredientConfidence;
  return ingredientVerifyNeedsReview(
    typeof avg === "number" ? avg : undefined,
    typeof min === "number" ? min : undefined,
  );
}

const DEFAULT_TRACKED_MACROS = ["protein", "carbs", "fat"] as const;
/** Matches Today dashboard widgets except water (not derived from recipe nutrition). */
const RECIPE_TRACKABLE_MACRO_KEYS = new Set<string>(["protein", "carbs", "fat", "fiber", "sugar", "sodium"]);

type FullRecipe = {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  image_url: string | null;
  servings: number;
  prep_time_min: number | null;
  cook_time_min: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
  meal_type: string[] | null;
  source_url: string | null;
  source_name: string | null;
  author_id: string | null;
  creator_id: string | null;
  author: { display_name: string | null; avatar_url: string | null } | null;
  published?: boolean | null;
  /** T12 (2026-04-24) — regulated allergens from recipes.allergens. */
  allergens: string[] | null;
};

// Build 41 (TestFlight `AB1PYpfPjbd9li7jtnlAsIE`, 2026-05-01) — slot
// resolution moved to `src/lib/nutrition/recipeJournalSlot.ts` so it
// can be unit-tested without rendering the whole recipe screen.
// Priority is now: explicit `recipe.meal_type` → time-of-day fallback
// → normaliseMealSlot last-chance. Pre-fix the helper hard-fell-back
// to "Lunch", which logged a 7pm dinner recipe as Lunch when the
// recipe had no meal_type set. The helper is also reused by the
// LogSheet Library tab pick handler (mobile + web) so all surfaces
// share one slot-resolution contract.

type Ingredient = {
  name: string;
  amount: number | null;
  unit: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
  confidence?: number | null;
  source?: string | null;
  /**
   * 2026-05-02 fix — DB-level verified flag. The recipe-detail row UI
   * was rendering "Partial match" + Verify CTA forever for rows that
   * the user had already verified, because the per-row label was
   * derived from the stale numeric `confidence` column alone. Reading
   * `is_verified` lets the UI trust the user's resolution (and the
   * trusted-source fallback in `deriveIngredientVerificationTier`
   * picks up rows where `is_verified` was missed).
   */
  is_verified?: boolean | null;
  /** T19 Path B (2026-04-25) — kept on the row even when macros are zeroed
      under Basic-tier ToS, so the recipe-detail render path can detect a
      zeroed FatSecret cache and trigger a runtime re-fetch. */
  fatsecret_food_id?: string | null;
};

export default function RecipeDetailScreen() {
  const { id, portion, autoLog } = useLocalSearchParams<{ id: string; portion?: string; autoLog?: string }>();
  // PR1 (Paprika parity, 2026-05-02): the deep-link `?portion=N` value
  // is now consumed by the viewing-servings stepper seed (effect
  // below) — there is no separate `portionMultiplier` const here.
  // Ingredient amounts and the secondary "X kcal total for N portions"
  // line scale by `viewMultiplier(viewServings, recipe.servings)`.
  // `logPortion` (the "Add to today" target) follows the stepper.
  const router = useRouter();
  const goBack = useSafeBack("/(tabs)/discover");
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { savedIds, toggleSave } = useSavedRecipes(userId);

  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the source link,
  // Cook Mode label/launch chips/CTAs, and the resume-cook banner. Threaded
  // into the memoised StyleSheet via the dep array below. The "Cooked it"
  // action keeps `Accent.success` (sage).
  const accent = useAccent();
  // ENG-818/819 (Redesign — Design Direction 2026). Soft-elevation token for
  // the resting detail cards. Figma 332:2 — the white slab cards lift off the
  // cream page with the soft ambient shadow (`variant: "soft"`); the default
  // `flat` variant left them indistinguishable on the inverted page↔card.
  const cardElevation = useCardElevation({ variant: "soft" });
  // ENG-819 — quiet confirm haptic on the recipe-detail commit CTAs, behind
  // `redesign_winmoment` (haptic-only; the frame layout is the one prod path).
  const winMomentFeedback = isFeatureEnabled("redesign_winmoment");

  const recipeId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";
  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState<FullRecipe | null>(null);
  // P3-30 (2026-04-25): net-carbs lens flag for swapping the carbs row label.
  // 2026-05-02 fix: re-read on every screen focus (not just userId change)
  // so toggling "Show net carbs" in the Settings sheet swaps the recipe
  // detail's Carbs ↔ Net carbs label without requiring a remount. Tester
  // feedback: "toggling net carbs on and off in setting not working".
  const [netCarbsLensEnabled, setNetCarbsLensEnabled] = useState(false);
  const refreshNetCarbsLens = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("profiles")
      .select("net_carbs_lens_enabled")
      .eq("id", userId)
      .maybeSingle();
    setNetCarbsLensEnabled(
      Boolean((data as { net_carbs_lens_enabled?: boolean } | null)?.net_carbs_lens_enabled),
    );
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("net_carbs_lens_enabled")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      setNetCarbsLensEnabled(Boolean((data as { net_carbs_lens_enabled?: boolean } | null)?.net_carbs_lens_enabled));
    })().catch(() => { /* preserve default */ });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  useFocusEffect(
    useCallback(() => {
      refreshNetCarbsLens().catch(() => { /* preserve default */ });
    }, [refreshNetCarbsLens]),
  );
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  // Audit C1 (2026-05-05): Instagram / TikTok CDN URLs use signed
  // tokens that expire and broken-image URLs come back as a 280pt
  // grey rectangle from <Image> — visually indistinguishable from
  // "no image at all" but worse because it consumes the full hero
  // height. Track load errors so we can swap to the gradient
  // fallback in those cases. Reset on recipe id change so navigating
  // between recipes doesn't carry the prior error state.
  const [heroImageBroken, setHeroImageBroken] = useState(false);
  useEffect(() => {
    setHeroImageBroken(false);
  }, [id]);
  /** USDA / FatSecret / OFF / Edamam / Suppr DB path via `/api/nutrition/verify-recipe` (not local staples). */
  const [autoVerifyingIngredients, setAutoVerifyingIngredients] = useState(false);
  const autoVerifySucceededForRecipeId = useRef<string | null>(null);
  /** At most one low-confidence alert per recipe per mount for auto-verify (avoid nag on focus). */
  const lowConfidenceAutoNudgeShown = useRef<Set<string>>(new Set());
  const [cookMode, setCookMode] = useState(false);
  const [cookStep, setCookStep] = useState(0);
  const [userTargets, setUserTargets] = useState({ calories: NUTRITION_DEFAULTS.calories, protein: NUTRITION_DEFAULTS.protein, carbs: NUTRITION_DEFAULTS.carbs, fat: NUTRITION_DEFAULTS.fat, fiber: NUTRITION_DEFAULTS.fiber });
  const [trackedMacros, setTrackedMacros] = useState<string[]>([...DEFAULT_TRACKED_MACROS]);
  const [logPortion, setLogPortion] = useState(1);
  const [loggingJournal, setLoggingJournal] = useState(false);
  const [recipeEditOpen, setRecipeEditOpen] = useState(false);
  // Figma 332:2 §6 — the ingredient grid shows a preview then expands via the
  // "View all N ingredients" pill.
  const [ingredientsExpanded, setIngredientsExpanded] = useState(false);
  // Tapping an ingredient tile opens the branded read-only `IngredientInfoSheet`
  // (status / source / per-line macros) — premium-audit 2026-06-09, gap 5. This
  // replaces the prior off-brand `Alert.alert` info popup. The slot also carries
  // the resolved Verify route (set only when the tier still needs review).
  const [ingredientInfo, setIngredientInfo] = useState<IngredientInfo | null>(null);
  const [ingredientInfoVerifyHref, setIngredientInfoVerifyHref] = useState<string | null>(null);
  // Sloe image system (2026-06-08) — `name_key → image_url` for the
  // ingredient tiles, hydrated from the global `ingredient_images` table.
  // Empty until the fal-funded backfill runs; missing keys fall back to the
  // calm cream placeholder. Never blocks render (async load effect).
  const [ingredientImageMap, setIngredientImageMap] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
  // PR1 (Paprika parity, 2026-05-02): viewing-servings stepper. Defaults
  // to the recipe's authored yield. The multiplier
  // (`viewServings / recipe.servings`) drives ingredient amount
  // scaling and the secondary "X kcal total for N portions" line.
  // Pure helper enforces the 1..99 clamp + the 200ms debounce cadence.
  const [viewServings, setViewServings] = useState<number>(1);
  const [viewServingsInitialized, setViewServingsInitialized] = useState(false);
  const stepperPendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepperPendingDelta = useRef(0);
  const lastSeededRecipeId = useRef<string | null>(null);

  useEffect(() => {
    const p = portion ? parseFloat(String(portion)) : NaN;
    if (Number.isFinite(p) && p > 0) setLogPortion(p);
  }, [portion]);

  // PR1 (Paprika parity, 2026-05-02): seed the viewing-servings stepper
  // once the recipe loads. If the screen was deep-linked with
  // `?portion=N` (the planner / log flow propagates the portion the
  // user picked), honour that as the initial multiplier so the detail
  // screen reflects the deep-link intent. Otherwise default to 1×
  // (recipe's authored yield). Reset on recipe id change so navigating
  // A → B re-seeds from B's yield (otherwise the stepper would carry
  // A's value into B).
  useEffect(() => {
    if (!recipe) return;
    if (lastSeededRecipeId.current === recipe.id) return;
    const portionParam = portion != null ? parseFloat(String(portion)) : null;
    setViewServings(
      initialViewServings({
        baseServings: recipe.servings,
        portionParam:
          Number.isFinite(portionParam ?? Number.NaN) && (portionParam ?? 0) > 0
            ? (portionParam as number)
            : null,
      }),
    );
    lastSeededRecipeId.current = recipe.id;
    setViewServingsInitialized(true);
  }, [recipe, portion]);

  // Clean up any pending stepper debounce timer on unmount so a late
  // tap doesn't fire setState after the screen is gone.
  useEffect(() => {
    return () => {
      if (stepperPendingTimer.current) {
        clearTimeout(stepperPendingTimer.current);
        stepperPendingTimer.current = null;
      }
    };
  }, []);

  /**
   * Stepper handler with 200ms debounce. Each `+`/`−` press accumulates
   * a pending delta; the next render fires only when the user pauses
   * for the debounce window. Holding the button rapidly therefore
   * coalesces into one state update at the tail of the burst — no
   * flicker, no excessive layout work, no transient out-of-range
   * states. Pressing past the bounds is a no-op (the helper clamps).
   */
  const handleViewServingsStep = useCallback((delta: number) => {
    stepperPendingDelta.current += delta;
    if (stepperPendingTimer.current) {
      clearTimeout(stepperPendingTimer.current);
    }
    stepperPendingTimer.current = setTimeout(() => {
      const accum = stepperPendingDelta.current;
      stepperPendingDelta.current = 0;
      stepperPendingTimer.current = null;
      setViewServings((prev) => stepViewServings(prev, accum));
    }, RECIPE_VIEW_STEPPER_DEBOUNCE_MS);
  }, []);

  // Multiplier applied to ingredient amounts and to the secondary
  // batch-total kcal line. Always > 0 (helper is defensive against
  // 0-yield recipes).
  const recipeBaseServings = recipe?.servings ?? 1;
  const viewMultiplier = computeViewMultiplier(viewServings, recipeBaseServings);

  // PR1 (Paprika parity, 2026-05-02): keep the "Add to today" portion
  // in sync with the viewing-servings stepper. If the user dialled to
  // 6 of a 4-serving recipe, the journal write should record 1.5× —
  // not the deep-link value or the original 1×. The deep-link
  // `?portion` seed still wins on first mount via
  // `viewServingsInitialized`; subsequent stepper changes propagate
  // here. Cook-mode (PR #72) reads `logPortion` as `cookScaleFactor`
  // for step-text scaling and auto-log calorie math, so the same
  // stepper drives all three downstream surfaces (ingredients, log,
  // cook).
  useEffect(() => {
    if (!viewServingsInitialized) return;
    setLogPortion(viewMultiplier);
  }, [viewServingsInitialized, viewMultiplier]);

  const loadProfileMacroPrefs = useCallback(async () => {
    if (!userId) {
      setTrackedMacros([...DEFAULT_TRACKED_MACROS]);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("tracked_macros, target_calories, target_protein, target_carbs, target_fat, target_fiber_g")
      .eq("id", userId)
      .maybeSingle();
    if (!data) return;
    setUserTargets({
      calories: (data.target_calories as number) ?? NUTRITION_DEFAULTS.calories,
      protein: (data.target_protein as number) ?? NUTRITION_DEFAULTS.protein,
      carbs: (data.target_carbs as number) ?? NUTRITION_DEFAULTS.carbs,
      fat: (data.target_fat as number) ?? NUTRITION_DEFAULTS.fat,
      fiber: (data.target_fiber_g as number) ?? NUTRITION_DEFAULTS.fiber,
    });
    if (Array.isArray(data.tracked_macros) && data.tracked_macros.length > 0) {
      setTrackedMacros(data.tracked_macros as string[]);
    } else {
      setTrackedMacros([...DEFAULT_TRACKED_MACROS]);
    }
  }, [userId]);

  useEffect(() => {
    void loadProfileMacroPrefs();
  }, [loadProfileMacroPrefs]);

  useFocusEffect(
    useCallback(() => {
      void loadProfileMacroPrefs();
    }, [loadProfileMacroPrefs]),
  );

  const applyVerifyJsonToStateAndDb = useCallback(
    async (
      json: Record<string, unknown>,
      ingredientSnapshot: Ingredient[],
      opts: {
        persist: boolean;
        reloadAfter: boolean;
        verifiedSource: string;
        /** When API omits `perServing`, derive from `totals` / this yield. */
        servingsForPerServing?: number;
      },
    ) => {
      const rows = flatMacroRowsFromVerifyJson(json);
      const perServing = perServingFromVerifyJson(json, {
        servings: opts.servingsForPerServing,
      });
      if (!rows?.length || !perServing) return { ok: false as const };

      const sumLineCals = rows.reduce((s, r) => s + (r.calories ?? 0), 0);
      if (sumLineCals < 1 && (perServing.calories ?? 0) < 1) {
        return { ok: false as const };
      }

      setIngredients(mergeVerifiedMacroRows(ingredientSnapshot, rows));
      setRecipe((prev) =>
        prev
          ? {
              ...prev,
              calories: Math.round(perServing.calories),
              protein: Math.round(perServing.protein),
              carbs: Math.round(perServing.carbs),
              fat: Math.round(perServing.fat),
              fiber_g: perServing.fiberG != null ? Math.round(perServing.fiberG * 10) / 10 : prev.fiber_g,
              sugar_g: perServing.sugarG != null ? Math.round(perServing.sugarG * 10) / 10 : prev.sugar_g,
              sodium_mg: perServing.sodiumMg != null ? Math.round(perServing.sodiumMg) : prev.sodium_mg,
            }
          : prev,
      );

      const overallConf = overallConfidenceFromVerifyJson(json);

      let persistHadError = false;
      if (opts.persist) {
        const { data: dbIngs } = await supabase
          .from("recipe_ingredients")
          .select("id, name")
          .eq("recipe_id", recipeId)
          .order("created_at", { ascending: true });

        // T19 Path B (2026-04-25) — FatSecret Basic-tier ToS prohibits
        // caching macro values. Run each row through `scrubFatSecretMacros`
        // before update; FatSecret rows write zeros + source='Unverified'
        // (the `fatsecret_food_id` is preserved upstream). USDA / OFF /
        // Edamam rows pass through.
        if (dbIngs) {
          for (let i = 0; i < Math.min(rows.length, dbIngs.length); i++) {
            const r = rows[i]!;
            // F-119 (TestFlight `AMNFCofaR6cwd432kDYgfm8`, 2026-05-06):
            // earlier this payload omitted `is_verified`, so a re-verify
            // refreshed `source` + `confidence` but left rows at their
            // import-time `is_verified=false`. Recipe aggregate flipped
            // green while children stayed orange — the "all of these are
            // orange like they need to be verified but most of them
            // already have been" complaint. Mirror the policy used by
            // `verifyRecipe.ts:saveVerifiedIngredients` (confidence ≥ 0.5
            // = verified). FatSecret rows still get overridden to
            // `is_verified: false` by `scrubFatSecretMacros` below.
            const scrubbed = scrubFatSecretMacros({
              calories: Math.round(r.calories),
              protein: Math.round(r.protein),
              carbs: Math.round(r.carbs),
              fat: Math.round(r.fat),
              fiber_g: Math.round(r.fiber * 10) / 10,
              sugar_g: Math.round(r.sugar * 10) / 10,
              sodium_mg: Math.round(r.sodium),
              source: r.source,
              confidence: r.confidence,
              is_verified:
                isStructuredSource(r.source) &&
                typeof r.confidence === "number" &&
                r.confidence >= 0.5,
            });
            const { error: ingErr } = await supabase
              .from("recipe_ingredients")
              .update(scrubbed)
              .eq("id", dbIngs[i]!.id);
            if (ingErr) persistHadError = true;
          }
        }

        // T19 Path B — recipe aggregate is also a FatSecret cache when
        // any line is FatSecret-sourced. Replace with zeros + verified=
        // false in that case; otherwise persist the per-serving totals.
        const aggregateHasFs = recipeAggregateHasFatSecret(
          rows.map((r) => ({ source: r.source ?? null })),
        );
        const aggregateUpdate = aggregateHasFs
          ? ZEROED_RECIPE_AGGREGATE
          : {
              calories: Math.round(perServing.calories),
              protein: Math.round(perServing.protein),
              carbs: Math.round(perServing.carbs),
              fat: Math.round(perServing.fat),
              fiber_g: perServing.fiberG != null ? Math.round(perServing.fiberG * 10) / 10 : 0,
              sugar_g: perServing.sugarG != null ? Math.round(perServing.sugarG * 10) / 10 : 0,
              sodium_mg: perServing.sodiumMg != null ? Math.round(perServing.sodiumMg) : 0,
              is_verified: true,
              verified_at: new Date().toISOString(),
              verified_confidence: overallConf,
              verified_source: opts.verifiedSource,
            };

        const { error: recipeErr } = await supabase
          .from("recipes")
          .update(aggregateUpdate)
          .eq("id", recipeId);
        if (recipeErr) persistHadError = true;
      }

      if (opts.reloadAfter && opts.persist && !persistHadError) {
        let reloadRes = await supabase
          .from("recipe_ingredients")
          .select("name, amount, unit, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, confidence, source, is_verified, fatsecret_food_id")
          .eq("recipe_id", recipeId)
          .order("created_at", { ascending: true });
        if (reloadRes.error && String(reloadRes.error.message).includes("column")) {
          reloadRes = await supabase
            .from("recipe_ingredients")
            .select("name, amount, unit, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg")
            .eq("recipe_id", recipeId)
            .order("created_at", { ascending: true }) as any;
        }
        if (!reloadRes.error && reloadRes.data) setIngredients(reloadRes.data as Ingredient[]);
      }

      return { ok: true as const };
    },
    [recipeId],
  );

  // Re-verification of the whole recipe is reached from each ingredient card's
  // "Verify →" affordance, which routes to the dedicated `/recipe/verify`
  // screen. The auto-verify pipeline below still hydrates macros on load.

  useEffect(() => {
    if (!recipeId) { setLoading(false); return; }
    // Audit gap #3 (Wave 4, 2026-05-02) — seed recipes (`seed-v2-*`
    // ids) have no backing Supabase row. Short-circuit the network
    // query and hydrate from the static seed file. Logging from a
    // seed still funnels through the standard ingredient-matching
    // pipeline at log time, so per-meal nutrition is never invented.
    // Web parity: `src/app/components/RecipeDetail.tsx`.
    if (isSeedRecipeId(recipeId)) {
      const seed = findSeedRecipeById(recipeId);
      if (seed) {
        setRecipe({
          id: seed.id,
          title: seed.title,
          description: seed.shortDescription,
          instructions: seed.steps.join("\n"),
          image_url: seed.heroImageUrl,
          servings: seed.servings,
          prep_time_min: seed.prepTimeMin > 0 ? seed.prepTimeMin : null,
          cook_time_min: seed.cookTimeMin > 0 ? seed.cookTimeMin : null,
          calories: seed.kcalPerPortion,
          protein: seed.proteinG,
          carbs: seed.carbsG,
          fat: seed.fatG,
          fiber_g: seed.fiberG,
          meal_type: null,
          source_url: null,
          source_name: seed.attribution.author,
          author_id: null,
          creator_id: null,
          author: null,
          allergens: [],
        } as FullRecipe);
        setIngredients(
          seed.ingredients.map((i) => ({
            name: i.name,
            amount: i.grams,
            unit: "g",
            // Static seed cards display ingredient lines but never
            // claim macro values for them — the standard log-time
            // ingredient pipeline owns nutrition.
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
          })) as Ingredient[],
        );
      }
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      // F-114 broader sweep (2026-05-07): wrap initial recipe load in
      // try/catch/finally. Pre-fix shape was a bare async IIFE chain
      // — any rejection (Supabase 5xx, profiles fetch hang) stranded
      // `loading=true` and the user saw a perpetual recipe-detail
      // spinner. The cancelled-guard inside `finally` mirrors the
      // existing audit pattern in `meal-nutrition.tsx`.
      try {
        // Try with source columns; fall back without if they don't exist yet (migration pending).
        let recipeRes = await supabase
          .from("recipes")
          .select(
            "id, title, description, instructions, image_url, servings, prep_time_min, cook_time_min, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, meal_type, source_url, source_name, author_id, creator_id, published, allergens",
          )
          .eq("id", recipeId)
          .maybeSingle();
        if (recipeRes.error?.code === "42703") {
          recipeRes = await supabase
            .from("recipes")
            .select(
              "id, title, description, instructions, image_url, servings, prep_time_min, cook_time_min, calories, protein, carbs, fat, meal_type, author_id, creator_id",
            )
            .eq("id", recipeId)
            .maybeSingle();
        }
        // Try with confidence/source columns, fall back without if columns don't exist yet
        let ingRes = await supabase
          .from("recipe_ingredients")
          .select("name, amount, unit, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, confidence, source, is_verified")
          .eq("recipe_id", recipeId);
        if (ingRes.error && String(ingRes.error.message).includes("column")) {
          ingRes = await supabase
            .from("recipe_ingredients")
            .select("name, amount, unit, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg")
            .eq("recipe_id", recipeId) as any;
        }
        if (cancelled) return;
        if (recipeRes.data) {
          const row = recipeRes.data as Record<string, unknown>;
          const aid = (row.author_id as string | null) ?? null;
          let author: FullRecipe["author"] = null;
          if (aid) {
            const { data: prof } = await supabase
              .from("profiles")
              .select("display_name, avatar_url")
              .eq("id", aid)
              .maybeSingle();
            if (prof) {
              author = {
                display_name: (prof.display_name as string | null) ?? null,
                avatar_url: (prof.avatar_url as string | null) ?? null,
              };
            }
          }
          const r = row as Record<string, unknown>;
          setRecipe({
            ...r,
            prep_time_min: (r.prep_time_min as number | null | undefined) ?? null,
            cook_time_min: (r.cook_time_min as number | null | undefined) ?? null,
            source_url: (r.source_url as string | null | undefined) ?? null,
            source_name: (r.source_name as string | null | undefined) ?? null,
            author_id: aid,
            creator_id: (r.creator_id as string | null | undefined) ?? null,
            author,
            published: Boolean(r.published),
            allergens: Array.isArray(r.allergens) ? (r.allergens as string[]) : [],
          } as FullRecipe);
        }
        if (ingRes.data) setIngredients(ingRes.data as Ingredient[]);
      } catch (err) {
        if (!cancelled) {
          console.error("[recipe/[id]] initial load failed:", err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [recipeId]);

  const saved = savedIds.has(recipeId);

  const recipeByline = useMemo(() => {
    if (!recipe) return { label: "", href: null as string | null };
    // Route source + creator through displayAttribution (ENG-1084) so the
    // detail byline calms the legal seed string "Suppr Kitchen" → "Sloe Kitchen"
    // (and drops internal-seed strings → "") exactly like the Discover/Library
    // card. The remap lives only at the display boundary; the stored
    // `source_name` stays legal.
    const src = displayAttribution({ source: recipe.source_name });
    const looksLikeNutritionDb =
      Boolean(src) &&
      /^(USDA|OFF|Open Food Facts|FatSecret|Estimated|Unverified|Site)\b/i.test(src);
    if (src && !looksLikeNutritionDb) return { label: src, href: recipe.source_url?.trim() ?? null };
    const url = recipe.source_url?.trim();
    if (url) {
      const fromSocial = instagramHandleFromPostUrl(url) ?? tiktokHandleFromPostUrl(url);
      if (fromSocial) return { label: fromSocial, href: url };
      try {
        const host = new URL(url).hostname.replace(/^www\./, "");
        if (host) return { label: host, href: url };
      } catch {
        /* ignore */
      }
    }
    const author = displayAttribution({ creatorName: recipe.author?.display_name });
    if (author) {
      const creatorHref = recipe.creator_id ? `/creator/${recipe.creator_id}` : null;
      return { label: author, href: creatorHref };
    }
    if (src) return { label: src, href: recipe.source_url?.trim() ?? null };
    return { label: "", href: null };
  }, [recipe]);

  const isRecipeOwner = useMemo(
    () => Boolean(userId && recipe?.author_id && recipe.author_id === userId),
    [userId, recipe?.author_id],
  );

  const [publishedOverride, setPublishedOverride] = useState<boolean | null>(null);
  useEffect(() => {
    setPublishedOverride(null);
  }, [recipeId]);

  const isPublished = publishedOverride ?? Boolean(recipe?.published);

  const reloadRecipeIngredients = useCallback(async () => {
    if (!recipeId || isSeedRecipeId(recipeId)) return;
    const ingRes = await supabase
      .from("recipe_ingredients")
      .select("name, amount, unit, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, confidence, source, is_verified")
      .eq("recipe_id", recipeId);
    if (ingRes.error?.code === "42703") {
      const fallbackRes = await supabase
        .from("recipe_ingredients")
        .select("name, amount, unit, calories, protein, carbs, fat")
        .eq("recipe_id", recipeId);
      if (fallbackRes.data) setIngredients(fallbackRes.data as Ingredient[]);
      return;
    }
    if (ingRes.data) setIngredients(ingRes.data as Ingredient[]);
  }, [recipeId]);

  const handleRecipeEditSaved = useCallback(
    async (updated: RecipeEditSavePayload) => {
      setRecipe((prev) =>
        prev
          ? {
              ...prev,
              title: updated.title,
              description: updated.description,
              instructions: updated.instructions,
              servings: updated.servings,
              meal_type: updated.meal_type,
              prep_time_min: updated.prep_time_min,
              cook_time_min: updated.cook_time_min,
              calories: updated.calories,
              protein: updated.protein,
              carbs: updated.carbs,
              fat: updated.fat,
              fiber_g: updated.fiber_g,
              sugar_g: updated.sugar_g,
              sodium_mg: updated.sodium_mg,
            }
          : prev,
      );
      await reloadRecipeIngredients();
      Alert.alert("Updated", "Recipe saved.");
    },
    [reloadRecipeIngredients],
  );

  const handleSetPublished = useCallback(
    async (nextPublished: boolean) => {
      if (!userId || !recipe?.id || !isRecipeOwner) return;
      const result = await setRecipePublishedWithPrompt({
        recipeId: recipe.id,
        authorId: userId,
        published: nextPublished,
      });
      if (!result.ok) {
        if (result.cancelled) return;
        Alert.alert("Could not update", result.message);
        return;
      }
      setPublishedOverride(result.published);
      setRecipe((prev) => (prev ? { ...prev, published: result.published } : prev));
      Alert.alert(
        result.published ? "Recipe published" : "Recipe unpublished",
        result.published
          ? "Your recipe is now visible in Discover."
          : "It stays in your library as a private draft.",
      );
    },
    [userId, recipe?.id, isRecipeOwner],
  );

  // Authored-yield editing (recipes.servings + per-serving aggregate recompute)
  // is now owned by `RecipeEditSheet`, opened from the Edit action pill / owner
  // overflow. The footer stepper handles the orthogonal "servings to view".

  const ingredientsHaveNutrition = useMemo(
    () =>
      ingredients.some(
        (i) => (i.calories ?? 0) > 0 || (i.protein ?? 0) > 0 || (i.carbs ?? 0) > 0 || (i.fat ?? 0) > 0,
      ),
    [ingredients],
  );

  // T19 Path B (2026-04-25) — true when the recipe has at least one
  // ingredient with a FatSecret food ID and zero macros, which is the
  // exact shape of a Basic-tier-zeroed cache. Triggers runtime re-fetch
  // so the user sees verified macros without persistence.
  const hasZeroedFatSecretIngredients = useMemo(
    () =>
      ingredients.some(
        (i) =>
          typeof i.fatsecret_food_id === "string" &&
          i.fatsecret_food_id.length > 0 &&
          (i.calories ?? 0) <= 0 &&
          (i.protein ?? 0) <= 0 &&
          (i.carbs ?? 0) <= 0 &&
          (i.fat ?? 0) <= 0,
      ),
    [ingredients],
  );

  // True when at least one ingredient was matched against FatSecret —
  // drives the attribution badge per FatSecret Platform API ToS.
  // This is broader than hasZeroedFatSecretIngredients: it covers both
  // re-fetched rows (macros populated at request time) and zeroed Basic-
  // tier rows that still carry a fatsecret_food_id.
  const hasFatSecretIngredients = useMemo(
    () =>
      ingredients.some((i) => {
        const src = (i.source ?? "").toLowerCase();
        return src.includes("fatsecret") ||
          (typeof i.fatsecret_food_id === "string" && i.fatsecret_food_id.length > 0);
      }),
    [ingredients],
  );

  /** Seeded / legacy rows often store text-only lines with zero macros; derive display macros without mutating DB. */
  const ingredientsForIngredientsTab = useMemo(() => {
    if (ingredients.length === 0 || !recipe) return ingredients;
    if (ingredientsHaveNutrition) return ingredients;
    if (autoVerifyingIngredients) return ingredients;
    const c = recipe.calories ?? 0;
    if (c <= 0) return ingredients;
    const lines = ingredients.map((i) => i.name);
    const fills = allocateIngredientMacrosFromLines(lines, c, recipe.servings ?? 1);
    return ingredients.map((ing, i) => {
      const f = fills[i];
      if (!f) return ing;
      return {
        ...ing,
        calories: f.calories,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
        fiber_g: f.fiber_g,
        sugar_g: f.sugar_g,
        sodium_mg: f.sodium_mg,
        confidence: f.confidence,
        source: f.source,
      };
    });
  }, [ingredients, ingredientsHaveNutrition, recipe, autoVerifyingIngredients]);

  // Sloe image system (2026-06-08) — hydrate ingredient tile images by
  // `name_key`. Keyed on the joined names so it only re-fetches when the
  // ingredient set changes. Degrades to an empty map (calm placeholders)
  // on any error; never throws.
  const ingredientNamesKey = ingredientsForIngredientsTab.map((i) => i.name).join("");
  useEffect(() => {
    const names = ingredientsForIngredientsTab.map((i) => i.name);
    if (names.length === 0) {
      setIngredientImageMap(new Map());
      return;
    }
    let cancelled = false;
    void (async () => {
      const { map, missingKeys } = await fetchIngredientImages(supabase, names);
      if (cancelled) return;
      setIngredientImageMap(map);
      // Lazy generate-on-miss: enqueue the tiles that have no ready image
      // (fire-and-forget; never blocks render). Parity with web RecipeDetail.
      if (missingKeys.length > 0) {
        const apiBase = getSupprApiBase();
        if (apiBase) {
          enqueueIngredientImages(names, (b) =>
            authedFetch(`${apiBase}/api/ingredient-image`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(b),
            }),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredientNamesKey]);

  useEffect(() => {
    autoVerifySucceededForRecipeId.current = null;
    lowConfidenceAutoNudgeShown.current.clear();
  }, [recipeId]);

  /** USDA / FatSecret / OFF / Edamam / Suppr DB — same pipeline as manual re-verify (match-first; local staples only as API fallback).
   *
   * T19 Path B (2026-04-25) — also fires when the recipe has zeroed
   * FatSecret-cached rows (`fatsecret_food_id` set, macros zero). The
   * Basic-tier ToS prohibits caching macros, so the migration zeroed
   * existing rows; this hook re-fetches them at render time so the user
   * sees verified totals without the DB ever holding the cache.
   */
  useEffect(() => {
    if (loading || !recipeId || !recipe || !session?.access_token || ingredients.length === 0) return;
    if (autoVerifySucceededForRecipeId.current === recipeId) return;

    const needsFatSecretRefresh = hasZeroedFatSecretIngredients;
    if (ingredientsHaveNutrition && !needsFatSecretRefresh) return;

    if (
      !needsFatSecretRefresh &&
      (recipe.calories ?? 0) <= 0 &&
      (recipe.protein ?? 0) <= 0 &&
      (recipe.carbs ?? 0) <= 0 &&
      (recipe.fat ?? 0) <= 0
    ) {
      return;
    }

    let cancelled = false;
    const snap = ingredients;

    (async () => {
      const apiBase = getSupprApiBase();
      if (!apiBase) return;
      setAutoVerifyingIngredients(true);
      try {
        const res = await fetch(`${apiBase}/api/nutrition/verify-recipe`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        body: JSON.stringify({
          ingredients: structuredIngredientsForVerify(snap),
          servings: recipe.servings ?? 1,
        }),
        });
        const json = (await res.json()) as Record<string, unknown>;
        if (cancelled) return;
        const rows = flatMacroRowsFromVerifyJson(json);
        if (!json.ok || !rows?.length) return;
        const persist = Boolean(userId && recipe.author_id === userId);
        const applied = await applyVerifyJsonToStateAndDb(json, snap, {
          persist,
          reloadAfter: persist,
          verifiedSource: "auto_verify",
          servingsForPerServing: recipe.servings ?? 1,
        });
        if (applied.ok) {
          autoVerifySucceededForRecipeId.current = recipeId;
          if (verifyJsonNeedsReviewNudge(json)) {
            const plat = Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web";
            track(AnalyticsEvents.recipe_verify_needs_review, {
              recipe_id: recipeId,
              source: "auto_verify",
              platform: plat,
              avgIngredientConfidence: json.avgIngredientConfidence,
              minIngredientConfidence: json.minIngredientConfidence,
            });
            if (!lowConfidenceAutoNudgeShown.current.has(recipeId)) {
              lowConfidenceAutoNudgeShown.current.add(recipeId);
              Alert.alert(
                "Review nutrition matches",
                "Some ingredient lines matched with low confidence. Check each line on the Ingredients tab; edit names or amounts and tap Re-verify to save an update.",
              );
            }
          }
        }
      } catch {
        /* Local allocate fallback remains in ingredientsForIngredientsTab */
      } finally {
        if (!cancelled) setAutoVerifyingIngredients(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    loading,
    recipeId,
    recipe,
    ingredients,
    ingredientsHaveNutrition,
    hasZeroedFatSecretIngredients,
    session?.access_token,
    userId,
    applyVerifyJsonToStateAndDb,
  ]);

  // Compute header / Nutrition-tab totals. When no row has per-ingredient macros,
  // fall back to recipe-level totals so the summary isn't 0 while the recipe
  // still has calories. Ingredient rows keep their stored values (usually 0);
  // we do **not** split recipe totals across rows — that implied every line had
  // a fake share (e.g. 600 kcal ÷ 24 → 25 kcal each).
  // `totalMacros` (whole-recipe sum) is computed by the same memo but no longer
  // surfaced on this screen — the footer batch-total line derives from
  // per-portion × servings. Only `macros` (per-serving) is consumed here.
  const { macros } = useMemo(() => {
    if (!ingredientsHaveNutrition && recipe) {
      const perServing = {
        calories: recipe.calories,
        protein: recipe.protein,
        carbs: recipe.carbs,
        fat: recipe.fat,
        fiber_g: recipe.fiber_g ?? 0,
        sugar_g: recipe.sugar_g ?? 0,
        sodium_mg: recipe.sodium_mg ?? 0,
      };
      const srv = recipe.servings ?? 1;
      return {
        macros: perServing,
        totalMacros: {
          calories: perServing.calories * srv,
          protein: perServing.protein * srv,
          carbs: perServing.carbs * srv,
          fat: perServing.fat * srv,
          fiber_g: Math.round(perServing.fiber_g * srv * 10) / 10,
        },
      };
    }
    const sum = ingredients.reduce(
      (acc, i) => ({
        calories: acc.calories + (i.calories ?? 0),
        protein: acc.protein + (i.protein ?? 0),
        carbs: acc.carbs + (i.carbs ?? 0),
        fat: acc.fat + (i.fat ?? 0),
        fiber_g: acc.fiber_g + (i.fiber_g ?? 0),
        sugar_g: acc.sugar_g + (i.sugar_g ?? 0),
        sodium_mg: acc.sodium_mg + (i.sodium_mg ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0 },
    );
    const srv = recipe?.servings ?? 1;
    return {
      macros: {
        calories: Math.round(sum.calories / srv),
        protein: Math.round(sum.protein / srv),
        carbs: Math.round(sum.carbs / srv),
        fat: Math.round(sum.fat / srv),
        fiber_g: Math.round((sum.fiber_g / srv) * 10) / 10,
        sugar_g: Math.round((sum.sugar_g / srv) * 10) / 10,
        sodium_mg: Math.round(sum.sodium_mg / srv),
      },
      totalMacros: {
        calories: Math.round(sum.calories),
        protein: Math.round(sum.protein),
        carbs: Math.round(sum.carbs),
        fat: Math.round(sum.fat),
        fiber_g: Math.round(sum.fiber_g * 10) / 10,
      },
    };
  }, [ingredients, ingredientsHaveNutrition, recipe]);

  const recipeMacrosToShow = useMemo(() => {
    const ordered = trackedMacros.filter((k) => RECIPE_TRACKABLE_MACRO_KEYS.has(k));
    return ordered.length > 0 ? ordered : [...DEFAULT_TRACKED_MACROS];
  }, [trackedMacros]);

  const scaledForLog = useMemo(
    () => ({
      calories: Math.round(macros.calories * logPortion),
      protein: Math.round(macros.protein * logPortion * 10) / 10,
      carbs: Math.round(macros.carbs * logPortion * 10) / 10,
      fat: Math.round(macros.fat * logPortion * 10) / 10,
      fiber_g: macros.fiber_g > 0 ? Math.round(macros.fiber_g * logPortion * 10) / 10 : null,
      sugar_g: macros.sugar_g > 0 ? Math.round(macros.sugar_g * logPortion * 10) / 10 : null,
      sodium_mg: macros.sodium_mg > 0 ? Math.round(macros.sodium_mg * logPortion) : null,
    }),
    [macros, logPortion],
  );

  const addRecipeToTodayJournal = useCallback(async () => {
    if (!userId || !recipe) return;

    // P0-3 (2026-04-25): refuse to log fabricated macros. If the in-memory
    // ingredient sum has stated calories that the gram columns don't
    // explain (kcalFromGrams < MACRO_COERCION_THRESHOLD × calories), the
    // planner-display coerce helper would synthesize a neutral 28/42/30
    // P/C/F split — that is NOT real nutrition and must never reach
    // `nutrition_entries`. Route the user to Verify the recipe first.
    // Mirror of `logPlannedMealWithPortion` guard in (tabs)/index.tsx.
    if (
      wouldCoerceMacros({
        calories: scaledForLog.calories,
        protein: scaledForLog.protein,
        carbs: scaledForLog.carbs,
        fat: scaledForLog.fat,
      })
    ) {
      Alert.alert(
        "Verify this recipe first",
        "We don't have full macros for this recipe yet — calories are recorded but protein, carbs, and fat haven't been resolved. Open the recipe verifier to lock these in before logging it to your journal.",
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Verify",
            onPress: () => router.push(`/recipe/verify?id=${recipe.id}` as any),
          },
        ],
      );
      return;
    }

    setLoggingJournal(true);
    try {
      const dk = dateKeyFromDate(new Date());
      const slot = journalSlotFromMealTypes(recipe.meal_type);
      const mult = Math.max(0.125, Math.min(24, logPortion));
      const micros: Record<string, number> = {};
      if (scaledForLog.sugar_g != null) micros.sugarG = scaledForLog.sugar_g;
      if (scaledForLog.sodium_mg != null) micros.sodiumMg = scaledForLog.sodium_mg;
      // F-74 / F-103 (2026-05-07) — recipes table doesn't currently
      // carry caffeine_mg / alcohol_g per recipe (would require a
      // schema migration + per-ingredient roll-up). When that lands,
      // set `micros.caffeineMg` / `micros.alcoholG` on the inserted
      // meal row from the verified ingredient roll-up; per-meal
      // micros is the canonical SoT and the chip totals will sum it
      // automatically at next render. Until then a recipe containing
      // wine / coffee logged via "Add to today" leaves the chip
      // totals unchanged — known gap, scoped to a follow-up.
      const newId = newMealId();
      // Single shared row shape (launch-audit P1-2 consolidation). Fresh
      // "Add to today" log → no `eatenAt` → `eaten_at: null` with
      // `date_key: dk`, byte-identical to the previous inline literal
      // ("Recipe" is already canonical; recipe_id keeps the Schema
      // refactor Phase 2 typed FK — auto-NULLed if the recipe is deleted).
      const journalMeal: JournalMeal = {
        id: newId,
        name: slot,
        recipeTitle: normalizeRecipeTitle(recipe.title),
        time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
        calories: scaledForLog.calories,
        protein: scaledForLog.protein,
        carbs: scaledForLog.carbs,
        fat: scaledForLog.fat,
        fiberG: scaledForLog.fiber_g ?? undefined,
        micros: Object.keys(micros).length > 0 ? micros : undefined,
        portionMultiplier: mult,
        source: "Recipe",
        recipeId: recipe.id,
      } as JournalMeal;
      const { error } = await supabase
        .from("nutrition_entries")
        .insert(buildNutritionEntryRow(journalMeal, dk, userId));
      if (error) {
        Alert.alert("Could not log", error.message);
      } else {
        // F-2 — snapshot today's target on first log.
        void snapshotDailyTargetIfMissing(supabase, userId);
        // Audit/2026-04-30 — per-meal Apple HealthKit write (parity
        // with MFP / Cal AI). Honours the "Share meals to Health"
        // toggle and is idempotent on `mealId`. Fire-and-forget — HK
        // errors must not block the logged-meal alert.
        void writeMealToHealthKitIfEnabled({
          mealId: newId,
          userId,
          name: recipe.title,
          calories: scaledForLog.calories,
          protein: scaledForLog.protein,
          carbs: scaledForLog.carbs,
          fat: scaledForLog.fat,
          fiberG: scaledForLog.fiber_g ?? null,
          date: new Date().toISOString(),
          source: "Recipe",
          origin: "recipe",
        });
        // DC12 (2026-05-14, premium-bar audit) — specific log
        // confirmation; mobile parity sweep across the barcode +
        // planner + Today food-search Alert sites.
        Alert.alert(`${recipe.title} logged`, `Added to today at ${mult}× portion.`, [
          { text: "Stay", style: "cancel" },
          { text: "View Today", onPress: () => router.push("/(tabs)" as any) },
        ]);
      }
    } finally {
      setLoggingJournal(false);
    }
  }, [userId, recipe, scaledForLog, logPortion, router]);

  // P2-24 (2026-04-25): when navigated here from cook mode's "Log this
  // meal" CTA (`?autoLog=1`), trigger the journal write once on mount.
  // The same `addRecipeToTodayJournal` helper handles the coercion guard
  // (P0-3) and the user-facing alert; the cook-mode flow gets the same
  // behaviour as the explicit "Add to today" button without forking the
  // write path. Guard against re-firing on subsequent re-renders or if
  // the user navigates back to this screen with the param still in the
  // URL — fire once per recipe-id load.
  const autoLogFiredRef = useRef<string | null>(null);
  useEffect(() => {
    if (autoLog !== "1") return;
    if (!recipe || !userId) return;
    if (autoLogFiredRef.current === recipe.id) return;
    autoLogFiredRef.current = recipe.id;
    void addRecipeToTodayJournal();
  }, [autoLog, recipe, userId, addRecipeToTodayJournal]);

  // Hero image fallback ladder (Recime parity, 2026-04-30):
  //   1) recipe.image_url
  //   2) YouTube thumbnail derived from source_url (when source_url
  //      itself is a YouTube watch / shorts URL — common for recipes
  //      imported from YT video pages)
  //   3) DEFAULT_IMAGE (stock Unsplash) as the recipe-detail-screen
  //      ultimate fallback. The deterministic gradient renderer is
  //      reserved for Discover / Library cards where it reads as a
  //      "no photo" cue; on the recipe detail hero a flat gradient
  //      with no glyph would feel broken — keep the photo-shaped
  //      placeholder here.
  // Existing legacy upgrade (hqdefault → maxresdefault) is preserved
  // for cached image_url values that came in at a lower resolution.
  // See `src/lib/recipes/heroImageFallback.ts` for the helper.
  // Audit C1 (2026-05-05): when no real image is available, return
  // null so the hero renders the deterministic `RecipeHeroFallback`
  // gradient at half height (140pt) instead of the 280pt Unsplash
  // stock photo. The stock photo of stranger food was reading as
  // "empty hero" for ~40% of the screen and was Grace's primary
  // recipe-detail complaint. The gradient + a small glyph signals
  // "no photo" honestly without lying with stock imagery, and
  // matches the pattern Library cards already use.
  const heroImageUrl = useMemo<string | null>(() => {
    const picked = pickHeroImageUrl({
      image_url: recipe?.image_url,
      source_url: recipe?.source_url,
    });
    if (!picked) return null;
    if (picked.includes("img.youtube.com") || picked.includes("i.ytimg.com")) {
      return picked
        .replace(/\/(hqdefault|mqdefault|sddefault|default)\.(jpg|webp)/, "/maxresdefault.$2");
    }
    return picked;
  }, [recipe?.image_url, recipe?.source_url]);

  /** Recime parity (2026-04-30): "Watch original" affordance in the
   *  inline cook overlay. Renders only when the recipe has a usable
   *  source URL (we don't have a separate `source_video_url` column
   *  yet — `source_url` carries the YT/IG/TT URL when the recipe
   *  was imported from a video page). Tap → emit analytics with the
   *  host classification, open the link in the system handler. */
  const watchOriginalUrl = recipe?.source_url ?? null;
  const onWatchOriginalPress = useCallback(() => {
    if (!watchOriginalUrl || !recipe) return;
    const host = extractVideoHost(watchOriginalUrl);
    try {
      track(AnalyticsEvents.cook_watch_original_tapped, {
        recipeId: recipe.id,
        videoHost: host,
      });
    } catch {
      /* analytics fire-and-forget */
    }
    Linking.openURL(watchOriginalUrl).catch(() => {
      Alert.alert(
        "Couldn't open video",
        "The original video link couldn't be opened on this device.",
      );
    });
  }, [watchOriginalUrl, recipe]);

  // Defensive normalisation: some imports (and at least one historical
  // seed, TestFlight `AO4NtyNBpP4FJRgq7mCV5cs`) store newlines as literal
  // "/n" or escaped "\n" 2-char sequences. The shared
  // `normaliseInstructions` helper also runs on the write side in
  // `create-recipe.tsx`, `saveImportedRecipe.ts`, and web `RecipeUpload.tsx`
  // so fresh inserts never land with these typos — this display-time pass
  // covers DB history from before the write-side fix (build 10, 2026-04-19).
  const instructionSteps = normaliseInstructions(recipe?.instructions)
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const styles = useMemo(() => StyleSheet.create({
    // Figma 332:2 — warm cream editorial page (`#F6F5F2`). White slab cards lift
    // off this cream base. Mirrors the public-share page.
    container: { flex: 1, backgroundColor: colors.backgroundSecondary },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.md },
    errorText: { color: colors.text, fontSize: 16 },

    // Page body — single-scroll editorial stack (Figma 332:2 §2–7).
    body: { padding: Spacing.xl, gap: Spacing.xl },

    // ENG-748 — persistent gluten-chip disclaimer caption.
    glutenDisclaimer: {
      fontSize: 11,
      lineHeight: 15,
      color: colors.textSecondary,
    },

    // Canonical card shell (2026-06-10 §1/§2: the app converged to recipe
    // detail's white-on-cream grammar, so the standard tokens now ARE that
    // grammar — the old `colors.background` fill silently went cream-on-cream
    // when the ground inverted).
    card: {
      backgroundColor: cardElevation.liftBg ?? colors.card,
      borderRadius: CARD_RADIUS,
      borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
      borderColor: colors.cardBorder,
      padding: Spacing.xl,
      gap: Spacing.md,
      ...(cardElevation.shadowStyle ?? {}),
    },
    descText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },

    sourceCard: {
      backgroundColor: cardElevation.liftBg ?? colors.card,
      borderRadius: CARD_RADIUS,
      borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
      borderColor: colors.cardBorder,
      padding: Spacing.xl,
      gap: Spacing.sm,
      ...(cardElevation.shadowStyle ?? {}),
    },
    // headers census 2026-06-10: eyebrow → Type.label (was the app's heaviest +
    // widest hand-rolled eyebrow at 11/800/ls2).
    sourceLabel: { ...Type.label, color: colors.textTertiary },
    sourceName: { fontSize: 16, fontWeight: "600", color: colors.text },
    sourceNameLink: { color: accent.primary, textDecorationLine: "underline" },
    sourceLinkBtn: {
      marginTop: Spacing.xs,
      alignSelf: "flex-start",
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: accent.primary + "55",
    },
    sourceLinkText: { color: accent.primary, fontSize: 14, fontWeight: "600" },
    // ENG-858 — import disclaimer caption. Matches the gluten-disclaimer
    // treatment (the nearest disclaimer sibling): 11/15, textSecondary.
    sourceDisclaimer: {
      fontSize: 11,
      lineHeight: 15,
      color: colors.textSecondary,
      marginTop: Spacing.sm,
    },
  }), [colors, cardElevation, accent]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accent.primary} />
        </View>
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Recipe not found</Text>
          <SupprButton variant="primary" label="Go back" onPress={goBack} />
        </View>
      </View>
    );
  }

  const handleShare = () => {
    const extra = Constants.expoConfig?.extra as { supprApiUrl?: string } | undefined;
    const origin = (extra?.supprApiUrl ?? "").replace(/\/$/, "") || "https://suppr-club.com";
    const url = webRecipeDeepLink(String(recipeId), origin);
    const title = normaliseRecipeDisplayTitle(decodeEntities(recipe.title));
    void Share.share({ message: `${title}\n${url}`, url }).catch(() => {
      void Linking.openURL(url);
    });
  };

  const displayTitle = normaliseRecipeDisplayTitle(decodeEntities(recipe.title));

  // Owner-only overflow menu (edit / publish-unpublish / delete). Surfaced via
  // the hero's `more` control. Preserves every wired owner action.
  const openOwnerMenu = () => {
    const menu: {
      text: string;
      style?: "default" | "cancel" | "destructive";
      onPress?: () => void;
    }[] = [];
    if (canEditRecipe(recipe.author_id, userId)) {
      menu.push({ text: "Edit recipe", onPress: () => setRecipeEditOpen(true) });
    }
    if (!isPublished) {
      menu.push({ text: "Go public", onPress: () => void handleSetPublished(true) });
    } else {
      menu.push({ text: "Unpublish", onPress: () => void handleSetPublished(false) });
    }
    menu.push(
      {
        text: "Delete recipe",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Delete recipe?",
            `Deleting "${recipe.title}" will remove it from your library and any meal plan that references it. This can't be undone.`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  if (!recipe?.id) return;
                  try {
                    const { error } = await supabase.from("recipes").delete().eq("id", recipe.id);
                    if (error) {
                      Alert.alert("Couldn't delete", error.message);
                      return;
                    }
                    // Plan references detach automatically: meal_plan_meals.recipe_id
                    // is FK ON DELETE SET NULL (migration 20260511100000), so deleting
                    // the recipe above nulls them at the DB level. No client cleanup
                    // needed (web relies on the same FK — ENG-850).
                    void supabase.from("saves").delete().eq("recipe_id", recipe.id);
                    goBack();
                  } catch (e) {
                    Alert.alert("Couldn't delete", e instanceof Error ? e.message : "Unknown error");
                  }
                },
              },
            ],
          );
        },
      },
      { text: "Cancel", style: "cancel" },
    );
    Alert.alert("Recipe options", undefined, menu);
  };

  // Per-ingredient tap → branded `IngredientInfoSheet` (status / source /
  // per-line macros + a Verify route when the tier still needs review). This
  // replaces the prior off-brand `Alert.alert` info popup (premium-audit
  // 2026-06-09, gap 5). The host owns the full derivation (tier label/colour,
  // explanation, Verify gate) so the sheet stays a pure presenter.
  const onIngredientPress = (index: number) => {
    const ing = ingredientsForIngredientsTab[index];
    if (!ing) return;
    const conf = ing.confidence != null ? Number(ing.confidence) : null;
    const confPct = conf != null && Number.isFinite(conf) ? Math.round(conf * 100) : null;
    const tier = deriveIngredientVerificationTier({
      isVerified: ing.is_verified ?? null,
      confidence: conf,
      source: ing.source ?? null,
    });
    const tierLabel =
      tier === "verified"
        ? "Verified"
        : tier === "partial"
          ? "Partial match"
          : tier === "estimated"
            ? "Estimated"
            : "Unverified";
    // Tier swatch — sage for a verified source+match, amber for an estimate /
    // partial match, quiet grey for unverified. All semantic tokens (no hexes).
    const tierColor =
      tier === "verified"
        ? Accent.successSolid
        : tier === "unverified"
          ? colors.textTertiary
          : Accent.warningSolid;
    const explanation =
      tier === "verified"
        ? "Matched to a database entry with high confidence. These macros are scaled to this recipe's portion."
        : tier === "unverified"
          ? "We couldn't confidently match this line to the food database — these macros are a local estimate. Verify the recipe to lock in accurate values."
          : "This line matched with lower confidence, so the macros are approximate. Verify the recipe to refine them.";
    const showVerify =
      ingredientShouldShowVerifyCta(tier) && Boolean(recipeId) && !isSeedRecipeId(recipeId);
    setIngredientInfoVerifyHref(showVerify ? `/recipe/verify?id=${recipeId}` : null);
    setIngredientInfo({
      name: decodeEntities(ing.name),
      tierLabel,
      tierColor,
      confidencePct: tier === "verified" ? null : confPct,
      sourceLabel: ing.source ?? "Local estimate",
      calories: ing.calories ?? 0,
      protein: ing.protein ?? 0,
      carbs: ing.carbs ?? 0,
      fat: ing.fat ?? 0,
      explanation,
    });
  };

  // Attribution row (Figma §2). Reuse the existing byline resolution — it
  // already prefers handle → host → author and carries the right href.
  const attribution =
    recipeByline.label && recipeByline.label.length > 0
      ? {
          label: recipeByline.label,
          handleHref: recipeByline.href,
          originalHref: recipe.source_url?.trim() ?? null,
        }
      : null;

  const fitVerdict = computeFitsYourDayVerdict({
    kcal: macros.calories,
    targetCals: userTargets.calories,
  });

  const metaStats = composeRecipeMeta({
    prepMin: recipe.prep_time_min,
    cookMin: recipe.cook_time_min,
    ingredientCount: ingredientsForIngredientsTab.length,
  });

  // Macro strip cells (Figma §4) — CAL / PRO / CARB(/NET) / FAT, per-macro
  // coloured downstream. Net-carbs lens swaps the carb column.
  const fiberG = macros.fiber_g ?? 0;
  const carbColLabel = carbsLabel(fiberG, netCarbsLensEnabled);
  const carbColValue = netCarbsForRow(macros.carbs, fiberG, netCarbsLensEnabled);
  const macroCells = [
    { key: "calories" as const, label: "CAL", value: `${Math.round(macros.calories)}`, unit: "" },
    { key: "protein" as const, label: "PRO", value: `${Math.round(macros.protein)}`, unit: "g" },
    {
      key: "carbs" as const,
      label: carbColLabel.toLowerCase().startsWith("net") ? "NET" : "CARB",
      value: `${Math.round(carbColValue)}`,
      unit: "g",
    },
    { key: "fat" as const, label: "FAT", value: `${Math.round(macros.fat)}`, unit: "g" },
  ];

  // Tracked-micro overflow chips (fibre/sugar/sodium) — kept so the four-column
  // Figma strip drops no tracked value.
  const microChips: { key: string; label: string; value: string }[] = [];
  if (recipeMacrosToShow.includes("fiber") && fiberG > 0) {
    microChips.push({ key: "fiber", label: "Fiber", value: `${formatMacroValue(fiberG, "fiber")}g` });
  }
  if (recipeMacrosToShow.includes("sugar") && (macros.sugar_g ?? 0) > 0) {
    microChips.push({ key: "sugar", label: "Sugar", value: `${macros.sugar_g}g` });
  }
  if (recipeMacrosToShow.includes("sodium") && (macros.sodium_mg ?? 0) > 0) {
    microChips.push({ key: "sodium", label: "Sodium", value: `${macros.sodium_mg}mg` });
  }

  const gridIngredients: RecipeGridIngredient[] = ingredientsForIngredientsTab.map((ing) => ({
    name: ing.name,
    amount: ing.amount,
    unit: ing.unit,
    calories: ing.calories ?? 0,
    protein: ing.protein ?? 0,
    carbs: ing.carbs ?? 0,
    fat: ing.fat ?? 0,
    confidence: ing.confidence ?? null,
    source: ing.source ?? null,
    is_verified: ing.is_verified ?? null,
  }));

  const openCookMode = () => {
    setCookStep(0);
    setCookMode(true);
  };

  const cleanDescription = sanitizeRecipeDescription(recipe.description);
  const allergenLine = formatContainsLine(normaliseAllergenIds(recipe.allergens ?? []));

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
      >
        {/* 1. Full-bleed hero with overlaid controls (Figma 332:2 §1). */}
        <RecipeDetailHero
          recipeId={recipe.id}
          title={displayTitle}
          tags={recipe.meal_type ?? []}
          imageUrl={heroImageUrl}
          imageBroken={heroImageBroken}
          onImageError={() => setHeroImageBroken(true)}
          topInset={insets.top}
          saved={saved}
          onBack={goBack}
          onToggleSave={() => toggleSave(recipeId)}
          onShare={handleShare}
          onMore={isRecipeOwner && !isSeedRecipeId(recipeId) ? openOwnerMenu : undefined}
        />

        <View style={styles.body}>
          {/* 2. Title block — title, attribution, fits-your-day chip. */}
          <RecipeTitleBlock
            title={displayTitle}
            attribution={attribution}
            verdict={fitVerdict}
            onNavigate={(route) => router.push(route as never)}
          />

          {/* Gluten estimate chip + persistent disclaimer (ENG-748). */}
          {(() => {
            const gluten = classifyRecipeGluten(ingredients.map((ing) => String(ing.name ?? "")));
            if (!gluten.variant) return null;
            return (
              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm }}>
                  <TrustChip variant={gluten.variant} testID="recipe-detail-gluten-chip" />
                </View>
                <Text style={styles.glutenDisclaimer} testID="recipe-detail-gluten-disclaimer">
                  Estimated from ingredient names — not a guarantee. Always check labels and packaging
                  if you avoid gluten for medical reasons.
                </Text>
              </View>
            );
          })()}

          {/* 3. Action pills — Log (dominant) / Edit. Cook entry deduped to
              the single floating Cook Mode pill in the footer (premium-audit
              2026-06-09, gap 1); Ask pill omitted: no coach handler exists —
              net-new Figma 185:2. */}
          <RecipeActionPills
            onLog={() => void addRecipeToTodayJournal()}
            logging={loggingJournal}
            onEdit={
              isRecipeOwner && canEditRecipe(recipe.author_id, userId) && !isSeedRecipeId(recipeId)
                ? () => setRecipeEditOpen(true)
                : undefined
            }
            haptic={winMomentFeedback ? "confirm" : "none"}
          />

          {/* 4. Macro card — per-macro coloured values. */}
          {(() => {
            const hasNutrition =
              Math.round(macros.calories) > 0 ||
              macros.protein > 0 ||
              macros.carbs > 0 ||
              macros.fat > 0;
            if (!hasNutrition) {
              return (
                <View
                  testID="recipe-nutrition-pending"
                  style={{
                    paddingVertical: Spacing.sm,
                    paddingHorizontal: Spacing.lg,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: 0.75,
                  }}
                  accessibilityLabel="Calories not yet computed for this recipe"
                >
                  <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: "600", textAlign: "center" }}>
                    Calories not yet computed — open the ingredients to verify
                  </Text>
                </View>
              );
            }
            return <RecipeMacroStrip cells={macroCells} />;
          })()}

          {/* Tracked-micro overflow chips (fibre / sugar / sodium). */}
          {microChips.length > 0 ? (
            <View
              testID="recipe-macro-micro-chips"
              accessibilityLabel="Additional nutrition per serving"
              style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm }}
            >
              {microChips.map((m) => (
                <View
                  key={m.key}
                  testID={`recipe-macro-chip-${m.key}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    gap: Spacing.xs,
                    paddingHorizontal: Spacing.dense,
                    paddingVertical: Spacing.xs,
                    borderRadius: Radius.full,
                    backgroundColor: colors.backgroundSecondary,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>{m.label}</Text>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] }}>
                    {m.value}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* 5. Meta row — time · item count (rating + difficulty hidden: no
              backing data). */}
          <RecipeMetaRow stats={metaStats} />

          {/* Batch-total kcal line when the viewer has scaled away from yield. */}
          {(() => {
            const perPortionKcal = Math.round(macros.calories);
            const totalKcal = Math.round(perPortionKcal * viewServings);
            const hasScaledAway = viewServings !== recipeBaseServings;
            if (!hasScaledAway || perPortionKcal <= 0 || totalKcal <= 0) return null;
            return (
              <Text
                testID="recipe-kcal-total-line"
                accessibilityLabel={`${totalKcal} kilocalories total for ${viewServings} portions`}
                style={{ fontSize: 12, color: colors.textSecondary, fontVariant: ["tabular-nums"] }}
              >
                {totalKcal} kcal total for {viewServings} portions
              </Text>
            );
          })()}

          {/* Description. */}
          {cleanDescription ? (
            <View style={styles.card}>
              <Text style={styles.descText}>{decodeEntities(cleanDescription)}</Text>
            </View>
          ) : null}

          {/* Regulated-allergen callout — always present (silence ≠ safety),
              but the null state is QUIET. When an allergen IS tagged the full
              white-slab card renders with the verify caveat; when nothing is
              tagged it collapses to one quiet caption line — same calm-minimal
              class as the shipped micros collapse (premium-audit 2026-06-09,
              gap 6). */}
          {allergenLine ? (
            <View
              style={styles.card}
              accessibilityRole="text"
              accessibilityLabel="Regulated-allergen information"
              testID="recipe-allergen-callout"
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 4 }}>
                {allergenLine}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>
                We tag recipes from matched ingredients at import and verify time. Always verify
                ingredients against the original source if an allergen is a safety concern.
              </Text>
            </View>
          ) : (
            <Text
              accessibilityRole="text"
              accessibilityLabel="Not tagged for allergens. We tag recipes from matched ingredients — always verify against the original source if an allergen is a safety concern."
              testID="recipe-allergen-callout"
              style={{ fontSize: 12, color: colors.textTertiary, lineHeight: 17 }}
            >
              Not tagged for allergens — always verify against the original source.
            </Text>
          )}

          {/* Auto-verify progress note. */}
          {autoVerifyingIngredients ? (
            <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>
              Matching each line against the food database (USDA / Open Food Facts / FatSecret /
              Edamam when configured)…
            </Text>
          ) : null}

          {/* 6. Ingredients thumbnail grid. */}
          <RecipeIngredientGrid
            recipeId={recipeId}
            ingredients={gridIngredients}
            forServings={viewServings}
            viewMultiplier={viewMultiplier}
            onIngredientPress={onIngredientPress}
            onViewAll={() => setIngredientsExpanded((v) => !v)}
            expanded={ingredientsExpanded}
            imageMap={ingredientImageMap}
          />

          {/* FatSecret attribution (ToS) when any line is FatSecret-sourced. */}
          {hasFatSecretIngredients ? (
            <FatSecretBadge variant="text" style={{ marginLeft: 4 }} testID="fatsecret-badge-ingredients" />
          ) : null}

          {/* 7. Method — numbered serif steps. */}
          <RecipeMethodSteps
            steps={instructionSteps.map((s) => s.replace(/^\d+[\.\)\-]\s*/, ""))}
          />

          {/* Personal notes + rating. */}
          <RecipeNotesCard recipeId={recipeId} userId={userId} colors={colors} />

          {/* Source attribution (provenance label) at the foot. */}
          {recipe.source_url || recipe.source_name ? (
            <View style={styles.sourceCard}>
              <Text style={styles.sourceLabel}>SOURCE</Text>
              {recipe.source_url ? (
                <Pressable
                  onPress={() => Linking.openURL(recipe.source_url!)}
                  accessibilityRole="link"
                  accessibilityLabel={`Open original recipe source${recipe.source_name ? ` by ${recipe.source_name}` : ""}`}
                >
                  <Text style={[styles.sourceName, styles.sourceNameLink]}>
                    {recipe.source_name ?? "Source unknown"}
                  </Text>
                  <View style={styles.sourceLinkBtn}>
                    <Text style={styles.sourceLinkText}>View original recipe ↗</Text>
                  </View>
                </Pressable>
              ) : (
                <Text style={styles.sourceName}>{`Source · ${recipe.source_name}`}</Text>
              )}
              {/*
                ENG-858 / ENG-1042 — import source-card disclaimer. The card is
                shown only for imported (non-first-party) recipes, so the
                body-neutral legal line lives at the foot of it: facts extracted
                + nutrition estimated by Suppr, no affiliation/endorsement.
                Wording is the single shared constant (legal-approved); see
                `src/lib/recipes/importSourceDisclaimer.ts`. Parity with web
                `RecipeDetail.tsx` (recipe-import-disclaimer).
              */}
              {isImportedRecipe({ sourceUrl: recipe.source_url, sourceName: recipe.source_name }) ? (
                <Text
                  style={styles.sourceDisclaimer}
                  accessibilityRole="text"
                  testID="recipe-import-disclaimer"
                >
                  {importSourceDisclaimer(recipe.source_name)}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Authored-yield editing (recipe makes N portions) is owned by the Edit
          sheet below (`RecipeEditSheet`), reached from the Edit action pill /
          owner overflow — it recalculates per-serving aggregates on save. The
          footer stepper handles the orthogonal "servings to view" scaling. */}

      {/* Ingredient detail — branded sheet (premium-audit 2026-06-09, gap 5);
          replaces the prior `Alert.alert` info popup. The Verify CTA renders
          only when the host resolved a route for a still-needs-review tier. */}
      <IngredientInfoSheet
        info={ingredientInfo}
        onClose={() => {
          setIngredientInfo(null);
          setIngredientInfoVerifyHref(null);
        }}
        onVerify={
          ingredientInfoVerifyHref
            ? () => {
                const href = ingredientInfoVerifyHref;
                setIngredientInfo(null);
                setIngredientInfoVerifyHref(null);
                router.push(href as never);
              }
            : undefined
        }
      />

      {recipeEditOpen && recipe && canEditRecipe(recipe.author_id, userId) ? (
        <RecipeEditSheet
          recipe={{
            id: recipe.id,
            title: recipe.title,
            description: recipe.description,
            instructions: recipe.instructions,
            servings: recipe.servings,
            prep_time_min: recipe.prep_time_min,
            cook_time_min: recipe.cook_time_min,
            meal_type: recipe.meal_type,
            author_id: recipe.author_id,
          }}
          userId={userId}
          onClose={() => setRecipeEditOpen(false)}
          onSave={handleRecipeEditSaved}
        />
      ) : null}

      {/* Cook Mode Overlay — Modal so Android hardware-back dismisses
          the overlay instead of navigating the router away from the
          recipe screen entirely (audit 2026-04-30 modal-dismiss sweep).

          Servings handoff (P0, 2026-05-01) — when the user has scaled
          the recipe via the portion stepper (`logPortion`), the inline
          step text still references the original quantities ("4 tbsp")
          which makes the doubled batch under-seasoned. We compute
          `cookScaleFactor = logPortion` (a 4-serving recipe at
          `logPortion=2` is a doubled batch → scaleFactor 2) and pass
          every step through `scaleStepText` before rendering. The
          banner at the top names the actual serving count the user is
          cooking (`recipe.servings × logPortion`) so the user can
          confirm at a glance. Auto-log on Done already uses
          `logPortion`, so calories logged match what was actually
          cooked. */}
      {(() => {
        const cookScaleFactor = Number.isFinite(logPortion) && logPortion > 0 ? logPortion : 1;
        const cookViewServings = Math.max(
          1,
          Math.round((recipe?.servings ?? 1) * cookScaleFactor * 100) / 100,
        );
        const rawStep = instructionSteps[cookStep] ?? "";
        const cleanedStep = rawStep.replace(/^\d+[\.\)\-]\s*/, "");
        const scaledStep =
          cookScaleFactor !== 1
            ? scaleStepText(cleanedStep, cookScaleFactor)
            : cleanedStep;
        return (
          <Modal
            visible={cookMode && instructionSteps.length > 0}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={() => {
              setCookMode(false);
              setCookStep(0);
            }}
          >
            <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 20, paddingHorizontal: Spacing.xl, justifyContent: "space-between", paddingBottom: insets.bottom + 20 }}>
              <View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: accent.primary, letterSpacing: 2 }}>COOK MODE</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                    {/* Recime parity (2026-04-30): "Watch original" pill —
                        only renders when `recipe.source_url` is set so the
                        user can flip to the source video while cooking.
                        See `src/lib/recipes/heroImageFallback.ts` for host
                        classification used in the analytics payload. */}
                    {watchOriginalUrl ? (
                      <Pressable
                        onPress={onWatchOriginalPress}
                        accessibilityRole="link"
                        accessibilityLabel="Watch original video"
                        testID="cook-watch-original"
                        hitSlop={6}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          paddingHorizontal: Spacing.sm,
                          paddingVertical: Spacing.xs,
                          borderRadius: Radius.full,
                          borderWidth: 1,
                          borderColor: accent.primary,
                          backgroundColor: accent.primary + "14",
                        }}
                      >
                        <Play size={14} color={accent.primary} />
                        <Text style={{ color: accent.primary, fontSize: 12, fontWeight: "700" }}>
                          Watch original
                        </Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => {
                        setCookMode(false);
                        setCookStep(0);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Exit cook mode"
                      hitSlop={12}
                    >
                      <X size={28} color={colors.textSecondary} strokeWidth={2.25} />
                    </Pressable>
                  </View>
                </View>
                {cookScaleFactor !== 1 && (
                  <View
                    accessibilityRole="text"
                    accessibilityLabel={`Recipe scaled for ${cookViewServings} servings`}
                    style={{
                      backgroundColor: accent.primary + "15",
                      borderRadius: Radius.md,
                      borderWidth: 1,
                      borderColor: accent.primary + "30",
                      paddingVertical: 8,
                      paddingHorizontal: Spacing.dense,
                      marginBottom: Spacing.md,
                    }}
                  >
                    <Text style={{ color: accent.primary, fontWeight: "700", fontSize: 13, textAlign: "center" }}>
                      Scaled for {cookViewServings} serving{cookViewServings !== 1 ? "s" : ""}
                    </Text>
                  </View>
                )}
                <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 8 }}>
                  Step {cookStep + 1} of {instructionSteps.length}
                </Text>
                <Text style={{ fontSize: 22, fontWeight: "600", color: colors.text, lineHeight: 32 }}>
                  {scaledStep}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: Spacing.md }}>
                <SupprButton
                  variant="ghost"
                  style={{ flex: 1 }}
                  label="Previous"
                  onPress={() => setCookStep((s) => Math.max(0, s - 1))}
                  disabled={cookStep === 0}
                />
                {cookStep < instructionSteps.length - 1 ? (
                  // Step-by-step "Next" is the stepper's ONE action — solid
                  // aubergine primary. `Done!` (final step) keeps its sage
                  // success fill below as a deliberate landmark.
                  <SupprButton
                    variant="primary"
                    style={{ flex: 1 }}
                    label="Next"
                    onPress={() => setCookStep((s) => s + 1)}
                  />
                ) : (
                  <Pressable
                    style={{ flex: 1, backgroundColor: Accent.success, borderRadius: Radius.md, paddingVertical: 16, alignItems: "center" }}
                    onPress={() => {
                      setCookMode(false);
                      setCookStep(0);
                    }}
                  >
                    <Text style={{ fontWeight: "700", color: colors.primaryForeground }}>Done!</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </Modal>
        );
      })()}

      {/* 8. Sticky footer — yield + servings stepper (left) + Cook Mode (right).
          (Figma 332:2 §8.) Replaces the old "Log all · kcal" footer: Log moved
          up into the action-pill row. The stepper here is the canonical
          servings control (ingredient amounts + batch totals scale off it).
          Hidden during cook mode (the overlay owns the bottom of the screen). */}
      {recipe && !cookMode ? (
        <RecipeServingsFooter
          servings={viewServings}
          canDecrease={viewServings > RECIPE_VIEW_SERVINGS_MIN}
          canIncrease={viewServings < RECIPE_VIEW_SERVINGS_MAX}
          onDecrease={() => handleViewServingsStep(-1)}
          onIncrease={() => handleViewServingsStep(1)}
          onCookMode={openCookMode}
          bottomInset={insets.bottom}
          haptic={winMomentFeedback ? "confirm" : "none"}
        />
      ) : null}
    </View>
  );
}

