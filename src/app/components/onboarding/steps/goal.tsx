"use client";

import * as React from "react";
import { Equal, Shuffle, TrendingDown, TrendingUp } from "lucide-react";
import { OptionCard } from "@/app/components/ui/option-card";
import type { Goal } from "@/lib/onboarding/state";
import { useOnboarding } from "../context";
import { StepBody, StepHeader, useStepOverline } from "../scaffold";

const GOALS: { id: Goal; title: string; subtitle: string; icon: React.ReactNode }[] = [
  {
    id: "lose",
    title: "Lose fat",
    subtitle: "Gradual deficit, protein-first",
    icon: <TrendingDown className="size-5" />,
  },
  {
    id: "maintain",
    title: "Maintain",
    subtitle: "Keep things steady",
    icon: <Equal className="size-5" />,
  },
  {
    id: "gain",
    title: "Gain muscle",
    subtitle: "Small surplus, high protein",
    icon: <TrendingUp className="size-5" />,
  },
  {
    id: "recomp",
    title: "Recomposition",
    // Diversity-inclusion Stage F sign-off — describe the metabolic
    // state, not a gym demand. Many recomp-curious users don't lift
    // heavy.
    subtitle: "Slight deficit, strength-focused",
    icon: <Shuffle className="size-5" />,
  },
];

export function GoalStep() {
  const { state, set } = useOnboarding();
  const overline = useStepOverline();
  return (
    <StepBody>
      <StepHeader
        overline={overline}
        title="What's your goal?"
        subtitle="We'll tailor your calorie and macro targets to match. You can change this anytime."
      />
      <div className="flex flex-col gap-2.5">
        {GOALS.map((g) => (
          <OptionCard
            key={g.id}
            selected={state.goal === g.id}
            onClick={() => set({ goal: g.id })}
            icon={g.icon}
            title={g.title}
            subtitle={g.subtitle}
          />
        ))}
      </div>
    </StepBody>
  );
}
