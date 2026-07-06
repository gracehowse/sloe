/**
 * ENG-1233 — guided first-win log prompt (mobile).
 *
 * ENG-1450: `firstLogChoice` used to be write-only — captured here, never
 * read anywhere downstream, so Continue silently skipped the promised
 * first log regardless of which chip was selected. Fixed at the
 * completion handler (`mobile-flow.tsx#handleComplete`): a non-null,
 * non-skip choice now lands the user on Today with the Add-to-today
 * sheet open in search mode (reusing the existing `?openLog=1` deep-link
 * — see `useLogSheetDeepLinks`), with Breakfast/Coffee pre-scoping the
 * search query to their label so the user still picks a real, validated
 * food match rather than us inventing "a breakfast" worth of nutrition.
 * `OptionCard` swap here (was a bare `PressableScale` row) gives the
 * three chips the same radio-style selected affordance as every other
 * onboarding pick (goal/sex/activity/diet) — web parity, and it stops
 * "Search food" from reading as a dead input field.
 */
import * as React from "react";
import { Text, View } from "react-native";
import { Coffee, Search, Sun } from "lucide-react-native";

import { OptionCard } from "@/components/OptionCard";
import { PressableScale } from "@/components/ui/PressableScale";
import { Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { FIRST_LOG_CHIPS } from "@suppr/shared/onboarding/conversionFunnel";
import type { FirstLogChoice } from "@/lib/onboarding";
import { useOnboarding } from "../context";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";

const ICONS = {
  breakfast: Sun,
  coffee: Coffee,
  search: Search,
} as const;

const SUBTITLES: Record<Exclude<FirstLogChoice, null | "skip">, string> = {
  search: "Opens food search on Today",
  breakfast: `Opens food search on Today, scoped to "Breakfast"`,
  coffee: `Opens food search on Today, scoped to "Coffee"`,
};

export function FirstLogStep() {
  const { state, set } = useOnboarding();
  const colors = useThemeColors();
  const accent = useAccent();
  const overline = useStepOverline();

  const pick = React.useCallback(
    (id: Exclude<FirstLogChoice, null>) => {
      set({ firstLogChoice: id });
      track(AnalyticsEvents.onboarding_first_log_prompt, {
        choice: id,
        platform: "mobile",
      });
    },
    [set],
  );

  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
        title="One quick win"
        subtitle="Log something small now — you'll land on Today ready to keep going."
      />

      <View style={{ gap: Spacing.sm }}>
        {FIRST_LOG_CHIPS.map((chip) => {
          const Icon = ICONS[chip.id];
          const selected = state.firstLogChoice === chip.id;
          return (
            <OptionCard
              key={chip.id}
              selected={selected}
              onPress={() => pick(chip.id)}
              icon={
                <Icon
                  size={18}
                  color={selected ? accent.primaryLight : colors.icon}
                  strokeWidth={1.75}
                />
              }
              title={chip.label}
              subtitle={SUBTITLES[chip.id]}
            />
          );
        })}
      </View>

      <PressableScale haptic="none" onPress={() => pick("skip")} style={{ marginTop: Spacing.md }}>
        <Text style={[Type.caption, { color: colors.textTertiary, textAlign: "center" }]}>
          Skip for now
        </Text>
      </PressableScale>
    </MobileStepBody>
  );
}
