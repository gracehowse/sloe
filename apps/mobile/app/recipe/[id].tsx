import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/context/auth";
import { useSavedRecipes } from "@/lib/recipes";
import { supabase } from "@/lib/supabase";
import { decodeEntities } from "@/lib/decodeEntities";
import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop";

type FullRecipe = {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  image_url: string | null;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  meal_type: string[] | null;
  source_url: string | null;
  source_name: string | null;
  author: { display_name: string | null; avatar_url: string | null } | null;
};

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
  const portionMultiplier = portion ? parseFloat(portion) : 1;
  const router = useRouter();
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
  const [userTargets, setUserTargets] = useState({ protein: 150, carbs: 200, fat: 65, fiber: 28 });
  const [activeTab, setActiveTab] = useState<"ingredients" | "steps" | "nutrition">("ingredients");

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("target_protein, target_carbs, target_fat, target_fiber_g")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setUserTargets({
          protein: (data.target_protein as number) ?? 150,
          carbs: (data.target_carbs as number) ?? 200,
          fat: (data.target_fat as number) ?? 65,
          fiber: (data.target_fiber_g as number) ?? 28,
        });
      });
  }, [userId]);

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
      const ingRes = await supabase
        .from("recipe_ingredients")
        .select("name, amount, unit, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg")
        .eq("recipe_id", recipeId);
      if (ingRes.data) setIngredients(ingRes.data as Ingredient[]);
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
        .select("id, title, description, instructions, image_url, servings, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, meal_type, source_url, source_name")
        .eq("id", recipeId)
        .maybeSingle();
      if (recipeRes.error?.code === "42703") {
        recipeRes = await supabase
          .from("recipes")
          .select("id, title, description, instructions, image_url, servings, calories, protein, carbs, fat, meal_type")
          .eq("id", recipeId)
          .maybeSingle();
      }
      const ingRes = await supabase
        .from("recipe_ingredients")
        .select("name, amount, unit, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg")
        .eq("recipe_id", recipeId);
      if (cancelled) return;
      if (recipeRes.data) setRecipe(recipeRes.data as any);
      if (ingRes.data) setIngredients(ingRes.data as Ingredient[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [recipeId]);

  const saved = savedIds.has(recipeId);

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

  const instructionSteps = (recipe?.instructions ?? "")
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
      position: "absolute",
      top: Spacing.lg,
      width: 40,
      height: 40,
      borderRadius: 20,
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

    actionsRow: { gap: Spacing.md, paddingBottom: 40 },
    actionBtn: {
      flexDirection: "row",
      borderRadius: Radius.md,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

    infoRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: Spacing.lg, gap: Spacing.md, marginBottom: Spacing.lg },
    infoItem: { alignItems: "center", flex: 1 },
    infoIcon: { marginBottom: 6 },
    infoValue: { fontSize: 14, fontWeight: "700", color: colors.text },
    infoLabel: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },

    macroCardsRow: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.lg },
    macroCard: { flex: 1, padding: 10, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    macroCardDot: { width: 8, height: 8, borderRadius: 2, marginRight: 4 },
    macroCardLabel: { fontSize: 10, fontWeight: "600", color: colors.textTertiary, flexDirection: "row", alignItems: "center" },
    macroCardValue: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 5 },
    caloriesBadge: { paddingHorizontal: 10, borderRadius: 12, backgroundColor: Accent.success + "10", borderWidth: 1, borderColor: Accent.success + "22", alignItems: "center", justifyContent: "center", paddingVertical: 6, marginLeft: Spacing.md },
    caloriesBadgeText: { fontSize: 14, fontWeight: "700", color: Accent.success },

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
  }), [colors]);

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
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero image */}
        <View>
          <Image source={{ uri: heroImageUrl }} style={styles.hero} />
          <Pressable style={[styles.headerBtn, { left: Spacing.lg }]} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <Pressable
            style={[styles.headerBtn, { right: Spacing.lg + 50 }]}
            onPress={() => {
              // Share functionality
              Linking.openURL(`https://yourapp.com/recipe/${recipeId}`);
            }}
          >
            <Ionicons name="share-social-outline" size={20} color="#fff" />
          </Pressable>
          <Pressable
            style={[styles.headerBtn, { right: Spacing.lg }]}
            onPress={() => toggleSave(recipeId)}
          >
            <Ionicons
              name={saved ? "bookmark" : "bookmark-outline"}
              size={20}
              color={saved ? Accent.success : "#fff"}
            />
          </Pressable>
        </View>

        <View style={styles.body}>
          {/* Title + meta */}
          <Text style={styles.title}>{decodeEntities(recipe.title)}</Text>
          {recipe.author?.display_name && (
            <Text style={styles.authorName}>by {recipe.author.display_name}</Text>
          )}
          {recipe.meal_type && recipe.meal_type.length > 0 && (
            <View style={styles.mealTypeBadge}>
              <Text style={styles.mealTypeText}>{recipe.meal_type.join(", ")}</Text>
            </View>
          )}

          {/* Info row: Prep time, Cook time, Servings, Confidence */}
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={20} color={colors.textSecondary} style={styles.infoIcon} />
              <Text style={styles.infoValue}>30m</Text>
              <Text style={styles.infoLabel}>Prep</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="timer-outline" size={20} color={colors.textSecondary} style={styles.infoIcon} />
              <Text style={styles.infoValue}>45m</Text>
              <Text style={styles.infoLabel}>Cook</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="people-outline" size={20} color={colors.textSecondary} style={styles.infoIcon} />
              <Text style={styles.infoValue}>{recipe.servings}</Text>
              <Text style={styles.infoLabel}>Servings</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="checkmark-circle-outline" size={20} color={Accent.success} style={styles.infoIcon} />
              <Text style={styles.infoValue}>92%</Text>
              <Text style={styles.infoLabel}>Confidence</Text>
            </View>
          </View>

          {/* Macro cards and calorie badge */}
          <View style={{ flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.lg }}>
            <View style={styles.macroCardsRow}>
              <View style={styles.macroCard}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
                  <View style={[styles.macroCardDot, { backgroundColor: MacroColors.protein }]} />
                  <Text style={styles.macroCardLabel}>PROTEIN</Text>
                </View>
                <Text style={styles.macroCardValue}>{Math.round(macros.protein)}g</Text>
              </View>
              <View style={styles.macroCard}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
                  <View style={[styles.macroCardDot, { backgroundColor: MacroColors.carbs }]} />
                  <Text style={styles.macroCardLabel}>CARBS</Text>
                </View>
                <Text style={styles.macroCardValue}>{Math.round(macros.carbs)}g</Text>
              </View>
              <View style={styles.macroCard}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
                  <View style={[styles.macroCardDot, { backgroundColor: MacroColors.fat }]} />
                  <Text style={styles.macroCardLabel}>FAT</Text>
                </View>
                <Text style={styles.macroCardValue}>{Math.round(macros.fat)}g</Text>
              </View>
            </View>
            <View style={styles.caloriesBadge}>
              <Text style={styles.caloriesBadgeText}>{Math.round(macros.calories)}</Text>
              <Text style={{ fontSize: 10, color: Accent.success, fontWeight: "600" }}>kcal</Text>
            </View>
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
                <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                  <Pressable disabled={reverifying} onPress={() => void reverifyNutrition()}>
                    <Text style={{ color: Accent.success, fontSize: 13, fontWeight: "600", opacity: reverifying ? 0.5 : 1 }}>
                      {reverifying ? "Verifying…" : "Re-verify"}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => router.push(`/recipe/verify?id=${recipeId}`)}>
                    <Text style={{ color: Accent.primary, fontSize: 13, fontWeight: "600" }}>Edit</Text>
                  </Pressable>
                </View>
              </View>
              {ingredients.map((ing, i) => {
                const totalMacros = ing.protein + ing.carbs + ing.fat;
                const proteinPct = totalMacros > 0 ? (ing.protein / totalMacros) * 100 : 0;
                const carbsPct = totalMacros > 0 ? (ing.carbs / totalMacros) * 100 : 0;
                const fatPct = totalMacros > 0 ? (ing.fat / totalMacros) * 100 : 0;

                // Confidence color (placeholder - would come from API)
                const confidence = 0.85; // placeholder
                const confidenceColor = confidence >= 0.8 ? Accent.success : confidence >= 0.6 ? Accent.warning : "#ef4444";

                return (
                  <View key={i} style={styles.ingredientRowNew}>
                    <View style={[styles.confidenceDot, { backgroundColor: confidenceColor }]} />
                    <View style={styles.ingredientNameAndCal}>
                      <View style={styles.ingredientNameRow}>
                        <Text style={styles.ingredientName}>{decodeEntities(ing.name)}</Text>
                        <Text style={styles.ingredientCalories}>{Math.round(ing.calories)} kcal</Text>
                      </View>
                      <Text style={styles.ingredientQty}>
                        {ing.amount != null ? `${Math.round(ing.amount * portionMultiplier * 100) / 100} ${ing.unit ?? ""}` : "as needed"}
                      </Text>
                      <View style={styles.macroBar}>
                        {proteinPct > 0 && <View style={{ flex: proteinPct, backgroundColor: MacroColors.protein }} />}
                        {carbsPct > 0 && <View style={{ flex: carbsPct, backgroundColor: MacroColors.carbs }} />}
                        {fatPct > 0 && <View style={{ flex: fatPct, backgroundColor: MacroColors.fat }} />}
                      </View>
                    </View>
                  </View>
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

              {/* Micronutrients Section */}
              <View style={styles.micronutrientsSection}>
                <Text style={styles.microLabel}>MICRONUTRIENTS</Text>
                <View style={styles.microRow}>
                  <Text style={styles.microName}>Fiber</Text>
                  <View style={styles.microBarContainer}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressBarFill, { width: "65%" }]} />
                    </View>
                  </View>
                  <Text style={styles.microValue}>{macros.fiber_g}g</Text>
                </View>
                <View style={styles.microRow}>
                  <Text style={styles.microName}>Iron</Text>
                  <View style={styles.microBarContainer}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressBarFill, { width: "45%" }]} />
                    </View>
                  </View>
                  <Text style={styles.microValue}>5.2mg</Text>
                </View>
                <View style={styles.microRow}>
                  <Text style={styles.microName}>Calcium</Text>
                  <View style={styles.microBarContainer}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressBarFill, { width: "72%" }]} />
                    </View>
                  </View>
                  <Text style={styles.microValue}>580mg</Text>
                </View>
                <View style={styles.microRow}>
                  <Text style={styles.microName}>Vitamin A</Text>
                  <View style={styles.microBarContainer}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressBarFill, { width: "58%" }]} />
                    </View>
                  </View>
                  <Text style={styles.microValue}>420µg</Text>
                </View>
                <View style={[styles.microRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.microName}>Vitamin C</Text>
                  <View style={styles.microBarContainer}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressBarFill, { width: "85%" }]} />
                    </View>
                  </View>
                  <Text style={styles.microValue}>42mg</Text>
                </View>
              </View>
            </View>
          )}

          {/* Source attribution */}
          {recipe.source_url && (
            <View style={styles.sourceCard}>
              <Text style={styles.sourceLabel}>SOURCE</Text>
              <Text style={styles.sourceName}>{recipe.source_name ?? "Original recipe"}</Text>
              <Pressable
                style={styles.sourceLinkBtn}
                onPress={() => Linking.openURL(recipe.source_url!)}
              >
                <Text style={styles.sourceLinkText}>View original recipe ↗</Text>
              </Pressable>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: Accent.primary }]}
              onPress={() => { setCookStep(0); setCookMode(true); }}
            >
              <Ionicons name="restaurant-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.actionBtnText}>Start Cooking</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
              onPress={() => {
                Alert.alert("Recipe Completed!", "Mark this recipe as made?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Confirm", onPress: () => { /* Log completion */ } },
                ]);
              }}
            >
              <Ionicons name="checkmark-done" size={18} color={colors.text} style={{ marginRight: 6 }} />
              <Text style={[styles.actionBtnText, { color: colors.text }]}>I Made This</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

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

