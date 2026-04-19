import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import Constants from "expo-constants";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
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
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/context/auth";
import { useSavedRecipes } from "@/lib/recipes";
import { supabase } from "@/lib/supabase";
import { dateKeyFromDate, newMealId } from "@/lib/nutritionJournal";
import { decodeEntities } from "@/lib/decodeEntities";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useSafeBack } from "@/hooks/use-safe-back";
import { webRecipeDeepLink } from "../../../../src/lib/share/recipeDeepLink";
import { instagramHandleFromPostUrl, tiktokHandleFromPostUrl } from "../../../../src/lib/recipe-import/extractSocialRecipe";
import { normaliseMealSlot } from "../../../../src/lib/nutrition/mealSlots";
import { normaliseInstructions } from "../../../../src/lib/recipes/normaliseInstructions";
import { RecipeNotesCard } from "../../components/RecipeNotesCard";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop";

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
};

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
  const { id, portion } = useLocalSearchParams<{ id: string; portion?: string }>();
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
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [reverifying, setReverifying] = useState(false);
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

  const reverifyNutrition = async () => {
    if (!recipe || ingredients.length === 0 || !session?.access_token) return;
    setReverifying(true);
    try {
      const apiBase = __DEV__ ? "http://localhost:3000" : process.env.EXPO_PUBLIC_API_URL ?? "";
      const res = await fetch(`${apiBase}/api/nutrition/verify-recipe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ingredients: ingredients.map((ing) => ({
            name: ing.name,
            amount: String(ing.amount ?? ""),
            unit: ing.unit ?? "",
          })),
          servings: recipe.servings ?? 1,
        }),
      });
      const json = await res.json();
      if (!json.ok || !json.ingredientRows) {
        Alert.alert("Verification failed", json.message ?? "Could not verify ingredients.");
        return;
      }
      const rows = json.ingredientRows as Array<{
        name: string; grams: number; calories: number; protein: number; carbs: number; fat: number;
        fiber?: number; sugar?: number; sodium?: number; source: string; confidence: number;
      }>;
      const perServing = json.perServing as { calories: number; protein: number; carbs: number; fat: number; fiber?: number; sugar?: number; sodium?: number };

      const { data: dbIngs } = await supabase
        .from("recipe_ingredients")
        .select("id, name")
        .eq("recipe_id", recipeId)
        .order("created_at", { ascending: true });

      if (dbIngs) {
        for (let i = 0; i < Math.min(rows.length, dbIngs.length); i++) {
          const r = rows[i];
          await supabase.from("recipe_ingredients").update({
            calories: Math.round(r.calories),
            protein: Math.round(r.protein),
            carbs: Math.round(r.carbs),
            fat: Math.round(r.fat),
            fiber_g: r.fiber != null ? Math.round(r.fiber * 10) / 10 : 0,
            sugar_g: r.sugar != null ? Math.round(r.sugar * 10) / 10 : 0,
            sodium_mg: r.sodium != null ? Math.round(r.sodium) : 0,
            source: r.source,
            confidence: r.confidence,
          }).eq("id", dbIngs[i].id);
        }
      }

      await supabase.from("recipes").update({
        calories: Math.round(perServing.calories),
        protein: Math.round(perServing.protein),
        carbs: Math.round(perServing.carbs),
        fat: Math.round(perServing.fat),
        fiber_g: perServing.fiber != null ? Math.round(perServing.fiber * 10) / 10 : 0,
        sugar_g: perServing.sugar != null ? Math.round(perServing.sugar * 10) / 10 : 0,
        sodium_mg: perServing.sodium != null ? Math.round(perServing.sodium) : 0,
        is_verified: true,
        verified_at: new Date().toISOString(),
        verified_confidence: json.overallConfidence ?? null,
        verified_source: "re-verified",
      }).eq("id", recipeId);

      // Reload
      let reloadRes = await supabase
        .from("recipe_ingredients")
        .select("name, amount, unit, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, confidence, source")
        .eq("recipe_id", recipeId);
      if (reloadRes.error && String(reloadRes.error.message).includes("column")) {
        reloadRes = await supabase
          .from("recipe_ingredients")
          .select("name, amount, unit, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg")
          .eq("recipe_id", recipeId) as any;
      }
      if (reloadRes.data) setIngredients(reloadRes.data as Ingredient[]);
      setRecipe((prev) => prev ? { ...prev, calories: Math.round(perServing.calories), protein: Math.round(perServing.protein), carbs: Math.round(perServing.carbs), fat: Math.round(perServing.fat) } : prev);

      Alert.alert("Re-verified", `Nutrition updated for ${ingredients.length} ingredients.`);
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
          "id, title, description, instructions, image_url, servings, prep_time_min, cook_time_min, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, meal_type, source_url, source_name, author_id",
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

  // Compute totals from actual ingredients so they always match what's displayed
  const { macros, totalMacros } = useMemo(() => {
    if (ingredients.length === 0 && recipe) {
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
  }, [ingredients, recipe]);

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
    }),
    [macros, logPortion],
  );

  const addRecipeToTodayJournal = useCallback(async () => {
    if (!userId || !recipe) return;
    setLoggingJournal(true);
    try {
      const dk = dateKeyFromDate(new Date());
      const slot = journalSlotFromMealTypes(recipe.meal_type);
      const mult = Math.max(0.125, Math.min(24, logPortion));
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
        portion_multiplier: mult,
        source: "Recipe",
      });
      if (error) {
        Alert.alert("Could not log", error.message);
      } else {
        Alert.alert("Logged", `${recipe.title} added to today at ${mult}× portion.`, [
          { text: "Stay", style: "cancel" },
          { text: "View Today", onPress: () => router.push("/(tabs)" as any) },
        ]);
      }
    } finally {
      setLoggingJournal(false);
    }
  }, [userId, recipe, scaledForLog, logPortion, router]);

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

    hero: { width: "100%", height: 280, backgroundColor: colors.border },
    headerBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "#000000aa",
      justifyContent: "center",
      alignItems: "center",
    },
    headerBtnText: { color: "#ffffff", fontSize: 22, fontWeight: "600" },

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
    calorieNumber: { fontSize: 48, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] },
    calorieLabel: { fontSize: 14, color: colors.textSecondary, marginTop: -4 },

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
    ingredientNameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    ingredientName: { fontSize: 14, color: colors.text, fontWeight: "500" },
    ingredientCalories: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
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

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero image — full bleed, buttons handle their own safe area */}
        <View>
          <Image source={{ uri: heroImageUrl }} style={styles.hero} />
          {/* Header buttons row */}
          <View style={{ position: "absolute", top: insets.top + Spacing.sm, left: Spacing.md, right: Spacing.md, flexDirection: "row", justifyContent: "space-between" }}>
            <Pressable style={styles.headerBtn} onPress={goBack}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
            <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            style={styles.headerBtn}
            onPress={() => {
              const extra = Constants.expoConfig?.extra as { supprApiUrl?: string } | undefined;
              const origin = (extra?.supprApiUrl ?? "").replace(/\/$/, "") || "https://suppr-club.com";
              const url = webRecipeDeepLink(String(recipeId), origin);
              const title = decodeEntities(recipe.title);
              void Share.share({ message: `${title}\n${url}`, url }).catch(() => {
                void Linking.openURL(url);
              });
            }}
          >
            <Ionicons name="share-social-outline" size={20} color="#fff" />
          </Pressable>
          <Pressable
            style={styles.headerBtn}
            onPress={() => toggleSave(recipeId)}
          >
            <Ionicons
              name={saved ? "bookmark" : "bookmark-outline"}
              size={20}
              color={saved ? Accent.success : "#fff"}
            />
          </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {/* Title + meta */}
          <Text style={styles.title}>{decodeEntities(recipe.title)}</Text>
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
              <Ionicons name="time-outline" size={20} color={colors.textSecondary} style={styles.infoIcon} />
              <Text style={styles.infoValue}>
                {recipe.prep_time_min != null && recipe.prep_time_min > 0 ? `${recipe.prep_time_min}m` : "—"}
              </Text>
              <Text style={styles.infoLabel}>Prep</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="timer-outline" size={20} color={colors.textSecondary} style={styles.infoIcon} />
              <Text style={styles.infoValue}>
                {recipe.cook_time_min != null && recipe.cook_time_min > 0 ? `${recipe.cook_time_min}m` : "—"}
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
                <Ionicons name="people-outline" size={20} color={colors.textSecondary} style={styles.infoIcon} />
                <Text style={styles.infoValue}>{recipe.servings}</Text>
                <Text style={styles.infoLabel}>Servings</Text>
              </Pressable>
            ) : (
              <View style={styles.infoItem}>
                <Ionicons name="people-outline" size={20} color={colors.textSecondary} style={styles.infoIcon} />
                <Text style={styles.infoValue}>{recipe.servings}</Text>
                <Text style={styles.infoLabel}>Servings</Text>
              </View>
            )}
            <View style={styles.infoItem}>
              <Ionicons name="checkmark-circle-outline" size={20} color={Accent.success} style={styles.infoIcon} />
              <Text style={styles.infoValue}>92%</Text>
              <Text style={styles.infoLabel}>Confidence</Text>
            </View>
          </View>

          {/* Calories hero (per portion); macro tiles follow dashboard widget prefs */}
          <View
            style={{
              alignItems: "center",
              marginBottom: Spacing.md,
              paddingVertical: Spacing.lg,
              paddingHorizontal: Spacing.lg,
              borderRadius: Radius.lg,
              borderWidth: 1,
              borderColor: MacroColors.calories + "55",
              backgroundColor: MacroColors.calories + "14",
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "800", color: MacroColors.calories, letterSpacing: 1 }}>
              CALORIES PER PORTION
            </Text>
            <Text style={[styles.calorieNumber, { marginTop: 8, color: colors.text }]}>{Math.round(macros.calories)}</Text>
            <Text style={[styles.calorieLabel, { color: colors.textSecondary }]}>kilocalories</Text>
          </View>

          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textTertiary, letterSpacing: 0.6, marginBottom: Spacing.sm }}>
            Macros
          </Text>
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
                carbs: { label: "Carbs", cur: macros.carbs, tgt: userTargets.carbs, color: MacroColors.carbs, unit: "g" },
                fat: { label: "Fat", cur: macros.fat, tgt: userTargets.fat, color: MacroColors.fat, unit: "g" },
                fiber: { label: "Fiber", cur: fiberG, tgt: userTargets.fiber, color: Accent.success, unit: "g" },
                sugar: { label: "Sugar", cur: sugarG, tgt: REF_SUGAR_G, color: MacroColors.sugar, unit: "g" },
                sodium: { label: "Sodium", cur: sodiumMg, tgt: REF_SODIUM_MG, color: MacroColors.sodium, unit: "mg" },
              };
              const m = macroMap[macro];
              if (!m) return null;
              const displayAmount =
                macro === "sugar" || macro === "fiber"
                  ? Math.round(m.cur * 10) / 10
                  : macro === "sodium"
                    ? Math.round(m.cur)
                    : Math.round(m.cur);
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
          {recipe.description && (
            <View style={styles.card}>
              <Text style={styles.descText}>{decodeEntities(recipe.description)}</Text>
            </View>
          )}

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
              {ingredients.map((ing, i) => {
                const totalMacros = ing.protein + ing.carbs + ing.fat;
                const proteinPct = totalMacros > 0 ? (ing.protein / totalMacros) * 100 : 0;
                const carbsPct = totalMacros > 0 ? (ing.carbs / totalMacros) * 100 : 0;
                const fatPct = totalMacros > 0 ? (ing.fat / totalMacros) * 100 : 0;

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
                        `${Math.round(ing.calories)} kcal · P ${Math.round(ing.protein)}g · C ${Math.round(ing.carbs)}g · F ${Math.round(ing.fat)}g\n\n` +
                        (confPct != null && confPct < 75
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
                        <Text style={styles.ingredientCalories}>{Math.round(ing.calories)} kcal</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.ingredientQty}>
                          {ing.amount != null ? `${Math.round(ing.amount * portionMultiplier * 100) / 100} ${ing.unit ?? ""}` : "as needed"}
                        </Text>
                        {confPct != null && (
                          <Text style={{ fontSize: 10, color: confColor, fontWeight: "600" }}>{confPct}%</Text>
                        )}
                      </View>
                      <View style={styles.macroBar}>
                        {proteinPct > 0 && <View style={{ flex: proteinPct, backgroundColor: MacroColors.protein }} />}
                        {carbsPct > 0 && <View style={{ flex: carbsPct, backgroundColor: MacroColors.carbs }} />}
                        {fatPct > 0 && <View style={{ flex: fatPct, backgroundColor: MacroColors.fat }} />}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

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
            <View>
              {/* 2x2 Grid */}
              <View style={styles.nutritionGrid}>
                <View style={styles.nutritionGridRow}>
                  <View style={styles.nutritionCard}>
                    <Text style={[styles.nutritionValue, { color: Accent.primary }]}>{Math.round(macros.calories)}</Text>
                    <Text style={styles.nutritionLabel}>Calories</Text>
                  </View>
                  <View style={styles.nutritionCard}>
                    <Text style={[styles.nutritionValue, { color: MacroColors.protein }]}>{Math.round(macros.protein)}</Text>
                    <Text style={styles.nutritionLabel}>Protein (g)</Text>
                  </View>
                </View>
                <View style={styles.nutritionGridRow}>
                  <View style={styles.nutritionCard}>
                    <Text style={[styles.nutritionValue, { color: MacroColors.carbs }]}>{Math.round(macros.carbs)}</Text>
                    <Text style={styles.nutritionLabel}>Carbs (g)</Text>
                  </View>
                  <View style={styles.nutritionCard}>
                    <Text style={[styles.nutritionValue, { color: MacroColors.fat }]}>{Math.round(macros.fat)}</Text>
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
                  <Ionicons name="remove" size={16} color={colors.text} />
                </Pressable>
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, minWidth: 40, textAlign: "center", fontVariant: ["tabular-nums"] }}>
                  {(Math.round(logPortion * 1000) / 1000).toString()}×
                </Text>
                <Pressable
                  onPress={() => setLogPortion((p) => Math.min(24, Math.round((p + 0.25) * 1000) / 1000))}
                  style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm, borderWidth: 1, borderColor: colors.border }}
                >
                  <Ionicons name="add" size={16} color={colors.text} />
                </Pressable>
                <View style={{ flex: 1 }} />
                <Text style={{ fontSize: 11, color: colors.textTertiary, fontVariant: ["tabular-nums"] }}>
                  {scaledForLog.calories} kcal
                </Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                {([0.5, 0.75, 1, 1.5, 2] as const).map((p) => {
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
                    <Ionicons name="add-circle-outline" size={16} color="#fff" />
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
              <Ionicons name="restaurant-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
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
                <>
                  <Text style={styles.sourceName}>{recipe.source_name ?? "Source unknown"}</Text>
                  <Pressable
                    style={styles.sourceLinkBtn}
                    onPress={() => Linking.openURL(recipe.source_url!)}
                  >
                    <Text style={styles.sourceLinkText}>View original recipe ↗</Text>
                  </Pressable>
                </>
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
                <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
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

