import * as React from "react";
import { View } from "react-native";
import { Spacing } from "@/constants/theme";
import { OptionCard } from "@/components/OptionCard";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import {
  ONBOARDING_WHY_NOW_OPTIONS,
  ONBOARDING_WHY_NOW_QUESTION,
  ONBOARDING_WHY_NOW_SUBTITLE,
} from "@suppr/shared/onboarding/whyNowOptions";
import type { WhyNow } from "@/lib/onboarding";
import { useOnboarding } from "../context";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";

/**
 * ENG-963 (2026-06-30) — "What's bringing you here?" onboarding step
 * (mobile). Mirror of `src/app/components/onboarding/steps/why-now.tsx`.
 *
 * A single, calm, OPTIONAL intent capture placed right after the Goal step.
 * Records the user's reason (`state.whyNow` + `onboarding_why_now`) so the
 * reveal step can reflect it back ("a plan built around feeling better day to
 * day"). The options + copy come from the shared `whyNowOptions.ts` helper so
 * the tiles are byte-for-byte the same set + order as web — body-neutral
 * throughout (no health claims, no outcome promises).
 *
 * Flag-gated behind the default-OFF `onboarding-why-now` flag: when OFF the
 * flow shell auto-skips this step (see `mobile-flow.tsx` + `context.tsx`), so
 * it's inert until the flag ramps. Picking is optional — the footer Continue
 * always advances.
 */
export function MobileWhyNowStep() {
  const { state, set } = useOnboarding();
  const overline = useStepOverline();

  const choose = React.useCallback(
    (id: Exclude<WhyNow, null>) => {
      set({ whyNow: id });
      track(AnalyticsEvents.onboarding_why_now, {
        reason: id,
        platform: "ios",
      });
    },
    [set],
  );

  const picked = state.whyNow;

  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
        title={ONBOARDING_WHY_NOW_QUESTION}
        subtitle={ONBOARDING_WHY_NOW_SUBTITLE}
      />

      <View style={{ gap: Spacing.dense }}>
        {ONBOARDING_WHY_NOW_OPTIONS.map((opt) => (
          <OptionCard
            key={opt.id}
            selected={picked === opt.id}
            onPress={() => choose(opt.id)}
            title={opt.title}
            subtitle={opt.subtitle}
          />
        ))}
      </View>
    </MobileStepBody>
  );
}
