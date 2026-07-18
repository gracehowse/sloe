"use client";

/**
 * FoodSearchResultRow — one redesigned (ENG-815) search-result row,
 * extracted from `FoodSearchPanel.tsx` (which is pinned by the screen-line
 * ratchet and may only shrink).
 *
 * ENG-1532 (component grammar dedup) — renders ONE of two row grammars,
 * gated by `component_grammar_dedup`:
 *
 *   flag ON  → a PLAIN ROW with the exact skeleton of the "Past logged" /
 *              "Favourites" history rows (title line with the inline
 *              confidence chip, unified kcal-leads-basis-trails sub-line via
 *              the shared `formatFoodSearchRowSubline`, hairline separators
 *              from the parent's `divide-y`, right-side chevron). The big
 *              right-aligned KCAL display numeral dies — it invited
 *              misreading per-100g values as per-serving (Fable ruling
 *              2026-07-16).
 *   flag OFF → today's grouped-card row, byte-intact (the PostHog kill
 *              switch). Keep in sync with the mobile sibling
 *              `apps/mobile/components/food-search/FoodSearchFeedItem.tsx`.
 */
import { Loader2, Plus } from "lucide-react";
import { Icons } from "../ui/icons";
import { Badge } from "../suppr/badge";
import { SearchResultConfidenceChip } from "../ui/search-result-confidence-chip";
import { isFeatureEnabled } from "../../../lib/analytics/track";
import {
  resolveFoodSearchHeadline,
  FOOD_SEARCH_PER_100G_BADGE,
} from "../../../lib/nutrition/foodSearchHeadline";
import { formatFoodSearchRowSubline } from "../../../lib/nutrition/foodSearchRowSubline";
import { foodSearchSourceLabel } from "../../../lib/nutrition/foodSearchMerge";
import type { SearchRowConfidenceTier } from "../../../lib/nutrition/foodSearchRanking";
import {
  isLearnedCustomFoodSource,
  LEARNED_CUSTOM_FOOD_REUSE_CUE,
  type CustomFood,
} from "../../../lib/nutrition/customFoods";
import type { SearchResult } from "./FoodSearchPanel";

export type FoodSearchResultRowProps = {
  item: SearchResult;
  /** The key of the row currently resolving a tap (spinner), or null. */
  loadingKey: string | null;
  /** The custom-food id whose ⋯ menu is open, or null. */
  menuOpenFor: string | null;
  onPick: (item: SearchResult) => void;
  onQuickLog: (item: SearchResult) => void;
  onToggleMenu: (customFoodId: string) => void;
  onEditCustom: (food: CustomFood) => void;
  onDeleteCustom: (food: CustomFood) => void;
};

/** The legible Verified/Estimated tier chip (ENG-807/ENG-815) — identical
 *  markup on both grammar paths so the trust signal stays inline. Delegates
 *  to the shared `SearchResultConfidenceChip` primitive (ENG-1429), which
 *  also backs the barcode result card and the web voice-log review row —
 *  one chip definition, not three formerly-inline copies. */
function tierChip(tier: SearchRowConfidenceTier) {
  return (
    <SearchResultConfidenceChip
      tier={tier}
      testId={`food-search-confidence-${tier}`}
    />
  );
}

