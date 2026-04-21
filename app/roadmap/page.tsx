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

const STATUS_COPY: Record<RoadmapStatus, { label: string; className: string }> = {
  shipped: {
    label: "Shipped",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  building: {
    label: "Building",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  planned: {
    label: "Planned",
    className: "bg-muted text-muted-foreground",
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
          {ROADMAP.map((bucket) => (
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
              <ul className="mt-4 space-y-3 text-sm leading-relaxed sm:text-base">
                {bucket.items.map((item) => {
                  const status = STATUS_COPY[item.status];
                  return (
                    <li
                      key={item.text}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
                    >
                      <span className="text-foreground">{item.text}</span>
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
          ))}
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
