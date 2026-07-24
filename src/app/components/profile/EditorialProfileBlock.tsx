"use client";

import { memo } from "react";
import { Check, ChevronRight, Circle, Flame, Shield, Snowflake } from "lucide-react";
import { AvatarDisc } from "../ui/avatar-disc";
import { RecipeHeroFallback } from "../suppr/RecipeHeroFallback";
import { SupprButton } from "../suppr/suppr-button";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { recipeUnderlayColor } from "../../../lib/recipe/recipeHeroFallback";
import { useFallbackScheme } from "../../../lib/theme/useFallbackScheme";
import { weekdayInitials } from "../../../lib/today/weekdayLabels.ts";
import {
  type EditorialProfileBlockModel,
  type StreakDotState,
} from "../../../lib/profile/editorialProfileBlock";
import {
  PROFILE_UPGRADE_BANNER_TDEE_GLOSS,
  PROFILE_UPGRADE_BANNER_TDEE_PLAIN,
} from "../../../lib/onboarding/figmaCopy.ts";

/** Minimal recipe shape the grid needs — a subset of RecipeCard so the
 *  component doesn't drag the full type into the profile surface. */
export interface EditorialProfileRecipe {
  id: string;
  title: string;
  image: string | null;
}

export interface EditorialProfileBlockProps {
  displayName: string;
  joinedLabel: string | null;
  monogramInitial: string;
  tierLabel: string;
  isPro: boolean;
  /** Derived streak/dots/milestones model (from buildEditorialProfileBlock). */
  model: EditorialProfileBlockModel;
  /** Saved recipes for the preview grid (already loaded — no fetch here). */
  recipes: EditorialProfileRecipe[];
  /** Total saved-recipe count (may exceed the previewed grid). */
  recipeCount: number;
  /** Open a recipe from the grid. */
  onOpenRecipe: (recipeId: string) => void;
  /** "See all" → the recipe library. */
  onSeeAllRecipes: () => void;
  /** Empty-state escape hatch → Discover. Without it the "Browse Discover to
   *  start your collection" copy is a dead end (design-consistency pass). */
  onBrowseDiscover?: () => void;
  /** ENG-1641 — single primary Upgrade CTA for non-Pro (footer). */
  onUpgrade?: () => void;
}

/** Max recipes rendered in the preview grid — one tidy 2×3 wall. */
const RECIPE_GRID_LIMIT = 6;

const DOT_CLASSES: Record<StreakDotState, string> = {
  // m9: logged dot uses the darker `success-solid` (matches mobile's
  // `accent.successSolid`) so it stays legible on the white card.
  logged: "bg-success-solid",
  frozen: "bg-muted-foreground/40",
  missed: "bg-muted",
};

/** Sunday-first initials are indexed 0=Sunday — exactly `Date.getDay()`'s
 *  ordering — so the pip labels and the Today day strip read one source. */
const WEEKDAY_INITIALS = weekdayInitials("sunday");

