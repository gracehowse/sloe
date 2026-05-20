"use client";

import { SubTabPill } from "../ui/sub-tab-pill";
import { TodayBrandBar } from "./today-brand-bar";
import { cn } from "../ui/utils";

export type RecipesTab = "library" | "discover";

const SECTION_TITLE: Record<RecipesTab, string> = {
  library: "Library",
  discover: "Discover",
};

export interface RecipesTabChromeProps {
  activeId: RecipesTab;
  onSelect: (id: RecipesTab) => void;
  className?: string;
}

/**
 * Sticky Recipes header for mobile-web — brand, RECIPES overline,
 * section title, then Library / Discover tabs. Hidden at `md+` where
 * the sidebar owns navigation.
 */
export function RecipesTabChrome({
  activeId,
  onSelect,
  className,
}: RecipesTabChromeProps) {
  return (
    <header
      className={cn(
        "md:hidden sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md",
        className,
      )}
      data-testid="recipes-tab-chrome"
    >
      <div className="px-6 pt-2 pb-1 space-y-1">
        <TodayBrandBar />
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Recipes
        </p>
        <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">
          {SECTION_TITLE[activeId]}
        </h1>
      </div>
      <SubTabPill
        embedded
        items={[
          { id: "library", label: "Library" },
          { id: "discover", label: "Discover" },
        ]}
        activeId={activeId}
        onSelect={onSelect}
        accessibilityLabel="Recipes sections"
        className="pt-0 pb-3"
      />
    </header>
  );
}
