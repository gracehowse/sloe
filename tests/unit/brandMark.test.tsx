/**
 * Brand-mark canonical contract (ENG-797 superseded, 2026-06-04 Sloe wordmark;
 * 2026-06-24 conformed to the v3 prototype: lowercase "sloe" in Fraunces Light).
 *
 * `SupprMark` / `SupprPlateMark` always render the lowercase "sloe" wordmark in
 * Fraunces Light + plum (proper-noun aria-label "Sloe"). The
 * `design_system_brandmark` flag and plate-ring motif are retired; historical
 * `Suppr*` export names remain for call-site stability.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  SupprMark,
  SupprPlateMark,
  SupprPlateWordmark,
} from "../../src/app/components/ui/suppr-mark";

void React;

describe("SupprMark — Sloe wordmark (ENG-797 retired)", () => {
  it("renders the Sloe wordmark with role=img and aria-label", () => {
    render(<SupprMark />);
    const mark = screen.getByRole("img", { name: "Sloe" });
    expect(mark).toHaveAttribute("data-slot", "sloe-mark");
    // ENG-1247: the wordmark is the splash logotype SVG as a CSS mask (no inline
    // text or <svg> node) — only the asset matches the splash.
    expect(mark.getAttribute("style")).toContain("sloe-wordmark.svg");
    expect(mark.querySelector("svg")).toBeNull();
  });

  it("forwards the size prop via the 0.72 ratio (height tracks it)", () => {
    render(<SupprMark size={48} />);
    const mark = screen.getByRole("img", { name: "Sloe" });
    // sloeFontSize(48) = 35 → height round(35 * 1.15) = 40.
    expect(mark).toHaveStyle({ height: "40px" });
  });
});

describe("SupprPlateMark — deprecated alias", () => {
  it("renders the same Sloe wordmark as SupprMark", () => {
    render(<SupprPlateMark />);
    expect(screen.getByRole("img", { name: "Sloe" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Suppr" })).toBeNull();
  });
});

describe("SupprPlateWordmark — deprecated alias", () => {
  it("composes the Sloe wordmark lockup", () => {
    render(<SupprPlateWordmark />);
    expect(screen.getByRole("img", { name: "Sloe" })).toBeInTheDocument();
  });
});
