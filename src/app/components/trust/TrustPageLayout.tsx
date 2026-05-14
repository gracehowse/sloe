"use client";
/**
 * TrustPageLayout — shared shell for Privacy / Terms / DMCA / Licences.
 *
 * 2026-05-12 (premium-bar audit Group A trust pages, round 2): the
 * round-1 `<TrustPageHeader>` only unified the header strip. This
 * shell now also owns the page-level structure so every trust
 * surface gets:
 *
 *   - The unified header (back link, h1, last-updated + v1.0 pill,
 *     cross-link row).
 *   - A sticky ToC sidebar on desktop ≥ lg (1024px+) — when the
 *     caller passes `sections`. Each entry links to the matching
 *     `id` on a `<h2>` in the body content.
 *   - The body slot at the right column on desktop / full-width on
 *     mobile.
 *
 * `sections` is optional — pages that haven't enumerated their
 * sections still render correctly without the sidebar.
 */
import { ReactNode } from "react";
import { TrustPageHeader, type TrustPageHeaderProps } from "./TrustPageHeader";

export interface TrustPageSection {
  /** Matches the `id` on the corresponding `<h2>` in the body. */
  id: string;
  /** Display text in the ToC. */
  title: string;
}

export type TrustPageLayoutProps = Omit<TrustPageHeaderProps, "showCrossLinks"> & {
  /** Optional section list for the sticky ToC sidebar. When omitted,
   *  the layout renders a single-column body (no sidebar). */
  sections?: TrustPageSection[];
  children: ReactNode;
};

export function TrustPageLayout({
  title,
  lastUpdated,
  version,
  subtitle,
  sections,
  children,
  revisionPath,
}: TrustPageLayoutProps) {
  const hasToc = Array.isArray(sections) && sections.length > 0;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div
        className={`mx-auto px-6 py-12 ${hasToc ? "max-w-5xl" : "max-w-2xl"}`}
      >
        <TrustPageHeader
          title={title}
          lastUpdated={lastUpdated}
          version={version}
          subtitle={subtitle}
          revisionPath={revisionPath}
        />
        {hasToc ? (
          <div className="lg:grid lg:grid-cols-[180px_1fr] lg:gap-10">
            <nav
              className="hidden lg:block sticky top-12 self-start print:hidden"
              aria-label={`${title} sections`}
            >
              <ul className="space-y-2 text-sm">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="text-slate-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div>{children}</div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export default TrustPageLayout;
