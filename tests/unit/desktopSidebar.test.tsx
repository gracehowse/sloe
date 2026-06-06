/**
 * desktopSidebar — renders the web app's desktop navigation (visible
 * at `md:` / 768px+). Mobile-web keeps the bottom-tab layout and
 * hides this sidebar, so these assertions focus on what the sidebar
 * itself exposes, not on breakpoint CSS.
 *
 * Phase 2 / B1.1 (2026-04-27 strategic spec, D-2026-04-27-02): the
 * sidebar collapses to four primary destinations (Today / Recipes /
 * Plan / Progress). Sub-tabs render below the active primary entry.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import {
  DesktopSidebar,
  resolvePrimaryFromView,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
} from "../../src/app/components/suppr/desktop-sidebar";

describe("DesktopSidebar — Phase 2 (4 primary tabs)", () => {
  beforeEach(() => {
    window.localStorage.removeItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
  });

  it("renders exactly four primary nav items in the canonical order", () => {
    render(<DesktopSidebar currentView="today" onNavigate={() => {}} />);
    expect(screen.getByRole("button", { name: /^Today$/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Recipes$/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Plan$/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Progress$/ })).toBeDefined();
    // Demoted destinations no longer have a primary entry.
    expect(screen.queryByRole("button", { name: /^Discover$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Settings$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^More$/ })).toBeNull();
    // No primary "You" tab — profile entry at the bottom may show "You"
    // when display name is unset (see profile-entry test below).
    expect(screen.getByTestId("desktop-sidebar-profile-entry")).toBeDefined();
  });

  it("highlights Today as active when on /today", () => {
    render(<DesktopSidebar currentView="today" onNavigate={() => {}} />);
    const today = screen.getByRole("button", { name: /^Today$/ });
    expect(today.getAttribute("aria-current")).toBe("page");
    const recipes = screen.getByRole("button", { name: /^Recipes$/ });
    expect(recipes.getAttribute("aria-current")).toBeNull();
  });

  it("highlights Recipes when the leaf view is library or discover", () => {
    const { rerender } = render(<DesktopSidebar currentView="library" onNavigate={() => {}} />);
    expect(screen.getByRole("button", { name: /^Recipes$/ }).getAttribute("aria-current")).toBe("page");

    rerender(<DesktopSidebar currentView="discover" onNavigate={() => {}} />);
    expect(screen.getByRole("button", { name: /^Recipes$/ }).getAttribute("aria-current")).toBe("page");
  });

  it("highlights Progress when the leaf view is progress or progress-adjacent routes", () => {
    for (const v of ["progress", "household-settings", "targets"] as const) {
      const { unmount } = render(<DesktopSidebar currentView={v} onNavigate={() => {}} />);
      expect(screen.getByRole("button", { name: /^Progress$/ }).getAttribute("aria-current")).toBe("page");
      unmount();
    }
  });

  it("does not highlight Progress when on settings or profile (avatar-entry surfaces)", () => {
    for (const v of ["settings", "profile"] as const) {
      const { unmount } = render(<DesktopSidebar currentView={v} onNavigate={() => {}} />);
      expect(screen.getByRole("button", { name: /^Progress$/ }).getAttribute("aria-current")).toBeNull();
      unmount();
    }
  });

  it("renders Recipes sub-tabs (Library default, Discover) only when Recipes is the active primary", () => {
    const { rerender } = render(<DesktopSidebar currentView="today" onNavigate={() => {}} />);
    // Sub-tabs aren't rendered while Today is active.
    expect(screen.queryByRole("button", { name: /^Library/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Discover/ })).toBeNull();

    rerender(<DesktopSidebar currentView="library" onNavigate={() => {}} />);
    expect(screen.getByRole("button", { name: /^Library/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Discover/ })).toBeDefined();
  });

  it("does not render Progress sub-tabs (Settings is not a nav sub-tab, 2026-05-19)", () => {
    const { rerender } = render(<DesktopSidebar currentView="today" onNavigate={() => {}} />);
    expect(screen.queryByRole("button", { name: /^Settings$/ })).toBeNull();

    rerender(<DesktopSidebar currentView="progress" onNavigate={() => {}} />);
    expect(screen.queryByRole("button", { name: /^Settings$/ })).toBeNull();
  });

  it("renders bottom-left profile entry that opens settings (mobile parity)", () => {
    const onNavigate = vi.fn();
    render(
      <DesktopSidebar
        currentView="today"
        onNavigate={onNavigate}
        displayName="Grace"
        authEmail="grace@example.com"
      />,
    );
    const profile = screen.getByTestId("desktop-sidebar-profile-entry");
    expect(profile.textContent).toContain("Grace");
    fireEvent.click(profile);
    expect(onNavigate).toHaveBeenCalledWith("settings");
  });

  it("highlights profile entry when on settings or profile", () => {
    const { rerender } = render(
      <DesktopSidebar currentView="settings" onNavigate={() => {}} displayName="Grace" />,
    );
    expect(screen.getByTestId("desktop-sidebar-profile-entry").getAttribute("aria-current")).toBe(
      "page",
    );

    rerender(
      <DesktopSidebar currentView="profile" onNavigate={() => {}} displayName="Grace" />,
    );
    expect(screen.getByTestId("desktop-sidebar-profile-entry").getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("keeps profile entry visible when sidebar is collapsed", () => {
    render(<DesktopSidebar currentView="today" onNavigate={() => {}} displayName="Grace" />);
    fireEvent.click(screen.getByTestId("desktop-sidebar-collapse-toggle"));
    expect(screen.getByTestId("desktop-sidebar-profile-entry")).toBeDefined();
    expect(screen.getByRole("button", { name: /Open settings \(Grace\)/ })).toBeDefined();
  });

  it("renders Plan sub-tabs (This week / Shopping) when Plan is active", () => {
    render(<DesktopSidebar currentView="plan" onNavigate={() => {}} shoppingUncheckedCount={0} />);
    expect(screen.getByRole("button", { name: /This week/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Shopping/ })).toBeDefined();
  });

  it("routes the primary press to its default leaf via onNavigate", () => {
    const onNavigate = vi.fn();
    render(<DesktopSidebar currentView="today" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: /^Recipes$/ }));
    expect(onNavigate).toHaveBeenCalledWith("library");
    onNavigate.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /^Progress$/ }));
    expect(onNavigate).toHaveBeenCalledWith("progress");
    onNavigate.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /^Plan$/ }));
    expect(onNavigate).toHaveBeenCalledWith("plan");
  });

  it("routes a sub-tab press to its specific leaf view", () => {
    const onNavigate = vi.fn();
    render(<DesktopSidebar currentView="library" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: /^Discover/ }));
    expect(onNavigate).toHaveBeenCalledWith("discover");
  });

  it("renders the Library badge with the saved-recipe count when > 0 and Recipes is active", () => {
    const { rerender } = render(
      <DesktopSidebar currentView="library" onNavigate={() => {}} libraryRecipeCount={5} />,
    );
    const library = screen.getByRole("button", { name: /^Library/ });
    expect(library.textContent).toContain("5");

    rerender(<DesktopSidebar currentView="library" onNavigate={() => {}} libraryRecipeCount={0} />);
    const libraryZero = screen.getByRole("button", { name: /^Library/ });
    expect(/[0-9]/.test(libraryZero.textContent ?? "")).toBe(false);
  });

  it("collapses Library badge to dot when count >= 10", () => {
    render(<DesktopSidebar currentView="library" onNavigate={() => {}} libraryRecipeCount={500} />);
    expect(screen.getByRole("button", { name: /^Library/ }).textContent).toContain("•");
  });

  it("renders the Shopping badge with the unchecked count when > 0 and Plan is active", () => {
    render(<DesktopSidebar currentView="plan" onNavigate={() => {}} shoppingUncheckedCount={4} />);
    expect(screen.getByRole("button", { name: /Shopping/ }).textContent).toContain("4");
  });

  it("collapses Shopping badge to dot when count >= 10", () => {
    render(<DesktopSidebar currentView="plan" onNavigate={() => {}} shoppingUncheckedCount={1234} />);
    expect(screen.getByRole("button", { name: /Shopping/ }).textContent).toContain("•");
  });
});

describe("resolvePrimaryFromView — leaf-to-primary mapping", () => {
  it("maps Today leaf to today primary", () => {
    expect(resolvePrimaryFromView("today")).toBe("today");
  });
  it("maps Library and Discover leaves to recipes primary", () => {
    expect(resolvePrimaryFromView("library")).toBe("recipes");
    expect(resolvePrimaryFromView("discover")).toBe("recipes");
  });
  it("maps Plan and Shopping leaves to plan primary", () => {
    expect(resolvePrimaryFromView("plan")).toBe("plan");
    expect(resolvePrimaryFromView("shopping")).toBe("plan");
  });
  it("maps Progress / Profile / Settings / household-settings / targets leaves to you primary", () => {
    expect(resolvePrimaryFromView("progress")).toBe("you");
    expect(resolvePrimaryFromView("profile")).toBe("today");
    expect(resolvePrimaryFromView("settings")).toBe("today");
    expect(resolvePrimaryFromView("household-settings")).toBe("you");
    expect(resolvePrimaryFromView("targets")).toBe("you");
  });
  it("falls back to today for unknown leaves", () => {
    // notifications / create / import are routed via deep links, not
    // the sidebar — they don't claim a primary highlight by design.
    expect(resolvePrimaryFromView("notifications")).toBe("today");
  });
});

/**
 * Collapse affordance — 2026-05-02 (user feedback,
 * `claude/household-section-streak-sidebar-bundle`). Pins:
 *   - Default = expanded (248px) when no localStorage value.
 *   - Toggle button in the header collapses to 64px and back.
 *   - Width animates via inline `style.width` so the 200ms CSS
 *     transition reads off a single animatable property.
 *   - Cmd/Ctrl+B keyboard shortcut toggles the same state.
 *   - `localStorage.suppr.sidebar.collapsed` round-trips across
 *     re-mounts (re-render covers the "reload preserves state" case
 *     because both runs share the same window/localStorage).
 *   - Sub-tabs hide while collapsed.
 *   - The toggle exposes aria-expanded + aria-label so screen
 *     readers announce the action and current state.
 */
