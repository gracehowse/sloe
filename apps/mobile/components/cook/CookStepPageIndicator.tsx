import { View, StyleSheet } from "react-native";
import { Radius } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

export interface CookStepPageIndicatorProps {
  /** Zero-based active step index. */
  currentIndex: number;
  totalSteps: number;
  testID?: string;
}

/** Quiet segment indicator for cook-mode step progress (ENG-947).
 *  Mirrors the muted-track treatment on web `CookMode.tsx` — filled
 *  segments for completed + active steps, muted for upcoming. */
export function CookStepPageIndicator({
  currentIndex,
  totalSteps,
  testID = "cook-step-page-indicator",
}: CookStepPageIndicatorProps) {
  const colors = useThemeColors();
  const accent = useAccent();

  if (totalSteps <= 0) return null;

  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: totalSteps,
        now: currentIndex + 1,
        text: `Step ${currentIndex + 1} of ${totalSteps}`,
      }}
      testID={testID}
    >
      {Array.from({ length: totalSteps }, (_, index) => {
        const filled = index <= currentIndex;
        return (
          <View
            key={index}
            style={[
              styles.segment,
              {
                backgroundColor: filled ? accent.primary : colors.border,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 4,
    width: "100%",
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: Radius.full,
  },
});
