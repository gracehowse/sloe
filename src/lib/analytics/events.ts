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
  /** User dismissed the one-time "You earned a freeze" row on the Today
   * streak insight card (Batch 4.11 — 2026-04-18 audit H7). Payload:
   * `{ earnedAt }` — the ISO timestamp of the earned entry that was
   * acknowledged. One event per earned moment per user. Tracks that the
   * celebratory surface was actually seen, not just fired in analytics. */
  streak_freeze_earned_seen: "streak_freeze_earned_seen",
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
  /** User flipped the Settings toggle controlling `profiles.weekly_recap_push_enabled`
   * (web `Settings` / mobile `more.tsx`). Fires once per committed change, never on
   * initial hydration from Supabase, never on dialog-cancel no-ops. Payload:
   * `{ enabled: boolean }`. Added 2026-04-18 (H6 audit fix) so product can
   * measure opt-out rate without inferring from `weekly_recap_push_sent` drop-off. */
  weekly_recap_push_enabled_toggled: "weekly_recap_push_enabled_toggled",
  /** User tapped the "Save {slot} as a meal" prompt CTA inside the weekly
   * recap card (post-ship #4, 2026-04-18). Fires when the deep-link to
   * `SaveMealDialog` / `SaveMealSheet` opens pre-seeded with the user's
   * most-frequent items from the last 7 days — the entry point of the
   * one-tap save-your-usual funnel. Payload:
   *   - `slot`: "Breakfast" | "Lunch" | "Dinner" | "Snacks" — the slot
   *     the shared `selectMostFrequentSlotSeed` helper picked.
   *   - `seedCount`: number of items pre-seeded (2–4). Product can join
   *     this against `saved_meal_created` to measure funnel completion. */
  weekly_recap_save_prompt_tapped: "weekly_recap_save_prompt_tapped",
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
  /** User changed the "Week starts on" preference in Settings (web) /
   * More (mobile). Fires once per committed change, not on initial
   * hydration. Payload: `{ from: "monday" | "sunday"; to: "monday" | "sunday" }`.
   * Added 2026-04-18 (H5 audit fix) so product can measure Monday vs
   * Sunday preference in the installed base. */
  week_start_day_changed: "week_start_day_changed",
  /** Food-search portion picker surfaced a "If you log this" projection
   * for a new `(food, quantity, unit)` tuple (web `FoodSearch` / mobile
   * `FoodSearchModal`). Fires once per distinct preview change — never
   * on initial mount, never per-pixel while the user adjusts the
   * quantity (caller de-dupes via a last-emitted key). Payload:
   * `{ fromSlot?: string; overCalories: boolean; kcalDelta: number }`.
   * Added 2026-04-18 (H5 audit fix) to measure fit-this-in usage. */
  fit_this_in_previewed: "fit_this_in_previewed",
  /** In-flow AI paywall surface rendered (web `AiPaywallDialog` or
   * mobile `AiPaywallSheet`). Fires once per mount via `useEffect`.
   * Payload: `{ feature: "voice_log" | "photo_log" }`. Added 2026-04-18
   * (M2) — distinct from the pre-existing `voice_log_paywalled` /
   * `ai_photo_log_paywalled` events, which continue to fire at the
   * caller as the funnel-entry signal. This event measures the in-flow
   * surface specifically. Identical payload on both platforms. */
  ai_paywall_sheet_viewed: "ai_paywall_sheet_viewed",
  /** User dismissed the in-flow AI paywall without tapping the primary
   * CTA. Payload: `{ feature: "voice_log" | "photo_log"; reason:
   * "backdrop" | "close_button" | "not_now" }`. Every dismiss path is
   * labelled so product can slice which exit the user preferred. Fires
   * from both platforms with identical payload shape (M2, 2026-04-18). */
  ai_paywall_sheet_dismissed: "ai_paywall_sheet_dismissed",
  /** User tapped the primary CTA on the in-flow AI paywall. Payload:
   * `{ feature: "voice_log" | "photo_log"; action: "see_plans" }`. The
   * host screen routes to `/paywall?from={feature}` after the tap; the
   * existing `/pricing` / `/paywall` screen analytics are unaffected.
   * Added 2026-04-18 (M2). */
  ai_paywall_sheet_cta_tapped: "ai_paywall_sheet_cta_tapped",
  /** First-run "Make this your usual {slot}" hint was rendered inside a
   * meal slot on Today (Ship M1, 2026-04-18). Fires once per slot per
   * mount after the gate passes. Payload: `{ slot }`. */
  usual_meal_hint_shown: "usual_meal_hint_shown",
  /** User tapped the "Save as usual" CTA on the first-run hint (Ship M1).
   * Payload: `{ slot }`. */
  usual_meal_hint_accepted: "usual_meal_hint_accepted",
  /** User tapped "Not now" on the first-run hint (Ship M1). Payload:
   * `{ slot }`. Dismiss is per-slot, persisted under
   * `suppr-usual-meal-hint-dismissed-v1`. */
  usual_meal_hint_dismissed: "usual_meal_hint_dismissed",
  /** User tapped the "Log usual: {savedMealName}" pill on a slot header
   * (Ship M1, 2026-04-18). Fires on direct one-tap or on accepting a
   * picker-sheet selection when multiple saved meals match the slot.
   * Payload: `{ slot, itemCount }`. Separate from `saved_meal_logged` so
   * dashboards can slice slot-header usage vs Quick Add usage. */
  usual_meal_log_tapped: "usual_meal_log_tapped",
  /** The computed protected streak transitioned from >=1 to 0 — i.e.
   * the user's logging streak reset, either because they missed a day
   * without a freeze available or because the freeze budget was
   * exhausted. Payload: `{ priorStreak: number }`. Fires once per
   * transition, never on repeated zero-reads. Added 2026-04-18 (L6 G8)
   * so D3's "freeze save rate" metric has a denominator. */
  streak_reset: "streak_reset",
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

