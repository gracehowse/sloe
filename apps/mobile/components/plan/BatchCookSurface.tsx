import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ChevronRight, Flame, Minus, Plus, ShoppingCart, UtensilsCrossed } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { SupprButton } from "@/components/ui/SupprButton";
import { PushScreenHeader } from "@/components/PushScreenHeader";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  batchPerPortionCalories,
  clampBatchPortions,
  type BatchCookRecipeCandidate,
} from "@suppr/shared/planning/batchCook";

export interface BatchCookSurfaceProps {
  recipes: BatchCookRecipeCandidate[];
  saving?: boolean;
  onBack: () => void;
  onSave: (recipe: BatchCookRecipeCandidate, portions: number) => void | Promise<void>;
  onCook: (recipe: BatchCookRecipeCandidate, portions: number) => void;
}

/**
 * BatchCook minimal v1 (ENG-1255): intro recipe picker → batch size stepper →
 * scaled meta + shopping note + Save / Cook CTAs. Assign-portions planner
 * deferred beyond Grace's 2026-06-28 scope.
 */
export function BatchCookSurface({
  recipes,
  saving = false,
  onBack,
  onSave,
  onCook,
}: BatchCookSurfaceProps) {
  const colors = useThemeColors();
  const [chosen, setChosen] = useState<BatchCookRecipeCandidate | null>(null);
  const [portions, setPortions] = useState(4);

  const perPortionKcal = useMemo(() => {
    if (!chosen) return 0;
    return batchPerPortionCalories(chosen.calories, chosen.servings);
  }, [chosen]);

  if (!chosen) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <PushScreenHeader title="Batch cook" onBack={onBack} />
        <ScrollView contentContainerStyle={styles.pad}>
          <View style={styles.intro}>
            <View style={[styles.introIcon, { backgroundColor: colors.backgroundSecondary }]}>
              <Flame size={26} color={colors.navPrimary} />
            </View>
            <Text style={[styles.introTitle, { color: colors.text }]}>Cook once, eat all week</Text>
            <Text style={[styles.introBody, { color: colors.textSecondary }]}>
              Pick a recipe that keeps well and Sloe scales it into several meals — ingredients and
              shopping list handled.
            </Text>
          </View>
          <Text style={[styles.overline, { color: colors.textTertiary }]}>GOOD FOR BATCHING</Text>
          <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {recipes.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textSecondary }]}>
                Save recipes that make 2+ servings to batch cook.
              </Text>
            ) : (
              recipes.map((r, idx) => (
                <PressableScale
                  key={r.id}
                  onPress={() => {
                    setChosen(r);
                    setPortions(Math.max(4, r.servings));
                  }}
                  haptic="selection"
                  accessibilityRole="button"
                  accessibilityLabel={`${r.title}, ${r.calories} calories, keeps well`}
                  style={[
                    styles.row,
                    idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                  ]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: Accent.primarySoft }]}>
                    <UtensilsCrossed size={16} color={colors.navPrimary} />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
                      {r.title}
                    </Text>
                    <Text style={[styles.rowSub, { color: colors.textTertiary }]}>
                      {batchPerPortionCalories(r.calories, r.servings)} kcal · keeps 4 days
                    </Text>
                  </View>
                  <ChevronRight size={17} color={colors.textTertiary} />
                </PressableScale>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PushScreenHeader title="Batch cook" onBack={() => setChosen(null)} />
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={[styles.hero, { backgroundColor: Accent.primarySoft }]}>
          <Text style={[styles.heroKick, { color: colors.navPrimary }]}>
            Cook once · eat {portions}×
          </Text>
        </View>
        <Text style={[styles.recipeName, { color: colors.text }]}>{chosen.title}</Text>
        <Text style={[styles.recipeSub, { color: colors.textSecondary }]}>
          One pot now, {portions} meals handled. Scales the ingredients and your shopping list
          automatically.
        </Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.stepRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Batch size</Text>
              <Text style={[styles.cardSub, { color: colors.textTertiary }]}>Portions to cook now</Text>
            </View>
            <View style={styles.stepper}>
              <PressableScale
                onPress={() => setPortions((p) => clampBatchPortions(p - 1))}
                haptic="selection"
                accessibilityLabel="Decrease batch size"
                style={[styles.stepBtn, { borderColor: colors.border }]}
              >
                <Minus size={15} color={colors.text} />
              </PressableScale>
              <Text style={[styles.stepVal, { color: colors.text }]}>{portions}</Text>
              <PressableScale
                onPress={() => setPortions((p) => p + 1)}
                haptic="selection"
                accessibilityLabel="Increase batch size"
                style={[styles.stepBtn, { borderColor: colors.border }]}
              >
                <Plus size={15} color={colors.text} />
              </PressableScale>
            </View>
          </View>
          <Text style={[styles.metaLine, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: "700", color: colors.text }}>{perPortionKcal}</Text> kcal each ·{" "}
            <Text style={{ fontWeight: "700", color: colors.text }}>{Math.round(chosen.protein)}</Text>g
            protein ·{" "}
            <Text style={{ fontWeight: "700", color: colors.text }}>{chosen.timeMin}</Text> min once
          </Text>
        </View>

        <View style={[styles.note, { backgroundColor: Accent.primarySoft }]}>
          <ShoppingCart size={15} color={colors.navPrimary} />
          <Text style={[styles.noteText, { color: colors.navPrimary }]}>
            Shopping list scaled to {portions} portions.
          </Text>
        </View>
      </ScrollView>
      <View style={[styles.ctaRow, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
        <SupprButton
          variant="ghost"
          label="Save plan"
          loading={saving}
          onPress={() => void onSave(chosen, portions)}
          style={{ flex: 1 }}
        />
        <SupprButton
          variant="primary"
          label="Cook the batch"
          onPress={() => onCook(chosen, portions)}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  intro: { alignItems: "center", paddingTop: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.sm },
  introIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  introTitle: { ...Type.title, textAlign: "center" },
  introBody: { ...Type.body, textAlign: "center", maxWidth: 320 },
  overline: { ...Type.caption, fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" as const, marginTop: Spacing.sm, marginBottom: Spacing.sm, marginHorizontal: 4 },
  listCard: { borderRadius: Radius.xl, borderWidth: 1, overflow: "hidden" },
  empty: { padding: Spacing.lg, textAlign: "center", ...Type.body },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.dense, padding: Spacing.dense },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: "600" },
  rowSub: { ...Type.caption, marginTop: 2, fontVariant: ["tabular-nums"] },
  hero: { borderRadius: Radius.xl, padding: Spacing.lg, minHeight: 120, justifyContent: "flex-end" },
  heroKick: { ...Type.caption, fontSize: 11, fontWeight: "700", textTransform: "none" as const, letterSpacing: 0.5 },
  recipeName: { ...Type.title, marginTop: Spacing.md },
  recipeSub: { ...Type.body, marginTop: Spacing.sm, marginBottom: Spacing.md },
  card: { borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.lg, gap: Spacing.md },
  stepRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  cardTitle: { fontSize: 14, fontWeight: "600" },
  cardSub: { ...Type.caption, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepVal: { fontFamily: Type.title.fontFamily, fontSize: 17, minWidth: 24, textAlign: "center" },
  metaLine: { ...Type.caption, fontVariant: ["tabular-nums"] },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    padding: Spacing.dense,
    marginTop: Spacing.md,
  },
  noteText: { flex: 1, fontSize: 13, fontWeight: "600" },
  ctaRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

export default BatchCookSurface;
