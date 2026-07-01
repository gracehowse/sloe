"use client";

import { memo } from "react";

export interface ProfileHubHeaderProps {
  avatarInitial: string;
  displayName?: string | null;
  tierLabel: string;
  isPro: boolean;
  joinedLabel: string;
  recipeCount: number;
  streakDays: number;
}

/**
 * ProfileHubHeader — the legacy "More"-titled hub framing (Account overline +
 * "More" title + identity card + Recipes/Streak stat tiles). Extracted out of
 * the pinned `Profile.tsx` (ENG-1246) so the screen shell shrinks; rendered
 * only in the `sloe_v3_profile`-OFF kill-switch path. The flag-ON path renders
 * `EditorialProfileBlock` instead. Presentation unchanged from the inline
 * original — this is a lift-and-shift, not a redesign.
 */
function ProfileHubHeaderImpl({
  avatarInitial,
  displayName,
  tierLabel,
  isPro,
  joinedLabel,
  recipeCount,
  streakDays,
}: ProfileHubHeaderProps) {
  return (
    <>
      {/* Phone-top header — ACCOUNT overline + large "More" title + round
          avatar-initial button on the right. */}
      <div className="mb-3.5 flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Account
          </p>
          <h1 className="mt-0.5 text-[28px] font-bold leading-tight -tracking-[0.02em] text-foreground">
            More
          </h1>
        </div>
        <button
          type="button"
          aria-label="Your profile"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground"
        >
          {avatarInitial}
        </button>
      </div>

      {/* Profile card — 52×52 avatar + display-name + tier·joined subline +
          tier pill. */}
      <div className="mb-4 flex items-center gap-3.5 rounded-xl bg-card p-3.5 card-slab">
        <div className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
          {avatarInitial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-[family-name:var(--font-headline)] text-lg font-medium leading-tight text-foreground">
            {displayName?.trim() ? displayName : "Your profile"}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {tierLabel} tier &middot; {joinedLabel}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${
            isPro ? "bg-primary/15 text-primary-solid" : "bg-muted text-muted-foreground"
          }`}
        >
          {tierLabel}
        </span>
      </div>

      {/* Recipes + Streak stat tiles. */}
      <div className="mb-4 flex gap-2">
        <div className="flex-1 rounded-xl border border-border bg-card p-3 text-center card-slab">
          <p className="text-lg font-bold tabular-nums text-primary-solid">{recipeCount}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Recipes</p>
        </div>
        <div className="flex-1 rounded-xl border border-border bg-card p-3 text-center card-slab">
          <p className="text-lg font-bold tabular-nums text-success">{streakDays}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Streak</p>
        </div>
      </div>
    </>
  );
}

export const ProfileHubHeader = memo(ProfileHubHeaderImpl);

export default ProfileHubHeader;
