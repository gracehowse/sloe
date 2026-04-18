/**
 * CreateCustomFoodSheet (Batch 3.9) — mobile mirror of the web
 * `CreateCustomFoodDialog`. Collects name + optional brand + macros
 * per gram basis + repeatable named servings, with a live preview.
 *
 * Does no I/O; hands the payload back via `onSave` so the caller
 * can run it through the shared `createCustomFood` / `updateCustomFood`
 * helpers. Shares all pure logic (scaling, dedupe, normalisation) with
 * web via `src/lib/nutrition/customFoods.ts` so platforms can't drift.
 *
 * Accessibility:
 *  - Inputs carry `accessibilityLabel`s.
 *  - Macro inputs use `keyboardType="decimal-pad"`.
 *  - Add / remove serving-row buttons have per-row labels.
 */
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Accent, Radius, Spacing } from "@/constants/theme";
import {
  CUSTOM_FOOD_NAME_MAX,
  dedupeServings,
  normaliseCustomFoodName,
  scaleMacrosForGrams,
  type CustomFood,
  type CustomFoodServing,
} from "../../../src/lib/nutrition/customFoods";

type Theme = {
  text: string;
  textSecondary: string;
  textTertiary: string;
  card: string;
  cardBorder: string;
  background: string;
};

export type CreateCustomFoodPayload = {
  name: string;
  brand?: string;
  baseGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  servings: CustomFoodServing[];
};

type Props = {
  visible: boolean;
  onClose: () => void;
  /** When present, opens in edit mode and prefills all fields. */
  initialFood?: CustomFood;
  /** Suggested name prefill (e.g. what the user typed in search). */
  initialName?: string;
  onSave: (payload: CreateCustomFoodPayload) => void | Promise<void>;
  colors: Theme;
};

type ServingDraft = { id: string; label: string; gramsText: string };

let servingDraftCounter = 0;
function nextServingDraftId(): string {
  servingDraftCounter += 1;
  return `sd_${servingDraftCounter}`;
}

