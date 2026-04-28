/**
 * desktopSidebar — renders the web app's desktop navigation (visible
 * at `md:` / 768px+). Mobile-web keeps the bottom-tab layout and
 * hides this sidebar, so these assertions focus on what the sidebar
 * itself exposes, not on breakpoint CSS.
 *
 * Phase 2 / B1.1 (2026-04-27 strategic spec, D-2026-04-27-02): the
 * sidebar collapses to four primary destinations (Today / Recipes /
 * Plan / You). Sub-tabs render below the active primary entry; the
 * test set pins both the primary structure and the sub-tab behaviour.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { DesktopSidebar, resolvePrimaryFromView } from "../../src/app/components/suppr/desktop-sidebar";

describe("DesktopSidebar — Phase 2 (4 primary tabs)", () => {
  it("renders exactly four primary nav items in the canonical order", () => {
    render(<DesktopSidebar currentView="today" onNavigate={() => {}} />);
    expect(screen.getByRole("button", { name: /^Today$/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Recipes$/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Plan$/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /^You$/ })).toBeDefined();
    // Demoted destinations no longer have a primary entry.
    expect(screen.queryByRole("button", { name: /^Discover$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Progress$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Settings$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^More$/ })).toBeNull();
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

  it("highlights You when the leaf view is progress, settings, profile, or household-settings", () => {
    const views = ["progress", "settings", "profile", "household-settings", "targets"] as const;
    for (const v of views) {
      const { unmount } = render(<DesktopSidebar currentView={v} onNavigate={() => {}} />);
      expect(screen.getByRole("button", { name: /^You$/ }).getAttribute("aria-current")).toBe("page");
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

  it("renders You sub-tabs (Progress / Profile / Settings) only when You is active", () => {
    const { rerender } = render(<DesktopSidebar currentView="today" onNavigate={() => {}} />);
    expect(screen.queryByRole("button", { name: /^Settings/ })).toBeNull();

    rerender(<DesktopSidebar currentView="progress" onNavigate={() => {}} />);
    expect(screen.getByRole("button", { name: /^Progress/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Profile/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Settings/ })).toBeDefined();
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
    fireEvent.click(screen.getByRole("button", { name: /^You$/ }));
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
      <DesktopSidebar currentView="library" onNavigate={() => {}} libraryRecipeCount={42} />,
    );
    const library = screen.getByRole("button", { name: /^Library/ });
    expect(library.textContent).toContain("42");

    rerender(<DesktopSidebar currentView="library" onNavigate={() => {}} libraryRecipeCount={0} />);
    const libraryZero = screen.getByRole("button", { name: /^Library/ });
    expect(/[0-9]/.test(libraryZero.textContent ?? "")).toBe(false);
  });

  it("caps the Library badge at 99+", () => {
    render(<DesktopSidebar currentView="library" onNavigate={() => {}} libraryRecipeCount={500} />);
    expect(screen.getByRole("button", { name: /^Library/ }).textContent).toContain("99+");
  });

  it("renders the Shopping badge with the unchecked count when > 0 and Plan is active", () => {
    render(<DesktopSidebar currentView="plan" onNavigate={() => {}} shoppingUncheckedCount={4} />);
    expect(screen.getByRole("button", { name: /Shopping/ }).textContent).toContain("4");
  });

  it("caps the Shopping badge at 99+", () => {
    render(<DesktopSidebar currentView="plan" onNavigate={() => {}} shoppingUncheckedCount={1234} />);
    expect(screen.getByRole("button", { name: /Shopping/ }).textContent).toContain("99+");
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
    expect(resolvePrimaryFromView("profile")).toBe("you");
    expect(resolvePrimaryFromView("settings")).toBe("you");
    expect(resolvePrimaryFromView("household-settings")).toBe("you");
    expect(resolvePrimaryFromView("targets")).toBe("you");
  });
  it("falls back to today for unknown leaves", () => {
    // notifications / create / import are routed via deep links, not
    // the sidebar — they don't claim a primary highlight by design.
    expect(resolvePrimaryFromView("notifications")).toBe("today");
  });
});