// -- Shared enum types (L6 G1, G4, G5, G6, G7, G9 — 2026-04-18) ------
//
// Exported so call sites are forced by TypeScript to pass a value
// from the canonical enum, rather than inventing a new string that
// would silently break the PostHog dashboards. Additive only — the
// event names themselves are unchanged; these types lock the
// properties that ship with them.

/** Canonical `source` of a `food_logged` event (L6 G1).
 *
 * Every `track(AnalyticsEvents.food_logged, …)` call site MUST pass
 * `source` as one of these values. See
 * `tests/unit/foodLoggedSourceParity.test.ts` for the grep-level
 * assertion that guards new call sites from drifting. */
export type FoodLoggedSource =
  | "manual"         // FoodSearch text/inline search confirm
  | "quick_add"      // QuickAddPanel tap (Favourite/Frequent/Recent/Eat-again)
  | "saved_meal"     // Re-log from My meals tab
  | "custom_food"    // Logged from custom food entry
  | "copy_meal"      // Per-meal copy flow
  | "duplicate_day"  // Day-level duplicate flow
  | "barcode"        // Barcode scanner commit
  | "voice"          // Voice log commit
  | "photo"          // AI photo log commit
  | "recipe"         // Logged from recipe detail / recipe mode
  | "planner";       // Logged from planner slot

/** Canonical `surface` of an `empty_state_cta_clicked` event (L6 G5). */
export type EmptyStateSurface =
  | "today"
  | "quick_add_favourites"
  | "quick_add_frequent"
  | "quick_add_recent"
  | "quick_add_my_meals"
  | "recipes_library"
  | "planner_weekly"
  | "shopping_list"
  | "progress";

/** Canonical `via` of a `hydration_logged` / `stimulant_logged` event
 *  (L6 G6). Separates quick-chip taps from manual macro entry (e.g.
 *  water from `TodayAddMealDialog`'s manual form). */
export type HydrationStimulantVia = "quick_chip" | "manual";

/** Canonical `kind` on a `stimulant_logged` event (L6 G6). */
export type StimulantKind = "caffeine" | "alcohol";

/** Canonical `trigger` for `widget_snapshot_updated` (L6 G7). */
export type WidgetSnapshotTrigger =
  | "totals_changed"
  | "fast_state_changed"
  | "scheduled_refresh";

/** Canonical `from` enum for `paywall_viewed` (L6 G9). */
export type PaywallViewedFrom =
  | "voice_log"
  | "photo_log"
  | "settings"
  | "onboarding"
  | "trial_end"
  | "deep_link";

/** Canonical `confidence_bucket` for recipe-ingredient override events
 *  (L6 G4). Mirrors `classifyConfidence` in
 *  `src/lib/nutrition/aiLogging.ts` — do not duplicate thresholds. */
export type ConfidenceBucket = "high" | "medium" | "low";
