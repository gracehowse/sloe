import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  SupprMark,
  SupprPlateMark,
  SupprPlateWordmark,
  SupprWordmark,
} from "../../src/app/components/ui/suppr-mark";

void React;

/**
 * Sloe wordmark primitives (`suppr-mark.tsx`) — historical `Suppr*` export
 * names kept for call-site stability. Logo is the lowercase "sloe" in Fraunces
 * Light + plum (`--foreground-brand`), no plate glyph — family + casing +
 * weight match the v3 prototype's LOCKED Fraunces-only wordmark (supersedes the
 * 2026-06-08 Newsreader-semibold Figma treatment; Figma retired 2026-06-24).
 * The accessible name stays the proper-noun "Sloe".
 */

describe("SupprMark (Sloe wordmark)", () => {
  it("renders the lowercase wordmark with role=img and the proper-noun aria-label", () => {
    render(<SupprMark />);
    const mark = screen.getByRole("img", { name: "Sloe" });
    expect(mark).toHaveAttribute("data-slot", "sloe-mark");
    expect(mark.textContent).toBe("sloe");
  });

  it("renders the wordmark in Fraunces Light (prototype-locked)", () => {
    render(<SupprMark />);
    const mark = screen.getByRole("img", { name: "Sloe" });
    expect(mark.className).toContain("font-light");
  });

  it("scales font size at the 0.72 ratio (ENG-797 mobile parity)", () => {
    render(<SupprMark size={40} />);
    const mark = screen.getByRole("img", { name: "Sloe" });
    expect(mark).toHaveStyle({ fontSize: "29px" });
  });

  it("uses the Fraunces brand font + plum brand token classes", () => {
    render(<SupprMark />);
    const mark = screen.getByRole("img", { name: "Sloe" });
    expect(mark.className).toContain("font-[family-name:var(--font-brand)]");
    expect(mark.className).toContain("text-foreground-brand");
  });
});

describe("SupprPlateMark (deprecated alias)", () => {
  it("renders the same Sloe wordmark as SupprMark", () => {
    render(<SupprPlateMark />);
    expect(screen.getByRole("img", { name: "Sloe" })).toBeInTheDocument();
  });
});

describe("SupprPlateWordmark (deprecated alias)", () => {
  it("composes the Sloe wordmark lockup", () => {
    render(<SupprPlateWordmark />);
    expect(screen.getByText("sloe")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Sloe" })).toBeInTheDocument();
  });
});

describe("SupprWordmark", () => {
  it("composes the Sloe wordmark in a wrapper", () => {
    render(<SupprWordmark />);
    expect(screen.getByText("sloe")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Sloe" })).toBeInTheDocument();
  });

  it("matches plate wordmark ratio at the default size", () => {
    const { container: legacy } = render(<SupprWordmark size={28} />);
    const { container: plate } = render(<SupprPlateWordmark size={28} />);
    const legacyWord = legacy.querySelector('[data-slot="sloe-wordmark"]');
    const plateWord = plate.querySelector('[data-slot="sloe-wordmark"]');
    expect(legacyWord).toHaveStyle({ fontSize: "20px" });
    expect(plateWord).toHaveStyle({ fontSize: "20px" });
  });
});
