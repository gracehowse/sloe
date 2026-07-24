"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { Bookmark, ChevronLeft, ChevronRight } from "lucide-react";

import { isFeatureEnabled } from "../../src/lib/analytics/track.ts";
import { TRENDING_RECIPES } from "../../src/lib/landing/sloeLandingContent.ts";

/**
 * "Trending this week" — the landing recipe rail.
 *
 * Extracted from `LandingPage.tsx` in the design-consistency pass (2026-07-24)
 * so that file stays under its line budget (`npm run check:screen-budget`).
 *
 * The fix this file carries was the most visible cross-surface break in the
 * product: the marketing rail composed a recipe card as TITLE → bookmark →
 * IMAGE → author, while every in-app surface (`DiscoverFeed.tsx`,
 * `library/RecipeCardWide.tsx`, `suppr/discover-quick-weeknight.tsx`, and the
 * mobile twins) composes IMAGE → title → meta. Same content type, inverted
 * composition, one click apart. The in-app treatment wins: the photo is what
 * sells a recipe, and it is what the visitor meets on the other side of the
 * click. The bookmark went with it — nothing is saveable from an
 * unauthenticated marketing rail, so it advertised an action the card could
 * not perform.
 *
 * The meta line here is the creator byline, not macros: the in-app grid shows
 * title → byline → macro row, and `TRENDING_RECIPES` carries no nutrition
 * data. Inventing kcal/protein for marketing would be a fabricated nutrition
 * claim, so the byline is where this card's meta line stops.
 *
 * The flag-off branch keeps the legacy card verbatim as the kill switch.
 */
export function TrendingRail() {
  const railRef = useRef<HTMLDivElement>(null);
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");

  const scroll = (dir: -1 | 1) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 310, behavior: "smooth" });
  };

  return (
    <section className="lp-section lp-trending">
      <div className="lp-wrap">
        <div className="lp-trending-head">
          <h2 className="lp-h-section">
            Trending <em>this week</em>
          </h2>
          <div className="lp-trending-nav">
            <button type="button" className="lp-icon-btn" aria-label="Scroll left" onClick={() => scroll(-1)}>
              <ChevronLeft width={18} height={18} aria-hidden />
            </button>
            <button type="button" className="lp-icon-btn" aria-label="Scroll right" onClick={() => scroll(1)}>
              <ChevronRight width={18} height={18} aria-hidden />
            </button>
          </div>
        </div>
        <div className="lp-trending-rail" ref={railRef} tabIndex={0} role="region" aria-label="Trending recipes">
          {TRENDING_RECIPES.map((recipe) =>
            unifiedChrome ? (
              <Link
                className="lp-recipe-card lp-recipe-card--stacked"
                key={recipe.title}
                href={recipe.href}
                aria-label={`${recipe.title} by ${recipe.author}`}
              >
                <div className="lp-recipe-img">
                  <Image src={recipe.image} alt="" width={258} height={258} />
                </div>
                <h3>{recipe.title}</h3>
                <p className="lp-recipe-author">
                  By <span>{recipe.author}</span>
                </p>
              </Link>
            ) : (
              <Link
                className="lp-recipe-card"
                key={recipe.title}
                href={recipe.href}
                aria-label={`${recipe.title} by ${recipe.author}`}
              >
                <div className="lp-recipe-card-top">
                  <h3>{recipe.title}</h3>
                  <Bookmark width={17} height={17} aria-hidden className="lp-recipe-bookmark" />
                </div>
                <div className="lp-recipe-img">
                  <Image src={recipe.image} alt="" width={258} height={258} />
                </div>
                <p className="lp-recipe-author">
                  By <span>{recipe.author}</span>
                </p>
              </Link>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

export default TrendingRail;
