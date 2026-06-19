import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/app/components/ui/button";

/**
 * ERR-02 fix (audit 2026-04-28): Next 15 used to fall back to its
 * default 404 page (bare "404 | This page could not be found.") with
 * no Suppr branding, no nav, and no recovery CTA. A user hitting
 * `/recipe/zzzzzzz` or any other invalid route saw a generic page that
 * didn't even look like Sloe — trust hit.
 *
 * Mirrors `app/error.tsx` styling so the recovery surfaces feel like
 * a single product instead of two ad-hoc pages.
 *
 * ENG-716 (token + a11y sweep): migrated off the raw `slate-*` Tailwind
 * palette literals onto the Sloe semantic tokens (`bg-background`,
 * `text-foreground`, `text-muted-foreground`, `border-border`, `bg-card`).
 * The recipe 404 (`app/recipe/[id]/not-found.tsx`) now shares this exact
 * shell — one 404 visual language across the product, lucide icon in a
 * tokenised circle, card + eyebrow + primary/outline CTA pair.
 */

export default function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center px-6 py-12 bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[var(--elev-card-soft)] text-center">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-muted">
          <FileQuestion className="size-7 text-muted-foreground" strokeWidth={1.75} aria-hidden />
        </div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">404</p>
        <h1 className="text-foreground mb-2 text-xl font-bold -tracking-[0.02em]">
          We couldn&apos;t find that page
        </h1>
        {/* 2026-05-12 (premium-bar audit copy fix): old copy assumed the
            user was looking for a recipe ("the recipe may have been
            deleted"). The 404 page handles every missing route — typos,
            stale bookmarks, retired campaign links — not just recipes.
            Generic + actionable reads better. */}
        <p className="text-sm text-muted-foreground mb-6">
          The link may be stale, or the content has moved. Try one of these instead.
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
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
