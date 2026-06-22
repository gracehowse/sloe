"use client";

import * as React from "react";
import { supabase } from "../../../lib/supabase/browserClient";
import { loadTopCreators } from "../../../lib/discover/topCreators";
import {
  DiscoverCreatorRail,
  type CreatorChip,
} from "./discover-creator-rail";

/**
 * useTopCreators — loads the "top creators by saves" rail data and returns the
 * rendered rail (ENG-1225 #14), so the pinned DiscoverFeed host only renders
 * `{rail}`. The rail hides itself when empty (the creators table is empty
 * pre-launch — no fabricated chips), so this is a no-op surface today.
 */
export function useTopCreators(
  onSelect?: (creator: CreatorChip) => void,
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
  return <DiscoverCreatorRail creators={creators} onSelect={onSelect} />;
}
