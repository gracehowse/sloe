"use client";

/**
 * ENG-990 (2026-06-08) — "Coming from another app?" onboarding step (web).
 *
 * A Yazio-style competitor-switch capture placed right after Welcome (see
 * `docs/research/2026-06-08-yazio-teardown.md`). It asks the switcher
 * which tracker they're leaving and records the answer
 * (`state.appChoice` + the `onboarding_app_choice` event). When they pick
 * an app we can import from, the terminal data-bridges step pre-highlights
 * the CSV importer so their history lands in Sloe instead of bouncing.
 *
 * The selectable apps are derived from the CSV-import adapter registry via
 * the shared `buildAppChoiceOptions()` helper — only apps with a live
 * adapter are surfaced (no dead options), and the list stays identical to
 * the mobile mirror at
 * `apps/mobile/components/onboarding/steps/app-choice.tsx`.
 *
 * The `onboarding-app-choice` flag that used to gate this step collapsed
 * out (2026-07-22, ENG-1651) — it was permanently ON in production, so
 * the step is now unconditionally reachable on both flow shells.
 */

import * as React from "react";
import { Sparkles } from "lucide-react";
import { OptionCard } from "@/app/components/ui/option-card";
import { useOnboarding } from "../context";
import { StepBody, StepHeader, useStepOverline } from "../scaffold";
import { track } from "@/lib/analytics/track";
import { AnalyticsEvents } from "@/lib/analytics/events";
import {
  appChoiceHasImporter,
  buildAppChoiceOptions,
} from "@/lib/onboarding/appChoiceOptions";
import type { AppChoice } from "@/lib/onboarding/state";

export function AppChoiceStep() {
  const { state, set } = useOnboarding();
  const overline = useStepOverline();
  // Computed once — the adapter registry is static at runtime.
  const options = React.useMemo(() => buildAppChoiceOptions(), []);

  const choose = React.useCallback(
    (id: Exclude<AppChoice, null>, hasImporter: boolean) => {
      set({ appChoice: id });
      track(AnalyticsEvents.onboarding_app_choice, {
        app: id,
        has_importer: hasImporter,
        platform: "web",
      });
    },
    [set],
  );

  const picked = state.appChoice;
  const pickedHasImporter = appChoiceHasImporter(picked);

  return (
    <StepBody>
      <StepHeader
        overline={overline}
        title="Coming from another app?"
        subtitle="Tell us where you're tracking now and we'll bring your history across — no re-logging months of meals."
      />

      <div className="flex flex-col gap-2.5">
        {options.map((opt) => (
          <OptionCard
            key={opt.id}
            selected={picked === opt.id}
            onClick={() => choose(opt.id, opt.hasImporter)}
            title={opt.label}
            subtitle={
              opt.hasImporter
                ? "We can import your export"
                : opt.id === "none"
                  ? "Set everything up from scratch"
                  : "We'll still tune your plan to you"
            }
          />
        ))}
      </div>

      {/* Reassurance once a pick is made. For an importable app, tell the
          user their history will be waiting at the import step; for the
          fresh-start / other paths, keep it calm and pressure-free. */}
      {picked != null ? (
        <div
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground"
          data-testid="app-choice-followup"
        >
          <Sparkles className="size-3.5 shrink-0 text-primary mt-px" aria-hidden />
          <div className="flex-1">
            {pickedHasImporter
              ? "Nice — keep going and we'll help you bring your history over near the end. Your existing numbers stay exactly as you logged them."
              : "All set. We'll build your plan around your goals from here."}
          </div>
        </div>
      ) : null}
    </StepBody>
  );
}
