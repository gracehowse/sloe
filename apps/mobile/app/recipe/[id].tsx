import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { useAuth } from "@/context/auth";
import { useSavedRecipes } from "@/lib/recipes";
import { supabase } from "@/lib/supabase";
import { Neon, MacroColors, Spacing, Radius } from "@/constants/theme";

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
  fiber_g: number | null;
  meal_type: string | null;
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
};

function MacroRing({ value, goal, color, label, size = 56 }: { value: number; goal: number; color: string; label: string; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size} style={{ position: "absolute" }}>
          <Circle cx={size/2} cy={size/2} r={r} stroke="#1e1e2a" strokeWidth={5} fill="none" />
          <Circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={5} fill="none"
            strokeDasharray={`${circ}`} strokeDashoffset={circ*(1-pct)} strokeLinecap="round"
            rotation="-90" origin={`${size/2},${size/2}`} />
        </Svg>
        <Text style={{ color, fontSize: 12, fontWeight: "700" }}>{value}g</Text>
      </View>
      <Text style={{ color: "#94a3b8", fontSize: 10, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { savedIds, toggleSave } = useSavedRecipes(userId);

  const recipeId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";
  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState<FullRecipe | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);

  useEffect(() => {
    if (!recipeId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const [recipeRes, ingRes] = await Promise.all([
        supabase
          .from("recipes")
          .select("id, title, description, instructions, image_url, servings, calories, protein, carbs, fat, fiber_g, meal_type, author:profiles(display_name, avatar_url)")
          .eq("id", recipeId)
          .maybeSingle(),
        supabase
          .from("recipe_ingredients")
          .select("name, amount, unit, calories, protein, carbs, fat")
          .eq("recipe_id", recipeId),
      ]);
      if (cancelled) return;
      if (recipeRes.data) setRecipe(recipeRes.data as any);
      if (ingRes.data) setIngredients(ingRes.data as Ingredient[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [recipeId]);

  const saved = savedIds.has(recipeId);
  const instructionSteps = (recipe?.instructions ?? "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

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
          <Image source={{ uri: recipe.image_url ?? DEFAULT_IMAGE }} style={styles.hero} />
          <Pressable style={[styles.headerBtn, { left: Spacing.lg }]} onPress={() => router.back()}>
            <Text style={styles.headerBtnText}>‹</Text>
          </Pressable>
          <Pressable
            style={[styles.headerBtn, { right: Spacing.lg }]}
            onPress={() => toggleSave(recipeId)}
          >
            <Text style={[styles.headerBtnText, saved && { color: Neon.pink }]}>
              {saved ? "★" : "☆"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          {/* Title + meta */}
          <Text style={styles.title}>{recipe.title}</Text>
          {recipe.author?.display_name && (
            <Text style={styles.authorName}>by {recipe.author.display_name}</Text>
          )}
          {recipe.meal_type && (
            <View style={styles.mealTypeBadge}>
              <Text style={styles.mealTypeText}>{recipe.meal_type}</Text>
            </View>
          )}

          {/* Calorie hero */}
          <View style={styles.calorieHero}>
            <Text style={styles.calorieNumber}>{recipe.calories}</Text>
            <Text style={styles.calorieLabel}>calories</Text>
          </View>

          {/* Macro rings */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Macronutrients</Text>
            <View style={styles.macroRingsRow}>
              <MacroRing value={recipe.protein} goal={150} color={MacroColors.protein} label="Protein" />
              <MacroRing value={recipe.carbs} goal={200} color={MacroColors.carbs} label="Carbs" />
              <MacroRing value={recipe.fat} goal={65} color={MacroColors.fat} label="Fat" />
              {recipe.fiber_g != null && recipe.fiber_g > 0 && (
                <MacroRing value={recipe.fiber_g} goal={28} color={MacroColors.fiber} label="Fiber" />
              )}
            </View>
            <Text style={styles.servings}>Per serving · {recipe.servings} serving{recipe.servings !== 1 ? "s" : ""}</Text>
          </View>

          {/* Description */}
          {recipe.description && (
            <View style={styles.card}>
              <Text style={styles.descText}>{recipe.description}</Text>
            </View>
          )}

          {/* Ingredients */}
          {ingredients.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Ingredients</Text>
              {ingredients.map((ing, i) => (
                <View key={i} style={styles.ingredientRow}>
                  <View style={styles.ingredientDot} />
                  <Text style={styles.ingredientText}>
                    <Text style={styles.ingredientAmount}>
                      {ing.amount != null ? `${ing.amount} ${ing.unit ?? ""} ` : ""}
                    </Text>
                    {ing.name}
                  </Text>
                  <Text style={styles.ingredientCals}>{ing.calories} kcal</Text>
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

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: Neon.purple }]}
              onPress={() => toggleSave(recipeId)}
            >
              <Text style={styles.actionBtnText}>{saved ? "Saved ★" : "Save to Library"}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0f" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.md },
  errorText: { color: "#f8fafc", fontSize: 16 },
  backBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: "#1e1e2a" },
  backBtnText: { color: "#f8fafc", fontWeight: "600" },

  hero: { width: "100%", height: 280, backgroundColor: "#1e1e2a" },
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
  headerBtnText: { color: "#f8fafc", fontSize: 22, fontWeight: "600" },

  body: { padding: Spacing.xl, gap: Spacing.lg },

  title: { fontSize: 24, fontWeight: "700", color: "#f8fafc" },
  authorName: { fontSize: 14, color: "#94a3b8" },
  mealTypeBadge: {
    alignSelf: "flex-start",
    backgroundColor: Neon.purple + "20",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  mealTypeText: { color: Neon.purple, fontSize: 12, fontWeight: "600", textTransform: "capitalize" },

  calorieHero: { alignItems: "center", paddingVertical: Spacing.lg },
  calorieNumber: { fontSize: 48, fontWeight: "800", color: "#f8fafc", fontVariant: ["tabular-nums"] },
  calorieLabel: { fontSize: 14, color: "#94a3b8", marginTop: -4 },

  card: {
    backgroundColor: "#16161e",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Neon.pink + "25",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#f8fafc" },

  macroRingsRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: Spacing.sm },
  servings: { fontSize: 12, color: "#64748b", textAlign: "center" },

  descText: { fontSize: 14, color: "#94a3b8", lineHeight: 20 },

  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e2a",
    gap: Spacing.sm,
  },
  ingredientDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Neon.purple },
  ingredientText: { flex: 1, fontSize: 14, color: "#f8fafc" },
  ingredientAmount: { fontWeight: "600" },
  ingredientCals: { fontSize: 12, color: "#64748b", fontVariant: ["tabular-nums"] },

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
  stepText: { flex: 1, fontSize: 14, color: "#e2e8f0", lineHeight: 20 },

  actionsRow: { gap: Spacing.md, paddingBottom: 40 },
  actionBtn: {
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: "center",
  },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
