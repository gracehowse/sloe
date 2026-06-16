import * as React from "react";
import { Spacing } from "@/constants/theme";
import { View } from "react-native";
import { FoodFallbackThumb } from "@/components/imagery/FoodFallbackThumb";
import { OptionCard } from "@/components/OptionCard";
import {
  ONBOARDING_GOAL_OPTIONS,
  ONBOARDING_GOAL_QUESTION,
  ONBOARDING_GOAL_SUBTITLE,
} from "@suppr/shared/onboarding/goalOptions";
import { useOnboarding } from "../context";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";

export function MobileGoalStep() {
  const { state, set, go } = useOnboarding();
  const overline = useStepOverline();
  const advanceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  React.useEffect(
    () => () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    },
    [],
  );
  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
        title={ONBOARDING_GOAL_QUESTION}
        subtitle={ONBOARDING_GOAL_SUBTITLE}
      />
      <View style={{ gap: Spacing.dense }}>
        {ONBOARDING_GOAL_OPTIONS.map((g) => {
          const selected = state.goal === g.id;
          return (
            <OptionCard
              key={g.id}
              selected={selected}
              onPress={() => {
                if (state.goal === g.id) return;
                set({ goal: g.id });
                if (advanceTimerRef.current) {
                  clearTimeout(advanceTimerRef.current);
                }
                advanceTimerRef.current = setTimeout(() => {
                  go(1);
                }, 200);
              }}
              thumbnail={
                <FoodFallbackThumb
                  title={g.thumbnailTitle}
                  size={56}
                  style={{ borderRadius: 28 }}
                />
              }
              title={g.title}
              subtitle={g.subtitle}
            />
          );
        })}
      </View>
    </MobileStepBody>
  );
}
