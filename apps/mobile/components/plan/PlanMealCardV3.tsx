import { StyleSheet, Text, View } from "react-native";
import { Check, Flame, Lock, MoreHorizontal, UtensilsCrossed } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { recipeUnderlayColor } from "@suppr/shared/recipe/recipeHeroFallback";
import { SmartImage } from "@/components/ui/SmartImage";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useResolvedScheme } from "@/context/theme";
import { isFeatureEnabled } from "@/lib/analytics";
import { formatQualifiedKcal } from "@suppr/nutrition-core/formatMacro";

/**
 * PlanMealCardV3 — Sloe v3 Plan per-slot meal card (prototype `plan-card`
 * ~L4788-4794): a 48px thumb (recipe photo, or a tinted box + utensil glyph when
 * none), the slot label with a lock badge when locked, the kcal, the recipe
 * name, and a "Batch" chip or a quiet queued note. Behind sloe_v3_plan (Block 3).
 */
export interface PlanMealCardV3Props {
  /** Slot label, e.g. "Breakfast". */
  slot: string;
  name: string;
  kcal: number | null;
  /** ENG-1417 — verified vs estimate; absent → "~" qualifier (safe default). */
  isVerified?: boolean;
  imageUrl?: string | null;
  isLocked?: boolean;
  /** "batch" → a Batch chip; any other truthy string → a quiet queued note. */
  note?: string | null;
  /** When the user logged this planned meal on that day (diary match). */
  isCooked?: boolean;
  onPress?: () => void;
  /** ENG-1238 — opens the per-meal action sheet (card tap still opens recipe). */
  onOpenOptions?: () => void;
}

export function PlanMealCardV3({
  slot,
  name,
  kcal,
  isVerified,
  imageUrl,
  isLocked,
  note,
  isCooked,
  onPress,
  onOpenOptions,
}: PlanMealCardV3Props) {
  const colors = useThemeColors();
  const scheme = useResolvedScheme(); // ENG-1528 — dark ramp underlay on dark cards
  // ENG-1417 — flag-gated "~" unverified-estimate qualifier (kill switch off).
  const kcalDisplay =
    kcal != null
      ? isFeatureEnabled("kcal_trust_qualifier_v1")
        ? formatQualifiedKcal(kcal, isVerified)
        : String(kcal)
      : null;
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        isCooked ? styles.cooked : null,
      ]}
    >
      <PressableScale
        onPress={onPress}
        haptic="selection"
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel={`${slot}: ${name}`}
        style={styles.mainPress}
      >
        {/* ENG-1374 PR2 — never-white: deterministic recipe underlay, not the
            plum-grey well (refuter catch: this v3 thumb was missed by the sweep). */}
        <View style={[styles.thumb, { backgroundColor: recipeUnderlayColor({ id: name, title: name }, scheme) }]}>
          {imageUrl ? (
            <SmartImage source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} />
          ) : (
            <UtensilsCrossed size={18} color={colors.navPrimary} style={{ opacity: 0.55 }} />
          )}
          {isCooked ? (
            <View style={[styles.cookedBadge, { backgroundColor: `${Accent.successSolid}D1` }]}>
              <Check size={14} color="#fff" strokeWidth={2.5} />
            </View>
          ) : null}
        </View>
        <View style={styles.body}>
          <View style={styles.topRow}>
            <View style={styles.slotWrap}>
              <Text style={[styles.slot, { color: colors.textTertiary }]}>{slot}</Text>
              {isLocked ? (
                <Lock size={10} color={colors.textTertiary} accessibilityLabel="Locked" />
              ) : null}
            </View>
            <Text style={[styles.kcal, { color: colors.textTertiary }]}>
              {kcalDisplay ? `${kcalDisplay} kcal` : "—"}
            </Text>
          </View>
          <Text
            style={[
              styles.name,
              { color: colors.text },
              isCooked
                ? { textDecorationLine: "line-through", textDecorationColor: colors.borderStrong }
                : null,
            ]}
            numberOfLines={1}
          >
            {name}
          </Text>
          {note === "batch" ? (
            <View style={styles.batch}>
              <Flame size={12} color={Accent.warningSolid} />
              <Text style={[styles.batchText, { color: Accent.warningSolid }]}>Batch</Text>
            </View>
          ) : note ? (
            <Text style={[styles.note, { color: colors.navPrimary }]}>{note}</Text>
          ) : null}
        </View>
      </PressableScale>
      {onOpenOptions ? (
        <PressableScale
          onPress={onOpenOptions}
          haptic="selection"
          accessibilityRole="button"
          accessibilityLabel={`${slot} meal options`}
          testID="plan-card-opt"
          style={styles.optBtn}
        >
          <MoreHorizontal size={18} color={colors.textTertiary} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.dense,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    padding: Spacing.dense,
    marginTop: Spacing.sm,
  },
  cooked: { opacity: 0.72 },
  mainPress: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.dense,
    minWidth: 0,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  cookedBadge: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, minWidth: 0 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.xs,
  },
  slotWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  slot: { ...Type.statLabel, fontSize: 10 },
  kcal: { ...Type.captionSmall, fontVariant: ["tabular-nums"] },
  name: { ...Type.label, textTransform: "none", letterSpacing: 0, fontSize: 14, marginTop: 2 },
  batch: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 },
  batchText: { ...Type.statLabel, fontSize: 10 },
  note: { ...Type.caption, fontSize: 11, marginTop: 3 },
  optBtn: {
    padding: Spacing.xs,
    marginLeft: Spacing.xs,
  },
});

export default PlanMealCardV3;
