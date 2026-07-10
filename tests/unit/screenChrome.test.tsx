/**
 * ScreenChrome — the ONE sticky mobile-web tab header (S6 chrome ruling
 * 2026-07-10, ENG-1375). Pins the shared grammar: overline 11/700/uppercase
 * tertiary → serif title at the ONE 24px tab-title size → optional
 * subtitle, trailing slot, hairline bottom border, hidden at md+.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ScreenChrome } from "../../src/app/components/suppr/screen-chrome";

void React;

describe("ScreenChrome (ENG-1375 S6)", () => {
  it("renders overline → serif-24 title → subtitle with the shared grammar", () => {
    render(
      <ScreenChrome
        overline="Your trends"
        title="Progress"
        subtitle="This week"
        testID="chrome"
        overlineTestID="chrome-overline"
        titleTestID="chrome-title"
      />,
    );
    const overline = screen.getByTestId("chrome-overline");
    expect(overline.textContent).toBe("Your trends");
    expect(overline.className).toContain("text-[11px]");
    expect(overline.className).toContain("font-bold");
    expect(overline.className).toContain("uppercase");
    expect(overline.className).toContain("tracking-[0.1em]");
    expect(overline.className).toContain("text-foreground-tertiary");

    const title = screen.getByRole("heading", { level: 1, name: "Progress" });
    // TITLE RULING: ONE tab-title size, serif 24 (mobile Type.title is
    // canonical; the old Progress 28 forked sibling tabs).
    expect(title.className).toContain("text-[24px]");
    expect(title.className).toContain(
      "font-[family-name:var(--font-headline)]",
    );
    expect(title.className).toContain("text-foreground-brand");

    expect(screen.getByText("This week").className).toContain("text-[13px]");
  });

  it("sticky header shell: hidden md+, hairline bottom border", () => {
    render(<ScreenChrome title="Meal plan" testID="chrome" />);
    const header = screen.getByTestId("chrome");
    expect(header.tagName).toBe("HEADER");
    expect(header.className).toContain("md:hidden");
    expect(header.className).toContain("sticky");
    expect(header.className).toContain("border-b");
    expect(header.className).toContain("border-border");
  });

  it("omits overline/subtitle when absent and renders trailing + children slots", () => {
    render(
      <ScreenChrome
        title="Your kitchen"
        testID="chrome"
        overlineTestID="chrome-overline"
        trailing={<button type="button">Create</button>}
      >
        <nav data-testid="chrome-subtabs" />
      </ScreenChrome>,
    );
    expect(screen.queryByTestId("chrome-overline")).toBeNull();
    expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
    expect(screen.getByTestId("chrome-subtabs")).toBeTruthy();
  });
});
