"use client";

import { Icons } from "../ui/icons";
import { ScreenChrome } from "./screen-chrome";
import { SegmentedTrack } from "../ui/segmented-track";
import { SubTabPill } from "../ui/sub-tab-pill";
import { isFeatureEnabled } from "@/lib/analytics/track";

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
 * tabs. Thin wrapper over the shared `ScreenChrome` since S6 (2026-07-10,
 * ENG-1375). Hidden at `md+` where the sidebar owns navigation. Mobile
 * parity: `apps/mobile/components/tabs/RecipesTabChrome.tsx`.
 */
export function RecipesTabChrome({
  activeId,
  onSelect,
  className,
}: RecipesTabChromeProps) {
  return (
    <ScreenChrome
      overline="Cook"
      title="Your kitchen"
      className={className}
      testID="recipes-tab-chrome"
      trailing={
        <>
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
        </>
      }
    >
      {/* ENG-1532 component-grammar dedup — sub-tab switchers are the §8
          SegmentedTrack pill. Flag-off renders the legacy SubTabPill
          underline tabs byte-intact (kill switch). */}
      {isFeatureEnabled("component_grammar_dedup") ? (
        <div className="px-6 pb-3">
          <SegmentedTrack<RecipesTab>
            options={[
              { value: "library", label: "Cookbook" },
              { value: "discover", label: "Discover" },
            ]}
            value={activeId}
            onChange={onSelect}
            ariaLabel="Recipes sections"
          />
        </div>
      ) : (
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
      )}
    </ScreenChrome>
  );
}
