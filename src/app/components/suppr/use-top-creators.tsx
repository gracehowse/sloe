"use client";

import * as React from "react";
import { supabase } from "../../../lib/supabase/browserClient";
import { loadTopCreators } from "../../../lib/discover/topCreators";
import { resolveCreatorRail } from "../../../lib/discover/seedCreators";
import {
  DiscoverCreatorRail,
  type CreatorChip,
} from "./discover-creator-rail";

/**
 * useTopCreators — loads the "top creators by saves" rail data and returns the
 * rendered rail (ENG-1225 #14), so the pinned DiscoverFeed host only renders
 * `{rail}`.
 *
 * Two paths, both via `resolveCreatorRail`:
 *  - REAL creators (`loadTopCreators` returns rows) ALWAYS win — they render and
 *    the seed is irrelevant.
 *  - When there are NO real creators (the `creators` table is empty pre-launch)
 *    AND `discover_creator_rail_v1` is ON (passed as `seedFallbackOn`), a
 *    presentation-only SEED rail renders so the surface is SEE-able before the
 *    real creator plane lands. Flag OFF with no real creators → the rail hides,
 *    exactly as before this feature.
 */
export function useTopCreators(
  onSelect?: (creator: CreatorChip) => void,
  seedFallbackOn = false,
): React.ReactNode {
  const [creators, setCreators] = React.useState<CreatorChip[]>([]);
  React.useEffect(() => {
    let alive = true;
    void loadTopCreators(supabase).then((cs) => {
      if (alive) setCreators(cs);
    });
    return () => {
      alive = false;
    };
  }, []);
  const resolved = React.useMemo(
    () => [...resolveCreatorRail(creators, seedFallbackOn)],
    [creators, seedFallbackOn],
  );
  return <DiscoverCreatorRail creators={resolved} onSelect={onSelect} />;
}
