import { StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * PlanHouseholdBannerV3 — Sloe v3 Plan household context banner (prototype
 * `plan-hh2` ~L4736-4743): stacked avatars (first 3, owner tinted plum) +
 * "Cooking for N · [names]" + a chevron, or a "M× — match" flag when the
 * serving count doesn't match the number of eaters. Behind sloe_v3_plan; the
 * host renders it only when the household is enabled.
 */
export interface PlanHouseholdMember {
  /** Single-letter avatar initial. */
  initial: string;
  isOwner: boolean;
}

export interface PlanHouseholdBannerV3Props {
  /** Eating members (the first 3 render as avatars). */
  members: PlanHouseholdMember[];
  servingCount: number;
  /** First names joined, e.g. "Grace, Sam, Mia". */
  names: string;
  /** Eater count when it mismatches `servingCount`, else null (→ chevron). */
  mismatchEaters: number | null;
  onPress: () => void;
}

export function PlanHouseholdBannerV3({
  members,
  servingCount,
  names,
  mismatchEaters,
  onPress,
}: PlanHouseholdBannerV3Props) {
  const colors = useThemeColors();
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={`Cooking for ${servingCount}: ${names}`}
      style={[
        styles.banner,
        { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
      ]}
    >
      <View style={styles.avatars}>
        {members.slice(0, 3).map((m, i) => (
          <View
            key={i}
            style={[
              styles.avatar,
              {
                marginLeft: i === 0 ? 0 : -8,
                backgroundColor: m.isOwner ? colors.navPrimary : Accent.successSolid,
                borderColor: colors.backgroundSecondary,
              },
            ]}
          >
            <Text style={styles.avatarText}>{m.initial}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
        Cooking for {servingCount} · {names}
      </Text>
      {mismatchEaters != null ? (
        <Text style={[styles.flag, { color: Accent.warning }]}>
          {mismatchEaters}× — match
        </Text>
      ) : (
        <ChevronRight size={16} color={colors.textTertiary} />
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.dense,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.dense,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  avatars: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  avatarText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    fontFamily: Type.label.fontFamily,
  },
  label: { ...Type.label, textTransform: "none", letterSpacing: 0, flex: 1, fontSize: 13 },
  flag: { ...Type.statLabel, fontSize: 11, color: Accent.warning },
});

export default PlanHouseholdBannerV3;
