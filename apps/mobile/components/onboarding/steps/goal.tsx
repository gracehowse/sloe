import * as React from "react";
import { View } from "react-native";
import {
  ArrowLeftRight,
  Minus,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react-native";
import { Accent } from "@/constants/theme";
import { OptionCard } from "@/components/OptionCard";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { Goal } from "@/lib/onboarding";
import { useOnboarding } from "../context";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";

/**
 * Mobile Goal step.
 *
 * 2026-05-12 (premium-bar audit Group B cross-cutting): icons
 * migrated from Ionicons to lucide-react-native to match the rest of
 * the app's icon system (prototype carryover rule + every other
 * onboarding step is on lucide). One-for-one shape map:
 *   trending-down-outline → TrendingDown
 *   remove-outline        → Minus
 *   trending-up-outline   → TrendingUp
 *   swap-horizontal-outline → ArrowLeftRight
 */
const GOALS: {
  id: Goal;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
}[] = [
  { id: "lose", title: "Lose fat", subtitle: "Gradual deficit, protein-first", Icon: TrendingDown },
  { id: "maintain", title: "Maintain", subtitle: "Keep things steady", Icon: Minus },
  { id: "gain", title: "Gain muscle", subtitle: "Small surplus, high protein", Icon: TrendingUp },
  { id: "recomp", title: "Recomposition", subtitle: "Slight deficit, strength-focused", Icon: ArrowLeftRight },
];

export function MobileGoalStep() {
  const { state, set, go } = useOnboarding();
  const colors = useThemeColors();
  const overline = useStepOverline();
  // 2026-05-14 (premium-bar audit B cross-cutting #6): single-choice
  // steps auto-advance after a 200ms hold so the selection state
  // registers visually before transition. Pattern mirrored on Sex +
  // Activity so the user never has to find Continue on a step where
  // the tap itself was the answer. Tap-on-same-value is a no-op (no
  // delta from current state, no advance).
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
        title="What's your goal?"
        subtitle="We'll tailor your calorie and macro targets to match. You can change this anytime."
      />
      <View style={{ gap: 10 }}>
        {GOALS.map((g) => {
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
              icon={
                <g.Icon
                  size={20}
                  color={selected ? Accent.primaryLight : colors.icon}
                  strokeWidth={2.25}
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