/** Weekday initial for a `YYYY-MM-DD` key (local date, no UTC shift). */
function weekdayInitialFor(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map((n) => parseInt(n, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return "";
  return WEEKDAY_INITIALS[new Date(y, (m ?? 1) - 1, d ?? 1).getDay()] ?? "";
}

/** "3- and 7-day reached" / "3-, 7- and 30-day reached" / "3-day reached".
 *  Mobile twin: `apps/mobile/components/profile/EditorialProfileBlock.tsx`. */
export function formatReachedSummary(days: readonly number[]): string | null {
  if (days.length === 0) return null;
  if (days.length === 1) return `${days[0]}-day reached`;
  const head = days.slice(0, -1).map((d) => `${d}-`);
  return `${head.join(", ")} and ${days[days.length - 1]}-day reached`;
}

const DOT_STATE_WORDS: Record<StreakDotState, string> = {
  logged: "logged", frozen: "freeze used", missed: "not logged",
};

/**
 * EditorialProfileBlock — the shared editorial Profile block (Gap #16,
 * ENG-1246). Replaces the old inline identity strip + bare streak-number /
 * recipe-count tiles with one editorial surface: identity → streak dots +
 * best/freezes line → milestones list → recipe grid.
 *
 * Display-only: every value is derived upstream from already-loaded data
 * (freeze ledger, saved recipes). No fetches, no writes. Web twin of the
 * mobile `EditorialProfileBlock` — same information architecture, web
 * primitives.
 */
function EditorialProfileBlockImpl({
  displayName,
  joinedLabel,
  monogramInitial,
  tierLabel,
  isPro,
  model,
  recipes,
  recipeCount,
  onOpenRecipe,
  onSeeAllRecipes,
  onBrowseDiscover,
  onUpgrade,
}: EditorialProfileBlockProps) {
  const gridRecipes = recipes.slice(0, RECIPE_GRID_LIMIT);
  const fallbackScheme = useFallbackScheme(); // ENG-1528 — dark ramp underlay on dark cards
  const freezeCount = model.freezesAvailable;
  // ENG-1593 — Rule 7 (DESIGN-CONSTITUTION.md): serif initial + frost-ring,
  // default-OFF (see src/lib/analytics/track.ts flag note).
  const avatarFrostRingV1 = isFeatureEnabled("avatar_monogram_frost_ring_v1");
  const glossOn = isFeatureEnabled("onboarding_jargon_gloss_v1");
  // Design-consistency pass (default-ON; every branch keeps its old path in
  // the `else` as the kill switch). Four fixes: tier stated once + accent Pro
  // badge, a labelled binary streak-pip row, actionable-first milestones, and
  // a real Discover CTA on the empty saved-recipes state.
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");

  // Tier is stated ONCE: the Pro badge owns it for Pro, the subline owns it
  // for everyone else (a "Free" badge would read as a penalty marker).
  const tierAndJoined = `${tierLabel}${joinedLabel ? ` · ${joinedLabel}` : ""}`;
  const identityMeta = unifiedChrome && isPro ? joinedLabel : tierAndJoined;

  // Milestones lead with the only actionable row. Reached landmarks collapse
  // into one quiet summary line instead of two greyed rows above the target.
  const reachedSummary = unifiedChrome
    ? formatReachedSummary(model.milestones.filter((m) => m.achieved).map((m) => m.days))
    : null;
  const pending = model.milestones.filter((m) => !m.achieved);
  const orderedMilestones = unifiedChrome
    ? [...pending.filter((m) => m.next), ...pending.filter((m) => !m.next)]
    : model.milestones;

  // The pip row answers exactly ONE question — "did I log that day?" — over a
  // named 7-day window, so it can never be mistaken for the streak count.
  const pipAriaLabel = `Last ${model.dots.length} days: ${model.dots
    .map((d) => `${weekdayInitialFor(d.dateKey)} ${DOT_STATE_WORDS[d.state]}`)
    .join(", ")}`;

  return (
    <div className="flex flex-col gap-4" data-testid="editorial-profile-block">
      {/* Identity — monogram + name + tier·joined + tier pill. m8: p-4/gap-4
          (16px) matches the sibling cards + mobile (was off-scale p-3.5). S5
          avatar ruling (2026-07-10, ENG-1375): the ad-hoc bg-primary monogram →
          the ONE solid-damson identity disc (`AvatarDisc`). */}
      <div className="flex items-center gap-4 rounded-xl bg-card p-4 card-slab">
        <AvatarDisc
          initial={monogramInitial}
          size={52}
          treatment={avatarFrostRingV1 ? "frostRing" : "legacy"}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-[family-name:var(--font-headline)] text-lg font-medium leading-tight text-foreground">
            {displayName.trim() ? displayName : "Your profile"}
          </p>
          {identityMeta ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{identityMeta}</p>
          ) : null}
        </div>
        {isPro ? (
          // Damson is THE achievement/Pro slot — a paid badge must not be the
          // card's quietest chip. Fill = `--avatar-identity`, the scheme-CONSTANT
          // damson the disc beside it uses (mobile twin: `Accent.purple`) — NOT
          // theme-resolved `--accent-win`, which lightens to #9A7BAA in dark,
          // fails AA under white (3.63:1), and reads as a second damson.
          <span
            className={
              unifiedChrome
                ? "shrink-0 rounded-full bg-[color:var(--avatar-identity)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white"
                : "shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-bold tracking-wide text-primary-solid"
            }
          >
            {tierLabel}
          </span>
        ) : null}
      </div>

      {/* Streak — dot row + best/freezes line. */}
      <div className="flex flex-col gap-3 rounded-xl bg-card p-4 card-slab">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Flame className="h-4 w-4 text-primary-solid" aria-hidden />
            {model.currentStreak}-day streak
          </p>
          {freezeCount > 0 ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
              <Shield className="h-3.5 w-3.5" aria-hidden />
              {freezeCount} freeze{freezeCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        {unifiedChrome ? (
          // Labelled binary pip row. The old row mixed three dot colours with a
          // grey halo on today (an idiom used nowhere else) under a "Best streak
          // 12 days" line seven pips can't express. Now: a NAMED window, weekday
          // letters, logged-vs-not dots, and the day strip's own idioms — ink
          // density marks today, freeze days keep the snowflake. Gaps mirror
          // mobile's card rhythm (12 throughout), not an ad-hoc 8.
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">
                Last 7 days
              </span>
              <span className="flex-1 h-px bg-border" />
            </div>
            <div className="flex items-start" role="img" aria-label={pipAriaLabel}>
              {model.dots.map((dot) => (
                <div key={dot.dateKey} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <span
                    className={`text-[11px] font-normal uppercase tracking-[0.1em] leading-none ${
                      dot.isToday ? "text-foreground" : "text-foreground-tertiary"
                    }`}
                  >
                    {weekdayInitialFor(dot.dateKey)}
                  </span>
                  <span className="flex h-3 items-center justify-center" aria-hidden>
                    {dot.state === "frozen" ? (
                      <Snowflake className="h-3 w-3 text-[color:var(--macro-water)]" />
                    ) : (
                      <span
                        className={`block h-2.5 w-2.5 rounded-full ${
                          dot.state === "logged" ? "bg-success-solid" : "bg-border"
                        }`}
                      />
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2" role="img" aria-label={pipAriaLabel}>
            {model.dots.map((dot) => (
              <span
                key={dot.dateKey}
                className={`h-2.5 w-2.5 rounded-full ${DOT_CLASSES[dot.state]} ${
                  dot.isToday ? "ring-2 ring-primary/40 ring-offset-1 ring-offset-card" : ""
                }`}
              />
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Best streak {model.bestStreak} day{model.bestStreak === 1 ? "" : "s"}
          {freezeCount > 0
            ? ` · ${freezeCount} freeze${freezeCount === 1 ? "" : "s"} in hand`
            : ""}
        </p>
      </div>

      {/* Milestones — the actionable "Next up" target leads; reached landmarks
          collapse into the one quiet summary line below the list. */}
      <div className="flex flex-col gap-2 rounded-xl bg-card p-4 card-slab">
        <p className="text-sm font-semibold text-foreground">Milestones</p>
        {unifiedChrome && orderedMilestones.length === 0 ? (
          <p className="text-[13px] font-semibold text-foreground">Every milestone reached</p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {orderedMilestones.map((m) => (
            <li key={m.days} className="flex items-center gap-3">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                  m.achieved
                    ? "bg-success/15 text-success"
                    : unifiedChrome && m.next
                      ? "bg-primary-soft text-primary-solid"
                      : "bg-muted text-muted-foreground"
                }`}
                aria-hidden
              >
                {m.achieved ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </span>
              <span
                className={`flex-1 text-[13px] ${
                  m.achieved || (unifiedChrome && m.next)
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {m.days}-day streak
              </span>
              {m.next ? (
                <span className="text-[11px] font-semibold text-primary-solid">Next up</span>
              ) : m.achieved ? (
                <span className="text-[11px] text-muted-foreground">Reached</span>
              ) : null}
            </li>
          ))}
        </ul>
        {reachedSummary ? (
          <p className="text-[11px] text-muted-foreground" data-testid="editorial-profile-reached">
            {reachedSummary}
          </p>
        ) : null}
      </div>

      {/* Recipe grid — saved recipes preview (already-loaded rows). */}
      <div className="flex flex-col gap-3 rounded-xl bg-card p-4 card-slab">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Saved recipes</p>
          {recipeCount > 0 ? (
            <button
              type="button"
              onClick={onSeeAllRecipes}
              aria-label={`See all ${recipeCount} saved recipes`}
              className="flex items-center gap-0.5 rounded-md text-[11px] font-semibold text-primary-solid transition-colors hover:text-primary-solid/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              See all {recipeCount}
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
        {gridRecipes.length === 0 ? (
          // The copy tells the user to browse Discover — so the card ships the
          // way there. Ghost, because the screen's one filled CTA is Upgrade.
          <div className="flex flex-col items-start gap-2">
            <p className="text-[13px] text-muted-foreground">
              Recipes you save land here. Browse Discover to start your collection.
            </p>
            {unifiedChrome && onBrowseDiscover ? (
              <SupprButton
                variant="ghost"
                size="sm"
                onClick={onBrowseDiscover}
                aria-label="Browse Discover to find recipes to save"
                data-testid="editorial-profile-browse-discover"
              >
                Browse Discover
              </SupprButton>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {gridRecipes.map((recipe) => (
              <button
                key={recipe.id}
                type="button"
                onClick={() => onOpenRecipe(recipe.id)}
                aria-label={`Open ${recipe.title}`}
                className="group relative aspect-square overflow-hidden rounded-lg transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
                // ENG-1374 PR 2 — opaque cuisine-tint underlay on the wrapper
                // (never page white, whatever the child does).
                style={{ backgroundColor: recipeUnderlayColor({ id: recipe.id, title: recipe.title }, fallbackScheme) }}
              >
                {recipe.image ? (
                  // ENG-1623 — decorative alt="" is deliberate: the enclosing
                  // <button aria-label={`Open ${recipe.title}`}> already
                  // carries the recipe name. See the decorative-vs-informative
                  // rule in suppr/discover-recipe-image.tsx.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={recipe.image}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                ) : (
                  <RecipeHeroFallback id={recipe.id} title={recipe.title} iconSize={24} />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ENG-1641 — one primary Upgrade CTA in the editorial footer for non-Pro. */}
      {!isPro && onUpgrade ? (
        <div className="flex flex-col gap-2">
          <SupprButton
            variant="primary"
            onClick={onUpgrade}
            aria-label="Upgrade to Pro"
            className="w-full"
            data-testid="editorial-profile-upgrade"
          >
            Upgrade to Pro
          </SupprButton>
          <p className="text-center text-xs text-muted-foreground">
            {glossOn ? PROFILE_UPGRADE_BANNER_TDEE_GLOSS : PROFILE_UPGRADE_BANNER_TDEE_PLAIN}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export const EditorialProfileBlock = memo(EditorialProfileBlockImpl);

export default EditorialProfileBlock;
