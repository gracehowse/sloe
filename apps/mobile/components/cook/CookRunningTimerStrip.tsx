import { Pressable, Text, View, StyleSheet } from "react-native";
import { X } from "lucide-react-native";
import { Spacing, Radius, Accent } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import { formatTimer } from "@suppr/nutrition-core/recipeTimers";
import type { CookRunningTimer } from "@suppr/nutrition-core/cookRunningTimers";

export interface CookRunningTimerStripProps {
  timers: CookRunningTimer[];
  onReset: (id: string) => void;
  onCancel: (id: string) => void;
  testID?: string;
}

/** Heads-up stack of concurrent countdown timers (ENG-948). */
export function CookRunningTimerStrip({
  timers,
  onReset,
  onCancel,
  testID = "cook-running-timer-strip",
}: CookRunningTimerStripProps) {
  const colors = useThemeColors();
  const accent = useAccent();

  if (timers.length === 0) return null;

  return (
    <View
      style={[styles.row, { borderBottomColor: colors.border, backgroundColor: colors.card }]}
      accessibilityRole="summary"
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      {timers.map((timer) => {
        const done = timer.done;
        return (
          <View
            key={timer.id}
            style={[
              styles.chip,
              {
                borderColor: done ? Accent.successSolid : accent.primary,
                backgroundColor: done ? `${Accent.successSolid}22` : `${accent.primary}18`,
              },
            ]}
            testID={`cook-running-timer-${timer.id}`}
          >
            <Text
              style={[
                styles.time,
                { color: done ? Accent.successSolid : accent.primarySolid },
              ]}
            >
              {formatTimer(timer.remainingSeconds)}
            </Text>
            <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
              · {timer.label}
            </Text>
            {done ? (
              <Text style={[styles.done, { color: Accent.successSolid }]}>Done!</Text>
            ) : null}
            <Pressable
              onPress={() => onReset(timer.id)}
              accessibilityRole="button"
              accessibilityLabel={`Reset ${timer.label} timer`}
              hitSlop={6}
            >
              <Text style={[styles.action, { color: colors.textSecondary }]}>Reset</Text>
            </Pressable>
            <Pressable
              onPress={() => onCancel(timer.id)}
              accessibilityRole="button"
              accessibilityLabel={`Cancel ${timer.label} timer`}
              hitSlop={6}
            >
              <X size={14} color={colors.textSecondary} strokeWidth={2.25} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    maxWidth: "100%",
  },
  time: {
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
    flexShrink: 1,
  },
  done: {
    fontSize: 12,
    fontWeight: "700",
  },
  action: {
    fontSize: 12,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
