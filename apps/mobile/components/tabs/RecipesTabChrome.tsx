import React from "react";
import { usePathname, useRouter } from "expo-router";

import { ScreenSectionChrome } from "@/components/suppr/screen-section-chrome";
import { SubTabPill } from "@/components/ui/SubTabPill";

export type RecipesTab = "library" | "discover";

/**
 * Sticky Recipes header — Figma `527:2`/`528:2`: a constant serif
 * "Recipes" title (NOT the section name), then Library / Discover
 * underline tabs. The active SECTION is communicated by the underline
 * tab, so the overline + section-name-as-title (which read as
 * redundant shouting) are dropped. Titles stay pinned; list content
 * scrolls below. Web parity: `src/app/components/suppr/recipes-tab-chrome.tsx`.
 */
export function RecipesTabChrome() {
  const router = useRouter();
  const pathname = usePathname();

  const activeId: RecipesTab = pathname?.startsWith("/discover") ? "discover" : "library";

  return (
    <ScreenSectionChrome
      testID="recipes-tab-chrome"
      overline={null}
      title="Recipes"
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
