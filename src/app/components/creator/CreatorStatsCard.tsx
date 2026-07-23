"use client";

import { isFeatureEnabled } from "../../../lib/analytics/track";

export function CreatorStatsCard({
  recipeCount,
  followerCount,
  followingCount = 0,
}: {
  recipeCount: number;
  followerCount: number;
  followingCount?: number;
}) {
  if (!isFeatureEnabled("creator_profile_v3")) return null;

  const cells = [
    { value: recipeCount, label: "Recipes" },
    { value: followerCount, label: "Followers" },
    { value: followingCount, label: "Following" },
  ];

  return (
    <div
      data-testid="creator-stats-card"
      className="mt-4 flex overflow-hidden rounded-xl border border-border bg-card"
    >
      {cells.map((cell, idx) => (
        <div
          key={cell.label}
          className={[
            "flex flex-1 flex-col items-center justify-center py-4",
            idx > 0 ? "border-l border-border" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className="text-lg font-semibold text-foreground">{cell.value}</span>
          <span className="mt-1 text-xs text-muted-foreground">{cell.label}</span>
        </div>
      ))}
    </div>
  );
}

export default CreatorStatsCard;
