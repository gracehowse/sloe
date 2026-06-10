import * as React from "react";
import { View } from "react-native";
import { Activity, Armchair, Dumbbell, Flame, Footprints, type LucideIcon } from "lucide-react-native";
import { OptionCard } from "@/components/OptionCard";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { ActivityLevel } from "@/lib/tdee";
import { useOnboarding } from "../context";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";

const ACTIVITIES: {
  id: ActivityLevel;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
}[] = [
  { id: "sedentary", title: "Sedentary", subtitle: "Mostly sitting, little walking", Icon: Armchair },
  { id: "light", title: "Lightly active", subtitle: "1–3 workouts or active days / wk", Icon: Footprints },
  { id: "moderate", title: "Moderately active", subtitle: "3–5 sessions + daily movement", Icon: Activity },
  { id: "active", title: "Very active", subtitle: "6–7 sessions, physical job", Icon: Dumbbell },
  { id: "very_active", title: "Athlete", subtitle: "Twice-daily training, competitive", Icon: Flame },
];

export function MobileActivityStep() {
  const { state, set, go } = useOnboarding();
  const colors = useThemeColors();
  const overline = useStepOverline();
  // Secondary accent (Frost flag → damson, else clay) for the selected option's
  // icon tint. The card chrome itself flips via `OptionCard`'s own `useAccent`.
  const accent = useAccent();
  // 2026-05-14 (premium-bar audit B cross-cutting #6): auto-advance
  // after 200ms when the user picks an activity level. Same pattern
  // as Goal + Sex — single-choice steps should never strand the user
  // hunting for Continue when the tap itself was the answer.
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
        title="How active are you?"
        subtitle="Rough estimate — Sloe will refine this using your activity data over ~2 weeks."
      />
      <View style={{ gap: 8 }}>
        {ACTIVITIES.map((a) => {
          const selected = state.activity === a.id;
          return (
            <OptionCard
              key={a.id}
              compact
              selected={selected}
              onPress={() => {
                if (state.activity === a.id) return;
                set({ activity: a.id });
                if (advanceTimerRef.current) {
                  clearTimeout(advanceTimerRef.current);
                }
                advanceTimerRef.current = setTimeout(() => {
                  go(1);
                }, 200);
              }}
              icon={
                <a.Icon
                  size={18}
                  color={selected ? accent.primaryLight : colors.icon}
                  strokeWidth={1.75}
                />
              }
              title={a.title}
              subtitle={a.subtitle}
            />
          );
        })}
      </View>
    </MobileStepBody>
  );
}
