"use client";

import { SubTabPill } from "../ui/sub-tab-pill";
import { cn } from "../ui/utils";

export type RecipesTab = "library" | "discover";

export interface RecipesTabChromeProps {
  activeId: RecipesTab;
  onSelect: (id: RecipesTab) => void;
  className?: string;
}

/**
 * Sticky Recipes header for mobile-web — Figma `527:2`/`528:2`: a
 * constant serif "Recipes" title (NOT the section name), then Library /
 * Discover underline tabs. The active SECTION is shown by the underline
 * tab, so the overline + section-name-as-title are dropped. Hidden at
 * `md+` where the sidebar owns navigation. Mobile parity:
 * `apps/mobile/components/tabs/RecipesTabChrome.tsx`.
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
      <div className="px-6 pt-3 pb-1">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-medium tracking-tight text-foreground-brand">
          Recipes
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
