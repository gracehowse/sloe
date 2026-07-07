"use client";

import { useMemo } from "react";
import { dateKeyFromDate } from "./journalNavigation.ts";
import type { LoggedMeal } from "../../types/recipe.ts";

export interface TrackerWeekDay {
  key: string;
  short: string;
  date: Date;
  totals: { calories: number; protein: number; carbs: number; fat: number };
  waterMl: number;
  steps: number | null;
}

export interface TrackerWeekData {
  days: TrackerWeekDay[];
  weekTotals: { calories: number; protein: number; carbs: number; fat: number };
  weekAvg: { calories: number; protein: number; carbs: number; fat: number };
  daysWithFood: number;
  loggedDaysInWeek: number;
  label: string;
}

/**
 * ENG-1360 (second extraction pass) — the week-strip / week-view data memo:
 * given the displayed day, buckets the 7 days of its calendar week (respecting
 * the user's `week_start_day` pref), sums each day's macro totals + water +
 * steps, then rolls those up into week totals / week averages / a "days
 * logged" count and a human date-range label. Byte-for-byte lift of the
 * original `useMemo` that used to live inline in NutritionTracker — same
 * math, same dependency array — just relocated so the host's local
 * computation list shrinks. No behavior change.
 */
export function useTrackerWeekData(
  selectedDate: Date,
  nutritionByDay: Record<string, LoggedMeal[]>,
  weekStartDay: "monday" | "sunday",
  extraWaterByDay: Record<string, number>,
  stepsByDay: Record<string, number>,
): TrackerWeekData {
  return useMemo(() => {
    const d = new Date(selectedDate);
    const dow = d.getDay();
    const startOffset = weekStartDay === "monday" ? (dow === 0 ? -6 : 1 - dow) : -dow;
    const weekFirst = new Date(d);
    weekFirst.setDate(d.getDate() + startOffset);

    const dayLabels =
      weekStartDay === "monday"
        ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const days: TrackerWeekDay[] = [];

    for (let i = 0; i < 7; i++) {
      const dd = new Date(weekFirst);
      dd.setDate(weekFirst.getDate() + i);
      const dk = dateKeyFromDate(dd);
      const meals = nutritionByDay[dk] ?? [];
      const totals = meals.reduce(
        (acc, m) => ({
          calories: acc.calories + Math.max(0, m.calories),
          protein: acc.protein + Math.max(0, m.protein),
          carbs: acc.carbs + Math.max(0, m.carbs),
          fat: acc.fat + Math.max(0, m.fat),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
      const mealWater = meals.reduce((s, m) => s + Math.max(0, m.waterMl ?? 0), 0);
      const waterMl = Math.round(mealWater + (extraWaterByDay[dk] ?? 0));
      const stepsLogged = Object.prototype.hasOwnProperty.call(stepsByDay, dk);
      const steps = stepsLogged ? (stepsByDay[dk] ?? 0) : null;
      days.push({ key: dk, short: dayLabels[i]!, date: dd, totals, waterMl, steps });
    }

    const weekTotals = days.reduce(
      (acc, x) => ({
        calories: acc.calories + x.totals.calories,
        protein: acc.protein + x.totals.protein,
        carbs: acc.carbs + x.totals.carbs,
        fat: acc.fat + x.totals.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );

    const daysWithFood = Math.max(1, days.filter((x) => x.totals.calories > 0).length);
    const weekAvg = {
      calories: Math.round(weekTotals.calories / daysWithFood),
      protein: Math.round(weekTotals.protein / daysWithFood),
      carbs: Math.round(weekTotals.carbs / daysWithFood),
      fat: Math.round(weekTotals.fat / daysWithFood),
    };

    const weekStartLabel = weekFirst.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const weekLast = new Date(weekFirst);
    weekLast.setDate(weekFirst.getDate() + 6);
    const weekEndLabel = weekLast.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

    const loggedDaysInWeek = days.filter((x) => x.totals.calories > 0).length;
    return {
      days,
      weekTotals,
      weekAvg,
      daysWithFood,
      loggedDaysInWeek,
      label: `${weekStartLabel} – ${weekEndLabel}`,
    };
  }, [selectedDate, nutritionByDay, weekStartDay, extraWaterByDay, stepsByDay]);
}
