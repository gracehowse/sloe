/**
 * Save-meal bottom sheet (Batch 2.6; renamed copy Ship M1) — mobile
 * mirror of the web `SaveMealDialog`. Collects a name + optional
 * default slot + items for a saved ("usual") meal. Does no I/O itself —
 * `onSave` hands the payload back to the caller, which runs it through
 * the shared `createSavedMeal` helper.
 *
 * The items list is reorderable (up / down arrows) and removable to
 * match the web dialog. Reorder / remove happens in local state only
 * until the user taps "Save".
 *
 * Accessibility:
 *  - Name `TextInput` has `accessibilityLabel` "Usual meal name"
 *  - Each item row carries an `accessibilityLabel` that includes the
 *    title + macro summary
 *  - Up/down/remove buttons have per-item accessibility labels
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
import { X } from "lucide-react-native";

import { Accent, IconSize, Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { formatMacro } from "@suppr/shared/nutrition/formatMacro";
import type { SavedMealItem } from "@suppr/shared/nutrition/savedMeals";
import { formatMacroTrailer } from "@suppr/shared/nutrition/macroFormat";

type Theme = {
  text: string;
  textSecondary: string;
  textTertiary: string;
  card: string;
  cardBorder: string;
  background: string;
};

const MEAL_SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;
type MealSlot = (typeof MEAL_SLOTS)[number];

type SavePayload = {
  name: string;
  defaultMealSlot?: MealSlot;
  items: Omit<SavedMealItem, "id" | "position">[];
};

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Items the user is bundling into a combo, in preserved order. */
  initialItems: Omit<SavedMealItem, "id" | "position">[];
  defaultSlot?: MealSlot;
  suggestedName?: string;
  onSave: (payload: SavePayload) => Promise<void>;
  colors: Theme;
};

