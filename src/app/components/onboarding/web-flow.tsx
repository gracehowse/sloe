"use client";

import * as React from "react";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { Button } from "@/app/components/ui/button";
import { SupprWordmark } from "@/app/components/ui/suppr-mark";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";
import { useAuthSession } from "@/context/AuthSessionContext";
import { supabase } from "@/lib/supabase/browserClient";
import { saveLocalProfile } from "@/lib/profile/profileStorage";
import { type UserProfile } from "@/types/profile";
import { useOnboarding } from "./context";
import { STEP_COMPONENTS } from "./steps";
import { NARRATIVE } from "./narrative";
import { STEP_IDS, canAdvance as canAdvanceStep } from "@/lib/onboarding/state";
import {
  effectiveTargetsForPersist,
  mapV2GoalToLegacy,
  persistOnboarding,
} from "@/lib/onboarding/persist";
import {
  ONBOARDING_SEEDS,
  type OnboardingSeed,
} from "@/lib/onboarding/onboardingSeeds";
import {
  resolveSeedsToRecipeIds,
  saveResolvedSeeds,
} from "@/lib/onboarding/onboardingSeedResolver";
import { buildFirstWeekFromSeeds } from "@/lib/onboarding/onboardingFirstWeek";

/**
 * Web flow shell — split layout with a narrative left column and an
 * interactive card on the right. The Welcome step takes the whole
 * canvas; every other step uses the split. Mobile (Stage D) uses a
 * different shell.
 *
 * The route component (`app/onboarding/v2/page.tsx`) wraps this in
 * `<OnboardingProvider>` so the shell stays unconditional and easy
 * to mount inside the dev preview.
 */

