/**
 * SettingsTwoPaneShell (web, ENG-1225 gap #24) — the Sloe v3 two-pane
 * Settings layout.
 *
 * Pins the LAYOUT/ROUTER behaviour that is observable to a user:
 *  - the left sub-nav renders one button per section (in order);
 *  - the first section is selected on open;
 *  - clicking a nav item swaps the right panel to that section's content
 *    and marks it `aria-current="page"`;
 *  - the page header (serif title) + optional identity header render;
 *  - an empty section list degrades gracefully (no crash, no nav).
 *
 * The OFF-path (legacy single-scroll stack) is asserted separately in
 * `settingsFlagBranch.test.tsx` — this file covers the shell in isolation,
 * which is where the new behaviour lives.
 */

import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  SettingsTwoPaneShell,
  type SettingsPaneSection,
} from "../../src/app/components/settings/SettingsTwoPaneShell";

const SECTIONS: SettingsPaneSection[] = [
  {
    id: "account",
    label: "Account & billing",
    lead: "Your plan and account actions.",
    icon: "user",
    content: <div data-testid="content-account">ACCOUNT BODY</div>,
  },
  {
    id: "preferences",
    label: "Preferences",
    lead: "How Sloe tracks your day.",
    icon: "settings",
    content: <div data-testid="content-preferences">PREFERENCES BODY</div>,
  },
  {
    id: "privacy",
    label: "Privacy & data",
    lead: "Your log is yours.",
    icon: "shield",
    content: <div data-testid="content-privacy">PRIVACY BODY</div>,
  },
];

describe("SettingsTwoPaneShell", () => {
  it("renders the page header and one nav item per section, in order", () => {
    render(<SettingsTwoPaneShell sections={SECTIONS} />);

    // Serif page title.
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeDefined();

    const nav = screen.getByTestId("settings-pane-nav");
    const buttons = within(nav).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
      "Account & billing",
      "Preferences",
      "Privacy & data",
    ]);
  });

  it("selects the first section on open (its nav item is aria-current)", () => {
    render(<SettingsTwoPaneShell sections={SECTIONS} />);
    expect(
      screen.getByTestId("settings-pane-nav-account").getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByTestId("settings-pane-nav-preferences").getAttribute("aria-current"),
    ).toBeNull();
    // The active panel's serif heading + lead render.
    const panel = screen.getByTestId("settings-pane-panel-account");
    expect(within(panel).getByText("Account & billing")).toBeDefined();
    expect(within(panel).getByText("Your plan and account actions.")).toBeDefined();
  });

  it("switches the active panel + aria-current when a nav item is clicked", async () => {
    const user = userEvent.setup();
    render(<SettingsTwoPaneShell sections={SECTIONS} />);

    await user.click(screen.getByTestId("settings-pane-nav-privacy"));

    expect(
      screen.getByTestId("settings-pane-nav-privacy").getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByTestId("settings-pane-nav-account").getAttribute("aria-current"),
    ).toBeNull();

    // The newly-active panel shows its content; the previously active one
    // is still in the DOM (single-column mobile fallback) but the active
    // markers moved.
    const privacyPanel = screen.getByTestId("settings-pane-panel-privacy");
    expect(within(privacyPanel).getByTestId("content-privacy")).toBeDefined();
  });

  it("renders the optional identity header above the grid", () => {
    render(
      <SettingsTwoPaneShell
        header={<div data-testid="identity-header">PROFILE + PRO BANNER</div>}
        sections={SECTIONS}
      />,
    );
    expect(screen.getByTestId("identity-header")).toBeDefined();
  });

  it("degrades gracefully with no sections (no nav buttons, no crash)", () => {
    render(<SettingsTwoPaneShell sections={[]} />);
    // The shell still mounts + shows the page title.
    expect(screen.getByTestId("settings-two-pane")).toBeDefined();
    const nav = screen.getByTestId("settings-pane-nav");
    expect(within(nav).queryAllByRole("button")).toHaveLength(0);
  });
});
