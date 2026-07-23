"use client";

import { isFeatureEnabled } from "../../../lib/analytics/track";

export function CreatorProfileLegacyStats({
  followerCount,
  recipeCount,
}: {
  followerCount: number;
  recipeCount: number;
}) {
  if (isFeatureEnabled("creator_profile_v3")) return null;
  const followerLabel = followerCount === 1 ? "follower" : "followers";

  return (
    <div className="flex items-baseline justify-center gap-1 mt-4 text-[13px] text-muted-foreground">
      <span>
        <span className="font-bold text-foreground">{followerCount}</span> {followerLabel}
      </span>
      <span> · </span>
      <span>
        <span className="font-bold text-foreground">{recipeCount}</span> recipe
        {recipeCount === 1 ? "" : "s"}
      </span>
    </div>
  );
}

export default CreatorProfileLegacyStats;
