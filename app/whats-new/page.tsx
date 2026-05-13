/**
 * "What's new in Suppr" — web page.
 *
 * Server component. Reads the shared changelog data from
 * `src/lib/changelog/entries.ts` at build time — no network fetch,
 * no runtime config. The mobile surface at
 * `apps/mobile/app/whats-new.tsx` renders the exact same entry, so
 * a bullet edit needs only one data change.
 *
 * 2026-05-12 (premium-bar audit #6 — Linear changelog parity):
 * upgraded from single-release header to all-releases-on-page scroll
 * narrative. Each release gets its own header + kind-coloured chip
 * sections so the page reads like a release timeline rather than
 * "the last build's notes". Kind label chips now use semantic
 * colours that read in both light + dark (NEW=success, FIXED=info,
 * COMING SOON=warning) instead of the prior `slate-500` washed-out
 * uppercase eyebrow.
 *
 * Entry points:
 *   1. Settings → About → "What's new in Suppr" (manual).
 *   2. Direct URL `/whats-new`.
 *
 * No web auto-surface — per the F-0 spec, a modal on web would feel
 * heavy and web users have a persistent nav to find this page.
 */
import Link from "next/link";
import type { Metadata } from "next";

import {
  changelogKindLabel,
  getAllChangelogs,
  groupChangelogItems,
  type ChangelogItemKind,
} from "../../src/lib/changelog/entries";

export const metadata: Metadata = {
  title: "What's new — Suppr",
  description:
    "Fixes, new features, and upcoming work in every Suppr build.",
  // 2026-05-13 — RSS feed discoverability. `<link rel="alternate">`
  // in the `<head>` lets feed-reader browser extensions auto-detect
  // the feed when the user lands on `/whats-new`.
  alternates: {
    types: {
      "application/rss+xml": "/whats-new/rss.xml",
    },
  },
};

function formatReleaseDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function kindChipClasses(kind: ChangelogItemKind): string {
  switch (kind) {
    case "new":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800";
    case "fixed":
      return "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800";
    case "coming_soon":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800";
  }
}

function kindBulletClasses(kind: ChangelogItemKind): string {
  switch (kind) {
    case "new":
      return "bg-emerald-500 dark:bg-emerald-400";
    case "fixed":
      return "bg-sky-500 dark:bg-sky-400";
    case "coming_soon":
      return "bg-amber-500 dark:bg-amber-400";
  }
}

export default function WhatsNewPage() {
  const entries = getAllChangelogs().filter((e) => e.items.length > 0);
  const latest = entries[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          <Link
            href="/"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            &larr; Back to app
          </Link>
        </p>

        <header className="mb-10">
          <h1
            className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white"
            data-testid="whats-new-title"
          >
            What&rsquo;s new in Suppr
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Every release, freshest first. New features, fixes, and what we
            are about to ship next.
          </p>
          {/* 2026-05-13 (premium-bar audit Group A Feature 4 #6):
              RSS subscribe link. Endpoint at `/whats-new/rss.xml`
              serialises the same `getAllChangelogs()` SSOT so a
              feed reader sees every shipped item. Linear / Vercel /
              Stripe all expose one. */}
          <a
            href="/whats-new/rss.xml"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
            data-testid="whats-new-rss-link"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M6.18 17.82c0 1.21-.98 2.18-2.18 2.18s-2.18-.97-2.18-2.18.97-2.18 2.18-2.18 2.18.97 2.18 2.18zm-4.36-7.18c0 .73.59 1.32 1.32 1.32 4.41 0 8 3.59 8 8 0 .73.59 1.32 1.32 1.32s1.32-.59 1.32-1.32c0-5.87-4.77-10.64-10.64-10.64-.73 0-1.32.59-1.32 1.32zm0-6c0 .73.59 1.32 1.32 1.32 7.72 0 14 6.28 14 14 0 .73.59 1.32 1.32 1.32s1.32-.59 1.32-1.32C19.78 7.42 12.36 0 4.14 0 3.41 0 2.82.59 2.82 1.32z" />
            </svg>
            Subscribe via RSS
          </a>
        </header>

        {entries.length === 0 ? (
          <p
            className="text-sm text-slate-600 dark:text-slate-300"
            data-testid="whats-new-empty"
          >
            We&rsquo;re cooking up the next set of improvements. Check back
            after the next TestFlight build lands.
          </p>
        ) : (
          <div className="space-y-12">
            {entries.map((entry, idx) => {
              const groups = groupChangelogItems(entry);
              const slug = `build-${entry.buildNumber}`;
              const isLatest = idx === 0 && entry === latest;
              return (
                <section
                  key={entry.buildNumber}
                  id={slug}
                  data-testid={`whats-new-release-${entry.buildNumber}`}
                  className="scroll-mt-12"
                >
                  <div className="mb-2 flex items-baseline gap-3 flex-wrap">
                    <h2
                      className="text-xl font-semibold text-slate-900 dark:text-white"
                      data-testid={`whats-new-release-title-${entry.buildNumber}`}
                    >
                      {`Build ${entry.buildNumber}`}{" "}
                      <span className="text-slate-500 dark:text-slate-400 font-normal">
                        {`(${entry.appVersion} #${entry.buildNumber})`}
                      </span>
                    </h2>
                    {isLatest ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                        Latest
                      </span>
                    ) : null}
                    <span
                      className="text-xs text-slate-500 dark:text-slate-400 ml-auto"
                      data-testid={`whats-new-date-${entry.buildNumber}`}
                    >
                      {formatReleaseDate(entry.releaseDate)}
                    </span>
                  </div>
                  {/* 2026-05-12 (premium-bar audit Group A #1):
                      optional 1-sentence release headline so each entry
                      reads as a story. Linear changelog parity. */}
                  {entry.releaseTitle ? (
                    <p
                      className="mb-4 text-sm text-slate-600 dark:text-slate-300"
                      data-testid={`whats-new-release-headline-${entry.buildNumber}`}
                    >
                      {entry.releaseTitle}
                    </p>
                  ) : null}

                  <div className="space-y-5">
                    {groups.map((group) => (
                      <div key={group.kind}>
                        <span
                          className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md mb-2 ${kindChipClasses(group.kind)}`}
                          data-testid={`whats-new-section-${entry.buildNumber}-${group.kind}`}
                        >
                          {changelogKindLabel(group.kind)}
                        </span>
                        <ul className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 divide-y divide-slate-100 dark:divide-slate-800">
                          {group.items.map((item, itemIdx) => (
                            <li
                              key={`${group.kind}-${itemIdx}`}
                              className="flex items-start gap-3 px-4 py-3"
                            >
                              <span
                                aria-hidden
                                className={`mt-2 h-1.5 w-1.5 rounded-full shrink-0 ${kindBulletClasses(group.kind)}`}
                              />
                              <span className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                                {item.text}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  {entry.testerAttribution ? (
                    <p
                      className="mt-4 text-xs text-slate-500 dark:text-slate-400"
                      data-testid={`whats-new-attribution-${entry.buildNumber}`}
                    >
                      {entry.testerAttribution}
                    </p>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