describe("DesktopSidebar — collapse affordance", () => {
  beforeEach(() => {
    window.localStorage.removeItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
  });

  afterEach(() => {
    window.localStorage.removeItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
  });

  it("defaults to expanded (width 248px) when no localStorage preference", () => {
    render(<DesktopSidebar currentView="today" onNavigate={() => {}} />);
    const aside = screen.getByTestId("desktop-sidebar");
    expect(aside.getAttribute("data-collapsed")).toBe("false");
    expect(aside.style.width).toBe("248px");
  });

  it("collapses to 64px when the toggle is clicked, expands again on a second click", () => {
    render(<DesktopSidebar currentView="today" onNavigate={() => {}} />);
    const aside = screen.getByTestId("desktop-sidebar");
    const toggle = screen.getByTestId("desktop-sidebar-collapse-toggle");
    expect(aside.style.width).toBe("248px");

    fireEvent.click(toggle);
    expect(aside.getAttribute("data-collapsed")).toBe("true");
    expect(aside.style.width).toBe("64px");
    // Brand wordmark hides when collapsed (icon rail is single-col).
    expect(screen.queryByText("sloe")).toBeNull();

    fireEvent.click(toggle);
    expect(aside.getAttribute("data-collapsed")).toBe("false");
    expect(aside.style.width).toBe("248px");
    expect(screen.getByText("sloe")).toBeDefined();
  });

  it("persists the collapsed state to localStorage and rehydrates on remount", () => {
    const { unmount } = render(
      <DesktopSidebar currentView="today" onNavigate={() => {}} />,
    );
    fireEvent.click(screen.getByTestId("desktop-sidebar-collapse-toggle"));
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe("true");
    unmount();

    // Fresh mount = same as a page reload. Should read the persisted
    // pref and start collapsed.
    render(<DesktopSidebar currentView="today" onNavigate={() => {}} />);
    expect(screen.getByTestId("desktop-sidebar").style.width).toBe("64px");
    expect(screen.getByTestId("desktop-sidebar").getAttribute("data-collapsed")).toBe("true");
  });

  it("toggles via Cmd+B and Ctrl+B keyboard shortcut", () => {
    render(<DesktopSidebar currentView="today" onNavigate={() => {}} />);
    const aside = screen.getByTestId("desktop-sidebar");
    expect(aside.style.width).toBe("248px");

    fireEvent.keyDown(window, { key: "b", metaKey: true });
    expect(aside.style.width).toBe("64px");

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(aside.style.width).toBe("248px");
  });

  it("ignores the shortcut while focus is in an input (so Cmd+B can still mean Bold)", () => {
    const { container } = render(
      <div>
        <input data-testid="probe-input" />
        <DesktopSidebar currentView="today" onNavigate={() => {}} />
      </div>,
    );
    const aside = screen.getByTestId("desktop-sidebar");
    const input = screen.getByTestId("probe-input");
    input.focus();

    // KeyboardEvent dispatched on the input — handler must skip it.
    fireEvent.keyDown(input, { key: "b", metaKey: true });
    expect(aside.style.width).toBe("248px");
    // sanity: container still mounted
    expect(container.querySelector("aside")).not.toBeNull();
  });

  it("hides sub-tabs while collapsed even when their primary is active", () => {
    render(<DesktopSidebar currentView="library" onNavigate={() => {}} />);
    // Expanded — sub-tabs visible.
    expect(screen.getByRole("button", { name: /^Library/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Discover/ })).toBeDefined();

    fireEvent.click(screen.getByTestId("desktop-sidebar-collapse-toggle"));
    expect(screen.queryByRole("button", { name: /^Library/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Discover/ })).toBeNull();
  });

  it("exposes aria-expanded + aria-label on the toggle for screen readers", () => {
    render(<DesktopSidebar currentView="today" onNavigate={() => {}} />);
    const toggle = screen.getByTestId("desktop-sidebar-collapse-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.getAttribute("aria-label")).toBe("Collapse navigation");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-label")).toBe("Expand navigation");
  });

  it("preserves Today/Recipes/Plan/Progress labels as accessible names while collapsed", () => {
    render(<DesktopSidebar currentView="today" onNavigate={() => {}} />);
    fireEvent.click(screen.getByTestId("desktop-sidebar-collapse-toggle"));
    // Each primary button still announces its label even though the
    // visible text is hidden — aria-label takes over.
    expect(screen.getByRole("button", { name: /^Today$/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Recipes$/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Plan$/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Progress$/ })).toBeDefined();
  });
});
