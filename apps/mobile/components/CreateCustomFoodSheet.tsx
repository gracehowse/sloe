/**
 * CreateCustomFoodSheet — mobile mirror of the web
 * `CreateCustomFoodDialog`. Collects the fields needed to match
 * MyFitnessPal / LoseIt's "add food" form:
 *   - Name + optional brand (always).
 *   - A single natural serving (label + grams) + optional servings per
 *     container — surfaced prominently above the macros so users reason
 *     about the label, not grams (TestFlight `AE52_fIRZ-ZIupmoJ8T4yaI`).
 *   - Macros per 100 g (MFP / USDA convention) with a live "per serving"
 *     preview computed from the per-100 g macros × serving grams.
 *   - A collapsed "Add detailed nutrition" disclosure with sugar / sat
 *     fat / sodium — hidden by default so the primary form stays short.
 *   - An optional barcode text input (no scanner — scanner is a
 *     follow-up piece of work that needs `expo-camera` permissions).
 *
 * Does no I/O; hands the payload back via `onSave` so the caller
 * can run it through the shared `createCustomFood` / `updateCustomFood`
 * helpers. Shares all pure logic (scaling, dedupe, normalisation,
 * barcode validation) with web via `src/lib/nutrition/customFoods.ts`
 * so platforms can't drift.
 *
 * Validation rules encoded in `canSave`:
 *  - `name` non-empty after normalisation.
 *  - `baseGrams > 0`.
 *  - Serving label and grams are both empty, or both set (grams > 0).
 *  - Barcode, if provided, validates to 8 / 12 / 13 / 14 digits.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import KeyboardSafeView from "./KeyboardSafeView";
import { Accent, Radius, Spacing } from "@/constants/theme";
import {
  CUSTOM_FOOD_NAME_MAX,
  customFoodToMacrosPer100g,
  normaliseCustomFoodName,
  validateCustomFoodBarcode,
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
  servingsPerContainer?: number;
  sugarG?: number;
  saturatedFatG?: number;
  sodiumMg?: number;
  barcode?: string;
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
  const [servingLabel, setServingLabel] = useState("");
  const [servingGramsText, setServingGramsText] = useState("");
  const [servingsPerContainerText, setServingsPerContainerText] = useState("");
  const [baseGramsText, setBaseGramsText] = useState("100");
  const [caloriesText, setCaloriesText] = useState("");
  const [proteinText, setProteinText] = useState("");
  const [carbsText, setCarbsText] = useState("");
  const [fatText, setFatText] = useState("");
  const [fiberText, setFiberText] = useState("");
  const [sugarText, setSugarText] = useState("");
  const [satFatText, setSatFatText] = useState("");
  const [sodiumText, setSodiumText] = useState("");
  const [barcode, setBarcode] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (initialFood) {
      setName(initialFood.name);
      setBrand(initialFood.brand ?? "");
      // Natural serving lives as the first `servings[]` entry.
      const first = (initialFood.servings ?? []).find(
        (s) => s.label.trim() !== "" && s.grams > 0,
      );
      setServingLabel(first?.label ?? "");
      setServingGramsText(first ? formatNumber(first.grams) : "");
      setServingsPerContainerText(
        initialFood.servingsPerContainer != null
          ? formatNumber(initialFood.servingsPerContainer)
          : "",
      );
      setBaseGramsText(formatNumber(initialFood.baseGrams) || "100");
      setCaloriesText(formatNumber(initialFood.calories));
      setProteinText(formatNumber(initialFood.protein));
      setCarbsText(formatNumber(initialFood.carbs));
      setFatText(formatNumber(initialFood.fat));
      setFiberText(initialFood.fiber != null ? formatNumber(initialFood.fiber) : "");
      setSugarText(initialFood.sugarG != null ? formatNumber(initialFood.sugarG) : "");
      setSatFatText(
        initialFood.saturatedFatG != null ? formatNumber(initialFood.saturatedFatG) : "",
      );
      setSodiumText(initialFood.sodiumMg != null ? formatNumber(initialFood.sodiumMg) : "");
      setBarcode(initialFood.barcode ?? "");
      // Open the disclosure if the food already has any detailed micros
      // or a barcode — so users editing an existing food see their data.
      setDetailsOpen(
        initialFood.sugarG != null ||
          initialFood.saturatedFatG != null ||
          initialFood.sodiumMg != null ||
          Boolean(initialFood.barcode),
      );
    } else {
      setName(initialName ?? "");
      setBrand("");
      setServingLabel("");
      setServingGramsText("");
      setServingsPerContainerText("");
      setBaseGramsText("100");
      setCaloriesText("");
      setProteinText("");
      setCarbsText("");
      setFatText("");
      setFiberText("");
      setSugarText("");
      setSatFatText("");
      setSodiumText("");
      setBarcode("");
      setDetailsOpen(false);
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
      sugarG: sugarText.trim() ? toNumber(sugarText) : undefined,
      sodiumMg: sodiumText.trim() ? toNumber(sodiumText) : undefined,
    }),
    [baseGramsText, caloriesText, proteinText, carbsText, fatText, fiberText, sugarText, sodiumText],
  );

  const servingGrams = toNumber(servingGramsText);
  const servingLabelClean = servingLabel.trim();
  const hasServingLabel = servingLabelClean.length > 0;
  const hasServingGrams = servingGrams > 0;
  // Both fields are "required together or both empty". Disallow half-
  // filled combos (label without grams, grams without label).
  const servingValid =
    (!hasServingLabel && !hasServingGrams) ||
    (hasServingLabel && hasServingGrams);

  const barcodeParsed = useMemo(() => validateCustomFoodBarcode(barcode), [barcode]);
  const barcodeValid = barcodeParsed.ok;

  const trimmedName = normaliseCustomFoodName(name);
  const hasValidBase = macros.baseGrams > 0;
  const allMacrosZero =
    macros.calories === 0 &&
    macros.protein === 0 &&
    macros.carbs === 0 &&
    macros.fat === 0 &&
    (macros.fiber == null || macros.fiber === 0);

  const canSave =
    trimmedName.length > 0 &&
    hasValidBase &&
    servingValid &&
    barcodeValid &&
    !saving;

  // Live preview: scale the food's macros to the natural serving, if the
  // user has set one; else to `baseGrams`. Uses `customFoodToMacrosPer100g`
  // so the math agrees with the per-100g path search + log uses.
  const previewGrams = hasServingLabel && hasServingGrams ? servingGrams : macros.baseGrams;
  const previewScaled = useMemo(() => {
    if (!(previewGrams > 0) || !hasValidBase) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }
    const per100g = customFoodToMacrosPer100g(macros);
    const f = previewGrams / 100;
    return {
      calories: Math.round(per100g.calories * f),
      protein: Math.round(per100g.protein * f * 10) / 10,
      carbs: Math.round(per100g.carbs * f * 10) / 10,
      fat: Math.round(per100g.fat * f * 10) / 10,
    };
  }, [macros, previewGrams, hasValidBase]);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const servings: CustomFoodServing[] =
        hasServingLabel && hasServingGrams
          ? [{ label: servingLabelClean, grams: servingGrams }]
          : [];
      const payload: CreateCustomFoodPayload = {
        name: trimmedName,
        baseGrams: macros.baseGrams,
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        servings,
      };
      const brandTrimmed = brand.trim();
      if (brandTrimmed) payload.brand = brandTrimmed;
      if (macros.fiber != null && fiberText.trim()) payload.fiber = macros.fiber;
      const spc = toNumber(servingsPerContainerText);
      if (servingsPerContainerText.trim() && spc > 0) payload.servingsPerContainer = spc;
      if (sugarText.trim()) payload.sugarG = toNumber(sugarText);
      if (satFatText.trim()) payload.saturatedFatG = toNumber(satFatText);
      if (sodiumText.trim()) payload.sodiumMg = toNumber(sodiumText);
      if (barcodeParsed.ok && barcodeParsed.value) payload.barcode = barcodeParsed.value;
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
      <KeyboardSafeView
        scroll={false}
        dismissOnBackgroundTap={false}
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

              {/* Natural serving row — prominent, above the macro grid. */}
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.text,
                  marginBottom: 6,
                }}
              >
                Serving size (optional)
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <TextInput
                  value={servingLabel}
                  onChangeText={setServingLabel}
                  placeholder="e.g. 1 slice"
                  placeholderTextColor={colors.textTertiary}
                  maxLength={40}
                  accessibilityLabel="Serving size label"
                  style={[inputStyle, { flex: 1 }]}
                  returnKeyType="next"
                />
                <TextInput
                  value={servingGramsText}
                  onChangeText={setServingGramsText}
                  keyboardType="decimal-pad"
                  placeholder="grams"
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel="Serving size grams"
                  style={[inputStyle, { width: 90 }]}
                />
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: Spacing.sm,
                }}
              >
                <TextInput
                  value={servingsPerContainerText}
                  onChangeText={setServingsPerContainerText}
                  keyboardType="decimal-pad"
                  placeholder=""
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel="Servings per container"
                  style={[inputStyle, { width: 70 }]}
                />
                <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }}>
                  servings per container (optional)
                </Text>
              </View>
              {!servingValid && (
                <Text
                  style={{
                    fontSize: 11,
                    color: Accent.destructive,
                    marginBottom: 6,
                  }}
                  accessibilityLiveRegion="polite"
                >
                  Enter both a serving size label and grams, or leave both blank.
                </Text>
              )}

              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.text,
                  marginBottom: 6,
                  marginTop: 4,
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
                style={[inputStyle, { marginBottom: 4 }]}
              />

              {/* Live "per-serving ≈" preview — below the macro grid so the
                  user sees instant feedback that the label adds up. */}
              <View
                style={{
                  marginTop: 4,
                  padding: 10,
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  backgroundColor: colors.background,
                  marginBottom: Spacing.md,
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
                  Per-serving preview
                </Text>
                <Text style={{ fontSize: 12, color: colors.text }}>
                  {hasServingLabel && hasServingGrams && hasValidBase
                    ? `${servingLabelClean} (${servingGrams} g) ≈ ${previewScaled.calories} kcal · P ${previewScaled.protein} · C ${previewScaled.carbs} · F ${previewScaled.fat}`
                    : hasValidBase
                      ? `${macros.baseGrams} g: ${previewScaled.calories} kcal · P ${previewScaled.protein} · C ${previewScaled.carbs} · F ${previewScaled.fat}`
                      : "Add macros above to see preview."}
                </Text>
              </View>

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

              {/* Disclosure: detailed nutrition (sugar / sat fat / sodium) +
                  barcode. Hidden by default to keep the form short. */}
              <Pressable
                onPress={() => setDetailsOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: detailsOpen }}
                accessibilityLabel={
                  detailsOpen ? "Hide detailed nutrition" : "Add detailed nutrition"
                }
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  marginBottom: detailsOpen ? Spacing.sm : 4,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>
                  {detailsOpen ? "Hide detailed nutrition" : "Add detailed nutrition"}
                </Text>
                <Ionicons
                  name={detailsOpen ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.textSecondary}
                />
              </Pressable>

              {detailsOpen && (
                <View>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 8,
                      marginBottom: Spacing.sm,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}
                      >
                        Sugar (g)
                      </Text>
                      <TextInput
                        value={sugarText}
                        onChangeText={setSugarText}
                        keyboardType="decimal-pad"
                        accessibilityLabel="Sugar grams, optional"
                        style={inputStyle}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}
                      >
                        Sat fat (g)
                      </Text>
                      <TextInput
                        value={satFatText}
                        onChangeText={setSatFatText}
                        keyboardType="decimal-pad"
                        accessibilityLabel="Saturated fat grams, optional"
                        style={inputStyle}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}
                      >
                        Sodium (mg)
                      </Text>
                      <TextInput
                        value={sodiumText}
                        onChangeText={setSodiumText}
                        keyboardType="decimal-pad"
                        accessibilityLabel="Sodium milligrams, optional"
                        style={inputStyle}
                      />
                    </View>
                  </View>

                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.textSecondary,
                      marginBottom: 4,
                    }}
                  >
                    Barcode (optional)
                  </Text>
                  <TextInput
                    value={barcode}
                    onChangeText={setBarcode}
                    keyboardType="number-pad"
                    placeholder="e.g. 5012345678900"
                    placeholderTextColor={colors.textTertiary}
                    maxLength={14}
                    accessibilityLabel="Barcode, optional"
                    style={inputStyle}
                  />
                  {!barcodeValid && (
                    <Text
                      style={{
                        fontSize: 11,
                        color: Accent.destructive,
                        marginTop: 4,
                      }}
                      accessibilityLiveRegion="polite"
                    >
                      Enter a valid 8, 12, 13, or 14-digit barcode, or leave blank.
                    </Text>
                  )}
                </View>
              )}
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
      </KeyboardSafeView>
    </Modal>
  );
}
