import * as React from "react";
import { Switch, Text, View } from "react-native";
import { Activity } from "lucide-react-native";

import { IconBox } from "@/components/settings/SettingsRow";
import { Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { track, isFeatureEnabled } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { useTrendOnlyWeight } from "@/lib/trendOnlyWeight";

/**
 * ENG-713 — body-neutral "Trend-only weight" opt-in row (ED + dysphoria
 * dignity). The diversity-inclusion DI-P0-03 surface the Calm-mode container was
 * named for (product-lead 2026-06-14).
 *
 * Self-contained (owns the pref hook + analytics) so it mounts inside the
 * Display card of the (pinned, line-budgeted) `SettingsBundleContent` host
 * without growing it — same tactic as `WeighInReminderRow`. Flag-gated
 * (`progress_trend_only_v1`): renders nothing unless the flag is on, so the
 * opt-in only appears when it's available. The pref itself defaults OFF (the
 * FEATURE is opt-in). Web parity:
 * `src/app/components/settings/TrendOnlyWeightToggle.tsx`.
 *
 * Copy matches the sibling calm-mode row's inline-style grammar exactly (same
 * element, same treatment). It is dignity-sensitive — needs diversity-inclusion
 * + legal-reviewer sign-off before ramp (see the decision doc).
 */
export function TrendOnlyWeightRow() {
  const accent = useAccent();
  const colors = useThemeColors();
  const available = isFeatureEnabled("progress_trend_only_v1");
  const [trendOnlyWeight, setTrendOnlyWeight] = useTrendOnlyWeight();
  if (!available) return null;
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
        <Activity size={18} color={accent.primary} strokeWidth={1.75} />
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
          Show weight as a trend
        </Text>
        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: Spacing.xs }}>
          Hides the weight chart and numbers on Progress, showing only a gentle
          direction. You can still log weigh-ins — they just won’t be shown back
          to you.
        </Text>
      </View>
      <Switch
        testID="settings-trend-only-weight-toggle"
        value={trendOnlyWeight}
        onValueChange={(v) => {
          setTrendOnlyWeight(v);
          // Dignity: never attach a weight value / direction to the event.
          track(AnalyticsEvents.trend_only_weight_toggled, {
            enabled: v,
            platform: "mobile",
          });
        }}
        trackColor={{ true: accent.primary }}
      />
    </View>
  );
}
