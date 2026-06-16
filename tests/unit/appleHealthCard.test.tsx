/**
 * AppleHealthCard (web, D4) — Progress-page card.
 *
 * Pins the seven-state behaviour defined in
 * `docs/design/apple-health-card.md` §5: loading, empty-never-synced,
 * error+retry, partial (em-dash + hint), ready, stale prefix, and
 * the imperial weight formatter. Covers the "never fabricate a zero"
 * contract via the partial assertion.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";

import { AppleHealthCard } from "../../src/app/components/suppr/apple-health-card";
import type { HealthSnapshot } from "../../src/lib/health/healthSnapshots";

const fresh: HealthSnapshot = {
  capturedAt: "2026-04-21T11:45:00Z",
  steps: 6421,
  activeEnergyKcal: 312,
  restingBurnKcal: 1604,
  weightKg: 71.4,
  source: "healthkit",
  deviceId: "dev-1",
};

const now = () => new Date("2026-04-21T12:00:00Z");

describe("AppleHealthCard (web)", () => {
  it("renders the loading skeleton before the snapshot resolves", async () => {
    let resolve!: (v: HealthSnapshot | null) => void;
    const fetchSnapshot = () => new Promise<HealthSnapshot | null>((r) => (resolve = r));
    render(<AppleHealthCard fetchSnapshot={fetchSnapshot} nowProvider={now} />);
    expect(screen.getByTestId("apple-health-card-loading")).toBeDefined();
    // Resolve to drain the effect so React 18 doesn't warn.
    await act(async () => {
      resolve(null);
    });
  });

  it("renders the empty-never-synced state when no rows exist", async () => {
    render(
      <AppleHealthCard
        fetchSnapshot={async () => null}
        nowProvider={now}
      />,
    );
    await waitFor(() => screen.getByTestId("apple-health-card-empty"));
    expect(screen.getByText(/Sync from the Sloe app/)).toBeDefined();
    expect(screen.getByRole("link", { name: /Get the app/ })).toBeDefined();
    // No rows rendered in empty state.
    expect(screen.queryByTestId("apple-health-card-rows")).toBeNull();
  });

  it("renders an error state with a retry that re-fires the fetcher", async () => {
    let callCount = 0;
    const fetchSnapshot = vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) throw new Error("net down");
      return fresh;
    });
    render(<AppleHealthCard fetchSnapshot={fetchSnapshot} nowProvider={now} />);
    const retry = await screen.findByTestId("apple-health-card-retry");
    expect(retry).toBeDefined();

    await act(async () => {
      retry.click();
    });
    await waitFor(() => screen.getByTestId("apple-health-card-rows"));
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
  });

  it("renders four rows in fixed order with no stale prefix on fresh data", async () => {
    render(<AppleHealthCard fetchSnapshot={async () => fresh} nowProvider={now} />);
    await waitFor(() => screen.getByTestId("apple-health-card-rows"));
    expect(screen.getByText("6,421")).toBeDefined();
    expect(screen.getByText("312 kcal")).toBeDefined();
    expect(screen.getByText("1,604 kcal")).toBeDefined();
    expect(screen.getByText("71.4 kg")).toBeDefined();
    // All four row testIDs are present in order.
    expect(screen.getByTestId("apple-health-row-steps")).toBeDefined();
    expect(screen.getByTestId("apple-health-row-active")).toBeDefined();
    expect(screen.getByTestId("apple-health-row-resting")).toBeDefined();
    expect(screen.getByTestId("apple-health-row-weight")).toBeDefined();
    // Fresh → no stale prefix.
    expect(screen.queryByTestId("apple-health-card-stale")).toBeNull();
  });

  it("shows em-dash + hint for missing weight and never fabricates zero", async () => {
    render(
      <AppleHealthCard
        fetchSnapshot={async () => ({ ...fresh, weightKg: null })}
        nowProvider={now}
      />,
    );
    const weightRow = await screen.findByTestId("apple-health-row-weight");
    expect(weightRow.textContent).toMatch(/—/);
    expect(weightRow.textContent).not.toMatch(/0\.0 kg/);
    expect(screen.getByText(/No weigh-in today/)).toBeDefined();
  });

  it("prefixes the footer with 'Last synced … ago' when capturedAt is > 24h old", async () => {
    const stale: HealthSnapshot = {
      ...fresh,
      capturedAt: "2026-04-19T11:00:00Z", // > 24h
    };
    render(<AppleHealthCard fetchSnapshot={async () => stale} nowProvider={now} />);
    await waitFor(() => screen.getByTestId("apple-health-card-stale"));
    expect(screen.getByTestId("apple-health-card-stale").textContent).toMatch(/Last synced 2d ago/);
  });

  it("formats weight in lb when useImperial is true", async () => {
    render(
      <AppleHealthCard
        fetchSnapshot={async () => ({ ...fresh, weightKg: 72.5 })}
        useImperial
        nowProvider={now}
      />,
    );
    await waitFor(() => screen.getByTestId("apple-health-card-rows"));
    expect(screen.getByText(/159\.8 lb/)).toBeDefined();
    expect(screen.queryByText(/72\.5 kg/)).toBeNull();
  });
});
