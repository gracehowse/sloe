import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SupprButton } from "@/components/ui/SupprButton";
import { FontFamily, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { StagedRecapCopy } from "@suppr/nutrition-core/weeklyRecapBrokenStreakGrace";

/**
 * ENG-1454 — the staged broken-streak grace rows (reset line, freeze
 * mechanic, definition-as-info-affordance) + the recap's single "Log
 * today" CTA. Extracted out of `weekly-recap.tsx` (pinned at its current
 * line budget) so the screen's call site stays a single component tag;
 * all the copy logic itself lives in `weeklyRecapBrokenStreakGrace.ts`.
 *
 * Owns BOTH the legacy "{n} freezes available" line and its staged
 * replacement (one component, one branch point) so the screen's call
 * site only passes plain numbers, not pre-built JSX.
 */
export function WeeklyRecapStreakGrace({
  stagedRecap,
  freezesAvailableNow,
  freezesConsumed,
}: {
  stagedRecap: StagedRecapCopy;
  freezesAvailableNow: number;
  freezesConsumed: number;
}) {
  const colors = useThemeColors();
  const router = useRouter();
  const legacyFreezeLine =
    freezesAvailableNow > 0 ? (
      <Text
        testID="weekly-recap-freezes-line"
        style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginTop: Spacing.sm }}
      >
        {`${freezesAvailableNow} freeze${freezesAvailableNow === 1 ? "" : "s"} available`}
        {freezesConsumed > 0 ? ` (${freezesConsumed} used to protect this streak).` : "."}
      </Text>
    ) : null;

  if (!stagedRecap.headline) return <>{legacyFreezeLine}</>;

  return (
    <>
      {stagedRecap.freezeLine ? (
        <Text
          testID="weekly-recap-freeze-mechanic-line"
          style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginTop: Spacing.sm }}
        >
          {stagedRecap.freezeLine}
        </Text>
      ) : (
        legacyFreezeLine
      )}
      {stagedRecap.resetLine ? (
        <Text
          testID="weekly-recap-streak-definition"
          style={{ fontSize: 11, color: colors.textTertiary, lineHeight: 15, marginTop: Spacing.sm }}
        >
          Counts every day with at least one meal logged.
        </Text>
      ) : null}
      <View style={{ marginTop: Spacing.lg, alignItems: "center" }}>
        <SupprButton
          variant="primary"
          haptic="selection"
          accessibilityLabel="Log today"
          onPress={() =>
            router.navigate({ pathname: "/(tabs)" as never, params: { openLog: "1", _t: String(Date.now()) } })
          }
        >
          <Text style={{ fontFamily: FontFamily.sansSemibold, fontSize: 14, color: "#fff", letterSpacing: 0.1 }}>
            Log today
          </Text>
        </SupprButton>
      </View>
    </>
  );
}

export default WeeklyRecapStreakGrace;
