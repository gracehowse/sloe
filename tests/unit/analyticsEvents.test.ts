import { describe, expect, it } from "vitest";
import { AnalyticsEvents } from "../../src/lib/analytics/events";

/**
 * Guards that every analytics event name the product relies on stays
 * registered in `AnalyticsEvents` with the exact PostHog string that
 * dashboards / funnels look for. A rename here would silently break
 * reporting, so these tests pin the stable string values.
 *
 * Added 2026-04-18 alongside the H5 audit fix that instrumented
 * `week_start_day_changed` and `fit_this_in_previewed` on both
 * platforms.
 */

describe("AnalyticsEvents registry", () => {
  it("registers week_start_day_changed with the canonical value", () => {
    expect(AnalyticsEvents.week_start_day_changed).toBe("week_start_day_changed");
  });

  it("registers fit_this_in_previewed with the canonical value", () => {
    expect(AnalyticsEvents.fit_this_in_previewed).toBe("fit_this_in_previewed");
  });

  it("registers weekly_recap_push_enabled_toggled with the canonical value", () => {
    // Added 2026-04-18 (H6 audit fix): surfaces the Settings toggle for
    // the weekly recap push so the opt-out rate can be tracked directly.
    expect(AnalyticsEvents.weekly_recap_push_enabled_toggled).toBe(
      "weekly_recap_push_enabled_toggled",
    );
  });

  it("registers streak_freeze_earned_seen with the canonical value", () => {
    // Added 2026-04-18 (H7 audit fix): fires on dismiss of the one-time
    // "You earned a freeze" row under the Today streak insight card.
    // Paired with `streak_freeze_earned` so product can measure whether
    // the earn moment is actually seen, not just fired in analytics.
    expect(AnalyticsEvents.streak_freeze_earned_seen).toBe(
      "streak_freeze_earned_seen",
    );
  });

  it("registers the three M2 in-flow AI paywall events with canonical snake_case values", () => {
    // Ship M2 (2026-04-18): web `AiPaywallDialog` and mobile
    // `AiPaywallSheet` both fire these three events with identical
    // payload shapes. Registry must not rename them — PostHog funnels
    // measuring the in-flow gate vs the full `/paywall` route depend
    // on these exact strings.
    expect(AnalyticsEvents.ai_paywall_sheet_viewed).toBe(
      "ai_paywall_sheet_viewed",
    );
    expect(AnalyticsEvents.ai_paywall_sheet_dismissed).toBe(
      "ai_paywall_sheet_dismissed",
    );
    expect(AnalyticsEvents.ai_paywall_sheet_cta_tapped).toBe(
      "ai_paywall_sheet_cta_tapped",
    );
  });

  it("registers the Ship M1 usual-meal events (hint + pill)", () => {
    // Added 2026-04-18 (Ship M1): first-run usual-meal hint + slot-header
    // log pill. A rename would silently break recap / growth-loop
    // dashboards — pin the canonical PostHog string values.
    expect(AnalyticsEvents.usual_meal_hint_shown).toBe("usual_meal_hint_shown");
    expect(AnalyticsEvents.usual_meal_hint_accepted).toBe(
      "usual_meal_hint_accepted",
    );
    expect(AnalyticsEvents.usual_meal_hint_dismissed).toBe(
      "usual_meal_hint_dismissed",
    );
    expect(AnalyticsEvents.usual_meal_log_tapped).toBe("usual_meal_log_tapped");
  });

  it("keeps the pre-M2 feature-specific funnel-entry events registered alongside the new sheet events", () => {
    // Ship M2 guard: the sheet events are ADDITIVE. The caller still
    // fires `voice_log_paywalled` / `ai_photo_log_paywalled` as the
    // per-feature funnel-entry signal. A refactor that removes either
    // of those in favour of only `ai_paywall_sheet_viewed` would break
    // the pre-M2 dashboards — re-register here so the regression is
    // loud.
    expect(AnalyticsEvents.voice_log_paywalled).toBe("voice_log_paywalled");
    expect(AnalyticsEvents.ai_photo_log_paywalled).toBe(
      "ai_photo_log_paywalled",
    );
  });

  it("keeps previously-shipped events registered (regression guard)", () => {
    // A sample of load-bearing events from earlier batches. If any of
    // these vanish, PostHog dashboards shipped in 2.5–5.13 stop
    // reporting, so the registry must not drop them.
    expect(AnalyticsEvents.food_logged).toBe("food_logged");
    expect(AnalyticsEvents.meal_copied).toBe("meal_copied");
    expect(AnalyticsEvents.day_duplicated).toBe("day_duplicated");
    expect(AnalyticsEvents.hydration_logged).toBe("hydration_logged");
    expect(AnalyticsEvents.saved_meal_logged).toBe("saved_meal_logged");
    expect(AnalyticsEvents.custom_food_logged).toBe("custom_food_logged");
    expect(AnalyticsEvents.meal_moved_in_plan).toBe("meal_moved_in_plan");
    expect(AnalyticsEvents.voice_log_committed).toBe("voice_log_committed");
    expect(AnalyticsEvents.ai_photo_log_committed).toBe("ai_photo_log_committed");
  });

  it("uses snake_case, lowercase values everywhere (naming-style gate)", () => {
    for (const [key, value] of Object.entries(AnalyticsEvents)) {
      expect(value).toBe(key);
      expect(value).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});
