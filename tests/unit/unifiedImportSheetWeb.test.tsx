/**
 * UnifiedImportSheet web (ENG-1225 #3) — the import-wedge single front door.
 * Pins detect-and-route: a pasted URL navigates to /import, a CSV shows the
 * Settings hint without navigating, and Import is disabled for empty input.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { UnifiedImportSheet } from "../../src/app/components/suppr/unified-import-sheet";

describe("UnifiedImportSheet (web)", () => {
  it("routes a pasted social URL to /import with the prefilled url", () => {
    push.mockClear();
    render(<UnifiedImportSheet open onOpenChange={() => {}} />);
    fireEvent.change(screen.getByTestId("unified-import-input"), {
      target: { value: "https://www.instagram.com/reel/Cabc/" },
    });
    fireEvent.click(screen.getByTestId("unified-import-cta"));
    expect(push).toHaveBeenCalledWith(
      "/import?importUrl=https%3A%2F%2Fwww.instagram.com%2Freel%2FCabc%2F",
    );
  });

  it("shows a Settings hint for a CSV without navigating", () => {
    push.mockClear();
    render(<UnifiedImportSheet open onOpenChange={() => {}} />);
    fireEvent.change(screen.getByTestId("unified-import-input"), {
      target: {
        value:
          "Date,Meal,Calories,Protein\n2026-06-20,Breakfast,320,12\n2026-06-20,Lunch,440,38",
      },
    });
    fireEvent.click(screen.getByTestId("unified-import-cta"));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText(/Settings/)).toBeTruthy();
  });

  it("disables Import for empty input with the guiding CTA label", () => {
    render(<UnifiedImportSheet open onOpenChange={() => {}} />);
    const cta = screen.getByTestId("unified-import-cta") as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    expect(cta.textContent).toBe("Paste something to import");
  });

  it("names what will be imported in the CTA once something is detected (ENG-1247 A13)", () => {
    render(<UnifiedImportSheet open onOpenChange={() => {}} />);
    fireEvent.change(screen.getByTestId("unified-import-input"), {
      target: { value: "https://www.instagram.com/reel/Cabc/" },
    });
    const cta = screen.getByTestId("unified-import-cta") as HTMLButtonElement;
    expect(cta.disabled).toBe(false);
    expect(cta.textContent?.toLowerCase()).toContain("import");
    // The label echoes the detected classification, not a flat "Import".
    expect(cta.textContent).not.toBe("Import");
  });
});
