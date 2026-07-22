/**
 * ENG-1241 — optional, skippable "See Pro" trial decision (mobile).
 * TERMINAL step of the conversion funnel (first-log → upgrade). Gated by
 * `onboarding_conversion_funnel_v1` at the flow shell.
 *
 * Two affordances only (legal C4 — skip must be an unambiguous,
 * first-viewport, neutrally-labelled control, never scroll-gated or
 * disabled-styled):
 *   - "Start free trial" (primary) → routes to the compliant paywall at
 *     `/paywall?from=onboarding`, which carries every Apple 3.1.2 binding
 *     element + the full CMA auto-renew disclosure (legal C1/C3). The
 *     paywall defaults to the annual (trial-eligible) SKU so the "Try Pro
 *     free for 7 days" headline is what the user sees (Decision 4 / legal
 *     C2 — "trial" wording only when the trial SKU is selected).
 *   - "Continue on Free" (skip) → runs the terminal completion path
 *     (`complete()`) so the user lands straight on Today with no detour
 *     (Decision 2 / legal C4).
 *
 * No confirmshaming, no urgency timer, no pre-ticked trial (legal C5).
 */
import * as React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Sparkles } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import { isFeatureEnabled, track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { useOnboarding } from "../context";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";

export function UpgradeStep() {
  // ENG-1516 made the price card static, so `state.trialChoice` is no longer
  // read here; ENG-1507's persist-before-paywall flow still needs `persist`.
  const { set, complete, persist } = useOnboarding();
  const colors = useThemeColors();
  const accent = useAccent();
  const router = useRouter();
  const overline = useStepOverline();
  // ENG-1507 — "Start free trial" persists BEFORE the paywall opens, so the
  // CTA carries a real async commit: disable + spinner while the profile
  // write lands (no double-submit, no silent failure).
  const [savingPlan, setSavingPlan] = React.useState(false);
  // ENG-1510 — no price const here: the exact figure is deferred to the App
  // Store (localised/VAT-inclusive), so this step never prints a GBP amount.
  const typeScaleV1Enabled = isFeatureEnabled("type_scale_v1");

  React.useEffect(() => {
    track(AnalyticsEvents.onboarding_upgrade_step_viewed, { platform: "mobile" });
  }, []);

  const chooseFree = React.useCallback(() => {
    set({ trialChoice: "free" });
    track(AnalyticsEvents.onboarding_trial_choice, {
      choice: "free",
      platform: "mobile",
    });
    // Decision 2 — skip lands straight on Today via the terminal
    // completion path. No detour through a second paywall or the
    // notifications-prompt screen.
    complete();
  }, [set, complete]);

  const chooseTrial = React.useCallback(async () => {
    if (savingPlan) return;
    set({ trialChoice: "trial" });
    track(AnalyticsEvents.onboarding_trial_choice, {
      choice: "trial",
      platform: "mobile",
    });
    // ENG-1507 — persist the plan BEFORE opening the paywall. Every
    // `from=onboarding` paywall exit replaces straight to Today (the flow
    // shell's navigation-coupled `complete()` never runs on this path), so
    // without this await the profile row the paywall's personalised-plan
    // card reads was the PREVIOUS run's — "for lose weight" against a
    // just-selected build-muscle plan — and the new plan was silently
    // discarded. On failure `persist()` resolves false (the flow shell
    // already alerted) and we stay on-step.
    setSavingPlan(true);
    try {
      const persisted = await persist();
      if (!persisted) return;
      // The paywall carries the binding elements + disclosure and defaults
      // to the annual (trial-eligible) SKU, so the "Try Pro free for 7 days"
      // headline is the one shown (Decision 4).
      router.push("/paywall?from=onboarding" as Href);
    } finally {
      setSavingPlan(false);
    }
  }, [savingPlan, set, persist, router]);

  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
        title="Start your 7-day free trial"
        subtitle="Try Sloe Pro free for 7 days — unlimited saved recipes, multi-day macro-matched meal plans, and AI photo & voice logging. Cancel anytime. No payment due now."
      />

      {/* Static price callout (ENG-1516) — deliberately NON-interactive.
          It was a PressableScale whose tap toggled a `trialChoice`
          selected-highlight that nothing consumed (not persisted, never
          read by either CTA, couldn't be deselected) — a dead affordance
          dressed as a choice. The step keeps exactly two affordances:
          "Start free trial" + "Continue on Free" below (legal C4).
          Mirrors the same fix on the web twin. */}
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.xl,
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
            {/* Price intentionally deferred to the App Store (2026-07-09
                degraded-paywall decision, docs/decisions/2026-07-09-mobile-
                degraded-paywall-disclosure.md): App Store prices are localised
                and VAT-inclusive, so a fixed GBP SSOT figure here is a
                misleading-price claim on non-GBP storefronts. The paywall this
                step routes to shows the live RevenueCat priceString. */}
            <Text style={[Type.caption, { color: colors.textSecondary, marginTop: 4 }]}>
              First charge on Day 7 — your exact price confirms in the App Store
            </Text>
          </View>
        </View>
      </View>

      <PressableScale
        haptic="confirm"
        onPress={() => void chooseTrial()}
        disabled={savingPlan}
        accessibilityState={{ busy: savingPlan, disabled: savingPlan }}
        style={{
          backgroundColor: colors.navPrimary,
          borderRadius: Radius.full,
          paddingVertical: Spacing.md,
          alignItems: "center",
          marginBottom: Spacing.sm,
          opacity: savingPlan ? 0.7 : 1,
        }}
      >
        {savingPlan ? (
          <ActivityIndicator size="small" color={accent.primaryForeground} />
        ) : (
          <Text
            style={
              typeScaleV1Enabled
                ? [Type.button, { color: accent.primaryForeground }]
                : [Type.body, { color: accent.primaryForeground, fontWeight: "700" }]
            }
          >
            Start free trial
          </Text>
        )}
      </PressableScale>

      <PressableScale haptic="none" onPress={chooseFree} disabled={savingPlan}>
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
