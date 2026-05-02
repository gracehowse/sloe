/**
 * Photo-log verify flow integration test (2026-05-02).
 *
 * Exercises the full "Cal AI convert" loop:
 *   1. Item starts at AI estimate, medium confidence (2/4 amber meter).
 *   2. User taps "Verify with database".
 *   3. Network call to `/api/nutrition/verify-recipe` resolves with a
 *      high-confidence USDA match.
 *   4. UI updates: meter fills 4/4 success, AI badge swaps to verified,
 *      range caption disappears, save button copy advances.
 *
 * Also covers the offline / no-match failure path so the meter stays
 * amber (the spec calls this out explicitly — verification is
 * voluntary, not coerced).
 */
// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

void React;

type TrackCall = { event: string; payload?: Record<string, unknown> };
const trackCalls: TrackCall[] = [];

vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: (event: string, payload?: Record<string, unknown>) => {
    trackCalls.push({ event, payload });
  },
}));

import { PhotoLogDialog } from "../../src/app/components/suppr/photo-log-dialog";

type FetchHandler = (url: string, init?: RequestInit) => Promise<Partial<Response>>;

function installFetch(handler: FetchHandler) {
  const original = global.fetch;
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const out = await handler(url, init);
    return out as Response;
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

async function reachReviewStage(items: Array<Record<string, unknown>>, verifyHandler?: FetchHandler) {
  const restore = installFetch(async (url, init) => {
    if (url.includes("/api/nutrition/photo-log")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, items }),
      } as Partial<Response>;
    }
    if (url.includes("/api/nutrition/verify-recipe") && verifyHandler) {
      return verifyHandler(url, init);
    }
    return {
      ok: false,
      status: 404,
      json: async () => ({ ok: false }),
    } as Partial<Response>;
  });

  // @ts-expect-error — jsdom missing
  global.URL.createObjectURL = () => "blob:mock";
  // @ts-expect-error — jsdom missing
  global.URL.revokeObjectURL = () => {};

  render(<Harness />);
  // Radix Dialog uses a portal, so search the whole document.
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(["x"], "meal.jpg", { type: "image/jpeg" });
  Object.defineProperty(input, "files", { value: [file], writable: false });
  fireEvent.change(input);
  fireEvent.click(screen.getByRole("button", { name: /Analyse/i }));
  await screen.findByTestId("plate-hero");
  return restore;
}