export default function SaveMealSheet({
  visible,
  onClose,
  initialItems,
  defaultSlot,
  suggestedName,
  onSave,
  colors,
}: Props) {
  const [name, setName] = useState("");
  const [slot, setSlot] = useState<MealSlot | "">("");
  const [items, setItems] = useState<typeof initialItems>([]);
  const [saving, setSaving] = useState(false);
  const accent = useAccent();

  // Reset local state when the sheet opens so a cancelled edit doesn't
  // leak into a fresh session.
  useEffect(() => {
    if (visible) {
      setName(suggestedName ?? "");
      setSlot(defaultSlot ?? "");
      setItems(initialItems);
      setSaving(false);
    }
  }, [visible, suggestedName, defaultSlot, initialItems]);

  const canSave = useMemo(
    () => name.trim().length > 0 && items.length >= 1 && !saving,
    [name, items.length, saving],
  );

  const moveItem = (from: number, direction: -1 | 1) => {
    setItems((prev) => {
      const to = from + direction;
      if (to < 0 || to >= prev.length) return prev;
      const next = prev.slice();
      const [row] = next.splice(from, 1);
      if (row) next.splice(to, 0, row);
      return next;
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        ...(slot ? { defaultMealSlot: slot as MealSlot } : {}),
        items,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

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
          style={{ flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: Radius.lg,
              borderTopRightRadius: Radius.lg,
              padding: Spacing.lg,
              paddingBottom: Spacing.xl,
              maxHeight: "85%",
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
            {/* Header row: title + X close (audit 2026-04-30 modal-dismiss
                sweep — keyboard-up on iOS can hide the backdrop strip). */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: Spacing.sm,
              }}
            >
              <Text style={{ flex: 1, fontSize: 18, fontWeight: "700", color: colors.text }}>
                Save as a usual meal
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={12}
              >
                <X size={IconSize.hero} color={colors.textSecondary} strokeWidth={2.25} />
              </Pressable>
            </View>
            <Text
              style={{
                fontSize: 13,
                color: colors.textSecondary,
                marginBottom: Spacing.md,
                marginTop: 2,
              }}
            >
              One tap re-logs all of these items next time.
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
                placeholder={
                  defaultSlot ? `My usual ${defaultSlot.toLowerCase()}` : "My usual breakfast"
                }
                placeholderTextColor={colors.textTertiary}
                maxLength={80}
                accessibilityLabel="Usual meal name"
                style={{
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  borderRadius: Radius.md,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.text,
                  fontSize: 14,
                  backgroundColor: colors.background,
                  marginBottom: Spacing.md,
                }}
                autoFocus
                returnKeyType="done"
              />

              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.text,
                  marginBottom: 6,
                }}
              >
                Default slot (optional)
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: Spacing.md,
                }}
                accessibilityRole="radiogroup"
                accessibilityLabel="Default meal slot"
              >
                {(["", ...MEAL_SLOTS] as const).map((s) => {
                  const isActive = slot === s;
                  const label = s === "" ? "No default" : s;
                  return (
                    <Pressable
                      key={label}
                      onPress={() => setSlot(s as MealSlot | "")}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={label}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: isActive ? accent.primary : colors.cardBorder,
                        backgroundColor: isActive ? accent.primary + "18" : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color: isActive ? accent.primary : colors.textSecondary,
                        }}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.text,
                  marginBottom: 6,
                }}
              >
                Items ({items.length})
              </Text>
              {items.length === 0 && (
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textSecondary,
                    paddingVertical: 12,
                  }}
                  accessibilityLiveRegion="polite"
                >
                  No items left. Cancel and pick more items to save.
                </Text>
              )}
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  borderRadius: Radius.md,
                  overflow: "hidden",
                  marginBottom: Spacing.md,
                }}
              >
                {items.map((it, i) => {
                  const title = it.recipeTitle?.trim() || "Untitled";
                  const macroSummary = `${Math.round(it.calories)} kcal, protein ${formatMacro(
                    it.protein,
                    "protein",
                  )} grams, carbs ${formatMacro(it.carbs, "carbs")} grams, fat ${formatMacro(it.fat, "fat")} grams`;
                  return (
                    <View
                      key={`${title}-${i}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderBottomWidth: i === items.length - 1 ? 0 : 1,
                        borderBottomColor: colors.cardBorder,
                        backgroundColor: colors.background,
                      }}
                      accessibilityLabel={`${title}, ${macroSummary}`}
                    >
                      <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                        <Text
                          numberOfLines={1}
                          style={{ fontSize: 13, fontWeight: "600", color: colors.text }}
                        >
                          {title}
                        </Text>
                        <Text
                          style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}
                        >
                          {formatMacroTrailer({
                            calories: it.calories,
                            protein: it.protein,
                            carbs: it.carbs,
                            fat: it.fat,
                          })}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => moveItem(i, -1)}
                        disabled={i === 0}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Move ${title} up`}
                        accessibilityState={{ disabled: i === 0 }}
                        style={{ padding: 4, opacity: i === 0 ? 0.35 : 1 }}
                      >
                        <Ionicons name="chevron-up" size={18} color={colors.textSecondary} />
                      </Pressable>
                      <Pressable
                        onPress={() => moveItem(i, 1)}
                        disabled={i === items.length - 1}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Move ${title} down`}
                        accessibilityState={{ disabled: i === items.length - 1 }}
                        style={{
                          padding: 4,
                          opacity: i === items.length - 1 ? 0.35 : 1,
                        }}
                      >
                        <Ionicons
                          name="chevron-down"
                          size={18}
                          color={colors.textSecondary}
                        />
                      </Pressable>
                      <Pressable
                        onPress={() => removeItem(i)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${title} from usual meal`}
                        style={{ padding: 4 }}
                      >
                        <Ionicons name="close" size={18} color={Accent.destructive} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm }}>
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
                  backgroundColor: canSave ? accent.primary : colors.cardBorder,
                }}
                accessibilityRole="button"
                accessibilityLabel="Save usual meal"
                accessibilityState={{ disabled: !canSave }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>
                  {saving ? "Saving…" : "Save"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
