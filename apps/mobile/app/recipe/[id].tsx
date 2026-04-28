import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Constants from "expo-constants";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import {
  Bookmark,
  ChevronLeft,
  Clock,
  Minus,
  Plus,
  PlusCircle,
  Share2,
  Timer,
  UtensilsCrossed,
  Users,
  X,
} from "lucide-react-native";

import { useAuth } from "@/context/auth";
import { useSavedRecipes } from "@/lib/recipes";
import { supabase } from "@/lib/supabase";
import { dateKeyFromDate, newMealId } from "@/lib/nutritionJournal";
import { snapshotDailyTargetIfMissing } from "../../../../src/lib/nutrition/dailyTargetSnapshot";
import {
  recipeAggregateHasFatSecret,
  scrubFatSecretMacros,
  ZEROED_RECIPE_AGGREGATE,
} from "../../../../src/lib/nutrition/fatsecretCacheGuard";
import { decodeEntities } from "@/lib/decodeEntities";
import { normaliseRecipeDisplayTitle } from "../../../../src/lib/recipe/normaliseDisplayTitle";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useSafeBack } from "@/hooks/use-safe-back";
import { getSupprApiBase } from "@/lib/supprWeb";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../../src/lib/analytics/events";
import { webRecipeDeepLink } from "../../../../src/lib/share/recipeDeepLink";
import { instagramHandleFromPostUrl, tiktokHandleFromPostUrl } from "../../../../src/lib/recipe-import/extractSocialRecipe";
import { normaliseMealSlot } from "../../../../src/lib/nutrition/mealSlots";
import { normaliseInstructions } from "../../../../src/lib/recipes/normaliseInstructions";
import { sanitizeRecipeDescription } from "../../../../src/lib/recipes/sanitizeRecipeDescription";
import { formatMacroValue } from "../../../../src/lib/nutrition/formatMacro";
import { computeRecipeFitPercent } from "../../../../src/lib/nutrition/recipeFitPercent";
import { allocateIngredientMacrosFromLines } from "../../../../src/lib/nutrition/allocateIngredientMacrosFromLines";
import {
  flatMacroRowsFromVerifyJson,
  overallConfidenceFromVerifyJson,
  perServingFromVerifyJson,
  type FlatVerifiedMacroRow,
} from "../../../../src/lib/nutrition/verifyRecipeResponse";
import { parseRawIngredients } from "../../../../src/lib/recipe-ingredients/parseRawIngredients";
import {
  formatContainsLine,
  normaliseAllergenIds,
} from "../../../../src/constants/regulatedAllergens";
import { ingredientVerifyNeedsReview } from "../../../../src/lib/nutrition/verifyConfidencePolicy";
import { wouldCoerceMacros } from "../../../../src/lib/nutrition/coerceRecipeMacrosForPlanning";
import { carbsLabel, netCarbsForRow } from "../../../../src/lib/nutrition/netCarbs";
import { RecipeNotesCard } from "../../components/RecipeNotesCard";
// Phase 4 / B3.X — trust posture sweep (D-2026-04-27-16).
import { TrustChip } from "../../components/ui/TrustChip";
import { SourceDot } from "../../components/ui/SourceDot";
import { FatSecretBadge } from "../../components/ui/FatSecretBadge";
import { aggregateRecipeTrust, classifyRecipeGluten } from "@/lib/recipeTrust";
import { mapMealSourceToDot } from "../../../../src/lib/nutrition/sourceMap";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop";

function verifyJsonNeedsReviewNudge(json: Record<string, unknown>): boolean {
  const avg = json.avgIngredientConfidence;
  const min = json.minIngredientConfidence;
  return ingredientVerifyNeedsReview(
    typeof avg === "number" ? avg : undefined,
    typeof min === "number" ? min : undefined,
  );
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const DEFAULT_TRACKED_MACROS = ["protein", "carbs", "fat"] as const;
/** Matches Today dashboard widgets except water (not derived from recipe nutrition). */
const RECIPE_TRACKABLE_MACRO_KEYS = new Set<string>(["protein", "carbs", "fat", "fiber", "sugar", "sodium"]);
const REF_SUGAR_G = 50;
const REF_SODIUM_MG = 2300;

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
  author: { display_name: string | null; avatar_url: string | null } | null;
  /** T12 (2026-04-24) — regulated allergens from recipes.allergens. */
  allergens: string[] | null;
};

function journalSlotFromMealTypes(mealType: string[] | null | undefined): string {
  if (!mealType?.length) return "Lunch";
  const joined = mealType.map((t) => t.toLowerCase()).join(" ");
  if (joined.includes("breakfast")) return "Breakfast";
  if (joined.includes("lunch")) return "Lunch";
  if (joined.includes("dinner") || joined.includes("supper")) return "Dinner";
  if (joined.includes("snack")) return "Snacks";
  // Audit L5 (2026-04-18): shared canonical slot helper.
  return normaliseMealSlot(mealType[0]) ?? "Lunch";
}

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
  /** T19 Path B (2026-04-25) — kept on the row even when macros are zeroed
      under Basic-tier ToS, so the recipe-detail render path can detect a
      zeroed FatSecret cache and trigger a runtime re-fetch. */
  fatsecret_food_id?: string | null;
};

function mergeVerifiedMacroRows(base: Ingredient[], rows: FlatVerifiedMacroRow[]): Ingredient[] {
  return base.map((ing, i) => {
    const r = rows[i];
    if (!r) return ing;
    return {
      ...ing,
      calories: r.calories,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      fiber_g: r.fiber,
      sugar_g: r.sugar,
      sodium_mg: r.sodium,
      confidence: r.confidence,
      source: r.source,
    };
  });
}

