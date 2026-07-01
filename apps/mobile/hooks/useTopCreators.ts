import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { loadTopCreators } from "@suppr/shared/discover/topCreators";
import type { CreatorChip } from "@suppr/shared/discover/topCreators";

/**
 * useTopCreators — loads the Discover "top creators by saves" rail data
 * (ENG-1225 #14 / ENG-1239 real-data path).
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
