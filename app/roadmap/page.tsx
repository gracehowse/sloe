import type { Metadata } from "next";
import Link from "next/link";
import { SupprLogoMark } from "../components/SupprLogoMark.tsx";
import { ROADMAP, type RoadmapStatus } from "../../src/lib/landing/content";

export const metadata: Metadata = {
  title: "Roadmap — Sloe",
  description:
    "What we’re building next on Sloe — mobile, creators, discovery, and macro-first meal planning.",
};

/**
 * /roadmap reads from the `ROADMAP` SSOT in `src/lib/landing/content.ts`
 * so a single edit in that file updates both the landing roadmap section
 * AND this standalone page (fix H19 / sync-enforcer round 2026-04-21).
 * Never hand-write prose bullets here — add to `ROADMAP` instead so the
 * parity tests catch drift.
 */

const STATUS_COPY: Record<RoadmapStatus, {
  label: string;
  className: string;
  dotClass: string;
  rowBg: string;
  borderAccent: string;
}> = {
  shipped: {
    label: "Shipped",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    dotClass: "bg-emerald-500 dark:bg-emerald-400",
    rowBg: "bg-emerald-50/40 dark:bg-emerald-950/20",
    borderAccent: "border-l-emerald-500 dark:border-l-emerald-400",
  },
  building: {
    label: "Building",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    dotClass: "bg-amber-500 dark:bg-amber-400",
    rowBg: "bg-amber-50/40 dark:bg-amber-950/20",
    borderAccent: "border-l-amber-500 dark:border-l-amber-400",
  },
  planned: {
    label: "Planned",
    className: "bg-muted text-muted-foreground",
    dotClass: "bg-slate-400 dark:bg-slate-500",
    rowBg: "",
    borderAccent: "border-l-transparent",
  },
};

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          {/* ENG-1298 — the mark IS the lowercase wordmark; the old-brand
              literal beside it rendered a double lockup. Header stays
              deliberately minimal (wordmark + one link), matching its nearest
              sibling standalone-page header in app/pricing/page.tsx — it is
              NOT the full landing nav element. */}
          <Link href="/" className="inline-flex items-center text-[22px]" aria-label="Sloe">
            <SupprLogoMark />
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
          Sloe is evolving quickly — here’s the direction of travel. Everything
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
                {/* 2026-05-13 (premium-bar audit Group A Roadmap #2):
                    tightened from per-item cards (p-4 + border + shadow)
                    to a divider-list (rounded outer border, divide-y
                    between rows, py-2.5 sm:py-3 ≈ 40-44px row height).
                    Linear / Vercel / Notion all use a divider-list for
                    long scannable progress lists — the per-item card
                    pattern was over-weighted for a list this long and
                    bloated the page vertically. Status dot stays at
                    left edge; chip retained at right for VoiceOver. */}
                <ul className="mt-3 rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border text-sm leading-relaxed sm:text-base">
                  {bucket.items.map((item) => {
                    const status = STATUS_COPY[item.status];
                    const rowClasses = `flex items-center gap-3 px-4 py-2.5 sm:py-3 border-l-[3px] ${status.borderAccent} ${status.rowBg}`;
                    const Wrapper = status.label === "Shipped"
                      ? (props: React.PropsWithChildren) => (
                          <Link
                            href="/whats-new"
                            className={`${rowClasses} hover:bg-accent/50 transition-colors`}
                          >
                            {props.children}
                          </Link>
                        )
                      : (props: React.PropsWithChildren) => (
                          <div className={rowClasses}>
                            {props.children}
                          </div>
                        );
                    return (
                      <li key={item.text}>
                        <Wrapper>
                          <span
                            aria-hidden
                            className={`inline-block w-2 h-2 rounded-full shrink-0 ${status.dotClass}`}
                          />
                          <span className="text-foreground flex-1">{item.text}</span>
                          <span
                            className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </Wrapper>
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
          {/* 2026-05-13 (premium-bar audit Group A Roadmap #5 — "Get
              notified when X ships"): full email-capture form needs a
              backend endpoint (Mailchimp / Resend / Loops) which
              isn't wired yet, so the substitute is an RSS subscribe
              link. Users who want to track shipped items can add the
              /whats-new RSS feed to their reader of choice. Same
              affordance Vercel / Linear use as their "track new
              versions" path. */}
          <a
            href="/whats-new/rss.xml"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M6.18 17.82c0 1.21-.98 2.18-2.18 2.18s-2.18-.97-2.18-2.18.97-2.18 2.18-2.18 2.18.97 2.18 2.18zm-4.36-7.18c0 .73.59 1.32 1.32 1.32 4.41 0 8 3.59 8 8 0 .73.59 1.32 1.32 1.32s1.32-.59 1.32-1.32c0-5.87-4.77-10.64-10.64-10.64-.73 0-1.32.59-1.32 1.32zm0-6c0 .73.59 1.32 1.32 1.32 7.72 0 14 6.28 14 14 0 .73.59 1.32 1.32 1.32s1.32-.59 1.32-1.32C19.78 7.42 12.36 0 4.14 0 3.41 0 2.82.59 2.82 1.32z" />
            </svg>
            Get notified — RSS
          </a>
        </div>
      </main>
    </div>
  );
}
