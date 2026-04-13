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
import { Neon, MacroColors, Spacing, Radius } from "@/constants/theme";
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
        <Text style={{ color, fontSize: 12, fontWeight: "700" }}>{value}g</Text>
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
      backgroundColor: Neon.purple + "20",
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.sm,
    },
    mealTypeText: { color: Neon.purple, fontSize: 12, fontWeight: "600", textTransform: "capitalize" },

    calorieHero: { alignItems: "center", paddingVertical: Spacing.lg },
    calorieNumber: { fontSize: 48, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] },
    calorieLabel: { fontSize: 14, color: colors.textSecondary, marginTop: -4 },

    card: {
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: Neon.pink + "25",
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
    ingredientDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Neon.purple, marginTop: 6 },
    ingredientText: { fontSize: 14, color: colors.text },
    ingredientAmount: { fontWeight: "600" },
    ingMacroRow: { flexDirection: "row", gap: Spacing.sm, marginTop: 4 },
    ingMacro: { fontSize: 11, color: colors.textTertiary, fontWeight: "600", fontVariant: ["tabular-nums"] as any },

    stepRow: { flexDirection: "row", gap: Spacing.md, paddingVertical: Spacing.sm },
    stepNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: Neon.purple,
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
      borderColor: Neon.purple + "55",
    },
    sourceLinkText: { color: Neon.purple, fontSize: 14, fontWeight: "600" },

    actionsRow: { gap: Spacing.md, paddingBottom: 40 },
    actionBtn: {
      flexDirection: "row",
      borderRadius: Radius.md,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  }), [colors]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Neon.purple} />
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
            style={[styles.headerBtn, { right: Spacing.lg }]}
            onPress={() => toggleSave(recipeId)}
          >
            <Ionicons
              name={saved ? "bookmark" : "bookmark-outline"}
              size={20}
              color={saved ? Neon.green : "#fff"}
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

          {/* Calorie hero */}
          <View style={styles.calorieHero}>
            <Text style={styles.calorieNumber}>{macros.calories}</Text>
            <Text style={styles.calorieLabel}>calories</Text>
          </View>

          {/* Macro rings */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Macronutrients</Text>
            <View style={styles.macroRingsRow}>
              <MacroRing value={macros.protein} goal={150} color={MacroColors.protein} label="Protein" ringBgColor={colors.border} labelColor={colors.textSecondary} />
              <MacroRing value={macros.carbs} goal={200} color={MacroColors.carbs} label="Carbs" ringBgColor={colors.border} labelColor={colors.textSecondary} />
              <MacroRing value={macros.fat} goal={65} color={MacroColors.fat} label="Fat" ringBgColor={colors.border} labelColor={colors.textSecondary} />
              <MacroRing value={macros.fiber_g} goal={28} color={MacroColors.fiber} label="Fibre" ringBgColor={colors.border} labelColor={colors.textSecondary} />
            </View>
            <Text style={styles.servings}>Per serving · {recipe.servings} serving{recipe.servings !== 1 ? "s" : ""}</Text>
            {recipe.servings > 1 && (
              <Text style={styles.totalLine}>
                Whole recipe: {totalMacros.calories} kcal · {totalMacros.protein}g protein · {totalMacros.carbs}g carbs · {totalMacros.fat}g fat
              </Text>
            )}
          </View>

          {/* Description */}
          {recipe.description && (
            <View style={styles.card}>
              <Text style={styles.descText}>{decodeEntities(recipe.description)}</Text>
            </View>
          )}

          {/* Portion adjustment banner */}
          {portionMultiplier !== 1 && (
            <View style={{ backgroundColor: Neon.purple + "15", borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Neon.purple + "30" }}>
              <Text style={{ color: Neon.purple, fontWeight: "700", fontSize: 14, textAlign: "center" }}>
                Planned portion: {portionMultiplier}x — quantities below are adjusted
              </Text>
            </View>
          )}

          {/* Ingredients */}
          {ingredients.length > 0 && (
            <View style={styles.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.cardTitle}>Ingredients</Text>
                <Pressable onPress={() => router.push(`/recipe/verify?id=${recipeId}`)}>
                  <Text style={{ color: Neon.purple, fontSize: 13, fontWeight: "600" }}>Edit</Text>
                </Pressable>
              </View>
              {ingredients.map((ing, i) => (
                <View key={i} style={styles.ingredientRow}>
                  <View style={styles.ingredientDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ingredientText}>
                      <Text style={styles.ingredientAmount}>
                        {ing.amount != null ? `${Math.round(ing.amount * portionMultiplier * 100) / 100} ${ing.unit ?? ""} ` : ""}
                      </Text>
                      {decodeEntities(ing.name)}
                    </Text>
                    <View style={styles.ingMacroRow}>
                      <Text style={styles.ingMacro}>{ing.calories} kcal</Text>
                      <Text style={[styles.ingMacro, { color: MacroColors.protein }]}>P:{ing.protein}g</Text>
                      <Text style={[styles.ingMacro, { color: MacroColors.carbs }]}>C:{ing.carbs}g</Text>
                      <Text style={[styles.ingMacro, { color: MacroColors.fat }]}>F:{ing.fat}g</Text>
                      {(ing.fiber_g ?? 0) > 0 && (
                        <Text style={[styles.ingMacro, { color: MacroColors.fiber }]}>Fi:{ing.fiber_g}g</Text>
                      )}
                      {(ing.sugar_g ?? 0) > 0 && (
                        <Text style={[styles.ingMacro, { color: MacroColors.sugar }]}>Su:{ing.sugar_g}g</Text>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Instructions */}
          {instructionSteps.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Instructions</Text>
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
              style={[styles.actionBtn, { backgroundColor: Neon.purple }]}
              onPress={() => toggleSave(recipeId)}
            >
              <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.actionBtnText}>{saved ? "Saved" : "Save to Library"}</Text>
            </Pressable>
            {/* Publish button — only if user is the author and recipe is private */}
            {recipe && (recipe as any).author_id === userId && !(recipe as any).published && (
              <Pressable
                style={[styles.actionBtn, { backgroundColor: Neon.green }]}
                onPress={() => {
                  Alert.alert(
                    "Publish recipe?",
                    "This will make your recipe visible to the Platemate community.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Publish",
                        onPress: async () => {
                          await supabase.from("recipes").update({ published: true }).eq("id", recipeId);
                          Alert.alert("Published!", "Your recipe is now live on Discover.");
                        },
                      },
                    ],
                  );
                }}
              >
                <Ionicons name="globe-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnText}>Publish</Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

