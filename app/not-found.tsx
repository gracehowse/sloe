import Link from "next/link";
import { Button } from "@/app/components/ui/button";

/**
 * ERR-02 fix (audit 2026-04-28): Next 15 used to fall back to its
 * default 404 page (bare "404 | This page could not be found.") with
 * no Suppr branding, no nav, and no recovery CTA. A user hitting
 * `/recipe/zzzzzzz` or any other invalid route saw a generic page that
 * didn't even look like Suppr — trust hit.
 *
 * Mirrors `app/error.tsx` styling so the recovery surfaces feel like
 * a single product instead of two ad-hoc pages.
 */

export default function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center px-6 py-12 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/40 p-6 shadow-lg">
        <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
          404
        </p>
        <h1 className="text-slate-900 dark:text-white mb-2">
          We couldn&apos;t find that page
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
          The link may be stale or the recipe may have been deleted. Try one
          of these instead.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/home">Back to Today</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/home?view=discover">Browse recipes</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
