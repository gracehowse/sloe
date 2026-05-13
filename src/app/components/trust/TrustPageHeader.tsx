"use client";
/**
 * TrustPageHeader — shared header for Privacy / Terms / DMCA / Licences.
 *
 * 2026-05-12 (premium-bar audit Group A trust pages): the four trust
 * pages all rendered slightly different headers (some had "Last
 * updated: April 2026" inline in prose, some didn't carry a version
 * at all). This component unifies the header so every trust surface
 * carries:
 *
 *   - "← Back to app" link to /
 *   - h1 (page title)
 *   - "Last updated {date} · v{version}" + jump-to-related links
 *
 * Future polish (deferred): sticky ToC sidebar on desktop ≥ lg,
 * print/PDF affordance, per-section "Permalink" copy buttons.
 */
import Link from "next/link";

export interface TrustPageHeaderProps {
  title: string;
  /** Last-updated date, e.g. "April 2026" or "19 April 2026". */
  lastUpdated: string;
  /** Version chip text, e.g. "v1.0". Omit to hide the chip. */
  version?: string;
  /** Optional one-line subtitle under the h1. */
  subtitle?: string;
  /** When `true` (default), render the cross-link row below the
   *  version line. Set `false` on a page that doesn't want a
   *  related-docs jump (rare). */
  showCrossLinks?: boolean;
  /** 2026-05-13 — repo path for the page (e.g. `app/privacy/page.tsx`).
   *  When provided, the header renders a "Revision history" link
   *  pointing at the GitHub `/commits/main/<path>` view so users +
   *  legal reviewers can see what changed per version without us
   *  maintaining a separate per-page changelog. */
  revisionPath?: string;
}

export function TrustPageHeader({
  title,
  lastUpdated,
  version,
  subtitle,
  showCrossLinks = true,
  revisionPath,
}: TrustPageHeaderProps) {
  return (
    <header className="mb-8">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        <Link
          href="/"
          className="text-violet-600 dark:text-violet-400 hover:underline"
        >
          ← Back to app
        </Link>
      </p>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {subtitle}
        </p>
      ) : null}
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Last updated {lastUpdated}
        </span>
        {version ? (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {version}
          </span>
        ) : null}
        {/* 2026-05-13 (premium-bar audit Group A trust pages —
            print/save-as-PDF affordance): every UK/EU compliance
            and US legal review process expects a "save a copy"
            option on Privacy / Terms. The browser's print dialog
            doubles as "Save as PDF" on macOS / iOS / Windows, so a
            single button covers both intents without an extra
            client-side PDF lib. Hidden when JS is off (the same
            print menu item is still in the browser's File menu). */}
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.print();
            }
          }}
          className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors print:hidden"
        >
          Print / save PDF
        </button>
        {/* 2026-05-13 (premium-bar audit Group A trust pages —
            version-history link): legal-review processes (and
            careful users) want to see what changed between
            versions. The trust pages are checked into git at
            `app/{privacy,terms,dmca,licences}/page.tsx`; linking
            the GitHub commits view gives a full per-line revision
            history without us maintaining a separate changelog
            doc per page. The repo is public so no auth gate. */}
        {revisionPath ? (
          <a
            href={`https://github.com/gracehowse/Suppr/commits/main/${revisionPath}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors print:hidden"
          >
            Revision history ↗
          </a>
        ) : null}
      </div>
      {showCrossLinks ? (
        <nav
          className="mt-4 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap"
          aria-label="Trust pages"
        >
          <Link
            href="/privacy"
            className="hover:text-violet-600 dark:hover:text-violet-400"
          >
            Privacy
          </Link>
          <span aria-hidden>·</span>
          <Link
            href="/terms"
            className="hover:text-violet-600 dark:hover:text-violet-400"
          >
            Terms
          </Link>
          <span aria-hidden>·</span>
          <Link
            href="/dmca"
            className="hover:text-violet-600 dark:hover:text-violet-400"
          >
            DMCA
          </Link>
          <span aria-hidden>·</span>
          <Link
            href="/licences"
            className="hover:text-violet-600 dark:hover:text-violet-400"
          >
            Licences
          </Link>
          <span aria-hidden>·</span>
          <Link
            href="/help"
            className="hover:text-violet-600 dark:hover:text-violet-400"
          >
            Help
          </Link>
        </nav>
      ) : null}
    </header>
  );
}

export default TrustPageHeader;
