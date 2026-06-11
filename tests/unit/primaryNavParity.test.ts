import { describe, expect, it } from "vitest";

import { orderedPrimaryItems } from "../../src/app/components/suppr/desktop-sidebar";
import {
  PRIMARY_NAV_CANONICAL,
  PRIMARY_NAV_ORDER,
  canonicalNavOrderEnabled,
} from "../../src/lib/navigation/primaryNav";

describe("primaryNav parity (ENG-1017 / ENG-1044)", () => {
  it("defines the canonical Today · Plan · Recipes · Progress order", () => {
    expect(PRIMARY_NAV_ORDER).toEqual(["today", "plan", "recipes", "progress"]);
    expect(PRIMARY_NAV_CANONICAL.map((item) => item.view)).toEqual(PRIMARY_NAV_ORDER);
  });

  it("defaults web to canonical order while PostHog is loading", () => {
    expect(canonicalNavOrderEnabled(undefined)).toBe(true);
    expect(canonicalNavOrderEnabled(true)).toBe(true);
    expect(canonicalNavOrderEnabled(false)).toBe(false);
  });

  it("orders the desktop sidebar Plan-first by default", () => {
    const labels = orderedPrimaryItems(true).map((item) => item.label);
    expect(labels).toEqual(["Today", "Plan", "Recipes", "Progress"]);
  });

  it("keeps legacy Recipes-first order behind an explicit flag rollback", () => {
    const labels = orderedPrimaryItems(false).map((item) => item.label);
    expect(labels).toEqual(["Today", "Recipes", "Plan", "Progress"]);
  });
});
