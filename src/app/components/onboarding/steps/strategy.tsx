"use client";

import * as React from "react";
import { Drumstick, Salad, Scale, Wheat } from "lucide-react";
import { OptionCard } from "@/app/components/ui/option-card";
import { mapGoalToStrategy } from "@/lib/onboarding/targets";
import type { NutritionStrategy } from "@/lib/nutrition/tdee";
import { useOnboarding } from "../context";
import { MethodologyNote, StepBody, StepHeader, useStepOverline } from "../scaffold";

/**
 * Strategy — step 11. Lets the user override the goal-derived macro
 * split (parity with the legacy onboarding's nutrition_strategy step,
 * Grace 2026-04-20).
 *
 * Default selection mirrors `mapGoalToStrategy` so the picker shows
 * the same recommendation the Reveal step would use untouched. Tapping
 * a different card writes to `state.nutritionStrategy`; the Reveal
 * step recomputes macros automatically via `computeV2Targets`.
 */

interface StrategyOption {
  id: NutritionStrategy;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}

const STRATEGIES: StrategyOption[] = [
  {
    id: "balanced",
    title: "Balanced",
    subtitle: "Even split, flexible across cuisines.",
    icon: <Scale className="size-5" />,
  },
  {
    id: "high_protein",
    title: "High protein",
    subtitle: "~2.2 g/kg, muscle-building leaning.",
    icon: <Drumstick className="size-5" />,
  },
  {
    id: "high_satisfaction",
    title: "High satisfaction",
    subtitle: "Filling meals, easier in a deficit.",
    icon: <Salad className="size-5" />,
  },
  {
    id: "low_carb",
    title: "Low carb",
    subtitle: "Carbs minimised, fat-led.",
    icon: <Wheat className="size-5" />,
  },
];

export function StrategyStep() {
  const { state, set } = useOnboarding();
  const overline = useStepOverline();

  // Show the goal-derived recommendation as pre-selected so the user
  // can advance with one tap. Treat `null` (untouched) as the
  // recommended option — this mirrors what the Reveal step would
  // compute, so what they see selected here is what they'll get.
  const recommended = state.goal ? mapGoalToStrategy(state.goal) : "balanced";
  const selected = state.nutritionStrategy ?? recommended;

  return (
    <StepBody>
      <StepHeader
        overline={overline}
        title="Pick your macro style"
        subtitle="Pre-picked from your goal. Tap to override."
      />
      <div className="flex flex-col gap-2.5">
        {STRATEGIES.map((s) => (
          <OptionCard
            key={s.id}
            selected={selected === s.id}
            onClick={() => set({ nutritionStrategy: s.id })}
            icon={s.icon}
            title={
              <span className="flex items-center gap-2">
                {s.title}
                {s.id === recommended && (
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-primary-solid px-1.5 py-0.5 rounded bg-primary/15">
                    Recommended
                  </span>
                )}
              </span>
            }
            subtitle={s.subtitle}
          />
        ))}
      </div>
      <MethodologyNote>
        Macro ratios are a starting point. Sloe recalibrates protein and carbs
        as you log and weigh in.
      </MethodologyNote>
    </StepBody>
  );
}
