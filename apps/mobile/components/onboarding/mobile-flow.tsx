import * as React from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StatusBar,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { track } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";
import { AnalyticsEvents } from "../../../../src/lib/analytics/events";
import {
  ONBOARDING_SEEDS,
  defaultOnboardingSeeds,
  type OnboardingSeed,
} from "../../../../src/lib/onboarding/onboardingSeeds";
import { buildFirstWeekFromSeeds } from "../../../../src/lib/onboarding/onboardingFirstWeek";
import {
  resolveSeedsToRecipeIds,
  saveResolvedSeeds,
} from "../../../../src/lib/onboarding/onboardingSeedResolver";
import {
  mapV2GoalToLegacy,
  persistOnboarding,
} from "../../../../src/lib/onboarding/persist";
import { clearLogsAndWeightHistory } from "../../../../src/lib/account/nukeAccountData";
import { useOnboarding } from "./context";
import { MOBILE_STEP_COMPONENTS } from "./steps";

void mapV2GoalToLegacy;

/**
 * Mobile flow shell — full-screen stack of step views with a top bar
 * (back + progress + counter) and a footer Continue button. Welcome
 * takes the whole canvas; every other step uses the shell.
 *
 * Mirrors the web shell at
 * `src/app/components/onboarding/web-flow.tsx`. No narrative
 * column on mobile by design — the iPhone safe area can't carry it.
 */

