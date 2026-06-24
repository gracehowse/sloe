import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { loadTopCreators } from "@suppr/shared/discover/topCreators";
import type { CreatorChip } from "@suppr/shared/discover/topCreators";
import { resolveCreatorRail } from "@suppr/shared/discover/seedCreators";

/**
 * useTopCreators — loads the Discover "top creators by saves" rail data
 * (ENG-1225 #14) via the shared `loadTopCreators` loader.
 *
 * REAL creators always win. When there are NO real creators (the `creators`
 * table is empty pre-launch) AND `seedFallbackOn` is true
 * (`discover_creator_rail_v1`), a presentation-only SEED set renders so the
 * surface is SEE-able before the real creator plane lands. Flag OFF with no real
 * creators → `[]` (rail hides), exactly as before. Web parity:
 * `src/app/components/suppr/use-top-creators.tsx`.
 */
export function useTopCreators(seedFallbackOn = false): CreatorChip[] {
  const [creators, setCreators] = useState<CreatorChip[]>([]);
  useEffect(() => {
    let alive = true;
    void loadTopCreators(supabase).then((cs) => {
      if (alive) setCreators(cs);
    });
    return () => {
      alive = false;
    };
  }, []);
  return useMemo(
    () => [...resolveCreatorRail(creators, seedFallbackOn)],
    [creators, seedFallbackOn],
  );
}
