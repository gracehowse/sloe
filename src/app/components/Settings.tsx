"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Icons } from "./ui/icons";
import { Switch } from "./ui/switch";
import { SettingsSegmented } from "./ui/settings-segmented";
import { toast } from "sonner";
import { STORAGE_KEY } from "../../context/appData/persistence.ts";
import { useAppData } from "../../context/AppDataContext.tsx";
import { supabase } from "../../lib/supabase/browserClient.ts";
import {
  DIETARY_PREFERENCE_ENTRIES,
  normaliseDietaryFromProfile,
} from "../../constants/dietaryPreferences.ts";
// Legacy local-only export helpers (`buildLocalDataExport`,
// `downloadJsonFile`) were retired 2026-04-30 when the JSON export
// moved to the server-authoritative `/api/export/me` endpoint. The
// CSV path below still uses its own helpers from
// `nutritionLogToCsv` because CSV is a curated subset (the meal log
// only) — the full JSON dump is the canonical "Export everything"
// surface.
// G-6 (2026-04-19, TestFlight `AC4oDEnQ0SuPruUtCr_Lvyc`) — CSV path
// replaces JSON as the primary export for regular users. JSON stays as
// a secondary "full backup" option. Shared helper so web + mobile emit
// identical bytes (pin: `tests/unit/nutritionLogToCsv.test.ts`).
import {
  nutritionLogToCsv,
  nutritionLogCsvFilename,
} from "../../lib/export/nutritionLogToCsv.ts";
import { normalizeWeekSummaryMode } from "../../lib/nutrition/weekSummaryWindow.ts";
import type { WeightSurfaceMode } from "../../lib/nutrition/weightSurfaceMode.ts";
import { saveWeekStartDay } from "../../lib/nutrition/weekStartDayClient.ts";
import type { NotificationPrefs } from "../../types/notifications.ts";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { track, isFeatureEnabled } from "../../lib/analytics/track.ts";
import { DestructiveConfirmDialog } from "./suppr/destructive-confirm-dialog";
import { ActivityLevelPickerDialog } from "./suppr/activity-level-picker-dialog";
import { CancelExportPromptDialog } from "./suppr/cancel-export-prompt-dialog";
import {
  ACTIVITY_SHORT_LABELS,
  type ActivityLevel,
  type NutritionStrategy,
  type PlanPace,
  type Sex,
} from "../../lib/nutrition/tdee.ts";
import { recomputeTargetsForActivity } from "../../lib/nutrition/recomputeTargetsForActivity.ts";
import { backfillDailyTargetsFromProfile } from "../../lib/nutrition/dailyTargetSnapshot.ts";
import { recordGoalHistory } from "../../lib/nutrition/goalHistory.ts";
import { nukeAllUserAppData } from "../../lib/account/nukeAccountData.ts";
import { saveDisplayName } from "../../lib/account/displayName.ts";
import { NUTRITION_DEFAULTS } from "../../constants/nutritionDefaults.ts";
import {
  DEFAULT_TRACKING_EXTRAS,
  TRACKING_EXTRAS_STORAGE_KEY,
  parseTrackingExtras,
  serializeTrackingExtras,
  type TrackingExtras,
} from "../../lib/nutrition/trackingExtras.ts";
import { MACRO_COLOR_VARS } from "../../lib/theme/macroColors.ts";
import { MfpCsvImportCard } from "./imports/MfpCsvImportCard";
import { SubscriptionCard } from "./settings/SubscriptionCard";
import { useMacroDisplayStyle } from "../../lib/preferences/useMacroDisplayStyle";
import type { MacroDisplayStyle } from "../../lib/preferences/macroDisplayStyle";
import { SupprCard } from "./ui/suppr-card";

const THEME_OPTIONS = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

const MACRO_DISPLAY_OPTIONS = [
  { value: "tiles", label: "Tiles (2×2)" },
  { value: "bars", label: "Bars (list)" },
] as const;

/**
 * Audit 2026-04-30 P0-3 — Dashboard widget swatches now read from the
 * canonical `--macro-*` CSS custom properties so they match the rings,
 * tiles, and charts everywhere else on the surface (and dark-mode flips
 * happen for free). Hex literals below were drift; the source of truth
 * is `src/styles/theme.css` mirrored in `src/lib/theme/macroColors.ts`.
 */
const WIDGET_MACRO_OPTIONS = [
  { key: "protein", label: "Protein", color: MACRO_COLOR_VARS.protein },
  { key: "carbs", label: "Carbs", color: MACRO_COLOR_VARS.carbs },
  { key: "fat", label: "Fat", color: MACRO_COLOR_VARS.fat },
  { key: "fiber", label: "Fiber", color: MACRO_COLOR_VARS.fiber },
  { key: "sugar", label: "Sugar", color: MACRO_COLOR_VARS.sugar },
  { key: "sodium", label: "Sodium", color: MACRO_COLOR_VARS.sodium },
  { key: "water", label: "Water", color: MACRO_COLOR_VARS.water },
] as const;

/** Human-readable labels for notification toggle keys, matching mobile. */
const NOTIFICATION_LABELS: Record<string, string> = {
  showMealTimestamps: "Show meal timestamps",
  newRecipes: "New recipes from people you follow",
  mealReminders: "Meal plan ready",
  weeklyReport: "Weekly summary",
  creatorUpdates: "Your recipe publish updates",
};

interface SettingsProps {
  userTier: "free" | "base" | "pro";
  authEmail?: string | null;
  /** When true (e.g. user tapped header Upgrade), scroll promo into view once */
  scrollToPromoOnOpen?: boolean;
  onScrollToPromoConsumed?: () => void;
}

const LOCAL_CLEAR_KEYS = [
  STORAGE_KEY,
  "suppr-profile-v2",
  "suppr-collections-v1",
  "suppr-recent-foods-v1",
];

