"use client";

import * as React from "react";
import type { CreatorChip } from "../../../lib/discover/topCreators";
import {
  creatorInitialOf,
  creatorTintFor,
} from "../../../lib/discover/creatorChipPresentation";

/**
 * DiscoverCreatorRail — the "explore from" creator rail on Discover (ENG-1225
 * #14), per the v3 prototype `.creator-rail` (Sloe-App.html L999-1007): a
 * horizontal scroll of circular creator chips (serif initial on a plum-family
 * tint, or the avatar photo) with the name below.
 *
 * Data source: "top creators by saves" (`loadTopCreators`). The rail renders
 * ONLY when creators exist — the `creators` table is empty pre-launch, so it
 * stays hidden rather than showing fabricated chips. It lights up automatically
 * once creators are added. Mirror target: `apps/mobile/app/(tabs)/discover.tsx`.
 */
export type { CreatorChip } from "../../../lib/discover/topCreators";

export interface DiscoverCreatorRailProps {
  creators: CreatorChip[];
  onSelect?: (creator: CreatorChip) => void;
  className?: string;
}

export function DiscoverCreatorRail({
  creators,
  onSelect,
  className,
}: DiscoverCreatorRailProps) {
  if (creators.length === 0) return null;

  return (
    <div
      data-testid="discover-creator-rail"
      className={["flex gap-3.5 overflow-x-auto pb-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className]
        .filter(Boolean)
        .join(" ")}
      aria-label="Creators to explore"
    >
      {creators.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect?.(c)}
          data-testid={`creator-chip-${c.handle}`}
          className="group flex w-[74px] shrink-0 flex-col items-center gap-2 text-center"
        >
          <span
            className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full shadow-sm transition-transform group-hover:-translate-y-0.5"
            style={{
              width: 66,
              height: 66,
              ...(c.avatarUrl ? {} : { background: creatorTintFor(c.id) }),
            }}
          >
            {c.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="font-[family-name:var(--font-display)] text-[24px] font-normal text-white">
                {creatorInitialOf(c.displayName)}
              </span>
            )}
          </span>
          <span className="line-clamp-2 text-[13px] font-medium leading-tight text-foreground">
            {c.displayName}
          </span>
        </button>
      ))}
    </div>
  );
}

export default DiscoverCreatorRail;
