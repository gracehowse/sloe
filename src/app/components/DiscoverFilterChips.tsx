"use client";

import { ShieldCheck } from "lucide-react";
import { DISCOVER_CATEGORY_PILLS, type RecipeCategoryId } from "../../lib/recipes/recipeCategoryFilters.ts";
import { isFeatureEnabled } from "../../lib/analytics/track.ts";

export type DiscoverCategory = RecipeCategoryId | "trending" | "from-reels";
export type DiscoverFeedScope = "forYou" | "following";
export type DiscoverFilters = { verified: boolean; maxCalories: string; minProtein: string };

/**
 * Category filter pills — ENG-921 / Figma `528:2`. "Following" leads as a
 * secondary feed-scope toggle (wired follow-graph feature), then the shared
 * category set, then the ENG-1417 "Verified only" toggle. Extracted from
 * `DiscoverFeed.tsx` (screen-budget pin). Mobile parity:
 * `apps/mobile/app/(tabs)/discover.tsx`.
 *
 * Chip grammar (web parity 2026-06-10, ENG-1022): selected = `bg-primary-soft`
 * fill + `primary-solid` label + `font-semibold`, NO selected ring/border;
 * unselected = quiet `bg-card` + muted label, NO border.
 */
export function DiscoverFilterChips({
  feedScope,
  setFeedScope,
  category,
  setCategory,
  filters,
  setFilters,
}: {
  feedScope: DiscoverFeedScope;
  setFeedScope: (scope: DiscoverFeedScope) => void;
  category: DiscoverCategory;
  setCategory: (category: DiscoverCategory) => void;
  filters: DiscoverFilters;
  setFilters: (updater: (prev: DiscoverFilters) => DiscoverFilters) => void;
}) {
  const chipClassName = (isActive: boolean) =>
    `shrink-0 px-4 py-2 rounded-full text-[13px] whitespace-nowrap transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
      isActive
        ? "bg-primary-soft text-primary-solid font-semibold"
        : "bg-card text-muted-foreground font-medium hover:text-foreground hover:bg-muted"
    }`;

  return (
    <div className="mt-4 pl-4 pr-2 md:pl-0 md:pr-0">
      <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <button
          key="following"
          type="button"
          data-testid="discover-category-following"
          onClick={() => {
            setFeedScope("following");
            setCategory("all");
          }}
          className={chipClassName(feedScope === "following")}
          aria-pressed={feedScope === "following"}
        >
          Following
        </button>
        {DISCOVER_CATEGORY_PILLS.map((f) => {
          const isActive = feedScope === "forYou" && category === f.id;
          return (
            <button
              key={f.id}
              type="button"
              data-testid={`discover-category-${f.id}`}
              onClick={() => {
                setFeedScope("forYou");
                setCategory(f.id);
              }}
              className={chipClassName(isActive)}
              aria-pressed={isActive}
              aria-label={`Category: ${f.label}`}
            >
              {f.label}
            </button>
          );
        })}
        {/* ENG-1417 — "Verified only" filter, wiring the previously-dead
            `filters.verified` state (tl-F6): the field existed and was
            checked by the render-gate + empty-state predicates, but no
            control ever set it. ShieldCheck glyph so it reads as a toggle
            rather than another category. Flag-gated: net-new structural
            control, not yet sim-validated. */}
        {isFeatureEnabled("discover_verified_filter_v1") ? (
          <button
            type="button"
            data-testid="discover-filter-verified"
            onClick={() => setFilters((prev) => ({ ...prev, verified: !prev.verified }))}
            className={`inline-flex items-center gap-1.5 ${chipClassName(filters.verified)}`}
            aria-pressed={filters.verified}
            aria-label="Filter: Verified only"
          >
            <ShieldCheck width={14} height={14} aria-hidden />
            Verified only
          </button>
        ) : null}
      </div>
    </div>
  );
}
