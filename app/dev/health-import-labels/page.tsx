"use client";

/**
 * Web validation harness for Bundle 1B (N1).
 *
 * Mirrors `apps/mobile/app/dev/health-import-labels.tsx`.
 *
 * 404 in production. Local-only.
 */
import * as React from "react";
import { notFound } from "next/navigation";
import {
  formatHealthImportFallbackTitle,
  isHealthImportFallbackTitle,
} from "@/lib/nutrition/healthImportLabels";

const SAMPLE_RECENTS = [
  { id: "r1", title: "Spicy Feta Chicken Crunch", kcal: 235 },
  { id: "r2", title: "Best Lentil Soup", kcal: 464 },
  { id: "r3", title: "Food log (250 kcal)", kcal: 250 },
  { id: "r4", title: "Food log (80 kcal)", kcal: 80 },
  { id: "r5", title: "Greek Yoghurt Bowl", kcal: 320 },
  { id: "r6", title: "MyFitnessPal entry · 250 kcal", kcal: 250 },
  { id: "r7", title: "Lose It! entry · 80 kcal", kcal: 80 },
  { id: "r8", title: "Veggie Bibimbap", kcal: 520 },
] as const;

export default function HealthImportLabelsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const filtered = SAMPLE_RECENTS.filter((r) => !isHealthImportFallbackTitle(r.title));

  return (
    <main className="min-h-screen bg-background text-foreground p-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10">
          <h1 className="text-2xl font-bold">Bundle 1B — visual validation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            HealthKit-import fallback label rules. N1 fix.
          </p>
        </header>

        <section
          data-testid="format-comparison"
          className="mb-8 rounded-card border border-border bg-card p-5"
        >
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Fallback string format
          </p>
          <p className="text-xs text-muted-foreground mb-1">BEFORE (legacy)</p>
          <p className="font-mono text-sm mb-4">
            Food log (250 kcal) (via MyFitnessPal)
          </p>
          <p className="text-xs text-muted-foreground mb-1">AFTER (new)</p>
          <p className="font-mono text-sm">
            {formatHealthImportFallbackTitle({ sourceApp: "MyFitnessPal", calories: 250 })}
          </p>
        </section>

        <section
          data-testid="recents-unfiltered"
          className="mb-8 rounded-card border border-border bg-card p-5"
        >
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Recents (unfiltered — broken state)
          </p>
          <ul className="divide-y divide-border">
            {SAMPLE_RECENTS.map((r) => (
              <RecentRow
                key={r.id}
                title={r.title}
                kcal={r.kcal}
                flagged={isHealthImportFallbackTitle(r.title)}
              />
            ))}
          </ul>
        </section>

        <section
          data-testid="recents-filtered"
          className="rounded-card border border-success/30 bg-success/5 p-5"
        >
          <p className="text-[11px] font-bold uppercase tracking-widest text-success mb-3">
            Recents (after filter — fixed state)
          </p>
          <ul className="divide-y divide-border">
            {filtered.map((r) => (
              <RecentRow key={r.id} title={r.title} kcal={r.kcal} flagged={false} />
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

function RecentRow({ title, kcal, flagged }: { title: string; kcal: number; flagged: boolean }) {
  return (
    <li className="flex items-center justify-between py-2">
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm truncate ${flagged ? "line-through text-muted-foreground" : "text-foreground"}`}
        >
          {title}
        </p>
        {flagged ? (
          <p className="text-[11px] text-warning mt-0.5">⚠ filtered (fallback row)</p>
        ) : null}
      </div>
      <span className="text-xs text-muted-foreground ml-3 tabular-nums">{kcal} kcal</span>
    </li>
  );
}
