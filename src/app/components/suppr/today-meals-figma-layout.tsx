"use client";

import * as React from "react";
import { Utensils } from "lucide-react";
import { SupprCard } from "../ui/suppr-card.tsx";
import { mealRowImageUrl } from "../../../lib/nutrition/foodHistory";
import {
  nextUnloggedMealSlot,
  TODAY_MEAL_SLOT_ORDER,
  type TodayMealSlot,
} from "../../../lib/copy/today";
import type { TodayMealSectionMeal } from "./today-meals-section";
import { SwipeDeleteRow } from "../ui/swipe-delete-row";
import { Icons } from "../ui/icons";

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

/** Sloe stroke plus — Figma `654:2` Log {slot} CTA. Tinted via the flag-aware
 *  `text-primary-solid` token at the call site (clay flag-off, damson flag-on). */
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
  /** Tap the meal row — nutrition detail (MFP chevron-row parity). */
  onPressMeal?: (mealId: string) => void;
  /** Swipe-left on the summary card deletes the primary (first) meal in the slot. */
  onRequestDeleteMeal?: (mealId: string, recipeTitle: string) => void;
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
  onPressMeal,
  onRequestDeleteMeal,
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
              elevation="card"
              radius="lg"
              padding="none"
              className="overflow-hidden"
              data-testid={`today-meals-figma-card-${slotName}`}
            >
              <button
                type="button"
                onClick={() => onToggleSlot(slotName)}
                className="flex w-full items-center justify-between gap-2 border-b border-border/25 px-3 pb-1.5 pt-3 text-left"
                aria-expanded={isOpen}
                aria-label={`${slotName}, ${meals.length} item${meals.length === 1 ? "" : "s"} — ${isOpen ? "collapse" : "expand"}`}
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-foreground-secondary">
                  {slotName}
                </span>
                <span className="flex items-center gap-1 text-xs text-foreground-tertiary">
                  <SloeCheckIcon className="h-3.5 w-3.5 shrink-0" />
                  Logged
                </span>
              </button>
              {(() => {
                const mealRow = (
                  <button
                    type="button"
                    onClick={() =>
                      onPressMeal ? onPressMeal(primary.id) : onToggleSlot(slotName)
                    }
                    className="flex w-full items-center gap-4 bg-card px-3 pb-3 text-left"
                    data-testid={`today-meals-figma-meal-row-${slotName}`}
                    aria-label={`${primary.recipeTitle}, ${slotCals} kcal`}
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
                        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-card"
                        aria-hidden
                      >
                        <Utensils className="h-6 w-6 text-foreground-tertiary" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate font-[family-name:var(--font-headline)] text-lg font-normal text-foreground">
                        {primary.recipeTitle}
                      </h4>
                      <p className="mt-0.5 text-xs text-foreground-secondary tabular-nums">
                        {slotCals.toLocaleString()} kcal • {slotProtein}g P
                      </p>
                    </div>
                    <Icons.forward
                      className="h-4 w-4 shrink-0 text-foreground-tertiary"
                      aria-hidden
                    />
                  </button>
                );
                return onRequestDeleteMeal ? (
                  <SwipeDeleteRow
                    onDelete={() =>
                      onRequestDeleteMeal(primary.id, primary.recipeTitle)
                    }
                  >
                    {mealRow}
                  </SwipeDeleteRow>
                ) : (
                  mealRow
                );
              })()}
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
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-card-lg)] bg-card p-4 min-h-[58px] transition-colors hover:bg-muted/30"
            aria-label={`Log ${nextSlot}`}
          >
            <span className="text-primary-solid">
              <SloePlusIcon className="h-5 w-5" />
            </span>
            <span className="font-medium text-[#6a6072]">
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
