/**
 * ENG-806 (Redesign — Design Direction 2026) — `/planner` must collapse to the
 * single canonical web plan route `/plan`.
 *
 * Before: `/planner` was a separate stub that dead-ended to a "your plan lives
 * in the iOS app — get the app" wall, while `/plan` rendered the real, working
 * web plan. Two URLs for one surface, one of them a dead end.
 *
 * After: `/planner` permanently redirects (308) to `/plan`. This test pins the
 * route so the dead-end wall can't quietly come back and so the redirect target
 * can't drift away from `/plan`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const PLANNER_PAGE_PATH = resolve(__dirname, "../../app/planner/page.tsx");
const SRC = readFileSync(PLANNER_PAGE_PATH, "utf8");

describe("/planner route (ENG-806)", () => {
  it("permanently redirects to /plan", async () => {
    const permanentRedirect = vi.fn((url: string) => {
      throw new Error(`__redirect__:${url}`);
    });
    vi.doMock("next/navigation", () => ({ permanentRedirect }));

    const mod = await import("../../app/planner/page.tsx");
    // Next's redirect helpers throw to halt rendering; mirror that here.
    expect(() => mod.default()).toThrow("__redirect__:/plan");
    expect(permanentRedirect).toHaveBeenCalledWith("/plan");

    vi.doUnmock("next/navigation");
    vi.resetModules();
  });

  it("no longer renders the 'get the app' dead-end wall", () => {
    // The old stub's CTA testids + copy must be gone — a regression that
    // re-introduces the wall (instead of the redirect) would re-add them.
    expect(SRC).not.toContain("planner-stub-get-app");
    expect(SRC).not.toContain("Your meal plan lives in the iOS app");
    expect(SRC).not.toContain('APP_STORE_URL = "#"');
  });

  it("uses permanentRedirect (308), not a soft client link", () => {
    expect(SRC).toContain("permanentRedirect");
    expect(SRC).toContain('permanentRedirect("/plan")');
  });
});
