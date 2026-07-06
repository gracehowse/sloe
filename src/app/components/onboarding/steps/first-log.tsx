"use client";

/**
 * ENG-1233 — guided first-win log prompt (web). Terminal when conversion funnel ON.
 */
import * as React from "react";
import { Coffee, Search, Sun } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import { OptionCard } from "@/app/components/ui/option-card";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";
import { FIRST_LOG_CHIPS } from "@/lib/onboarding/conversionFunnel";
import type { FirstLogChoice } from "@/lib/onboarding/state";
import { useOnboarding } from "../context";
import { StepBody, StepHeader, useStepOverline } from "../scaffold";

const CHIP_ICONS: Record<Exclude<FirstLogChoice, null | "skip">, React.ReactNode> = {
  breakfast: <Sun className="size-5" />,
  coffee: <Coffee className="size-5" />,
  search: <Search className="size-5" />,
};

export function FirstLogStep() {
  const { state, set } = useOnboarding();
  const overline = useStepOverline();

  const pick = React.useCallback(
    (id: Exclude<FirstLogChoice, null>) => {
      set({ firstLogChoice: id });
      track(AnalyticsEvents.onboarding_first_log_prompt, {
        choice: id,
        platform: "web",
      });
    },
    [set],
  );

  return (
    <StepBody>
      <StepHeader
        overline={overline}
        title="One quick win"
        subtitle="Log something small now — you'll land on Today ready to keep going."
      />

      <div className="flex flex-col gap-2.5">
        {FIRST_LOG_CHIPS.map((chip) => (
          <OptionCard
            key={chip.id}
            selected={state.firstLogChoice === chip.id}
            onClick={() => pick(chip.id)}
            title={chip.label}
            subtitle={
              chip.id === "search"
                ? "Opens food search on Today"
                : `Opens food search on Today, scoped to "${chip.label}"`
            }
            icon={CHIP_ICONS[chip.id]}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        className="mt-2 self-start px-0 text-muted-foreground hover:text-foreground"
        onClick={() => pick("skip")}
      >
        Skip for now
      </Button>
    </StepBody>
  );
}
