"use client";

import { Icons } from "../ui/icons";
import { isFeatureEnabled } from "@/lib/analytics/track";

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
  const consistencyChrome = isFeatureEnabled("primary_screen_chrome_v1");
  // Design-consistency pass (2026-07-24) — the "Cook" overline rendered
  // 11/700/0.1em in `--foreground-tertiary`, its own variant of a label the
  // app now renders one way: 11/600/0.12em FULL INK plus a hairline rule to
  // the margin (the treatment `ScreenChrome` / `ScreenSectionChrome` ship, and
  // the one the mobile-web twin `suppr/recipes-tab-chrome.tsx` gets from
  // `ScreenChrome`). Without this, the same Cookbook screen showed one eyebrow
  // on phone and a different one on desktop.
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");
  return (
    <div className="hidden md:flex items-start justify-between gap-4 mb-6">
      <div className="min-w-0 flex-1">
        {unifiedChrome ? (
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">
              Cook
            </span>
            <span className="flex-1 h-px bg-border" />
          </div>
        ) : (
          <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground-tertiary">
            Cook
          </div>
        )}
        <h1
          className={[
            unifiedChrome ? "mt-1" : "mt-0.5",
            consistencyChrome
              ? "page-title text-foreground-brand"
              : "font-[family-name:var(--font-headline)] text-[24px] font-medium text-foreground -tracking-[0.02em]",
          ].join(" ")}
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
          className={consistencyChrome
            ? "inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground transition-[background-color,transform] hover:bg-[var(--background-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95"
            : "inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/60 transition-colors"}
          aria-label="Create a new recipe"
        >
          <Icons.edit className={consistencyChrome ? "h-5 w-5" : "h-4 w-4"} aria-hidden />
          {consistencyChrome ? null : "Create"}
        </button>
        <button
          type="button"
          onClick={() => navToView("import")}
          className={consistencyChrome
            ? "inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground transition-[background-color,transform] hover:bg-[var(--background-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95"
            : "inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/60 transition-colors"}
          aria-label="Import a recipe"
        >
          <Icons.link className={consistencyChrome ? "h-5 w-5" : "h-4 w-4"} aria-hidden />
          {consistencyChrome ? null : "Import"}
        </button>
      </div>
    </div>
  );
}
