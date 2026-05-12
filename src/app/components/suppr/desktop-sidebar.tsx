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
 *
 * 2026-05-02 — Collapse affordance (user feedback,
 * `claude/household-section-streak-sidebar-bundle`). The sidebar can
 * shrink to a 64px icon rail and re-expand to its 248px default. State
 * persists to `localStorage` under `suppr.sidebar.collapsed` so the
 * choice survives reloads. Cmd/Ctrl+B toggles globally — same shortcut
 * VS Code, Linear, Notion all use, so it's a learned reflex. Width
 * change animates over 200ms ease-in-out. Sub-tabs hide while
 * collapsed (the icon rail is single-column). The toggle lives in the
 * sidebar header so it's reachable by mouse + readable to screen
 * readers (button + aria-expanded). Mobile-web ignores all of this —
 * the sidebar is `hidden md:flex`, collapse only matters on desktop.
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
    label: "More",
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

/**
 * localStorage key for the collapsed-state preference. Centralised so
 * the test file can clear it between cases without copy-pasting the
 * literal — when this key changes, both prod + tests update together.
 */
export const SIDEBAR_COLLAPSED_STORAGE_KEY = "suppr.sidebar.collapsed";

/** Read the persisted collapse preference safely. SSR-safe — when
 *  `window` is missing we default to expanded so the server render
 *  matches the most common state and hydration doesn't pop. */
function readCollapsedPref(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    // localStorage unavailable (private mode, sandbox iframe). Don't
    // crash — just default to expanded.
    return false;
  }
}

function writeCollapsedPref(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      value ? "true" : "false",
    );
  } catch {
    // Best-effort persistence. The in-memory state is still correct
    // for the current session.
  }
}

/** Width tokens — single source per state. */
const WIDTH_EXPANDED_PX = 248;
const WIDTH_COLLAPSED_PX = 64;

export function DesktopSidebar(props: DesktopSidebarProps) {
  const { currentView, onNavigate } = props;
  const activePrimary = resolvePrimaryFromView(currentView);

  // Collapsed state — initialised lazily from localStorage so SSR is
  // safe (read returns false on the server, then hydrates to the real
  // value once `window` exists). See `readCollapsedPref` for SSR
  // posture; the choice to default expanded matches most users + the
  // first-paint frame for collapsed-pref users carries a 200ms slide
  // we accept as the cost of avoiding hydration mismatches.
  const [collapsed, setCollapsed] = React.useState<boolean>(() =>
    readCollapsedPref(),
  );

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsedPref(next);
      return next;
    });
  }, []);

  // Cmd/Ctrl+B keyboard shortcut. Matches the same toggle Linear,
  // Notion, and VS Code use — the muscle memory carries over.
  // `metaKey` covers macOS Cmd; `ctrlKey` covers everything else. We
  // explicitly skip when the user is typing into an input/textarea/
  // contenteditable so search inputs that bind ⌘B for "Bold" still
  // win. preventDefault stops the browser's default Cmd+B (which
  // toggles the bookmarks bar in Chrome on some platforms) from
  // firing alongside.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: KeyboardEvent) => {
      const isToggleCombo =
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey &&
        (event.key === "b" || event.key === "B");
      if (!isToggleCombo) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName?.toLowerCase();
        if (
          tag === "input" ||
          tag === "textarea" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      event.preventDefault();
      toggleCollapsed();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleCollapsed]);

  return (
    <aside
      data-testid="desktop-sidebar"
      data-collapsed={collapsed ? "true" : "false"}
      style={{
        // Inline width so the 200ms transition reads off a single
        // animatable property; tailwind's arbitrary value would work
        // but inline keeps the token + transition in one place.
        width: collapsed ? WIDTH_COLLAPSED_PX : WIDTH_EXPANDED_PX,
        transition: "width 200ms ease-in-out",
      }}
      className="hidden md:flex md:flex-col md:shrink-0 md:h-screen md:sticky md:top-0 md:border-r md:border-border md:bg-background md:overflow-hidden"
      aria-label="Primary"
    >
      {/* Brand + collapse toggle */}
      <div
        className={`flex items-center border-b border-border ${collapsed ? "justify-center px-2 py-4" : "justify-between gap-2.5 px-5 py-4"}`}
      >
        {!collapsed ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              aria-hidden
              className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground text-sm font-extrabold tracking-tight shrink-0"
            >
              S
            </span>
            <span className="text-[15px] font-bold tracking-tight truncate">
              Suppr
            </span>
          </div>
        ) : null}
        <button
          type="button"
          data-testid="desktop-sidebar-collapse-toggle"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls="desktop-sidebar-nav"
          aria-label={
            collapsed ? "Expand navigation" : "Collapse navigation"
          }
          title={
            collapsed
              ? "Expand navigation (Cmd+B)"
              : "Collapse navigation (Cmd+B)"
          }
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors shrink-0"
        >
          {collapsed ? (
            <Icons.panelOpen className="h-4 w-4" aria-hidden />
          ) : (
            <Icons.panelClose className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>

      <nav
        id="desktop-sidebar-nav"
        className={`flex-1 overflow-y-auto ${collapsed ? "py-3" : "py-3"}`}
        aria-label="Sidebar navigation"
      >
        <ul className={collapsed ? "px-2 space-y-1" : "px-3 space-y-1"}>
          {PRIMARY_ITEMS.map((item) => {
            const isActive = activePrimary === item.view;
            return (
              <li key={item.view}>
                <PrimarySidebarItem
                  item={item}
                  isActive={isActive}
                  onNavigate={onNavigate}
                  collapsed={collapsed}
                />
                {/* Sub-tabs hide while collapsed — the icon rail is a
                    single column, leaves are reached by clicking the
                    primary (which routes to the default leaf) and then
                    expanding. */}
                {isActive &&
                !collapsed &&
                SUB_TABS[item.view].length > 0 ? (
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
  collapsed,
}: {
  item: PrimaryItem;
  isActive: boolean;
  onNavigate: (v: SidebarView) => void;
  collapsed: boolean;
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
      // When collapsed, expose the label as accessible-name + tooltip
      // so screen-reader users still hear "Today" / "Recipes" / etc.
      // when the visible label is hidden.
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={`group relative flex w-full items-center rounded-lg text-sm font-medium transition-colors ${
        collapsed
          ? "justify-center h-10 px-0"
          : "gap-2.5 px-3 py-2"
      } ${
        isActive
          ? "bg-accent-muted text-primary"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${isActive ? "" : "text-muted-foreground group-hover:text-foreground"}`}
        aria-hidden
      />
      {!collapsed ? (
        <span className="flex-1 text-left">{item.label}</span>
      ) : null}
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
