/**
 * ENG-1323 — mobile-web content must be able to scroll CLEAR of the fixed
 * bottom tab bar + the raised centre Log button (the FAB).
 *
 * Split from ENG-1291: at 390px the fixed bottom nav's raised Plus
 * (horizontally centered, `relative -top-4` so it projects 16px above the bar
 * line) transiently overlays the centered Carbs macro dial. The old `pb-20`
 * (static 80px) reservation ignored `env(safe-area-inset-bottom)` — the nav
 * pads itself with the inset, so on a notched device the total overlay
 * (~57px bar + inset + 16px FAB projection ≈ 107px) exceeded the reservation
 * and content could REST under the FAB at scroll bottom.
 *
 * Pins (source-level, same pattern as calorieRingSolidGreenAtTarget.test.ts):
 *   1. the <main> scroll reservation is safe-area-aware and shares the
 *      `mobileWebBottomChrome` inset contract (5rem nav + optional consent
 *      strip + safe-area), not a static pb-20;
 *   2. a matching `scroll-pb-[…]` keeps programmatic scrolls
 *      (scrollIntoView / anchor jumps) from LANDING content under the FAB;
 *   3. desktop (md+) resets both — the bottom nav does not render there.
 *
 * Honest residual (deliberate, not a gap): content still passes under the
 * fixed centered FAB mid-scroll — inherent to any fixed overlay. The
 * structural alternative (frosted-pill tab bar family) is judged in the
 * ENG-1317 deep design pass.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const APP_SRC = readFileSync(
  resolve(__dirname, "../../src/app/App.tsx"),
  "utf8",
);

describe("mobile-web main scroll clears the fixed tab bar + raised FAB (ENG-1323)", () => {
  it("reserves safe-area-aware bottom padding for the full nav + FAB overlay", () => {
    expect(APP_SRC).toContain("MOBILE_WEB_BOTTOM_NAV_SCROLL_PADDING");
    expect(APP_SRC).toContain("mobileWebBottomChrome.ts");
    // The static reservation that under-measured on notched devices is gone.
    expect(APP_SRC).not.toMatch(/id="main-content"[^>]*pb-20/);
  });

  it("scroll-padding keeps programmatic scrolls from landing content under the FAB", () => {
    expect(APP_SRC).toContain("MOBILE_WEB_BOTTOM_NAV_SCROLL_PADDING_BOTTOM");
  });

  it("desktop (md+) resets the reservation — no bottom nav renders there", () => {
    expect(APP_SRC).toMatch(/md:pb-0/);
    expect(APP_SRC).toMatch(/md:scroll-pb-0/);
  });
});
