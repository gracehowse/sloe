import * as React from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StatusBar, Text, View } from "react-native";
// App-resolved scheme (NOT the raw OS scheme) — see hooks/use-color-scheme.
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled, track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { canAdvance as canAdvanceStep } from "@/lib/onboarding";
import { APP_CHOICE_FLAG, CONVERSION_FUNNEL_FLAG, useOnboarding } from "./context";
import { MOBILE_STEP_COMPONENTS } from "./steps";
import { OnboardingSegmentedProgress } from "./OnboardingSegmentedProgress";
import { useOnboardingCompletion } from "./useOnboardingCompletion";

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
    goTo,
    state,
    targets,
    warning,
    isRefreshPlan,
    registerComplete,
    registerPersist,
  } = useOnboarding();
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the footer Continue
  // CTA, its foreground, and the refresh-plan pill. The back chevron, progress
  // track, and disabled-state surfaces keep their own theme tokens.
  const accent = useAccent();
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

  // ENG-672 (2026-05-26) — the footer Continue is gated on a REAL
  // Supabase session, not just the shared per-step validation. The
  // context's `canAdvance` is auth-agnostic (it can't reach the mobile
  // auth context without coupling the shared provider to it), so the
  // Signup step's `canAdvance("signup", …)` returns `false` by default.
  // We re-run the shared validator HERE with `hasSession` threaded from
  // the live auth context so the button enables the moment Apple
  // Sign-In lands a session — and stays disabled before that. Every
  // other step is unchanged (their rules don't read `hasSession`).
  const canAdvance = canAdvanceStep(currentStepId, state, {
    paceWarning: warning,
    hasSession: userId != null,
  });
  const isWelcome = currentStepId === "welcome";
  const [completing, setCompleting] = React.useState(false);

  // Build-40 / ENG-1241: `data-bridges` terminal when funnel OFF;
  // `upgrade` (the "See Pro" ask) terminal when ON (funnel runs
  // first-log → upgrade, so skip → Today is a clean completion).
  const conversionFunnelEnabled = isFeatureEnabled(CONVERSION_FUNNEL_FLAG);
  const isUpgrade = currentStepId === "upgrade";
  const isFirstLog = currentStepId === "first-log";
  const isTerminal = conversionFunnelEnabled
    ? currentStepId === "upgrade"
    : currentStepId === "data-bridges";
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

  // ENG-990 — the app-choice step is flag-gated. `go()` already skips it
  // when the flag is OFF, but a user whose persisted AsyncStorage `step`
  // points at app-choice (reached it while the flag was ON, then it was
  // ramped back to 0) would render it directly on remount. Defensive
  // auto-skip, same shape as the signup already-authed skip above.
  // `isFeatureEnabled` is cold-safe (false → skip), and we also skip it
  // on refresh-plan (a returning user resetting their plan has no app to
  // switch from).
  const isAppChoice = currentStepId === "app-choice";
  React.useEffect(() => {
    if (isAppChoice && (!isFeatureEnabled(APP_CHOICE_FLAG) || isRefreshPlan === true)) {
      go(1);
    }
  }, [isAppChoice, isRefreshPlan, go]);

  // ENG-1241 defensive auto-skip: funnel steps (first-log → upgrade) sit
  // at the tail, so a persisted hidden step with the flag OFF must step
  // BACK to the legacy terminal (data-bridges); resolveNextStep composes.
  React.useEffect(() => {
    if ((isUpgrade || isFirstLog) && !conversionFunnelEnabled) {
      go(-1);
    }
  }, [isUpgrade, isFirstLog, conversionFunnelEnabled, go]);

  // ENG-1241 — register the terminal completion path so the terminal
  // `upgrade` step's "Continue on Free" lands on Today directly (no
  // detour). Re-registers each render to capture the latest closure.
  React.useEffect(() => {
    registerComplete(() => {
      void handleComplete();
    });
  });

  // ENG-1507 — register the persist-without-navigation path so the
  // terminal `upgrade` step's "Start free trial" can land the profile
  // write BEFORE pushing the paywall (closing the trial-path persist
  // hole). Failures alert here and resolve `false` so the step stays
  // mounted instead of routing to a paywall that would render stale data.
  React.useEffect(() => {
    registerPersist(async () => {
      try {
        const persisted = await persistAndSeed();
        // Unlike the completion path (which navigates away), the flow stays
        // mounted beneath the pushed paywall — release the busy state so a
        // back-gesture return never lands on a dead Continue button.
        setCompleting(false);
        return persisted.ok;
      } catch (e) {
        Alert.alert(
          "Couldn't finish setup",
          e instanceof Error
            ? e.message
            : "Something went wrong. Please try again.",
        );
        return false;
      }
    });
  });

  // ENG-1 — fire onboarding_started once when a new user first sees the
  // Welcome step. Excluded for refresh-plan flow (isRefreshPlan is null
  // while loading, true for refresh, false for new users).
  const startedFired = React.useRef(false);
  React.useEffect(() => {
    if (isWelcome && isRefreshPlan === false && !startedFired.current) {
      startedFired.current = true;
      track(AnalyticsEvents.onboarding_started, { platform: "mobile" });
    }
  }, [isWelcome, isRefreshPlan]);

  // MV-01 / ENG-1507 — the terminal completion pipeline (persistAndSeed +
  // navigating handleComplete) lives in `useOnboardingCompletion` (extracted
  // 2026-07-11 to keep this shell under its line budget; full history +
  // the trial-path persist-hole rationale in that file's doc block).
  const { persistAndSeed, handleComplete } = useOnboardingCompletion({
    userId,
    state,
    targets,
    goTo,
    setCompleting,
    router,
  });

  // Stage E — fire the soft-warn `advanced` analytics event when the
  // user taps Continue from the Pace step while a warning is showing.
  // The matching `shown` event fires from inside MobilePaceStep on
  // banner mount/reason change.
  const handleContinue = React.useCallback(() => {
    // ENG-1 — fire step completion for all non-welcome steps. Welcome
    // fires its own event from its CTA (welcome.tsx) because it calls
    // go(1) directly rather than routing through this handler.
    track(AnalyticsEvents.onboarding_step_completed, {
      step_id: currentStepId,
      step_index: displayIndex,
      step_total: displayTotal,
      platform: "mobile",
    });
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
    displayIndex,
    displayTotal,
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
          paddingBottom: Spacing.md,
          paddingHorizontal: Spacing.xl,
        }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: Spacing.md }}
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
            <ChevronLeft size={18} color={colors.text} />
          </Pressable>

          {/* Customer-lens shrink (2026-04-30): the numeric counter
              ("12/12" / formerly "1/15…15/15") is removed because
              N-of-15 anchored testers on remaining work and was the
              highest single-friction signal in the audit. The progress
              bar still gives a "I'm partway through" sense without
              naming a hard total — Cal AI / MFP / Lifesum all use
              progress-only on their flows. */}
          <OnboardingSegmentedProgress value={displayIndex} total={displayTotal} />

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
                paddingHorizontal: Spacing.dense,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: `${accent.primaryLight}1f`,
                borderWidth: 1,
                borderColor: `${accent.primaryLight}40`,
              }}
              accessibilityLabel="Refreshing your plan"
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 0.6,
                  color: accent.primaryLight,
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

      {/* Footer Continue.
          ENG-672 (2026-05-26): suppressed on the Signup step — parity
          with the web shell's `!isSignup` guard. The Signup step owns
          its own "Sign in with Apple" CTA; showing a disabled footer
          Continue alongside it read as a dead-end (the user couldn't
          tell which button advanced the flow). The shared
          `canAdvance("signup", …)` gate still keeps the footer inert
          until a session lands — this just removes the confusing inert
          control entirely on that one step.
          ENG-1241: also suppressed on the terminal `upgrade` step — it
          owns its own "Start free trial" + "Continue on Free" CTAs, so a
          footer "Build my plan" would be a competing control that muddies
          the skip affordance (legal C4). */}
      {isSignup || (isUpgrade && conversionFunnelEnabled) ? null : (
      <View
        style={{
          paddingHorizontal: Spacing.xl,
          paddingTop: Spacing.md,
          paddingBottom: Platform.OS === "ios" ? Spacing.xxxl : Spacing.xl,
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: "transparent",
        }}
      >
        <Pressable
          onPress={handleContinue}
          disabled={completing || !canAdvance}
          accessibilityRole="button"
          accessibilityLabel={
            isTerminal
              ? isRefreshPlan === true
                ? "Refresh my plan"
                : "Build my plan"
              : "Continue"
          }
          accessibilityState={{
            disabled: completing || !canAdvance,
          }}
          style={({ pressed }) => {
            const isDisabled = completing || !canAdvance;
            return {
              height: 56,
              borderRadius: 999,
              // Disabled uses `inputBg` — a slightly tinted card surface
              // distinct from the page bg. Earlier iterations swung
              // between two failure modes: `opacity: 0.4` on Accent.primary
              // (washed-out lavender that read as still-active blue) and
              // `colors.border` (too close to the page bg in dark mode,
              // testers tapped a "disabled" button thinking it was active).
              // `inputBg` sits between the two — clearly inert without
              // disappearing into the backdrop. (audit 2026-04-30 medium
              // polish.)
              backgroundColor: isDisabled ? colors.inputBg : accent.primary,
              alignItems: "center",
              justifyContent: "center",
              opacity: isDisabled ? 1 : pressed ? 0.9 : 1,
            };
          }}
        >
          {completing ? (
            <ActivityIndicator color={accent.primaryForeground} />
          ) : (
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: !canAdvance ? colors.textTertiary : accent.primaryForeground,
              }}
            >
              {isTerminal
                ? isRefreshPlan === true
                  ? "Refresh my plan"
                  : isFirstLog
                    ? "Go to Today"
                    : "Build my plan"
                : "Continue"}
            </Text>
          )}
        </Pressable>
      </View>
      )}
    </View>
  );
}
