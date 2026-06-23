import { StyleSheet, Text, View } from "react-native";
import { Flame, Lock, UtensilsCrossed } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { SmartImage } from "@/components/ui/SmartImage";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

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
  imageUrl?: string | null;
  isLocked?: boolean;
  /** "batch" → a Batch chip; any other truthy string → a quiet queued note. */
  note?: string | null;
  onPress?: () => void;
}

export function PlanMealCardV3({
  slot,
  name,
  kcal,
  imageUrl,
  isLocked,
  note,
  onPress,
}: PlanMealCardV3Props) {
  const colors = useThemeColors();
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${slot}: ${name}`}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.thumb, { backgroundColor: colors.backgroundSecondary }]}>
        {imageUrl ? (
          <SmartImage source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} />
        ) : (
          <UtensilsCrossed size={18} color={colors.navPrimary} style={{ opacity: 0.55 }} />
        )}
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
            {kcal ? `${kcal} kcal` : "—"}
          </Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
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
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.dense,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.dense,
    marginTop: Spacing.sm,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    overflow: "hidden",
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
  kcal: { fontSize: 12, fontVariant: ["tabular-nums"] },
  name: { ...Type.label, textTransform: "none", letterSpacing: 0, fontSize: 14, marginTop: 2 },
  batch: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 },
  batchText: { ...Type.statLabel, fontSize: 10 },
  note: { ...Type.caption, fontSize: 11, marginTop: 3 },
});

export default PlanMealCardV3;
