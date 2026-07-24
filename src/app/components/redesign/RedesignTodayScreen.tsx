"use client";

/**
 * RedesignTodayScreen — a self-contained PROTOTYPE of the refreshed Today
 * dashboard. It does NOT touch the live authed tracker; it runs on mock data
 * so the evolved design direction can be reviewed in isolation at
 * `/redesign/today`.
 *
 * Refresh principles applied here (evolution, not rebrand):
 *  - Editorial header: an oversized serif greeting sets the tone; date + brand
 *    mark sit as quiet chrome.
 *  - One clear hero: the calorie ring gets real breathing room with a compact
 *    macro legend beside it, instead of competing tiles.
 *  - Rhythm: consistent 24px warm slabs, a single 4px spacing grid, tabular
 *    numerals, and slim tinted progress rails in each macro's own hue.
 *  - Quiet-loud hierarchy: uppercase eyebrows, serif numerals as the loud
 *    layer, muted supporting copy.
 */

import { useState } from "react";
import {
  Flame,
  Plus,
  Camera,
  Search,
  Footprints,
  Activity,
  Check,
  Clock,
} from "lucide-react";
import { RedesignRing } from "./RedesignRing";
import { RedesignMacroStat } from "./RedesignMacroStat";

const serif: React.CSSProperties = { fontFamily: "var(--font-display)" };

const MACROS = [
  { label: "Protein", value: 96, goal: 140, color: "var(--macro-protein)" },
  { label: "Carbs", value: 150, goal: 210, color: "var(--macro-carbs)" },
  { label: "Fat", value: 48, goal: 70, color: "var(--macro-fat)" },
];

const MEALS = [
  { name: "Greek yogurt & berry bowl", slot: "Breakfast", time: "8:00", kcal: 320, logged: true },
  { name: "Chicken quinoa salad", slot: "Lunch", time: "12:30", kcal: 540, logged: true },
  { name: "Apple & almond butter", slot: "Snack", time: "15:30", kcal: 210, logged: true },
  { name: "Salmon, greens & wild rice", slot: "Dinner", time: "19:00", kcal: 350, logged: false },
];

