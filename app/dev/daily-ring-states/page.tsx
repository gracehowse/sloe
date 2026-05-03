"use client";

/**
 * Daily-ring + NET-tile state showcase — visual validation harness for
 * Bundle 1A (B6/N3/N4/N5). Renders the components in 4 controlled
 * states so Playwright (or Grace) can screenshot them to confirm
 * the fixes match what's expected.
 *
 * Renders mock data only — no PII. Production exposure is handled by
 * a Vercel route block on /dev/* rather than an in-component gate
 * (the gate was unreliable: NODE_ENV/VERCEL_ENV inlining behaviour
 * differed between `next start` in CI and Vercel runtime, breaking
 * Playwright).
 */

import * as React from "react";
import { DailyRing } from "@/app/components/suppr/daily-ring";
import { TodayHeroStats } from "@/app/components/suppr/today-hero-stats";

export default function DailyRingStatesPage() {

  const states = [
    {
      id: "empty",
      title: "Empty (nothing logged)",
      consumed: 0,
      target: 1832,
      note: "N5 — should show 'Start your day', not a giant '1,832 / REMAINING'",
    },
    {
      id: "partial",
      title: "Partial (under target)",
      consumed: 800,
      target: 1832,
      note: "Standard — '1,032 REMAINING' (with comma — N3)",
    },
    {
      id: "at-goal",
      title: "At goal (exactly target)",
      consumed: 1832,
      target: 1832,
      note: "Edge — '0 REMAINING'",
    },
    {
      id: "over",
      title: "Over budget",
      consumed: 2338,
      target: 1832,
      note: "B6 — should show '506 OVER' (positive amount over), NOT '0 OVER'",
    },
  ] as const;

  return (
    <main className="min-h-screen bg-background text-foreground p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10">
          <h1 className="text-2xl font-bold">Bundle 1A — visual validation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            B6 / N3 / N4 / N5 fixes. Compare each state below to the expected
            behaviour described in the note.
          </p>
        </header>

        <section className="mb-12">
          <h2 className="text-lg font-semibold mb-4">DailyRing — 4 states (remaining mode, default)</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {states.map((s) => (
              <div
                key={s.id}
                data-testid={`state-${s.id}`}
                className="rounded-card border border-border bg-card p-4"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  {s.title}
                </p>
                <div className="flex justify-center mb-3">
                  <DailyRing
                    consumed={s.consumed}
                    target={s.target}
                    displayMode="remaining"
                    proteinPct={0.4}
                    carbsPct={0.5}
                    fatPct={0.3}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">{s.note}</p>
                <p className="text-[10px] tabular-nums text-muted-foreground/70 mt-1">
                  consumed {s.consumed} · target {s.target}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">TodayHeroStats — NET tile colour (N4)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div data-testid="hero-empty">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Empty (loggedKcal = 0) → NET should be NEUTRAL grey
              </p>
              <TodayHeroStats
                loggedKcal={0}
                targetKcal={1832}
                burnedKcal={0}
                consumed={0}
                target={1832}
                proteinPct={0}
                carbsPct={0}
                fatPct={0}
                expanded={false}
                onToggleExpanded={() => {}}
                displayMode="remaining"
                onDisplayModeChange={() => {}}
              />
            </div>
            <div data-testid="hero-under">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Under target (food logged) → NET should be SUCCESS green
              </p>
              <TodayHeroStats
                loggedKcal={1100}
                targetKcal={1832}
                burnedKcal={2200}
                consumed={1100}
                target={1832}
                proteinPct={0.5}
                carbsPct={0.6}
                fatPct={0.4}
                expanded={false}
                onToggleExpanded={() => {}}
                displayMode="remaining"
                onDisplayModeChange={() => {}}
              />
            </div>
            <div data-testid="hero-at-goal">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                At target → NET should be NEUTRAL (zero is not a deficit)
              </p>
              <TodayHeroStats
                loggedKcal={1832}
                targetKcal={1832}
                burnedKcal={2200}
                consumed={1832}
                target={1832}
                proteinPct={0.8}
                carbsPct={0.9}
                fatPct={0.7}
                expanded={false}
                onToggleExpanded={() => {}}
                displayMode="remaining"
                onDisplayModeChange={() => {}}
              />
            </div>
            <div data-testid="hero-over">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Over target → NET should be WARNING amber
              </p>
              <TodayHeroStats
                loggedKcal={2338}
                targetKcal={1832}
                burnedKcal={2200}
                consumed={2338}
                target={1832}
                proteinPct={1.1}
                carbsPct={1.2}
                fatPct={1.0}
                expanded={false}
                onToggleExpanded={() => {}}
                displayMode="remaining"
                onDisplayModeChange={() => {}}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