function toNumber(text: string): number {
  const t = String(text ?? "").trim();
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(n: number | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : String(n);
}

export default function CreateCustomFoodSheet({
  visible,
  onClose,
  initialFood,
  initialName,
  onSave,
  colors,
}: Props) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [baseGramsText, setBaseGramsText] = useState("100");
  const [caloriesText, setCaloriesText] = useState("");
  const [proteinText, setProteinText] = useState("");
  const [carbsText, setCarbsText] = useState("");
  const [fatText, setFatText] = useState("");
  const [fiberText, setFiberText] = useState("");
  const [servings, setServings] = useState<ServingDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (initialFood) {
      setName(initialFood.name);
      setBrand(initialFood.brand ?? "");
      setBaseGramsText(formatNumber(initialFood.baseGrams) || "100");
      setCaloriesText(formatNumber(initialFood.calories));
      setProteinText(formatNumber(initialFood.protein));
      setCarbsText(formatNumber(initialFood.carbs));
      setFatText(formatNumber(initialFood.fat));
      setFiberText(initialFood.fiber != null ? formatNumber(initialFood.fiber) : "");
      setServings(
        (initialFood.servings ?? []).map((s) => ({
          id: nextServingDraftId(),
          label: s.label,
          gramsText: formatNumber(s.grams),
        })),
      );
    } else {
      setName(initialName ?? "");
      setBrand("");
      setBaseGramsText("100");
      setCaloriesText("");
      setProteinText("");
      setCarbsText("");
      setFatText("");
      setFiberText("");
      setServings([{ id: nextServingDraftId(), label: "", gramsText: "" }]);
    }
    setSaving(false);
  }, [visible, initialFood, initialName]);

  const macros = useMemo(
    () => ({
      baseGrams: toNumber(baseGramsText),
      calories: toNumber(caloriesText),
      protein: toNumber(proteinText),
      carbs: toNumber(carbsText),
      fat: toNumber(fatText),
      fiber: fiberText.trim() ? toNumber(fiberText) : undefined,
    }),
    [baseGramsText, caloriesText, proteinText, carbsText, fatText, fiberText],
  );

  const cleanedServings = useMemo(
    () =>
      dedupeServings(
        servings.map((s) => ({ label: s.label, grams: toNumber(s.gramsText) })),
      ),
    [servings],
  );

  const trimmedName = normaliseCustomFoodName(name);
  const hasValidBase = macros.baseGrams > 0;
  const allMacrosZero =
    macros.calories === 0 &&
    macros.protein === 0 &&
    macros.carbs === 0 &&
    macros.fat === 0 &&
    (macros.fiber == null || macros.fiber === 0);

  const canSave = trimmedName.length > 0 && hasValidBase && !saving;

  const previewServing = cleanedServings[0];
  const previewGrams = previewServing ? previewServing.grams : macros.baseGrams;
  const previewScaled = useMemo(
    () => scaleMacrosForGrams(macros, previewGrams),
    [macros, previewGrams],
  );

  const handleAddServing = () => {
    setServings((prev) => [
      ...prev,
      { id: nextServingDraftId(), label: "", gramsText: "" },
    ]);
  };
  const handleRemoveServing = (id: string) => {
    setServings((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload: CreateCustomFoodPayload = {
        name: trimmedName,
        baseGrams: macros.baseGrams,
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        servings: cleanedServings,
      };
      const brandTrimmed = brand.trim();
      if (brandTrimmed) payload.brand = brandTrimmed;
      if (macros.fiber != null && fiberText.trim()) payload.fiber = macros.fiber;
      await onSave(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const isEditing = Boolean(initialFood);
  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    backgroundColor: colors.background,
  } as const;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Pressable
          onPress={onClose}
          style={{
            flex: 1,
            backgroundColor: "#00000066",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: Radius.lg,
              borderTopRightRadius: Radius.lg,
              padding: Spacing.lg,
              paddingBottom: Spacing.xl,
              maxHeight: "90%",
            }}
          >
            <View style={{ alignItems: "center", marginBottom: Spacing.sm }}>
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.cardBorder,
                }}
              />
            </View>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
              {isEditing ? "Edit custom food" : "Create custom food"}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.textSecondary,
                marginBottom: Spacing.md,
                marginTop: 2,
              }}
            >
              For foods that aren&apos;t in the database — e.g. homemade or local-bakery items.
            </Text>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.text,
                  marginBottom: 6,
                }}
              >
                Name
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Homemade granola"
                placeholderTextColor={colors.textTertiary}
                maxLength={CUSTOM_FOOD_NAME_MAX}
                accessibilityLabel="Custom food name"
                style={[inputStyle, { marginBottom: Spacing.md }]}
                autoFocus
                returnKeyType="next"
              />

              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.text,
                  marginBottom: 6,
                }}
              >
                Brand (optional)
              </Text>
              <TextInput
                value={brand}
                onChangeText={setBrand}
                placeholder="e.g. My recipe, Local bakery"
                placeholderTextColor={colors.textTertiary}
                maxLength={80}
                accessibilityLabel="Brand"
                style={[inputStyle, { marginBottom: Spacing.md }]}
                returnKeyType="next"
              />

              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.text,
                  marginBottom: 6,
                }}
              >
                Macros per
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: Spacing.sm,
                }}
              >
                <TextInput
                  value={baseGramsText}
                  onChangeText={setBaseGramsText}
                  keyboardType="decimal-pad"
                  accessibilityLabel="Base grams"
                  style={[inputStyle, { width: 90 }]}
                />
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>grams</Text>
              </View>
              {!hasValidBase && (
                <Text
                  style={{
                    fontSize: 11,
                    color: Accent.destructive,
                    marginBottom: 8,
                  }}
                  accessibilityLiveRegion="polite"
                >
                  Base grams must be greater than zero.
                </Text>
              )}

              <View
                style={{ flexDirection: "row", gap: 8, marginBottom: Spacing.sm }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}
                  >
                    Calories (kcal)
                  </Text>
                  <TextInput
                    value={caloriesText}
                    onChangeText={setCaloriesText}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Calories"
                    style={inputStyle}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}
                  >
                    Protein (g)
                  </Text>
                  <TextInput
                    value={proteinText}
                    onChangeText={setProteinText}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Protein grams"
                    style={inputStyle}
                  />
                </View>
              </View>
              <View
                style={{ flexDirection: "row", gap: 8, marginBottom: Spacing.sm }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}
                  >
                    Carbs (g)
                  </Text>
                  <TextInput
                    value={carbsText}
                    onChangeText={setCarbsText}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Carbs grams"
                    style={inputStyle}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}
                  >
                    Fat (g)
                  </Text>
                  <TextInput
                    value={fatText}
                    onChangeText={setFatText}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Fat grams"
                    style={inputStyle}
                  />
                </View>
              </View>
              <Text
                style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}
              >
                Fibre (g, optional)
              </Text>
              <TextInput
                value={fiberText}
                onChangeText={setFiberText}
                keyboardType="decimal-pad"
                accessibilityLabel="Fibre grams, optional"
                style={[inputStyle, { marginBottom: Spacing.md }]}
              />

              {allMacrosZero && (
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textSecondary,
                    marginBottom: Spacing.sm,
                  }}
                  accessibilityLiveRegion="polite"
                >
                  Macros not set. You can fill these in later.
                </Text>
              )}

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <Text
                  style={{ fontSize: 12, fontWeight: "600", color: colors.text }}
                >
                  Serving sizes
                </Text>
                <Pressable
                  onPress={handleAddServing}
                  accessibilityRole="button"
                  accessibilityLabel="Add serving size"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="add" size={14} color={colors.text} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: colors.text,
                      marginLeft: 4,
                    }}
                  >
                    Add
                  </Text>
                </Pressable>
              </View>
              {servings.length === 0 && (
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textSecondary,
                    paddingVertical: 8,
                  }}
                >
                  No saved servings. You can still log this food in grams.
                </Text>
              )}
              {servings.map((row, i) => {
                const labelForAria = row.label.trim() || `serving ${i + 1}`;
                return (
                  <View
                    key={row.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 6,
                    }}
                  >
                    <TextInput
                      value={row.label}
                      onChangeText={(text) =>
                        setServings((prev) =>
                          prev.map((s) => (s.id === row.id ? { ...s, label: text } : s)),
                        )
                      }
                      placeholder="e.g. 1 bowl"
                      placeholderTextColor={colors.textTertiary}
                      maxLength={40}
                      accessibilityLabel={`Serving ${i + 1} label`}
                      style={[inputStyle, { flex: 1 }]}
                    />
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>=</Text>
                    <TextInput
                      value={row.gramsText}
                      onChangeText={(text) =>
                        setServings((prev) =>
                          prev.map((s) =>
                            s.id === row.id ? { ...s, gramsText: text } : s,
                          ),
                        )
                      }
                      keyboardType="decimal-pad"
                      placeholder="grams"
                      placeholderTextColor={colors.textTertiary}
                      accessibilityLabel={`Serving ${i + 1} grams`}
                      style={[inputStyle, { width: 78 }]}
                    />
                    <Pressable
                      onPress={() => handleRemoveServing(row.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${labelForAria}`}
                      hitSlop={8}
                      style={{ padding: 4 }}
                    >
                      <Ionicons
                        name="close"
                        size={18}
                        color={Accent.destructive}
                      />
                    </Pressable>
                  </View>
                );
              })}

              <View
                style={{
                  marginTop: Spacing.sm,
                  padding: 10,
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  backgroundColor: colors.background,
                }}
                accessibilityLiveRegion="polite"
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    letterSpacing: 0.5,
                    color: colors.textSecondary,
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Preview
                </Text>
                <Text style={{ fontSize: 12, color: colors.text }}>
                  {previewServing
                    ? `${previewServing.label} (${previewServing.grams}g): ${previewScaled.calories} kcal · P ${previewScaled.protein} · C ${previewScaled.carbs} · F ${previewScaled.fat}`
                    : hasValidBase
                      ? `${macros.baseGrams}g: ${previewScaled.calories} kcal · P ${previewScaled.protein} · C ${previewScaled.carbs} · F ${previewScaled.fat}`
                      : "Add macros above to see preview."}
                  {previewScaled.fiber != null ? ` · Fi ${previewScaled.fiber}` : ""}
                </Text>
              </View>
            </ScrollView>

            <View
              style={{
                flexDirection: "row",
                gap: Spacing.sm,
                marginTop: Spacing.md,
              }}
            >
              <Pressable
                onPress={onClose}
                disabled={saving}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  borderRadius: Radius.md,
                  opacity: saving ? 0.6 : 1,
                }}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!canSave}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  alignItems: "center",
                  borderRadius: Radius.md,
                  backgroundColor: canSave ? Accent.primary : colors.cardBorder,
                  opacity: canSave ? 1 : 0.6,
                }}
                accessibilityRole="button"
                accessibilityLabel={isEditing ? "Save changes" : "Save food"}
                accessibilityState={{ disabled: !canSave }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: canSave ? "#fff" : colors.textSecondary,
                  }}
                >
                  {saving ? "Saving…" : isEditing ? "Save changes" : "Save food"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
