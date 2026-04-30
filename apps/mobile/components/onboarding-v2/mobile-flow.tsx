import * as React from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StatusBar,
  Text,
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
  type OnboardingSeed,
} from "../../../../src/lib/onboarding/onboardingSeeds";
import { buildFirstWeekFromSeeds } from "../../../../src/lib/onboarding/onboardingFirstWeek";
import {
  resolveSeedsToRecipeIds,
  saveResolvedSeeds,
} from "../../../../src/lib/onboarding/onboardingSeedResolver";
import {
  mapV2GoalToLegacy,
  persistOnboardingV2,
} from "../../../../src/lib/onboarding/v2/persist";
import { useOnboardingV2 } from "./context";
import { MOBILE_STEP_COMPONENTS } from "./steps";
import { derivePickerState } from "../../../../src/lib/onboarding/v2/finalStep";

void mapV2GoalToLegacy;

/**
 * Mobile flow shell — full-screen stack of step views with a top bar
 * (back + progress + counter) and a footer Continue button. Welcome
 * takes the whole canvas; every other step uses the shell.
 *
 * Mirrors the web shell at
 * `src/app/components/onboarding-v2/web-flow.tsx`. No narrative
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
  } = useOnboardingV2();
  const colors = useThemeColors();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const StepComponent = MOBILE_STEP_COMPONENTS[currentStepId];
  const isWelcome = currentStepId === "welcome";
  const [completing, setCompleting] = React.useState(false);

  const isTerminal = currentStepId === "recipes";
  const isSignup = currentStepId === "signup";
  const pickerState = React.useMemo(
    () => derivePickerState(new Set(state.pickedRecipeSlugs ?? [])),
    [state.pickedRecipeSlugs],
  );

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

  /**
   * MV-01 fix (audit 2026-04-28) — terminal-step completion handler.
   *
   * Mirrors `src/app/components/onboarding-v2/web-flow.tsx#handleComplete`:
   *   1. `persistOnboardingV2(supabase, { userId, state, targets })` —
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
      await persistOnboardingV2(supabase, {
        userId,
        state,
        targets,
      });

      const pickedSeeds: OnboardingSeed[] = ONBOARDING_SEEDS.filter((s) =>
        state.pickedRecipeSlugs.includes(s.slug),
      );
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

      try {
        track(AnalyticsEvents.onboarding_completed, {
          flow: "v2",
          weight_skipped: state.weightSkipped,
          goal: state.goal,
          recipes_picked: pickedSeeds.length,
          recipes_resolved: pickedSeeds.length - missingCount,
          plan_built: !planFailed,
        });
      } catch {
        /* analytics is fire-and-forget */
      }

      // MV-03: clear persisted state so a fresh signup on this device
      // doesn't pre-fill the previous user's answers.
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        await AsyncStorage.removeItem("suppr.onboarding-v2.state");
      } catch {
        /* non-fatal */
      }

      const homeQs = planFailed
        ? "?onboarding_complete=1&plan_build=failed"
        : "?onboarding_complete=1";
      router.replace(`/(tabs)${homeQs}`);
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
    go(1);
  }, [
    currentStepId,
    warning,
    targets,
    state.sex,
    state.paceDangerAcknowledged,
    go,
    isTerminal,
    handleComplete,
  ]);

  // Welcome uses its own layout (full-bleed gradient, own CTA).
  if (isWelcome) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar barStyle="light-content" />
        <StepComponent />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />

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

          <ProgressBar value={displayIndex} total={displayTotal} />

          <Text
            style={{
              fontSize: 11,
              color: colors.textSecondary,
              fontWeight: "700",
              fontVariant: ["tabular-nums"],
              letterSpacing: 0.2,
              minWidth: 28,
              textAlign: "right",
            }}
          >
            {displayIndex}/{displayTotal}
          </Text>
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
          disabled={
            completing || !canAdvance || (isTerminal && !pickerState.canSubmit)
          }
          accessibilityRole="button"
          accessibilityLabel={isTerminal ? pickerState.ctaLabel : "Continue"}
          accessibilityState={{
            disabled:
              completing || !canAdvance || (isTerminal && !pickerState.canSubmit),
          }}
          style={({ pressed }) => {
            const isDisabled =
              completing || !canAdvance || (isTerminal && !pickerState.canSubmit);
            return {
              height: 56,
              borderRadius: 14,
              // Disabled uses a neutral grey so it's clearly inert. The
              // prior `opacity: 0.4` on Accent.primary rendered as a
              // washed-out lavender that read as "still active blue" at
              // a glance (audit 2026-04-30 visual-qa P2).
              backgroundColor: isDisabled ? colors.border : Accent.primary,
              alignItems: "center",
              justifyContent: "center",
              opacity: isDisabled ? 1 : pressed ? 0.9 : 1,
            };
          }}
        >
          {completing ? (
            <ActivityIndicator color="#0a0a0f" />
          ) : (
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color:
                  !canAdvance || (isTerminal && !pickerState.canSubmit)
                    ? colors.textTertiary
                    : "#0a0a0f",
              }}
            >
              {isTerminal ? pickerState.ctaLabel : "Continue"}
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
