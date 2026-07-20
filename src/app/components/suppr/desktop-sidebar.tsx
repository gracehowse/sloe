"use client";

import * as React from "react";
import Link from "next/link";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { Icons } from "../ui/icons";
import { AvatarDisc } from "../ui/avatar-disc";
import { SupprWordmark } from "../ui/suppr-mark";
import type { UserTier } from "../../../types/recipe";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { avatarInitials } from "../../../lib/avatarInitials";
import { formatSidebarBadge } from "../../../lib/navigation/sidebarBadge.ts";
import { SidebarUpgradeSlot } from "./sidebar-upgrade-slot";
import { NAV_TAB_ORDER_FLAG, canonicalNavOrderEnabled } from "../../../lib/navigation/primaryNav";

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
 * + Settings via the bottom-left profile entry (avatar + name), same
 *   intent as mobile’s Today-header avatar. Profile sub-tab removed
 *   (Group G IA Batch C, 2026-04-29) — edit profile lives in Settings.
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
  | "plan-import"
  | "cookbook-import"
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
  /** User tier -- drives the bottom-slot render (Free -> upgrade card,
   *  Pro/Base -> plan chip). Optional; defaults to "free" if unset. */
  userTier?: UserTier;
  /** Profile display name -- used as the secondary line in the Pro/Base
   *  plan chip and the bottom profile entry. Optional; falls back to
   *  "You" if unset. */
  displayName?: string | null;
  /** Auth email — fallback for avatar initial + label when display name
   *  is unset. Mirrors mobile Today header + Settings header card. */
  authEmail?: string | null;
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

/**
 * Primary nav items keyed by view. Icons are the ENG-1044 canonical set
 * (locked to the native iOS tab bar): Today=Calendar, Plan=BookOpen,
 * Recipes=Utensils, Progress=BarChart3 — applied regardless of order so
 * the glyph collision (BookOpen meant Plan on native, Recipes on web) is
 * gone. Declaration order here is the LEGACY order (Recipes before Plan);
 * the canonical Plan-first order is produced by `orderedPrimaryItems`
 * below, gated on the `nav-tab-order-plan-first` flag.
 */
const PRIMARY_ITEMS: PrimaryItem[] = [
  {
    view: "today",
    label: "Today",
    icon: "navToday",
    defaultLeaf: "today",
    leaves: ["today"],
  },
  {
    view: "recipes",
    label: "Recipes",
    icon: "navRecipes",
    defaultLeaf: "library",
    leaves: ["library", "discover", "create", "import", "cookbook-import"],
  },
  {
    // `plan-import` highlights the Plan primary group (ENG-696).
    view: "plan",
    label: "Plan",
    icon: "navPlan",
    defaultLeaf: "plan",
    leaves: ["plan", "shopping", "plan-import"],
  },
  {
    view: "you",
    label: "Progress",
    icon: "navProgress",
    defaultLeaf: "progress",
    leaves: ["progress", "household-settings", "targets"],
  },
];

/**
 * ENG-1044 — canonical primary-nav order. iOS is the primary surface and
 * its documented Plan-first order (Today · Plan · Recipes · Progress, with
 * a 2026-05-13 premium-bar + 2026-04-29 customer-lens rationale) is the
 * canonical one. When the flag is ON web matches native; OFF keeps the
 * legacy Recipes-first order while the change ramps via PostHog.
 */
const PLAN_FIRST_ORDER: PrimaryView[] = ["today", "plan", "recipes", "you"];

export function orderedPrimaryItems(planFirst: boolean): PrimaryItem[] {
  if (!planFirst) return PRIMARY_ITEMS;
  return PLAN_FIRST_ORDER.map(
    (view) => PRIMARY_ITEMS.find((it) => it.view === view)!,
  );
}

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
  you: [],
};

