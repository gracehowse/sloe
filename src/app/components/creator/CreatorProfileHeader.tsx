"use client";

import { CircleCheck } from "lucide-react";
import { isFeatureEnabled } from "../../../lib/analytics/track";

export type CreatorProfileHeaderModel = {
  display_name: string;
  handle: string;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
};

export function CreatorProfileHeader({ creator }: { creator: CreatorProfileHeaderModel }) {
  const v3 = isFeatureEnabled("creator_profile_v3");

  if (!v3) {
    return (
      <div className="flex flex-col items-center text-center pb-2">
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
            <CircleCheck className="size-5 text-primary" aria-label="Verified creator" />
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">@{creator.handle}</p>
        {creator.bio ? (
          <p className="text-sm text-foreground mt-3 max-w-md leading-relaxed">{creator.bio}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 py-4" data-testid="creator-profile-header-v3">
      {creator.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={creator.avatar_url}
          alt={`${creator.display_name} avatar`}
          className="size-16 shrink-0 rounded-full object-cover bg-muted"
        />
      ) : (
        <div className="size-16 shrink-0 rounded-full flex items-center justify-center text-xl font-bold text-primary-foreground bg-primary">
          {creator.display_name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h1 className="text-lg font-semibold text-foreground">{creator.display_name}</h1>
          {creator.is_verified ? (
            <CircleCheck className="size-[18px] text-primary" aria-label="Verified creator" />
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">@{creator.handle}</p>
        {creator.bio ? (
          <p className="text-sm text-foreground mt-3 leading-relaxed">{creator.bio}</p>
        ) : null}
      </div>
    </div>
  );
}

export default CreatorProfileHeader;
