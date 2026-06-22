/**
 * IngredientInfoSheet — read-only ingredient detail sheet (ENG-821, mobile).
 *
 * Tapping an ingredient row on recipe detail used to fire a raw
 * `Alert.alert()` system popup — grey, system-font, off-brand, and read by
 * the design-director review as a "different design system" intrusion + a UX
 * gap ("tapping an ingredient shows only an info alert, not what users
 * expect"). This sheet replaces that popup with the same branded bottom-sheet
 * grammar as `SavedMealPortionSheet`: cream `colors.background` surface, drag
 * handle, `Elevation.sheet`, and tokenised type/colour throughout.
 *
 * Read-only by design — the editor lives in `RecipeEditSheet` (owner-only).
 * This sheet shows status, source, and per-line macros for ANY viewer, so the
 * host owns the derivation (tier label/colour, macro maths, explanatory copy)
 * and passes a fully-resolved `info` object. That keeps one derivation path
 * and makes the sheet trivially testable.
 *
 * No web analog is needed — web already shows ingredient detail inline on
 * `RecipeDetail` (a dialog, not a native alert).
 *
 * Wired into the recipe-detail screen (`app/recipe/[id].tsx`) as the canonical
 * ingredient-tap surface (premium-audit 2026-06-09, gap 5) — the host owns a
 * `useState<IngredientInfo | null>` slot set on ingredient tap, replacing the
 * prior off-brand `Alert.alert` popup. The optional `onVerify` callback
 * preserves the wired Verify route for tiers that still need review (the host
 * passes it only when `ingredientShouldShowVerifyCta` + a real recipe id).
 */
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { X } from "lucide-react-native";

import { Elevation, FontFamily, IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { useMacroColors } from "@/lib/macroColors";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { PressableScale } from "@/components/ui/PressableScale";

export interface IngredientInfo {
  /** Already entity-decoded display name. */
  name: string;
  /** Human tier label, e.g. "Verified" / "Partial match" / "Estimated". */
  tierLabel: string;
  /** Tier swatch colour (a token value resolved by the host). */
  tierColor: string;
  /** Original AI confidence percent — shown only when the row is unverified. */
  confidencePct: number | null;
  /** Source label, e.g. "USDA", "FatSecret", "Local estimate". */
  sourceLabel: string;
  /** Per-line macros (already scaled to the recipe's view multiplier). */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Plain-English explanation of where these macros came from. */
  explanation: string;
}

export function IngredientInfoSheet({
  info,
  onClose,
  onVerify,
}: {
  info: IngredientInfo | null;
  onClose: () => void;
  /** When set, render an aubergine-outline "Verify this recipe" CTA. The host
   *  passes it only for tiers that still need review on a real recipe row. */
  onVerify?: () => void;
}) {
  const colors = useThemeColors();
  const accent = useAccent();
  const { colors: macro } = useMacroColors(); // ENG-1223: scheme-resolved macros
  // Aubergine OUTLINE (Sloe treatment §1) — light detects via the white sheet
  // surface, dark uses the lifted aubergine so the border + label clear AA.
  // ENG-1013 (2026-06-10): useAccent() already scheme-resolves primarySolid
  // (#3B2A4D light / #C4ACD0 dark); the old pure-white background probe broke
  // when the light ground moved to cream #FBF8F3. Read the accent directly.
  const outlineColor = accent.primarySolid;
  const open = info != null;

  const macroSummary = info
    ? ([
        { key: "calories", label: "kcal", color: macro.calories, value: Math.round(info.calories) },
        { key: "protein", label: "P", color: macro.protein, value: Math.round(info.protein) },
        { key: "carbs", label: "C", color: macro.carbs, value: Math.round(info.carbs) },
        { key: "fat", label: "F", color: macro.fat, value: Math.round(info.fat) },
      ] as const)
    : [];

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalRoot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel={info ? `${info.name} nutrition detail` : "Ingredient detail"}
          testID="ingredient-info-sheet"
          style={[s.sheet, Elevation.sheet, { backgroundColor: colors.background }]}
        >
          <View style={[s.handle, { backgroundColor: colors.border }]} accessible={false} />

          <View style={[s.header, { borderBottomColor: colors.border }]}>
            <Text style={[Type.headline, { color: colors.text, flex: 1 }]} numberOfLines={2}>
              {info?.name ?? "Ingredient"}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={({ pressed }) => [s.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <X size={IconSize.hero} color={colors.textSecondary} strokeWidth={2.25} />
            </Pressable>
          </View>

          {info ? (
            <ScrollView
              style={s.scroll}
              contentContainerStyle={s.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Status + source */}
              <View style={s.metaRow}>
                <View style={[s.tierDot, { backgroundColor: info.tierColor }]} />
                <Text style={[Type.body, { color: colors.text }]}>
                  {info.tierLabel}
                  {info.confidencePct != null ? ` · ${info.confidencePct}%` : ""}
                </Text>
              </View>
              <Text style={[Type.caption, s.sourceLine, { color: colors.textSecondary }]}>
                Source: {info.sourceLabel}
              </Text>

              {/* Per-line macros — a resting read-out card on the cream surface. */}
              <View style={[s.macroRow, { backgroundColor: colors.inputBg }]}>
                {macroSummary.map((m) => (
                  <View key={m.key} style={s.macroCell}>
                    <View style={s.macroLabelRow}>
                      <View style={[s.macroDot, { backgroundColor: m.color }]} />
                      <Text style={[Type.caption, { color: colors.textTertiary }]}>{m.label}</Text>
                    </View>
                    <Text style={[Type.macroValue, { color: colors.text }]}>{m.value}</Text>
                  </View>
                ))}
              </View>

              <Text style={[Type.bodyMuted, s.explanation, { color: colors.textSecondary }]}>
                {info.explanation}
              </Text>

              {onVerify ? (
                <PressableScale
                  haptic="confirm"
                  onPress={onVerify}
                  accessibilityRole="button"
                  accessibilityLabel="Verify this recipe"
                  testID="ingredient-info-verify"
                  style={[s.verifyBtn, { borderColor: outlineColor }]}
                >
                  <Text style={[s.verifyLabel, { color: outlineColor }]}>
                    Verify this recipe
                  </Text>
                </PressableScale>
              ) : null}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    maxHeight: "80%",
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    overflow: "hidden",
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 8, marginBottom: Spacing.sm },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xl },
  metaRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  tierDot: { width: 10, height: 10, borderRadius: 5 },
  sourceLine: { marginTop: Spacing.xs },
  macroRow: {
    flexDirection: "row",
    marginTop: Spacing.lg,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
  },
  macroCell: { flex: 1, alignItems: "center", gap: Spacing.xs },
  macroLabelRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  macroDot: { width: 8, height: 8, borderRadius: 4 },
  explanation: { marginTop: Spacing.lg, lineHeight: 20 },
  verifyBtn: {
    marginTop: Spacing.lg,
    alignSelf: "flex-start",
    height: 40,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  verifyLabel: { fontFamily: FontFamily.sansSemibold, fontSize: 14, fontWeight: "700" },
});

export default IngredientInfoSheet;
