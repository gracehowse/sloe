import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { Button } from "@/app/components/ui/button";

/**
 * Recipe-specific 404. Shares the exact shell of the generic
 * `app/not-found.tsx` (ENG-716 unification): one 404 visual language
 * across the product — tokenised card + eyebrow + lucide icon in a
 * tokenised circle + primary/outline CTA pair. The two pages used to
 * diverge wildly (this one once shipped a cool-grey ground, a
 * gradient-circle plate emoji, and a purple-to-blue gradient CTA; the
 * generic one was a plain card shell). Now they read as one product.
 *
 * Kept distinct from the generic 404: the recipe-aware copy and the CTA
 * destinations (Discover feed + Today) — a user who hit a dead recipe
 * link wants to keep browsing recipes, not bounce to the marketing site.
 */

export default function RecipeNotFound() {
  return (
    <div className="min-h-screen grid place-items-center px-6 py-12 bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[var(--elev-card-soft)] text-center">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-muted">
          <UtensilsCrossed className="size-7 text-muted-foreground" strokeWidth={1.75} aria-hidden />
        </div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">404</p>
        {/* v3 prototype serif state title — the NotFound screen overrides
            `.state__title` (base 18px) to 24px semibold; shared with the
            generic 404 shell. (ENG-1247) */}
        <h1 className="text-foreground mb-2 font-[family-name:var(--font-headline)] text-2xl font-semibold">
          Recipe not found
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          This recipe may have been removed or is no longer public. Browse our community for more inspiration.
        </p>
        {/* 2026-05-13 (premium-bar audit Group F web — fix 404 CTA loop):
            old primary CTA pointed at "/" (landing), which dropped the
            user out of the product back to the marketing page — felt
            like a dead end on a typoed link. Now points at the in-app
            Discover feed so the user lands somewhere they can actually
            keep browsing. */}
        <div className="flex flex-wrap gap-2 justify-center">
          <Button asChild>
            <Link href="/discover">Browse recipes</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/today">Back to Today</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
