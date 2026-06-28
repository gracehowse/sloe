"use client";

import Link from "next/link";

import { useAppData } from "@/context/AppDataContext";
import { isFeatureEnabled } from "@/lib/analytics/track";
import { useCoach } from "@/lib/today/useCoach";
import { redirect } from "next/navigation";

const COACH_CHIPS = [
  "What should I eat next?",
  "Hit my protein target",
  "Something quick under 500 kcal",
] as const;

export default function CoachPage() {
  if (!isFeatureEnabled("coach_full_screen_v1")) {
    redirect("/");
  }

  const { savedRecipesForLibrary, nutritionTargets, mealsForSelectedDate } = useAppData();

  const totals = mealsForSelectedDate.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      protein: acc.protein + (m.protein ?? 0),
      carbs: acc.carbs + (m.carbs ?? 0),
      fat: acc.fat + (m.fat ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const remaining = {
    calories: Math.max(0, nutritionTargets.calories - totals.calories),
    protein: Math.max(0, nutritionTargets.protein - totals.protein),
    carbs: Math.max(0, nutritionTargets.carbs - totals.carbs),
    fat: Math.max(0, nutritionTargets.fat - totals.fat),
    dailyCalorieTarget: nutritionTargets.calories,
  };

  const library = savedRecipesForLibrary.map((r) => ({
    id: r.id,
    title: r.title,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    imageUrl: r.image ?? null,
  }));

  const coach = useCoach({
    library,
    remaining,
    enabled: true,
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-medium text-foreground-brand">
          Coach
        </h1>
        <p className="text-sm text-muted-foreground">
          Ranked ideas for what to eat next, based on what you have left today.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {COACH_CHIPS.map((label) => (
          <span
            key={label}
            className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground"
          >
            {label}
          </span>
        ))}
      </div>

      {coach.refining ? (
        <p className="text-sm text-muted-foreground">Refining suggestions…</p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {coach.candidates.map((c) => (
          <li
            key={c.recipeId}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <p className="font-medium text-foreground">{c.title}</p>
            {c.whyLine ? (
              <p className="mt-1 text-sm text-muted-foreground">{c.whyLine}</p>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              {Math.round(c.predictedCalories)} kcal · P {Math.round(c.predictedProtein)}g
            </p>
            <Link
              href={`/recipe/${c.recipeId}`}
              className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline"
            >
              View recipe
            </Link>
          </li>
        ))}
      </ul>

      {coach.candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No fits right now — save a few recipes to your library first.
        </p>
      ) : null}
    </main>
  );
}
