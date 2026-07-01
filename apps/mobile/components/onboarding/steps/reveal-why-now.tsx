import * as React from "react";
import { Text } from "react-native";
import { FontFamily } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { ONBOARDING_REVEAL_WHY_NOW_REFLECTION } from "@suppr/shared/onboarding/figmaCopy";
import type { WhyNow } from "@/lib/onboarding";

/**
 * ENG-963 — reveal-step reflection of the optional why-now intent ("a plan
 * built around feeling better day to day"). Extracted into its own file so
 * the (legacy, over-budget) reveal step doesn't grow. Renders nothing when
 * no intent was picked (the step is flag-gated + optional). Copy is sourced
 * from `figmaCopy.ts` so it never drifts from the web twin; the serif italic
 * mirrors the permission-quote treatment in the reveal hero.
 */
export function RevealWhyNowReflection({ whyNow }: { whyNow: WhyNow }) {
  const colors = useThemeColors();
  if (!whyNow) return null;
  return (
    <Text
      testID="onboarding-reveal-why-now"
      style={{
        fontFamily: FontFamily.serifRegular,
        fontSize: 16,
        fontStyle: "italic",
        color: colors.navPrimary,
        textAlign: "center",
        marginTop: 12,
        lineHeight: 22,
        maxWidth: 340,
      }}
    >
      {ONBOARDING_REVEAL_WHY_NOW_REFLECTION[whyNow]}
    </Text>
  );
}