export const Settings = memo(function Settings({ userTier, authEmail, scrollToPromoOnOpen, onScrollToPromoConsumed }: SettingsProps) {
  const {
    signOut,
    profileDisplayName,
    redeemPromoCode,
    notificationPrefs,
    setNotificationPrefs,
    preferActivityAdjustedCalories,
    setPreferActivityAdjustedCalories,
    netCarbsLensEnabled,
    setNetCarbsLensEnabled,
    targetCaffeineMg,
    setTargetCaffeineMg,
    targetAlcoholGWeekly,
    setTargetAlcoholGWeekly,
    profileWeightSurfaceMode,
    setProfileWeightSurfaceMode,
  } = useAppData();
  const { theme, setTheme } = useTheme();
  // Macro display style — `tiles` (default) vs `bars` (Cronometer/Lose
  // It-style list). Pref persisted via localStorage on web; mobile
  // mirrors via AsyncStorage (`apps/mobile/lib/macroDisplayStyle.ts`).
  // Grace ask 2026-05-17.
  const [macroDisplayStyle, setMacroDisplayStyle] = useMacroDisplayStyle();
  const promoSectionRef = useRef<HTMLDivElement>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoSubmitting, setPromoSubmitting] = useState(false);
  // Themed destructive-confirm dialogs (audit M7, 2026-04-18). Replaces
  // three `window.confirm` calls with `DestructiveConfirmDialog`.
  // `accountDeletionStage`: "idle" -> "first" (initial warning) ->
  // "second" (type-nothing final confirm) -> "idle". Two stages mirror
  // the pre-M7 double-confirm UX so a stray click can't drop the
  // account.
  const [clearLocalOpen, setClearLocalOpen] = useState(false);
  const [accountDeletionStage, setAccountDeletionStage] = useState<
    "idle" | "first" | "second"
  >("idle");
  // 2026-04-30 (#15): Reset/Erase parity with mobile. Two destructive
  // actions kept distinct from the account deletion below: "Reset
  // targets" is inline (set defaults, stay in app), "Erase everything"
  // wipes server data + sends the user through onboarding again.
  // Mobile equivalent in `apps/mobile/components/settings/SettingsBundleContent.tsx`.
  const [eraseEverythingOpen, setEraseEverythingOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  /**
   * Cancel-flow export prompt (PR replaces #43, 2026-05-02). Closes
   * journey-architect P1 — surfaces a Suppr-owned dialog BEFORE
   * routing to the Stripe billing portal so the export option is
   * proactive, not buried in Settings. Two equal-weight cards: "Take
   * your data with you" runs the existing CSV download; "Continue to
   * manage" navigates to /account/billing. The dialog stays open
   * after the export CTA fires so the user can still continue or
   * dismiss. Mobile parity at
   * `apps/mobile/components/settings/SettingsBundleContent.tsx`.
   */
  const [cancelPromptOpen, setCancelPromptOpen] = useState(false);
  const [cancelPromptExporting, setCancelPromptExporting] = useState(false);

  useEffect(() => {
    if (!scrollToPromoOnOpen) return;
    const id = requestAnimationFrame(() => {
      promoSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      onScrollToPromoConsumed?.();
    });
    return () => cancelAnimationFrame(id);
  }, [scrollToPromoOnOpen, onScrollToPromoConsumed]);
  const notifications = notificationPrefs;
  const setNotifications = setNotificationPrefs;

  const [dietary, setDietary] = useState<string[]>([]);
  const [measurementSystem, setMeasurementSystem] = useState("metric");
  const [trackedMacros, setTrackedMacros] = useState<string[]>(["protein", "carbs", "fat"]);
  const [weekStartDay, setWeekStartDay] = useState<"monday" | "sunday">("monday");
  const [caffeineInput, setCaffeineInput] = useState<string>(String(targetCaffeineMg));
  const [alcoholInput, setAlcoholInput] = useState<string>(String(targetAlcoholGWeekly));
  // Phase 2 / B1.4 (D-2026-04-27-08) — Tracking extras opt-in,
  // defaults OFF. Web parity to mobile Settings. localStorage-only
  // (no schema change). The NutritionTracker host reads this same
  // key at render time to gate the caffeine + alcohol rows.
  const [trackingExtras, setTrackingExtras] = useState<TrackingExtras>(DEFAULT_TRACKING_EXTRAS);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(TRACKING_EXTRAS_STORAGE_KEY);
      setTrackingExtras(parseTrackingExtras(raw));
    } catch {
      // localStorage unavailable — keep defaults.
    }
  }, []);
  const persistTrackingExtras = useCallback((next: TrackingExtras) => {
    setTrackingExtras(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(TRACKING_EXTRAS_STORAGE_KEY, serializeTrackingExtras(next));
    } catch {
      // Soft failure — local state already reflects the toggle.
    }
  }, []);
  // Activity-level self-edit (build 10 fix E-2, 2026-04-19 —
  // TestFlight `AIIm60n` / `AHCSYMATS`). Stored activity level + the
  // body stats the recompute needs. Null-safe so the row still renders
  // on profiles without basics (the picker surfaces the same quiet
  // fallback onboarding uses).
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [activityPickerOpen, setActivityPickerOpen] = useState(false);
  const [profileSex, setProfileSex] = useState<Sex>("unspecified");
  const [profileAge, setProfileAge] = useState<number | null>(null);
  const [profileWeightKg, setProfileWeightKg] = useState<number | null>(null);
  const [profileHeightCm, setProfileHeightCm] = useState<number | null>(null);
  const [profileGoal, setProfileGoal] = useState<string | null>(null);
  const [profilePlanPace, setProfilePlanPace] = useState<PlanPace | null>(null);
  const [profileNutritionStrategy, setProfileNutritionStrategy] =
    useState<NutritionStrategy | null>(null);
  /** Weekly recap push (Batch 4.11, H6 audit 2026-04-18).
   * Default true until hydrated from Supabase. Treated as server-owned —
   * the web has no scheduler to cancel; the mobile Progress-visit effect
   * uses the same column. */
  const [weeklyRecapPushEnabled, setWeeklyRecapPushEnabled] = useState<boolean>(true);

  // Keep inputs in sync when the context value changes (e.g. after initial load).
  useEffect(() => {
    setCaffeineInput(String(targetCaffeineMg));
  }, [targetCaffeineMg]);
  useEffect(() => {
    setAlcoholInput(String(targetAlcoholGWeekly));
  }, [targetAlcoholGWeekly]);

  // Activity-level row + picker prerequisites (build 10 fix E-2,
  // 2026-04-19). Dedicated fetch because the existing preferences
  // query is narrowly scoped and we don't want to widen it and risk
  // regressing the `weekly_recap_push_enabled` fallback.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid || cancelled) return;
      const { data } = await supabase
        .from("profiles")
        .select(
          "activity_level, sex, age, height_cm, weight_kg, goal, plan_pace, nutrition_strategy",
        )
        .eq("id", uid)
        .maybeSingle();
      if (!data || cancelled) return;
      const row = data as Record<string, unknown>;
      const al = row.activity_level;
      if (
        al === "sedentary" ||
        al === "light" ||
        al === "moderate" ||
        al === "active" ||
        al === "very_active"
      ) {
        setActivityLevel(al);
      }
      const s = row.sex;
      if (s === "male" || s === "female" || s === "unspecified") setProfileSex(s);
      const a = row.age;
      if (typeof a === "number" && Number.isFinite(a) && a > 0) setProfileAge(Math.round(a));
      const w = row.weight_kg;
      if (typeof w === "number" && Number.isFinite(w) && w > 0) setProfileWeightKg(w);
      const h = row.height_cm;
      if (typeof h === "number" && Number.isFinite(h) && h > 0) setProfileHeightCm(h);
      const g = row.goal;
      if (typeof g === "string" && g.length > 0) setProfileGoal(g);
      const pp = row.plan_pace;
      if (pp === "relaxed" || pp === "steady" || pp === "accelerated" || pp === "vigorous") {
        setProfilePlanPace(pp);
      }
      const ns = row.nutrition_strategy;
      if (ns === "balanced" || ns === "high_protein" || ns === "high_satisfaction" || ns === "low_carb") {
        setProfileNutritionStrategy(ns);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleActivityLevelConfirm = useCallback(
    async (nextLevel: ActivityLevel) => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) {
        toast.error("Sign in to change this preference.");
        return;
      }

      // Always persist the new activity level — even if basics are
      // missing we don't want to silently drop the user's choice.
      const baseUpdate: Record<string, unknown> = { activity_level: nextLevel };

      // Recompute target_calories via the same pipeline onboarding
      // saveAndFinish uses. If basics are missing we still save the
      // level change but skip the recompute (no fabricated targets).
      const recomputed =
        profileWeightKg != null && profileHeightCm != null && profileAge != null
          ? recomputeTargetsForActivity({
              sex: profileSex,
              weightKg: profileWeightKg,
              heightCm: profileHeightCm,
              age: profileAge,
              activityLevel: nextLevel,
              goal: profileGoal,
              planPace: profilePlanPace,
              nutritionStrategy: profileNutritionStrategy,
            })
          : null;

      const update = recomputed
        ? {
            ...baseUpdate,
            ...recomputed,
            // A2 provenance — activity-level recompute path. Only stamp when
            // we actually recomputed targets. (migration 20260427110000)
            target_calories_set_at: new Date().toISOString(),
            target_calories_source: "recompute" as const,
          }
        : baseUpdate;
      // `maintenanceTdee` is exposed for the toast only — not a DB column.
      const { maintenanceTdee: _maintenance, ...writeable } =
        update as typeof update & { maintenanceTdee?: number };

      // F-149 web parity (2026-05-10): when this update would change
      // target_calories (i.e. `recomputed` is non-null), backfill
      // past-day daily_targets snapshots from the user's CURRENT
      // (about-to-be-old) profile values BEFORE writing the new ones.
      // Mirrors `apps/mobile/components/recap/GoalPaceRetuneSheet.tsx`
      // — same helper, same posture: `upsert(..., { ignoreDuplicates:
      // true })` protects existing snapshots; only gaps fill. Past
      // days without logs now show the target that was effective on
      // that day, not the new one. Best-effort: backfill failure
      // doesn't block the user's settings save.
      if (recomputed) {
        try {
          const { data: oldProfile } = await supabase
            .from("profiles")
            .select(
              "target_calories, target_protein, target_carbs, target_fat, target_fiber_g, activity_level, plan_pace, goal, adaptive_tdee, adaptive_tdee_confidence, adaptive_tdee_updated_at, sex, weight_kg, height_cm, age",
            )
            .eq("id", uid)
            .maybeSingle();
          if (oldProfile) {
            await backfillDailyTargetsFromProfile(supabase as any, uid, oldProfile);
          }
        } catch {
          // Backfill never blocks the user's settings save.
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update(writeable)
        .eq("id", uid);
      if (error) {
        toast.error("Failed to save activity level.");
        return;
      }

      setActivityLevel(nextLevel);

      // F-149 (2026-05-11): record the new goal-shape into goal_history
      // so future past-day reads can find the values that were live AS
      // OF today onwards. The `backfillDailyTargetsFromProfile` call
      // above protects PAST days (with the old values); this call seals
      // TODAY-and-forward (with the new values). Fire-and-forget.
      void recordGoalHistory(
        supabase as any,
        uid,
        {
          activity_level: nextLevel,
          goal: profileGoal ?? null,
          plan_pace: profilePlanPace ?? null,
          target_calories: recomputed?.target_calories ?? null,
          target_protein_g: recomputed?.target_protein ?? null,
          target_carbs_g: recomputed?.target_carbs ?? null,
          target_fat_g: recomputed?.target_fat ?? null,
          target_fiber_g: recomputed?.target_fiber_g ?? null,
          maintenance_tdee: recomputed?.maintenanceTdee ?? null,
        },
        "settings_save",
      );

      track(AnalyticsEvents.profile_targets_saved, {
        activityAdjusted: preferActivityAdjustedCalories,
        from: "settings_activity_level_picker",
      });
      if (recomputed) {
        toast.success(
          `Activity level updated · new calorie target ${recomputed.target_calories.toLocaleString()}`,
        );
      } else {
        toast.success("Activity level updated.");
      }
    },
    [
      profileAge,
      profileGoal,
      profileHeightCm,
      profileNutritionStrategy,
      profilePlanPace,
      profileSex,
      profileWeightKg,
      preferActivityAdjustedCalories,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid || cancelled) return;
      // Fetch with `weekly_recap_push_enabled` first (migration 20260421170000);
      // fall back to the pre-4.11 column set on older environments so the
      // settings screen still loads if the migration has not yet landed.
      let resp = await supabase
        .from("profiles")
        .select(
          "dietary, measurement_system, tracked_macros, week_start_day, weekly_recap_push_enabled",
        )
        .eq("id", uid)
        .maybeSingle();
      if (resp.error) {
        resp = await supabase
          .from("profiles")
          .select("dietary, measurement_system, tracked_macros, week_start_day")
          .eq("id", uid)
          .maybeSingle();
      }
      const profile = resp.data as
        | (Record<string, unknown> & {
            dietary?: unknown;
            measurement_system?: unknown;
            tracked_macros?: unknown;
            week_start_day?: unknown;
            weekly_recap_push_enabled?: unknown;
          })
        | null;
      if (!profile || cancelled) return;
      if (profile.dietary) setDietary(normaliseDietaryFromProfile(profile.dietary));
      if (profile.measurement_system === "metric" || profile.measurement_system === "imperial") {
        setMeasurementSystem(profile.measurement_system);
      }
      if (profile.tracked_macros && Array.isArray(profile.tracked_macros) && profile.tracked_macros.length > 0) {
        setTrackedMacros(profile.tracked_macros as string[]);
      }
      if (profile.week_start_day === "monday" || profile.week_start_day === "sunday") {
        setWeekStartDay(profile.week_start_day);
      }
      // Default to true when the column is absent on older DBs — matches
      // the migration default so the UI never shows "off" misleadingly.
      if (profile.weekly_recap_push_enabled !== undefined) {
        setWeeklyRecapPushEnabled(profile.weekly_recap_push_enabled !== false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const savePref = useCallback(async (updates: Record<string, unknown>) => {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) return;
    const { error } = await supabase.from("profiles").update(updates).eq("id", uid);
    if (error) toast.error("Failed to save preference");
  }, []);

  // 2026-04-30 (#15): Reset/Erase parity with mobile
  // (`apps/mobile/components/settings/SettingsBundleContent.tsx`).
  // Reset = inline defaults + toast, no re-onboarding. Erase = full
  // server wipe + redirect to /onboarding/v2 (mirrors product-lead's
  // 2026-04-30 ratification of Option A for issue #16).
  const handleResetTargets = useCallback(async () => {
    if (resetting) return;
    setResetting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) {
        toast.error("Not signed in");
        return;
      }
      const { error } = await supabase
        .from("profiles")
        .update({
          target_calories: NUTRITION_DEFAULTS.calories,
          target_calories_set_at: new Date().toISOString(),
          target_calories_source: "reset_default",
          target_protein: NUTRITION_DEFAULTS.protein,
          target_carbs: NUTRITION_DEFAULTS.carbs,
          target_fat: NUTRITION_DEFAULTS.fat,
          target_fiber_g: NUTRITION_DEFAULTS.fiber,
          target_water_ml: NUTRITION_DEFAULTS.water,
        })
        .eq("id", uid);
      if (error) {
        toast.error(`Reset failed: ${error.message}`);
        return;
      }
      toast.success("Targets reset to defaults", {
        description:
          "Your calorie and macro goals are back to Sloe defaults.",
        action: {
          label: "Edit targets",
          onClick: () => {
            window.location.href = "/targets";
          },
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  }, [resetting]);

  const handleEraseEverything = useCallback(async () => {
    if (resetting) return;
    setResetting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) {
        toast.error("Not signed in");
        return;
      }
      const r = await nukeAllUserAppData(supabase, uid);
      if (!r.ok) {
        toast.error(`Could not erase data: ${r.message}`);
        return;
      }
      // Web has no AsyncStorage, but the equivalent localStorage
      // onboarding scratchpad must be cleared so the next session
      // doesn't pre-fill with the deleted user's answers (mirrors
      // mobile fix #14).
      try {
        window.localStorage.removeItem("suppr.onboarding-v2.state");
      } catch {
        /* non-fatal */
      }
      window.location.href = "/onboarding";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erase failed");
    } finally {
      setResetting(false);
    }
  }, [resetting]);

  const handleChangePassword = useCallback(async () => {
    if (!authEmail) { toast.error("No email on this account"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent — check your inbox.");
  }, [authEmail]);

  // "Your name" — personalises the Today greeting ("Good morning, Grace").
  // Mirrors the mobile Settings field
  // (`apps/mobile/components/settings/SettingsBundleContent.tsx`): the
  // source of truth is the Supabase auth user's `user_metadata.full_name`
  // (NOT `profiles.display_name` — that stays the Profile editor's domain,
  // and writing entitlement-adjacent profile columns risks the
  // tier-lockdown trigger). The Today greeting reads it back via
  // `firstNameFromMetadata`. An empty value clears the name so the greeting
  // falls back to the time-of-day word alone.
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  // The name as currently stored in auth metadata — drives the "no change"
  // no-op guard and re-seeds the input after a save.
  const [storedName, setStoredName] = useState("");
  const nameDirtyRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      let current = "";
      for (const key of ["full_name", "name", "first_name", "preferred_name"] as const) {
        const v = meta[key];
        if (typeof v === "string" && v.trim()) { current = v.trim(); break; }
      }
      setStoredName(current);
      if (!nameDirtyRef.current) setNameInput(current);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSaveName = useCallback(async () => {
    if (nameSaving) return;
    setNameSaving(true);
    try {
      const result = await saveDisplayName(supabase, nameInput, storedName);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      nameDirtyRef.current = false;
      setStoredName(result.value);
      setNameInput(result.value);
      if (result.changed) {
        // Refresh the in-memory session so any Today greeting reading
        // `user_metadata` re-renders without a reload. `getSession()`
        // re-emits via the auth context's onAuthStateChange listener.
        try {
          await supabase.auth.getSession();
        } catch {
          // Non-fatal — updateUser already fired USER_UPDATED.
        }
        toast.success(result.value ? "Name saved." : "Name cleared.");
      }
    } finally {
      setNameSaving(false);
    }
  }, [nameSaving, nameInput, storedName]);

  /**
   * CSV export runner — extracted 2026-05-02 (PR replaces #43) so
   * both the standalone "Export nutrition log (CSV)" button AND the
   * cancel-flow export prompt dialog's "Take your data with you" CTA
   * call the same path. Same Supabase select, same `nutritionLogToCsv`
   * bytes, same filename shape — keeps the pinned-bytes test
   * (`tests/unit/nutritionLogToCsv.test.ts`) passing for both entry
   * points. Cancel-flow callers pass `silent` so we don't double-toast.
   */
  const runCsvExport = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) {
        toast.error("Please sign in to export.");
        return;
      }
      const { data, error } = await supabase
        .from("nutrition_entries")
        .select(
          "date_key, time_label, name, recipe_title, portion_multiplier, calories, protein, carbs, fat, fiber_g, source",
        )
        .eq("user_id", uid)
        .order("date_key", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) {
        toast.error("Could not build CSV export.");
        return;
      }
      const csv = nutritionLogToCsv(data ?? []);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nutritionLogCsvFilename();
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV download started.");
    } catch {
      toast.error("Could not build CSV export.");
    }
  }, []);

  // PR-01 (audit 2026-04-28): Base tier excised from user-facing
  // surfaces. Internal `userTier === "base"` rows still exist as a
  // safety branch for any legacy Stripe webhook events; they render
  // as "Free" since the user has no active paid entitlement.
  const tierLabels: Record<string, { name: string; color: string }> = {
    free: { name: "Free", color: "bg-muted text-muted-foreground" },
    base: { name: "Free", color: "bg-muted text-muted-foreground" },
    pro: { name: "Pro", color: "bg-primary/10 text-primary" },
  };
  const currentTier = tierLabels[userTier] ?? tierLabels.free;

  // Group G IA Batch C (2026-04-29): Profile sidebar entry collapsed
  // into a header card on Settings. Avatar uses the same brand
  // gradient as Profile.tsx + mobile so the two surfaces read as one
  // paint system. /profile remains the full editor route — tap the
  // "Edit profile" affordance to drill in.
  const profileAvatarInitial = (
    profileDisplayName?.trim()?.[0] ?? authEmail?.[0] ?? "S"
  ).toUpperCase();
  const profileTierLabel = userTier === "pro" ? "Pro" : "Free";
  const profileDisplayLabel =
    profileDisplayName?.trim()?.length
      ? profileDisplayName
      : authEmail?.split("@")[0] ?? "Your profile";

  return (
    <div className="product-shell py-8">
      {/* Header.
          Audit 2026-04-30 P1-5 — Stripped the `bg-clip-text text-transparent`
          combo (no gradient was set, so the text was being clipped against
          a solid foreground for no reason). The cog icon also lost its
          `bg-primary/30` background — it stuck out against the otherwise
          neutral page chrome — and now sits on the same muted surface the
          rest of the section headings use. */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          {/* Sloe DS (Figma 09 Settings `335:2`): the header glyph sits on
              a plum-tinted plate (`--foreground-brand` at 10%), not the
              neutral grey `bg-muted` box, so the icon reads in step with
              the plum serif title rather than as orphaned grey chrome. */}
          <div
            className="p-2 rounded-xl"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--foreground-brand) 10%, transparent)",
            }}
          >
            <Icons.settings
              className="w-5 h-5"
              style={{ color: "var(--foreground-brand)" }}
            />
          </div>
          <h1 className="font-[family-name:var(--font-headline)] text-3xl font-medium tracking-tight text-foreground-brand">Settings</h1>
        </div>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Profile header card — Group G IA Batch C (2026-04-29). Replaces
          the standalone Profile sidebar entry with a tap-to-edit row at
          the top of Settings. Avatar + display name + tier pill + "Edit
          profile" link to /profile (the full editor). */}
      <SupprCard
        data-testid="settings-profile-header-card"
        padding="xl"
        radius="xl"
        className="mb-6 flex items-center gap-4"
      >
        <div
          aria-hidden
          className="w-14 h-14 rounded-full grid place-items-center text-lg font-bold text-white shrink-0"
          style={{
            background: "linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, #DF5EBC) 100%)",
            boxShadow: "0 2px 8px color-mix(in srgb, var(--primary) 25%, transparent)",
          }}
        >
          {profileAvatarInitial}
        </div>
        <div className="flex-1 min-w-0">
          {/* Sloe DS (Figma 09 Settings `335:2`): the user's name is an
              editorial identity header — it reads in the Newsreader serif
              display face (plum-ink), not sans. */}
          <p className="font-[family-name:var(--font-headline)] text-xl font-medium text-foreground-brand leading-tight truncate">
            {profileDisplayLabel}
          </p>
          {/* Plan label — Sloe DS (Figma `335:2`) shows "Free plan" /
              "Pro plan" under the name. Pro keeps the clay-tint pill (a
              reward signal); Free reads as a quiet grey label. The
              `profileTierLabel` source ("Pro" / "Free") is pinned by
              settingsProfileHeaderCardParity.test.ts. Email gets its own
              line with `truncate` so the dot-and-tld doesn't run under
              the avatar (audit 2026-04-30 visual-qa P1 #9). */}
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide mt-1 ${
            userTier === "pro"
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          }`}>
            {profileTierLabel} plan
          </span>
          {authEmail ? (
            <p className="text-xs text-muted-foreground truncate mt-1">
              {authEmail}
            </p>
          ) : null}
        </div>
        <Link
          href="/profile"
          data-testid="settings-edit-profile-link"
          className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          aria-label="Edit profile"
        >
          Edit profile
          <Icons.forward className="w-4 h-4" aria-hidden />
        </Link>
      </SupprCard>

      {/* Sloe Pro upsell banner — Sloe DS (Figma 09 Settings `335:2` /
          `335:23`). Full-width soft peach/clay-tint rounded card: sparkle
          + "Sloe Pro" (clay) on the left, "Manage" (clay) on the right.
          Mirrors the mobile banner in
          `apps/mobile/components/settings/SettingsBundleContent.tsx`. Free
          users route to /pricing (web upgrade); Pro users route to
          /account/billing (the Stripe portal shell). The detailed plan
          state + manage/cancel flow still live in the "Your plan" card +
          SubscriptionCard below — this banner is the at-a-glance entry. */}
      <Link
        href={userTier === "pro" ? "/account/billing" : "/pricing"}
        data-testid="settings-sloe-pro-banner"
        aria-label={userTier === "pro" ? "Manage your Sloe Pro subscription" : "Get Sloe Pro"}
        className="mb-6 flex items-center justify-between rounded-[var(--radius-card-lg)] px-4 py-4 transition-colors"
        style={{
          backgroundColor: "color-mix(in srgb, var(--primary) 16%, transparent)",
        }}
      >
        <span className="flex items-center gap-2.5">
          <Icons.sparkles className="w-[18px] h-[18px]" style={{ color: "var(--accent-primary-solid)" }} aria-hidden />
          <span className="text-[15px] font-semibold" style={{ color: "var(--accent-primary-solid)" }}>
            Sloe Pro
          </span>
        </span>
        <span className="text-sm font-semibold" style={{ color: "var(--accent-primary-solid)" }}>
          Manage
        </span>
      </Link>

      {/* Current plan */}
      <SupprCard padding="lg" radius="xl" className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Icons.sparkles className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-[family-name:var(--font-headline)] text-xl font-medium text-foreground-brand">Your plan</h3>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${currentTier.color}`}>
              {currentTier.name}
            </span>
            {authEmail && (
              <span className="text-sm text-muted-foreground">{authEmail}</span>
            )}
          </div>
          {userTier === "free" && (
            <Link
              href="/pricing"
              className="text-sm font-medium text-success hover:text-success/80"
            >
              View plans
            </Link>
          )}
          {/* ENG-748 #11: the "Manage subscription" control moved into
              the dedicated SubscriptionCard below (which renders the
              full billing state + the cancel/manage CTA). Keeping a
              second manage button here would give two competing cancel
              paths; the at-a-glance "Your plan" pill stays, the action
              lives in one place. The cancel-export-prompt → portal
              flow itself is unchanged. */}
        </div>
      </SupprCard>

      {/* Personal Section — the user's identity + personal preferences
          group (name, email, display name, account actions). Renamed from
          "Account" 2026-06-04 so the group name matches the mobile
          "Personal" section in
          `apps/mobile/components/settings/SettingsBundleContent.tsx`. The
          "Your name" field is the first row here so the greeting-name
          control sits naturally among the user's personal settings rather
          than as a lone card. */}
      <SupprCard padding="lg" radius="xl" className="mb-6">
        <div className="flex items-center gap-2 mb-6">
          <Icons.user className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-[family-name:var(--font-headline)] text-xl font-medium text-foreground-brand">Personal</h3>
        </div>
        <div className="space-y-4">
          {/* Your name — personalises the Today greeting. Writes the auth
              user's `user_metadata.full_name` via `supabase.auth.updateUser`;
              Today reads it back through `firstNameFromMetadata`. Empty
              clears the name → greeting falls back to "Good morning". Mobile
              mirror in `apps/mobile/components/settings/SettingsBundleContent.tsx`. */}
          <div>
            <label
              htmlFor="settings-name-input"
              className="block mb-2 text-sm font-medium text-foreground"
            >
              Your name
            </label>
            <div className="flex gap-3">
              {/* PostHog session replay masks ALL inputs at capture on web
                  (`maskAllInputs: true` in AnalyticsProvider) — same posture
                  as the email / display-name inputs below, no per-field prop
                  needed. */}
              <input
                id="settings-name-input"
                data-testid="settings-name-input"
                type="text"
                value={nameInput}
                onChange={(e) => {
                  nameDirtyRef.current = true;
                  setNameInput(e.target.value);
                }}
                onBlur={() => void handleSaveName()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleSaveName();
                  }
                }}
                placeholder="Your name"
                autoComplete="name"
                className="flex-1 px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="button"
                data-testid="settings-name-save"
                onClick={() => void handleSaveName()}
                disabled={nameSaving || nameInput.trim() === storedName}
                className="px-5 py-3 bg-primary text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {nameSaving ? "Saving…" : "Save"}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Used to greet you on Today (&ldquo;Good morning,{" "}
              {nameInput.trim().split(/\s+/)[0] || "Grace"}&rdquo;). Leave blank
              to keep it name-free.
            </p>
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              value={authEmail ?? ""}
              readOnly
              className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium text-foreground">Display Name</label>
            <input
              type="text"
              value={profileDisplayName ?? ""}
              readOnly
              className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void handleChangePassword()}
              className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-all text-sm font-medium"
            >
              Change Password
            </button>
            <button
              type="button"
              onClick={signOut}
              className="ml-auto px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg transition-all text-sm font-semibold border border-destructive/30"
            >
              Sign out
            </button>
          </div>
        </div>
      </SupprCard>

      {/* Preferences */}
      <SupprCard padding="lg" radius="xl" className="mb-6">
        <div className="flex items-center gap-2 mb-6">
          <Icons.settings className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-[family-name:var(--font-headline)] text-xl font-medium text-foreground-brand">Preferences</h3>
        </div>
        <div className="space-y-6">
          {/* Measurement system — P1-7 (audit 2026-04-30) consolidated
              into the SettingsSegmented primitive. */}
          <div>
            <label className="block mb-3 text-sm font-medium text-foreground">Measurement System</label>
            <SettingsSegmented<"metric" | "imperial">
              ariaLabel="Measurement system"
              value={measurementSystem === "imperial" ? "imperial" : "metric"}
              onChange={(next) => {
                setMeasurementSystem(next);
                void savePref({ measurement_system: next });
              }}
              options={[
                { value: "metric", label: "Metric (g, kg, ml)" },
                { value: "imperial", label: "Imperial (oz, lb, cups)" },
              ]}
            />
          </div>
          {/*
            T13 (2026-04-24) — Digest + Progress + weight-chart opt-out.
            Closes DI-P0-03: users can soften how weight surfaces without
            abandoning progress tracking. "Show numbers" is the legacy
            default so existing users see no change until they opt in.
          */}
          <div>
            <label className="block mb-2 text-sm font-medium text-foreground">
              How weight shows up
            </label>
            <p className="text-xs text-muted-foreground mb-3 max-w-xl">
              Soften how weight appears on the Digest, Progress, and weight chart. We still save the data you log — this only changes what you see.
            </p>
            {/* P1-7 (audit 2026-04-30) — three-up segmented surface
                consolidated into SettingsSegmented (grid-3 layout). */}
            <SettingsSegmented<WeightSurfaceMode>
              ariaLabel="How weight shows up"
              layout="grid-3"
              testId="weight-surface-mode-picker"
              value={profileWeightSurfaceMode}
              onChange={(next) => {
                setProfileWeightSurfaceMode(next);
                void savePref({ weight_surface_mode: next });
              }}
              options={[
                {
                  value: "show",
                  label: "Show numbers",
                  hint: "±kg, chart, weigh-ins",
                  testId: "weight-surface-mode-show",
                },
                {
                  value: "trends_only",
                  label: "Trends only",
                  hint: "direction, no kg",
                  testId: "weight-surface-mode-trends_only",
                },
                {
                  value: "hide",
                  label: "Hide",
                  hint: "swap for logging stat",
                  testId: "weight-surface-mode-hide",
                },
              ]}
            />
          </div>
          <div>
            <label className="block mb-3 text-sm font-medium text-foreground">Deficit summary</label>
            <p className="text-xs text-muted-foreground mb-3 max-w-xl">
              On the nutrition tracker, when you expand your calorie ring: show averages for the last seven days ending on the day you view, or for the current calendar week (Monday–Sunday).
            </p>
            {/* P1-7 (audit 2026-04-30) — burn-deficit window picker
                migrated to SettingsSegmented. Imperative labels stay
                in lockstep with mobile settings. */}
            <SettingsSegmented<"rolling" | "calendar_week">
              ariaLabel="Deficit summary window"
              value={normalizeWeekSummaryMode(notifications.weekSummaryMode) === "calendar_week" ? "calendar_week" : "rolling"}
              onChange={(next) => setNotifications({ ...notifications, weekSummaryMode: next })}
              options={[
                { value: "rolling", label: "Last 7 days" },
                { value: "calendar_week", label: "Mon–Sun" },
              ]}
            />
          </div>
          {/* Activity level self-edit (build 10 fix E-2, 2026-04-19 —
              TestFlight `AIIm60n` / `AHCSYMATS`). Opens a picker with a
              live maintenance preview and writes `activity_level` +
              recomputed `target_calories` via the same pipeline
              onboarding saveAndFinish uses. */}
          <button
            type="button"
            onClick={() => setActivityPickerOpen(true)}
            data-testid="settings-activity-level-row"
            className="w-full flex items-center justify-between gap-4 text-left hover:bg-muted/30 -mx-2 px-2 py-2 rounded-lg transition-colors"
          >
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-foreground">
                Activity level
              </span>
              <span className="block text-xs text-muted-foreground mt-1">
                {/* Audit 2026-04-30 round-2 fix #3 — plain-English
                    label in lockstep with mobile settings. */}
                How active you are on a typical day.
              </span>
            </div>
            <span
              className="text-sm font-medium text-foreground shrink-0"
              data-testid="settings-activity-level-value"
            >
              {activityLevel ? ACTIVITY_SHORT_LABELS[activityLevel] : "Not set"}
            </span>
            <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
          </button>

          {/* Activity toggle.
              P1-8 (audit 2026-04-30) — switched from the inline
              peer-checked CSS variant to the shadcn `Switch` primitive
              so all toggles in Settings render identically (and the
              tracking-extras + weekly-recap rows already use it). */}
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <label
                htmlFor="prefer-activity-adjusted-toggle"
                className="block text-sm font-medium text-foreground cursor-pointer"
              >
                Adjust goal for activity
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                Adds bonus calories when you burn more than your estimated maintenance
              </p>
            </div>
            <Switch
              id="prefer-activity-adjusted-toggle"
              aria-label="Adjust goal for activity"
              checked={preferActivityAdjustedCalories}
              onCheckedChange={(next) => {
                const v = !!next;
                setPreferActivityAdjustedCalories(v);
                void savePref({ prefer_activity_adjusted_calories: v });
              }}
            />
          </div>

          {/* P3-30 (2026-04-25): Net-carbs lens toggle. Backed by
              `profiles.net_carbs_lens_enabled`. Surfaces that show
              carbs (Tracker macro tile, Recipe Detail nutrition row)
              swap "Carbs" → "Net carbs" with the value computed via
              `netCarbsForRow(carbs, fibre, true)`. Helpers refuse the
              "Net carbs" label when fibre is unknown so the user
              never sees a misleading headline. */}
          {/* Net carbs lens.
              P1-8 (audit 2026-04-30) — same shadcn migration as
              the Activity toggle above. The `data-testid` was renamed
              from the input element to the Switch root. */}
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <label
                htmlFor="net-carbs-lens-toggle"
                className="block text-sm font-medium text-foreground cursor-pointer"
              >
                Show net carbs
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                Display "Net carbs" (carbs &minus; fibre) on the Tracker and recipe pages. Useful for keto / low-carb tracking.
              </p>
            </div>
            <Switch
              id="net-carbs-lens-toggle"
              aria-label="Show net carbs"
              data-testid="settings-net-carbs-lens-toggle"
              checked={netCarbsLensEnabled}
              onCheckedChange={(next) => {
                const v = !!next;
                setNetCarbsLensEnabled(v);
                void savePref({ net_carbs_lens_enabled: v });
              }}
            />
          </div>

          {/* Theme picker.
              P1-7 (audit 2026-04-30) — migrated to SettingsSegmented
              for visual consistency with the rest of the Preferences
              card. */}
          <div>
            <label className="block mb-3 text-sm font-medium text-foreground">Theme</label>
            <SettingsSegmented<"system" | "light" | "dark">
              ariaLabel="Theme"
              value={theme === "light" || theme === "dark" ? theme : "system"}
              onChange={(next) => setTheme(next)}
              options={THEME_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
            />
          </div>

          {/* Macro display style — Tiles vs Bars. Grace ask 2026-05-17:
              the existing 2×2 emoji tiles plus a Cronometer/Lose
              It-style vertical bar list as a user-configurable
              alternative. Pref persists via localStorage on web; mobile
              mirrors via AsyncStorage so the value reads identically
              across surfaces when cross-device sync lands. */}
          <div>
            <label
              htmlFor="settings-macro-display"
              className="block mb-3 text-sm font-medium text-foreground"
            >
              Macro display
            </label>
            <SettingsSegmented<MacroDisplayStyle>
              ariaLabel="Macro display"
              value={macroDisplayStyle}
              onChange={(next) => setMacroDisplayStyle(next)}
              options={MACRO_DISPLAY_OPTIONS.map((opt) => ({
                value: opt.value,
                label: opt.label,
              }))}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Tiles (recommended) — four compact squares below the ring. Bars —
              one full-width list; better only if you track many extras
              (sugar, sodium, water).
            </p>
          </div>

          {/* Week start picker.
              P1-7 (audit 2026-04-30) — migrated to SettingsSegmented.
              The existing analytics + roundtrip flow is preserved
              (saveWeekStartDay locks the SQL shape pinned by tests). */}
          <div>
            <label className="block mb-3 text-sm font-medium text-foreground">Week starts on</label>
            <SettingsSegmented<"monday" | "sunday">
              ariaLabel="Week starts on"
              value={weekStartDay}
              onChange={(day) => {
                // Only fire analytics on an actual change — hydration
                // from Supabase and no-op re-taps must stay silent.
                if (day === weekStartDay) return;
                const previous = weekStartDay;
                setWeekStartDay(day);
                // Route through the shared helper so the exact
                // `profiles.update({ week_start_day }).eq("id", uid)`
                // shape is locked in by unit tests (G8, M11 audit)
                // and stays in sync with mobile.
                void (async () => {
                  const { data: session } = await supabase.auth.getSession();
                  const uid = session.session?.user.id;
                  if (!uid) return;
                  try {
                    await saveWeekStartDay(supabase, uid, day);
                  } catch {
                    toast.error("Failed to save preference");
                    setWeekStartDay(previous);
                    return;
                  }
                  track(AnalyticsEvents.week_start_day_changed, {
                    from: previous,
                    to: day,
                  });
                })();
              }}
              options={[
                { value: "monday", label: "Monday" },
                { value: "sunday", label: "Sunday" },
              ]}
            />
          </div>

          {/* Phase 2 / B1.4 (D-2026-04-27-08) — Tracking extras
              opt-in. Caffeine + alcohol Today widgets default OFF.
              Toggling on surfaces the corresponding row in the
              hydration card on Today and preserves any historical
              data unchanged. */}
          <div>
            <label className="block mb-1 text-sm font-medium text-foreground">Tracking extras</label>
            <p className="text-xs text-muted-foreground mb-3">
              Off by default. Hydration stays on regardless. When off, your existing logs are preserved but the row is hidden on Today.
            </p>
            {/* Audit 2026-04-30 round-2 fix #3 — each toggle now
                carries a one-line helper so the user knows what
                enabling it does. Mirror of mobile settings. */}
            {/* Nested list-card inside the Preferences card. ENG-823: when soft
                elevation is on, the parent card already carries the ambient
                shadow — this inner group keeps only its border (no shadow-on-
                shadow). Flag OFF → today's `card-elevated`. */}
            <div className="rounded-xl bg-card divide-y divide-border card-slab-flat">
              <label className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-foreground">Track caffeine</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Show a caffeine row on Today. Logs in mg, off by default.
                  </span>
                </span>
                <Switch
                  checked={trackingExtras.trackCaffeine}
                  onCheckedChange={(next) => persistTrackingExtras({ ...trackingExtras, trackCaffeine: !!next })}
                  aria-label="Track caffeine on Today"
                />
              </label>
              <label className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-foreground">Track alcohol</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Show an alcohol row on Today. Logs units + kcal, off by default.
                  </span>
                </span>
                <Switch
                  checked={trackingExtras.trackAlcohol}
                  onCheckedChange={(next) => persistTrackingExtras({ ...trackingExtras, trackAlcohol: !!next })}
                  aria-label="Track alcohol on Today"
                />
              </label>
            </div>
          </div>

          {/* Hydration & stimulant limits (Batch 2.5) */}
          <div>
            <label className="block mb-1 text-sm font-medium text-foreground">Hydration & stimulants</label>
            <p className="text-xs text-muted-foreground mb-3">
              Caffeine limit is the FDA guideline for healthy adults. Set alcohol to 0 to hide the row.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1" htmlFor="caffeine-target">
                  Caffeine limit (mg/day)
                </label>
                <input
                  id="caffeine-target"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={2000}
                  step={10}
                  value={caffeineInput}
                  onChange={(e) => setCaffeineInput(e.target.value)}
                  onBlur={() => {
                    const n = Math.max(0, Math.min(2000, Math.round(Number(caffeineInput))));
                    if (Number.isNaN(n)) {
                      setCaffeineInput(String(targetCaffeineMg));
                      return;
                    }
                    setCaffeineInput(String(n));
                    if (n === targetCaffeineMg) return;
                    setTargetCaffeineMg(n);
                    void savePref({ target_caffeine_mg: n });
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1" htmlFor="alcohol-target">
                  Alcohol limit (g/week, 0 = hide)
                </label>
                <input
                  id="alcohol-target"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={2000}
                  step={1}
                  value={alcoholInput}
                  onChange={(e) => setAlcoholInput(e.target.value)}
                  onBlur={() => {
                    const n = Math.max(0, Math.min(2000, Math.round(Number(alcoholInput))));
                    if (Number.isNaN(n)) {
                      setAlcoholInput(String(targetAlcoholGWeekly));
                      return;
                    }
                    setAlcoholInput(String(n));
                    if (n === targetAlcoholGWeekly) return;
                    setTargetAlcoholGWeekly(n);
                    void savePref({ target_alcohol_g_weekly: n });
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Reference: 14g ethanol ≈ 1 US standard drink (or ~1.75 UK units). 196g/week = 14 UK units.
            </p>
          </div>

          {/* Dashboard widgets (tracked macros) */}
          <div>
            <label className="block mb-1 text-sm font-medium text-foreground">Dashboard Widgets</label>
            <p className="text-xs text-muted-foreground mb-3">
              Choose which nutrients appear on your Today screen
            </p>
            <div className="space-y-2">
              {WIDGET_MACRO_OPTIONS.map(({ key, label, color }) => {
                const isActive = trackedMacros.includes(key);
                return (
                  <label
                    key={key}
                    className="flex items-center gap-3 cursor-pointer group px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="flex-1 text-sm text-foreground">{label}</span>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => {
                        setTrackedMacros((prev) => {
                          const next = isActive
                            ? prev.filter((m) => m !== key)
                            : [...prev, key];
                          if (next.length === 0) return prev;
                          void savePref({ tracked_macros: next });
                          return next;
                        });
                      }}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block mb-3 text-sm font-medium text-foreground">Dietary Restrictions</label>
            <div className="flex flex-wrap gap-2">
              {DIETARY_PREFERENCE_ENTRIES.map((diet) => (
                <button
                  key={diet.id}
                  onClick={() => {
                    const next = dietary.includes(diet.id) ? dietary.filter(d => d !== diet.id) : [...dietary, diet.id];
                    setDietary(next);
                    void savePref({ dietary: next.length > 0 ? next : null });
                  }}
                  className={`px-4 py-2 rounded-lg border-2 transition-all capitalize ${
                    dietary.includes(diet.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/30 text-foreground"
                  }`}
                >
                  {diet.label}
                </button>
              ))}
            </div>
          </div>

          {/* Intermittent fasting — 2026-05-02 web parity for the
              `claude/fasting-findable-urgent` mobile fix. The mobile
              Settings → Goals & targets bundle now has a Fasting row
              that routes to /fasting; web's Settings is structurally
              different (no bundle, no search) so the lightest-touch
              parity is a single Link inside the existing Preferences
              card. /fasting renders the FastingTimer with the
              16:8 / 18:6 / 20:4 / 14:10 / OMAD preset chips already. */}
          <div>
            <label className="block mb-3 text-sm font-medium text-foreground">Intermittent fasting</label>
            <Link
              href="/fasting"
              data-testid="settings-fasting-link"
              className="block w-full text-left px-4 py-3 bg-muted hover:bg-muted/80 rounded-lg transition-all text-foreground"
            >
              <p className="font-medium">Fasting timer & window</p>
              <p className="text-xs mt-0.5 text-muted-foreground">
                Pick your fast / eat window (16:8, 18:6, 20:4, 14:10, OMAD), start a fast, see history.
              </p>
            </Link>
          </div>
        </div>
      </SupprCard>

      {/* Notifications */}
      <SupprCard padding="lg" radius="xl" className="mb-6">
        <div className="flex items-center gap-2 mb-6">
          <Icons.notifications className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-[family-name:var(--font-headline)] text-xl font-medium text-foreground-brand">Notifications</h3>
        </div>
        <div className="space-y-4">
          {/* P1-8 (audit 2026-04-30) — notification toggles use the
              shadcn Switch primitive so all toggles in Settings share
              the same active / inactive treatment. */}
          {(Object.entries(notifications) as [keyof NotificationPrefs, NotificationPrefs[keyof NotificationPrefs]][])
            .filter((e): e is [keyof NotificationPrefs, boolean] => typeof e[1] === "boolean")
            .map(([key, value]) => {
              const label = NOTIFICATION_LABELS[key] ?? key;
              return (
                <div key={key} className="flex items-center justify-between gap-4">
                  <label
                    htmlFor={`notification-${key}-toggle`}
                    className="flex-1 text-foreground cursor-pointer"
                  >
                    {label}
                  </label>
                  <Switch
                    id={`notification-${key}-toggle`}
                    aria-label={label}
                    checked={value}
                    onCheckedChange={(next) =>
                      setNotifications({ ...notifications, [key]: !!next })
                    }
                  />
                </div>
              );
            })}
          {/* Weekly recap push (Batch 4.11 toggle — H6 audit fix, 2026-04-18).
            * Controls `profiles.weekly_recap_push_enabled`. On mobile the
            * Progress-visit scheduler reads the same column and cancels /
            * reinstalls the local WEEKLY push accordingly. Web has no push
            * yet so the toggle only controls the mobile behaviour — still
            * surfaced on web so the user can opt out from any device. */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <label
                htmlFor="weekly-recap-push-toggle"
                className="block text-foreground cursor-pointer"
              >
                Weekly recap
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                {weekStartDay === "monday"
                  ? "Sunday 18:00 (respects your week start)."
                  : "Saturday 18:00 (respects your week start)."}
              </p>
            </div>
            <Switch
              id="weekly-recap-push-toggle"
              aria-label="Weekly recap push notifications"
              checked={weeklyRecapPushEnabled}
              onCheckedChange={(next) => {
                const previous = weeklyRecapPushEnabled;
                if (previous === next) return;
                setWeeklyRecapPushEnabled(next);
                void (async () => {
                  const { data: session } = await supabase.auth.getSession();
                  const uid = session.session?.user.id;
                  if (!uid) {
                    // No session — revert and surface the problem.
                    setWeeklyRecapPushEnabled(previous);
                    toast.error("Sign in to change this preference.");
                    return;
                  }
                  const { error } = await supabase
                    .from("profiles")
                    .update({ weekly_recap_push_enabled: next })
                    .eq("id", uid);
                  if (error) {
                    setWeeklyRecapPushEnabled(previous);
                    toast.error("Failed to save preference");
                    return;
                  }
                  track(AnalyticsEvents.weekly_recap_push_enabled_toggled, {
                    enabled: next,
                  });
                })();
              }}
            />
          </div>
        </div>
      </SupprCard>

      {/* Subscription management (ENG-748 #11). Replaces the old
          "hidden for now" stub. Self-contained card extracted to
          `settings/SubscriptionCard.tsx` (Settings.tsx is already
          1700+ lines — screen-size rule). Renders the 4 Stripe states
          (active / trial / canceled-but-active / past-due), the IAP
          App-Store copy for RevenueCat subscribers (NO web cancel
          control), and a Free fallback. Only fetches the status route
          for Pro users. The "Manage or cancel" CTA fires the SAME
          cancel-export prompt → /account/billing → Stripe portal flow
          the legacy button used, so the export-prompt interstitial is
          unchanged. Web-only — mobile billing is IAP.
          Flag-gated (ENG-748 #11) behind `web-subscription-card` — billing
          surface ramps via PostHog after public-launch counsel + visual QA;
          flag off → falls back to the prior hidden state (null). */}
      {isFeatureEnabled("web-subscription-card") && userTier !== "free" ? (
        <SubscriptionCard
          userTier={userTier}
          onManageSubscription={() => {
            track(AnalyticsEvents.cancel_export_prompt_shown, {
              source: "web",
              tier: userTier,
            });
            setCancelPromptOpen(true);
          }}
        />
      ) : null}

      {/* About — houses the "What's new in Suppr" link. F-0
          (2026-04-19): single reliable entry point for testers to see
          which of their feedback items shipped in the latest build.
          Mirrors the mobile Settings "About" section. */}
      <SupprCard padding="lg" radius="xl" className="mb-6">
        <div className="flex items-center gap-2 mb-6">
          <Icons.sparkles className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-[family-name:var(--font-headline)] text-xl font-medium text-foreground-brand">About</h3>
        </div>
        <div className="space-y-3">
          <Link
            href="/whats-new"
            data-testid="settings-whats-new-link"
            className="block w-full text-left px-4 py-3 bg-muted hover:bg-muted/80 rounded-lg transition-all text-foreground"
          >
            What&rsquo;s new in Sloe
          </Link>
        </div>
      </SupprCard>

      {/* Promo code — de-emphasised; most users won't need this */}
      <div ref={promoSectionRef} className="scroll-mt-8">
      <SupprCard
        padding="lg"
        radius="xl"
        className="mb-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <Icons.ticket className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-[family-name:var(--font-headline)] text-xl font-medium text-foreground-brand">Promo code</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Redeem a code to upgrade your plan (one use per account per code).
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="e.g. SUPPR_PRO"
            autoComplete="off"
            className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-card/80 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="button"
            disabled={promoSubmitting || !promoCode.trim()}
            onClick={async () => {
              setPromoSubmitting(true);
              try {
                const result = await redeemPromoCode(promoCode);
                if (result.ok) {
                  if (result.alreadyRedeemed) {
                    toast.success(`Plan confirmed: ${result.tier} (this code was already applied to your account).`);
                  } else {
                    toast.success(`Plan updated: ${result.tier}`);
                  }
                  setPromoCode("");
                } else {
                  const messages: Record<string, string> = {
                    not_authenticated: "Sign in to redeem a code.",
                    invalid_code: "Enter a promo code.",
                    invalid_or_expired: "That code is not valid or has expired.",
                    already_redeemed: "You have already redeemed this code.",
                    rpc_error: result.message ?? "Could not redeem code.",
                    not_deployed: "Promo codes aren't available in this build yet.",
                  };
                  toast.error(messages[result.error] ?? "Could not redeem code.");
                }
              } finally {
                setPromoSubmitting(false);
              }
            }}
            className="px-6 py-2.5 rounded-xl bg-foreground text-background font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {promoSubmitting ? "Applying…" : "Apply"}
          </button>
        </div>
      </SupprCard>
      </div>

      {/* Privacy */}
      <SupprCard padding="lg" radius="xl" className="mb-6">
        <div className="flex items-center gap-2 mb-6">
          <Icons.shield className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-[family-name:var(--font-headline)] text-xl font-medium text-foreground-brand">Privacy & Security</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Download your nutrition log in a spreadsheet-friendly CSV, or take a full JSON backup for developers and migrations.
        </p>
        <div className="space-y-3">
          {/* G-6 (2026-04-19, TestFlight `AC4oDEnQ0SuPruUtCr_Lvyc`) —
              CSV is the primary, one-click path so regular users can
              open their log in Numbers / Excel / Sheets. JSON stays
              available below for full backups. */}
          <button
            type="button"
            onClick={() => {
              void runCsvExport();
            }}
            className="w-full text-left px-4 py-3 bg-muted hover:bg-muted/80 rounded-lg transition-all text-foreground"
          >
            <p className="font-medium">Export nutrition log (CSV)</p>
            <p className="text-xs text-muted-foreground mt-0.5">Spreadsheet-friendly. Opens in Numbers, Excel, or Google Sheets.</p>
          </button>
          {/* "Export everything" — server-authoritative path
              (`/api/export/me`). Counters lock-in anxiety per the
              2026-04-30 user-sentiment audit (Paprika "recipes
              disappeared after upgrade", MFP "history gone after
              update", Recime "data vanished post-payment"). One
              endpoint emits the canonical payload; both web and
              mobile call it so the bytes match. The legacy partial
              path (profile + entries + saves stitched on the
              client) was replaced 2026-04-30 because it both
              shipped truncated data AND duplicated logic across the
              two platforms. */}
          <button
            type="button"
            data-testid="settings-export-everything-button"
            onClick={() => {
              void (async () => {
                try {
                  const { data: session } = await supabase.auth.getSession();
                  const token = session.session?.access_token;
                  if (!token) {
                    toast.error("Sign in to export your data.");
                    return;
                  }
                  const res = await fetch("/api/export/me", {
                    method: "GET",
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (res.status === 429) {
                    toast.error(
                      "You can export once per minute. Try again in a moment.",
                    );
                    return;
                  }
                  if (res.status === 401) {
                    toast.error("Your session expired. Sign in again.");
                    return;
                  }
                  if (!res.ok) {
                    let detail = `Export failed (${res.status}).`;
                    try {
                      const body = (await res.json()) as { message?: string };
                      if (body.message) detail = body.message;
                    } catch {
                      // Body wasn't JSON — keep the generic message.
                    }
                    toast.error(detail);
                    return;
                  }
                  const blob = await res.blob();
                  const filenameMatch = /filename="([^"]+)"/.exec(
                    res.headers.get("content-disposition") ?? "",
                  );
                  const filename =
                    filenameMatch?.[1] ??
                    `suppr-export-${new Date().toISOString().slice(0, 10)}.json`;
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = filename;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast.success("Download started.");
                } catch {
                  toast.error("Could not build export.");
                }
              })();
            }}
            className="w-full text-left px-4 py-3 bg-muted/60 hover:bg-muted rounded-lg transition-all text-muted-foreground"
          >
            <p className="font-medium text-foreground">Export everything</p>
            <p className="text-xs mt-0.5">
              Yours forever. Take your data anywhere — recipes, meal log,
              weights, plans. Downloads as a JSON file.
            </p>
          </button>
          {/* 2026-05-02 — MFP CSV bulk-import card. Closes the
              MFP-refugee history-bridge gap (P1 customer-lens). Mirrors
              the same card on mobile Settings (App section) and on
              the onboarding data-bridges step. See
              `docs/decisions/2026-05-02-mfp-csv-import.md`. */}
          <MfpCsvImportCard surface="settings" />
          <Link
            href="/privacy"
            className="block w-full text-left px-4 py-3 bg-muted hover:bg-muted/80 rounded-lg transition-all text-foreground"
          >
            Privacy policy
          </Link>
          <Link
            href="/help"
            className="block w-full text-left px-4 py-3 bg-muted hover:bg-muted/80 rounded-lg transition-all text-foreground"
          >
            Help
          </Link>
          <Link
            href="/terms"
            className="block w-full text-left px-4 py-3 bg-muted hover:bg-muted/80 rounded-lg transition-all text-foreground"
          >
            Terms of service
          </Link>
          {/* Reset or start over (web parity to mobile, 2026-04-30 #15).
              Reset targets = inline; Erase everything = wipe + re-onboard.
              The two destructive surfaces below this block delete the
              account itself — distinct from a data reset. */}
          <button
            type="button"
            onClick={handleResetTargets}
            disabled={resetting}
            className="w-full text-left px-4 py-3 bg-primary/5 hover:bg-primary/10 disabled:opacity-50 rounded-lg transition-all text-foreground border border-primary/20"
          >
            <p className="font-medium">
              {resetting ? "Resetting…" : "Reset targets"}
            </p>
            <p className="text-xs mt-0.5 text-muted-foreground">
              Defaults your calorie and macro goals. Keeps your food log,
              planner, and saved recipes.
            </p>
          </button>
          {/* P0-4 (audit 2026-04-30): Destructive-zone visual ladder.
              Three rows used to sit on the same red plate, which made
              "Delete local data & sign out" — a fully reversible action
              — read as catastrophic next to permanent account deletion.
              The new ladder:
                - Erase everything (amber / warning)  — server data wipe,
                  but account + subscription stay. Recoverable from an
                  exported JSON backup.
                - Delete local data & sign out (neutral) — reversible:
                  sign back in and re-sync from the server.
                - Delete account (destructive / red) — irreversible, the
                  only action that warrants the red plate.
              Tokens (`--warning`, `--muted`, `--destructive`) flow from
              `src/styles/theme.css` so dark-mode swaps for free. */}
          <button
            type="button"
            onClick={() => setEraseEverythingOpen(true)}
            disabled={resetting}
            data-testid="settings-erase-everything-button"
            className="w-full text-left px-4 py-3 bg-warning/10 hover:bg-warning/15 disabled:opacity-50 rounded-lg transition-all text-foreground border border-warning/30"
          >
            <p className="font-medium text-foreground">Erase everything</p>
            <p className="text-xs mt-0.5 text-muted-foreground">
              Deletes food log, journal, library saves, shopping lists,
              imported recipes, and synced activity. Sends you through
              setup again.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setClearLocalOpen(true)}
            data-testid="settings-clear-local-button"
            className="w-full text-left px-4 py-3 bg-muted hover:bg-muted/80 rounded-lg transition-all text-foreground"
          >
            <p className="font-medium">Delete local data &amp; sign out</p>
            <p className="text-xs mt-0.5 text-muted-foreground">
              Reversible — sign back in and your data syncs from the server.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setAccountDeletionStage("first")}
            data-testid="settings-delete-account-button"
            className="w-full text-left px-4 py-3 bg-destructive/10 hover:bg-destructive/15 rounded-lg transition-all text-destructive border border-destructive/30"
          >
            <p className="font-medium">Delete my account permanently</p>
            <p className="text-xs mt-0.5 text-destructive/80">
              Irreversible. Removes your account, recipes, logs, and plans.
            </p>
          </button>
        </div>
      </SupprCard>

      {/* Cancel-flow export prompt (PR replaces #43, 2026-05-02).
          Closes journey-architect P1 — surfaces the data-export prompt
          AT the cancel touchpoint so users with active subscriptions
          aren't routed to /account/billing without ever seeing the
          option to take their data with them first. Equal-weight CTAs,
          calm tone, no retention-via-friction. Mobile parity at
          `apps/mobile/components/settings/CancelExportPromptSheet.tsx`. */}
      <CancelExportPromptDialog
        open={cancelPromptOpen}
        exporting={cancelPromptExporting}
        onDismiss={() => {
          setCancelPromptOpen(false);
          // State-reset on close: the next open starts from a clean
          // exporting=false slate so a previous in-flight export
          // doesn't leave the dialog disabled on the next render.
          setCancelPromptExporting(false);
        }}
        onExport={() => {
          track(AnalyticsEvents.cancel_export_chosen, {
            source: "web",
            tier: userTier,
          });
          setCancelPromptExporting(true);
          // Dialog stays open after the CSV download fires so the
          // user can still tap "Continue to manage" or dismiss.
          // Don't auto-close on success.
          void runCsvExport().finally(() => {
            setCancelPromptExporting(false);
          });
        }}
        onContinueToManage={() => {
          track(AnalyticsEvents.cancel_proceeded, {
            source: "web",
            tier: userTier,
          });
          setCancelPromptOpen(false);
          setCancelPromptExporting(false);
          // Route to the existing /account/billing Stripe Customer
          // Portal shell. Hard nav (not Link) because the user is
          // committing to a destination outside the SPA shell.
          if (typeof window !== "undefined") {
            window.location.href = "/account/billing";
          }
        }}
      />

      {/* Themed destructive-confirm dialogs (audit M7, 2026-04-18).
          Replace three native `window.confirm` calls. Account deletion
          keeps its two-stage pattern so a careless tap cannot wipe the
          account: first dialog warns about permanence, second dialog
          reiterates what will be deleted. */}
      {/* Activity level picker (build 10 fix E-2, 2026-04-19). */}
      <ActivityLevelPickerDialog
        open={activityPickerOpen}
        onOpenChange={setActivityPickerOpen}
        currentLevel={activityLevel ?? "sedentary"}
        sex={profileSex}
        weightKg={profileWeightKg}
        heightCm={profileHeightCm}
        age={profileAge}
        goal={profileGoal}
        planPace={profilePlanPace}
        nutritionStrategy={profileNutritionStrategy}
        onConfirm={handleActivityLevelConfirm}
      />
      {/* P1-6 (audit 2026-04-30): Calmed the Erase confirm copy in
          lockstep with the mobile rewrite. The previous block listed
          every category in the body, which read as shame energy ("look
          how much you'll lose"). The new copy points at the recovery
          path (re-import from your export) and lists categories
          lowercase if the user wants a reminder. */}
      {/* 2026-05-12 (premium-bar audit DC9 polish): description was a
          paragraph — comma-separated list, easy to skim past. Linear's
          pattern for irreversible actions is scannable ✓/✗ bullets so
          the user can verify at a glance "yes I'm OK with X going".
          Mirror of mobile reset modal in SettingsBundleContent.tsx. */}
      <DestructiveConfirmDialog
        typeToConfirm="RESET"
        open={eraseEverythingOpen}
        onOpenChange={setEraseEverythingOpen}
        title="Delete your data and start fresh?"
        description={
          <span className="block">
            <span className="block text-xs text-muted-foreground mb-3">
              You can re-import from your export file anytime.
            </span>
            <span className="block space-y-1.5 mt-1">
              {[
                { label: "Food log", kept: false },
                { label: "Daily journal", kept: false },
                { label: "Library saves", kept: false },
                { label: "Shopping lists", kept: false },
                { label: "Imported recipes", kept: false },
                { label: "Synced activity", kept: false },
                { label: "Your account", kept: true },
                { label: "Subscription", kept: true },
              ].map((row) => (
                <span key={row.label} className="flex items-center gap-2.5 text-[13px]">
                  <span
                    className={`inline-block w-3.5 text-center font-bold ${
                      row.kept ? "text-success" : "text-destructive"
                    }`}
                    aria-label={row.kept ? "Kept" : "Cleared"}
                  >
                    {row.kept ? "✓" : "✗"}
                  </span>
                  <span
                    className={
                      row.kept
                        ? "text-foreground"
                        : "text-muted-foreground line-through"
                    }
                  >
                    {row.label}
                  </span>
                </span>
              ))}
            </span>
          </span>
        }
        confirmLabel="Erase everything"
        onConfirm={handleEraseEverything}
      />
      <DestructiveConfirmDialog
        open={clearLocalOpen}
        onOpenChange={setClearLocalOpen}
        title="Delete local data & sign out?"
        description="This will sign you out and remove Sloe data stored on this device."
        confirmLabel="Delete & sign out"
        onConfirm={async () => {
          for (const k of LOCAL_CLEAR_KEYS) {
            try {
              localStorage.removeItem(k);
            } catch {
              /* ignore */
            }
          }
          await signOut();
          toast.success("Local data cleared. Signed out.");
          window.location.href = "/login";
        }}
      />
      <DestructiveConfirmDialog
        open={accountDeletionStage === "first"}
        onOpenChange={(o) => {
          if (!o) setAccountDeletionStage("idle");
        }}
        title="Delete your account?"
        description="This will permanently delete your account and all associated data. This action cannot be undone."
        confirmLabel="Continue"
        onConfirm={async () => {
          setAccountDeletionStage("second");
        }}
      />
      <DestructiveConfirmDialog
        open={accountDeletionStage === "second"}
        onOpenChange={(o) => {
          if (!o) setAccountDeletionStage("idle");
        }}
        title="Are you sure?"
        description="Your recipes, logs, meal plans, and profile will be permanently deleted."
        confirmLabel="Delete account"
        onConfirm={async () => {
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            const res = await fetch("/api/account/delete", {
              method: "DELETE",
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const json = await res.json();
            if (json.ok) {
              for (const k of LOCAL_CLEAR_KEYS) {
                try { localStorage.removeItem(k); } catch { /* ignore */ }
              }
              toast.success("Account deleted.");
              window.location.href = "/login";
            } else {
              toast.error(json.error || "Account deletion failed. Please try again.");
            }
          } catch {
            toast.error("Account deletion failed. Please try again.");
          }
        }}
      />
    </div>
  );
});
