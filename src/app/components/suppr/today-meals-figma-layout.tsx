"use client";

import * as React from "react";
import { SupprCard } from "../ui/suppr-card.tsx";
import { mealRowImageUrl } from "../../../lib/nutrition/foodHistory";
import {
  nextUnloggedMealSlot,
  TODAY_MEAL_SLOT_ORDER,
  type TodayMealSlot,
} from "../../../lib/copy/today";
import type { TodayMealSectionMeal } from "./today-meals-section";

/** Sloe stroke check — Figma `654:2` / `today.html` Logged badge. */
export function SloeCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** Sloe stroke plus — Figma `654:2` Log {slot} CTA (clay). */
export function SloePlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

export interface TodayMealsFigmaLayoutProps {
  mealsGrouped: Array<{ name: string; meals: TodayMealSectionMeal[] }>;
  collapsedSlots: Set<string>;
  onToggleSlot: (name: string) => void;
  onOpenAddForSlot: (slot: string) => void;
  /** Item rows + slot actions when a summary card is expanded. */
  renderSlotExpanded?: (
    slotName: string,
    meals: TodayMealSectionMeal[],
  ) => React.ReactNode;
}

/**
 * Figma `654:2` Today's Meals — summary cards per logged slot, kcal total
 * header, dashed Log-{nextSlot} CTA. Parity: mobile
 * `TodayMealsFigmaLayout.tsx`.
 */
export function TodayMealsFigmaLayout({
  mealsGrouped,
  collapsedSlots,
  onToggleSlot,
  onOpenAddForSlot,
  renderSlotExpanded,
}: TodayMealsFigmaLayoutProps) {
  const totalKcal = Math.round(
    mealsGrouped.reduce(
      (sum, g) => sum + g.meals.reduce((s, m) => s + m.calories, 0),
      0,
    ),
  );
  const loggedSlots = mealsGrouped
    .filter((g) => g.meals.length > 0)
    .map((g) => g.name);
  const nextSlot = nextUnloggedMealSlot(loggedSlots);

  return (
    <>
      <div
        className="mb-4 flex items-center justify-between gap-3"
        data-testid="today-meals-figma-header"
      >
        <h2 className="font-[family-name:var(--font-headline)] text-2xl font-medium tracking-tight text-foreground-brand">
          Today&apos;s Meals
        </h2>
        {totalKcal > 0 ? (
          <span
            className="shrink-0 text-xs font-medium text-foreground-tertiary tabular-nums"
            data-testid="today-meals-kcal-total"
          >
            {totalKcal.toLocaleString()} kcal total
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-3" data-testid="today-meals-figma-list">
        {TODAY_MEAL_SLOT_ORDER.map((slotName) => {
          const group = mealsGrouped.find((g) => g.name === slotName);
          const meals = group?.meals ?? [];
          if (meals.length === 0) return null;

          const slotCals = Math.round(
            meals.reduce((s, m) => s + m.calories, 0),
          );
          const slotProtein = Math.round(
            meals.reduce((s, m) => s + (m.protein ?? 0), 0),
          );
          const primary = meals[0];
          const thumbUrl = mealRowImageUrl(primary);
          const isOpen = !collapsedSlots.has(slotName);

          return (
            <SupprCard
              key={slotName}
              elevation="slab-flat"
              radius="xl"
              padding="none"
              className="overflow-hidden"
              data-testid={`today-meals-figma-card-${slotName}`}
            >
              <button
                type="button"
                onClick={() => onToggleSlot(slotName)}
                className="flex w-full items-center gap-4 p-3 text-left"
                aria-expanded={isOpen}
                aria-label={`${slotName}, ${meals.length} item${meals.length === 1 ? "" : "s"} — ${isOpen ? "collapse" : "expand"}`}
              >
                {thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbUrl}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div
                    className="h-16 w-16 shrink-0 rounded-lg bg-muted"
                    aria-hidden
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-foreground-secondary">
                      {slotName}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-foreground-tertiary">
                      <SloeCheckIcon className="h-3.5 w-3.5 shrink-0" />
                      Logged
                    </span>
                  </div>
                  <h4 className="truncate font-[family-name:var(--font-headline)] text-lg font-normal text-foreground">
                    {primary.recipeTitle}
                  </h4>
                  <p className="mt-0.5 text-xs text-foreground-secondary tabular-nums">
                    {slotCals.toLocaleString()} kcal • {slotProtein}g P
                  </p>
                </div>
              </button>
              {isOpen && renderSlotExpanded
                ? renderSlotExpanded(slotName, meals)
                : null}
            </SupprCard>
          );
        })}
        {nextSlot ? (
          <button
            type="button"
            data-testid={`today-log-slot-cta-${nextSlot}`}
            onClick={() => onOpenAddForSlot(nextSlot)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background p-4 transition-colors hover:bg-muted/30"
            aria-label={`Log ${nextSlot}`}
          >
            <span className="text-[var(--clay,#C8794E)]">
              <SloePlusIcon className="h-5 w-5" />
            </span>
            <span className="font-medium text-foreground-secondary">
              Log {nextSlot}
            </span>
          </button>
        ) : null}
      </div>
    </>
  );
}

export function logSlotCtaLabel(slot: TodayMealSlot): string {
  return `Log ${slot}`;
}
