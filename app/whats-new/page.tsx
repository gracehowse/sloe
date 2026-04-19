/**
 * "What's new in Suppr" — web page.
 *
 * Server component. Reads the shared changelog data from
 * `src/lib/changelog/entries.ts` at build time — no network fetch,
 * no runtime config. The mobile surface at
 * `apps/mobile/app/whats-new.tsx` renders the exact same entry, so
 * a bullet edit needs only one data change.
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
  getLatestChangelog,
  groupChangelogItems,
} from "../../src/lib/changelog/entries";

export const metadata: Metadata = {
  title: "What's new — Suppr",
  description:
    "Fixes, new features, and upcoming work in the latest Suppr build.",
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

export default function WhatsNewPage() {
  const entry = getLatestChangelog();
  const groups = groupChangelogItems(entry);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          <Link
            href="/"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            &larr; Back to app
          </Link>
        </p>

        <div
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 mb-8"
          data-testid="whats-new-header"
        >
          <h1
            className="text-2xl font-semibold text-slate-900 dark:text-white"
            data-testid="whats-new-title"
          >
            {`Build ${entry.buildNumber} (${entry.appVersion} #${entry.buildNumber})`}
          </h1>
          <p
            className="text-sm text-slate-500 dark:text-slate-400 mt-1"
            data-testid="whats-new-date"
          >
            {formatReleaseDate(entry.releaseDate)}
          </p>
        </div>

        {groups.length === 0 ? (
          <p
            className="text-sm text-slate-600 dark:text-slate-300"
            data-testid="whats-new-empty"
          >
            We&rsquo;re cooking up the next set of improvements. Check back
            after the next TestFlight build lands.
          </p>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.kind}>
                <h2
                  className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2"
                  data-testid={`whats-new-section-${group.kind}`}
                >
                  {changelogKindLabel(group.kind)}
                </h2>
                <ul className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 divide-y divide-slate-100 dark:divide-slate-800">
                  {group.items.map((item, idx) => (
                    <li
                      key={`${group.kind}-${idx}`}
                      className="flex items-start gap-3 px-4 py-3"
                    >
                      <span
                        aria-hidden
                        className="mt-2 h-1.5 w-1.5 rounded-full bg-violet-500 dark:bg-violet-400 shrink-0"
                      />
                      <span className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {entry.testerAttribution ? (
          <p
            className="text-center text-xs text-slate-500 dark:text-slate-400 mt-8"
            data-testid="whats-new-attribution"
          >
            {entry.testerAttribution}
          </p>
        ) : null}
      </div>
    </div>
  );
}
