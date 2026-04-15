import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeBack } from "@/hooks/use-safe-back";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { decode } from "base64-arraybuffer";

let ImagePicker: typeof import("expo-image-picker") | null = null;
try {
  ImagePicker = require("expo-image-picker") as typeof import("expo-image-picker");
} catch {
  // Native module not available (Expo Go) — image picker will be disabled
}

import { Accent, MacroColors, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import FoodSearchModal from "@/components/FoodSearchModal";
import MealTypePicker from "@/components/MealTypePicker";

type Ingredient = {
  id: string;
  name: string;
  amount: string;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  source: string;
};

let _nextId = 0;
function newIngId() { return `ing_${Date.now()}_${_nextId++}`; }

export default function CreateRecipeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const goBackOrCancel = useSafeBack("/(tabs)/more");
  const colors = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState("1");
  const [instructions, setInstructions] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [saving, setSaving] = useState(false);
  const [mealTags, setMealTags] = useState<string[]>([]);
  const [publish, setPublish] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);

  const totals = useMemo(() => {
    return ingredients.reduce(
      (acc, i) => ({
        calories: acc.calories + i.calories,
        protein: acc.protein + i.protein,
        carbs: acc.carbs + i.carbs,
        fat: acc.fat + i.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
  }, [ingredients]);

  const srv = parseInt(servings) || 1;
  const perServing = {
    calories: Math.round(totals.calories / srv),
    protein: Math.round(totals.protein / srv),
    carbs: Math.round(totals.carbs / srv),
    fat: Math.round(totals.fat / srv),
  };

  const onFoodSelected = useCallback((result: any) => {
    const grams = result.chosenPortion.gramWeight * result.quantity;
    const f = grams / 100;
    const newIng: Ingredient = {
      id: newIngId(),
      name: result.name,
      amount: String(result.quantity),
      unit: result.chosenPortion.label,
      calories: Math.round(result.macrosPer100g.calories * f),
      protein: Math.round(result.macrosPer100g.protein * f * 10) / 10,
      carbs: Math.round(result.macrosPer100g.carbs * f * 10) / 10,
      fat: Math.round(result.macrosPer100g.fat * f * 10) / 10,
      fiberG: Math.round((result.macrosPer100g.fiberG ?? 0) * f * 10) / 10,
      source: result.source,
    };
    setIngredients((prev) => [...prev, newIng]);
    setSearchOpen(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const removeIngredient = useCallback((id: string) => {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const pickImage = useCallback(async () => {
    if (!ImagePicker) {
      Alert.alert("Image picker unavailable", "Image upload requires a development build. It is not supported in Expo Go.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }, []);

  async function uploadImage(recipeId: string): Promise<string | null> {
    if (!imageUri) return null;
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const ext = imageUri.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `recipes/${recipeId}.${ext}`;
      const { error } = await supabase.storage
        .from("recipe-images")
        .upload(path, decode(base64), { contentType: `image/${ext}`, upsert: true });
      if (error) return null;

      const { data } = supabase.storage.from("recipe-images").getPublicUrl(path);
      return data.publicUrl;
    } catch {
      return null;
    }
  }

  const onSave = useCallback(async () => {
    if (!userId) { Alert.alert("Sign in", "You need to be signed in to create a recipe."); return; }
    if (!title.trim()) { Alert.alert("Missing title", "Give your recipe a name."); return; }
    if (ingredients.length === 0) { Alert.alert("No ingredients", "Add at least one ingredient."); return; }

    setSaving(true);
    try {
      const { data: row, error: insErr } = await supabase
        .from("recipes")
        .insert({
          author_id: userId,
          title: title.trim(),
          description: description.trim() || null,
          instructions: instructions.trim() || null,
          servings: srv,
          published: publish,
          meal_type: mealTags.length > 0 ? mealTags : null,
          calories: perServing.calories,
          protein: perServing.protein,
          carbs: perServing.carbs,
          fat: perServing.fat,
        })
        .select("id")
        .single();

      if (insErr || !row) {
        Alert.alert("Error", insErr?.message ?? "Could not save recipe.");
        setSaving(false);
        return;
      }

      const recipeId = (row as { id: string }).id;

      const imgUrl = await uploadImage(recipeId);
      if (imgUrl) {
        await supabase.from("recipes").update({ image_url: imgUrl }).eq("id", recipeId);
      }

      const ingRows = ingredients.map((ing) => ({
        recipe_id: recipeId,
        name: ing.name,
        amount: parseFloat(ing.amount) || null,
        unit: ing.unit || null,
        calories: Math.round(ing.calories),
        protein: Math.round(ing.protein),
        carbs: Math.round(ing.carbs),
        fat: Math.round(ing.fat),
        fiber_g: ing.fiberG,
        is_verified: true,
        source: ing.source,
      }));

      await supabase.from("recipe_ingredients").insert(ingRows);
      await supabase.from("saves").insert({ user_id: userId, recipe_id: recipeId });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/recipe/${recipeId}`);
    } catch {
      Alert.alert("Error", "Something went wrong.");
    }
    setSaving(false);
  }, [userId, title, description, instructions, srv, ingredients, perServing, mealTags, publish, imageUri, router]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topBar: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    backText: { color: colors.text, fontSize: 17, fontWeight: "600" },
    topTitle: { color: Accent.primary, fontSize: 13, fontWeight: "800", letterSpacing: 3 },
    scroll: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: 120 },
    label: { fontSize: 12, fontWeight: "700", color: colors.textTertiary, letterSpacing: 1, textTransform: "uppercase" as const },
    input: {
      backgroundColor: colors.card, borderRadius: Radius.md,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: Spacing.lg, paddingVertical: 14,
      color: colors.text, fontSize: 16,
    },
    multilineInput: { minHeight: 100, textAlignVertical: "top" as const },
    row: { flexDirection: "row", alignItems: "center", gap: Spacing.md },

    // Ingredients
    ingCard: {
      backgroundColor: colors.card, borderRadius: Radius.md,
      borderWidth: 1, borderColor: colors.border,
      padding: Spacing.md, flexDirection: "row", alignItems: "center",
    },
    ingName: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.text },
    ingDetail: { fontSize: 12, color: colors.textSecondary },
    ingCals: { fontSize: 14, fontWeight: "700", color: colors.text, marginRight: Spacing.sm },
    removeBtn: { padding: 4 },

    addBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: Spacing.sm, paddingVertical: 14, borderRadius: Radius.md,
      borderWidth: 1.5, borderColor: Accent.primary + "50", borderStyle: "dashed" as const,
    },
    addBtnText: { color: Accent.primary, fontWeight: "600", fontSize: 14 },

    // Totals
    totalsCard: {
      backgroundColor: colors.card, borderRadius: Radius.lg,
      borderWidth: 1, borderColor: Accent.primary + "30",
      padding: Spacing.lg,
    },
    totalsRow: { flexDirection: "row", justifyContent: "space-around" },
    totalItem: { alignItems: "center", gap: 2 },
    totalValue: { fontSize: 18, fontWeight: "800", fontVariant: ["tabular-nums"] as any },
    totalKey: { fontSize: 10, color: colors.textTertiary, fontWeight: "600" },

    // Footer
    footer: {
      position: "absolute", bottom: 0, left: 0, right: 0,
      backgroundColor: colors.background + "f0",
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
      paddingHorizontal: Spacing.xl, paddingTop: Spacing.md,
    },
    saveBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: Spacing.sm, backgroundColor: Accent.success,
      borderRadius: Radius.md, paddingVertical: 16,
    },
    saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

    imagePicker: { alignItems: "center" },
    imagePreview: { width: "100%", height: 200, borderRadius: Radius.lg },
    imagePlaceholder: {
      width: "100%", height: 160, borderRadius: Radius.lg,
      borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed" as const,
      justifyContent: "center", alignItems: "center",
      backgroundColor: colors.card,
    },
    publishRow: {
      flexDirection: "row", alignItems: "center", gap: Spacing.md,
      backgroundColor: colors.card, borderRadius: Radius.md,
      padding: Spacing.lg, borderWidth: 1, borderColor: colors.border,
    },
  }), [colors]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.topBar}>
        <Pressable onPress={goBackOrCancel} hitSlop={12}>
          <Text style={styles.backText}>Cancel</Text>
        </Pressable>
        <Text style={styles.topTitle}>CREATE</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Image */}
        <Pressable onPress={() => void pickImage()} style={styles.imagePicker}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="camera-outline" size={28} color={colors.textTertiary} />
              <Text style={[styles.label, { marginTop: Spacing.xs }]}>Add photo</Text>
            </View>
          )}
        </Pressable>

        {/* Title */}
        <View style={{ gap: Spacing.sm }}>
          <Text style={styles.label}>Recipe name</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Chicken stir-fry" placeholderTextColor={colors.textTertiary} />
        </View>

        {/* Description */}
        <View style={{ gap: Spacing.sm }}>
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="A short description of your recipe"
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        {/* Servings */}
        <View style={{ gap: Spacing.sm }}>
          <Text style={styles.label}>Servings</Text>
          <TextInput style={[styles.input, { width: 80 }]} value={servings} onChangeText={setServings} keyboardType="number-pad" placeholder="1" placeholderTextColor={colors.textTertiary} />
        </View>

        {/* Meal type */}
        <MealTypePicker selected={mealTags} onChange={setMealTags} label="MEAL TYPE" />

        {/* Ingredients */}
        <View style={{ gap: Spacing.sm }}>
          <Text style={styles.label}>Ingredients</Text>
          {ingredients.map((ing) => (
            <View key={ing.id} style={styles.ingCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ingName}>{ing.name}</Text>
                <Text style={styles.ingDetail}>{ing.amount} {ing.unit} · {ing.calories} kcal</Text>
              </View>
              <Text style={styles.ingCals}>{ing.calories}</Text>
              <Pressable style={styles.removeBtn} onPress={() => removeIngredient(ing.id)}>
                <Ionicons name="close-circle" size={22} color={Accent.destructive + "80"} />
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.addBtn} onPress={() => setSearchOpen(true)}>
            <Ionicons name="add" size={18} color={Accent.primary} />
            <Text style={styles.addBtnText}>Add ingredient</Text>
          </Pressable>
        </View>

        {/* Totals */}
        {ingredients.length > 0 && (
          <View style={styles.totalsCard}>
            <Text style={[styles.label, { marginBottom: Spacing.sm }]}>Per serving ({srv} serving{srv !== 1 ? "s" : ""})</Text>
            <View style={styles.totalsRow}>
              <View style={styles.totalItem}>
                <Text style={styles.totalValue}>{perServing.calories}</Text>
                <Text style={styles.totalKey}>kcal</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={[styles.totalValue, { color: MacroColors.protein }]}>{perServing.protein}g</Text>
                <Text style={styles.totalKey}>protein</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={[styles.totalValue, { color: MacroColors.carbs }]}>{perServing.carbs}g</Text>
                <Text style={styles.totalKey}>carbs</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={[styles.totalValue, { color: MacroColors.fat }]}>{perServing.fat}g</Text>
                <Text style={styles.totalKey}>fat</Text>
              </View>
            </View>
          </View>
        )}

        {/* Instructions */}
        <View style={{ gap: Spacing.sm }}>
          <Text style={styles.label}>Instructions (optional)</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={instructions}
            onChangeText={setInstructions}
            placeholder="Step 1: ...\nStep 2: ..."
            placeholderTextColor={colors.textTertiary}
            multiline
          />
        </View>

        {/* Publish toggle */}
        <View style={styles.publishRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { marginBottom: 2 }]}>Publish to community</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              Others can discover and save your recipe
            </Text>
          </View>
          <Switch
            value={publish}
            onValueChange={setPublish}
            trackColor={{ false: colors.border, true: Accent.success + "80" }}
            thumbColor={publish ? Accent.success : colors.textTertiary}
          />
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Pressable
          style={[styles.saveBtn, (saving || !title.trim()) && { opacity: 0.5 }]}
          onPress={() => void onSave()}
          disabled={saving || !title.trim()}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>Save Recipe</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Food search modal */}
      <FoodSearchModal
        visible={searchOpen}
        initialQuery=""
        onSelect={onFoodSelected}
        onClose={() => setSearchOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}
