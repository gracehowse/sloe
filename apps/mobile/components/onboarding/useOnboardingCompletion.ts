import * as React from "react";
import { Alert } from "react-native";
import type { useRouter } from "expo-router";

import { isFeatureDisabled, track } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { seedSaveTelemetry } from "@suppr/shared/onboarding/seedSaveTelemetry";
import { selectOnboardingSeeds } from "@suppr/shared/onboarding/onboardingSeeds";
import { buildFirstWeekFromSeeds } from "@suppr/shared/onboarding/onboardingFirstWeek";
import {
  resolveSeedsToRecipeIds,
  saveResolvedSeeds,
} from "@suppr/shared/onboarding/onboardingSeedResolver";
import { persistOnboarding } from "@suppr/shared/onboarding/persist";
import { clearLogsAndWeightHistory } from "@suppr/shared/account/nukeAccountData";
import { firstLogDeepLinkQs } from "@suppr/shared/onboarding/conversionFunnel";
import { writeOnboardingCompletedCache } from "@/lib/onboardingCompletedCache";
import { STEP_IDS, type OnboardingState, type V2Targets } from "@/lib/onboarding";

export type PersistAndSeedResult =
  | { ok: false }
  | { ok: true; planFailed: boolean; refreshPlanPending: boolean };

/**
 * useOnboardingCompletion — the terminal-step completion pipeline,
 * extracted from `mobile-flow.tsx` (ENG-1507 touch; keeps the flow shell
 * under its line budget per the use<Screen>() extraction rule).
 *
 * MV-01 fix (audit 2026-04-28) — mirrors
 * `src/app/components/onboarding/web-flow.tsx#handleComplete`:
 *   1. `persistOnboarding(supabase, { userId, state, targets })` —
 *      writes the user's profile + dietary + targets.
 *   2. If seeds resolve against `recipes`, save them to `saves` and build
 *      the first week's meal plan via `buildFirstWeekFromSeeds`.
 *   3. Fire the canonical `onboarding_completed` event.
 *   4. Clear the AsyncStorage persistence so the next user on this
 *      device starts fresh.
 *   5. `router.replace("/(tabs)")` with a query string the Today screen
 *      can read to surface a toast on plan-build failure.
 *
 * Pre-fix the Continue button on the terminal step ran `go(1)`, which
 * clamped to `TOTAL_STEPS - 1` and was a no-op — the user was stuck on
 * the recipes step forever.
 *
 * ENG-1507 split (2026-07-11): steps 1–4 live in `persistAndSeed`
 * (persist + seed + analytics + storage-clear, NO navigation) and step 5
 * in `handleComplete` on top. The terminal upgrade step's "Start free
 * trial" awaits `persistAndSeed` (via the context's `persist`) BEFORE
 * pushing `/paywall?from=onboarding` — previously that path never
 * persisted at all (every from=onboarding paywall exit replaces to
 * Today, unmounting the flow), so the paywall's personalised-plan card
 * rendered the PREVIOUS run's profiles row and a re-onboarded user's
 * freshly-selected plan was silently discarded.
 */
