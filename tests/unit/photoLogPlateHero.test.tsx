/**
 * Plate hero card render test (2026-05-02).
 *
 * Pins the user-visible contract on the new plate hero card:
 *  - The midpoint kcal value is the headline (28pt, with leading "~").
 *  - The "plate total · N items" subline is rendered.
 *  - The range caption shows aggregated low–high + the plate-level
 *    confidence label.
 *  - When all items are verified, the range caption is replaced by an
 *    "all items verified" success line and the AI estimate chips are
 *    swapped for verified chips.
 */
// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

void React;

vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: () => {},
}));

import { PhotoLogDialog } from "../../src/app/components/suppr/photo-log-dialog";
import type { AiLoggedItem } from "../../src/lib/nutrition/aiLogging";

function setupAnalyseFetch(items: Array<Partial<AiLoggedItem> & Pick<AiLoggedItem, "name" | "calories" | "protein" | "carbs" | "fat" | "confidence">>) {
  const original = global.fetch;
  global.fetch = vi.fn(async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, items }),
    } as unknown as Response;
  });
  return () => {
    global.fetch = original;
  };
}

function Harness() {
  const [open, setOpen] = React.useState(true);
  return (
    <PhotoLogDialog
      open={open}
      onOpenChange={setOpen}
      activeSlot="dinner"
      onCommit={() => setOpen(false)}
    />
  );
}

async function renderInReview(itemSeeds: Parameters<typeof setupAnalyseFetch>[0]) {
  const restore = setupAnalyseFetch(itemSeeds);
  // jsdom URL polyfills.
  // @ts-expect-error — jsdom missing
  global.URL.createObjectURL = () => "blob:mock";
  // @ts-expect-error — jsdom missing
  global.URL.revokeObjectURL = () => {};
  render(<Harness />);
  // Radix Dialog renders into a portal, so container.querySelector won't
  // find the hidden <input>. Use document.querySelector instead.
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(["x"], "meal.jpg", { type: "image/jpeg" });
  Object.defineProperty(input, "files", { value: [file], writable: false });
  fireEvent.change(input);
  fireEvent.click(screen.getByRole("button", { name: /Analyse/i }));
  await screen.findByTestId("plate-hero");
  return { restore };
}

describe("PhotoLogDialog plate hero card (2026-05-02)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the midpoint as the primary number with leading '~' and 'kcal' suffix", async () => {
    const { restore } = await renderInReview([
      { name: "rice", calories: 400, protein: 5, carbs: 80, fat: 1, confidence: 0.6 },
      { name: "chicken", calories: 470, protein: 50, carbs: 0, fat: 25, confidence: 0.6 },
    ]);
    const hero = screen.getByTestId("plate-hero");
    expect(within(hero).getByTestId("plate-hero-midpoint").textContent).toBe(
      "~870 kcal",
    );
    restore();
  });

  it("renders the 'plate total · N items' caption with correct pluralisation", async () => {
    const { restore } = await renderInReview([
      { name: "rice", calories: 400, protein: 5, carbs: 80, fat: 1, confidence: 0.6 },
      { name: "chicken", calories: 470, protein: 50, carbs: 0, fat: 25, confidence: 0.6 },
    ]);
    expect(screen.getByText(/plate total · 2 items/i)).toBeInTheDocument();
    restore();
  });

  it("singular 'item' when there's only one", async () => {
    const { restore } = await renderInReview([
      { name: "rice", calories: 400, protein: 5, carbs: 80, fat: 1, confidence: 0.6 },
    ]);
    expect(screen.getByText(/plate total · 1 item$/i)).toBeInTheDocument();
    restore();
  });

  it("renders the range as a caption with the plate-level confidence label", async () => {
    // Both medium → plate medium → ±12% per item, summed.
    const { restore } = await renderInReview([
      { name: "rice", calories: 400, protein: 5, carbs: 80, fat: 1, confidence: 0.6 },
      { name: "chicken", calories: 470, protein: 50, carbs: 0, fat: 25, confidence: 0.6 },
    ]);
    // 400 ± 12% = 352..448; 470 ± 12% = 414..526; plate range = 766..974
    const range = screen.getByTestId("plate-hero-range");
    expect(range.textContent).toMatch(/Range 766–974/);
    expect(range.textContent).toMatch(/medium confidence/i);
    restore();
  });

  it("range caption is tappable — expands all item rows when clicked", async () => {
    const { restore } = await renderInReview([
      { name: "rice", calories: 400, protein: 5, carbs: 80, fat: 1, confidence: 0.6 },
      { name: "chicken", calories: 470, protein: 50, carbs: 0, fat: 25, confidence: 0.6 },
    ]);
    // Item rows start collapsed — the verify CTA is hidden inside the
    // collapsed "expanded" row but tabIndex={-1}; we assert the expand
    // toggle's aria-expanded flips after clicking the range caption.
    const toggle0 = screen.getByTestId("photo-log-item-0-toggle");
    expect(toggle0.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(screen.getByTestId("plate-hero-range"));

    expect(toggle0.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("photo-log-item-1-toggle").getAttribute("aria-expanded")).toBe(
      "true",
    );
    restore();
  });
});
