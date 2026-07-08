import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "@/lib/supabase";
import { useHaptics } from "@/hooks/useHaptics";
import { ACTIVITY_BUDGET_DISCOVERABILITY_KEY } from "@suppr/nutrition-core/activityBudgetDiscoverability";
import { isAiSourcedFoodHistoryItem } from "@suppr/nutrition-core/foodHistory";
import { registerExpoPushTokenForUser } from "@/lib/expoPushToken";
import { dateKeyFromDate } from "@/lib/nutritionJournal";
import type { JournalMeal } from "@/lib/nutritionJournal";

const AI_TOOLTIP_STORAGE_KEY = "suppr.ai-explainer-shown.v1";
const FIRST_LOG_ACK_STORAGE_KEY = "suppr.first-log-acknowledged.v1";
const FIRST_MEAL_TIP_DISMISSED_KEY = "suppr.first-meal-tip-dismissed.v1";
const POST_ONB_PUSH_PROMPT_KEY = "suppr.post-onboarding-push-prompt.v1";

type UseTodayActivationNudgesParams = {
  userId: string | undefined;
  dayKey: string;
  mealsToday: JournalMeal[];
};

export type UseTodayActivationNudgesResult = {
  // AI-first-log tooltip (Phase 5, 2026-04-30).
  aiFirstLogTooltipMealId: string | null;
  dismissAiFirstLogTooltip: () => void;

  // Activity-budget discoverability banner.
  activityBudgetDiscoverDismissed: boolean | null;
  dismissActivityBudgetDiscover: () => void;

  // First-log toast + haptic (0→1 meal-count transition, audit
  // 2026-04-30 leak fix #3).
  firstLogToastVisible: boolean;
  dismissFirstLogToast: () => void;

  // Post-log "what to eat next" micro-moment (ENG-977). The setter is
  // exposed because the line content is built deep inside TodayScreen's
  // meal-commit path (needs the saved-recipes library + live macro
  // totals at commit time) — pulling that call site out is a larger,
  // riskier refactor than this pass's scope allows.
  postLogNudgeLine: string | null;
  setPostLogNudgeLine: (line: string | null) => void;

  // First-meal-empty-state IG/TT tip dismissal (2026-05-01).
  firstMealTipDismissed: boolean;
  dismissFirstMealTip: () => void;

  // Post-onboarding push-permission explainer (audit 2026-04-30 leak
  // fix #4).
  postOnbPushVisible: boolean;
  onPostOnbPushEnable: () => void;
  onPostOnbPushSkip: () => void;
};

/**
 * ENG-1361 — Today extract (round 2, real domain hook, not a re-export
 * shim). Owns the "one-shot activation nudge" cluster: five independent
 * AsyncStorage-flag-gated UI hints that each show once and never again
 * — the AI-first-log tooltip, the activity-budget-discoverability
 * banner, the first-log toast + success haptic, the first-meal-empty-
 * state tip, and the post-onboarding push-permission explainer.
 *
 * ## Why a hook
 *
 * All five share the same shape (hydrate a boolean/timestamp flag from
 * AsyncStorage on mount, expose a dismiss callback that flips local
 * state + persists), and none of their internals are read by any other
 * Today state — only the derived visibility booleans and dismiss
 * callbacks cross the boundary. Bundling them removes ~180 lines of
 * near-identical AsyncStorage hydrate/persist ceremony from the Today
 * parent.
 *
 * ## What stays in TodayScreen
 *
 * `postLogNudgeLine`'s *content* is still built inline in TodayScreen's
 * AI-photo/voice meal-commit path (it needs the saved-recipes library +
 * live macro totals at the moment of commit) — only the state + a raw
 * setter move here, matching the `loadProfileTargets`-setter pattern
 * pass 1 established for `useTodayHydrationStimulants`.
 *
 * ## Failure modes
 *
 * - AsyncStorage read/write fails for any of the five flags → each
 *   effect/callback swallows the error and falls back to the
 *   pre-extraction default (tooltip stays hidden this session, or may
 *   resurface once more next launch — never a crash, never a duplicate
 *   show within the same session).
 * - `userId` not yet resolved → the post-onboarding push check no-ops
 *   until it resolves rather than firing against an unscoped profile row.
 */