export function FoodSearchResultRow({
  item,
  loadingKey,
  menuOpenFor,
  onPick,
  onQuickLog,
  onToggleMenu,
  onEditCustom,
  onDeleteCustom,
}: FoodSearchResultRowProps) {
  // ENG-1532 — component grammar dedup. ON → the unified plain-row grammar;
  // OFF → the ENG-815 grouped-card render below, byte-intact (kill switch).
  const grammarDedup = isFeatureEnabled("component_grammar_dedup");
  const isCustom = item._source === "CUSTOM";
  const customFood = isCustom ? item._custom : null;
  const headline = resolveFoodSearchHeadline(item);
  // Custom rows keep their own "Custom" badge (not a confidence chip). For
  // every other row, render the honest tier the data layer stamped. We never
  // invent a chip the model didn't back — fall back to "estimated" only when
  // the tier is genuinely absent (defensive; `mergeAndDedup` always stamps).
  const tier: SearchRowConfidenceTier = item.confidenceTier ?? "estimated";
  const sourceLabel = foodSearchSourceLabel(item._source);

  // Shared trailing affordances: quick-log "+" (save/log affordance stays
  // wherever it applies) and the custom-food ⋯ menu.
  const trailingActions = (
    <>
      {!isCustom && loadingKey !== item.key ? (
        <button
          type="button"
          onClick={() => onQuickLog(item)}
          aria-label={`Quick log ${item.name} at default serving`}
          data-testid={`food-search-quick-log-${item.key}`}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-primary hover:bg-muted/60"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        </button>
      ) : null}
      {isCustom && customFood && (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu(customFood.id);
            }}
            aria-label={`More options for ${customFood.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpenFor === customFood.id}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <span aria-hidden="true" className="text-lg leading-none">⋯</span>
          </button>
          {menuOpenFor === customFood.id && (
            <div
              role="menu"
              className="absolute right-0 top-9 z-10 min-w-[9rem] rounded-md border border-border bg-card shadow-lg py-1"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => onEditCustom(customFood)}
                className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-muted/60"
              >
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => onDeleteCustom(customFood)}
                className="w-full text-left px-3 py-1.5 text-sm text-destructive hover:bg-muted/60"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );

  if (grammarDedup) {
    // ── Flag ON — unified plain row (the Past-logged skeleton) ──────────
    const subline = formatFoodSearchRowSubline(headline, sourceLabel);
    return (
      <div
        data-testid={`search-row-${item.key}`}
        className="flex items-center gap-1 relative"
      >
        <button
          type="button"
          onClick={() => onPick(item)}
          disabled={loadingKey === item.key}
          className="flex min-w-0 flex-1 items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-semibold text-foreground truncate">
                {item.name}
              </span>
              {isCustom ? <Badge variant="custom">Custom</Badge> : tierChip(tier)}
            </div>
            <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
              {subline ?? "Tap for nutrition info"}
            </span>
            {customFood && isLearnedCustomFoodSource(customFood.source) ? (
              <span
                className="block mt-0.5 text-[11px] italic text-muted-foreground/90"
                data-testid="learned-custom-food-cue"
              >
                {LEARNED_CUSTOM_FOOD_REUSE_CUE}
              </span>
            ) : null}
          </div>
          {loadingKey === item.key ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          ) : (
            <Icons.forward className="h-4 w-4 shrink-0 text-muted-foreground/60" />
          )}
        </button>
        {trailingActions}
      </div>
    );
  }

  // ── Flag OFF — the ENG-815 grouped-card row, byte-intact ──────────────
  return (
    <div className="flex items-center gap-2 px-4 py-3.5 transition-colors hover:bg-muted/50 [&+&]:shadow-[inset_0_1px_0_var(--border)] relative">
      <button
        type="button"
        onClick={() => onPick(item)}
        disabled={loadingKey === item.key}
        className="flex-1 min-w-0 flex items-center gap-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-semibold text-foreground truncate">{item.name}</span>
            {isCustom ? (
              <Badge variant="custom">Custom</Badge>
            ) : (
              tierChip(tier)
            )}
          </div>
          {headline.mode === "per-serving" ? (
            <>
              <div className="flex gap-2 mt-1 text-[11px] font-semibold text-muted-foreground">
                <span className="text-destructive">P {headline.macros.protein}g</span>
                <span className="text-[var(--macro-carbs)]">C {headline.macros.carbs}g</span>
                <span className="text-warning-solid">F {headline.macros.fat}g</span>
              </div>
              <span className="block mt-0.5 text-[11px] text-muted-foreground/80">
                {headline.servingLabel}
                {headline.per100gReference ? ` · ${headline.per100gReference}` : ""} · {sourceLabel}
              </span>
            </>
          ) : headline.mode === "per-100g" && headline.macros ? (
            <>
              <div className="flex gap-2 mt-1 text-[11px] font-semibold text-muted-foreground">
                <span className="text-destructive">P {headline.macros.protein}g</span>
                <span className="text-[var(--macro-carbs)]">C {headline.macros.carbs}g</span>
                <span className="text-warning-solid">F {headline.macros.fat}g</span>
              </div>
              <span className="block mt-0.5 text-[11px] text-muted-foreground/80">
                {FOOD_SEARCH_PER_100G_BADGE} · {sourceLabel}
              </span>
            </>
          ) : headline.mode === "per-100g" ? (
            <span className="block mt-1 text-[11px] text-muted-foreground/80">
              {FOOD_SEARCH_PER_100G_BADGE} · {sourceLabel}
            </span>
          ) : (
            <span className="block mt-1 text-xs text-muted-foreground">Tap for nutrition info</span>
          )}
          {customFood && isLearnedCustomFoodSource(customFood.source) ? (
            <span
              className="block mt-0.5 text-[11px] italic text-muted-foreground/90"
              data-testid="learned-custom-food-cue"
            >
              {LEARNED_CUSTOM_FOOD_REUSE_CUE}
            </span>
          ) : null}
        </div>
        {headline.mode !== "placeholder" && loadingKey !== item.key ? (
          <div className="flex flex-col items-end shrink-0">
            <span className="text-[18px] font-extrabold text-foreground tabular-nums leading-none">{headline.headlineKcal}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mt-0.5">kcal</span>
          </div>
        ) : null}
        {loadingKey === item.key ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
        ) : isCustom ? (
          <Icons.forward className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : null}
      </button>
      {trailingActions}
    </div>
  );
}

export default FoodSearchResultRow;