function MacroRing({ value, goal, color, label, size = 56, ringBgColor, labelColor }: { value: number; goal: number; color: string; label: string; size?: number; ringBgColor: string; labelColor: string }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size} style={{ position: "absolute" }}>
          <Circle cx={size/2} cy={size/2} r={r} stroke={ringBgColor} strokeWidth={5} fill="none" />
          <Circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={5} fill="none"
            strokeDasharray={`${circ}`} strokeDashoffset={circ*(1-pct)} strokeLinecap="round"
            rotation="-90" origin={`${size/2},${size/2}`} />
        </Svg>
        <Text style={{ color, fontSize: 12, fontWeight: "700" }}>{Math.round(value)}g</Text>
      </View>
      <Text style={{ color: labelColor, fontSize: 10, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

export default function RecipeDetailScreen() {
  const { id, portion, autoLog } = useLocalSearchParams<{ id: string; portion?: string; autoLog?: string }>();
  const portionMultiplier = portion ? parseFloat(String(portion)) : 1;
  const router = useRouter();
  const goBack = useSafeBack("/(tabs)/discover");
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { savedIds, toggleSave } = useSavedRecipes(userId);

  const colors = useThemeColors();

  const recipeId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";
  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState<FullRecipe | null>(null);
  // P3-30 (2026-04-25): net-carbs lens flag for swapping the carbs row label.
  const [netCarbsLensEnabled, setNetCarbsLensEnabled] = useState(false);
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
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [reverifying, setReverifying] = useState(false);
  /** USDA / FatSecret / OFF / Edamam / Suppr DB path via `/api/nutrition/verify-recipe` (not local staples). */
  const [autoVerifyingIngredients, setAutoVerifyingIngredients] = useState(false);
  const autoVerifySucceededForRecipeId = useRef<string | null>(null);
  /** At most one low-confidence alert per recipe per mount for auto-verify (avoid nag on focus). */
  const lowConfidenceAutoNudgeShown = useRef<Set<string>>(new Set());
  const [cookMode, setCookMode] = useState(false);
  const [cookStep, setCookStep] = useState(0);
  const [userTargets, setUserTargets] = useState({ protein: NUTRITION_DEFAULTS.protein, carbs: NUTRITION_DEFAULTS.carbs, fat: NUTRITION_DEFAULTS.fat, fiber: NUTRITION_DEFAULTS.fiber });
  const [trackedMacros, setTrackedMacros] = useState<string[]>([...DEFAULT_TRACKED_MACROS]);
  const [activeTab, setActiveTab] = useState<"ingredients" | "steps" | "nutrition">("ingredients");
  const [logPortion, setLogPortion] = useState(1);
  const [loggingJournal, setLoggingJournal] = useState(false);
  const [recipeYieldDraft, setRecipeYieldDraft] = useState("");
  const [recipeYieldSaving, setRecipeYieldSaving] = useState(false);
  const [yieldEditOpen, setYieldEditOpen] = useState(false);

  useEffect(() => {
    const p = portion ? parseFloat(String(portion)) : NaN;
    if (Number.isFinite(p) && p > 0) setLogPortion(p);
  }, [portion]);

  useEffect(() => {
    if (recipe) setRecipeYieldDraft(String(Math.max(1, recipe.servings)));
  }, [recipe?.id, recipe?.servings]);

  const loadProfileMacroPrefs = useCallback(async () => {
    if (!userId) {
      setTrackedMacros([...DEFAULT_TRACKED_MACROS]);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("tracked_macros, target_protein, target_carbs, target_fat, target_fiber_g")
      .eq("id", userId)
      .maybeSingle();
    if (!data) return;
    setUserTargets({
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
          .select("name, amount, unit, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, confidence, source, fatsecret_food_id")
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

  const reverifyNutrition = async () => {
    if (!recipe || ingredients.length === 0 || !session?.access_token) return;
    setReverifying(true);
    try {
      const apiBase = getSupprApiBase();
      if (!apiBase) {
        Alert.alert("API not configured", "Set supprApiUrl in app config or EXPO_PUBLIC_API_URL.");
        return;
      }
      const res = await fetch(`${apiBase}/api/nutrition/verify-recipe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ingredients: parseRawIngredients(ingredients.map((ing) => ing.name)),
          servings: recipe.servings ?? 1,
        }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      const rows = flatMacroRowsFromVerifyJson(json);
      if (!json.ok || !rows?.length) {
        Alert.alert("Verification failed", (json.message as string) ?? "Could not verify ingredients.");
        return;
      }
      const canPersist = Boolean(userId && recipe.author_id === userId);
      const applied = await applyVerifyJsonToStateAndDb(json, ingredients, {
        persist: canPersist,
        reloadAfter: canPersist,
        verifiedSource: "re-verified",
        servingsForPerServing: recipe.servings ?? 1,
      });
      if (!applied.ok) {
        Alert.alert("Verification incomplete", "The server response could not be applied. Try again.");
        return;
      }
      const needsReview = verifyJsonNeedsReviewNudge(json);
      if (needsReview) {
        const plat = Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web";
        track(AnalyticsEvents.recipe_verify_needs_review, {
          recipe_id: recipeId,
          source: "re_verified",
          platform: plat,
          avgIngredientConfidence: json.avgIngredientConfidence,
          minIngredientConfidence: json.minIngredientConfidence,
        });
      }
      Alert.alert(
        "Re-verified",
        needsReview
          ? `Nutrition updated for ${ingredients.length} ingredients. Some matches are uncertain — review each line on the Ingredients tab.`
          : `Nutrition updated for ${ingredients.length} ingredients.`,
      );
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Verification failed");
    } finally {
      setReverifying(false);
    }
  };

  useEffect(() => {
    if (!recipeId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      // Try with source columns; fall back without if they don't exist yet (migration pending).
      let recipeRes = await supabase
        .from("recipes")
        .select(
          "id, title, description, instructions, image_url, servings, prep_time_min, cook_time_min, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, meal_type, source_url, source_name, author_id, allergens",
        )
        .eq("id", recipeId)
        .maybeSingle();
      if (recipeRes.error?.code === "42703") {
        recipeRes = await supabase
          .from("recipes")
          .select(
            "id, title, description, instructions, image_url, servings, prep_time_min, cook_time_min, calories, protein, carbs, fat, meal_type, author_id",
          )
          .eq("id", recipeId)
          .maybeSingle();
      }
      // Try with confidence/source columns, fall back without if columns don't exist yet
      let ingRes = await supabase
        .from("recipe_ingredients")
        .select("name, amount, unit, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, confidence, source")
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
          author,
          allergens: Array.isArray(r.allergens) ? (r.allergens as string[]) : [],
        } as FullRecipe);
      }
      if (ingRes.data) setIngredients(ingRes.data as Ingredient[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [recipeId]);

  const saved = savedIds.has(recipeId);

  const recipeByline = useMemo(() => {
    if (!recipe) return { label: "", href: null as string | null };
    const src = recipe.source_name?.trim();
    const looksLikeNutritionDb =
      Boolean(src) &&
      /^(USDA|OFF|Open Food Facts|FatSecret|Estimated|Unverified|Site)\b/i.test(src ?? "");
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
    const author = recipe.author?.display_name?.trim();
    if (author) return { label: author, href: null };
    if (src) return { label: src, href: recipe.source_url?.trim() ?? null };
    return { label: "", href: null };
  }, [recipe]);

  const isRecipeOwner = useMemo(
    () => Boolean(userId && recipe?.author_id && recipe.author_id === userId),
    [userId, recipe?.author_id],
  );

  const saveRecipeYield = useCallback(async () => {
    if (!recipe || !userId || !isRecipeOwner) return;
    const newS = Math.max(1, Math.min(48, parseInt(recipeYieldDraft.replace(/[^0-9]/g, ""), 10) || 1));
    const oldS = Math.max(1, recipe.servings || 1);
    if (newS === oldS) {
      setYieldEditOpen(false);
      return;
    }
    setRecipeYieldSaving(true);
    try {
      let calories: number;
      let protein: number;
      let carbs: number;
      let fat: number;
      let fiber_g: number;
      let sugar_g: number;
      let sodium_mg: number;

      if (ingredients.length > 0) {
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
        calories = Math.max(0, Math.round(sum.calories / newS));
        protein = Math.max(0, Math.round(sum.protein / newS));
        carbs = Math.max(0, Math.round(sum.carbs / newS));
        fat = Math.max(0, Math.round(sum.fat / newS));
        fiber_g = Math.max(0, Math.round((sum.fiber_g / newS) * 10) / 10);
        sugar_g = Math.max(0, Math.round((sum.sugar_g / newS) * 10) / 10);
        sodium_mg = Math.max(0, Math.round(sum.sodium_mg / newS));
      } else {
        calories = Math.max(0, Math.round((recipe.calories * oldS) / newS));
        protein = Math.max(0, Math.round((recipe.protein * oldS) / newS));
        carbs = Math.max(0, Math.round((recipe.carbs * oldS) / newS));
        fat = Math.max(0, Math.round((recipe.fat * oldS) / newS));
        fiber_g = Math.max(0, Math.round((((recipe.fiber_g ?? 0) * oldS) / newS) * 10) / 10);
        sugar_g = Math.max(0, Math.round((((recipe.sugar_g ?? 0) * oldS) / newS) * 10) / 10);
        sodium_mg = Math.max(0, Math.round(((recipe.sodium_mg ?? 0) * oldS) / newS));
      }

      const { error } = await supabase
        .from("recipes")
        .update({
          servings: newS,
          calories: Math.round(calories),
          protein: Math.round(protein),
          carbs: Math.round(carbs),
          fat: Math.round(fat),
          fiber_g,
          sugar_g,
          sodium_mg: Math.round(sodium_mg),
        })
        .eq("id", recipeId)
        .eq("author_id", userId);

      if (error) {
        Alert.alert("Could not save", error.message);
        return;
      }

      setRecipe((prev) =>
        prev
          ? {
              ...prev,
              servings: newS,
              calories: Math.round(calories),
              protein: Math.round(protein),
              carbs: Math.round(carbs),
              fat: Math.round(fat),
              fiber_g,
              sugar_g,
              sodium_mg: Math.round(sodium_mg),
            }
          : prev,
      );
      setYieldEditOpen(false);
      Alert.alert("Updated", `This recipe now yields ${newS} portions. Per-serving nutrition was recalculated.`);
    } finally {
      setRecipeYieldSaving(false);
    }
  }, [recipe, userId, isRecipeOwner, recipeYieldDraft, ingredients, recipeId]);

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
            ingredients: parseRawIngredients(snap.map((ing) => ing.name)),
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
  const { macros, totalMacros } = useMemo(() => {
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
      const { error } = await supabase.from("nutrition_entries").insert({
        id: newMealId(),
        user_id: userId,
        date_key: dk,
        name: slot,
        recipe_title: recipe.title,
        time_label: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
        calories: scaledForLog.calories,
        protein: scaledForLog.protein,
        carbs: scaledForLog.carbs,
        fat: scaledForLog.fat,
        fiber_g: scaledForLog.fiber_g,
        nutrition_micros: Object.keys(micros).length > 0 ? micros : {},
        portion_multiplier: mult,
        source: "Recipe",
      });
      if (error) {
        Alert.alert("Could not log", error.message);
      } else {
        // F-2 — snapshot today's target on first log.
        void snapshotDailyTargetIfMissing(supabase, userId);
        Alert.alert("Logged", `${recipe.title} added to today at ${mult}× portion.`, [
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

  // Clean up video thumbnail URLs (YouTube thumbnails have baked-in play buttons)
  const heroImageUrl = useMemo(() => {
    const raw = recipe?.image_url ?? DEFAULT_IMAGE;
    // YouTube thumbnail: swap hqdefault/mqdefault for maxresdefault (no play button overlay)
    if (raw.includes("img.youtube.com") || raw.includes("i.ytimg.com")) {
      return raw
        .replace(/\/(hqdefault|mqdefault|sddefault|default)\.(jpg|webp)/, "/maxresdefault.$2");
    }
    return raw;
  }, [recipe?.image_url]);

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
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.md },
    errorText: { color: colors.text, fontSize: 16 },
    backBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border },
    backBtnText: { color: colors.text, fontWeight: "600" },

    // 2026-04-20 prototype port — sticky top bar (light bg, dark
    // text, full-width). Replaces the floating overlay buttons
    // that previously sat over the hero image.
    topBar: {
      backgroundColor: colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      zIndex: 10,
    },
    topBarRow: {
      height: 56,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.sm,
      gap: Spacing.xs,
    },
    topBarIconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
    },
    topBarTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
    },
    topBarActions: { flexDirection: "row", alignItems: "center", gap: 2 },

    // Tag pill row under the hero.
    tagRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.md,
    },
    tagPill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.border,
    },
    tagPillText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
    tagPillPrimary: { backgroundColor: Accent.primary + "22" },
    tagPillTextPrimary: { color: Accent.primary },

    hero: { width: "100%", height: 280, backgroundColor: colors.border },
    // Header buttons — circular icon buttons that sit over the hero
    // image. P3 dark-mode fix (2026-04-28): the previous hard-coded
    // `rgba(255,255,255,0.94)` left them as bright white pills on
    // every dark-mode hero, the only light element on the screen.
    // Now uses `colors.card` so the pill picks up the surface tier
    // for the active scheme (white in light, dark surface in dark).
    headerBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.22,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 2 },
    },
    headerBtnText: { color: colors.text, fontSize: 22, fontWeight: "600" },

    body: { padding: Spacing.xl, gap: Spacing.lg },

    title: { fontSize: 24, fontWeight: "700", color: colors.text },
    authorName: { fontSize: 14, color: colors.textSecondary },
    mealTypeBadge: {
      alignSelf: "flex-start",
      backgroundColor: Accent.primary + "20",
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.sm,
    },
    mealTypeText: { color: Accent.primary, fontSize: 12, fontWeight: "600", textTransform: "capitalize" },

    calorieHero: { alignItems: "center", paddingVertical: Spacing.lg },
    // F-23 (2026-04-21): calories hero was consuming ~a third of the screen
    // on the recipe detail (TestFlight AIf4Z6q1KL2j). Shrink the numeral and
    // trim the surrounding card padding so the macro tiles below get their
    // breathing room back.
    calorieNumber: { fontSize: 26, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] },
    calorieLabel: { fontSize: 12, color: colors.textSecondary, marginTop: -2 },

    card: {
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.xl,
      gap: Spacing.md,
    },
    cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text },

    macroRingsRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: Spacing.sm },
    servings: { fontSize: 12, color: colors.textTertiary, textAlign: "center" },
    totalLine: { fontSize: 11, color: colors.textTertiary, textAlign: "center", marginTop: 4, fontStyle: "italic" },

    descText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },

    ingredientRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: Spacing.sm,
    },
    ingredientDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Accent.primary, marginTop: 6 },
    ingredientText: { fontSize: 14, color: colors.text },
    ingredientAmount: { fontWeight: "600" },
    ingMacroRow: { flexDirection: "row", gap: Spacing.sm, marginTop: 4 },
    ingMacro: { fontSize: 11, color: colors.textTertiary, fontWeight: "600", fontVariant: ["tabular-nums"] as any },

    stepRow: { flexDirection: "row", gap: Spacing.md, paddingVertical: Spacing.sm },
    stepNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: Accent.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    stepNumberText: { color: "#fff", fontSize: 13, fontWeight: "700" },
    stepText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },

    sourceCard: {
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.xl,
      gap: Spacing.sm,
    },
    sourceLabel: { fontSize: 11, fontWeight: "800", color: colors.textTertiary, letterSpacing: 2 },
    sourceName: { fontSize: 16, fontWeight: "600", color: colors.text },
    sourceNameLink: { color: Accent.primary, textDecorationLine: "underline" },
    sourceLinkBtn: {
      marginTop: Spacing.xs,
      alignSelf: "flex-start",
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Accent.primary + "55",
    },
    sourceLinkText: { color: Accent.primary, fontSize: 14, fontWeight: "600" },

    actionsRow: { gap: Spacing.sm, paddingBottom: 20 },
    actionBtn: {
      flexDirection: "row",
      borderRadius: Radius.md,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

    infoRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: Spacing.lg, gap: Spacing.md, marginBottom: Spacing.lg },
    infoItem: { alignItems: "center", flex: 1 },
    infoIcon: { marginBottom: 6 },
    infoValue: { fontSize: 14, fontWeight: "700", color: colors.text },
    infoLabel: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },

    tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: Spacing.lg, gap: 0 },
    tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
    tabText: { fontSize: 14, fontWeight: "600", color: colors.textTertiary },
    tabTextActive: { fontSize: 14, fontWeight: "600", color: Accent.primary },

    ingredientRowNew: { flexDirection: "row", alignItems: "flex-start", paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: Spacing.sm },
    confidenceDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6, flexShrink: 0 },
    ingredientNameAndCal: { flex: 1 },
    // F-63e (2026-04-22): tester AAtwbwVx flagged the kcal column as
    // clipped to "0 kc" on long ingredient lines (e.g. "1 medium-to-
    // large yellow squash (or another zucchini), diced"). The name
    // Text had no flex cap, so it grew past the row and pushed the
    // kcal off-screen. Cap name with `flex: 1, flexShrink: 1` and
    // give it a gap from the kcal; let the name wrap to 2 lines.
    ingredientNameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
    ingredientName: { fontSize: 14, color: colors.text, fontWeight: "500", flex: 1, flexShrink: 1 },
    ingredientCalories: { fontSize: 12, color: colors.textSecondary, fontWeight: "600", flexShrink: 0 },
    ingredientQty: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
    macroBar: { height: 3, borderRadius: 2, flexDirection: "row", marginTop: 6, overflow: "hidden" },

    nutritionGrid: { gap: Spacing.md, marginBottom: Spacing.lg },
    nutritionGridRow: { flexDirection: "row", gap: Spacing.md },
    nutritionCard: { flex: 1, backgroundColor: colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.border, padding: Spacing.lg, alignItems: "center" },
    nutritionValue: { fontSize: 28, fontWeight: "700", marginBottom: 4 },
    nutritionLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },

    micronutrientsSection: { marginTop: Spacing.lg },
    microLabel: { fontSize: 12, fontWeight: "700", color: colors.textTertiary, marginBottom: Spacing.md, letterSpacing: 0.5 },
    microRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    microName: { fontSize: 14, color: colors.text, fontWeight: "500", flex: 1 },
    microBarContainer: { flex: 1.5 },
    progressBar: { height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: colors.border },
    progressBarFill: { height: "100%", backgroundColor: Accent.primary },
    microValue: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, width: 50, textAlign: "right" },
  }), [colors, insets.top]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Accent.primary} />
        </View>
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Recipe not found</Text>
          <Pressable style={styles.backBtn} onPress={goBack}>
            <Text style={styles.backBtnText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  /*
   * 2026-04-20 prototype port — top bar refactor.
   * Previously the back / save / share pills floated absolutely over
   * the hero image. The prototype puts them in a proper sticky top
   * bar above the hero with a centred bold title. Rendering outside
   * the ScrollView so the bar stays put on scroll.
   */
  const handleShare = () => {
    const extra = Constants.expoConfig?.extra as { supprApiUrl?: string } | undefined;
    const origin = (extra?.supprApiUrl ?? "").replace(/\/$/, "") || "https://suppr-club.com";
    const url = webRecipeDeepLink(String(recipeId), origin);
    const title = normaliseRecipeDisplayTitle(decodeEntities(recipe.title));
    void Share.share({ message: `${title}\n${url}`, url }).catch(() => {
      void Linking.openURL(url);
    });
  };

  // Tag-row source: `meal_type` is the closest existing per-recipe
  // array of category strings (prod data has no `tags` column). We
  // render what's actually on the recipe — no invented tags.
  const pillTags: string[] = Array.isArray(recipe.meal_type) ? recipe.meal_type.filter(Boolean) : [];
  // Fit percent: pass targets=null (mobile only loads macro-gram targets,
  // not calorie target) so web + mobile deterministically agree on the
  // helper's neutral fallback. Never invent nutrition values.
  const fitPercent = computeRecipeFitPercent(
    { calories: macros.calories, protein: macros.protein, carbs: macros.carbs, fat: macros.fat },
    null,
  ).percent;

  return (
    <View style={styles.container}>
      {/* Sticky top bar — replaces the floating-over-hero pattern. */}
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <View style={styles.topBarRow}>
          <Pressable onPress={goBack} style={styles.topBarIconBtn} accessibilityRole="button" accessibilityLabel="Go back">
            <ChevronLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.topBarTitle} numberOfLines={1} ellipsizeMode="tail">
            {/* F-85 (2026-04-25) — de-CAPS shouty imported titles
                ("HEALTHY 3 INGREDIENT WHIPPED PISTACHIO TIRAMISU" →
                "Healthy 3 Ingredient Whipped Pistachio Tiramisu").
                Display-only normalisation; the stored title is untouched. */}
            {normaliseRecipeDisplayTitle(decodeEntities(recipe.title))}
          </Text>
          <View style={styles.topBarActions}>
            <Pressable
              onPress={() => toggleSave(recipeId)}
              style={styles.topBarIconBtn}
              accessibilityRole="button"
              accessibilityLabel={saved ? "Remove from library" : "Save to library"}
            >
              <Bookmark
                size={22}
                color={saved ? Accent.success : colors.text}
                fill={saved ? Accent.success : "transparent"}
              />
            </Pressable>
            <Pressable
              onPress={handleShare}
              style={styles.topBarIconBtn}
              accessibilityRole="button"
              accessibilityLabel="Share recipe"
            >
              <Share2 size={22} color={colors.text} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero image — now sits below the top bar (no overlap). */}
        <Image source={{ uri: heroImageUrl }} style={styles.hero} />

        {/* 2026-04-26 polish: pre-fix this row rendered the lowercase
            meal-type pill ("lunch") AND a primary-tinted fit-percent pill
            ("85%"). The meal-type duplicated the proper-case "Lunch" pill
            below the title (same data, two pills) and the bare percentage
            had no label so users couldn't tell what 85% referred to. Now:
            no meal-type pill here (the proper-case one below the title is
            canonical), and the fit-percent pill is labelled "match" so
            its meaning is self-evident. */}
        <View style={styles.tagRow}>
          <View style={[styles.tagPill, styles.tagPillPrimary]}>
            <Text style={[styles.tagPillText, styles.tagPillTextPrimary]}>{fitPercent}% match</Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Title + meta */}
          <Text style={styles.title}>{normaliseRecipeDisplayTitle(decodeEntities(recipe.title))}</Text>
          {/* Phase 4 / B3.X (2026-04-27, D-2026-04-27-16) — recipe
              hero TrustChip immediately under the title. Variant
              aggregates ingredient sources via the shared helper.
              Mobile uses `confidence ≥ 0.7` as the verified
              threshold (matches the existing ConfidenceDot
              high/medium gating in apps/mobile/app/recipe/[id].tsx
              and the canonical bucket in confidenceScoring.ts). */}
          <View style={{ marginTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <TrustChip
              variant={aggregateRecipeTrust(
                ingredients.map((ing) => ({
                  source: ing.source ?? null,
                  isVerified:
                    typeof ing.confidence === "number" && ing.confidence >= 0.7,
                })),
              )}
              testID="recipe-detail-trust-chip"
            />
            {/* Phase 5 / B3.2 (2026-04-27, D-2026-04-27-13) — gluten
                depth chip. Surfaces a `gluten-high-conf` or
                `gluten-uncertain` chip alongside the source TrustChip;
                null variant means the recipe is gluten-containing by
                intent (no chip). Legal-reviewer copy review pending
                pre-App-Store-submission. */}
            {(() => {
              const gluten = classifyRecipeGluten(
                ingredients.map((ing) => String(ing.name ?? "")),
              );
              return gluten.variant ? (
                <TrustChip
                  variant={gluten.variant}
                  testID="recipe-detail-gluten-chip"
                />
              ) : null;
            })()}
          </View>
          {recipeByline.label ? (
            <Pressable
              onPress={() => {
                if (recipeByline.href) void Linking.openURL(recipeByline.href);
              }}
              disabled={!recipeByline.href}
              style={{ alignSelf: "flex-start" }}
            >
              <Text
                style={[
                  styles.authorName,
                  recipeByline.href ? { textDecorationLine: "underline" } : null,
                ]}
              >
                by {recipeByline.label}
              </Text>
            </Pressable>
          ) : null}
          {recipe.meal_type && recipe.meal_type.length > 0 && (
            <View style={styles.mealTypeBadge}>
              <Text style={styles.mealTypeText}>{recipe.meal_type.join(", ")}</Text>
            </View>
          )}

          {/* Info row: Prep time, Cook time, Servings, Confidence */}
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Clock size={20} color={colors.textSecondary} style={styles.infoIcon} />
              <Text style={styles.infoValue}>
                {recipe.prep_time_min != null && recipe.prep_time_min > 0 ? formatMinutes(recipe.prep_time_min) : "—"}
              </Text>
              <Text style={styles.infoLabel}>Prep</Text>
            </View>
            <View style={styles.infoItem}>
              <Timer size={20} color={colors.textSecondary} style={styles.infoIcon} />
              <Text style={styles.infoValue}>
                {recipe.cook_time_min != null && recipe.cook_time_min > 0 ? formatMinutes(recipe.cook_time_min) : "—"}
              </Text>
              <Text style={styles.infoLabel}>Cook</Text>
            </View>
            {isRecipeOwner ? (
              <Pressable
                onPress={() => {
                  setRecipeYieldDraft(String(Math.max(1, recipe.servings)));
                  setYieldEditOpen(true);
                }}
                style={styles.infoItem}
                accessibilityRole="button"
                accessibilityLabel="Servings"
                accessibilityHint="Opens editor to change how many portions the full recipe makes"
              >
                <Users size={20} color={colors.textSecondary} style={styles.infoIcon} />
                <Text style={styles.infoValue}>{recipe.servings}</Text>
                <Text style={styles.infoLabel}>Servings</Text>
              </Pressable>
            ) : (
              <View style={styles.infoItem}>
                <Users size={20} color={colors.textSecondary} style={styles.infoIcon} />
                <Text style={styles.infoValue}>{recipe.servings}</Text>
                <Text style={styles.infoLabel}>Servings</Text>
              </View>
            )}
            {/* P2-33 (2026-04-25 design-system-enforcer): "Confidence
                92%" was a backstage signal in a user-facing meta strip
                — the user has no actionable interpretation of "92%
                confident". Removed; the existing source-attribution
                row in the Nutrition tab is the right surface if the
                user wants to dig into trust. */}
          </View>

          {/* Calories hero (per portion); macro tiles follow dashboard widget prefs */}
          {(() => {
            // P1-16 (TestFlight `ABCjwJb4cU5UabbaXfYEbOY`, 2026-04-22):
            // when a recipe has 0 calories (import-time nutrition
            // failed, or the user just opened a stub), the green
            // accent card confidently rendered "0 kcal per portion".
            // Render a dimmed "Calculating…" state instead so the
            // user can tell that nutrition is missing, not zero.
            const kcalNum = Math.round(macros.calories);
            const hasNutrition =
              kcalNum > 0 || macros.protein > 0 || macros.carbs > 0 || macros.fat > 0;
            return (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  justifyContent: "center",
                  gap: 6,
                  // Polish (2026-04-25 visual-qa): tighten the gap between
                  // the calories hero and the macro tiles. Pre-fix margin
                  // was Spacing.md (12) plus a redundant "Macros" overline
                  // label below — visually read as a 30+px void. The
                  // overline is gone (tiles self-label) and margin drops
                  // to Spacing.sm.
                  marginBottom: Spacing.sm,
                  paddingVertical: Spacing.sm,
                  paddingHorizontal: Spacing.lg,
                  borderRadius: Radius.lg,
                  borderWidth: 1,
                  borderColor: hasNutrition
                    ? MacroColors.calories + "55"
                    : colors.border,
                  backgroundColor: hasNutrition
                    ? MacroColors.calories + "14"
                    : "transparent",
                  opacity: hasNutrition ? 1 : 0.7,
                }}
                accessibilityLabel={
                  hasNutrition
                    ? `${kcalNum} kcal per portion`
                    : "Calories not yet computed for this recipe"
                }
              >
                {hasNutrition ? (
                  <>
                    <Text style={[styles.calorieNumber, { color: colors.text }]}>
                      {kcalNum}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                      kcal per portion
                    </Text>
                  </>
                ) : (
                  <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: "600" }}>
                    Calories not yet computed — open the Ingredients tab to verify
                  </Text>
                )}
              </View>
            );
          })()}

          {/* Polish (2026-04-25 visual-qa): the redundant "MACROS" overline
              was visually dead weight — every tile below already self-labels
              with a coloured chip + label. Removing it tightens the gap
              between the calories hero and the macro tiles, which testers
              flagged as "big gaps between cals and macros". */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: Spacing.lg }}>
            {recipeMacrosToShow.map((macro) => {
              const fiberG = macros.fiber_g ?? 0;
              const sugarG = macros.sugar_g ?? 0;
              const sodiumMg = macros.sodium_mg ?? 0;
              const macroMap: Record<
                string,
                { label: string; cur: number; tgt: number; color: string; unit: string }
              > = {
                protein: { label: "Protein", cur: macros.protein, tgt: userTargets.protein, color: MacroColors.protein, unit: "g" },
                // P3-30 (2026-04-25): apply net-carbs lens. Helpers
                // refuse the "Net carbs" label when fibre is unknown.
                carbs: {
                  label: carbsLabel(fiberG, netCarbsLensEnabled),
                  cur: netCarbsForRow(macros.carbs, fiberG, netCarbsLensEnabled),
                  tgt: netCarbsForRow(userTargets.carbs, userTargets.fiber, netCarbsLensEnabled),
                  color: MacroColors.carbs,
                  unit: "g",
                },
                fat: { label: "Fat", cur: macros.fat, tgt: userTargets.fat, color: MacroColors.fat, unit: "g" },
                // 2026-04-26 polish (round 2): use the canonical
                // `MacroColors.fiber` token (resolves to Accent.success but
                // routing through the shared token means a future fiber
                // colour change ripples consistently). The other macros
                // here already use MacroColors; fiber was the lone Accent
                // direct reference.
                fiber: { label: "Fiber", cur: fiberG, tgt: userTargets.fiber, color: MacroColors.fiber, unit: "g" },
                sugar: { label: "Sugar", cur: sugarG, tgt: REF_SUGAR_G, color: MacroColors.sugar, unit: "g" },
                sodium: { label: "Sodium", cur: sodiumMg, tgt: REF_SODIUM_MG, color: MacroColors.sodium, unit: "mg" },
              };
              const m = macroMap[macro];
              if (!m) return null;
              // Polish (2026-04-25): protein/carbs/fat now keep 1-decimal
              // precision via formatMacroValue (no more "C 105.80000000000001g"
              // float leakage). calories+sodium stay integer.
              const displayAmount = formatMacroValue(m.cur, macro);
              return (
                <View
                  key={macro}
                  style={{
                    flexGrow: 1,
                    minWidth: 76,
                    maxWidth: "48%",
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 5 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: m.color }} />
                    <Text style={{ fontSize: 10, fontWeight: "600", color: colors.textTertiary, letterSpacing: 0.5 }}>{m.label}</Text>
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] }}>
                    {displayAmount}
                    {m.unit}
                  </Text>
                  <View style={{ marginTop: 5, height: 4, borderRadius: 2, backgroundColor: colors.border }}>
                    <View
                      style={{
                        width: `${Math.min(m.cur / Math.max(m.tgt, 1), 1) * 100}%`,
                        height: "100%",
                        borderRadius: 2,
                        backgroundColor: m.color,
                      }}
                    />
                  </View>
                  <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 3, fontVariant: ["tabular-nums"] }}>
                    of {macro === "sugar" ? m.tgt : macro === "sodium" ? m.tgt : Math.round(m.tgt)}
                    {m.unit}
                  </Text>
                </View>
              );
            })}
          </View>


          {/* Description */}
          {(() => {
            // Polish (2026-04-25): the legacy "[TEMP SEED] " seeder prefix
            // shipped to prod on a few rows; sanitizeRecipeDescription strips
            // it defensively. Empty after strip → don't render the card.
            const cleanDescription = sanitizeRecipeDescription(recipe.description);
            if (!cleanDescription) return null;
            return (
              <View style={styles.card}>
                <Text style={styles.descText}>{decodeEntities(cleanDescription)}</Text>
              </View>
            );
          })()}

          {/*
            T12 (2026-04-24) — regulated-allergen callout on every
            recipe. Closes DI-P0-01. Empty array still surfaces the
            caveat so silence is never read as safety. Never paywalled.
          */}
          {(() => {
            const normalised = normaliseAllergenIds(recipe.allergens ?? []);
            const containsLine = formatContainsLine(normalised);
            return (
              <View
                style={styles.card}
                accessibilityRole="text"
                accessibilityLabel="Regulated-allergen information"
                testID="recipe-allergen-callout"
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: colors.text,
                    marginBottom: 4,
                  }}
                >
                  {containsLine ?? "Not tagged for allergens"}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textSecondary,
                    lineHeight: 17,
                  }}
                >
                  We tag recipes from matched ingredients at import and verify time. Always verify ingredients against the original source if an allergen is a safety concern.
                </Text>
              </View>
            );
          })()}

          {/* Portion adjustment banner */}
          {portionMultiplier !== 1 && (
            <View style={{ backgroundColor: Accent.primary + "15", borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Accent.primary + "30" }}>
              <Text style={{ color: Accent.primary, fontWeight: "700", fontSize: 14, textAlign: "center" }}>
                Planned portion: {portionMultiplier}x — quantities below are adjusted
              </Text>
            </View>
          )}

          {/* Tab Bar */}
          <View style={styles.tabBar}>
            <Pressable
              style={[styles.tab, activeTab === "ingredients" && { borderBottomColor: Accent.primary }]}
              onPress={() => setActiveTab("ingredients")}
            >
              <Text style={activeTab === "ingredients" ? styles.tabTextActive : styles.tabText}>Ingredients</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === "steps" && { borderBottomColor: Accent.primary }]}
              onPress={() => setActiveTab("steps")}
            >
              <Text style={activeTab === "steps" ? styles.tabTextActive : styles.tabText}>Steps</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === "nutrition" && { borderBottomColor: Accent.primary }]}
              onPress={() => setActiveTab("nutrition")}
            >
              <Text style={activeTab === "nutrition" ? styles.tabTextActive : styles.tabText}>Nutrition</Text>
            </Pressable>
          </View>

          {/* Ingredients Tab */}
          {activeTab === "ingredients" && ingredients.length > 0 && (
              <View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md }}>
                <Text style={styles.cardTitle}>Ingredients</Text>
                <Pressable onPress={() => router.push(`/recipe/verify?id=${recipeId}`)}>
                  <Text style={{ color: Accent.primary, fontSize: 13, fontWeight: "600" }}>Edit</Text>
                </Pressable>
              </View>
              {autoVerifyingIngredients && (
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textSecondary,
                    marginBottom: Spacing.md,
                    lineHeight: 17,
                  }}
                >
                  Matching each line against the food database (USDA / Open Food Facts / FatSecret / Edamam when
                  configured)…
                </Text>
              )}
              {!autoVerifyingIngredients &&
                !ingredientsHaveNutrition &&
                recipe != null &&
                (recipe.calories > 0 || recipe.protein > 0 || recipe.carbs > 0 || recipe.fat > 0) && (
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.textSecondary,
                      marginBottom: Spacing.md,
                      lineHeight: 17,
                    }}
                  >
                    Per-line calories below are a local fallback (staples + scaling) when the database lookup could not
                    run — open this screen signed in with the API reachable, or use the{" "}
                    <Text style={{ fontWeight: "700" }}>Nutrition</Text> tab for totals.
                  </Text>
                )}
              {ingredientsForIngredientsTab.map((ing, i) => {
                const rowCal = Math.round(ing.calories ?? 0);
                const rowPro = ing.protein ?? 0;
                const rowCarbs = ing.carbs ?? 0;
                const rowFat = ing.fat ?? 0;
                const totalMacros = rowPro + rowCarbs + rowFat;
                const proteinPct = totalMacros > 0 ? (rowPro / totalMacros) * 100 : 0;
                const carbsPct = totalMacros > 0 ? (rowCarbs / totalMacros) * 100 : 0;
                const fatPct = totalMacros > 0 ? (rowFat / totalMacros) * 100 : 0;

                const conf = ing.confidence != null ? Number(ing.confidence) : null;
                const confPct = conf != null && Number.isFinite(conf) ? Math.round(conf * 100) : null;
                const confColor = confPct != null
                  ? confPct >= 75 ? Accent.success : confPct >= 50 ? Accent.warning : Accent.destructive
                  : colors.textTertiary;
                const confLabel = confPct != null
                  ? confPct >= 75 ? "Verified" : confPct >= 50 ? "Partial match" : "Estimated"
                  : "Unverified";
                const sourceLabel = ing.source ?? "Local estimate";

                return (
                  <Pressable
                    key={i}
                    onPress={() => {
                      Alert.alert(
                        `${decodeEntities(ing.name)}`,
                        `Confidence: ${confPct != null ? `${confPct}% — ${confLabel}` : "Not scored"}\n` +
                        `Source: ${sourceLabel}\n\n` +
                        `${Math.round(rowCal)} kcal · P ${Math.round(rowPro)}g · C ${Math.round(rowCarbs)}g · F ${Math.round(rowFat)}g\n\n` +
                        (!ingredientsHaveNutrition
                          ? recipe != null && (recipe.calories ?? 0) > 0
                            ? "These per-line macros are locally estimated from the ingredient text and scaled to the recipe’s calorie total. Use the Nutrition tab for full-dish aggregates."
                            : "This recipe doesn't have per-ingredient nutrition in the database — use the Nutrition tab for recipe-level totals."
                          : confPct != null && confPct < 75
                          ? "This ingredient had a weaker match. The macros may be approximate. You can edit this recipe to improve accuracy."
                          : confPct != null
                            ? "This ingredient was matched to a verified food database entry."
                            : "This ingredient was estimated from our staples database and hasn't been verified against external sources."),
                      );
                    }}
                    style={styles.ingredientRowNew}
                  >
                    {/* Confidence dot */}
                    {confPct != null && (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: confColor, marginTop: 6, marginRight: 8 }} />
                    )}
                    <View style={styles.ingredientNameAndCal}>
                      <View style={styles.ingredientNameRow}>
                        <Text style={styles.ingredientName}>{decodeEntities(ing.name)}</Text>
                        {/* P2-30 (2026-04-25 ui-critic): suppress the
                            "0 kcal" right-column when the ingredient
                            has no resolved nutrition. The "0" reads as
                            a confident value when it really means
                            "didn't compute"; blank space lets the
                            ingredient text breathe. */}
                        {rowCal > 0 ? (
                          <Text style={styles.ingredientCalories}>{Math.round(rowCal)} kcal</Text>
                        ) : null}
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        {/* P2-30: also suppress the "as needed" parser
                            fallback when no amount was extracted —
                            it's not a real instruction, it's a parser
                            shrug. */}
                        {ing.amount != null ? (
                          <Text style={styles.ingredientQty}>
                            {`${Math.round(ing.amount * portionMultiplier * 100) / 100} ${ing.unit ?? ""}`}
                          </Text>
                        ) : null}
                        {confPct != null && (
                          <Text style={{ fontSize: 10, color: confColor, fontWeight: "600" }}>
                            {/* 2026-04-26 polish (round 2): pre-fix the
                                row showed bare "35%" / "98%" with no
                                indication of what the percentage meant.
                                Tapping opens a full explanation but the
                                inline label is the at-a-glance signal.
                                Verified ≥75% / Partial 50–74% / Estimated
                                <50%. */}
                            {confPct}% · {confLabel}
                          </Text>
                        )}
                        {/* Phase 4 / B3.X — SourceDot per ingredient row
                            (D-2026-04-27-16). Sized 6pt to match the
                            spec §1.6 row treatment. */}
                        <SourceDot
                          source={mapMealSourceToDot(ing.source ?? null)}
                          size={6}
                        />
                        {/* Phase 5 / B3.M — inline "Verify →" text-button
                            on estimated ingredient rows. V-5 parity gap
                            with web closed: the Pressable wrapping the
                            row still opens the explainer Alert; this
                            secondary text-button takes the user straight
                            to /recipe/verify so they can resolve the
                            row without going through the explainer
                            first. Surfaces only when the row is below
                            the verified threshold (confPct < 75 or
                            unverified). Production design spec §1.6 +
                            Surface H §Ingredients. */}
                        {(confPct == null || confPct < 75) && recipeId ? (
                          <Pressable
                            accessibilityRole="link"
                            accessibilityLabel={`Verify ${ing.name}`}
                            onPress={(e) => {
                              // Stop the parent Pressable's Alert from firing
                              // — the user has indicated they want the
                              // verify route, not the explainer.
                              e.stopPropagation();
                              router.push(
                                `/recipe/verify?id=${recipeId}` as never,
                              );
                            }}
                            hitSlop={6}
                            testID={`ingredient-verify-cta-${i}`}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "700",
                                color: Accent.primary,
                              }}
                            >
                              Verify →
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                      {/* F-85 (2026-04-25) — per-ingredient macro split bar
                          removed. Per ui-critic: a user cooking pancakes
                          does not need to see "egg is mostly fat" at a
                          glance. The recipe-level macro split in the
                          Nutrition tab is the source of truth; per-row
                          bars added visual noise that competed with the
                          ingredient name and gram count for the eye. */}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
          {/* FatSecret attribution — ToS requires the badge wherever
              FatSecret-sourced content is displayed. Rendered at the
              foot of the ingredient list when FatSecret ingredients
              are present. */}
          {hasFatSecretIngredients ? (
            <FatSecretBadge
              variant="text"
              style={{ marginTop: 8, marginLeft: 4 }}
              testID="fatsecret-badge-ingredients"
            />
          ) : null}

          {/* Steps Tab */}
          {activeTab === "steps" && instructionSteps.length > 0 && (
            <View>
              {instructionSteps.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step.replace(/^\d+[\.\)\-]\s*/, "")}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Nutrition Tab */}
          {activeTab === "nutrition" && (
            <>
            <View>
              {/* 2x2 Grid (polish 2026-04-25 — formatMacroValue centralises
                  rounding so protein/carbs/fat keep 1-decimal precision and
                  calories stays integer). */}
              <View style={styles.nutritionGrid}>
                <View style={styles.nutritionGridRow}>
                  <View style={styles.nutritionCard}>
                    <Text style={[styles.nutritionValue, { color: Accent.primary }]}>{formatMacroValue(macros.calories, "calories")}</Text>
                    <Text style={styles.nutritionLabel}>Calories</Text>
                  </View>
                  <View style={styles.nutritionCard}>
                    <Text style={[styles.nutritionValue, { color: MacroColors.protein }]}>{formatMacroValue(macros.protein, "protein")}</Text>
                    <Text style={styles.nutritionLabel}>Protein (g)</Text>
                  </View>
                </View>
                <View style={styles.nutritionGridRow}>
                  <View style={styles.nutritionCard}>
                    <Text style={[styles.nutritionValue, { color: MacroColors.carbs }]}>{formatMacroValue(macros.carbs, "carbs")}</Text>
                    <Text style={styles.nutritionLabel}>Carbs (g)</Text>
                  </View>
                  <View style={styles.nutritionCard}>
                    <Text style={[styles.nutritionValue, { color: MacroColors.fat }]}>{formatMacroValue(macros.fat, "fat")}</Text>
                    <Text style={styles.nutritionLabel}>Fat (g)</Text>
                  </View>
                </View>
              </View>

              {/* Micronutrients Section — real data from ingredients */}
              <View style={styles.micronutrientsSection}>
                <Text style={styles.microLabel}>MICRONUTRIENTS</Text>
                <View style={styles.microRow}>
                  <Text style={styles.microName}>Fiber</Text>
                  <View style={styles.microBarContainer}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.round((macros.fiber_g / (userTargets?.fiber ?? 28)) * 100))}%` }]} />
                    </View>
                  </View>
                  <Text style={styles.microValue}>{macros.fiber_g}g</Text>
                </View>
                <View style={styles.microRow}>
                  <Text style={styles.microName}>Sugar</Text>
                  <View style={styles.microBarContainer}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.round((macros.sugar_g / 50) * 100))}%` }]} />
                    </View>
                  </View>
                  <Text style={styles.microValue}>{macros.sugar_g}g</Text>
                </View>
                <View style={[styles.microRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.microName}>Sodium</Text>
                  <View style={styles.microBarContainer}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.round((macros.sodium_mg / 2300) * 100))}%` }]} />
                    </View>
                  </View>
                  <Text style={styles.microValue}>{macros.sodium_mg}mg</Text>
                </View>
              </View>
            </View>
            {/* FatSecret attribution on the Nutrition tab. */}
            {hasFatSecretIngredients ? (
              <FatSecretBadge
                variant="text"
                style={{ marginTop: 8, marginLeft: 4 }}
                testID="fatsecret-badge-nutrition"
              />
            ) : null}
            </>
          )}

          {/* Log to journal — portion vs one recipe serving */}
          {userId && (
            <View style={[styles.card, { gap: Spacing.sm }]}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>Log to journal</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Pressable
                  onPress={() => setLogPortion((p) => Math.max(0.125, Math.round((p - 0.25) * 1000) / 1000))}
                  style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm, borderWidth: 1, borderColor: colors.border }}
                >
                  <Minus size={16} color={colors.text} />
                </Pressable>
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, minWidth: 40, textAlign: "center", fontVariant: ["tabular-nums"] }}>
                  {(Math.round(logPortion * 1000) / 1000).toString()}×
                </Text>
                <Pressable
                  onPress={() => setLogPortion((p) => Math.min(24, Math.round((p + 0.25) * 1000) / 1000))}
                  style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm, borderWidth: 1, borderColor: colors.border }}
                >
                  <Plus size={16} color={colors.text} />
                </Pressable>
                <View style={{ flex: 1 }} />
                <Text style={{ fontSize: 11, color: colors.textTertiary, fontVariant: ["tabular-nums"] }}>
                  {scaledForLog.calories} kcal
                </Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                {/* 2026-04-26 polish: dropped the asymmetric 0.75× preset.
                    The planner clamp is now {0.5, 1, 1.5, 2}; matching the
                    log presets to the same set keeps "1× by default, half
                    when smaller / 1.5×–2× when larger" as the only mental
                    model the user has to learn. The +/– stepper still
                    allows finer increments for users who really need them. */}
                {([0.5, 1, 1.5, 2] as const).map((p) => {
                  const active = Math.abs(logPortion - p) < 1e-6;
                  return (
                    <Pressable
                      key={p}
                      onPress={() => setLogPortion(p)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: Radius.sm,
                        backgroundColor: active ? Accent.primary : colors.inputBg,
                        borderWidth: 1,
                        borderColor: active ? Accent.primary : colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "600", color: active ? "#fff" : colors.text }}>{p}×</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                disabled={loggingJournal}
                onPress={() => void addRecipeToTodayJournal()}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 10,
                  borderRadius: Radius.md,
                  backgroundColor: Accent.primary,
                  opacity: loggingJournal ? 0.6 : 1,
                }}
              >
                {loggingJournal ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <PlusCircle size={16} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Log</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* Action button */}
          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: Accent.primary, flex: 1 }]}
              onPress={() => { setCookStep(0); setCookMode(true); }}
            >
              <UtensilsCrossed size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.actionBtnText}>Start Cooking</Text>
            </Pressable>
          </View>

          {/* Batch 3.8 — Personal notes + rating */}
          <RecipeNotesCard recipeId={recipeId} userId={userId} colors={colors} />

          {/* Source attribution — kept at the very bottom so it's the last
              thing a user sees after scrolling through a full recipe. The
              top-of-page byline link is the primary entry point; this is
              the secondary entry + provenance label. TestFlight build 7
              feedback `AMAxKVVxPZtUvGz8I6Yqo3w` (2026-04-18) — the bottom
              source section had previously been lost in a refactor.
              Build 10 / TestFlight `ACEH_Ilshzp` (2026-04-19) — widen the
              gate so social-caption imports with `source_name` but no
              `source_url` still show attribution. Three render modes:
                - both set       → `source_name` as link text, opens URL
                - url only       → URL as link text (legacy)
                - name only      → plain "Source · {name}", no href
              Never synthesise a URL — a missing source_url stays missing. */}
          {(recipe.source_url || recipe.source_name) && (
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
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={yieldEditOpen}
        animationType="fade"
        transparent
        onRequestClose={() => !recipeYieldSaving && setYieldEditOpen(false)}
      >
        <View
          style={{ flex: 1, backgroundColor: "#00000066", justifyContent: "center", paddingHorizontal: Spacing.xl }}
        >
          <View
            style={{
              borderRadius: Radius.lg,
              paddingVertical: Spacing.lg,
              paddingHorizontal: Spacing.lg,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              gap: Spacing.sm,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>Servings</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
              Portions the full dish makes (1–48). Macros per portion update automatically.
            </Text>
            <TextInput
              value={recipeYieldDraft}
              onChangeText={setRecipeYieldDraft}
              keyboardType="number-pad"
              editable={!recipeYieldSaving}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: Radius.md,
                paddingVertical: 10,
                paddingHorizontal: 12,
                fontSize: 17,
                fontWeight: "700",
                color: colors.text,
                backgroundColor: colors.background,
              }}
            />
            <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs }}>
              <Pressable
                onPress={() => !recipeYieldSaving && setYieldEditOpen(false)}
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void saveRecipeYield()}
                disabled={recipeYieldSaving}
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  borderRadius: Radius.md,
                  backgroundColor: Accent.primary,
                  alignItems: "center",
                  opacity: recipeYieldSaving ? 0.65 : 1,
                }}
              >
                <Text style={{ fontWeight: "800", color: "#fff", fontSize: 15 }}>{recipeYieldSaving ? "Saving…" : "Save"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cook Mode Overlay */}
      {cookMode && instructionSteps.length > 0 && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background, paddingTop: insets.top + 20, paddingHorizontal: Spacing.xl, justifyContent: "space-between", paddingBottom: insets.bottom + 20 }}>
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: Accent.primary, letterSpacing: 2 }}>COOK MODE</Text>
              <Pressable onPress={() => setCookMode(false)}>
                <X size={28} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 8 }}>
              Step {cookStep + 1} of {instructionSteps.length}
            </Text>
            <Text style={{ fontSize: 22, fontWeight: "600", color: colors.text, lineHeight: 32 }}>
              {instructionSteps[cookStep]?.replace(/^\d+[\.\)\-]\s*/, "")}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: Spacing.md }}>
            <Pressable
              style={{ flex: 1, backgroundColor: cookStep > 0 ? colors.card : colors.border, borderRadius: Radius.md, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
              onPress={() => setCookStep((s) => Math.max(0, s - 1))}
              disabled={cookStep === 0}
            >
              <Text style={{ fontWeight: "700", color: cookStep > 0 ? colors.text : colors.textTertiary }}>Previous</Text>
            </Pressable>
            {cookStep < instructionSteps.length - 1 ? (
              <Pressable
                style={{ flex: 1, backgroundColor: Accent.primary, borderRadius: Radius.md, paddingVertical: 16, alignItems: "center" }}
                onPress={() => setCookStep((s) => s + 1)}
              >
                <Text style={{ fontWeight: "700", color: "#fff" }}>Next</Text>
              </Pressable>
            ) : (
              <Pressable
                style={{ flex: 1, backgroundColor: Accent.success, borderRadius: Radius.md, paddingVertical: 16, alignItems: "center" }}
                onPress={() => setCookMode(false)}
              >
                <Text style={{ fontWeight: "700", color: "#fff" }}>Done!</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

