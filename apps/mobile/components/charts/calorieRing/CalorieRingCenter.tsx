import { Text } from "react-native";
import { PostHogMaskView } from "posthog-react-native";
import { Type } from "@/constants/theme";

export type CalorieRingCenterProps = {
  animatedCenterValue: number;
  textColor: string;
  secondaryColor: string;
  centerLabel: string;
  budgetLine: string;
  goal: number;
  expanded: boolean;
};

export function CalorieRingCenter({
  animatedCenterValue,
  textColor,
  secondaryColor,
  centerLabel,
  budgetLine,
  goal,
  expanded,
}: CalorieRingCenterProps) {
  return (
    <>
      <PostHogMaskView>
        <Text
          style={{
            ...Type.ringValue,
            color: textColor,
            fontVariant: ["tabular-nums"],
          }}
        >
          {animatedCenterValue.toLocaleString()}
        </Text>
      </PostHogMaskView>
      <Text
        style={{
          ...Type.label,
          color: textColor,
          marginTop: 1,
        }}
      >
        {centerLabel}
      </Text>
      {goal > 0 && !expanded ? (
        <PostHogMaskView>
          <Text
            style={{
              ...Type.caption,
              color: secondaryColor,
              marginTop: 1,
              fontVariant: ["tabular-nums"],
            }}
          >
            {budgetLine}
          </Text>
        </PostHogMaskView>
      ) : null}
    </>
  );
}
