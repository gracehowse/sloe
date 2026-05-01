/**
 * PhotoLogDialog (web) grouping + range-rendering test
 * (range-first re-architecture, 2026-05-01).
 *
 * What this protects:
 *  - Items render grouped by category in the model's preferred order.
 *  - Each item's kcal range renders as the `~LOW–HIGH kcal` pattern
 *    matching Grace's screenshot (en-dash, "~" prefix, "kcal" suffix).
 *  - The plate total banner sums all items' ranges.
 *  - Add-on chips render below the list when the API includes addons.
 *  - Tapping an addon chip moves it into the items list and updates
 *    the plate total banner.
 *  - Tapping a low-confidence item still allows commit (no blanket-
 *    block — anti-regression on the old "Couldn't analyse" UX).
 *
 * Mobile parity test lives at
 * `apps/mobile/tests/unit/photoLogSheetGrouping.test.tsx`.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

void React;

vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: vi.fn(),
}));

vi.mock("../../src/lib/supabase/browserClient", () => ({
  supabase: {
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    from: () => ({
      select: () => ({ eq: () => ({ ilike: () => Promise.resolve({ data: [], error: null }) }) }),
    }),
  },
}));

vi.mock("../../src/lib/nutrition/photoCorrectionPersist", () => ({
  persistPhotoCorrections: vi.fn(async () => ({ anyPersisted: false })),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

import { PhotoLogDialog } from "../../src/app/components/suppr/photo-log-dialog";

const FIXTURE_RESPONSE = {
  ok: true,
  modelVersion: "gpt-4o-test",
  items: [
    {
      id: "ai-pita",
      name: "Pita",
      category: "Bread + dips",
      quantityHint: "1 piece",
      calories: { low: 120, high: 150 },
      protein: null,
      carbs: null,
      fat: null,
      confidence: "high" as const,
      source: "ai" as const,
    },
    {
      id: "ai-hummus",
      name: "Hummus",
      category: "Bread + dips",
      quantityHint: "~2 tbsp",
      calories: { low: 70, high: 100 },
      protein: null,
      carbs: null,
      fat: null,
      confidence: "high" as const,
      source: "ai" as const,
    },
    {
      id: "ai-cheese",
      name: "Cheese",
      category: "Protein + fats",
      quantityHint: "~40-50g",
      calories: { low: 160, high: 200 },
      protein: null,
      carbs: null,
      fat: null,
      confidence: "medium" as const,
      source: "ai" as const,
    },
    {
      id: "ai-mystery",
      name: "Mystery sauce",
      category: "Extras",
      calories: { low: 30, high: 100 },
      protein: null,
      carbs: null,
      fat: null,
      confidence: "low" as const,
      source: "ai" as const,
    },
  ],
  addons: [
    {
      id: "addon-wine",
      name: "Glass of red wine",
      hint: "if you're also having wine",
      calories: { low: 120, high: 150 },
    },
  ],
  totalKcal: { low: 380, high: 550 },
  totalKcalWithAddons: { low: 500, high: 700 },
  notes: "Olive oil glaze likely +30 kcal",
};

describe("PhotoLogDialog — grouped breakdown with ranges (range-first 2026-05-01)", () => {
  beforeEach(() => {
    // Stub the photo-log endpoint to return the charcuterie-style
    // fixture so the dialog moves straight to the review stage.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(FIXTURE_RESPONSE), { status: 200 })),
    );
    // jsdom doesn't implement createObjectURL — the dialog calls it on
    // file pick to render a preview. Stub before each test.
    if (typeof URL.createObjectURL !== "function") {
      Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => "blob:test"), writable: true });
    }
    if (typeof URL.revokeObjectURL !== "function") {
      Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), writable: true });
    }
  });

  function Harness() {
    const [open, setOpen] = React.useState(true);
    const committedRef = React.useRef<unknown[]>([]);
    return (
      <>
        <PhotoLogDialog
          open={open}
          onOpenChange={setOpen}
          activeSlot="Lunch"
          onCommit={(items) => {
            committedRef.current = items;
          }}
        />
        <div data-testid="committed-count">{committedRef.current.length}</div>
      </>
    );
  }

  async function pickAndAnalyse() {
    const file = new File([new Uint8Array([1, 2, 3])], "meal.png", { type: "image/png" });
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, { target: { files: [file] } });
    // Click "Analyse" — the button is in the footer.
    const analyse = await screen.findByRole("button", { name: /analyse/i });
    fireEvent.click(analyse);
    // Wait for the review stage — group container appears.
    await screen.findByTestId("photo-log-groups");
  }

  it("renders items grouped by macro role in the model's order", async () => {
    render(<Harness />);
    await pickAndAnalyse();
    const groups = await screen.findByTestId("photo-log-groups");
    // Within the groups container, each category section renders with
    // a distinct test id. Order of children == model's order.
    const groupNodes = within(groups).getAllByTestId(/^photo-log-group-/);
    expect(groupNodes.map((el) => el.getAttribute("data-testid"))).toEqual([
      "photo-log-group-bread-+-dips",
      "photo-log-group-protein-+-fats",
      "photo-log-group-extras",
    ]);
  });

  it("renders each item's kcal range in the ~LOW–HIGH kcal pattern (en-dash)", async () => {
    render(<Harness />);
    await pickAndAnalyse();
    expect(screen.getByText("~120–150 kcal")).toBeTruthy();
    expect(screen.getByText("~70–100 kcal")).toBeTruthy();
    expect(screen.getByText("~160–200 kcal")).toBeTruthy();
    expect(screen.getByText("~30–100 kcal")).toBeTruthy();
  });

  it("renders the verbal portion hint next to the item name", async () => {
    render(<Harness />);
    await pickAndAnalyse();
    expect(screen.getByText("(1 piece)")).toBeTruthy();
    expect(screen.getByText("(~2 tbsp)")).toBeTruthy();
    expect(screen.getByText("(~40-50g)")).toBeTruthy();
  });

  it("renders the plate total banner summed across items", async () => {
    render(<Harness />);
    await pickAndAnalyse();
    const banner = screen.getByTestId("photo-log-plate-total");
    expect(banner.textContent).toMatch(/Plate total/);
    // 120+70+160+30 = 380 ; 150+100+200+100 = 550
    expect(banner.textContent).toMatch(/~380–550 kcal/);
  });

  it("flags low-confidence items with the amber 'verify before logging' note", async () => {
    render(<Harness />);
    await pickAndAnalyse();
    expect(screen.getByText(/Low confidence — verify before logging/i)).toBeTruthy();
  });

  it("renders add-on chips with the +LOW–HIGH kcal label", async () => {
    render(<Harness />);
    await pickAndAnalyse();
    const addons = screen.getByTestId("photo-log-addons");
    expect(addons.textContent).toMatch(/Add Glass of red wine/);
    expect(addons.textContent).toMatch(/\+~120–150 kcal/);
  });

  it("tapping an addon chip moves it into the items list and updates the plate total", async () => {
    render(<Harness />);
    await pickAndAnalyse();
    const addonBtn = screen.getByTestId("photo-log-addon-addon-wine");
    fireEvent.click(addonBtn);
    // After tap: addon chip gone, item appears in the list, plate
    // total updated to the with-addons total (500-700).
    expect(screen.queryByTestId("photo-log-addon-addon-wine")).toBeNull();
    expect(screen.getByText("Glass of red wine")).toBeTruthy();
    const banner = screen.getByTestId("photo-log-plate-total");
    expect(banner.textContent).toMatch(/~500–700 kcal/);
  });

  it("renders the model's `notes` caveat italicised below the items", async () => {
    render(<Harness />);
    await pickAndAnalyse();
    const notes = screen.getByTestId("photo-log-notes");
    expect(notes.textContent).toMatch(/olive oil/i);
  });

  it("'Save to today' is enabled even when low-confidence items exist (no blanket block)", async () => {
    render(<Harness />);
    await pickAndAnalyse();
    const save = screen.getByRole("button", { name: /save to today/i });
    expect(save.hasAttribute("disabled")).toBe(false);
  });
});