export function MobileFlow() {
  const {
    currentStepId,
    displayIndex,
    displayTotal,
    go,
    canAdvance,
    state,
    targets,
    warning,
    isRefreshPlan,
  } = useOnboarding();
  const colors = useThemeColors();
  // Debug audit 2026-05-04 (visual-qa): the welcome step uses a dark
  // gradient where `light-content` (white status-bar icons) is correct,
  // but every subsequent step renders on `colors.background` — light
  // grey in light mode, near-black in dark mode. Hardcoding
  // `light-content` made the status-bar time/battery/wifi invisible on
  // 11 of 12 steps for users in light mode. Now we follow the system
  // theme for non-welcome steps.
  const colorScheme = useColorScheme();
  const isDarkSystem = colorScheme === "dark";
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const StepComponent = MOBILE_STEP_COMPONENTS[currentStepId];
  const isWelcome = currentStepId === "welcome";
  const [completing, setCompleting] = React.useState(false);

  // Build-40 (2026-05-01): `data-bridges` is the new terminal step.
  // Reveal advances on Continue → data-bridges; data-bridges fires
  // the `handleComplete` write path on its "Build my plan" CTA. See
  // `state.ts` STEP_IDS comment for rationale.
  const isTerminal = currentStepId === "data-bridges";
  const isSignup = currentStepId === "signup";

  // MV-02 auto-skip (audit 2026-04-28): when an already-authed user
  // (returning visitor with a Supabase session in cache) lands on the
  // signup step, bump them past it. Mirrors web-flow.tsx:67-71. Without
  // this, an authed user who hits onboarding to re-set targets would
  // be asked to sign up again.
  React.useEffect(() => {
    if (isSignup && userId) {
      go(1);
    }
  }, [isSignup, userId, go]);

  // Refresh-plan auto-skip (audit 2026-05-12 — Grace cohort): when the
  // user reached onboarding via Settings → "Refresh my plan", the
  // Welcome step's first-impression sell ("Eat well, without
  // overthinking it.", "Have an account? Sign in") makes zero sense.
  // They're already signed in, already an existing user, just resetting
  // their plan. Auto-skip Welcome straight to Goal. The reset-pending
  // flag is consumed (cleared) at handleComplete; here we only react to
  // the value the OnboardingProvider read on mount (see context.tsx).
  React.useEffect(() => {
    if (isWelcome && isRefreshPlan === true) {
      go(1);
    }
  }, [isWelcome, isRefreshPlan, go]);

  /**
   * MV-01 fix (audit 2026-04-28) — terminal-step completion handler.
   *
   * Mirrors `src/app/components/onboarding/web-flow.tsx#handleComplete`:
   *   1. `persistOnboarding(supabase, { userId, state, targets })` —
   *      writes the user's profile + dietary + targets.
   *   2. If `pickedRecipeSlugs.length > 0` and seeds resolve against
   *      `recipes`, save them to `saves` and build the first week's
   *      meal plan via `buildFirstWeekFromSeeds`.
   *   3. Fire the canonical `onboarding_completed` event.
   *   4. Clear the AsyncStorage persistence so the next user on this
   *      device starts fresh.
   *   5. `router.replace("/(tabs)")` with a query string the Today
   *      screen can read to surface a toast on plan-build failure.
   *
   * Pre-fix the Continue button on the terminal step ran `go(1)`,
   * which clamped to `TOTAL_STEPS - 1` and was a no-op — the user was
   * stuck on the recipes step forever.
   */
  const handleComplete = React.useCallback(async () => {
    if (!userId) {
      track(AnalyticsEvents.onboarding_completed, {
        flow: "v2",
        unauthenticated: true,
      });
      router.replace("/login");
      return;
    }
    setCompleting(true);
    try {
      await persistOnboarding(supabase, {
        userId,
        state,
        targets,
      });

      // Activation hook (audit 2026-04-30): the Recipes step was pulled
      // from the linear flow in the 15→12 shrink, so for a normal
      // completion `pickedRecipeSlugs` is empty. Without seeded recipes
      // the user lands on Today with an empty library and the
      // north-star block is permanently stuck in its empty-state — the
      // "What to eat next" promise evaporates. When the user hasn't
      // picked any recipes we fall back to a curated 5-seed default
      // (`defaultOnboardingSeeds`) so the library hits the
      // `NORTH_STAR_LIBRARY_MIN` threshold immediately. The default
      // honours the user's diet/allergens — see `defaultOnboardingSeeds`
      // in `src/lib/onboarding/onboardingSeeds.ts`.
      const pickedSeeds: OnboardingSeed[] =
        state.pickedRecipeSlugs.length > 0
          ? ONBOARDING_SEEDS.filter((s) =>
              state.pickedRecipeSlugs.includes(s.slug),
            )
          : Array.from(
              defaultOnboardingSeeds({
                diet: state.diet,
                allergies: state.allergies,
              }),
            );
      const usedDefaults = state.pickedRecipeSlugs.length === 0;
      let planFailed = false;
      let missingCount = 0;
      if (pickedSeeds.length > 0) {
        const resolution = await resolveSeedsToRecipeIds(supabase, pickedSeeds);
        missingCount = resolution.missing.length;
        if (resolution.resolved.length > 0) {
          await saveResolvedSeeds(supabase, {
            userId,
            resolved: resolution.resolved,
          });
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
          plan_built: !planFailed,
          // Activation hook (audit 2026-04-30): tracks how many users
          // hit the curated-default fallback vs hand-picked. Used to
          // monitor the activation lift after the seed-defaults ship.
          used_default_seeds: usedDefaults,
          data_bridge_chosen: state.dataBridgeChosen,
          manual_targets_set: manualTargetsSet,
        });
      } catch {
        /* analytics is fire-and-forget */
      }

      // MV-03: clear persisted state so a fresh signup on this device
      // doesn't pre-fill the previous user's answers.
      // 2026-05-11 (refresh-plan flow): also read the reset-plan flag
      // set by Settings → "Refresh my plan". If present, we surface a
      // one-shot prompt offering to keep or clear the user's logs and
      // weight history. Falls through to the normal post-onboarding
      // route on either choice.
      let refreshPlanPending = false;
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        await AsyncStorage.removeItem("suppr.onboarding-v2.state");
        const flag = await AsyncStorage.getItem("suppr.reset-plan-pending-prompt");
        if (flag) {
          refreshPlanPending = true;
          await AsyncStorage.removeItem("suppr.reset-plan-pending-prompt");
        }
      } catch {
        /* non-fatal */
      }

      // Activation hook (audit 2026-04-30): always pass `firstRun=1` on
      // the post-onboarding land so Today can fire its first-run
      // polish (push-permission explainer, ring-celebration, etc.)
      // without re-querying `onboarding_completed`. For a refresh-plan
      // flow we drop `firstRun` (this user already saw the polish) and
      // tag the navigation with `refresh=1` so analytics can split
      // first-time vs refresh completions.
      const baseQs = planFailed
        ? "?onboarding_complete=1&plan_build=failed"
        : "?onboarding_complete=1";
      const homeQs = refreshPlanPending
        ? `${baseQs}&refresh=1`
        : `${baseQs}&firstRun=1`;

      if (refreshPlanPending) {
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
                  await clearLogsAndWeightHistory(supabase, userId);
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
      setCompleting(false);
      Alert.alert(
        "Couldn't finish setup",
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    }
  }, [userId, state, targets, router]);

  // Stage E — fire the soft-warn `advanced` analytics event when the
  // user taps Continue from the Pace step while a warning is showing.
  // The matching `shown` event fires from inside MobilePaceStep on
  // banner mount/reason change.
  const handleContinue = React.useCallback(() => {
    if (currentStepId === "pace" && warning && targets) {
      track(AnalyticsEvents.onboarding_pace_below_safety_floor, {
        acted: "advanced",
        level: warning.level,
        reason: warning.reason,
        pace_kg_per_week: targets.pace,
        projected_target_kcal: targets.target,
        sex: state.sex,
        // Stage F (legal-reviewer sign-off) — only the danger level
        // requires the acknowledgement checkbox.
        acknowledged:
          warning.level === "danger"
            ? state.paceDangerAcknowledged
            : null,
      });
    }
    // MV-01: terminal step routes through the completion handler
    // instead of `go(1)` (which would clamp at TOTAL_STEPS-1 and
    // silently no-op).
    if (isTerminal) {
      void handleComplete();
      return;
    }
    // Audit 2026-05-12 (Grace TF): on refresh-plan flow, skip
    // data-bridges entirely. The Apple-Health-connect + manual-targets
    // paste page only earns its place on first-run onboarding — a
    // returning user refreshing their plan has already chosen these
    // bridges (and the "Suppr never writes to Health" copy is also
    // misleading once we've shipped the Apple Health export). Jump
    // straight from reveal → handleComplete so the user lands back on
    // Today the moment they confirm their new targets.
    if (currentStepId === "reveal" && isRefreshPlan === true) {
      void handleComplete();
      return;
    }
    go(1);
  }, [
    currentStepId,
    warning,
    targets,
    state.sex,
    state.paceDangerAcknowledged,
    go,
    isTerminal,
    isRefreshPlan,
    handleComplete,
  ]);

  // Welcome uses its own layout (full-bleed gradient, own CTA).
  //
  // Audit 2026-05-12 (Grace cohort, refresh-plan flow): when the
  // user arrived via Settings → "Refresh my plan", we don't want to
  // flash the "Eat well, without overthinking it." + "Have an
  // account? Sign in" first-impression screen before the
  // auto-skip useEffect fires. Render a neutral loading shell while
  // we read the reset-plan flag, then either auto-skip (handled by
  // the effect above) or render the real Welcome.
  if (isWelcome) {
    if (isRefreshPlan === null || isRefreshPlan === true) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <StatusBar barStyle={isDarkSystem ? "light-content" : "dark-content"} />
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar barStyle="light-content" />
        <StepComponent />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDarkSystem ? "light-content" : "dark-content"} />

      {/* Top bar */}
      <View
        style={{
          paddingTop: Platform.OS === "ios" ? 54 : 16,
          paddingBottom: 14,
          paddingHorizontal: Spacing.xl,
        }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
        >
          <Pressable
            onPress={() => go(-1)}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.inputBg,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>

          {/* Customer-lens shrink (2026-04-30): the numeric counter
              ("12/12" / formerly "1/15…15/15") is removed because
              N-of-15 anchored testers on remaining work and was the
              highest single-friction signal in the audit. The progress
              bar still gives a "I'm partway through" sense without
              naming a hard total — Cal AI / MFP / Lifesum all use
              progress-only on their flows. */}
          <ProgressBar value={displayIndex} total={displayTotal} />

          {/* Audit 2026-05-12 (Grace cohort): when a signed-in user
              arrived via Settings → "Refresh my plan", surface a calm
              pill so they can tell at a glance this is a plan reset,
              not first-run onboarding. Otherwise the body-stats /
              Goal screens look identical to a fresh signup and the
              user wonders if they accidentally created a new account. */}
          {isRefreshPlan === true ? (
            <View
              style={{
                marginLeft: Spacing.sm,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: `${Accent.primaryLight}1f`,
                borderWidth: 1,
                borderColor: `${Accent.primaryLight}40`,
              }}
              accessibilityLabel="Refreshing your plan"
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 0.6,
                  color: Accent.primaryLight,
                }}
              >
                REFRESH PLAN
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Step body — scrolls independently */}
      <View style={{ flex: 1 }}>
        <StepComponent compact />
      </View>

      {/* Footer Continue */}
      <View
        style={{
          paddingHorizontal: Spacing.xl,
          paddingTop: 14,
          paddingBottom: Platform.OS === "ios" ? 38 : 24,
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: "transparent",
        }}
      >
        <Pressable
          onPress={handleContinue}
          disabled={completing || !canAdvance}
          accessibilityRole="button"
          accessibilityLabel={isTerminal ? "Build my plan" : "Continue"}
          accessibilityState={{
            disabled: completing || !canAdvance,
          }}
          style={({ pressed }) => {
            const isDisabled = completing || !canAdvance;
            return {
              height: 56,
              borderRadius: 14,
              // Disabled uses `inputBg` — a slightly tinted card surface
              // distinct from the page bg. Earlier iterations swung
              // between two failure modes: `opacity: 0.4` on Accent.primary
              // (washed-out lavender that read as still-active blue) and
              // `colors.border` (too close to the page bg in dark mode,
              // testers tapped a "disabled" button thinking it was active).
              // `inputBg` sits between the two — clearly inert without
              // disappearing into the backdrop. (audit 2026-04-30 medium
              // polish.)
              backgroundColor: isDisabled ? colors.inputBg : Accent.primary,
              alignItems: "center",
              justifyContent: "center",
              opacity: isDisabled ? 1 : pressed ? 0.9 : 1,
            };
          }}
        >
          {completing ? (
            <ActivityIndicator color={Accent.primaryForeground} />
          ) : (
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: !canAdvance ? colors.textTertiary : Accent.primaryForeground,
              }}
            >
              {isTerminal ? "Build my plan" : "Continue"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function ProgressBar({ value, total }: { value: number; total: number }) {
  const colors = useThemeColors();
  const pct = Math.max(4, (value / Math.max(1, total)) * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ now: value, min: 0, max: total }}
      style={{
        flex: 1,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.inputBg,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: 2,
          backgroundColor: Accent.primary,
        }}
      />
    </View>
  );
}
