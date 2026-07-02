import * as React from "react";
import { Switch, Text, View } from "react-native";
import { BarChart3 } from "lucide-react-native";

import { IconBox } from "@/components/settings/SettingsRow";
import { Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAnalyticsConsent } from "@/lib/analyticsConsent";

/**
 * ENG-1286 — "Usage analytics & replay" consent toggle (launch blocker).
 *
 * The Settings home for the analytics-consent choice the privacy policy
 * promises ("disable optional analytics … "). Reflects and writes the
 * SAME stored state as the first-open consent prompt
 * (`AnalyticsConsentPrompt`) via `useAnalyticsConsent`, and applies
 * live — flipping ON constructs/opts-in the PostHog client, flipping
 * OFF opts it out, no restart (see `lib/analytics.ts` consent
 * listener). Session replay rides the same consent — deliberately no
 * separate replay toggle.
 *
 * Self-contained (owns the consent hook) so it mounts inside the
 * Account card of the (pinned, line-budgeted) `SettingsBundleContent`
 * host without growing it — same tactic as `TrendOnlyWeightRow` /
 * `WeighInReminderRow`, whose row grammar (IconBox + 13/11 text +
 * Switch, top hairline) this matches exactly.
 *
 * No toggle analytics event by design: capturing a decline would be
 * capture-before-consent, and an accept is visible via the
 * `posthog_health_check` sentinel — intentionally event-free, not a gap.
 */
export function AnalyticsConsentRow() {
  const accent = useAccent();
  const colors = useThemeColors();
  const [consent, setConsent] = useAnalyticsConsent();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.dense,
        paddingVertical: Spacing.dense,
        paddingHorizontal: Spacing.dense,
        borderTopWidth: 1,
        borderTopColor: colors.cardBorder,
      }}
    >
      <IconBox color={accent.primary}>
        <BarChart3 size={18} color={accent.primary} strokeWidth={1.75} />
      </IconBox>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: colors.text,
            lineHeight: 17,
          }}
        >
          Usage analytics & replay
        </Text>
        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: Spacing.xs }}>
          Anonymous usage analytics and masked session replay help improve
          Sloe. Off means nothing is collected.
        </Text>
      </View>
      <Switch
        testID="settings-analytics-consent-toggle"
        value={consent === "accepted"}
        onValueChange={(v) => {
          void setConsent(v ? "accepted" : "declined");
        }}
        trackColor={{ true: accent.primary }}
      />
    </View>
  );
}
