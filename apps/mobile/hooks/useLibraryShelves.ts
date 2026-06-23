import { useMemo } from "react";

import { deriveLibraryShelves } from "@suppr/shared/recipes/libraryShelves";
import type { RecipeCard } from "@/lib/types";

/**
 * useLibraryShelves — the Sloe v3 Cookbook editorial shelves (ENG-1225 Block 5)
 * for the mobile Library. A thin memoized wrapper over the shared
 * `deriveLibraryShelves` (so web + mobile can't drift on thresholds/caps/copy);
 * pass the already-filtered library list and render the returned non-empty,
 * capped shelves. Only the "All" filter shows shelves (the host gates that).
 */
export function useLibraryShelves(filtered: RecipeCard[]) {
  return useMemo(() => deriveLibraryShelves(filtered), [filtered]);
}

export default useLibraryShelves;
