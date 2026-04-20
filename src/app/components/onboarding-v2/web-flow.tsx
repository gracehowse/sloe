"use client";

import * as React from "react";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { SupprWordmark } from "@/app/components/ui/suppr-mark";
import { useOnboardingV2 } from "./context";
import { STEP_COMPONENTS } from "./steps";
import { NARRATIVE } from "./narrative";

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
  const { currentStepId, displayIndex, displayTotal, go, canAdvance, state, targets } =
    useOnboardingV2();
  const StepComponent = STEP_COMPONENTS[currentStepId];
  const isWelcome = currentStepId === "welcome";

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
      {/* Top bar — brand + progress + exit */}
      <header className="h-16 flex-shrink-0 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-9">
        <SupprWordmark size={28} />
        <div className="flex items-center gap-4 flex-1 max-w-[420px] mx-10">
          <ProgressBar value={displayIndex} total={displayTotal} />
          <div className="text-xs font-semibold tabular-nums tracking-wide text-muted-foreground min-w-[80px] text-right">
            Step {displayIndex} of {displayTotal}
          </div>
        </div>
        <button
          type="button"
          className="text-[13px] font-semibold text-muted-foreground bg-transparent border-0 cursor-pointer px-2.5 py-2 rounded-md hover:bg-muted/50 transition-pm"
        >
          Save &amp; exit
        </button>
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

        {/* Interactive card column */}
        <div className="border-l border-border bg-card/40 px-12 py-10 overflow-auto flex flex-col">
          <div
            key={`card-${displayIndex}`}
            className="flex-1 min-h-0 flex flex-col"
            style={{
              animation:
                "v2NarrativeFade 400ms 60ms cubic-bezier(0.22,1,0.36,1) backwards",
            }}
          >
            <div className="bg-card border border-border rounded-2xl flex-1 flex flex-col overflow-hidden">
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
                onClick={() => go(1)}
                disabled={!canAdvance}
                className="h-12 px-6 font-bold"
              >
                Continue
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

function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = Math.max(4, (value / Math.max(1, total)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={value}
      className="flex-1 h-1 rounded-sm bg-input-background overflow-hidden"
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
