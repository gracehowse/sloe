/**
 * routeImport (ENG-1225 #3) — the unified Import entry routes each classified
 * kind to the existing flow it belongs in (or returns a hint when there's no
 * destination yet). Pins the routing so the single front door can't mis-route.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { classifyImport } from "../../../../src/lib/recipe-import/classifyImport";
import { consumePendingImportText } from "@suppr/shared/recipe-import/pendingImportText";
import { routeImport } from "../../lib/importRouting";

function router() {
  return { push: vi.fn() };
}

// The pending-import store is a module singleton — clear it between cases.
beforeEach(() => {
  consumePendingImportText();
});

describe("routeImport", () => {
  it("a social/recipe URL → /import-shared with the url", () => {
    const r = router();
    const raw = "https://www.instagram.com/reel/Cabc/";
    const res = routeImport(classifyImport(raw), raw, r);
    expect(res.routed).toBe(true);
    expect(r.push).toHaveBeenCalledWith({
      pathname: "/import-shared",
      params: { url: "https://www.instagram.com/reel/Cabc/" },
    });
  });

  it("recipe text → /create-recipe?autoPaste=1", () => {
    const r = router();
    const raw = "Tahini bowl\n2 tbsp tahini\n1 can chickpeas";
    expect(routeImport(classifyImport(raw), raw, r).routed).toBe(true);
    expect(r.push).toHaveBeenCalledWith("/create-recipe?autoPaste=1");
  });

  it("a meal plan → /plan-import", () => {
    const r = router();
    const raw = "Monday\nBreakfast: eggs\nLunch: salad\nTuesday\nDinner: salmon";
    expect(routeImport(classifyImport(raw), raw, r).routed).toBe(true);
    expect(r.push).toHaveBeenCalledWith("/plan-import");
  });

  it("a CSV → no nav, returns a Settings hint (MFP flow lives there, #7)", () => {
    const r = router();
    const raw = "Date,Meal,Calories,Protein\n2026-06-20,Breakfast,320,12\n2026-06-20,Lunch,440,38";
    const res = routeImport(classifyImport(raw), raw, r);
    expect(res.routed).toBe(false);
    expect(res.hint).toContain("Settings");
    expect(r.push).not.toHaveBeenCalled();
  });

  it("empty → no nav, no hint", () => {
    const r = router();
    expect(routeImport(classifyImport("  "), "  ", r)).toEqual({ routed: false });
    expect(r.push).not.toHaveBeenCalled();
  });
});

describe("routeImport text threading (ENG-1225 #3)", () => {
  it("recipe text is stashed for the create paste modal to consume", () => {
    const raw = "Tahini bowl\n2 tbsp tahini\n1 can chickpeas";
    routeImport(classifyImport(raw), raw, router());
    expect(consumePendingImportText()).toBe(raw);
    expect(consumePendingImportText()).toBeNull();
  });

  it("plan text is stashed for the plan-import paste step to consume", () => {
    const raw = "Monday\nBreakfast: eggs\nLunch: salad\nTuesday\nDinner: salmon";
    routeImport(classifyImport(raw), raw, router());
    expect(consumePendingImportText()).toBe(raw);
    expect(consumePendingImportText()).toBeNull();
  });

  it("a URL/social route does NOT stash recipe text", () => {
    const raw = "https://www.instagram.com/reel/Cabc/";
    routeImport(classifyImport(raw), raw, router());
    expect(consumePendingImportText()).toBeNull();
  });
});
