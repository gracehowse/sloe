"use client";

import * as React from "react";
import { Icons } from "../ui/icons";

/**
 * DesktopSidebar — left-hand navigation for the web app on desktop +
 * tablet widths (>= 768px / `md:`). Below that breakpoint we keep the
 * native bottom-tab layout that mirrors the mobile app — the same
 * user flow the mobile app ships with, so a phone-web visitor feels
 * at home. The direction is *desktop-first*: the default assumption
 * is a real browser window, and mobile-web is the narrow-width
 * exception (set 2026-04-18).
 *
 * The sidebar follows the landing web-shot mock (`Suppr Landing.html`
 * → `.lp-web-shot`) with `Track` and `Recipes` categories. Item order
 * inside `Track` matches the bottom-tab order so a user who flips
 * between widths never has to re-learn navigation. `Recipes` is a
 * desktop-only convenience grouping — Library, Discover, and Shopping
 * already exist as routes in `App.tsx`; the sidebar just gives
 * desktop users a permanent entry point that mobile-web surfaces via
 * the header Library button or the planner "Shop" sub-tab.
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
  | "import";

export interface DesktopSidebarProps {
  currentView: SidebarView;
  onNavigate: (view: SidebarView) => void;
  /** Unchecked count on the shopping list, shown as a badge. Zero
   *  hides the badge. */
  shoppingUncheckedCount?: number;
}

type Item = {
  view: SidebarView;
  label: string;
  icon: keyof typeof Icons;
  /** Optional badge accessor — return the numeric count (0 hides). */
  badge?: (props: DesktopSidebarProps) => number;
};

const TRACK_ITEMS: Item[] = [
  { view: "today", label: "Today", icon: "home" },
  { view: "plan", label: "Plan", icon: "plan" },
  { view: "progress", label: "Progress", icon: "progress" },
];

const RECIPE_ITEMS: Item[] = [
  { view: "library", label: "Library", icon: "recipe" },
  { view: "discover", label: "Discover", icon: "discover" },
  { view: "shopping", label: "Shopping", icon: "shopping", badge: (p) => p.shoppingUncheckedCount ?? 0 },
];

export function DesktopSidebar(props: DesktopSidebarProps) {
  const { currentView, onNavigate } = props;

  return (
    <aside
      className="hidden md:flex md:flex-col md:w-60 md:shrink-0 md:h-screen md:sticky md:top-0 md:border-r md:border-border md:bg-background"
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
        <SidebarGroup label="Track" items={TRACK_ITEMS} currentView={currentView} onNavigate={onNavigate} sidebarProps={props} />
        <SidebarGroup label="Recipes" items={RECIPE_ITEMS} currentView={currentView} onNavigate={onNavigate} sidebarProps={props} />
      </nav>

      {/* Profile + settings pinned to the bottom — matches the Today /
          Plan / Progress / Profile bottom-tab grouping where Profile is
          the right-most tab on mobile. */}
      <div className="border-t border-border py-3">
        <SidebarItem
          item={{ view: "profile", label: "Profile", icon: "profile" }}
          currentView={currentView}
          onNavigate={onNavigate}
          sidebarProps={props}
        />
        <SidebarItem
          item={{ view: "settings", label: "Settings", icon: "settings" }}
          currentView={currentView}
          onNavigate={onNavigate}
          sidebarProps={props}
        />
      </div>
    </aside>
  );
}

function SidebarGroup({
  label,
  items,
  currentView,
  onNavigate,
  sidebarProps,
}: {
  label: string;
  items: Item[];
  currentView: SidebarView;
  onNavigate: (v: SidebarView) => void;
  sidebarProps: DesktopSidebarProps;
}) {
  return (
    <div className="px-3 pb-2">
      <div className="px-2 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <ul>
        {items.map((item) => (
          <li key={item.view}>
            <SidebarItem
              item={item}
              currentView={currentView}
              onNavigate={onNavigate}
              sidebarProps={sidebarProps}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SidebarItem({
  item,
  currentView,
  onNavigate,
  sidebarProps,
}: {
  item: Item;
  currentView: SidebarView;
  onNavigate: (v: SidebarView) => void;
  sidebarProps: DesktopSidebarProps;
}) {
  const Icon = Icons[item.icon];
  const active = currentView === item.view;
  const badgeCount = item.badge?.(sidebarProps) ?? 0;
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.view)}
      aria-current={active ? "page" : undefined}
      className={`group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 mx-1 text-sm font-medium transition-colors ${
        active
          ? "bg-accent-muted text-primary"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${active ? "" : "text-muted-foreground group-hover:text-foreground"}`}
        aria-hidden
      />
      <span className="flex-1 text-left">{item.label}</span>
      {badgeCount > 0 ? (
        <span className="min-w-[1.25rem] rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary text-center leading-5">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      ) : null}
    </button>
  );
}
