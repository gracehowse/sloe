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

/**
 * Post-ship #1 (2026-04-18) — event-name rename cycle.
 *
 * Eight rename-cycle pairs ship with a 30-day dual-emit (old + new fire
 * simultaneously) so PostHog dashboards can migrate safely. Retirement
 * of the legacy names is scheduled for 2026-05-18. These tests lock
 * both the legacy and canonical names in the registry so:
 *   - a premature legacy-name drop is caught before the retirement PR,
 *   - a canonical-name typo is caught before it hits production,
 *   - and a collision / de-registration during the migration window
 *     fails loudly instead of silently breaking dashboards.
 *
 * Source: `docs/planning/analytics-dashboards-plan-2026-04-18.md` §4.
 */
describe("rename-cycle dual-emit (post-ship #1, 2026-04-18 → retire 2026-05-18)", () => {
  it("registers #1 cook_mode_started alongside cook_mode_first_step_advanced", () => {
    expect(AnalyticsEvents.cook_mode_started).toBe("cook_mode_started");
    expect(AnalyticsEvents.cook_mode_first_step_advanced).toBe(
      "cook_mode_first_step_advanced",
    );
  });

  it("registers #2 first_run_* alongside onboarding_* (step + checklist)", () => {
    expect(AnalyticsEvents.first_run_step_completed).toBe(
      "first_run_step_completed",
    );
    expect(AnalyticsEvents.onboarding_step_completed).toBe(
      "onboarding_step_completed",
    );
    expect(AnalyticsEvents.first_run_checklist_completed).toBe(
      "first_run_checklist_completed",
    );
    expect(AnalyticsEvents.onboarding_checklist_completed).toBe(
      "onboarding_checklist_completed",
    );
  });

  it("registers #3 checkout_completed_return alongside checkout_completed", () => {
    expect(AnalyticsEvents.checkout_completed_return).toBe(
      "checkout_completed_return",
    );
    expect(AnalyticsEvents.checkout_completed).toBe("checkout_completed");
  });

  it("registers #4 recipe_import_url / _image alongside the consolidated recipe_imported", () => {
    expect(AnalyticsEvents.recipe_import_url).toBe("recipe_import_url");
    expect(AnalyticsEvents.recipe_import_image).toBe("recipe_import_image");
    expect(AnalyticsEvents.recipe_imported).toBe("recipe_imported");
  });

  it("registers #5 voice_log_* alongside ai_voice_log_* (started / committed / paywalled)", () => {
    expect(AnalyticsEvents.voice_log_started).toBe("voice_log_started");
    expect(AnalyticsEvents.ai_voice_log_started).toBe("ai_voice_log_started");
    expect(AnalyticsEvents.voice_log_committed).toBe("voice_log_committed");
    expect(AnalyticsEvents.ai_voice_log_committed).toBe(
      "ai_voice_log_committed",
    );
    expect(AnalyticsEvents.voice_log_paywalled).toBe("voice_log_paywalled");
    expect(AnalyticsEvents.ai_voice_log_paywalled).toBe(
      "ai_voice_log_paywalled",
    );
  });

  it("registers #6 streak_freeze_earned_seen alongside streak_freeze_earned_acknowledged", () => {
    expect(AnalyticsEvents.streak_freeze_earned_seen).toBe(
      "streak_freeze_earned_seen",
    );
    expect(AnalyticsEvents.streak_freeze_earned_acknowledged).toBe(
      "streak_freeze_earned_acknowledged",
    );
  });

  it("registers #7 weekly_recap_push_sent split into _scheduled + _delivered", () => {
    expect(AnalyticsEvents.weekly_recap_push_sent).toBe(
      "weekly_recap_push_sent",
    );
    expect(AnalyticsEvents.weekly_recap_push_scheduled).toBe(
      "weekly_recap_push_scheduled",
    );
    expect(AnalyticsEvents.weekly_recap_push_delivered).toBe(
      "weekly_recap_push_delivered",
    );
  });

  it("has no collisions between legacy and canonical names", () => {
    // A rename must never map two keys to the same string — if it did,
    // PostHog would see one event with two trackers feeding it and
    // dashboards would double-count during the migration window.
    const values = Object.values(AnalyticsEvents);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
