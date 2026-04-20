"use client";

import * as React from "react";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { SupprWordmark } from "@/app/components/ui/suppr-mark";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";
import { useAuthSession } from "@/context/AuthSessionContext";
import { supabase } from "@/lib/supabase/browserClient";
import { saveLocalProfile } from "@/lib/profile/profileStorage";
import { type UserProfile } from "@/types/profile";
import { useOnboardingV2 } from "./context";
import { STEP_COMPONENTS } from "./steps";
import { NARRATIVE } from "./narrative";
import { mapV2GoalToLegacy, persistOnboardingV2 } from "@/lib/onboarding/v2/persist";

/**
 * Web flow shell — split layout with a narrative left column and an
 * interactive card on the right. The Welcome step takes the whole
 * canvas; every other step uses the split. Mobile (Stage D) uses a
 * different shell.
 *
 * The route component (`app/onboarding/v2/page.tsx`) wraps this in
 * `<OnboardingV2Provider>` so the shell stays unconditional and easy
 * to mount inside the dev preview.
 */

export function WebFlow() {
  const { currentStepId, displayIndex, displayTotal, go, canAdvance, state, targets, warning } =
    useOnboardingV2();
  const { authedUserId } = useAuthSession();
  const StepComponent = STEP_COMPONENTS[currentStepId];
  const isWelcome = currentStepId === "welcome";
  const isTerminal = currentStepId === "import";
  const [completing, setCompleting] = React.useState(false);

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
    try {
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
        targets: targets
          ? {
              calories: targets.target,
              protein: targets.proteinG,
              carbs: targets.carbsG,
              fat: targets.fatG,
              fiber: targets.fiberG,
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
        await persistOnboardingV2(supabase, {
          userId: authedUserId,
          state,
          targets,
        });
        track(AnalyticsEvents.onboarding_completed, {
          flow: "v2",
          weight_skipped: state.weightSkipped,
          goal: state.goal,
        });
        window.location.href = "/?view=discover";
      } else {
        // Anonymous completer — bounce to signup. The local profile
        // cache means their answers persist across the auth handoff;
        // a future iteration can re-hydrate state from saved profile
        // on first authenticated visit.
        track(AnalyticsEvents.onboarding_completed, {
          flow: "v2",
          weight_skipped: state.weightSkipped,
          goal: state.goal,
          unauthenticated: true,
        });
        window.location.href = "/signup?next=/onboarding/v2";
      }
    } finally {
      setCompleting(false);
    }
  }, [authedUserId, state, targets]);

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
          slot widths. The dual step-indicator (top-bar counter +
          eyebrow on the narrative side) was deliberately dropped —
          the eyebrow carries the canonical step number per ui-critic.
          The Save & Exit stub is hidden until the wired-up confirm
          flow lands (tracked in TODO.md OB2 follow-ups). */}
      <header className="h-16 flex-shrink-0 border-b border-border bg-card/80 backdrop-blur-md grid grid-cols-[1fr_auto_1fr] items-center px-9">
        <div className="justify-self-start">
          <SupprWordmark size={28} />
        </div>
        <ProgressBar
          value={displayIndex}
          total={displayTotal}
          className="w-full max-w-[360px] justify-self-center"
        />
        <div className="justify-self-end" />
      </header>

      {/* Body */}
      <div className="flex-1 grid grid-cols-[1.1fr_1fr] min-h-0 overflow-hidden">
        {/* Narrative column */}
        <div
          key={`narr-${displayIndex}`}
          className="relative overflow-hidden flex flex-col justify-center px-16 py-14"
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
        <div className="border-l border-border bg-card/40 px-12 py-10 overflow-auto flex flex-col">
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
            <div className="mt-5 flex gap-3 justify-between items-center">
              <button
                type="button"
                onClick={() => go(-1)}
                className="bg-transparent border-0 text-muted-foreground text-[13px] font-semibold cursor-pointer flex items-center gap-1.5 px-1 py-2.5 hover:text-foreground transition-pm"
              >
                <ChevronLeft className="size-4" />
                Back
              </button>
              <Button
                size="lg"
                onClick={isTerminal ? handleComplete : handleContinue}
                disabled={!canAdvance || completing}
                className="h-12 px-6 font-bold"
              >
                {isTerminal
                  ? completing
                    ? "Saving…"
                    : "Open my dashboard"
                  : "Continue"}
                <ArrowRight className="size-4" strokeWidth={2.2} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes v2NarrativeFade {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
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
