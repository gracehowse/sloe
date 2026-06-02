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
 * Intended call-site gate: `design_system_elevation` — flag ON → this sheet;
 * flag OFF → the original `Alert.alert` info popup stays alive. No web analog
 * is needed — web already shows ingredient detail inline on `RecipeDetail`.
 *
 * NOTE — wiring handoff: the recipe-detail screen (`app/recipe/[id].tsx`) is
 * being actively rewritten by the ENG-818/819 detail-card lane, so this sheet
 * is delivered ready-to-wire rather than wired here (strict file lanes — the
 * edit sheet + ingredient editor are this lane; the detail screen is not). The
 * host wires it with: a `useState<IngredientInfo | null>` slot, set on
 * ingredient tap when `isFeatureEnabled('design_system_elevation')`, with the
 * existing `Alert.alert` kept in the `else`, and `<IngredientInfoSheet
 * info={ingredientInfo} onClose={() => setIngredientInfo(null)} />` mounted
 * once below the ingredient list. See ENG-821.
 */
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { X } from "lucide-react-native";

import { Elevation, IconSize, MacroColors, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

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
}: {
  info: IngredientInfo | null;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const open = info != null;

  const macroSummary = info
    ? ([
        { key: "calories", label: "kcal", color: MacroColors.calories, value: Math.round(info.calories) },
        { key: "protein", label: "P", color: MacroColors.protein, value: Math.round(info.protein) },
        { key: "carbs", label: "C", color: MacroColors.carbs, value: Math.round(info.carbs) },
        { key: "fat", label: "F", color: MacroColors.fat, value: Math.round(info.fat) },
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 8, marginBottom: 6 },
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
});

export default IngredientInfoSheet;
