import React from "react";
import { usePathname, useRouter } from "expo-router";

import { ScreenSectionChrome } from "@/components/suppr/screen-section-chrome";
import { SubTabPill } from "@/components/ui/SubTabPill";

export type RecipesTab = "library" | "discover";

const SECTION_TITLE: Record<RecipesTab, string> = {
  library: "Library",
  discover: "Discover",
};

/**
 * Sticky Recipes header — brand, RECIPES overline, section title, then
 * Library / Discover tabs. Titles stay pinned; list content scrolls below.
 */
export function RecipesTabChrome() {
  const router = useRouter();
  const pathname = usePathname();

  const activeId: RecipesTab = pathname?.startsWith("/discover") ? "discover" : "library";

  return (
    <ScreenSectionChrome
      testID="recipes-tab-chrome"
      overline="Recipes"
      title={SECTION_TITLE[activeId]}
    >
      <SubTabPill<RecipesTab>
        embedded
        items={[
          { id: "library", label: "Library" },
          { id: "discover", label: "Discover" },
        ]}
        activeId={activeId}
        onSelect={(id) => router.replace(`/(tabs)/${id}` as never)}
        accessibilityLabel="Recipes sections"
      />
    </ScreenSectionChrome>
  );
}

/** @deprecated Use `RecipesTabChrome` — kept for tests that import this path. */
export function RecipesSubTabHeader() {
  return <RecipesTabChrome />;
}

export default RecipesTabChrome;