/** Map any leaf SidebarView to the primary group that should highlight. */
export function resolvePrimaryFromView(view: SidebarView): PrimaryView | null {
  // The persistent avatar owns Settings/profile; no primary group highlights.
  if (view === "settings" || view === "profile") return null;
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

  // ENG-1017 / ENG-1044 — canonical Plan-first tab order (matches native
  // iOS). Defaults ON while PostHog loads; set the flag to `false` to roll
  // back to legacy Recipes-first.
  const planFirst = canonicalNavOrderEnabled(
    useFeatureFlagEnabled(NAV_TAB_ORDER_FLAG),
  );
  const primaryItems = React.useMemo(
    () => orderedPrimaryItems(planFirst),
    [planFirst],
  );

  // ENG-1293 — always-present Coach entry under the Today group. Same
  // `coach_screen_v1` gate as the Coach screen itself.
  const coachEnabled = isFeatureEnabled("coach_screen_v1");

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

  // J/K (or arrow up/down) move focus between primary nav items --
  // same power-user pattern as Linear / Vim / Gmail. Only fires when
  // focus is already inside the sidebar so it doesn't hijack page scroll.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const key = event.key.toLowerCase();
      const isDown = key === "j" || event.key === "ArrowDown";
      const isUp = key === "k" || event.key === "ArrowUp";
      if (!isDown && !isUp) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || target.isContentEditable) return;
      }
      const nav = document.getElementById("desktop-sidebar-nav");
      if (!nav) return;
      if (!nav.contains(document.activeElement)) return;
      const buttons = Array.from(
        nav.querySelectorAll<HTMLButtonElement>(":scope > ul > li > button"),
      );
      if (buttons.length === 0) return;
      const currentIdx = buttons.findIndex((b) => b === document.activeElement);
      const nextIdx =
        currentIdx === -1
          ? 0
          : (currentIdx + (isDown ? 1 : -1) + buttons.length) % buttons.length;
      event.preventDefault();
      buttons[nextIdx]?.focus();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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
      className="hidden md:flex md:flex-col md:shrink-0 md:h-screen md:sticky md:top-0 md:border-r md:border-border/60 md:bg-background md:overflow-hidden"
      aria-label="Primary"
    >
      {/* Brand + collapse toggle */}
      <div
        className={`flex items-center border-b border-border ${collapsed ? "justify-center px-2 py-4" : "justify-between gap-2.5 px-5 py-4"}`}
      >
        {!collapsed ? (
          <div className="flex items-center min-w-0">
            <SupprWordmark size={28} />
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
          {primaryItems.map((item) => {
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
                    expanding. The Today group additionally carries the
                    flag-gated Coach entry (ENG-1293). */}
                {isActive &&
                !collapsed &&
                (SUB_TABS[item.view].length > 0 ||
                  (item.view === "today" && coachEnabled)) ? (
                  <ul className="mt-1 mb-2 ml-7 space-y-0.5 border-l border-border/60 pl-3">
                    {item.view === "today" && coachEnabled ? (
                      <li key="coach">
                        <CoachSidebarItem />
                      </li>
                    ) : null}
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

      {/* Bottom: optional upgrade promo, then profile → Settings (mobile
          parity — avatar on Today on phone; persistent entry here on
          desktop). Profile row stays visible when collapsed (icon only). */}
      <div className="mt-auto border-t border-border shrink-0">
        {!collapsed ? (
          <SidebarUpgradeSlot
            userTier={props.userTier ?? "free"}
            onNavigate={onNavigate}
          />
        ) : null}
        <SidebarProfileEntry
          currentView={currentView}
          collapsed={collapsed}
          displayName={props.displayName ?? null}
          authEmail={props.authEmail ?? null}
          onNavigate={onNavigate}
        />
      </div>
    </aside>
  );
}

function SidebarProfileEntry({
  currentView,
  collapsed,
  displayName,
  authEmail,
  onNavigate,
}: {
  currentView: SidebarView;
  collapsed: boolean;
  displayName: string | null;
  authEmail: string | null;
  onNavigate: (view: SidebarView) => void;
}) {
  // ENG-1383: shared avatar-initials util (same derivation as the household /
  // Progress-header chips). Email fallback uses the local part, like the label.
  const initialsSource = displayName?.trim() || authEmail?.split("@")[0]?.trim();
  const initial = initialsSource ? avatarInitials(initialsSource) : "U";
  const label =
    displayName?.trim() ||
    authEmail?.split("@")[0]?.trim() ||
    "You";
  const isActive = currentView === "settings" || currentView === "profile";

  return (
    <button
      type="button"
      data-testid="desktop-sidebar-profile-entry"
      onClick={() => onNavigate("settings")}
      aria-current={isActive ? "page" : undefined}
      aria-label={collapsed ? `Open settings (${label})` : undefined}
      title={collapsed ? `Settings · ${label}` : undefined}
      className={`flex w-full items-center transition-all duration-150 hover:bg-muted/60 ${
        collapsed ? "justify-center p-3" : "gap-2.5 px-3 py-3"
      } ${
        isActive ? "bg-primary/[0.06] text-primary" : "text-foreground"
      }`}
    >
      {/* S5 avatar ruling (2026-07-10, ENG-1375): gradient retired — the ONE
          solid-damson identity disc (`AvatarDisc`), matching the mobile
          Today-header avatar (Figma 654:6). */}
      <AvatarDisc initial={initial} size={36} treatment={isFeatureEnabled("avatar_monogram_frost_ring_v1") ? "frostRing" : "legacy"} />
      {!collapsed ? (
        <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
          {label}
        </span>
      ) : null}
    </button>
  );
}

// SidebarUpgradeSlot extracted to `sidebar-upgrade-slot.tsx` (ENG-1293) so
// this file stays under its screen-budget pin; behaviour unchanged.

/**
 * CoachSidebarItem — the always-present labelled Coach entry (ENG-1293,
 * sweep decision #3 2026-07-01). Renders as a Today sub-tab (same grammar as
 * Recipes' Library/Discover rows) whenever the Today group is active, in
 * EVERY Today state — the old deficit-line-only deep-link vanished exactly
 * when the user needed it. `/coach` is a standalone route (not a SPA view),
 * so it navigates via a real `<Link>` instead of `onNavigate`. Gated on
 * `coach_screen_v1` at the render site. Mobile mirror: the hero "Coach" chip.
 */
function CoachSidebarItem() {
  return (
    <Link
      href="/coach"
      data-testid="desktop-sidebar-coach-entry"
      className="group relative flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-all duration-150 text-muted-foreground hover:text-foreground hover:bg-muted/50"
    >
      <span className="flex-1 text-left">Coach</span>
    </Link>
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
        onNavigate(item.defaultLeaf);
      }}
      aria-current={isActive ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={`group relative flex w-full items-center rounded-lg text-sm font-medium transition-all duration-150 ${
        collapsed
          ? "justify-center h-10 px-0"
          : "gap-2.5 px-3 py-2"
      } ${
        isActive
          ? "bg-primary/[0.08] text-primary"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      {/* Active accent bar — 3px rounded pill on the left edge */}
      {isActive ? (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary"
          style={{ transition: "height 150ms ease" }}
          aria-hidden
        />
      ) : null}
      <Icon
        className={`h-[18px] w-[18px] shrink-0 transition-colors duration-150 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}
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
  const badge = formatSidebarBadge(sub.badge?.(sidebarProps) ?? 0);
  return (
    <button
      type="button"
      onClick={() => onNavigate(sub.view)}
      aria-current={isActive ? "page" : undefined}
      className={`group relative flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-all duration-150 ${
        isActive
          ? "bg-primary/[0.08] text-primary font-semibold"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      }`}
    >
      <span className="flex-1 text-left">{sub.label}</span>
      {badge.show ? (
        <span
          className={`min-w-[1.25rem] rounded-full bg-primary/15 text-[10px] font-bold text-primary-solid text-center leading-5 ${
            badge.label === "•" ? "px-1.5" : "px-1.5 tabular-nums"
          }`}
          aria-label={badge.label === "•" ? "Has unchecked items" : `${badge.label} unchecked`}
        >
          {badge.label}
        </span>
      ) : null}
    </button>
  );
}
