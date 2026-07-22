/**
 * ENG-1642 — `stripHomeQueryParams`, the shared one-shot-query-param eraser
 * used by both `?openLog=1` (`NutritionTracker.tsx`) and `?mealShare=<token>`
 * (`shared-meal-accept-host.tsx`) so a refresh/back can't replay the action.
 */
import { describe, expect, it, vi } from "vitest";
import { stripHomeQueryParams } from "@/lib/navigation/stripHomeQueryParams";

function router() {
  return { replace: vi.fn() };
}

describe("stripHomeQueryParams", () => {
  it("strips the given keys and leaves other params intact", () => {
    const r = router();
    stripHomeQueryParams(r, "/home", new URLSearchParams("mealShare=abc123&openLog=1"), [
      "mealShare",
    ]);
    expect(r.replace).toHaveBeenCalledWith("/home?openLog=1", { scroll: false });
  });

  it("strips multiple keys at once", () => {
    const r = router();
    stripHomeQueryParams(
      r,
      "/home",
      new URLSearchParams("mealShare=abc123&openLog=1&other=keep"),
      ["mealShare", "openLog"],
    );
    expect(r.replace).toHaveBeenCalledWith("/home?other=keep", { scroll: false });
  });

  it("navigates to the bare pathname (no '?') when no params remain", () => {
    const r = router();
    stripHomeQueryParams(r, "/home", new URLSearchParams("mealShare=abc123"), ["mealShare"]);
    expect(r.replace).toHaveBeenCalledWith("/home", { scroll: false });
  });

  it("uses the given pathname rather than hardcoding /home", () => {
    const r = router();
    stripHomeQueryParams(r, "/some/other/path", new URLSearchParams("mealShare=abc123"), [
      "mealShare",
    ]);
    expect(r.replace).toHaveBeenCalledWith("/some/other/path", { scroll: false });
  });

  it("falls back to /home for an empty pathname", () => {
    const r = router();
    stripHomeQueryParams(r, "", new URLSearchParams("mealShare=abc123&keep=1"), ["mealShare"]);
    expect(r.replace).toHaveBeenCalledWith("/home?keep=1", { scroll: false });
  });

  it("falls back to /home (bare) for an empty pathname with no params remaining", () => {
    const r = router();
    stripHomeQueryParams(r, "", new URLSearchParams("mealShare=abc123"), ["mealShare"]);
    expect(r.replace).toHaveBeenCalledWith("/home", { scroll: false });
  });

  it("always passes { scroll: false }", () => {
    const r = router();
    stripHomeQueryParams(r, "/home", new URLSearchParams("a=1"), ["mealShare"]);
    expect(r.replace).toHaveBeenCalledWith("/home?a=1", { scroll: false });
  });

  it("is a no-op key removal when the key isn't present — other params still round-trip", () => {
    const r = router();
    stripHomeQueryParams(r, "/home", new URLSearchParams("keep=1"), ["mealShare"]);
    expect(r.replace).toHaveBeenCalledWith("/home?keep=1", { scroll: false });
  });

  it("accepts anything shaped like URLSearchParams (only .toString() is used)", () => {
    const r = router();
    stripHomeQueryParams(r, "/home", { toString: () => "mealShare=abc123&openLog=1" }, [
      "mealShare",
    ]);
    expect(r.replace).toHaveBeenCalledWith("/home?openLog=1", { scroll: false });
  });
});
