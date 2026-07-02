import { Animated, Text, View, StyleSheet } from "react-native";
import { Timer as TimerIcon } from "lucide-react-native";
import { Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { SupprButton } from "@/components/ui/SupprButton";
import {
  formatTimer,
  type ParsedTimer,
} from "@suppr/nutrition-core/recipeTimers";

export interface CookStepTimerPillsProps {
  timers: ParsedTimer[];
  pulseFirst: boolean;
  pulseRef: Animated.Value;
  onStart: (timer: ParsedTimer) => void;
  testID?: string;
}

/** One tappable pill per parsed duration in the current step (ENG-948). */
export function CookStepTimerPills({
  timers,
  pulseFirst,
  pulseRef,
  onStart,
  testID = "cook-step-timer-pills",
}: CookStepTimerPillsProps) {
  const accent = useAccent();

  if (timers.length === 0) return null;

  return (
    <View style={styles.row} testID={testID}>
      {timers.map((timer, index) => {
        const pill = (
          <SupprButton
            key={`${timer.startIndex}:${timer.endIndex}`}
            variant="ghost"
            accessibilityLabel={`Start ${formatTimer(timer.totalSeconds)} timer${
              timer.isRange ? " (uses upper bound)" : ""
            }`}
            onPress={() => onStart(timer)}
            haptic="selection"
            style={styles.pill}
          >
            <TimerIcon size={16} color={accent.primarySolid} strokeWidth={2.25} />
            <Text style={[styles.pillText, { color: accent.primarySolid }]}>
              {timer.label}
            </Text>
          </SupprButton>
        );

        if (index === 0 && pulseFirst) {
          return (
            <Animated.View key={`${timer.startIndex}:pulse`} style={{ transform: [{ scale: pulseRef }] }}>
              {pill}
            </Animated.View>
          );
        }

        return pill;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.sm,
    width: "100%",
  },
  pill: {
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  pillText: {
    fontFamily: Type.bodyLarge.fontFamily,
    fontSize: Type.bodyLarge.fontSize,
    lineHeight: Type.bodyLarge.lineHeight,
    fontWeight: "600",
  },
});
