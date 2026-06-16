"use client";

import * as React from "react";
import { FoodFallbackThumb } from "@/app/components/suppr/food-fallback-thumb";
import { OptionCard } from "@/app/components/ui/option-card";
import {
  ONBOARDING_GOAL_OPTIONS,
  ONBOARDING_GOAL_QUESTION,
  ONBOARDING_GOAL_SUBTITLE,
} from "@/lib/onboarding/goalOptions";
import { useOnboarding } from "../context";
import { StepBody, StepHeader, useStepOverline } from "../scaffold";

export function GoalStep() {
  const { state, set } = useOnboarding();
  const overline = useStepOverline();
  return (
    <StepBody>
      <StepHeader
        overline={overline}
        title={ONBOARDING_GOAL_QUESTION}
        subtitle={ONBOARDING_GOAL_SUBTITLE}
      />
      <div className="flex flex-col gap-2.5">
        {ONBOARDING_GOAL_OPTIONS.map((g) => (
          <OptionCard
            key={g.id}
            selected={state.goal === g.id}
            onClick={() => set({ goal: g.id })}
            thumbnail={
              <FoodFallbackThumb
                title={g.thumbnailTitle}
                size={56}
                className="rounded-full size-14"
              />
            }
            title={g.title}
            subtitle={g.subtitle}
          />
        ))}
      </div>
    </StepBody>
  );
}
