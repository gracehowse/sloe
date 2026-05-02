import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

import { Accent, Radius, Spacing } from "@/constants/theme";
import {
  buildFullNutrientPanelRows,
  FULL_NUTRIENT_PANEL_ROW_COUNT,
  type FullNutrientPanelInput,
  type FullNutrientPanelRow,
  type FullNutrientPanelSection,
} from "../../../../src/lib/nutrition/fullNutrientPanel";
import { DAILY_VALUES_SOURCE_LABEL } from "../../../../src/lib/nutrition/dailyValues";

/**
 * FullNutrientPanelSheet — "View all 35 nutrients" bottom sheet.
 *
 * Closes the Cronometer power-user persona gap from the customer-lens
 * audit (2026-05-01). The 4-tile widget answers the headline question
 * ("am I on track for fibre / iron / vit D / sodium today?"). This
 * sheet answers the breadth question ("what about the other 31 things
 * Cronometer shows me?").
 *
 * Layout per section:
 *   Section header  ("Macros" / "Vitamins" / "Minerals")
 *   Row | Row | ... — each row: name (left) · amount (mid) · bar
 *                                · %DV % (right)
 *
 * Sort: %DV descending within each section. Deficiencies bubble to the
 * top so the user can act on the actual gap.
 *
 * Limit nutrients (sodium / sat fat / cholesterol) ramp:
 *   < 80%  success
 *   80-99% warning
 *   100%+  destructive
 *
 * Target nutrients stay success regardless of overshoot — going over
 * fibre / iron / vit D is not a warning.
 *
 * Footer: source attribution `DAILY_VALUES_SOURCE_LABEL` so the
 * derivation is auditable from the surface itself.
 *
 * Web parity: `src/app/components/suppr/full-nutrient-panel-sheet.tsx`.
 */

export type FullNutrientPanelSheetColors = {
  background: string;
  card: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
};

export interface FullNutrientPanelSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Day-summed micros — `sumMicrosFromLoggedMeals(meals)` directly. */
  microSum: Record<string, number> | null | undefined;
  /** Day-totalled fibre in grams. */
  fiberG: number;
  /** Day-totalled total fat in grams. */
  totalFatG?: number;
  /** Day-totalled saturated fat in grams. */
  saturatedFatG?: number;
  /** Day-totalled carbs in grams. */
  totalCarbsG?: number;
  /** Day-totalled protein in grams. */
  proteinG?: number;
  /** Day-totalled total sugars in grams. */
  sugarG?: number;
  /** Day-totalled cholesterol in mg. */
  cholesterolMg?: number;
  colors: FullNutrientPanelSheetColors;
}

/** Pick the bar colour for a row using the limit-vs-target ramp. */
function rowColor(row: FullNutrientPanelRow): string {
  if (row.percentDv === null) return Accent.successLight;
  if (!row.isLimit) return Accent.success;
  if (row.percentDv >= 100) return Accent.destructive;
  if (row.percentDv >= 80) return Accent.warning;
  return Accent.success;
}

function PanelRow({
  row,
  colors,
}: {
  row: FullNutrientPanelRow;
  colors: FullNutrientPanelSheetColors;
}) {
  const color = rowColor(row);
  const barWidthPct = Math.min(100, Math.max(0, row.percentDv ?? 0));
  return (
    <View
      testID={`full-panel-row-${row.key}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        gap: Spacing.sm,
      }}
    >
      <Text
        style={{
          flex: 1.6,
          fontSize: 13,
          fontWeight: "600",
          color: colors.text,
        }}
        numberOfLines={1}
      >
        {row.label}
      </Text>
      <Text
        style={{
          flex: 1.0,
          fontSize: 12,
          color: colors.textSecondary,
          fontVariant: ["tabular-nums"],
          textAlign: "right",
        }}
        numberOfLines={1}
      >
        {row.amountFormatted}
      </Text>
      <View
        style={{
          flex: 1.4,
          height: 6,
          borderRadius: 999,
          backgroundColor: `${color}24`,
          overflow: "hidden",
        }}
        accessibilityValue={{ now: row.percentDv ?? 0, min: 0, max: 100 }}
        testID={`full-panel-bar-${row.key}`}
      >
        <View
          style={{
            width: `${barWidthPct}%`,
            height: "100%",
            borderRadius: 999,
            backgroundColor: color,
          }}
          testID={`full-panel-bar-fill-${row.key}`}
        />
      </View>
      <Text
        style={{
          width: 44,
          fontSize: 12,
          fontWeight: "600",
          color: row.percentDv === null ? colors.textTertiary : colors.text,
          fontVariant: ["tabular-nums"],
          textAlign: "right",
        }}
      >
        {row.percentDv === null ? "—" : `${row.percentDv}%`}
      </Text>
    </View>
  );
}

function SectionBlock({
  section,
  rows,
  colors,
}: {
  section: FullNutrientPanelSection;
  rows: FullNutrientPanelRow[];
  colors: FullNutrientPanelSheetColors;
}) {
  return (
    <View testID={`full-panel-section-${section}`} style={{ marginBottom: Spacing.lg }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: colors.textTertiary,
          letterSpacing: 1.1,
          textTransform: "uppercase",
          marginBottom: Spacing.xs,
        }}
      >
        {section}
      </Text>
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.cardBorder,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.xs,
        }}
      >
        {rows.map((row, idx) => (
          <View
            key={row.key}
            style={
              idx > 0
                ? {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.cardBorder,
                  }
                : undefined
            }
          >
            <PanelRow row={row} colors={colors} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function FullNutrientPanelSheet({
  visible,
  onClose,
  microSum,
  fiberG,
  totalFatG,
  saturatedFatG,
  totalCarbsG,
  proteinG,
  sugarG,
  cholesterolMg,
  colors,
}: FullNutrientPanelSheetProps) {
  const insets = useSafeAreaInsets();
  const sections = React.useMemo<
    Array<{ section: FullNutrientPanelSection; rows: FullNutrientPanelRow[] }>
  >(() => {
    const input: FullNutrientPanelInput = {
      microSum: microSum ?? {},
      fiberG,
      totalFatG,
      saturatedFatG,
      totalCarbsG,
      proteinG,
      sugarG,
      cholesterolMg,
    };
    return buildFullNutrientPanelRows(input);
  }, [microSum, fiberG, totalFatG, saturatedFatG, totalCarbsG, proteinG, sugarG, cholesterolMg]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityLabel="Close all nutrients"
        />
        <View
          testID="full-nutrient-panel-sheet"
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            paddingTop: 12,
            paddingBottom: insets.bottom + 16,
            maxHeight: "88%",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 16,
              marginBottom: 8,
            }}
          >
            <View>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text }}>
                All nutrients
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginTop: 2,
                }}
              >
                {FULL_NUTRIENT_PANEL_ROW_COUNT} nutrients · sorted by %DV
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={24} color={colors.textSecondary} strokeWidth={2.25} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: 12,
            }}
          >
            {sections.map(({ section, rows }) => (
              <SectionBlock
                key={section}
                section={section}
                rows={rows}
                colors={colors}
              />
            ))}
            <Text
              testID="full-panel-source-label"
              style={{
                fontSize: 11,
                color: colors.textTertiary,
                textAlign: "center",
                marginTop: Spacing.xs,
              }}
            >
              {DAILY_VALUES_SOURCE_LABEL}
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default FullNutrientPanelSheet;
