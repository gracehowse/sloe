"use client";

import { isFeatureEnabled } from "../../../lib/analytics/track";
import { CreatorFollowButton } from "./CreatorFollowButton";

export function CreatorProfileFollowRow({
  creatorId,
  initialFollowerCount,
}: {
  creatorId: string;
  initialFollowerCount: number;
}) {
  const v3 = isFeatureEnabled("creator_profile_v3");
  return (
    <CreatorFollowButton
      creatorId={creatorId}
      initialFollowerCount={initialFollowerCount}
      className={v3 ? "mt-4 w-full" : "mt-4"}
    />
  );
}

export default CreatorProfileFollowRow;
