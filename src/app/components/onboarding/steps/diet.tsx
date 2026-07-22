"use client";

import * as React from "react";
import { Apple, Beef, Feather, Fish, Flower2, Leaf, Moon, Salad, Star, Wheat } from "lucide-react";
import { OptionCard } from "@/app/components/ui/option-card";
import { useOnboarding } from "../context";
import { StepBody, StepHeader, useStepOverline } from "../scaffold";

const DIETS: { id: string; title: string; icon: React.ReactNode }[] = [
  { id: "anything", title: "Anything goes", icon: <Salad className="size-4" /> },
  { id: "vegetarian", title: "Vegetarian", icon: <Leaf className="size-4" /> },
  { id: "vegan", title: "Vegan", icon: <Wheat className="size-4" /> },
  { id: "pescatarian", title: "Pescatarian", icon: <Fish className="size-4" /> },
  { id: "keto", title: "Keto / low-carb", icon: <Beef className="size-4" /> },
  { id: "mediterranean", title: "Mediterranean", icon: <Apple className="size-4" /> },
  { id: "halal", title: "Halal", icon: <Moon className="size-4" /> },
  { id: "kosher", title: "Kosher", icon: <Star className="size-4" /> },
  { id: "jain", title: "Jain", icon: <Feather className="size-4" /> },
  { id: "hindu-veg", title: "Hindu vegetarian", icon: <Flower2 className="size-4" /> },
];

// T12 (2026-04-24) — 14 EU FIC / UK FSA regulated allergens. Split
// "Nuts" into Peanuts + Tree nuts (legally distinct). Ordered roughly
// by consumer familiarity. Source of truth:
// src/constants/regulatedAllergens.ts.
const ALLERGIES = [
  "Peanuts",
  "Tree nuts",
  "Milk",
  "Eggs",
  "Fish",
  "Shellfish",
  "Soy",
  "Wheat",
  "Sesame",
  "Mustard",
  "Celery",
  "Sulfites",
  "Lupin",
  "Gluten",
];

export function DietStep() {
  const { state, set } = useOnboarding();
  const overline = useStepOverline();
  const toggleAllergy = (a: string) =>
    set((prev) => ({
      allergies: prev.allergies.includes(a)
        ? prev.allergies.filter((x) => x !== a)
        : [...prev.allergies, a],
    }));

  const toggleDiet = (id: string) => {
    if (id === "anything") {
      set((prev) => ({
        diet: prev.diet.includes("anything") ? [] : ["anything"],
      }));
      return;
    }
    set((prev) => {
      const cleared = prev.diet.filter((x) => x !== "anything");
      return {
        diet: cleared.includes(id)
          ? cleared.filter((x) => x !== id)
          : [...cleared, id],
      };
    });
  };

  return (
    <StepBody>
      <StepHeader
        overline={overline}
        title="Any dietary preferences?"
        subtitle="We'll filter recipes and macro suggestions. Optional — skip if none apply."
      />

      <div className="grid grid-cols-2 gap-2 mb-6">
        {DIETS.map((d) => (
          <OptionCard
            key={d.id}
            compact
            selected={state.diet.includes(d.id)}
            onClick={() => toggleDiet(d.id)}
            icon={d.icon}
            title={d.title}
            trailing={null}
          />
        ))}
      </div>

      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-tertiary mb-2.5">
        Allergies
      </div>
      <div className="flex flex-wrap gap-2">
        {ALLERGIES.map((a) => {
          const on = state.allergies.includes(a);
          return (
            <button
              key={a}
              type="button"
              onClick={() => toggleAllergy(a)}
              aria-pressed={on}
              // Chip grammar (web parity 2026-06-10, ENG-1022): selected =
              // `bg-primary-soft` + `primary-solid` label + `font-semibold`,
              // NO border; unselected = quiet `bg-card` + muted label, NO
              // border. Was `bg-primary/15`+`border-primary` selected /
              // `border-border` unselected.
              className={`px-3.5 py-2 rounded-full text-sm transition-pm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                on
                  ? "bg-primary-soft text-primary-solid font-semibold"
                  : "bg-card text-muted-foreground font-medium hover:bg-muted/60"
              }`}
            >
              {a}
            </button>
          );
        })}
      </div>
    </StepBody>
  );
}
