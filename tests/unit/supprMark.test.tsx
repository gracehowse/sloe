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
 * names kept for call-site stability. Logo is lowercase "sloe" in Newsreader
 * + plum (`--foreground-brand`), no plate glyph.
 */

describe("SupprMark (Sloe wordmark)", () => {
  it("renders the Sloe wordmark with role=img and aria-label", () => {
    render(<SupprMark />);
    const mark = screen.getByRole("img", { name: "Sloe" });
    expect(mark).toHaveAttribute("data-slot", "sloe-mark");
    expect(mark.textContent).toBe("sloe");
  });

  it("scales font size at the 0.72 ratio (ENG-797 mobile parity)", () => {
    render(<SupprMark size={40} />);
    const mark = screen.getByRole("img", { name: "Sloe" });
    expect(mark).toHaveStyle({ fontSize: "29px" });
  });

  it("uses Newsreader + plum brand token classes", () => {
    render(<SupprMark />);
    const mark = screen.getByRole("img", { name: "Sloe" });
    expect(mark.className).toContain("font-[family-name:var(--font-newsreader)]");
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
