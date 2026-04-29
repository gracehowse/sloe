import React from "react";
import { useRouter, usePathname } from "expo-router";

import { SubTabPill } from "@/components/ui/SubTabPill";

/**
 * RecipesSubTabHeader — segmented sub-tab pill bar shown at the top of
 * the Library and Discover screens once the 6→4 tab collapse landed
 * (Phase 2 / B1.1, 2026-04-27 strategic spec).
 *
 * The "Recipes" primary tab is a logical group of two screens. Library
 * is the default sub-tab (per D-2026-04-27-02 — Library is what the
 * user actually came back for). Discover is the second sub-tab, kept
 * accessible without inflating to six primary tabs.
 *
 * Refactored 2026-04-28 (Next-10 #13 from the teardown doc) to use
 * the shared `<SubTabPill>` primitive at
 * `apps/mobile/components/ui/SubTabPill.tsx` — the inline pill render
 * was a near-clone of `PlanSubTabHeader` and `YouSubTabHeader`. This
 * file now owns only the pathname-to-id mapping and the routing
 * callback. Web mirror: `RecipesSubTabPill` in `src/app/App.tsx`.
 */
type RecipesTab = "library" | "discover";

export function RecipesSubTabHeader() {
  const router = useRouter();
  const pathname = usePathname();

  const activeId: RecipesTab = pathname?.startsWith("/discover") ? "discover" : "library";

  return (
    <SubTabPill<RecipesTab>
      items={[
        { id: "library", label: "Library" },
        { id: "discover", label: "Discover" },
      ]}
      activeId={activeId}
      onSelect={(id) => router.replace(`/(tabs)/${id}` as never)}
      accessibilityLabel="Recipes sections"
    />
  );
}

export default RecipesSubTabHeader;