describe("PhotoLogDialog verify flow (2026-05-02)", () => {
  beforeEach(() => {
    trackCalls.length = 0;
    vi.restoreAllMocks();
  });

  it("starts with AI estimate badge + medium meter; verify swaps to verified state", async () => {
    const restore = await reachReviewStage(
      [{ name: "chicken breast", calories: 230, protein: 50, carbs: 0, fat: 5, confidence: 0.6 }],
      async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          verified: [
            {
              input: { name: "chicken breast", amount: "100", unit: "g" },
              resolved: { name: "chicken breast", amount: "100", unit: "g" },
              fatSecretFoodId: null,
              matchedName: "Chicken, breast, raw",
              confidence: 0.92,
              source: "USDA",
              macros: { calories: 195, protein: 42, carbs: 0, fat: 3 },
            },
          ],
        }),
      }) as Partial<Response>,
    );

    // Pre-verify state — the AI badge is rendered, meter is medium.
    const item = screen.getByTestId("photo-log-item-0");
    expect(within(item).getByTestId("photo-log-item-0-ai-chip")).toBeInTheDocument();
    const meter = within(item).getAllByTestId("confidence-meter")[0];
    expect(meter.getAttribute("data-level")).toBe("medium");
    // Range caption is rendered.
    expect(within(item).getByTestId("photo-log-item-0-range")).toBeInTheDocument();
    // Midpoint shows the AI value.
    expect(within(item).getByTestId("photo-log-item-0-midpoint").textContent).toBe(
      "~230 kcal",
    );

    // Expand the row so the Verify button is visible / enabled.
    fireEvent.click(within(item).getByTestId("photo-log-item-0-toggle"));
    fireEvent.click(within(item).getByTestId("photo-log-item-0-verify"));

    // Tap fires the analytics event with the pre-verify confidence tier.
    expect(trackCalls.find((c) => c.event === "ai_photo_log_verify_tapped")).toMatchObject(
      {
        event: "ai_photo_log_verify_tapped",
        payload: { confidenceBefore: "medium", itemIndex: 0 },
      },
    );

    // Wait for verified-state markers.
    await waitFor(() => {
      expect(screen.getByTestId("photo-log-item-0-verified-chip")).toBeInTheDocument();
    });
    // AI chip is gone.
    expect(screen.queryByTestId("photo-log-item-0-ai-chip")).not.toBeInTheDocument();
    // Range caption disappears.
    expect(screen.queryByTestId("photo-log-item-0-range")).not.toBeInTheDocument();
    // Meter level upgrades to "verified".
    const meterAfter = within(screen.getByTestId("photo-log-item-0")).getAllByTestId(
      "confidence-meter",
    )[0];
    expect(meterAfter.getAttribute("data-level")).toBe("verified");
    // Midpoint shows the database value.
    expect(within(screen.getByTestId("photo-log-item-0")).getByTestId(
      "photo-log-item-0-midpoint",
    ).textContent).toBe("~195 kcal");
    // The verify-succeeded event fired.
    expect(trackCalls.find((c) => c.event === "ai_photo_log_verify_succeeded")).toBeTruthy();
    restore();
  });

  it("save button copy advances from 'Log estimate' to 'Log verified' once the only item is verified", async () => {
    const restore = await reachReviewStage(
      [{ name: "egg", calories: 78, protein: 6, carbs: 1, fat: 5, confidence: 0.6 }],
      async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          verified: [
            {
              input: { name: "egg", amount: "100", unit: "g" },
              resolved: { name: "egg", amount: "100", unit: "g" },
              fatSecretFoodId: null,
              matchedName: "Egg, whole, raw",
              confidence: 0.95,
              source: "USDA",
              macros: { calories: 80, protein: 6.3, carbs: 0.6, fat: 5.3 },
            },
          ],
        }),
      }) as Partial<Response>,
    );

    const saveBtn = screen.getByTestId("photo-log-save-button");
    expect(saveBtn.textContent).toMatch(/Log estimate/);

    fireEvent.click(screen.getByTestId("photo-log-item-0-toggle"));
    fireEvent.click(screen.getByTestId("photo-log-item-0-verify"));

    await waitFor(() => {
      expect(screen.getByTestId("photo-log-item-0-verified-chip")).toBeInTheDocument();
    });

    expect(screen.getByTestId("photo-log-save-button").textContent).toMatch(/Log verified/);
    restore();
  });

  it("on no-match failure, meter stays medium, AI chip stays, error appears", async () => {
    const restore = await reachReviewStage(
      [{ name: "weird mystery", calories: 230, protein: 50, carbs: 0, fat: 5, confidence: 0.6 }],
      async () => ({
        ok: true,
        status: 200,
        // verified[0] has confidence < 0.5 → treat as no_match.
        json: async () => ({
          ok: true,
          verified: [
            {
              input: { name: "weird mystery", amount: "100", unit: "g" },
              resolved: { name: "weird mystery", amount: "100", unit: "g" },
              fatSecretFoodId: null,
              matchedName: null,
              confidence: 0.2,
              source: "Unverified",
              macros: null,
            },
          ],
        }),
      }) as Partial<Response>,
    );

    fireEvent.click(screen.getByTestId("photo-log-item-0-toggle"));
    fireEvent.click(screen.getByTestId("photo-log-item-0-verify"));

    await waitFor(() => {
      expect(screen.getByText(/No high-confidence match/i)).toBeInTheDocument();
    });

    // Meter stayed medium.
    const meter = within(screen.getByTestId("photo-log-item-0")).getAllByTestId(
      "confidence-meter",
    )[0];
    expect(meter.getAttribute("data-level")).toBe("medium");
    // AI chip still there.
    expect(screen.getByTestId("photo-log-item-0-ai-chip")).toBeInTheDocument();
    // Failed event fired with no_match reason.
    expect(
      trackCalls.find(
        (c) =>
          c.event === "ai_photo_log_verify_failed" &&
          (c.payload?.reason === "no_match"),
      ),
    ).toBeTruthy();
    restore();
  });

  it("on offline / network error, meter stays amber and 'Can't reach database' is shown", async () => {
    const restore = await reachReviewStage(
      [{ name: "rice", calories: 400, protein: 5, carbs: 80, fat: 1, confidence: 0.6 }],
      async () => {
        throw new Error("network");
      },
    );

    fireEvent.click(screen.getByTestId("photo-log-item-0-toggle"));
    fireEvent.click(screen.getByTestId("photo-log-item-0-verify"));

    await waitFor(() => {
      expect(screen.getByText(/Can't reach database/i)).toBeInTheDocument();
    });

    const meter = within(screen.getByTestId("photo-log-item-0")).getAllByTestId(
      "confidence-meter",
    )[0];
    expect(meter.getAttribute("data-level")).toBe("medium");
    // Failed event fired.
    expect(
      trackCalls.find((c) => c.event === "ai_photo_log_verify_failed"),
    ).toBeTruthy();
    restore();
  });

  it("editing macros after verify clears the verified flag (no auto-verify on user edits)", async () => {
    const restore = await reachReviewStage(
      [{ name: "egg", calories: 78, protein: 6, carbs: 1, fat: 5, confidence: 0.6 }],
      async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          verified: [
            {
              input: { name: "egg", amount: "100", unit: "g" },
              resolved: { name: "egg", amount: "100", unit: "g" },
              fatSecretFoodId: null,
              matchedName: "Egg, whole, raw",
              confidence: 0.95,
              source: "USDA",
              macros: { calories: 80, protein: 6, carbs: 1, fat: 5 },
            },
          ],
        }),
      }) as Partial<Response>,
    );

    fireEvent.click(screen.getByTestId("photo-log-item-0-toggle"));
    fireEvent.click(screen.getByTestId("photo-log-item-0-verify"));
    await waitFor(() => {
      expect(screen.getByTestId("photo-log-item-0-verified-chip")).toBeInTheDocument();
    });

    // Now bump the calorie field — verify chip should disappear.
    const kcalInput = screen.getByLabelText(/egg calories/i) as HTMLInputElement;
    fireEvent.change(kcalInput, { target: { value: "120" } });

    // After the edit, the verified chip is gone, AI chip is back.
    expect(screen.queryByTestId("photo-log-item-0-verified-chip")).not.toBeInTheDocument();
    expect(screen.getByTestId("photo-log-item-0-ai-chip")).toBeInTheDocument();
    restore();
  });
});
