/**
 * ENG-1241 — skippable Pro trial decision (mobile).
 */
import * as React from "react";
import { Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Sparkles } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { PRICING_TIERS } from "@suppr/shared/landing/pricingTiers";
import { useOnboarding } from "../context";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";

const proTier = PRICING_TIERS.find((t) => t.name === "Pro");

export function UpgradeStep() {
  const { state, set, go } = useOnboarding();
  const colors = useThemeColors();
  const accent = useAccent();
  const router = useRouter();
  const overline = useStepOverline();
  const annualPrice = proTier?.annualPrice ?? proTier?.price ?? "—";

  const chooseFree = React.useCallback(() => {
    set({ trialChoice: "free" });
    track(AnalyticsEvents.onboarding_trial_choice, {
      choice: "free",
      platform: "mobile",
    });
    go(1);
  }, [set, go]);

  const chooseTrial = React.useCallback(() => {
    set({ trialChoice: "trial" });
    track(AnalyticsEvents.onboarding_trial_choice, {
      choice: "trial",
      platform: "mobile",
    });
    router.push("/paywall?from=onboarding" as Href);
  }, [set, router]);

  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
        title="Start with everything on"
        subtitle="Try Sloe Pro free for 7 days — barcode scanning, custom macros, and coaching."
      />

      <PressableScale
        haptic="selection"
        onPress={() => set({ trialChoice: "trial" })}
        style={{
          borderWidth: 1,
          borderColor: state.trialChoice === "trial" ? colors.navPrimary : colors.border,
          borderRadius: 12,
          padding: Spacing.md,
          marginBottom: Spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
          <Sparkles size={20} color={colors.navPrimary} />
          <View style={{ flex: 1 }}>
            <Text style={[Type.body, { color: colors.text, fontWeight: "600" }]}>
              7-day free trial
            </Text>
            <Text style={[Type.caption, { color: colors.textSecondary, marginTop: 4 }]}>
              Then {annualPrice}
              {proTier?.annualPeriod ?? "/year"}
            </Text>
          </View>
        </View>
      </PressableScale>

      <PressableScale
        haptic="confirm"
        onPress={chooseTrial}
        style={{
          backgroundColor: colors.navPrimary,
          borderRadius: Radius.full,
          paddingVertical: Spacing.md,
          alignItems: "center",
          marginBottom: Spacing.sm,
        }}
      >
        <Text style={[Type.body, { color: accent.primaryForeground, fontWeight: "700" }]}>
          Start free trial
        </Text>
      </PressableScale>

      <PressableScale haptic="none" onPress={chooseFree}>
        <Text
          style={[
            Type.body,
            { color: colors.textSecondary, textAlign: "center", paddingVertical: Spacing.sm },
          ]}
        >
          Continue on Free
        </Text>
      </PressableScale>
    </MobileStepBody>
  );
}
