import React, { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

import {
  buildPickerOptions,
  evaluatePortionScalePlausibility,
  portionPlausibilityWarning,
  type MacrosPer100gPanel,
  type PortionState,
  type PortionUnit,
  type ProductInput,
  type QuickChip,
  roundAmount,
  stateToGrams,
  stepperStep,
  switchUnit,
  unitLabel,
} from "@suppr/shared/nutrition/portionPicker";

/**
 * PortionPicker — Lose It! / MFP-style amount + unit selector. Replaces
 * the legacy `logBasis: "per100g" | "perServing"` toggle.
 *
 * Owns: stepper, unit popover, quick-chip row. Does NOT own: macro
 * tiles, meal-row, or the "Log" CTA — those stay with the host so the
 * picker is reusable across barcode / custom-food / search-result flows.
 *
 * See `docs/decisions/2026-05-13-portion-picker-and-macro-display.md`
 * and `src/lib/nutrition/portionPicker.ts` for the shared state math.
 */
export interface PortionPickerProps {
  product: ProductInput;
  value: PortionState;
  onChange: (next: PortionState) => void;
  /** Pre-resolved options so parent + picker share one derivation. If
   *  omitted the picker derives its own from `product`. */
  options?: ReturnType<typeof buildPickerOptions>;
  /** Initial gram weight to surface as a remembered preference. */
  rememberedGrams?: number | null;
  /** Hide the quick-chip row (e.g. on cramped sheets). */
  hideQuickChips?: boolean;
  /** When set, scale + run post-scale plausibility and surface a warning. */
  macrosPer100g?: MacrosPer100gPanel | null;
  /** OFF reconcile flagged per-serving values masquerading as per-100 g. */
  basisCorrected?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PortionPicker(props: PortionPickerProps) {
  const { product, value, onChange, hideQuickChips = false, macrosPer100g, basisCorrected = false, style } = props;
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the unit-picker
  // trigger pill and the active quick-portion chips. The basis-corrected note
  // keeps `Accent.warning` (amber status).
  const accent = useAccent();
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);

  const opts =
    props.options ?? buildPickerOptions(product, { rememberedGrams: props.rememberedGrams ?? null });
  const grams = stateToGrams(value);
  const step = stepperStep(value.unit);
  const scaleCheck =
    macrosPer100g != null
      ? evaluatePortionScalePlausibility(macrosPer100g, value, { basisCorrected })
      : null;
  const showPlausibilityWarning = scaleCheck != null && !scaleCheck.plausible && scaleCheck.grams > 0;

  const bump = (delta: number) => {
    const nextAmount = Math.max(0, value.amount + delta);
    onChange({ ...value, amount: nextAmount });
  };

  const onSelectUnit = (next: PortionUnit) => {
    setUnitPickerOpen(false);
    onChange(switchUnit(value, next));
  };

  const onTapChip = (chip: QuickChip) => {
    onChange(chip.state);
  };

  return (
    <View style={style}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm }}>
        <Text
          style={{
            fontSize: 10,
            fontWeight: "700",
            letterSpacing: 0.5,
            textTransform: "uppercase",
            color: colors.textTertiary,
          }}
        >
          Amount
        </Text>
        <Text
          style={{
            fontSize: 11,
            color: colors.textTertiary,
            fontVariant: ["tabular-nums"],
          }}
        >
          ≈ {Math.round(grams).toLocaleString()} g
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.card,
          borderRadius: Radius.md,
          padding: 5,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          gap: 4,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decrease amount"
          onPress={() => bump(-step)}
          style={{
            width: 38,
            height: 38,
            borderRadius: Radius.sm,
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
          }}
          hitSlop={6}
        >
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.text, lineHeight: 22 }}>−</Text>
        </Pressable>

        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 4 }}>
          <Text
            accessibilityLabel={`Amount: ${roundAmount(value.amount, value.unit)} ${unitLabel(value)}`}
            style={{
              fontSize: 22,
              fontWeight: "800",
              letterSpacing: -0.6,
              color: colors.text,
              fontVariant: ["tabular-nums"],
              lineHeight: 24,
            }}
          >
            {roundAmount(value.amount, value.unit)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change unit"
            onPress={() => setUnitPickerOpen(true)}
            hitSlop={6}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: `${accent.primary}1a`, // ~10% tint
              borderRadius: Radius.full,
              paddingHorizontal: 10,
              paddingVertical: 3,
            }}
          >
            <Text style={{ fontSize: 11.5, fontWeight: "700", color: accent.primary, letterSpacing: 0.1 }}>
              {unitLabel(value)}
            </Text>
            <Text style={{ fontSize: 10, color: accent.primary, opacity: 0.7, transform: [{ rotate: "90deg" }] }}>›</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase amount"
          onPress={() => bump(step)}
          style={{
            width: 38,
            height: 38,
            borderRadius: Radius.sm,
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
          }}
          hitSlop={6}
        >
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.text, lineHeight: 22 }}>+</Text>
        </Pressable>
      </View>

      {!hideQuickChips && opts.quickChips.length > 0 && (
        <View style={{ marginTop: Spacing.md }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              letterSpacing: 0.5,
              textTransform: "uppercase",
              color: colors.textTertiary,
              marginBottom: Spacing.sm,
            }}
          >
            Quick
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingRight: 16 }}
          >
            {opts.quickChips.map((chip, i) => {
              const isActive =
                Math.abs(stateToGrams(chip.state) - grams) < 0.5 &&
                chip.state.unit.kind === value.unit.kind &&
                (chip.state.unit.kind !== "count" ||
                  (value.unit.kind === "count" && chip.state.unit.singular === value.unit.singular));
              return (
                <Pressable
                  key={`${chip.label}-${i}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Set portion to ${chip.label}`}
                  accessibilityState={{ selected: isActive }}
                  onPress={() => onTapChip(chip)}
                  style={{
                    borderWidth: 1,
                    borderColor: isActive ? `${accent.primary}33` : colors.border,
                    backgroundColor: isActive ? `${accent.primary}1a` : colors.card,
                    borderRadius: Radius.full,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: "600",
                      color: isActive ? accent.primary : colors.text,
                    }}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {showPlausibilityWarning && scaleCheck ? (
        <View
          accessibilityRole="alert"
          style={{
            marginTop: Spacing.md,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: `${Accent.warning}55`,
            backgroundColor: `${Accent.warning}14`,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
          }}
        >
          <Text style={{ fontSize: 12.5, lineHeight: 18, color: colors.text }}>
            {portionPlausibilityWarning(scaleCheck.scaled, scaleCheck.grams)}
          </Text>
        </View>
      ) : null}

      <UnitPickerModal
        visible={unitPickerOpen}
        units={opts.units}
        current={value.unit}
        onDismiss={() => setUnitPickerOpen(false)}
        onSelect={onSelectUnit}
      />
    </View>
  );
}

function UnitPickerModal(props: {
  visible: boolean;
  units: PortionUnit[];
  current: PortionUnit;
  onDismiss: () => void;
  onSelect: (u: PortionUnit) => void;
}) {
  const { visible, units, current, onDismiss, onSelect } = props;
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the active unit row.
  const accent = useAccent();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable
        style={{ flex: 1, backgroundColor: MODAL_OVERLAY_SCRIM, justifyContent: "center", alignItems: "center" }}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss unit picker"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            width: 260,
            backgroundColor: colors.card,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            padding: 6,
          }}
        >
          {units.map((u, i) => {
            const isActive = unitsEqual(u, current);
            return (
              <Pressable
                key={`${u.kind}-${i}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`Use ${unitLabelFor(u)}`}
                onPress={() => onSelect(u)}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderRadius: Radius.sm,
                  backgroundColor: isActive ? `${accent.primary}1a` : "transparent",
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: isActive ? "700" : "500", color: isActive ? accent.primary : colors.text }}>
                  {unitLabelFor(u)}
                </Text>
                <Text style={{ fontSize: 11.5, color: isActive ? accent.primary : colors.textTertiary, fontVariant: ["tabular-nums"] }}>
                  {unitMeta(u)}
                </Text>
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function unitsEqual(a: PortionUnit, b: PortionUnit): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "count" && b.kind === "count") return a.singular === b.singular;
  return true;
}

function unitLabelFor(u: PortionUnit): string {
  switch (u.kind) {
    case "count":
      return u.singular;
    case "serving":
      return "serving";
    case "gram":
      return "gram";
    case "ounce":
      return "ounce";
  }
}

function unitMeta(u: PortionUnit): string {
  switch (u.kind) {
    case "count":
      return `${Math.round(u.gramsPerUnit)} g`;
    case "serving":
      return `${Math.round(u.gramsPerServing)} g`;
    case "gram":
      return "precise";
    case "ounce":
      return "28 g";
  }
}
