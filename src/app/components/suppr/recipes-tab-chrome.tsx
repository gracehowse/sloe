"use client";

import { Icons } from "../ui/icons";
import { SubTabPill } from "../ui/sub-tab-pill";
import { cn } from "../ui/utils";

export type RecipesTab = "library" | "discover";

export interface RecipesTabChromeProps {
  activeId: RecipesTab;
  onSelect: (id: RecipesTab) => void;
  className?: string;
}

/** Navigate the SPA to a create/import view via the `view` query param (the
 *  same hook `Library.tsx` uses for its desktop create entry). */
function navToView(view: "create" | "import") {
  const url = new URL(window.location.href);
  url.searchParams.set("view", view);
  window.history.pushState({}, "", url.toString());
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/**
 * Sticky Recipes header for mobile-web — v3 prototype "Cook" tab (ENG-1247,
 * 2026-06-24): an overline "Cook" + serif "Your kitchen" title with pencil
 * (Create) + link (Import) icon actions, then the Cookbook / Discover underline
 * tabs. Sits above the sub-tabs (constant for both scopes), matching the
 * prototype `.t-head` over `.seg-tabs`. Supersedes the generic "Recipes"
 * no-overline treatment (Figma retired). Hidden at `md+` where the sidebar owns
 * navigation. Mobile parity: `apps/mobile/components/tabs/RecipesTabChrome.tsx`.
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
      <div className="px-6 pt-3 pb-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground-tertiary">
            Cook
          </div>
          <h1 className="mt-0.5 font-[family-name:var(--font-headline)] text-[24px] font-medium leading-[1.1] tracking-tight text-foreground-brand">
            Your kitchen
          </h1>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => navToView("create")}
            aria-label="Create recipe"
            className="p-1.5 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-muted transition-colors"
          >
            <Icons.edit className="w-[18px] h-[18px]" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => navToView("import")}
            aria-label="Import recipe"
            className="p-1.5 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-muted transition-colors"
          >
            <Icons.link className="w-[18px] h-[18px]" aria-hidden />
          </button>
        </div>
      </div>
      <SubTabPill
        embedded
        items={[
          { id: "library", label: "Cookbook" },
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
