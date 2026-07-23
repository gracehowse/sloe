/**
 * B5 Phase 2a (2026-04-27) — Creator profile page (web).
 *
 * Spec: docs/specs/2026-04-27-b5-discover-phase2.md
 * Mobile parallel: apps/mobile/app/creator/[id].tsx
 */

import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabasePublicAnonKey, supabasePublicUrl } from "../../../utils/supabase/publicConfig.ts";
import { CreatorGoPublicPromo } from "../../../src/app/components/creator/CreatorGoPublicPromo";
import { CreatorProfileFollowRow } from "../../../src/app/components/creator/CreatorProfileFollowRow";
import { CreatorProfileHeader } from "../../../src/app/components/creator/CreatorProfileHeader";
import { CreatorProfileLegacyStats } from "../../../src/app/components/creator/CreatorProfileLegacyStats";
import { CreatorStatsCard } from "../../../src/app/components/creator/CreatorStatsCard";
import {
  CreatorRecipeList,
  CREATOR_RECIPES_PAGE_SIZE,
  type CreatorRecipeRow,
} from "../../../src/app/components/creator/CreatorRecipeList";

function getServerClient() {
  return createClient(supabasePublicUrl(), supabasePublicAnonKey());
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
    hasMore: recipes.length === CREATOR_RECIPES_PAGE_SIZE,
    followerCount: followCountRes.count ?? 0,
  };
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchCreatorBundle(id);
  if (!data) return { title: "Creator not found — Sloe" };
  const { creator } = data;
  const desc = creator.bio
    ? creator.bio.slice(0, 200)
    : `${creator.display_name} on Sloe — recipes by @${creator.handle}.`;
  return {
    title: `${creator.display_name} (@${creator.handle}) — Sloe`,
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

  return (
    <div className="max-w-2xl mx-auto px-pm-5 py-pm-5">
      <CreatorProfileHeader creator={creator} />

      <CreatorStatsCard
        recipeCount={recipeCount}
        followerCount={followerCount}
        followingCount={0}
      />

      <CreatorProfileLegacyStats followerCount={followerCount} recipeCount={recipeCount} />

      <CreatorProfileFollowRow creatorId={creator.id} initialFollowerCount={followerCount} />

      <CreatorGoPublicPromo />

      <div className="mt-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2 px-1">
          Recipes
        </p>
        {recipes.length === 0 ? (
          <div className="rounded-card border border-border bg-card p-8 text-center">
            <p className="text-base font-bold text-foreground">No recipes yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              When {creator.display_name} publishes a recipe it&apos;ll appear here.
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
