"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

export interface ProfileShowcaseReadViewProps {
  displayName: string;
  joinedLabel: string | null;
  monogramInitial: string;
  recipeCount: number;
  streakDays: number;
  daysLogged: number;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

/** ENG-1256 — read showcase Profile; editing lives in Settings. Web twin of mobile. */
export function ProfileShowcaseReadView({
  displayName,
  joinedLabel,
  monogramInitial,
  recipeCount,
  streakDays,
  daysLogged,
  calories,
  protein,
  carbs,
  fat,
}: ProfileShowcaseReadViewProps) {
  const stats = [
    { label: daysLogged === 1 ? "Day logged" : "Days logged", value: String(daysLogged) },
    { label: recipeCount === 1 ? "Recipe" : "Recipes", value: String(recipeCount) },
    { label: "Day streak", value: String(streakDays) },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 card-slab">
        <div
          aria-hidden
          className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-muted font-[family-name:var(--font-headline)] text-[28px] text-primary-solid"
        >
          {monogramInitial}
        </div>
        <p className="text-center font-[family-name:var(--font-headline)] text-lg font-medium text-foreground">
          {displayName.trim() || "Your profile"}
        </p>
        {joinedLabel ? (
          <p className="text-center text-xs text-muted-foreground">{joinedLabel}</p>
        ) : null}
      </div>

      <div className="flex overflow-hidden rounded-xl border border-border">
        {stats.map((stat, idx) => (
          <div
            key={stat.label}
            className={`flex flex-1 flex-col items-center gap-0.5 py-3 ${
              idx > 0 ? "border-l border-border" : ""
            }`}
          >
            <p className="text-xl font-bold tabular-nums text-foreground">{stat.value}</p>
            <p className="text-[11px] text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 card-slab">
        <p className="text-sm font-semibold text-foreground">Daily targets</p>
        <p className="text-sm tabular-nums text-muted-foreground">
          {calories} kcal · {protein}g P · {carbs}g C · {fat}g F
        </p>
        <Link
          href="/settings"
          className="mt-2 flex items-center justify-between rounded-lg py-1 text-sm font-semibold text-primary-solid transition-colors hover:text-primary-solid/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Edit goals and targets in Settings"
        >
          <span>Edit in Settings</span>
          <ChevronRight className="h-[18px] w-[18px] text-muted-foreground" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

export default ProfileShowcaseReadView;
