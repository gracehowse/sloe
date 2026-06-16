/**
 * /today — canonical Today render path.
 *
 * 2026-05-12 (premium-bar audit refuse-to-pass #2): mounts the
 * shared `<HomePageClient />` directly so the browser URL stays as
 * `/today` instead of redirecting to `/home?view=today`. The App
 * shell reads `usePathname()` and derives the current view from the
 * path; `?view=` is still supported as a legacy alias for old
 * bookmarks.
 *
 * Auth gating is handled inside HomePageClient. Middleware also
 * catches unauthed access (the path is not in `PUBLIC_ROUTES`) and
 * 307s to /login before any client JS runs.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Today — Sloe",
  description: "Your daily macros, planned meals, and quick-log.",
};

/** UI shell: `app/(product)/layout.tsx` → HomePageClient */
export default function TodayPage() {
  return null;
}
