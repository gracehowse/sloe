/**
 * ENG-1038 / P1-3 — graceful-degradation notice on the web FoodSearchPanel.
 *
 * When a keyed vendor's account-wide quota is exhausted, its
 * `/api/{vendor}/search` route returns `{ ok: true, hits: [], degraded: true,
 * degradedReason: "quota_exhausted" }`. The panel must render an honest
 * "showing saved results" notice rather than a silent blank. This is the most
 * likely day-one support fire (a TikTok landing exhausting the shared quota),
 * so the user-visible signal is part of the contract.
 *
 * Mirrors the network-at-fetch-boundary harness in
 * `foodSearchNoResultLoop.test.tsx`.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

void React;

vi.mock("../../src/lib/analytics/track", () => ({
  track: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

vi.mock("../../src/lib/nutrition/customFoodsClient", () => ({
  listCustomFoods: vi.fn(async () => []),
  searchCustomFoods: vi.fn(async () => []),
  createCustomFood: vi.fn(),
  updateCustomFood: vi.fn(),
  deleteCustomFood: vi.fn(),
}));

vi.mock("../../src/app/components/suppr/create-custom-food-dialog", () => ({
  CreateCustomFoodDialog: () => null,
}));

/* eslint-disable import/first */
import { FoodSearchPanel } from "../../src/app/components/food-search/FoodSearchPanel";
/* eslint-enable import/first */

const SUPABASE_STUB = { from: () => ({}) } as Parameters<typeof FoodSearchPanel>[0]["supabase"];

class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [] as IntersectionObserverEntry[];
  }
  root = null;
  rootMargin = "";
  thresholds: ReadonlyArray<number> = [];
}

/**
 * Per-endpoint fetch stub: `degradedVendors` decides which vendor routes
 * return a quota-exhausted (degraded) envelope. Everything else returns a
 * clean empty so the merged list is empty and only the notice differs.
 */
function installFetch(degradedVendors: Array<"usda" | "edamam" | "fatsecret">) {
  (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async (url: string) => {
    const u = String(url);
    const isDegraded =
      degradedVendors.some((v) => u.includes(`/api/${v}/search`));
    const body = isDegraded
      ? { ok: true, hits: [], degraded: true, degradedReason: "quota_exhausted" }
      : { ok: true, hits: [], products: [] };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    NoopIntersectionObserver;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const QUERY = "xyzzqzzfood";

function Harness({ query = QUERY }: { query?: string }) {
  return (
    <FoodSearchPanel
      query={query}
      onSelect={() => {}}
      supabase={SUPABASE_STUB}
      userId="u1"
      mode="full"
    />
  );
}

async function drainDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(600);
  });
}

describe("FoodSearchPanel — graceful degradation notice (web)", () => {
  it("shows the degraded notice when a keyed vendor reports quota exhaustion", async () => {
    installFetch(["edamam"]);
    render(<Harness />);
    await drainDebounce();
    await waitFor(() => {
      expect(screen.getByTestId("food-search-degraded-notice")).toBeInTheDocument();
    });
    expect(screen.getByTestId("food-search-degraded-notice").textContent).toMatch(
      /showing saved and\s+verified results/i,
    );
  });

  it("does NOT show the notice when no vendor is degraded", async () => {
    installFetch([]);
    render(<Harness />);
    await drainDebounce();
    // Empty-state should be present (no results) but no degraded banner.
    await waitFor(() => {
      expect(screen.getByTestId("food-search-no-result-empty-state")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("food-search-degraded-notice")).not.toBeInTheDocument();
  });

  it("shows the notice when MULTIPLE vendors are exhausted", async () => {
    installFetch(["usda", "fatsecret"]);
    render(<Harness />);
    await drainDebounce();
    await waitFor(() => {
      expect(screen.getByTestId("food-search-degraded-notice")).toBeInTheDocument();
    });
  });
});