export function useTodayActivationNudges({
  userId,
  dayKey,
  mealsToday,
}: UseTodayActivationNudgesParams): UseTodayActivationNudgesResult {
  const haptics = useHaptics();
  const isToday = dayKey === dateKeyFromDate(new Date());

  /**
   * Phase 5 (2026-04-30) — AI-first-log tooltip gate. Replaces the
   * per-day "Includes N AI-estimated meals" sentinel that used to
   * render inside `TodayHero`.
   *
   * Three states:
   *   - `null` (initial): AsyncStorage hasn't hydrated yet — render
   *     no tooltip. Avoids a flash when the storage key is set.
   *   - `false`: storage says we have NOT shown the tooltip yet —
   *     the first AI-sourced meal row will trigger it.
   *   - `true`: we have shown the tooltip already (or the user just
   *     dismissed it this session) — never show again.
   */
  const [aiTooltipShown, setAiTooltipShown] = useState<boolean | null>(null);
  const [activityBudgetDiscoverDismissed, setActivityBudgetDiscoverDismissed] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(AI_TOOLTIP_STORAGE_KEY)
      .then((raw) => {
        if (!cancelled) setAiTooltipShown(raw != null);
      })
      .catch(() => {
        if (!cancelled) setAiTooltipShown(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(ACTIVITY_BUDGET_DISCOVERABILITY_KEY)
      .then((raw) => {
        if (!cancelled) setActivityBudgetDiscoverDismissed(raw != null);
      })
      .catch(() => {
        if (!cancelled) setActivityBudgetDiscoverDismissed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissActivityBudgetDiscover = useCallback(() => {
    setActivityBudgetDiscoverDismissed(true);
    void AsyncStorage.setItem(ACTIVITY_BUDGET_DISCOVERABILITY_KEY, "1").catch(() => {});
  }, []);

  const dismissAiFirstLogTooltip = useCallback(() => {
    setAiTooltipShown(true);
    void AsyncStorage.setItem(
      AI_TOOLTIP_STORAGE_KEY,
      new Date().toISOString(),
    ).catch(() => {
      /* storage denied — in-session state still hides the tooltip;
         worst case it shows again on next launch, never twice in
         the same session. */
    });
  }, []);

  /**
   * id of the first AI-sourced meal row to anchor the AI-first-log
   * tooltip below. `null` until AsyncStorage hydrates
   * (`aiTooltipShown === null`), or when the user has already seen the
   * tooltip on a prior launch (`aiTooltipShown === true`), or when
   * there is no AI-sourced meal on the active day.
   */
  const aiFirstLogTooltipMealId =
    aiTooltipShown === false
      ? mealsToday.find((m) => isAiSourcedFoodHistoryItem({ source: m.source ?? null }))?.id ?? null
      : null;

  // Activation hook (audit 2026-04-30 — leak fix #3): first-log toast.
  // ---------------------------------------------------------------
  // `firstLogAckShown`:
  //   - `null`: AsyncStorage read in flight.
  //   - `false`: storage says we have NOT acknowledged the first log.
  //     A 0→1 transition in `mealsToday.length` will trigger the toast.
  //   - `true`: already shown (or just dismissed this session).
  // The detection runs against a separate counter (`firstLogAckShown`)
  // rather than today's meal count alone — a returning user who already
  // saw the toast on day-1 must NOT re-trigger when their day-2 0→1
  // transition happens. The `false → true` transition is the one that
  // matters; once `true`, it stays `true` forever.
  const [firstLogAckShown, setFirstLogAckShown] = useState<boolean | null>(null);
  const [firstLogToastVisible, setFirstLogToastVisible] = useState(false);
  const firstLogPrevCountRef = useRef<number | null>(null);
  // ENG-977 — calm post-log "what to eat next" micro-moment line.
  const [postLogNudgeLine, setPostLogNudgeLine] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(FIRST_LOG_ACK_STORAGE_KEY)
      .then((raw) => {
        if (!cancelled) setFirstLogAckShown(raw != null);
      })
      .catch(() => {
        if (!cancelled) setFirstLogAckShown(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * 2026-05-01 (journey-architect P1) — first-meal-empty-state IG/TT
   * tip dismissal. Persisted under a versioned AsyncStorage key. The
   * empty card itself is unconditional when zero today + zero history;
   * only the trailing IG/TT tip line is dismissable.
   */
  const [firstMealTipDismissed, setFirstMealTipDismissed] = useState<boolean>(false);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(FIRST_MEAL_TIP_DISMISSED_KEY)
      .then((raw) => {
        if (!cancelled) setFirstMealTipDismissed(raw != null);
      })
      .catch(() => {
        /* storage denied — keep tip visible, host re-renders correctly */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissFirstLogToast = useCallback(() => {
    setFirstLogToastVisible(false);
    setFirstLogAckShown(true);
    void AsyncStorage.setItem(
      FIRST_LOG_ACK_STORAGE_KEY,
      new Date().toISOString(),
    ).catch(() => {
      /* storage denied — session state hides; worst case it shows
         once more next launch, never twice this session. */
    });
  }, []);

  // Activation hook (audit 2026-04-30 — leak fix #4): post-onboarding
  // push-permission explainer. The MobilePermissionsStep was removed
  // from the linear onboarding flow in the 15→12 shrink; without
  // re-prompting elsewhere, push permission stays at the OS default
  // and no D1/D7/D30 retention nudge can deliver. We surface the
  // prompt as a single-screen explainer the first time Today renders
  // post-onboarding.
  //
  // Coordination with `OnboardingNudgeBanner` (commit c60af6d): this
  // explainer fires FIRST. The `permissions` nudge in that queue is
  // the recovery path for the case where the user dismissed THIS
  // prompt — same OS calls, lower priority on re-ask.
  const [postOnbPushVisible, setPostOnbPushVisible] = useState(false);
  const postOnbPushCheckedRef = useRef(false);
  useEffect(() => {
    if (postOnbPushCheckedRef.current) return;
    if (Platform.OS !== "ios") {
      // iOS-only by design — Android push prompts route through a
      // different OS path and aren't in scope for this fix. Mark the
      // check done so we don't re-evaluate.
      postOnbPushCheckedRef.current = true;
      return;
    }
    if (!userId) return;
    postOnbPushCheckedRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const shown = await AsyncStorage.getItem(POST_ONB_PUSH_PROMPT_KEY);
        if (cancelled) return;
        if (shown === "shown") return;
        // Honour the user's onboarding-completed status. Tabs layout
        // already redirects users without onboarding completion to
        // /onboarding, so by the time we reach Today the user IS
        // post-onboarding. Belt-and-braces: read `profiles.onboarding_completed`
        // via the existing supabase client.
        const { data } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (data?.onboarding_completed !== true) return;

        // OS-permission gate — only ask if the user hasn't already
        // answered. `getPermissionsAsync` returns `undetermined` when
        // the OS prompt has never been shown.
        try {
          const Notifications = await import("expo-notifications");
          const existing = await Notifications.getPermissionsAsync();
          if (cancelled) return;
          if (existing.status === "undetermined") {
            setPostOnbPushVisible(true);
          } else {
            // Already answered — record so we don't keep checking.
            await AsyncStorage.setItem(POST_ONB_PUSH_PROMPT_KEY, "shown");
          }
        } catch {
          // expo-notifications not present (Expo Go / older builds) —
          // skip silently and let the existing nudge banner handle it.
        }
      } catch {
        /* network / storage hiccup — silent skip. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const dismissPostOnbPush = useCallback(async (granted: boolean) => {
    setPostOnbPushVisible(false);
    try {
      await AsyncStorage.setItem(POST_ONB_PUSH_PROMPT_KEY, "shown");
    } catch {
      /* best-effort persist — banner-queue path will recover next launch */
    }
    if (granted) {
      try {
        await registerExpoPushTokenForUser(userId ?? null);
      } catch {
        /* token-fetch failures are non-fatal — see expoPushToken.ts. */
      }
    }
  }, [userId]);

  const onPostOnbPushEnable = useCallback(() => {
    void (async () => {
      try {
        const Notifications = await import("expo-notifications");
        const existing = await Notifications.getPermissionsAsync();
        const next =
          existing.status === "granted"
            ? existing
            : await Notifications.requestPermissionsAsync();
        await dismissPostOnbPush(next.status === "granted");
      } catch {
        await dismissPostOnbPush(false);
      }
    })();
  }, [dismissPostOnbPush]);

  const onPostOnbPushSkip = useCallback(() => {
    void dismissPostOnbPush(false);
  }, [dismissPostOnbPush]);

  const dismissFirstMealTip = useCallback(() => {
    setFirstMealTipDismissed(true);
    void AsyncStorage.setItem(
      FIRST_MEAL_TIP_DISMISSED_KEY,
      new Date().toISOString(),
    ).catch(() => {
      /* storage denied — in-session state hides tip; may resurface next launch */
    });
  }, []);

  // Activation hook (audit 2026-04-30 — leak fix #3): detect the
  // 0→1 transition in today's meal count and fire the first-log
  // toast + haptic. The detection runs against the AsyncStorage flag
  // (`firstLogAckShown === false`) so a returning user who already
  // saw it on day-1 never re-triggers on day-2.
  //
  // We track the previous count via a ref to distinguish "fresh
  // log" from "rehydrate from storage" — the journal load also
  // moves `mealsToday.length` from 0 → N on cold start, but that
  // path doesn't represent a user-initiated log and shouldn't toast.
  // Solution: compare to `firstLogPrevCountRef.current`. On first
  // run after journal hydrate, `prev` is `null` → seed without
  // toasting. On subsequent updates, `0 → 1` triggers the toast.
  useEffect(() => {
    if (firstLogAckShown !== false) {
      // Either still hydrating (`null`) or already shown (`true`).
      // Keep ref synced so a later transition doesn't false-trigger.
      firstLogPrevCountRef.current = mealsToday.length;
      return;
    }
    if (!isToday) {
      // Only Today drives the first-log moment — viewing a prior day
      // shouldn't fire it.
      return;
    }
    const prev = firstLogPrevCountRef.current;
    const curr = mealsToday.length;
    if (prev === null) {
      // First observation post-hydrate. Seed without toasting.
      firstLogPrevCountRef.current = curr;
      return;
    }
    if (prev === 0 && curr === 1) {
      // The user just logged their first meal of the day — and the
      // storage flag confirms they've never seen the toast before.
      // Fire the haptic + reveal the toast. Component handles the
      // 2.5s auto-fade.
      try {
        haptics.success();
      } catch {
        /* haptics not available — toast still renders. */
      }
      setFirstLogToastVisible(true);
    }
    firstLogPrevCountRef.current = curr;
  }, [mealsToday.length, firstLogAckShown, isToday, haptics]);

  return {
    aiFirstLogTooltipMealId,
    dismissAiFirstLogTooltip,

    activityBudgetDiscoverDismissed,
    dismissActivityBudgetDiscover,

    firstLogToastVisible,
    dismissFirstLogToast,

    postLogNudgeLine,
    setPostLogNudgeLine,

    firstMealTipDismissed,
    dismissFirstMealTip,

    postOnbPushVisible,
    onPostOnbPushEnable,
    onPostOnbPushSkip,
  };
}
