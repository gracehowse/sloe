/**
 * RefineByDescribing wiring (ENG-974) — web PhotoLogDialog integration.
 *
 * Protects the observable behaviour:
 *  - flag ON → the "Refine by describing" input renders on the review screen
 *  - flag OFF → it does NOT render (the kill switch keeps the old review screen)
 *  - submitting a correction POSTs to `/api/nutrition/refine-log` with the
 *    CURRENT items + the refinement text, and the corrected result replaces the
 *    rendered items (conversational re-estimate)
 *  - the refine submit fires the `ai_log_refine_submitted` analytics event
 *
 * Mobile parity of the same gating is pinned in
 * `apps/mobile/tests/unit/refineByDescribingSheet.test.tsx`.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

void React;

const isFeatureEnabled = vi.fn(() => true);
const track = vi.fn();
vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: (...args: unknown[]) => track(...args),
  isFeatureEnabled: (flag: string) => isFeatureEnabled(flag),
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

const ANALYSE_RESPONSE = {
  ok: true,
  modelVersion: "test",
  items: [
    {
      id: "ai-rice",
      name: "White rice",
      category: "Carbs",
      quantityHint: "~150g",
      calories: { low: 190, high: 210 },
      protein: null,
      carbs: null,
      fat: null,
      confidence: "high" as const,
      source: "ai" as const,
    },
    {
      id: "ai-chicken",
      name: "Grilled chicken",
      category: "Protein",
      calories: { low: 190, high: 210 },
      protein: null,
      carbs: null,
      fat: null,
      confidence: "high" as const,
      source: "ai" as const,
    },
  ],
  totalKcal: { low: 380, high: 420 },
};

// The refine route drops the rice per "no rice".
const REFINE_RESPONSE = {
  ok: true,
  round: 2,
  modelVersion: "test",
  items: [
    {
      id: "ai-chicken",
      name: "Grilled chicken",
      category: "Protein",
      calories: { low: 190, high: 210 },
      protein: null,
      carbs: null,
      fat: null,
      confidence: "high" as const,
      source: "ai" as const,
    },
  ],
  totalKcal: { low: 190, high: 210 },
  notes: "Removed the rice.",
};

let lastRefineBody: any = null;

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/api/nutrition/refine-log")) {
        lastRefineBody = init?.body ? JSON.parse(String(init.body)) : null;
        return new Response(JSON.stringify(REFINE_RESPONSE), { status: 200 });
      }
      // analyse endpoint
      return new Response(JSON.stringify(ANALYSE_RESPONSE), { status: 200 });
    }) as typeof fetch,
  );
}

function Harness() {
  const [open, setOpen] = React.useState(true);
  return <PhotoLogDialog open={open} onOpenChange={setOpen} activeSlot="Lunch" onCommit={vi.fn()} />;
}

async function pickAndAnalyse() {
  const file = new File([new Uint8Array([1, 2, 3])], "meal.png", { type: "image/png" });
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
  fireEvent.change(fileInput!, { target: { files: [file] } });
  const analyse = await screen.findByRole("button", { name: /analyse/i });
  fireEvent.click(analyse);
  await screen.findByTestId("photo-log-groups");
}

describe("RefineByDescribing wiring (web PhotoLogDialog)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isFeatureEnabled.mockReturnValue(true);
    lastRefineBody = null;
    stubFetch();
    if (typeof URL.createObjectURL !== "function") {
      Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => "blob:test"), writable: true });
    }
    if (typeof URL.revokeObjectURL !== "function") {
      Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), writable: true });
    }
  });

  it("flag ON → renders the refine input on the review screen", async () => {
    render(<Harness />);
    await pickAndAnalyse();
    expect(screen.getByTestId("refine-by-describing")).toBeTruthy();
    expect(screen.getByLabelText(/add a detail to refine the estimate/i)).toBeTruthy();
  });

  it("flag OFF → does NOT render the refine input (kill switch)", async () => {
    isFeatureEnabled.mockImplementation((flag: string) =>
      flag === "log_refine_describe_v1" ? false : true,
    );
    render(<Harness />);
    await pickAndAnalyse();
    expect(screen.queryByTestId("refine-by-describing")).toBeNull();
  });

  it("submitting a correction re-estimates: posts current items + text, replaces the rendered items", async () => {
    render(<Harness />);
    await pickAndAnalyse();
    // Both items visible before the refine.
    expect(screen.getByText("White rice")).toBeTruthy();
    expect(screen.getByText("Grilled chicken")).toBeTruthy();

    const input = screen.getByLabelText(/add a detail to refine the estimate/i);
    fireEvent.change(input, { target: { value: "no rice" } });
    const apply = screen.getByRole("button", { name: /apply this correction/i });
    fireEvent.click(apply);

    // Rice is gone, chicken remains — the corrected result replaced the items.
    await waitFor(() => expect(screen.queryByText("White rice")).toBeNull());
    expect(screen.getByText("Grilled chicken")).toBeTruthy();

    // Request carried the CURRENT items + the correction text + source.
    expect(lastRefineBody.source).toBe("photo");
    expect(lastRefineBody.refinementText).toBe("no rice");
    expect(lastRefineBody.items.map((i: { name: string }) => i.name)).toContain("White rice");

    // Analytics fired on submit with source + round + textLength (never the text).
    const refineCall = track.mock.calls.find((c) => c[0] === "ai_log_refine_submitted");
    expect(refineCall).toBeTruthy();
    expect(refineCall?.[1]).toMatchObject({ source: "photo", round: 1, textLength: "no rice".length });
    expect(JSON.stringify(refineCall?.[1])).not.toContain("no rice");
  });
});
