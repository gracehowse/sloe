import type { Metadata } from "next";
import Link from "next/link";
import { SupprLogoMark } from "../components/SupprLogoMark.tsx";
import { ROADMAP, type RoadmapStatus } from "../../src/lib/landing/content";

export const metadata: Metadata = {
  title: "Roadmap — Suppr",
  description:
    "What we’re building next on Suppr — mobile, creators, discovery, and macro-first meal planning.",
};

/**
 * /roadmap reads from the `ROADMAP` SSOT in `src/lib/landing/content.ts`
 * so a single edit in that file updates both the landing roadmap section
 * AND this standalone page (fix H19 / sync-enforcer round 2026-04-21).
 * Never hand-write prose bullets here — add to `ROADMAP` instead so the
 * parity tests catch drift.
 */

const STATUS_COPY: Record<RoadmapStatus, { label: string; className: string; dotClass: string }> = {
  shipped: {
    label: "Shipped",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    dotClass: "bg-emerald-500 dark:bg-emerald-400",
  },
  building: {
    label: "Building",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    dotClass: "bg-amber-500 dark:bg-amber-400",
  },
  planned: {
    label: "Planned",
    className: "bg-muted text-muted-foreground",
    dotClass: "bg-slate-400 dark:bg-slate-500",
  },
};

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold">
            <SupprLogoMark className="h-8 w-8" />
            Suppr
          </Link>
          <Link
            href="/pricing"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Pricing
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Roadmap</h1>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Suppr is evolving quickly — here’s the direction of travel. Everything
          below is read from the same source of truth that powers our landing
          page, so what you see is what’s actually in (or coming to) the app.
        </p>
        <div className="mt-10 space-y-10">
          {ROADMAP.map((bucket) => {
            // 2026-05-12 (premium-bar audit Group A Roadmap #4): count
            // chip row above each bucket so the user can scan progress
            // at a glance without reading every row. e.g. "5 shipped ·
            // 2 building · 3 planned".
            const counts = bucket.items.reduce(
              (acc, it) => {
                acc[it.status]++;
                return acc;
              },
              { shipped: 0, building: 0, planned: 0 } as Record<RoadmapStatus, number>,
            );
            return (
              <section key={bucket.title}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-xl font-semibold tracking-tight">
                    {bucket.title}
                  </h2>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {bucket.when}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {bucket.summary}
                </p>
                {/* Status count chip row */}
                <div className="mt-3 flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                  {(["shipped", "building", "planned"] as const).map((s) => {
                    if (counts[s] === 0) return null;
                    const meta = STATUS_COPY[s];
                    return (
                      <span key={s} className="inline-flex items-center gap-1.5">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                        {counts[s]} {meta.label.toLowerCase()}
                      </span>
                    );
                  })}
                </div>
                {/* 2026-05-12 (premium-bar audit Group A Roadmap #6):
                    single status dot at the row's left edge so the
                    eye can scan a column of dots without re-reading
                    chip text on every row. Chip retained at right
                    edge for accessibility (Voice-Over still reads
                    "Shipped" / "Building" / "Planned"). */}
                <ul className="mt-3 space-y-3 text-sm leading-relaxed sm:text-base">
                  {bucket.items.map((item) => {
                    const status = STATUS_COPY[item.status];
                    return (
                      <li
                        key={item.text}
                        className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
                      >
                        <span
                          aria-hidden
                          className={`mt-1.5 inline-block w-2 h-2 rounded-full shrink-0 ${status.dotClass}`}
                        />
                        <span className="text-foreground flex-1">{item.text}</span>
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            href="/signup"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm hover:brightness-[1.03]"
          >
            Get started
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-card px-6 text-sm font-semibold hover:bg-accent"
          >
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
