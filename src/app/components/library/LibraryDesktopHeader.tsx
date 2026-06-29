"use client";

import { Icons } from "../ui/icons";

/** Navigate the SPA to a create/import view via the `view` query param (the
 *  same hook the mobile-web chrome uses). */
function navToView(view: "create" | "import") {
  const url = new URL(window.location.href);
  url.searchParams.set("view", view);
  window.history.pushState({}, "", url.toString());
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export interface LibraryDesktopHeaderProps {
  recipeCount: number;
  sortLabel: string;
}

/**
 * Desktop ( `md+` ) Library header — v3 prototype "Cook" tab (ENG-1247,
 * 2026-06-24): a "Cook" overline + serif "Your kitchen" title + pencil(Create)
 * / link(Import) actions. Supersedes the plain bold "Library" title. The
 * mobile-web twin is `suppr/recipes-tab-chrome.tsx`; the native twin is
 * `apps/mobile/components/tabs/RecipesTabChrome.tsx`.
 */
export function LibraryDesktopHeader({ recipeCount, sortLabel }: LibraryDesktopHeaderProps) {
  return (
    <div className="hidden md:flex items-start justify-between gap-4 mb-6">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground-tertiary">
          Cook
        </div>
        <h1
          className="mt-0.5 font-[family-name:var(--font-headline)] text-[24px] font-medium text-foreground -tracking-[0.02em]"
          data-testid="library-desktop-title"
        >
          Your kitchen
        </h1>
        <p
          className="text-[13px] text-muted-foreground mt-0.5 tabular-nums"
          data-testid="library-desktop-subtitle"
        >
          {`${recipeCount} recipe${recipeCount === 1 ? "" : "s"} · sorted by ${sortLabel.toLowerCase()}`}
        </p>
      </div>
      {/* ENG-1197 — desktop create entry; ENG-1247 added the import twin. */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => navToView("create")}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Create a new recipe"
        >
          <Icons.edit className="w-4 h-4" aria-hidden />
          Create
        </button>
        <button
          type="button"
          onClick={() => navToView("import")}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Import a recipe"
        >
          <Icons.link className="w-4 h-4" aria-hidden />
          Import
        </button>
      </div>
    </div>
  );
}
