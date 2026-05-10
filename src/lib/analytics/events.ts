/** Stable event names for PostHog / product analytics. */
export const AnalyticsEvents = {
  checkout_started: "checkout_started",
  // [RENAME-CYCLE 2026-04-18 → retire 2026-05-18] Fires alongside
  // `checkout_completed`. Drop the `_return` suffix once dashboards have
  // migrated. See `docs/planning/analytics-dashboards-plan-2026-04-18.md` §4.
  checkout_completed_return: "checkout_completed_return",
  /** Canonical checkout success event (rename-cycle target for the legacy
   *  `checkout_completed_return`). Added 2026-04-18 alongside the 30-day
   *  dual-emit. Retire the old name 2026-05-18. */
  checkout_completed: "checkout_completed",
  recipe_saved: "recipe_saved",
  food_logged: "food_logged",
  barcode_lookup: "barcode_lookup",
  // [RENAME-CYCLE 2026-04-18 → retire 2026-05-18] Fires alongside
  // `recipe_imported { source: "url" }`. Collapsed event lands in the
  // registry below.
  recipe_import_url: "recipe_import_url",
  // [RENAME-CYCLE 2026-04-18 → retire 2026-05-18] Fires alongside
  // `recipe_imported { source: "image" }`.
  recipe_import_image: "recipe_import_image",
  /** Canonical recipe-import event (rename-cycle target for
   *  `recipe_import_url` / `recipe_import_image`). Payload:
   *  `{ source: "url" | "image"; ...originalPayload }`. Retire the two
   *  legacy events on 2026-05-18. */
  recipe_imported: "recipe_imported",
  meal_plan_generated: "meal_plan_generated",
  shopping_list_generated: "shopping_list_generated",
  smart_suggestion_saved: "smart_suggestion_saved",
  profile_targets_saved: "profile_targets_saved",
  // [RENAME-CYCLE 2026-04-18 → retire 2026-05-18] Ambiguous vs
  // `cook_mode_opened` — fires alongside `cook_mode_first_step_advanced`.
  cook_mode_started: "cook_mode_started",
  /** Canonical cook-mode engagement event (rename target for
   *  `cook_mode_started`). Same payload shape. Retire old name 2026-05-18. */
  cook_mode_first_step_advanced: "cook_mode_first_step_advanced",
  cook_mode_completed: "cook_mode_completed",
  cook_mode_meal_logged: "cook_mode_meal_logged",
  // [RENAME-CYCLE 2026-04-18 → retire 2026-05-18] Fires alongside
  // `onboarding_step_completed` — drop the `first_run_` prefix so
  // onboarding events are consistent.
  first_run_step_completed: "first_run_step_completed",
  empty_state_cta_clicked: "empty_state_cta_clicked",
  pricing_page_viewed: "pricing_page_viewed",
  recipe_page_viewed: "recipe_page_viewed",
  onboarding_completed: "onboarding_completed",
  onboarding_step_completed: "onboarding_step_completed",
  paywall_viewed: "paywall_viewed",
  /** Fires when the user dismisses an in-app paywall surface
   *  (currently: `UpgradePaywallDialog` on web). Payload:
   *    { from: PaywallViewedFrom,
   *      reason: "continue_free" | "close_button" | "backdrop" }
   *  Added 2026-04-20 for the Claude Design whole-paywall modal port.
   *  Complements `paywall_viewed` so the F2 funnel has a clean
   *  dismiss counterpart per `from`-surface. */
  paywall_dismissed: "paywall_dismissed",
  /** Fires when the user commits a change to the billing-period
   *  toggle on the paywall (mobile `/paywall`) or the pricing page
   *  (web `/pricing`). Dedup: toggle no-ops are suppressed at the
   *  call site, so every emit represents a real commit.
   *
   *  Payload:
   *    { from: PaywallViewedFrom, fromPeriod: "monthly" | "annual",
   *      toPeriod: "monthly" | "annual",
   *      surface: "route" | "web_pricing",
   *      platform: "web" | "ios" | "android" }
   *
   *  Measures annual adoption rate without polluting the
   *  `paywall_viewed` → `checkout_completed` funnel. Registered
   *  2026-04-19 per analytics-engineer round-1 decision on the
   *  paywall v2 spec §11 events. */
  paywall_period_changed: "paywall_period_changed",
  // [RENAME-CYCLE 2026-04-18 → retire 2026-05-18] Fires alongside
  // `onboarding_checklist_completed`.
  first_run_checklist_completed: "first_run_checklist_completed",
  /** Canonical onboarding-checklist completion event (rename target for
   *  `first_run_checklist_completed`). Same payload shape. Retire old
   *  name 2026-05-18. */
  onboarding_checklist_completed: "onboarding_checklist_completed",
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
  /** User changed the recipe scale on the Cook screen (Paprika parity,
   *  2026-04-30). Payload: `{ recipeId, scale }`. Fires when the
   *  segmented control commit advances; not on first render. Used to
   *  measure scaling adoption + the most-popular preset. */
  recipe_scale_changed: "recipe_scale_changed",
  /** User saved a per-cook history row from the completion card
   *  (Paprika parity, 2026-04-30). Payload:
   *    `{ recipeId, scale, rating, hasNote, durationSec }`.
   *  Fires once per session, after the row writes to
   *  `recipe_cook_history`. Distinct from `recipe_note_saved` which
   *  fires for the rolling per-recipe note in the recipe detail screen. */
  cook_history_saved: "cook_history_saved",
  /** P2-24 (2026-04-25): user tapped "Log this meal" from the cook-mode
   *  done state on mobile. Pairs with `food_logged` after the recipe
   *  page's autoLog flow runs (the recipe page owns the journal write
   *  for parity with the explicit "Add to today" button on the same
   *  page). Payload: `{ recipeId }`. */
  cook_mode_log_tapped: "cook_mode_log_tapped",
  /** Recime parity (2026-04-30): user tapped the "Watch original"
   *  button on the Cook screen header. Only renders when the recipe
   *  has a `source_video_url` (or, until that field exists in DB, a
   *  `source_url` that is itself a known video host URL). Payload:
   *    `{ recipeId, videoHost: "youtube" | "instagram" | "tiktok" | "other" }`.
   *  Slices tap-through by host so we can see whether YT / IG / TT
   *  imports are pulling users away from the Cook flow at different
   *  rates. The URL itself is never sent — host classification only. */
  cook_watch_original_tapped: "cook_watch_original_tapped",
  /** Paprika parity (2026-05-01): user toggled the "Voice handsfree"
   *  preference. Payload: `{ enabled }`.
   *  v1 ships the opt-in shell only — actual audio capture is queued
   *  for a follow-up release per
   *  `docs/decisions/2026-05-01-cook-voice-handsfree.md`. The pref
   *  fires from settings AND the in-cook surface so the funnel doesn't
   *  have to UNION two events to count opt-ins. */
  cook_handsfree_pref_changed: "cook_handsfree_pref_changed",
  /** Paprika parity (2026-05-01): user tapped the in-cook mic toggle
   *  to enable/disable handsfree mode for the active session. Payload:
   *    `{ recipeId, enabled }`.
   *  Distinct from `cook_handsfree_pref_changed` so we can tell whether
   *  users discover voice via the settings switch or the cook header.
   *  In v1 (no listener) this still fires so we can size the audience
   *  for v2 before paying the binary-size + privacy cost of shipping
   *  speech recognition. */
  cook_handsfree_session_toggled: "cook_handsfree_session_toggled",
  /** Paprika parity (2026-05-01): a recognised handsfree keyword
   *  ("next" / "previous" / "repeat" / "pause" / "resume") triggered
   *  a navigation/timer action in cook mode. Payload:
   *    `{ recipeId, command }` where command is one of the canonical
   *  handsfree commands. Not yet emitted in v1 — registered ahead of
   *  the listener so the registry rollout has the event name pinned.
   *  Same name on web should voice ever ship there (browser kitchens
   *  are uncommon — see decision doc for why mobile-only is intentional). */
  cook_handsfree_command_received: "cook_handsfree_command_received",
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
  /** Household creation attempt failed (F-142, 2026-05-10). Payload:
   *  `{ code, raw_message, raw_code }` where `code` is the stable
   *  envelope code from `createHousehold` (e.g. "create_member_failed",
   *  "unexpected_throw") and `raw_*` carry the raw PG / supabase error
   *  for diagnosis without surfacing to the user. Fires on every
   *  failure so the next "nothing happened when I created a household"
   *  TF report is correlated to a concrete code. */
  household_create_failed: "household_create_failed",
  /** Mobile attempted to sync the user's tier to Supabase after a
   *  RevenueCat purchase / restore (F-143, 2026-05-10). Payload:
   *  `{ status, from, to, error_code }` where status is one of
   *  `wrote | no_change | lockdown_expected | unexpected_error`.
   *  `lockdown_expected` is the post-2026-05-03 normal — the server
   *  webhook is the authoritative path. If `unexpected_error`
   *  appears in production, the client-side write hit a non-lockdown
   *  PG error worth investigating. If `lockdown_expected` fires but
   *  `profiles.user_tier` never updates server-side, the RC webhook
   *  isn't configured / firing — operational fix on Vercel + RC
   *  dashboard. */
  revenuecat_tier_sync_attempted: "revenuecat_tier_sync_attempted",
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
   * celebratory surface was actually seen, not just fired in analytics.
   *
   * [RENAME-CYCLE 2026-04-18 → retire 2026-05-18] Fires alongside
   * `streak_freeze_earned_acknowledged` — "_seen" is inconsistent
   * suffix. See `docs/planning/analytics-dashboards-plan-2026-04-18.md` §4. */
  streak_freeze_earned_seen: "streak_freeze_earned_seen",
  /** Canonical acknowledgement event (rename target for
   *  `streak_freeze_earned_seen`). Same payload `{ earnedAt }`. Retire
   *  old name 2026-05-18. */
  streak_freeze_earned_acknowledged: "streak_freeze_earned_acknowledged",
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
   * server-side push is deferred (web). Payload: `{ weekKey }`.
   *
   * [RENAME-CYCLE 2026-04-18 → retire 2026-05-18] The old name
   * conflates scheduling with delivery. Split into
   * `weekly_recap_push_scheduled` (local trigger registered) and
   * `weekly_recap_push_delivered` (OS fired). Dual-emit continues
   * firing the legacy `weekly_recap_push_sent` at the scheduling site
   * for the 30-day migration window. */
  weekly_recap_push_sent: "weekly_recap_push_sent",
  /** Canonical scheduling event (rename target — split #1 for
   *  `weekly_recap_push_sent`). Fires when the OS-level local
   *  notification has been successfully registered. Payload:
   *  `{ weekKey }`. Retire old name 2026-05-18. */
  weekly_recap_push_scheduled: "weekly_recap_push_scheduled",
  /** Canonical delivery event (rename target — split #2 for
   *  `weekly_recap_push_sent`). Fires when the OS delivers the recap
   *  push to the device (not yet wired — no delivery listener exists
   *  today, see TODO in `apps/mobile/app/_layout.tsx`). Payload:
   *  `{ weekKey }`. */
  weekly_recap_push_delivered: "weekly_recap_push_delivered",
  /** User tapped the weekly recap push notification and the OS routed
   *  the response into the app (Sunday push rewrite — T5, 2026-04-19).
   *  Mobile-only — fired by the `Notifications.addNotificationResponseReceivedListener`
   *  registered in `apps/mobile/app/_layout.tsx`, gated on
   *  `data.kind === "weekly_recap"`. Payload: `{ weekKey: string | null }`
   *  — null when the push payload predates the `weekKey` data-field
   *  addition (see `apps/mobile/lib/weeklyRecapPush.ts` and
   *  `app/api/push/weekly-recap/route.ts`). Drives the open-rate side
   *  of the scheduled-vs-opened funnel; combined with T6's server-side
   *  `weekly_recap_push_sent` it gives a real open-rate denominator. */
  weekly_recap_push_opened: "weekly_recap_push_opened",
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
  /** Weekly Check-in surface (TDEE delta + goal-pace re-tune) was viewed.
   * MacroFactor parity (extended-competitor-audit, 2026-04-30). Fires
   * once per visible weekKey on either platform — mobile from the
   * Weekly Recap screen's check-in section, web from the Digest's TDEE
   * subsection. Payload:
   *   - `weekKey`: stable `YYYY-Www` key for the week in scope.
   *   - `kind`: "first_week" | "low_confidence" | "ready" — the gate
   *     the cascade landed on. Lets product split engagement by
   *     whether the user is seeing real numbers vs the placeholder.
   *   - `direction`: "up" | "down" | "flat" — only meaningful for
   *     `kind === "ready"`. Sent for all kinds for shape stability.
   *   - `tdeeDeltaKcal`: signed kcal delta. `null` when kind != "ready". */
  weekly_checkin_viewed: "weekly_checkin_viewed",
  /** User confirmed a goal-pace re-tune from the Weekly Check-in
   * surface (MacroFactor parity). The re-tune writes new targets to
   * `profiles` (target_calories, target_protein, target_carbs,
   * target_fat, target_fiber_g, plan_pace) without re-running
   * onboarding. Payload:
   *   - `previousPaceKgPerWeek`: number — the pace inferred from the
   *     prior target (snapped to the closest preset). `null` when we
   *     couldn't infer one.
   *   - `newPaceKgPerWeek`: number — the user's chosen preset (0,
   *     0.25, 0.5, 0.75, 1.0).
   *   - `previousTargetKcal`: number — the calorie target before the
   *     re-tune.
   *   - `newTargetKcal`: number — the calorie target after the re-tune.
   *   - `belowSafetyFloor`: boolean — true when the new target dipped
   *     below the soft-warn floor. Suppr policy: soft-warn-not-block,
   *     so this is informational not blocking.
   *   - `surface`: "weekly_checkin_sheet" | "settings_targets" — which
   *     entry point the user used. */
  goal_pace_adjusted: "goal_pace_adjusted",
  /** User dismissed the Sunday "Weekly check-in available" banner on
   * Today (mobile-only — web does not surface the same banner because
   * the Digest already lives on Progress). Payload:
   *   - `weekKey`: stable `YYYY-Www` key for the week the banner was
   *     gated on. Lets product distinguish "dismissed this week" from
   *     "dismissed last week" when looking at week-over-week
   *     dismissal rates. */
  weekly_checkin_banner_dismissed: "weekly_checkin_banner_dismissed",
  /** User tapped the Sunday "Weekly check-in available" banner on
   * Today and was routed to the Weekly Recap screen. Payload:
   *   - `weekKey`: stable `YYYY-Www` key for the week. */
  weekly_checkin_banner_tapped: "weekly_checkin_banner_tapped",
  /** iOS home/lock-screen widget snapshot was written to the shared App
   * Group (Batch 5.12). Fires when Today totals or active fast state
   * change. Mobile-only. No payload — use `$sent_at` for freshness. */
  widget_snapshot_updated: "widget_snapshot_updated",
  /** User invoked a Siri / Shortcuts-app deep link that the app handled
   * (Batch 5.12). Payload: `{ kind: "log_water" | "start_fast" | "today_remaining" }`.
   * Mobile-only. */
  siri_action_invoked: "siri_action_invoked",
  /** User opened the voice-log modal (Batch 5.13). Mic pressed or text
   * fallback launched. No payload — funnel entry.
   *
   * [RENAME-CYCLE 2026-04-18 → retire 2026-05-18] Fires alongside
   * `ai_voice_log_started` — prefix asymmetry vs `ai_photo_log_*`
   * (both are Pro AI surfaces). See plan doc §4. */
  voice_log_started: "voice_log_started",
  /** User tapped "Log all" on the voice-log review sheet (Batch 5.13).
   * Payload: `{ itemCount, avgConfidence }` — avgConfidence is the mean
   * of the committed items' confidence values, 0–1.
   *
   * [RENAME-CYCLE 2026-04-18 → retire 2026-05-18] Fires alongside
   * `ai_voice_log_committed`. */
  voice_log_committed: "voice_log_committed",
  /** Free-tier user tapped the voice-log entry point and was shown the
   * Pro paywall instead (Batch 5.13). No payload. Separate event from
   * `paywall_viewed` so we can measure conversion per feature.
   *
   * [RENAME-CYCLE 2026-04-18 → retire 2026-05-18] Fires alongside
   * `ai_voice_log_paywalled`. */
  voice_log_paywalled: "voice_log_paywalled",
  /** Canonical voice-log-started event (rename target — prefix
   *  symmetry with `ai_photo_log_started`). Same payload shape. Retire
   *  old name 2026-05-18. */
  ai_voice_log_started: "ai_voice_log_started",
  /** Canonical voice-log-committed event (rename target for
   *  `voice_log_committed`). Same payload shape. Retire 2026-05-18. */
  ai_voice_log_committed: "ai_voice_log_committed",
  /** Canonical voice-log-paywalled event (rename target for
   *  `voice_log_paywalled`). Same payload shape. Retire 2026-05-18. */
  ai_voice_log_paywalled: "ai_voice_log_paywalled",
  /** User opened the AI photo-log modal (Batch 5.13). No payload. */
  ai_photo_log_started: "ai_photo_log_started",
  /** 2026-05-08 build-45 follow-up — user tapped "Snap the label
   * instead" on a not-found barcode and the AI label-extraction
   * succeeded; correction form is now pre-filled. Payload:
   * `{ confidence: "high"|"medium"|"low"|"unknown", platform }`. */
  barcode_scan_label_succeeded: "barcode_scan_label_succeeded",
  /** User tapped "Log all" on the photo-log review sheet (Batch 5.13).
   * Payload: `{ itemCount, avgConfidence }`. */
  ai_photo_log_committed: "ai_photo_log_committed",
  /** Free-tier user tapped the photo-log entry point and was shown the
   * Pro paywall instead (Batch 5.13). No payload. */
  ai_photo_log_paywalled: "ai_photo_log_paywalled",
  /** Range-first photo-log re-architecture (2026-05-01) — user tapped
   * an "Add wine: +120-150 kcal" addon chip on the review screen and
   * the suggested item moved into the items list. Payload:
   * `{ name: string; kcalLow: number; kcalHigh: number }`. Identical
   * payload on web + mobile so the addon-acceptance rate funnel
   * compares 1:1. See `docs/decisions/2026-05-01-photo-log-rangefirst.md`. */
  ai_photo_log_addon_added: "ai_photo_log_addon_added",
  /** Range-first photo-log re-architecture (2026-05-01) — user tapped
   * "Verify with database" on a single item, swapping the AI-estimated
   * range row for a USDA / OFF / FatSecret-matched single-number row.
   * Payload: `{ source: "USDA" | "OFF" | "FatSecret" | "Estimated" |
   * "Unverified"; confidence: number; itemName: string }`. Fires per
   * verification, not per item-load. Identical payload on web + mobile. */
  ai_photo_log_item_verified: "ai_photo_log_item_verified",
  /** User-sentiment audit (round 4, 2026-04-30) — Cal AI's failure
   * pattern, MacroFactor's emerging lead. Fires when a corrected
   * photo-log item is persisted into the user's `user_custom_foods`
   * bank so the next photo-log of the same item uses the corrected
   * macros. Distinct from `ai_photo_log_committed`, which fires for
   * every commit (including accept-as-is). Payload:
   * `{ foodName, kind: "insert" | "update" | "skipped_manual" }`.
   * Identical payload on both platforms (web `PhotoLogDialog` +
   * mobile `PhotoLogSheet`) so the conversion funnel stays comparable. */
  photo_log_correction_persisted: "photo_log_correction_persisted",
  /** User tapped the "Snap a meal" shortcut surfaced on Today
   * (audit 2026-04-30 — Lose It "Closer" parity). Fires regardless of
   * tier so we can measure how often the shortcut is the entry point
   * vs the LogSheet's right-edge camera icon. Payload:
   * `{ tier: "free" | "base" | "pro" }`. The downstream Pro gate
   * still emits `ai_photo_log_paywalled` (free/base) or
   * `ai_photo_log_started` (pro) so the funnel stays comparable
   * with the LogSheet entry point. Identical payload on web + mobile. */
  today_snap_shortcut_tapped: "today_snap_shortcut_tapped",
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
  /** Onboarding v2 pace step — the soft-warn safety-floor banner
   *  surfaced to the user (`acted: "shown"`) or the user advanced
   *  despite it (`acted: "advanced"`).
   *
   *  Auditable trail for the soft-warn policy locked in
   *  `docs/decisions/2026-04-19-onboarding-redesign-scope.md`. Lets
   *  product see how often the danger banner fires and what % of
   *  users advance through it — if advance-rate is alarmingly high
   *  we revisit the soft-warn-vs-hard-block call without guessing.
   *
   *  Payload:
   *    { acted: "shown" | "advanced",
   *      level: "info" | "warn" | "danger",
   *      reason: "below_floor" | "fast_loss" | "near_floor",
   *      pace_kg_per_week: number,
   *      projected_target_kcal: number,
   *      sex: "male" | "female" | "unspecified" } */
  onboarding_pace_below_safety_floor: "onboarding_pace_below_safety_floor",
  /** Build-40 (2026-05-01) — user actioned a card on the data-bridges
   *  step (manual targets / Apple Health / notifications / recipe URL).
   *  Multiple cards can fire — this event lets analytics measure
   *  per-bridge adoption, while `onboarding_completed.data_bridge_chosen`
   *  carries the LAST card actioned for funnel slicing.
   *
   *  Payload:
   *    { option: "manual" | "apple-health" | "notifications" | "recipe",
   *      url_provided?: boolean   // recipe option only
   *    }
   *  Registered alongside the data-bridges step re-introduction; the
   *  customer-lens audit (2026-05-01) found three competitor-refugee
   *  personas bouncing day-1 because no path existed to bring their
   *  data with them. */
  onboarding_data_bridge_chosen: "onboarding_data_bridge_chosen",
  /** Build-40 (2026-05-01) — user explicitly tapped "Maybe later" on
   *  the data-bridges step. Distinct from never-touched (which fires
   *  `data_bridge_chosen: null` on `onboarding_completed`). Payload:
   *    { reason: "card_tap" } */
  onboarding_data_bridge_skipped: "onboarding_data_bridge_skipped",
  /** 2026-05-02 — user picked an MFP CSV file in the importer card.
   *  Closes the MFP-refugee history-bridge gap (P1 customer-lens).
   *  Fires once per file pick on both web and mobile.
   *  Payload:
   *    {
   *      surface: "onboarding" | "settings",
   *      platform: "web" | "ios"
   *    }
   *  See `docs/decisions/2026-05-02-mfp-csv-import.md`. */
  mfp_csv_import_started: "mfp_csv_import_started",
  /** 2026-05-02 — MFP CSV import finished successfully (HTTP 200 with
   *  `ok: true`). Identical payload on web + mobile so funnels read the
   *  same.
   *  Payload:
   *    {
   *      imported: number,    // rows that landed
   *      unmatched: number,   // rows skipped (e.g. missing calories)
   *      truncated: boolean,  // true when input had >1000 rows
   *      surface: "onboarding" | "settings",
   *      platform: "web" | "ios"
   *    } */
  mfp_csv_import_completed: "mfp_csv_import_completed",
  /** 2026-05-02 — MFP CSV import failed (HTTP non-2xx, network drop, or
   *  client-side picker error). Payload:
   *    {
   *      error: string,        // route error code or "fetch_failed"
   *      status: number,       // HTTP status; 0 for network/client errors
   *      surface: "onboarding" | "settings",
   *      platform: "web" | "ios"
   *    } */
  mfp_csv_import_failed: "mfp_csv_import_failed",
  /** User created a new account (email+password or Apple SSO) on web.
   * Fires once, after Supabase `signUp` / `signInWithOAuth` succeeds.
   * Payload: `{ method: "email" | "apple" }`.
   * `posthog.identify()` is called at the same callsite so anonymous
   * pre-signup events are stitched to the new Supabase user ID. */
  user_signed_up: "user_signed_up",
  /** User signed in to an existing account on web.
   * Fires after Supabase `signInWithPassword` / `signInWithOtp`
   * (magic-link) / `signInWithOAuth` succeeds.
   * Payload: `{ method: "email" | "magic_link" | "apple" }`.
   * `posthog.identify()` is called at the same callsite. */
  user_signed_in: "user_signed_in",
  /** Upgrade dialog (web `UpgradePaywallDialog`) rendered a tier-specific
   *  variant. Fires alongside `paywall_viewed` — does not replace it.
   *  Added 2026-04-21 per D12 dynamic-upsell decision
   *  (`docs/decisions/2026-04-21-upgrade-dialog-dynamic-upsell.md` §5).
   *  StrictMode-guarded via `viewedForOpenRef`.
   *  Payload:
   *    { variant: "free_to_base" | "base_to_pro",
   *      from: PaywallViewedFrom,
   *      surface: "upgrade_dialog",
   *      platform: "web",
   *      user_tier: "free" | "base" } */
  upsell_variant_shown: "upsell_variant_shown",
  /** User tapped the primary CTA on the dynamic upgrade dialog and
   *  checkout navigation began. Fires alongside `checkout_started`.
   *  Added 2026-04-21 per D12.
   *  Payload:
   *    { variant, from, target_tier: "base" | "pro",
   *      period: "monthly" | "annual", surface: "upgrade_dialog",
   *      platform: "web", user_tier: "free" | "base" } */
  upsell_variant_converted: "upsell_variant_converted",
  /** User dismissed the dynamic upgrade dialog via secondary CTA,
   *  close button, or backdrop/escape. Fires alongside
   *  `paywall_dismissed`. Added 2026-04-21 per D12.
   *  Payload:
   *    { variant, from,
   *      reason: "secondary_cta" | "close_button" | "backdrop",
   *      surface: "upgrade_dialog", platform: "web",
   *      user_tier: "free" | "base" } */
  upsell_variant_dismissed: "upsell_variant_dismissed",
  /** Create flow: bulk-pasted ingredient lines matched via `POST /api/nutrition/verify-recipe`
   * (web `RecipeUpload` or mobile `create-recipe`). Payload:
   * `{ lineCount, platform: "web" | "ios" | "android", avgConfidence?: number }`. */
  recipe_create_paste_list_matched: "recipe_create_paste_list_matched",
  /** Create flow: recipe photo OCR on create surface (`POST /api/recipe-import/image`).
   * Payload: `{ ingredientCount, platform: "web" | "ios" | "android", hasServerNutrition: boolean }`.
   * Complements `recipe_imported { source: "image" }` on import funnel — this is create UX attribution. */
  recipe_create_photo_extracted: "recipe_create_photo_extracted",
  /** Recipe detail / create: verify result had low average or minimum line confidence (mobile + web).
   * Payload: `{ recipe_id?: string, source: "auto_verify" | "re_verified" | "create_paste" | "add_ingredient_match",
   *   platform?: "web" | "ios" | "android", avgIngredientConfidence?, minIngredientConfidence? }`.
   * `recipe_id` omitted on create paste; set on recipe detail / verify flows when the recipe exists. */
  recipe_verify_needs_review: "recipe_verify_needs_review",
  /** Mobile create-recipe wizard: a step transition (Continue tap or Back tap).
   * Payload: `{ from: stepId, to: stepId, direction: "next" | "back",
   * platform: "ios" | "android" | "web" }`. Funnel-builder for "where do
   * users drop out of the wizard" — pairs with `recipe_create_wizard_saved`
   * to compute step-level abandonment. */
  recipe_create_wizard_step: "recipe_create_wizard_step",
  /** Mobile create-recipe wizard: terminal save tap. Payload:
   * `{ recipe_id, published: boolean, ingredient_count: number,
   * step_count: number, has_macro_overrides: boolean,
   * platform: "ios" | "android" | "web" }`. */
  recipe_create_wizard_saved: "recipe_create_wizard_saved",
  /** "Export everything" data dump initiated by the user from
   *  Settings. Fires server-side from `/api/export/me` after the
   *  full payload has been assembled (so `sizeBytes` is real).
   *  Payload: `{ sizeBytes: number, recipeCount: number,
   *  mealLogCount: number, weightCount: number, customFoodCount:
   *  number, planCount: number, shoppingCount: number,
   *  schemaVersion: number, platform: "web" | "ios" }`.
   *  Counters lock-in anxiety per user-sentiment audit
   *  (2026-04-30) — visible export in Settings exceeds the GDPR
   *  portability floor and is the moat-builder we attribute on. */
  data_export_initiated: "data_export_initiated",
  /** 30-day logging milestone moment rendered on Today (PR
   * claude/today-30-day-milestone, 2026-05-02). Fires once per user —
   * gated by `profiles.milestone_30_shown_at`. Pure trust moment, no
   * paywall, no upsell. Payload:
   *   - `daysLogged`: number — distinct logged days at show time (≥30).
   *   - `longestStreak`: number — all-time longest consecutive streak.
   *   - `topFoodCount`: number — number of "top foods" surfaced (0–3).
   *   - `platform`: "web" | "ios" | "android". */
  milestone_30_shown: "milestone_30_shown",
  /** User dismissed the 30-day milestone modal via the "Keep going" CTA
   * or the close X. No payload beyond `platform` — there's only one
   * decision path. */
  milestone_30_dismissed: "milestone_30_dismissed",
  /** Food search returned zero hits across all enabled sources
   *  (USDA + Open Food Facts + Edamam + FatSecret + custom + generic
   *  fallback). Fires once per debounced search that completes with
   *  no rows. Used to identify dictionary gaps for backfill
   *  prioritisation; complements `food_search_request_dictionary_add`
   *  (which is the user-confirmed "we are missing this" signal).
   *
   *  Payload:
   *    { query: string,
   *      len: number,                  // query.trim().length
   *      source: "mobile" | "web" }
   *
   *  Added 2026-05-02 per competitor audit move-blocker #2 ("MFP
   *  refugees don't bounce on missing SKU"). Authority:
   *  docs/decisions/2026-04-30-audit-vs-competitors-wave2.md.
   *  Replaces stale PR #36 — rebuilt on current main. */
  food_search_no_result: "food_search_no_result",
  /** User explicitly asked us to add a missing food to the
   *  dictionary via the no-result empty-state CTA ("Tell us we're
   *  missing this"). Higher-signal than `food_search_no_result` —
   *  the user took the deliberate action vs simply hitting an empty
   *  state. Drives backfill prioritisation directly. Deduped per
   *  query so triple-tap is a single emit.
   *
   *  Payload:
   *    { query: string,
   *      len: number,
   *      source: "mobile" | "web" }
   *
   *  Added 2026-05-02 alongside `food_search_no_result`. */
  food_search_request_dictionary_add: "food_search_request_dictionary_add",
  /** Cancel-flow export prompt rendered (PR replaces #43, 2026-05-02).
   *  Closes journey-architect P1: the export prompt was buried in
   *  Settings; a user who tapped "Manage subscription" and cancelled
   *  never saw it. The Suppr-owned interstitial now surfaces between
   *  the cancel touchpoint and the RC / Stripe handoff so export is
   *  proactive, not reactive.
   *
   *  Fires once per open (host gates with a state flag — re-opening
   *  the sheet fires a fresh event).
   *
   *  Payload: `{ source: "mobile" | "web", tier: string }`.
   *  `tier` carries the user's current tier at the cancel touchpoint
   *  ("free" | "base" | "pro" | any future SKU label) so the funnel
   *  can slice export-uptake by who's actually about to leave. */
  cancel_export_prompt_shown: "cancel_export_prompt_shown",
  /** User tapped "Take your data with you" on the cancel-flow export
   *  prompt. Fires before the CSV write so it's recorded even if the
   *  share sheet / browser download fails downstream. The sheet stays
   *  open after — fires once per tap.
   *
   *  Payload: `{ source: "mobile" | "web", tier: string }`. */
  cancel_export_chosen: "cancel_export_chosen",
  /** User tapped "Continue to manage" on the cancel-flow export
   *  prompt. Fires immediately before the host routes to
   *  `presentCustomerCenter()` (mobile) / `/account/billing` (web).
   *  Distinct from `cancel_export_chosen` so the funnel can split
   *  "exported then continued" vs "continued without exporting".
   *
   *  Payload: `{ source: "mobile" | "web", tier: string }`. */
  cancel_proceeded: "cancel_proceeded",
  /** Weekly TDEE check-in ritual modal rendered on Today
   *  (PR claude/weekly-checkin-ritual-v2, 2026-05-02 — rebuild of #26).
   *  MacroFactor-style soft prompt that surfaces the adaptive-vs-formula
   *  TDEE delta and the suggested new daily target. Fires once per
   *  Today first-load when the gate (`shouldShowWeeklyCheckin`) passes.
   *  Payload:
   *    - `confidence`: "medium" | "high" — adaptive TDEE confidence at
   *      show time. Gate forbids "low" / null.
   *    - `tdeeDeltaKcal`: number | null — signed delta (adaptive − prior).
   *      `null` when the prior/formula TDEE wasn't computable.
   *    - `daysLoggedThisWeek`: number — distinct days with calories
   *      logged in the user's current week (≥5 by gate).
   *    - `platform`: "web" | "ios" | "android". */
  weekly_checkin_shown: "weekly_checkin_shown",
  /** User accepted the suggested new target from the weekly check-in
   *  modal. The "Accept new target" CTA. Persists
   *  `target_calories = suggestedTargetKcal` and `target_calories_source
   *  = "digest_recalibration"` (same enum value the maintenance-recal
   *  suggestion already uses, so the existing 21-day Rule 2 cooldown
   *  works correctly). Payload:
   *    - `tdeeDeltaKcal`: number | null — see shown event.
   *    - `previousTargetKcal`: number — calorie target before accept.
   *    - `suggestedTargetKcal`: number — calorie target after accept.
   *    - `platform`: "web" | "ios" | "android". */
  weekly_checkin_accepted: "weekly_checkin_accepted",
  /** User kept their current target — fires from the "Keep current" CTA,
   *  the close X, the backdrop tap, and Escape. Persists
   *  `last_weekly_checkin_decision = "kept_current"` so we can later
   *  attribute decisions without re-deriving from analytics. Payload:
   *    - `reason`: "kept_current" — reserved field for future
   *      swipe/backdrop dismiss UX (today the modal only emits
   *      `kept_current`).
   *    - `platform`: "web" | "ios" | "android". */
  weekly_checkin_dismissed: "weekly_checkin_dismissed",
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

/** Canonical `from` enum for `paywall_viewed` (L6 G9). Extended
 *  2026-04-19 to include `"meal_planner"` — the Base-gated multi-day
 *  planner now routes to `/paywall?from=meal_planner` on both web
 *  and mobile, so the funnel can attribute planner-surface conversions
 *  separately from settings / trial-end entries. Extended again
 *  2026-04-19 round 3 (analytics-engineer spec) to pin every
 *  `openUpgradePromo` call site in `src/app/App.tsx` to a distinct
 *  originating surface — the web Settings promo panel used to emit
 *  `"meal_planner"` for every trigger regardless of origin, collapsing
 *  the F2 funnel slice. The five new values (`recipes_library`,
 *  `shopping_list`, `profile`, `recipe_create`, `recipe_import`)
 *  correspond 1:1 with the child components that take `onUpgrade` so
 *  TypeScript + the `paywallAttribution` test can enforce coverage. */
export type PaywallViewedFrom =
  | "voice_log"
  | "photo_log"
  | "settings"
  | "onboarding"
  | "trial_end"
  | "deep_link"
  | "meal_planner"
  | "recipes_library"
  | "shopping_list"
  | "profile"
  | "recipe_create"
  | "recipe_import";

/** Canonical `confidence_bucket` for recipe-ingredient override events
 *  (L6 G4). Mirrors `classifyConfidence` in
 *  `src/lib/nutrition/aiLogging.ts` — do not duplicate thresholds. */
export type ConfidenceBucket = "high" | "medium" | "low";

/** Canonical `source` of a `recipe_imported` event (post-ship #1,
 *  2026-04-18 rename cycle). Collapses the legacy
 *  `recipe_import_url` / `recipe_import_image` split into one event
 *  with a `source` property. */
export type RecipeImportedSource = "url" | "image";

// -- Rename-cycle retirement (target 2026-05-18): legacy event names --------
//
// The following legacy event names are being dual-emitted alongside
// their canonical replacements during the 2026-04-18 → 2026-05-18
// rename cycle (post-ship #1). On 2026-05-18, delete the legacy
// entries from this registry AND delete every caller's dual-emit
// line. The grep-friendly marker below is what the retirement PR
// searches for.
//
// RENAME-CYCLE-RETIRE-2026-05-18:
//   - `checkout_completed_return` → `checkout_completed`
//   - `recipe_import_url` / `recipe_import_image` → `recipe_imported { source }`
//   - `cook_mode_started` → `cook_mode_first_step_advanced`
//   - `first_run_step_completed` → `onboarding_step_completed`
//   - `first_run_checklist_completed` → `onboarding_checklist_completed`
//   - `streak_freeze_earned_seen` → `streak_freeze_earned_acknowledged`
//   - `voice_log_started` → `ai_voice_log_started`
//   - `voice_log_committed` → `ai_voice_log_committed`
//   - `voice_log_paywalled` → `ai_voice_log_paywalled`
//   - `weekly_recap_push_sent` → `weekly_recap_push_scheduled`
//     (+ `weekly_recap_push_delivered` once a delivery listener lands).
//
// See `docs/planning/analytics-dashboards-plan-2026-04-18.md` §4 and
// `decisions_event_name_rename_cycle_2026_04_18.md` in product-memory
// for the full retirement checklist.
