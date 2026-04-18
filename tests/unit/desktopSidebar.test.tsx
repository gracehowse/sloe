/**
 * desktopSidebar — renders the web app's desktop navigation (visible
 * at `lg:` / 1024px+). Mobile-web keeps the bottom-tab layout and
 * hides this sidebar, so these assertions focus on what the sidebar
 * itself exposes, not on breakpoint CSS.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { DesktopSidebar } from "../../src/app/components/suppr/desktop-sidebar";

describe("DesktopSidebar", () => {
  it("renders every Track and Recipes nav item plus Profile + Settings", () => {
    render(
      <DesktopSidebar currentView="today" onNavigate={() => {}} shoppingUncheckedCount={0} />,
    );
    // Track
    expect(screen.getByRole("button", { name: /Today/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Plan/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Progress/ })).toBeDefined();
    // Recipes
    expect(screen.getByRole("button", { name: /Library/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Discover/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Shopping/ })).toBeDefined();
    // Bottom pinned
    expect(screen.getByRole("button", { name: /Profile/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Settings/ })).toBeDefined();
  });

  it("marks the active view with aria-current='page'", () => {
    render(
      <DesktopSidebar currentView="plan" onNavigate={() => {}} />,
    );
    const active = screen.getByRole("button", { name: /Plan/ });
    expect(active.getAttribute("aria-current")).toBe("page");
    const inactive = screen.getByRole("button", { name: /Today/ });
    expect(inactive.getAttribute("aria-current")).toBeNull();
  });

  it("calls onNavigate with the view id when an item is clicked", () => {
    const onNavigate = vi.fn();
    render(<DesktopSidebar currentView="today" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: /Discover/ }));
    expect(onNavigate).toHaveBeenCalledWith("discover");
  });

  it("renders a shopping badge when unchecked items exist, hides it at zero", () => {
    const { rerender, container } = render(
      <DesktopSidebar currentView="today" onNavigate={() => {}} shoppingUncheckedCount={4} />,
    );
    // The badge contains the numeric count — assert the string appears
    // once inside the Shopping button.
    const shopping = screen.getByRole("button", { name: /Shopping/ });
    expect(shopping.textContent).toContain("4");

    rerender(
      <DesktopSidebar currentView="today" onNavigate={() => {}} shoppingUncheckedCount={0} />,
    );
    const shoppingZero = screen.getByRole("button", { name: /Shopping/ });
    // No digit characters remain in the button when count is 0 (apart
    // from the label itself).
    expect(/[0-9]/.test(shoppingZero.textContent ?? "")).toBe(false);
    // Sanity — the container still renders exactly one sidebar.
    expect(container.querySelector("aside")).not.toBeNull();
  });

  it("caps the shopping badge at 99+", () => {
    render(
      <DesktopSidebar currentView="today" onNavigate={() => {}} shoppingUncheckedCount={1234} />,
    );
    const shopping = screen.getByRole("button", { name: /Shopping/ });
    expect(shopping.textContent).toContain("99+");
  });
});
