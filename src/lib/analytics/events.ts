/** Stable event names for PostHog / product analytics. */
export const AnalyticsEvents = {
  checkout_started: "checkout_started",
  checkout_completed_return: "checkout_completed_return",
  recipe_saved: "recipe_saved",
  food_logged: "food_logged",
  barcode_lookup: "barcode_lookup",
  recipe_import_url: "recipe_import_url",
  recipe_import_image: "recipe_import_image",
  meal_plan_generated: "meal_plan_generated",
  shopping_list_generated: "shopping_list_generated",
  smart_suggestion_saved: "smart_suggestion_saved",
  profile_targets_saved: "profile_targets_saved",
  cook_mode_started: "cook_mode_started",
  cook_mode_completed: "cook_mode_completed",
  cook_mode_meal_logged: "cook_mode_meal_logged",
  first_run_step_completed: "first_run_step_completed",
  empty_state_cta_clicked: "empty_state_cta_clicked",
  pricing_page_viewed: "pricing_page_viewed",
  recipe_page_viewed: "recipe_page_viewed",
  onboarding_completed: "onboarding_completed",
  onboarding_step_completed: "onboarding_step_completed",
  paywall_viewed: "paywall_viewed",
  first_run_checklist_completed: "first_run_checklist_completed",
  meal_copied: "meal_copied",
  day_duplicated: "day_duplicated",
  /** Water logged via quick-add chip or manual entry (Batch 2.5). */
  hydration_logged: "hydration_logged",
  /** Caffeine or alcohol logged via quick-add chip or manual entry (Batch 2.5). */
  stimulant_logged: "stimulant_logged",
  /** Saved meal combo created from the Quick Add panel (Batch 2.6). */
  saved_meal_created: "saved_meal_created",
  /** Saved meal combo logged in one tap (Batch 2.6). */
  saved_meal_logged: "saved_meal_logged",
  /** Saved meal combo deleted from the "My meals" tab (Batch 2.6). */
  saved_meal_deleted: "saved_meal_deleted",
  /** User added a new ingredient to an imported recipe (Batch 2.7). */
  recipe_ingredient_added: "recipe_ingredient_added",
  /** User pinned a manual macro override on a recipe ingredient row (Batch 2.7). */
  recipe_ingredient_overridden: "recipe_ingredient_overridden",
  /** User cleared a previously-set macro override on a recipe ingredient row (Batch 2.7). */
  recipe_ingredient_override_cleared: "recipe_ingredient_override_cleared",
  /** User saved personal notes and/or rating on a recipe (Batch 3.8). */
  recipe_note_saved: "recipe_note_saved",
  /** User started an inline cook timer in cook mode (Batch 3.8). */
  recipe_timer_started: "recipe_timer_started",
  /** An inline cook timer ran to completion (Batch 3.8). */
  recipe_timer_completed: "recipe_timer_completed",
  /** Cook mode opened — drives wake-lock usage measurement (Batch 3.8). */
  cook_mode_opened: "cook_mode_opened",
  /** User created a new custom food row (Batch 3.9). Payload: `{ hasBrand, servingCount }`. */
  custom_food_created: "custom_food_created",
  /** User edited an existing custom food row (Batch 3.9). */
  custom_food_updated: "custom_food_updated",
  /** User deleted a custom food row from their library (Batch 3.9). */
  custom_food_deleted: "custom_food_deleted",
  /** User logged a custom food, optionally via a named serving shortcut (Batch 3.9).
   * Payload: `{ servingLabel?, grams }`. Fires in addition to `food_logged` so
   * analytics can slice custom-food usage without double-counting total logs. */
  custom_food_logged: "custom_food_logged",
  /** User moved a planned meal from one slot/day to another (Batch 3.10 — drag-drop
   * on web, long-press + drag on mobile). Payload: `{ fromSlot, toSlot, crossDay }`.
   * `crossDay` is true iff the source and destination days differ. */
  meal_moved_in_plan: "meal_moved_in_plan",
  /** User saved a week (or 1–7 day slice) as a named plan template (Batch 3.10).
   * Payload: `{ dayCount, slotCount }`. Fails loudly on empty weeks so this event
   * only fires on successful creates. */
  plan_template_created: "plan_template_created",
  /** User applied a saved plan template to the current week (Batch 3.10). */
  plan_template_applied: "plan_template_applied",
  /** Leftover distribution pass completed after plan generation (Batch 3.10).
   * Payload: `{ parentCount, leftoverCount }` — parents that produced leftovers,
   * and total leftover slots filled. */
  plan_leftovers_generated: "plan_leftovers_generated",
  /** A freeze was consumed to protect the streak on a zero-meal day (Batch 4.11).
   * Payload: `{ dateKey, freezesRemaining }`. Fires once per freeze, not per
   * render of the protected streak. */
  streak_freeze_used: "streak_freeze_used",
  /** The user crossed a 7-day streak milestone and earned a freeze credit (Batch 4.11).
   * Payload: `{ newStreak }`. Separate from the `food_logged` event that
   * triggered the crossing so retention dashboards can slice by milestone. */
  streak_freeze_earned: "streak_freeze_earned",
  /** Weekly recap card appeared on the Progress dashboard (Batch 4.11).
   * Payload: `{ weekKey }`. Fires once per week per platform load. */
  weekly_recap_shown: "weekly_recap_shown",
  /** User dismissed the weekly recap card (Batch 4.11). Payload: `{ weekKey }`. */
  weekly_recap_dismissed: "weekly_recap_dismissed",
  /** User tapped "Share week" on the weekly recap card (Batch 4.11).
   * Payload: `{ weekKey, platform: "web" | "ios" | "android" }`. */
  weekly_recap_shared: "weekly_recap_shared",
  /** Weekly recap push notification was scheduled or delivered (Batch 4.11).
   * Fires when the local notification is scheduled (mobile) or when the
   * server-side push is deferred (web). Payload: `{ weekKey }`. */
  weekly_recap_push_sent: "weekly_recap_push_sent",
  /** iOS home/lock-screen widget snapshot was written to the shared App
   * Group (Batch 5.12). Fires when Today totals or active fast state
   * change. Mobile-only. No payload — use `$sent_at` for freshness. */
  widget_snapshot_updated: "widget_snapshot_updated",
  /** User invoked a Siri / Shortcuts-app deep link that the app handled
   * (Batch 5.12). Payload: `{ kind: "log_water" | "start_fast" | "today_remaining" }`.
   * Mobile-only. */
  siri_action_invoked: "siri_action_invoked",
  /** User opened the voice-log modal (Batch 5.13). Mic pressed or text
   * fallback launched. No payload — funnel entry. */
  voice_log_started: "voice_log_started",
  /** User tapped "Log all" on the voice-log review sheet (Batch 5.13).
   * Payload: `{ itemCount, avgConfidence }` — avgConfidence is the mean
   * of the committed items' confidence values, 0–1. */
  voice_log_committed: "voice_log_committed",
  /** Free-tier user tapped the voice-log entry point and was shown the
   * Pro paywall instead (Batch 5.13). No payload. Separate event from
   * `paywall_viewed` so we can measure conversion per feature. */
  voice_log_paywalled: "voice_log_paywalled",
  /** User opened the AI photo-log modal (Batch 5.13). No payload. */
  ai_photo_log_started: "ai_photo_log_started",
  /** User tapped "Log all" on the photo-log review sheet (Batch 5.13).
   * Payload: `{ itemCount, avgConfidence }`. */
  ai_photo_log_committed: "ai_photo_log_committed",
  /** Free-tier user tapped the photo-log entry point and was shown the
   * Pro paywall instead (Batch 5.13). No payload. */
  ai_photo_log_paywalled: "ai_photo_log_paywalled",
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];