export function RedesignTodayScreen() {
  const [tab, setTab] = useState<"day" | "week">("day");

  return (
    <div
      className="min-h-dvh w-full"
      style={{ backgroundColor: "var(--background)", color: "var(--foreground)" }}
    >
      <div className="mx-auto w-full max-w-2xl px-5 pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6">
        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p
              className="mb-1 text-[11px] uppercase tracking-[0.16em]"
              style={{ color: "var(--foreground-tertiary)" }}
            >
              Wednesday, April 8
            </p>
            <h1
              className="text-balance leading-[1.05]"
              style={{ ...serif, fontSize: "2.0625rem", color: "var(--foreground-brand)" }}
            >
              Good morning, Grace
            </h1>
          </div>
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-medium"
            style={{ backgroundColor: "var(--avatar-identity)", color: "#fff" }}
            aria-hidden
          >
            G
          </div>
        </header>

        {/* ── Day / Week toggle ──────────────────────────────────── */}
        <div
          className="mb-5 inline-flex rounded-full p-1"
          style={{ backgroundColor: "var(--background-secondary)" }}
          role="tablist"
          aria-label="Timeframe"
        >
          {(["day", "week"] as const).map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t)}
                className="rounded-full px-5 py-1 text-[13px] font-medium capitalize transition-colors"
                style={{
                  backgroundColor: active ? "var(--card)" : "transparent",
                  color: active ? "var(--foreground-brand)" : "var(--foreground-tertiary)",
                  boxShadow: active ? "var(--shadow-sm)" : "none",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>

        {/* ── Hero: ring + macro legend ──────────────────────────── */}
        <section
          className="mb-4 rounded-[var(--radius-card-lg)] bg-card card-slab p-6"
          aria-label="Calories and macros"
        >
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
            <RedesignRing consumed={1420} goal={2100} />
            <div className="flex w-full flex-1 flex-col gap-4">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4" style={{ color: "var(--accent-clay)" }} aria-hidden />
                <span
                  className="text-[13px] font-medium"
                  style={{ color: "var(--foreground-secondary)" }}
                >
                  2,100 base &middot; +180 activity
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {MACROS.map((m) => (
                  <RedesignMacroStat key={m.label} variant="compact" {...m} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Secondary tiles: fiber + water ─────────────────────── */}
        <section className="mb-4 grid grid-cols-2 gap-4">
          <RedesignMacroStat label="Fiber" value={18} goal={30} color="var(--macro-fiber)" />
          <RedesignMacroStat label="Water" value={1.4} goal={2.5} unit="L" color="var(--macro-water)" />
        </section>

        {/* ── Planned meals ──────────────────────────────────────── */}
        <section
          className="mb-4 rounded-[var(--radius-card-lg)] bg-card card-slab p-5"
          aria-label="Today's meals"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 style={{ ...serif, fontSize: "1.25rem", color: "var(--foreground-brand)" }}>
              Today&apos;s meals
            </h2>
            <span className="text-[13px]" style={{ color: "var(--foreground-tertiary)" }}>
              3 of 4 logged
            </span>
          </div>
          <ul className="flex flex-col">
            {MEALS.map((meal, i) => (
              <li
                key={meal.name}
                className="flex items-center gap-3 py-3"
                style={{
                  borderTop: i === 0 ? "none" : "1px solid var(--border)",
                }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: meal.logged
                      ? "var(--accent-success-soft)"
                      : "var(--background-secondary)",
                    color: meal.logged
                      ? "var(--accent-success-solid)"
                      : "var(--foreground-tertiary)",
                  }}
                  aria-hidden
                >
                  {meal.logged ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium" style={{ color: "var(--foreground)" }}>
                    {meal.name}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--foreground-tertiary)" }}>
                    {meal.slot} &middot; {meal.time}
                  </p>
                </div>
                <span
                  className="shrink-0 text-[13px] tabular-nums font-medium"
                  style={{ color: meal.logged ? "var(--foreground-secondary)" : "var(--foreground-tertiary)" }}
                >
                  {meal.kcal} kcal
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Activity summary ───────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 rounded-[var(--radius-card-lg)] bg-card card-slab p-4">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--macro-water-soft)", color: "var(--macro-water)" }}
              aria-hidden
            >
              <Footprints className="h-5 w-5" />
            </span>
            <div>
              <p className="tabular-nums" style={{ ...serif, fontSize: "1.375rem", color: "var(--foreground-brand)" }}>
                7,240
              </p>
              <p className="text-[11px]" style={{ color: "var(--foreground-tertiary)" }}>
                steps today
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-[var(--radius-card-lg)] bg-card card-slab p-4">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--accent-primary-soft)", color: "var(--accent-primary)" }}
              aria-hidden
            >
              <Activity className="h-5 w-5" />
            </span>
            <div>
              <p className="tabular-nums" style={{ ...serif, fontSize: "1.375rem", color: "var(--foreground-brand)" }}>
                320
              </p>
              <p className="text-[11px]" style={{ color: "var(--foreground-tertiary)" }}>
                kcal active
              </p>
            </div>
          </div>
        </section>

        <p className="mt-6 text-center text-[11px]" style={{ color: "var(--foreground-tertiary)" }}>
          Prototype &middot; refreshed Today direction &middot; mock data
        </p>
      </div>

      {/* ── Quick-log bar ──────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center px-5 pb-6">
        <div
          className="pointer-events-auto flex items-center gap-1 rounded-full p-1"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <button
            className="flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-medium"
            style={{ backgroundColor: "var(--accent-primary)", color: "var(--accent-primary-foreground)" }}
          >
            <Plus className="h-4 w-4" />
            Log food
          </button>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{ color: "var(--foreground-secondary)" }}
            aria-label="Snap a meal"
          >
            <Camera className="h-5 w-5" />
          </button>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{ color: "var(--foreground-secondary)" }}
            aria-label="Search foods"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
