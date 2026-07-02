import * as React from "react";
import { View, Text } from "react-native";
import { Sparkles } from "lucide-react-native";
import { Radius, Spacing, Type } from "@/constants/theme";
import { OptionCard } from "@/components/OptionCard";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import {
  appChoiceHasImporter,
  buildAppChoiceOptions,
} from "@suppr/shared/onboarding/appChoiceOptions";
import type { AppChoice } from "@/lib/onboarding";
import { useOnboarding } from "../context";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";

/**
 * ENG-990 (2026-06-08) — "Coming from another app?" onboarding step
 * (mobile). Mirror of `src/app/components/onboarding/steps/app-choice.tsx`.
 *
 * A Yazio-style competitor-switch capture placed right after Welcome
 * (see `docs/research/2026-06-08-yazio-teardown.md`). Records the
 * tracker the user is leaving (`state.appChoice` + `onboarding_app_choice`)
 * and, when they pick an app we can import from, sets up the terminal
 * data-bridges step to pre-highlight the CSV importer.
 *
 * The selectable apps come from the shared `buildAppChoiceOptions()`
 * helper (derived from the CSV-import adapter registry) so the tiles are
 * byte-for-byte the same set + order as web — only apps with a live
 * adapter are shown. Flag-gated behind `onboarding-app-choice`: when OFF
 * the flow shell auto-skips this step (see `mobile-flow.tsx` +
 * `context.tsx`), so it's inert until the flag ramps.
 */
export function MobileAppChoiceStep() {
  const { state, set } = useOnboarding();
  const colors = useThemeColors();
  const overline = useStepOverline();
  // Secondary accent (Frost flag → damson, else clay) for the post-pick
  // confirmation note's tinted box + sparkles glyph. The OptionCards flip via
  // their own `useAccent`.
  const accent = useAccent();
  const options = React.useMemo(() => buildAppChoiceOptions(), []);

  const choose = React.useCallback(
    (id: Exclude<AppChoice, null>, hasImporter: boolean) => {
      set({ appChoice: id });
      track(AnalyticsEvents.onboarding_app_choice, {
        app: id,
        has_importer: hasImporter,
        platform: "ios",
      });
    },
    [set],
  );

  const picked = state.appChoice;
  const pickedHasImporter = appChoiceHasImporter(picked);

  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
        title="Coming from another app?"
        subtitle="Tell us where you're tracking now and we'll bring your history across — no re-logging months of meals."
      />

      <View style={{ gap: Spacing.dense }}>
        {options.map((opt) => (
          <OptionCard
            key={opt.id}
            selected={picked === opt.id}
            onPress={() => choose(opt.id, opt.hasImporter)}
            title={opt.label}
            subtitle={
              opt.hasImporter
                ? "We can import your export"
                : opt.id === "none"
                  ? "Set everything up from scratch"
                  : "We'll still tune your plan to you"
            }
          />
        ))}
      </View>

      {picked != null ? (
        <View
          style={{
            marginTop: 16,
            flexDirection: "row",
            gap: Spacing.sm,
            alignItems: "flex-start",
            padding: Spacing.dense,
            borderRadius: Radius.md,
            backgroundColor: accent.primary + "0D",
            borderWidth: 1,
            borderColor: accent.primary + "26",
          }}
          accessibilityLabel="app-choice-followup"
        >
          <Sparkles
            size={14}
            color={accent.primaryLight}
            style={{ marginTop: 1 }}
          />
          <Text
            style={{
              flex: 1,
              ...Type.captionSmall,
              color: colors.textSecondary,
              lineHeight: 17,
            }}
          >
            {pickedHasImporter
              ? "Nice — keep going and we'll help you bring your history over near the end. Your existing numbers stay exactly as you logged them."
              : "All set. We'll build your plan around your goals from here."}
          </Text>
        </View>
      ) : null}
    </MobileStepBody>
  );
}
