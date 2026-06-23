import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { loadTopCreators } from "@suppr/shared/discover/topCreators";
import type { CreatorChip } from "@suppr/shared/discover/topCreators";

/**
 * useTopCreators — loads the Discover "top creators by saves" rail data
 * (ENG-1225 #14) via the shared `loadTopCreators` loader. Returns `[]` until
 * loaded (and on any error), so the rail stays hidden — the `creators` table is
 * empty pre-launch, no fabricated chips. Web parity:
 * `src/app/components/suppr/use-top-creators.tsx`.
 */
export function useTopCreators(): CreatorChip[] {
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
  return creators;
}
