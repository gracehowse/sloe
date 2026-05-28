/**
 * RecipeEditSheet — full recipe editor for the owner (ENG-759, mobile).
 *
 * Surfaces metadata fields (title / description / servings / meal-type
 * chips / prep+cook time / instructions) AND ingredient CRUD (edit name,
 * amount, unit inline; add a manual row; delete a row). After any
 * ingredient change OR a servings change, per-serving aggregates are
 * recomputed via the shared `recomputeRecipeAggregate` helper — the same
 * maths the yield-edit path uses — so the two paths can never drift.
 *
 * The sheet owns its own DB writes (metadata → `recipes`; ingredient
 * CRUD → `recipe_ingredients`; aggregate → `recipes`) so the 3,214-line
 * `[id].tsx` screen file stays thin. On success it calls `onSave` with
 * the updated metadata + recomputed aggregate so the parent can update
 * local state and show a toast.
 *
 * Web parity: `src/app/components/suppr/recipe-edit-dialog.tsx` (metadata
 * only — web already has inline ingredient editing in RecipeDetail.tsx).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Minus, Plus, PlusCircle, X } from "lucide-react-native";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";
import {
  RECIPE_MEAL_TYPES,
  type RecipeMealType,
  buildManualIngredientInsert,
  buildRecipeMetadataUpdate,
  canEditRecipe,
  clampRecipeServings,
  isMetadataDraftValid,
  recomputeRecipeAggregate,
  toggleMealType,
} from "@suppr/shared/recipes/recipeEdit";
import IngredientEditRow, {
  type EditableIngredient,
} from "./IngredientEditRow";

export type EditableRecipe = {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  servings: number;
  prep_time_min: number | null;
  cook_time_min: number | null;
  meal_type: string[] | null;
  author_id: string | null;
};

export type RecipeEditSavePayload = {
  title: string;
  description: string | null;
  servings: number;
  meal_type: string[] | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  instructions: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
};

let _localKey = 0;
const nextLocalKey = () => `ing_${Date.now()}_${_localKey++}`;

type DbIngredientRow = {
  id: string;
  name: string;
  amount: number | null;
  unit: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  added_by_user?: boolean | null;
};

export default function RecipeEditSheet({
  recipe,
  userId,
  onSave,
  onClose,
}: {
  recipe: EditableRecipe;
  userId: string | null;
  onSave: (updated: RecipeEditSavePayload) => Promise<void>;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isOwner = canEditRecipe(recipe.author_id, userId);

  const [title, setTitle] = useState(recipe.title ?? "");
  const [description, setDescription] = useState(recipe.description ?? "");
  const [servings, setServings] = useState<number>(clampRecipeServings(recipe.servings ?? 1));
  const [mealType, setMealType] = useState<string[]>(recipe.meal_type ?? []);
  const [prepTime, setPrepTime] = useState<string>(recipe.prep_time_min ? String(recipe.prep_time_min) : "");
  const [cookTime, setCookTime] = useState<string>(recipe.cook_time_min ? String(recipe.cook_time_min) : "");
  const [instructions, setInstructions] = useState(recipe.instructions ?? "");

  const [ingredients, setIngredients] = useState<EditableIngredient[]>([]);
  /** rowIds of ingredients deleted in this session — removed from DB on save. */
  const [deletedRowIds, setDeletedRowIds] = useState<string[]>([]);
  /** Macro-bearing snapshot keyed by rowId, for aggregate recompute. */
  const [macroByRowId, setMacroByRowId] = useState<Record<string, DbIngredientRow>>({});
  const [loadingIngredients, setLoadingIngredients] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load ingredient rows (with ids + macros) so the CRUD path can
  // recompute aggregates honestly from real per-row macros.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingIngredients(true);
      const { data, error } = await supabase
        .from("recipe_ingredients")
        .select("id, name, amount, unit, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, added_by_user")
        .eq("recipe_id", recipe.id)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (!error && data) {
        const rows = data as DbIngredientRow[];
        setIngredients(
          rows.map((r) => ({
            rowId: r.id,
            localKey: r.id,
            name: r.name ?? "",
            amount: r.amount != null ? String(r.amount) : "",
            unit: r.unit ?? "",
            addedByUser: Boolean(r.added_by_user),
          })),
        );
        const map: Record<string, DbIngredientRow> = {};
        for (const r of rows) map[r.id] = r;
        setMacroByRowId(map);
      }
      setLoadingIngredients(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [recipe.id]);

  const updateIngredient = useCallback((localKey: string, patch: Partial<EditableIngredient>) => {
    setIngredients((prev) => prev.map((i) => (i.localKey === localKey ? { ...i, ...patch } : i)));
  }, []);

  const deleteIngredient = useCallback((ing: EditableIngredient) => {
    if (ing.rowId) setDeletedRowIds((prev) => [...prev, ing.rowId!]);
    setIngredients((prev) => prev.filter((i) => i.localKey !== ing.localKey));
  }, []);

  const addIngredient = useCallback(() => {
    setIngredients((prev) => [
      ...prev,
      { rowId: null, localKey: nextLocalKey(), name: "", amount: "", unit: "", addedByUser: true },
    ]);
  }, []);

  const stepServings = useCallback((delta: number) => {
    setServings((s) => clampRecipeServings(s + delta));
  }, []);

  const onMealTypeChip = useCallback((value: RecipeMealType) => {
    setMealType((prev) => toggleMealType(prev, value));
  }, []);

  const handleSave = useCallback(async () => {
    if (!isOwner || !userId) return;
    if (!isMetadataDraftValid({ title })) {
      Alert.alert("Add a title", "Give your recipe a name before saving.");
      return;
    }
    setSaving(true);
    try {
      const metadata = buildRecipeMetadataUpdate({
        title,
        description,
        servings,
        mealType,
        prepTimeMin: prepTime,
        cookTimeMin: cookTime,
        instructions,
      });

      // 1. Delete removed rows (scoped via recipe_id — RLS enforces ownership).
      if (deletedRowIds.length > 0) {
        const { error } = await supabase
          .from("recipe_ingredients")
          .delete()
          .in("id", deletedRowIds);
        if (error) {
          Alert.alert("Could not delete ingredient", error.message);
          setSaving(false);
          return;
        }
      }

      // 2. Update edited existing rows (name/amount/unit only — macros untouched).
      for (const ing of ingredients) {
        if (!ing.rowId) continue;
        const amount = ing.amount.trim() === "" ? null : parseFloat(ing.amount);
        const { error } = await supabase
          .from("recipe_ingredients")
          .update({
            name: ing.name.trim(),
            amount: Number.isFinite(amount as number) ? amount : null,
            unit: ing.unit.trim() || null,
          })
          .eq("id", ing.rowId);
        if (error) {
          Alert.alert("Could not save ingredient", error.message);
          setSaving(false);
          return;
        }
      }

      // 3. Insert manually added rows (no nutrition — flagged unverified).
      const newRows = ingredients.filter((i) => !i.rowId && i.name.trim().length > 0);
      const insertedRowIds: string[] = [];
      if (newRows.length > 0) {
        const payload = newRows.map((i) =>
          buildManualIngredientInsert({
            recipeId: recipe.id,
            name: i.name,
            amount: i.amount,
            unit: i.unit,
          }),
        );
        const { data, error } = await supabase
          .from("recipe_ingredients")
          .insert(payload)
          .select("id");
        if (error) {
          Alert.alert("Could not add ingredient", error.message);
          setSaving(false);
          return;
        }
        if (data) for (const r of data as { id: string }[]) insertedRowIds.push(r.id);
      }

      // 4. Recompute per-serving aggregate from surviving rows' macros.
      //    New manual rows contribute zero (no nutrition fetched here).
      const survivingMacros = ingredients
        .filter((i) => i.rowId && !deletedRowIds.includes(i.rowId))
        .map((i) => macroByRowId[i.rowId!])
        .filter((m): m is DbIngredientRow => Boolean(m));
      const aggregate = recomputeRecipeAggregate(survivingMacros, metadata.servings);

      // 5. Write metadata + aggregate to the recipe row (scoped to owner).
      const { error: recipeErr } = await supabase
        .from("recipes")
        .update({ ...metadata, ...aggregate })
        .eq("id", recipe.id)
        .eq("author_id", userId);
      if (recipeErr) {
        Alert.alert("Could not save recipe", recipeErr.message);
        setSaving(false);
        return;
      }

      await onSave({ ...metadata, ...aggregate });
      onClose();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }, [
    isOwner,
    userId,
    title,
    description,
    servings,
    mealType,
    prepTime,
    cookTime,
    instructions,
    ingredients,
    deletedRowIds,
    macroByRowId,
    recipe.id,
    onSave,
    onClose,
  ]);

  if (!isOwner) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={() => !saving && onClose()}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Edit recipe</Text>
            <Pressable onPress={() => !saving && onClose()} hitSlop={8} accessibilityLabel="Close editor">
              <X size={22} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Field label="Title">
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Recipe name"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
                accessibilityLabel="Recipe title"
              />
            </Field>

            <Field label="Description">
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="A short description"
                placeholderTextColor={colors.textTertiary}
                multiline
                style={[styles.input, styles.multiline]}
                accessibilityLabel="Recipe description"
              />
            </Field>

            <Field label="Servings">
              <View style={styles.servingsRow}>
                <Pressable
                  style={styles.servingsBtn}
                  onPress={() => stepServings(-1)}
                  accessibilityLabel="Decrease servings"
                >
                  <Minus size={18} color={colors.text} />
                </Pressable>
                <Text style={styles.servingsValue}>{servings}</Text>
                <Pressable
                  style={styles.servingsBtn}
                  onPress={() => stepServings(1)}
                  accessibilityLabel="Increase servings"
                >
                  <Plus size={18} color={colors.text} />
                </Pressable>
              </View>
            </Field>

            <Field label="Meal type">
              <View style={styles.chipRow}>
                {RECIPE_MEAL_TYPES.map((m) => {
                  const active = mealType.includes(m);
                  return (
                    <Pressable
                      key={m}
                      onPress={() => onMealTypeChip(m)}
                      style={[styles.chip, active && styles.chipActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${m}${active ? " selected" : ""}`}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {m[0]!.toUpperCase() + m.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <View style={styles.timeRow}>
              <View style={styles.timeCol}>
                <Field label="Prep (min)">
                  <TextInput
                    value={prepTime}
                    onChangeText={setPrepTime}
                    placeholder="—"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    style={styles.input}
                    accessibilityLabel="Prep time in minutes"
                  />
                </Field>
              </View>
              <View style={styles.timeCol}>
                <Field label="Cook (min)">
                  <TextInput
                    value={cookTime}
                    onChangeText={setCookTime}
                    placeholder="—"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    style={styles.input}
                    accessibilityLabel="Cook time in minutes"
                  />
                </Field>
              </View>
            </View>

            <Field label="Ingredients">
              {loadingIngredients ? (
                <ActivityIndicator color={Accent.primary} />
              ) : (
                <View style={{ gap: Spacing.xs }}>
                  {ingredients.map((ing) => (
                    <IngredientEditRow
                      key={ing.localKey}
                      ingredient={ing}
                      onChange={(patch) => updateIngredient(ing.localKey, patch)}
                      onDelete={() => deleteIngredient(ing)}
                    />
                  ))}
                  <Pressable
                    onPress={addIngredient}
                    style={styles.addBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Add ingredient"
                  >
                    <PlusCircle size={18} color={Accent.primary} />
                    <Text style={styles.addBtnText}>Add ingredient</Text>
                  </Pressable>
                  <Text style={styles.hint}>
                    Manually added ingredients show as unverified — open the recipe and tap Verify to add nutrition.
                  </Text>
                </View>
              )}
            </Field>

            <Field label="Instructions">
              <TextInput
                value={instructions}
                onChangeText={setInstructions}
                placeholder="Step-by-step method"
                placeholderTextColor={colors.textTertiary}
                multiline
                style={[styles.input, styles.instructions]}
                accessibilityLabel="Recipe instructions"
              />
            </Field>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={() => !saving && onClose()}
              style={[styles.footerBtn, styles.cancelBtn]}
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleSave()}
              disabled={saving}
              style={[styles.footerBtn, styles.saveBtn, saving && { opacity: 0.6 }]}
              accessibilityLabel="Save recipe"
            >
              {saving ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  return (
    <View style={{ gap: Spacing.xs }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" },
    sheet: {
      maxHeight: "92%",
      backgroundColor: colors.background,
      borderTopLeftRadius: Radius.lg,
      borderTopRightRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
    scroll: { padding: Spacing.lg, gap: Spacing.lg },
    label: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textTertiary,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      paddingVertical: 11,
      paddingHorizontal: 12,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.inputBg,
    },
    multiline: { minHeight: 72, textAlignVertical: "top" },
    instructions: { minHeight: 140, textAlignVertical: "top" },
    servingsRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
    servingsBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.card,
    },
    servingsValue: {
      minWidth: 48,
      textAlign: "center",
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    chipActive: { backgroundColor: Accent.primarySoft, borderColor: Accent.primary },
    chipText: { fontSize: 14, fontWeight: "600", color: colors.text },
    chipTextActive: { color: Accent.primary },
    timeRow: { flexDirection: "row", gap: Spacing.md },
    timeCol: { flex: 1 },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
      paddingVertical: 12,
      borderRadius: Radius.md,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: Accent.primary + "50",
      marginTop: Spacing.xs,
    },
    addBtnText: { color: Accent.primary, fontWeight: "600", fontSize: 14 },
    hint: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginTop: Spacing.xs },
    footer: {
      flexDirection: "row",
      gap: Spacing.sm,
      padding: Spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    footerBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: Radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    cancelBtn: { borderWidth: 1, borderColor: colors.border },
    cancelText: { fontWeight: "700", color: colors.text, fontSize: 15 },
    saveBtn: { backgroundColor: Accent.primary },
    saveText: { fontWeight: "800", color: colors.primaryForeground, fontSize: 15 },
  });
