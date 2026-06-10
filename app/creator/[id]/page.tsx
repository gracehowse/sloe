/**
 * B5 Phase 2a (2026-04-27) — Creator profile page (web).
 *
 * Spec: docs/specs/2026-04-27-b5-discover-phase2.md
 * Mobile parallel: apps/mobile/app/creator/[id].tsx
 *
 * Server component — fetches creator + recipes + follower count via the
 * anon-key supabase client (the data is public). Follow toggle lives
 * in the client wrapper below; it reads the authed session via the
 * browser supabase client and writes to the `follows` table on tap.
 *
 * No migration required. Uses existing `creators` + `recipes.creator_id`
 * + `follows` columns.
 *
 * Phase 2a deliberately ships the same surface as mobile:
 *   - Header (avatar, display name, handle, bio, verified tick).
 *   - Follower count + Follow / Following toggle (optimistic).
 *   - Recipe list (newest-first, paginated — see below).
 *   - Honest empty state when the creator has no published recipes.
 *
 * ENG-748 #14 (2026-05-27) — pagination. The list used to hard-cap at
 * 50 (`.limit(50)`), so creators with >50 published recipes had older
 * ones silently invisible. We now fetch the first page server-side
 * (`CREATOR_RECIPES_PAGE_SIZE`, good for SEO + fast paint) and hand off
 * to the `CreatorRecipeList` client component, which appends further
 * pages via the same public query on "Load more". The header shows the
 * TRUE total recipe count (a separate `head: true` count) — not the
 * number currently loaded — so the count never under-reports.
 */

import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { projectId, publicAnonKey } from "../../../utils/supabase/info.tsx";
import { CreatorFollowButton } from "../../../src/app/components/creator/CreatorFollowButton";
import {
  CreatorRecipeList,
  CREATOR_RECIPES_PAGE_SIZE,
  type CreatorRecipeRow,
} from "../../../src/app/components/creator/CreatorRecipeList";

const supabaseUrl = `https://${projectId}.supabase.co`;

function getServerClient() {
  return createClient(supabaseUrl, publicAnonKey);
}

interface CreatorRow {
  id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
}

async function fetchCreatorBundle(id: string) {
  const sb = getServerClient();
  const [creatorRes, recipesRes, recipeCountRes, followCountRes] = await Promise.all([
    sb
      .from("creators")
      .select("id, display_name, handle, avatar_url, bio, is_verified")
      .eq("id", id)
      .maybeSingle<CreatorRow>(),
    // ENG-748 #14: first page only — the client component loads the rest
    // on "Load more". `range(0, PAGE_SIZE - 1)` instead of `limit(50)`.
    sb
      .from("recipes")
      .select(
        "id, title, image_url, calories, protein, carbs, cook_time_min, prep_time_min",
      )
      .eq("creator_id", id)
      .eq("published", true)
      .order("created_at", { ascending: false })
      .range(0, CREATOR_RECIPES_PAGE_SIZE - 1)
      .returns<CreatorRecipeRow[]>(),
    // True total published-recipe count for the header stat — decoupled
    // from how many are currently loaded so the count never under-reports.
    sb
      .from("recipes")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", id)
      .eq("published", true),
    sb.from("follows").select("user_id", { count: "exact", head: true }).eq("creator_id", id),
  ]);

  if (!creatorRes.data) return null;
  const recipes = (recipesRes.data ?? []) as CreatorRecipeRow[];
  return {
    creator: creatorRes.data,
    recipes,
    recipeCount: recipeCountRes.count ?? recipes.length,
    // The first page came back full → there may be more to load.
    hasMore: recipes.length === CREATOR_RECIPES_PAGE_SIZE,
    followerCount: followCountRes.count ?? 0,
  };
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchCreatorBundle(id);
  if (!data) return { title: "Creator not found — Suppr" };
  const { creator } = data;
  const desc = creator.bio
    ? creator.bio.slice(0, 200)
    : `${creator.display_name} on Sloe — recipes by @${creator.handle}.`;
  return {
    title: `${creator.display_name} (@${creator.handle}) — Suppr`,
    description: desc,
    openGraph: {
      title: creator.display_name,
      description: desc,
      images: creator.avatar_url ? [{ url: creator.avatar_url }] : undefined,
      type: "profile",
    },
  };
}

export default async function CreatorPage({ params }: Props) {
  const { id } = await params;
  const data = await fetchCreatorBundle(id);
  if (!data) notFound();

  const { creator, recipes, recipeCount, hasMore, followerCount } = data;
  const followerLabel = followerCount === 1 ? "follower" : "followers";

  return (
    <div className="max-w-2xl mx-auto px-pm-5 py-pm-5">
      {/* Header — avatar / name / handle / bio / stats / follow CTA. */}
      <div className="flex flex-col items-center text-center pb-6">
        {creator.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creator.avatar_url}
            alt={`${creator.display_name} avatar`}
            className="w-24 h-24 rounded-full object-cover mb-3 bg-muted"
          />
        ) : (
          <div className="w-24 h-24 rounded-full mb-3 flex items-center justify-center text-3xl font-bold text-white bg-primary">
            {creator.display_name.slice(0, 1).toUpperCase()}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <h1 className="text-[22px] font-bold text-foreground -tracking-[0.01em]">
            {creator.display_name}
          </h1>
          {creator.is_verified ? (
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px]"
              aria-label="Verified creator"
              title="Verified creator"
            >
              ✓
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">@{creator.handle}</p>

        {creator.bio ? (
          <p className="text-sm text-foreground mt-3 max-w-md leading-relaxed">{creator.bio}</p>
        ) : null}

        <div className="flex items-baseline gap-1 mt-4 text-[13px] text-muted-foreground">
          <span>
            <span className="font-bold text-foreground">{followerCount}</span> {followerLabel}
          </span>
          <span> · </span>
          <span>
            <span className="font-bold text-foreground">{recipeCount}</span> recipe{recipeCount === 1 ? "" : "s"}
          </span>
        </div>

        <CreatorFollowButton
          creatorId={creator.id}
          initialFollowerCount={followerCount}
          className="mt-4"
        />
      </div>

      {/* Recipe list. */}
      <div className="mt-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2 px-1">
          Recipes
        </p>
        {recipes.length === 0 ? (
          <div className="rounded-card border border-border bg-card p-8 text-center">
            <p className="text-base font-bold text-foreground">No recipes yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              When {creator.display_name} publishes a recipe it'll appear here.
            </p>
          </div>
        ) : (
          <CreatorRecipeList
            creatorId={creator.id}
            initialRecipes={recipes}
            initialHasMore={hasMore}
          />
        )}
      </div>
    </div>
  );
}
