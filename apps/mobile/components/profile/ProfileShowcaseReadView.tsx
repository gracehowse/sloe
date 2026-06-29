import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

export interface ProfileShowcaseReadViewProps {
  displayName: string;
  joinedLabel: string | null;
  monogramInitial: string;
  recipeCount: number;
  streakDays: number;
  daysLogged: number;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

/** ENG-1256 — read showcase Profile; editing lives in Settings. */
export function ProfileShowcaseReadView({
  displayName,
  joinedLabel,
  monogramInitial,
  recipeCount,
  streakDays,
  daysLogged,
  calories,
  protein,
  carbs,
  fat,
}: ProfileShowcaseReadViewProps) {
  const colors = useThemeColors();
  const router = useRouter();

  return (
    <View style={{ gap: Spacing.lg }}>
      <View style={[styles.identity, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.avatarText, { color: colors.navPrimary }]}>{monogramInitial}</Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{displayName || "Your profile"}</Text>
        {joinedLabel ? (
          <Text style={[styles.joined, { color: colors.textTertiary }]}>{joinedLabel}</Text>
        ) : null}
      </View>

      <View style={[styles.statsRow, { borderColor: colors.border }]}>
        {[
          { label: "Days logged", value: String(daysLogged) },
          { label: "Recipes", value: String(recipeCount) },
          { label: "Day streak", value: String(streakDays) },
        ].map((stat, idx) => (
          <View
            key={stat.label}
            style={[
              styles.statCell,
              idx > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
            ]}
          >
            <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Daily targets</Text>
        <Text style={[styles.targetLine, { color: colors.textSecondary }]}>
          {calories} kcal · {protein}g P · {carbs}g C · {fat}g F
        </Text>
        <PressableScale
          onPress={() => router.push("/(tabs)/settings" as never)}
          haptic="selection"
          accessibilityRole="button"
          accessibilityLabel="Edit goals and targets in Settings"
          style={styles.settingsRow}
        >
          <Text style={[styles.settingsLabel, { color: colors.navPrimary }]}>Edit in Settings</Text>
          <ChevronRight size={18} color={colors.textTertiary} />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  identity: {
    alignItems: "center",
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 32, fontFamily: Type.title.fontFamily },
  name: { ...Type.title, textAlign: "center" },
  joined: { ...Type.caption },
  statsRow: {
    flexDirection: "row",
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  statCell: { flex: 1, alignItems: "center", paddingVertical: Spacing.md, gap: 2 },
  statValue: { fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] },
  statLabel: { ...Type.caption, fontSize: 11 },
  card: { borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.lg, gap: Spacing.sm },
  cardTitle: { fontSize: 14, fontWeight: "600" },
  targetLine: { ...Type.body, fontVariant: ["tabular-nums"] },
  settingsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: Spacing.sm },
  settingsLabel: { fontSize: 14, fontWeight: "600" },
});

export default ProfileShowcaseReadView;
