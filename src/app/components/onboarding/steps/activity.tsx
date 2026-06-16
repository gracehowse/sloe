"use client";

import * as React from "react";
import { Activity, Armchair, Dumbbell, Flame, Footprints } from "lucide-react";
import { OptionCard } from "@/app/components/ui/option-card";
import type { ActivityLevel } from "@/lib/nutrition/tdee";
import { useOnboarding } from "../context";
import { StepBody, StepHeader, useStepOverline } from "../scaffold";

const ACTIVITIES: {
  id: ActivityLevel;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "sedentary",
    title: "Sedentary",
    subtitle: "Mostly sitting, little walking",
    icon: <Armchair className="size-4" />,
  },
  {
    id: "light",
    title: "Lightly active",
    subtitle: "1–3 workouts or active days / wk",
    icon: <Footprints className="size-4" />,
  },
  {
    id: "moderate",
    title: "Moderately active",
    subtitle: "3–5 sessions + daily movement",
    icon: <Activity className="size-4" />,
  },
  {
    id: "active",
    title: "Very active",
    subtitle: "6–7 sessions, physical job",
    icon: <Dumbbell className="size-4" />,
  },
  {
    id: "very_active",
    title: "Athlete",
    subtitle: "Twice-daily training, competitive",
    icon: <Flame className="size-4" />,
  },
];

export function ActivityStep() {
  const { state, set } = useOnboarding();
  const overline = useStepOverline();
  return (
    <StepBody>
      <StepHeader
        overline={overline}
        title="How active are you?"
        subtitle="Rough estimate — Sloe will refine this using your activity data over ~2 weeks."
      />
      <div className="flex flex-col gap-2">
        {ACTIVITIES.map((a) => (
          <OptionCard
            key={a.id}
            compact
            selected={state.activity === a.id}
            onClick={() => set({ activity: a.id })}
            icon={a.icon}
            title={a.title}
            subtitle={a.subtitle}
          />
        ))}
      </div>
    </StepBody>
  );
}