export function WebFlow() {
  const { currentStepId, displayIndex, displayTotal, go, goTo, state, targets, warning } =
    useOnboarding();
  const { authedUserId } = useAuthSession();
  // ENG-672 (2026-05-26) — recompute `canAdvance` HERE with the live
  // session threaded in, mirroring mobile-flow.tsx. The shared context's
  // `canAdvance` is auth-agnostic (the provider deliberately can't reach
  // the web auth context — see the auto-skip comment below), so the
  // Signup step's `canAdvance("signup", …)` defaults to `false`. Threading
  // `hasSession` makes the gate genuine defence-in-depth rather than relying
  // on footer suppression alone: the Continue stays inert until a real
  // Supabase session exists. Every other step is unchanged (their rules
  // don't read `hasSession`).
  const canAdvance = canAdvanceStep(currentStepId, state, {
    paceWarning: warning,
    hasSession: authedUserId != null,
  });
  const StepComponent = STEP_COMPONENTS[currentStepId];
  const isWelcome = currentStepId === "welcome";
  const isSignup = currentStepId === "signup";
  // Build-40 (2026-05-01): `data-bridges` is the new terminal step.
  // Reveal advances on Continue; data-bridges fires the
  // `handleComplete` write path on its "Build my plan" CTA. See
  // `state.ts` STEP_IDS comment for the customer-lens audit drivers.
  const isTerminal = currentStepId === "data-bridges";
  const [completing, setCompleting] = React.useState(false);
  // completionStatus is set just before window.location.href fires —
  // useful for tests (the bounce navigates immediately so no UI
  // surface reads it post-set in a real session).
  const [, setCompletionStatus] = React.useState<
    null | { ok: boolean; planFailed?: boolean; missingCount?: number }
  >(null);
  // 2026-05-25 bug fix — surface a failed profile write on the terminal
  // step. Pre-fix `persistOnboarding`'s error was ignored and we bounced
  // to /home as if the plan had saved (the same swallowed-write bug that
  // left paid users on their OLD target). Now we render this message and
  // keep the user on the step so they can retry.
  const [completionError, setCompletionError] = React.useState<string | null>(null);

  // Auto-skip the signup step when the visitor is already authed (e.g.
  // they came from /signin → /onboarding directly). The step renders
  // an "already signed in — continue" affordance as a defensive
  // fallback, but in practice this effect bumps past it before the
  // user sees it. Single-render flicker is acceptable; the alternative
  // (pushing auth state into the shared `state.ts` skip logic) would
  // couple the mobile flow to web auth.
  React.useEffect(() => {
    if (isSignup && authedUserId) {
      go(1);
    }
  }, [isSignup, authedUserId, go]);

  // ENG-1 — fire onboarding_started once when a new user first sees the
  // Welcome step. Web has no refresh-plan concept, so no guard needed.
  const startedFired = React.useRef(false);
  React.useEffect(() => {
    if (isWelcome && !startedFired.current) {
      startedFired.current = true;
      track(AnalyticsEvents.onboarding_started, { platform: "web" });
    }
  }, [isWelcome]);

  /**
   * OB2-1 — terminal-step completion handler. Mirrors the legacy
   * `app/onboarding/page.tsx:handleSubmit` write flow so a v2
   * completer ends up with the same `profiles` row + local profile
   * cache + analytics emit + dashboard redirect. data-integrity
   * Stage F sign-off applied (target_calories_source = "onboarding"
   * not "onboarding_v2"; no daily_targets snapshot from this path;
   * no target_water_ml column).
   *
   * If the user isn't authenticated when they complete (e.g. they
   * URL-stuffed /onboarding/v2 without signing up), we skip the
   * upsert and bounce them to /signup with a return-to-onboarding
   * intent. Local profile still saves so the values aren't lost.
   */
  const handleComplete = React.useCallback(async () => {
    setCompleting(true);
    setCompletionError(null);
    try {
      // Build-40 (2026-05-01) — local profile mirrors the manual-target
      // override path. `effectiveTargetsForPersist` returns the manual
      // values when all four are set, otherwise the computed targets.
      const effective = effectiveTargetsForPersist(state, targets);
      // Always save local first — UX still works if Supabase is down
      // or the user is unauthenticated.
      const localProfile: UserProfile = {
        id: authedUserId ?? "",
        displayName: state.name.trim() ? state.name.trim() : null,
        avatarUrl: null,
        userTier: "free",
        dietary: state.diet,
        measurementSystem: state.unitSystem,
        age: state.age,
        heightCm: state.heightCm,
        weightKg: state.weightSkipped ? null : state.weightKg,
        sex: state.sex,
        activityLevel: state.activity,
        goal: state.goal ? mapV2GoalToLegacy(state.goal) : null,
        targets: effective
          ? {
              calories: effective.target,
              protein: effective.proteinG,
              carbs: effective.carbsG,
              fat: effective.fatG,
              fiber: effective.fiberG,
              waterMl: 2400,
            }
          : null,
        preferActivityAdjustedCalories: false,
      };
      try {
        saveLocalProfile(localProfile);
      } catch {
        /* localStorage unavailable (private mode etc.) — non-fatal */
      }

      if (authedUserId) {
        const persistResult = await persistOnboarding(supabase, {
          userId: authedUserId,
          state,
          targets,
        });
        if (!persistResult.ok) {
          // 2026-05-25 bug fix — parity with mobile-flow handleComplete.
          // Don't seed recipes / fire onboarding_completed / navigate to
          // /home when the profile row itself didn't save. The `finally`
          // below resets `completing`; we keep the user on the step.
          setCompletionStatus({ ok: false });
          setCompletionError(
            persistResult.error
              ? `We couldn't save your plan (${persistResult.error}). Please try again.`
              : "We couldn't save your plan. Please try again.",
          );
          return;
        }

        // Phase 5 / B2.3 — seed-and-plan flow per spec Surface F.
        // Best-effort: each step is independently observable so a
        // partial failure (resolve miss / plan-build fail) still
        // bounces the user to /home with a clear toast caller.
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
              userId: authedUserId,
              resolved: resolution.resolved,
            });
            if (targets) {
              const planResult = await buildFirstWeekFromSeeds(supabase, {
                userId: authedUserId,
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

        setCompletionStatus({ ok: true, planFailed, missingCount });

        track(AnalyticsEvents.onboarding_completed, {
          flow: "v2",
          weight_skipped: state.weightSkipped,
          goal: state.goal,
          recipes_picked: pickedSeeds.length,
          recipes_resolved: pickedSeeds.length - missingCount,
          plan_built: !planFailed,
          // Build-40 (2026-05-01) — which data-bridge the user
          // actioned on the terminal step. `null` = never touched
          // a card; "skip" = explicitly tapped Maybe later.
          data_bridge_chosen: state.dataBridgeChosen,
          manual_targets_set:
            state.manualTargetsKcal != null &&
            state.manualTargetsProteinG != null &&
            state.manualTargetsCarbsG != null &&
            state.manualTargetsFatG != null,
        });
        // WEB-01 (2026-04-28): clear persisted onboarding state on
        // successful completion. Without this, the next signup on the
        // same browser pre-fills the previous user's answers — a real
        // problem on shared devices and during testing.
        try {
          window.localStorage.removeItem("suppr.onboarding-v2.state");
        } catch {
          /* storage may be disabled — non-fatal */
        }

        // Per spec Surface F state: success → 600ms loader → Today.
        // Plan failure → caller surfaces "We saved your recipes but
        // couldn't build a plan" toast on /home (read from query
        // string param).
        const homeQs = planFailed
          ? "?onboarding_complete=1&plan_build=failed"
          : "?onboarding_complete=1";
        window.location.href = `/home${homeQs}`;
      } else {
        // ENG-672 (2026-05-26) — anonymous completer. With the Signup
        // session gate (`canAdvance("signup", …)` requires `hasSession`)
        // and the footer suppression on Signup, a user shouldn't reach
        // the terminal step unauthenticated via the normal flow. If they
        // did (a session expired, or they URL-stuffed past Signup), we
        // jump them BACK to the Signup step in-place rather than reload
        // /onboarding (which would just restore them to the terminal step
        // from localStorage and loop). State stays in memory + the local
        // profile cache, so they lose nothing — they just sign in and
        // resume. The `completionError` surfaces why.
        track(AnalyticsEvents.onboarding_completed, {
          flow: "v2",
          weight_skipped: state.weightSkipped,
          goal: state.goal,
          unauthenticated: true,
        });
        const signupIndex = STEP_IDS.indexOf("signup");
        goTo(signupIndex >= 0 ? signupIndex : 0);
        setCompletionError(
          "Sign in to save your plan — your answers are saved.",
        );
      }
    } finally {
      setCompleting(false);
    }
  }, [authedUserId, state, targets, goTo]);

  // Stage E — when the user clicks Continue from the Pace step while
  // a soft-warn banner is showing, fire the `advanced` variant of
  // the analytics event so product can compute the through-rate of
  // the warning. The matching `shown` event fires from inside
  // PaceStep on banner mount/reason change.
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
        // requires the acknowledgement checkbox; for info / warn the
        // field is null so PostHog filters can distinguish.
        acknowledged:
          warning.level === "danger"
            ? state.paceDangerAcknowledged
            : null,
      });
    }
    // Fire before go(1) so the step_id reflects the step being completed,
    // not the step being entered. goal is included when available because
    // it drives the pace/reveal branches and is useful for funnel slicing.
    track(AnalyticsEvents.onboarding_step_completed, {
      step_id: currentStepId,
      step_index: displayIndex,
      step_total: displayTotal,
      ...(state.goal != null ? { goal: state.goal } : {}),
    });
    go(1);
  }, [
    currentStepId,
    displayIndex,
    displayTotal,
    state.goal,
    warning,
    targets,
    state.sex,
    state.paceDangerAcknowledged,
    go,
  ]);

  // Welcome takes the whole canvas — no top bar, no split.
  if (isWelcome) {
    return (
      <div className="h-screen w-full bg-background text-foreground overflow-hidden">
        <StepComponent />
      </div>
    );
  }

  const narrative = NARRATIVE[currentStepId];

  return (
    <div className="h-screen w-full bg-background text-foreground flex flex-col overflow-hidden">
      {/* Top bar — brand + progress.
          Grid layout (visual-qa P1) so the progress bar sits at the
          true horizontal centre regardless of the wordmark / right-
          slot widths.
          Customer-lens shrink (2026-04-30): the numeric "n/12"
          counter (formerly "n/15") is removed at all widths because
          N-of-15 anchored testers on remaining work. The narrative
          column's eyebrow still carries the per-step label on
          desktop; the bar carries the partway feel on phone widths.
          The Save & Exit stub is hidden until the wired-up confirm
          flow lands (tracked in TODO.md OB2 follow-ups). */}
      <header className="h-14 md:h-16 flex-shrink-0 border-b border-border bg-card/80 backdrop-blur-md grid grid-cols-[1fr_auto_1fr] items-center px-4 md:px-9">
        <div className="justify-self-start">
          <SupprWordmark size={24} />
        </div>
        <ProgressBar
          value={displayIndex}
          total={displayTotal}
          className="w-full max-w-[260px] md:max-w-[360px] justify-self-center"
        />
        <div className="justify-self-end" aria-hidden />
      </header>

      {/* Body. Mobile-web collapses the split to the card column only —
          the narrative column's framing role (eyebrow + step-count) is
          already carried by the in-card StepHeader overline, so hiding
          the big headline column doesn't lose the user's place. Above
          768px the desktop split returns (Grace 2026-04-20). */}
      <BodyContainer>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-[1.1fr_1fr] min-h-0 overflow-hidden h-full">
        {/* Narrative column — hidden on mobile viewports. */}
        <div
          key={`narr-${displayIndex}`}
          className="hidden md:flex relative overflow-hidden flex-col justify-center px-16 py-14"
          style={{
            background:
              "radial-gradient(ellipse at top left, color-mix(in oklab, var(--primary) 12%, transparent), transparent 55%)",
            animation: "v2NarrativeFade 400ms cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          {narrative && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary mb-4">
                {narrative.eyebrow}
              </div>
              <h1
                className="text-[44px] font-extrabold tracking-tight text-foreground m-0 mb-4 leading-[1.05] max-w-[520px]"
                style={{
                  letterSpacing: "-0.035em",
                  textWrap: "balance",
                  whiteSpace: "pre-line",
                } as React.CSSProperties}
              >
                {narrative.head}
              </h1>
              {narrative.body && (
                <p
                  className="text-base text-muted-foreground m-0 leading-relaxed max-w-[440px]"
                  style={{ textWrap: "pretty" } as React.CSSProperties}
                >
                  {narrative.body}
                </p>
              )}
              {narrative.extra && (
                <div className="mt-8">
                  {narrative.extra({ state, targets })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Interactive card column. Reveal opts out of the inner card
            chrome (visual-qa P1) so the brand gradient lands without
            a triple-stacked transparency mash, AND uses overflow-auto
            on the card so taller states (Pace banner + projection +
            methodology stack) don't clip. */}
        <div className="md:border-l border-border bg-card/40 px-4 py-6 md:px-12 md:py-10 overflow-auto flex flex-col">
          <div
            key={`card-${displayIndex}`}
            className="flex-1 min-h-0 flex flex-col"
            style={{
              animation:
                "v2NarrativeFade 400ms 60ms cubic-bezier(0.22,1,0.36,1) backwards",
            }}
          >
            <div
              className={
                currentStepId === "reveal"
                  ? "rounded-2xl flex-1 flex flex-col overflow-hidden"
                  : "bg-card border border-border rounded-2xl flex-1 flex flex-col overflow-auto"
              }
            >
              <StepComponent />
            </div>
            {completionError ? (
              <p
                role="alert"
                data-testid="onboarding-completion-error"
                className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-[13px] leading-snug text-foreground"
              >
                {completionError}
              </p>
            ) : null}
            <div className="mt-5 flex gap-3 justify-between items-center">
              <button
                type="button"
                onClick={() => go(-1)}
                className="bg-transparent border-0 text-muted-foreground text-[13px] font-semibold cursor-pointer flex items-center gap-1.5 px-1 py-2.5 hover:text-foreground transition-pm"
              >
                <ChevronLeft className="size-4" />
                Back
              </button>
              {/* Signup step suppresses the global Continue — it has
                  its own "Create account" CTA which fires the real
                  Supabase signUp and advances on success. Showing
                  both would let the user bypass the auth handshake. */}
              {!isSignup && (() => {
                // Customer-lens shrink (2026-04-30): terminal step is
                // now `reveal`. The "Build my plan" CTA fires the
                // `handleComplete` write path directly — no picker
                // gate, no five-recipe minimum. Onboarding ends at the
                // aha moment; recipes / import / health-sync are
                // organic surfaces post-launch.
                const terminalLabel = completing
                  ? "Building your plan…"
                  : "Build my plan";
                return (
                  <Button
                    size="lg"
                    onClick={isTerminal ? handleComplete : handleContinue}
                    disabled={!canAdvance || completing}
                    className="h-12 px-6 font-bold"
                  >
                    {isTerminal ? terminalLabel : "Continue"}
                    <ArrowRight className="size-4" strokeWidth={2.2} />
                  </Button>
                );
              })()}
            </div>
          </div>
        </div>
        </div>
      </BodyContainer>

      <style>{`
        @keyframes v2NarrativeFade {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/**
 * Caps the onboarding body at 1280px and centres it when the flag is
 * ON. When OFF: pass-through, body spans full viewport width.
 */
function BodyContainer({ children }: { children: React.ReactNode }) {
  const capOn = useFeatureFlagEnabled("premium-sweep-v2-p0-t25");
  if (!capOn) return <>{children}</>;
  return (
    <div className="flex-1 mx-auto w-full md:max-w-[1280px] overflow-hidden flex flex-col">
      {children}
    </div>
  );
}

function ProgressBar({
  value,
  total,
  className,
}: {
  value: number;
  total: number;
  className?: string;
}) {
  const pct = Math.max(4, (value / Math.max(1, total)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={value}
      className={`h-1 rounded-sm bg-input-background overflow-hidden ${className ?? ""}`}
    >
      <div
        className="h-full rounded-sm bg-primary transition-[width] duration-300"
        style={{
          width: `${pct}%`,
          boxShadow: "0 0 8px color-mix(in oklab, var(--primary) 40%, transparent)",
        }}
      />
    </div>
  );
}
