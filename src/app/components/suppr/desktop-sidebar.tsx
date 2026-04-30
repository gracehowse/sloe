"use client";

import * as React from "react";
import { Icons } from "../ui/icons";

/**
 * DesktopSidebar — left-hand navigation for the web app on desktop +
 * tablet widths (>= 768px / `md:`). Below that breakpoint we keep the
 * native bottom-tab layout that mirrors the mobile app — the same
 * user flow the mobile app ships with, so a phone-web visitor feels
 * at home.
 *
 * Phase 2 / B1.1 (2026-04-27 strategic spec, D-2026-04-27-02): the
 * sidebar collapses to four primary destinations to mirror the new
 * mobile tab bar:
 *
 *   Today / Recipes / Plan / You
 *
 * Sub-tabs render below the active item when applicable. Recipes
 * groups Library (default) + Discover. You groups Progress (default)
 * + Settings (Group G IA Batch C, 2026-04-29: Profile sub-tab removed
 * — Profile is now a "Edit profile" header-card row inside Settings;
 * the /profile route remains alive as the full editor target).
 *
 * Routes that disappeared from primary nav: Discover (now sub-tab of
 * Recipes), Library (default of Recipes), Progress (default of You),
 * More (subsumed into You), Settings (subsumed into You), Shopping
 * (sub-view of Plan), Profile (collapsed into Settings header card).
 *
 * `currentView` keeps a wider `SidebarView` union so callers can route
 * to any leaf (e.g. `setCurrentView("library")`); the sidebar maps
 * each leaf to its parent group for highlight purposes.
 */

// The view union here is kept in sync with the one in `App.tsx`.
// Duplicated deliberately to keep the sidebar a leaf component with
// no cyclical import. If a new view ships, both files must update.
export type SidebarView =
  | "today"
  | "discover"
  | "plan"
  | "progress"
  | "profile"
  | "library"
  | "shopping"
  | "settings"
  | "notifications"
  | "create"
  | "import"
  | "household-settings"
  | "targets";

export interface DesktopSidebarProps {
  currentView: SidebarView;
  onNavigate: (view: SidebarView) => void;
  /** Unchecked count on the shopping list, shown as a badge. Zero
   *  hides the badge. */
  shoppingUncheckedCount?: number;
  /** Saved-recipe count on the Library row, shown as a badge.
   *  Zero hides the badge (a fresh user shouldn't see "0"). */
  libraryRecipeCount?: number;
}

type PrimaryView = "today" | "recipes" | "plan" | "you";

interface PrimaryItem {
  view: PrimaryView;
  label: string;
  icon: keyof typeof Icons;
  /** Default leaf SidebarView the primary entry should route to when
   *  pressed (the user lands on a known anchor). */
  defaultLeaf: SidebarView;
  /** Leaf SidebarView ids that should highlight this primary entry. */
  leaves: SidebarView[];
}

interface SubTabItem {
  view: SidebarView;
  label: string;
  badge?: (props: DesktopSidebarProps) => number;
}

const PRIMARY_ITEMS: PrimaryItem[] = [
  {
    view: "today",
    label: "Today",
    icon: "home",
    defaultLeaf: "today",
    leaves: ["today"],
  },
  {
    view: "recipes",
    label: "Recipes",
    icon: "recipe",
    defaultLeaf: "library",
    leaves: ["library", "discover"],
  },
  {
    view: "plan",
    label: "Plan",
    icon: "plan",
    defaultLeaf: "plan",
    leaves: ["plan", "shopping"],
  },
  {
    view: "you",
    label: "You",
    icon: "profile",
    defaultLeaf: "progress",
    leaves: ["progress", "profile", "settings", "household-settings", "targets"],
  },
];

/** Sub-tab rows shown below the active primary entry. */
const SUB_TABS: Record<PrimaryView, SubTabItem[]> = {
  today: [],
  recipes: [
    { view: "library", label: "Library", badge: (p) => p.libraryRecipeCount ?? 0 },
    { view: "discover", label: "Discover" },
  ],
  plan: [
    { view: "plan", label: "This week" },
    { view: "shopping", label: "Shopping", badge: (p) => p.shoppingUncheckedCount ?? 0 },
  ],
  you: [
    { view: "progress", label: "Progress" },
    { view: "settings", label: "Settings" },
  ],
};

/** Map any leaf SidebarView to the primary group that should highlight. */
export function resolvePrimaryFromView(view: SidebarView): PrimaryView {
  for (const item of PRIMARY_ITEMS) {
    if (item.leaves.includes(view)) return item.view;
  }
  return "today";
}

export function DesktopSidebar(props: DesktopSidebarProps) {
  const { currentView, onNavigate } = props;
  const activePrimary = resolvePrimaryFromView(currentView);

  return (
    <aside
      className="hidden md:flex md:flex-col md:w-[248px] md:shrink-0 md:h-screen md:sticky md:top-0 md:border-r md:border-border md:bg-background"
      aria-label="Primary"
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
        <span
          aria-hidden
          className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground text-sm font-extrabold tracking-tight"
        >
          S
        </span>
        <span className="text-[15px] font-bold tracking-tight">Suppr</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-3" aria-label="Sidebar navigation">
        <ul className="px-3 space-y-1">
          {PRIMARY_ITEMS.map((item) => {
            const isActive = activePrimary === item.view;
            return (
              <li key={item.view}>
                <PrimarySidebarItem
                  item={item}
                  isActive={isActive}
                  onNavigate={onNavigate}
                />
                {isActive && SUB_TABS[item.view].length > 0 ? (
                  <ul className="mt-1 mb-2 ml-7 space-y-0.5 border-l border-border/60 pl-3">
                    {SUB_TABS[item.view].map((sub) => (
                      <li key={sub.view}>
                        <SubTabSidebarItem
                          sub={sub}
                          currentView={currentView}
                          onNavigate={onNavigate}
                          sidebarProps={props}
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

function PrimarySidebarItem({
  item,
  isActive,
  onNavigate,
}: {
  item: PrimaryItem;
  isActive: boolean;
  onNavigate: (v: SidebarView) => void;
}) {
  const Icon = Icons[item.icon];
  return (
    <button
      type="button"
      onClick={() => {
        // Tapping a primary entry routes to its default leaf so the
        // user always lands on a known anchor. If the user is already
        // somewhere within the group (e.g. on /discover and they tap
        // Recipes), we still re-route to the default leaf so the
        // primary press is predictable.
        onNavigate(item.defaultLeaf);
      }}
      aria-current={isActive ? "page" : undefined}
      className={`group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "bg-accent-muted text-primary"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${isActive ? "" : "text-muted-foreground group-hover:text-foreground"}`}
        aria-hidden
      />
      <span className="flex-1 text-left">{item.label}</span>
    </button>
  );
}

function SubTabSidebarItem({
  sub,
  currentView,
  onNavigate,
  sidebarProps,
}: {
  sub: SubTabItem;
  currentView: SidebarView;
  onNavigate: (v: SidebarView) => void;
  sidebarProps: DesktopSidebarProps;
}) {
  const isActive = currentView === sub.view;
  const badgeCount = sub.badge?.(sidebarProps) ?? 0;
  return (
    <button
      type="button"
      onClick={() => onNavigate(sub.view)}
      aria-current={isActive ? "page" : undefined}
      className={`group relative flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
        isActive
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <span className="flex-1 text-left">{sub.label}</span>
      {badgeCount > 0 ? (
        <span className="min-w-[1.25rem] rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary text-center leading-5">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      ) : null}
    </button>
  );
}
