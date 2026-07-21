import { describe, expect, it } from "vitest";
import {
  isMobileWebProductRoute,
  MOBILE_WEB_BOTTOM_NAV_INSET,
  MOBILE_WEB_CONSENT_DOCK_BOTTOM,
} from "@/lib/layout/mobileWebBottomChrome";

describe("mobileWebBottomChrome — shared inset contract (ENG-1386)", () => {
  it("reserves 5rem for the tab bar + raised FAB overlay (ENG-1323)", () => {
    expect(MOBILE_WEB_BOTTOM_NAV_INSET).toBe("5rem");
  });

  it("docks the consent strip above the nav inset", () => {
    expect(MOBILE_WEB_CONSENT_DOCK_BOTTOM).toContain("5rem");
    expect(MOBILE_WEB_CONSENT_DOCK_BOTTOM).toContain("safe-area-inset-bottom");
  });

  it("treats canonical authed product routes as product surfaces", () => {
    for (const path of ["/today", "/progress", "/discover", "/create", "/home"]) {
      expect(isMobileWebProductRoute(path)).toBe(true);
    }
  });

  it("treats marketing routes as non-product surfaces", () => {
    for (const path of ["/", "/pricing", "/privacy", "/login"]) {
      expect(isMobileWebProductRoute(path)).toBe(false);
    }
  });
});
