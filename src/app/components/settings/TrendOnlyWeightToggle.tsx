"use client";

import { Switch } from "../ui/switch";
import { AnalyticsEvents } from "../../../lib/analytics/events.ts";
import { track, isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { useTrendOnlyWeight } from "../../../lib/preferences/useTrendOnlyWeight.ts";

/**
 * ENG-713 — body-neutral "Trend-only weight" opt-in row (ED + dysphoria
 * dignity). Extracted from the (pinned, line-budgeted) `Settings.tsx` host.
 *
 * Flag-gated: renders NOTHING unless `progress_trend_only_v1` is on, so the
 * opt-in only appears when the toggle is available. The pref itself defaults OFF
 * (the FEATURE is opt-in). Client-side pref, mobile parity
 * (`apps/mobile/components/settings/TrendOnlyWeightRow.tsx`).
 *
 * Copy is dignity-sensitive — needs diversity-inclusion + legal-reviewer sign-off
 * before ramp (see docs/decisions/2026-07-01-trend-only-weight-mode.md).
 */
export function TrendOnlyWeightToggle() {
  const available = isFeatureEnabled("progress_trend_only_v1");
  const [trendOnlyWeight, setTrendOnlyWeight] = useTrendOnlyWeight();
  if (!available) return null;
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1 mr-4">
        <label
          htmlFor="trend-only-weight-toggle"
          className="block text-sm font-medium text-foreground cursor-pointer"
        >
          Show weight as a trend
        </label>
        <p className="text-xs text-muted-foreground mt-1">
          Hides the weight chart and numbers on Progress, showing only a gentle
          direction. You can still log weigh-ins &mdash; they just won&rsquo;t be
          shown back to you.
        </p>
      </div>
      <Switch
        id="trend-only-weight-toggle"
        aria-label="Show weight as a trend"
        data-testid="settings-trend-only-weight-toggle"
        checked={trendOnlyWeight}
        onCheckedChange={(next) => {
          const enabled = !!next;
          setTrendOnlyWeight(enabled);
          // Dignity: never attach a weight value / direction to the event.
          track(AnalyticsEvents.trend_only_weight_toggled, {
            enabled,
            platform: "web",
          });
        }}
      />
    </div>
  );
}