export function useOnboardingCompletion({
  userId,
  state,
  targets,
  goTo,
  setCompleting,
  router,
}: {
  userId: string | null;
  state: OnboardingState;
  targets: V2Targets | null;
  goTo: (index: number) => void;
  setCompleting: (v: boolean) => void;
  router: ReturnType<typeof useRouter>;
}) {
  // ENG-1507 (review round 2026-07-11) — persisted-once re-entry guard.
  // The trial path runs `persistAndSeed` via `persist()` and then pushes
  // the paywall with the flow still mounted beneath it; a back-gesture
  // return + "Continue on Free" runs `complete()` → `persistAndSeed`
  // AGAIN. Without this guard the second run re-seeds, rebuilds the
  // first-week plan, and double-fires `onboarding_completed` (cohort
  // double-count). After one successful run per user, later calls return
  // the cached result — skipping persist + seed + analytics — so
  // `handleComplete` only navigates. Failures are NOT cached: a failed
  // persist stays fully retryable.
  const persistedOnceRef = React.useRef<{
    userId: string;
    result: PersistAndSeedResult & { ok: true };
  } | null>(null);

  const persistAndSeed = React.useCallback(async (): Promise<PersistAndSeedResult> => {
    if (!userId) {
      // ENG-672 (2026-05-26): defence-in-depth. The Signup gate
      // (`canAdvance("signup", …)` requires `hasSession`) means a user
      // should never reach the terminal step unauthenticated via the
      // normal flow. But if a session expired mid-flow (or a deep-link
      // jumped past Signup), we must NOT bounce to a bare /login that
      // discards every answer. Instead, send the user back to the
      // Signup step with all their state intact (it persists in
      // AsyncStorage and stays in memory) so they can re-authenticate
      // and pick up exactly where they were.
      track(AnalyticsEvents.onboarding_completed, {
        flow: "v2",
        unauthenticated: true,
      });
      const signupIndex = STEP_IDS.indexOf("signup");
      goTo(signupIndex >= 0 ? signupIndex : 0);
      Alert.alert(
        "Sign in to save your plan",
        "We couldn't confirm your account. Sign in with Apple to finish — your answers are saved.",
      );
      return { ok: false };
    }
    // Re-entry after a successful run: skip persist + seed + analytics
    // (see `persistedOnceRef` doc above) — the caller only navigates.
    if (persistedOnceRef.current?.userId === userId) {
      return persistedOnceRef.current.result;
    }
    setCompleting(true);
    try {
      // 2026-05-25 bug fix: persistOnboarding catches + returns its
      // profile-write error rather than throwing. We MUST inspect the
      // result — pre-fix this value was ignored, so a rejected write
      // (e.g. the tier-lockdown trigger firing for a paid user) was
      // invisible: the flow seeded recipes, fired `onboarding_completed`,
      // and navigated home as if the plan had saved, leaving the user on
      // their OLD target with no error. Throw into the catch below so the
      // user sees "Couldn't finish setup" and we do NOT navigate as if it
      // worked.
      const persistResult = await persistOnboarding(supabase, {
        userId,
        state,
        targets,
      });
      if (!persistResult.ok) {
        throw new Error(
          persistResult.error
            ? `We couldn't save your plan (${persistResult.error}). Please try again.`
            : "We couldn't save your plan. Please try again.",
        );
      }

      // ENG-1515 — cache the confirmed completion for the (tabs) onboarding
      // gate's fast path (the `persistOnboarding` upsert above just wrote
      // `onboarding_completed = true`). Without this, a just-completed user's
      // first (tabs) mount hits the strict gate with no cache; a slow/errored
      // post-completion DB check resolves to "unavailable" and could bounce
      // them back to /onboarding. Writing here (before both the trial-path
      // paywall push and the free-path navigation) closes that window.
      void writeOnboardingCompletedCache(userId);

      // Activation hook (audit 2026-04-30): the Recipes step was pulled
      // from the linear flow in the 15→12 shrink, so for a normal
      // completion `pickedRecipeSlugs` is empty. Without seeded recipes
      // the user lands on Today with an empty library and the
      // north-star block is permanently stuck in its empty-state — the
      // "What to eat next" promise evaporates. Seed selection is shared
      // with web-flow via `selectOnboardingSeeds`: no picks falls back to
      // a curated 5-seed default (diet/allergen-filtered) so the library
      // hits `NORTH_STAR_LIBRARY_MIN` immediately. The
      // `onboarding_default_seeds` kill switch (default-ON; read via
      // `isFeatureDisabled` so a cold PostHog doesn't skip seeding) lets
      // that fallback be rolled back on both platforms at once.
      const { seeds: pickedSeeds, usedDefaults } = selectOnboardingSeeds({
        pickedRecipeSlugs: state.pickedRecipeSlugs,
        diet: state.diet,
        allergies: state.allergies,
        seedingDisabled: isFeatureDisabled("onboarding_default_seeds"),
      });
      let planFailed = false;
      let missingCount = 0;
      let recipesSaved = 0;
      if (pickedSeeds.length > 0) {
        const resolution = await resolveSeedsToRecipeIds(supabase, pickedSeeds);
        missingCount = resolution.missing.length;
        if (resolution.resolved.length > 0) {
          // ENG-792 — capture the save result instead of discarding it. A
          // seed-save upsert failure used to be invisible (console.warn-only),
          // so a user stranded at 0 saved recipes looked identical to success.
          const saveResult = await saveResolvedSeeds(supabase, {
            userId,
            resolved: resolution.resolved,
          });
          const seedTelemetry = seedSaveTelemetry(
            saveResult,
            resolution.resolved.length,
          );
          recipesSaved = seedTelemetry.recipesSaved;
          if (seedTelemetry.failure) {
            track(AnalyticsEvents.onboarding_seed_save_failed, {
              flow: "v2",
              ...seedTelemetry.failure,
            });
          }
          if (targets) {
            const planResult = await buildFirstWeekFromSeeds(supabase, {
              userId,
              resolved: resolution.resolved,
              targets: {
                calories: targets.target,
                proteinG: targets.proteinG,
                carbsG: targets.carbsG,
                fatG: targets.fatG,
                fiberG: targets.fiberG,
              },
            });
            planFailed = !planResult.ok;
          }
        }
      }

      // Build-40 — `data_bridge_chosen` carries the LAST card actioned
      // on the data-bridges terminal step (`null` = never touched).
      // `manual_targets_set` is true only when all four manual fields
      // are populated (the override-eligible state).
      const manualTargetsSet =
        state.manualTargetsKcal != null &&
        state.manualTargetsProteinG != null &&
        state.manualTargetsCarbsG != null &&
        state.manualTargetsFatG != null;
      try {
        track(AnalyticsEvents.onboarding_completed, {
          flow: "v2",
          weight_skipped: state.weightSkipped,
          goal: state.goal,
          recipes_picked: pickedSeeds.length,
          recipes_resolved: pickedSeeds.length - missingCount,
          // ENG-792 — actually-saved count (distinct from recipes_resolved).
          // A shortfall vs recipes_resolved means the seed-save upsert failed.
          recipes_saved: recipesSaved,
          plan_built: !planFailed,
          // Activation hook (audit 2026-04-30): tracks how many users
          // hit the curated-default fallback vs hand-picked. Used to
          // monitor the activation lift after the seed-defaults ship.
          used_default_seeds: usedDefaults,
          data_bridge_chosen: state.dataBridgeChosen,
          manual_targets_set: manualTargetsSet,
          // ENG-990 — the app the user said they're switching from
          // (`null` when the user advanced without picking a tile).
          app_choice: state.appChoice,
        });
      } catch {
        /* analytics is fire-and-forget */
      }

      // MV-03: clear persisted state so a fresh signup on this device
      // doesn't pre-fill the previous user's answers.
      // 2026-05-11 (refresh-plan flow): also read the reset-plan flag
      // set by Settings → "Refresh my plan". If present, the completion
      // path surfaces a one-shot prompt offering to keep or clear the
      // user's logs and weight history. The flag is deliberately NOT
      // removed here (ENG-1507 review round): `handleComplete` consumes
      // it when the prompt actually shows. The trial path (persist →
      // paywall, prompt not shown here) must leave it in place so the
      // Keep/Clear choice can still be surfaced later instead of being
      // silently discarded.
      let refreshPlanPending = false;
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        await AsyncStorage.removeItem("suppr.onboarding-v2.state");
        const flag = await AsyncStorage.getItem("suppr.reset-plan-pending-prompt");
        if (flag) {
          refreshPlanPending = true;
        }
      } catch {
        /* non-fatal */
      }

      const result = { ok: true as const, planFailed, refreshPlanPending };
      // Cache the successful run so paywall back-out + "Continue on Free"
      // can't re-persist / re-seed / double-fire analytics.
      persistedOnceRef.current = { userId, result };
      return result;
    } catch (e) {
      setCompleting(false);
      throw e;
    }
  }, [userId, state, targets, goTo, setCompleting]);

  const handleComplete = React.useCallback(async () => {
    try {
      const persisted = await persistAndSeed();
      if (!persisted.ok) return;

      // Activation hook (audit 2026-04-30): `firstRun=1` triggers Today's
      // first-run polish; refresh-plan flow uses `refresh=1` instead (this
      // user already saw it). ENG-1450: `firstLogDeepLinkQs` appends the
      // `?openLog=1` LogSheet deep-link so a chip pick on "One quick win"
      // isn't silently dropped (see helper doc for the full rationale).
      const baseQs = persisted.planFailed
        ? "?onboarding_complete=1&plan_build=failed"
        : "?onboarding_complete=1";
      const homeQs =
        (persisted.refreshPlanPending ? `${baseQs}&refresh=1` : `${baseQs}&firstRun=1`) +
        firstLogDeepLinkQs(state.firstLogChoice);

      if (persisted.refreshPlanPending) {
        // ENG-1507 (review round) — consume the one-shot flag only NOW,
        // when the prompt actually shows. `persistAndSeed` no longer
        // deletes it, so a trial-path run that never reaches this prompt
        // leaves the flag intact for a later completion to surface.
        try {
          const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
          await AsyncStorage.removeItem("suppr.reset-plan-pending-prompt");
        } catch {
          /* non-fatal */
        }
        Alert.alert(
          "Keep my logs and weight history?",
          "Your saved recipes, plans, and shopping lists are untouched either way.",
          [
            {
              text: "Keep",
              style: "default",
              onPress: () => {
                router.replace(`/(tabs)${homeQs}` as any);
              },
            },
            {
              text: "Clear",
              style: "destructive",
              onPress: async () => {
                try {
                  if (userId) await clearLogsAndWeightHistory(supabase, userId);
                } catch {
                  /* non-fatal — user can still re-enter Today */
                }
                router.replace(`/(tabs)${homeQs}` as any);
              },
            },
          ],
          { cancelable: false },
        );
        return;
      }

      router.replace(`/(tabs)${homeQs}` as any);
    } catch (e) {
      Alert.alert(
        "Couldn't finish setup",
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    }
  }, [persistAndSeed, state.firstLogChoice, router, userId]);

  return { persistAndSeed, handleComplete };
}
