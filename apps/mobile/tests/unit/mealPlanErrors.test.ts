/**
 * ENG-1387 — pins the mobile handling of the `save_meal_plan`
 * free-tier day-cap rejection (42501 + message fragment). The alert
 * must fire for the tier rejection and stay silent for every other
 * failure (which log dev-only, as before).
 */
import { Alert } from "react-native";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  handlePlanPersistError,
  isFreeTierPlanCapError,
} from "@/lib/mealPlanErrors";

const CAP_ERROR = {
  code: "42501",
  message: "save_meal_plan: free tier is limited to 1-day plans (got day 3)",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isFreeTierPlanCapError", () => {
  it("matches the server's 42501 + message-fragment contract", () => {
    expect(isFreeTierPlanCapError(CAP_ERROR)).toBe(true);
  });

  it("does not match the unauthenticated 42501 (same code, different message)", () => {
    expect(
      isFreeTierPlanCapError({
        code: "42501",
        message: "save_meal_plan: not authenticated",
      }),
    ).toBe(false);
  });

  it("does not match other errors or empty input", () => {
    expect(
      isFreeTierPlanCapError({ code: "22023", message: "day must be in 1..7" }),
    ).toBe(false);
    expect(isFreeTierPlanCapError(null)).toBe(false);
    expect(isFreeTierPlanCapError(undefined)).toBe(false);
  });
});

describe("handlePlanPersistError", () => {
  it("alerts the user on the free-tier cap rejection", () => {
    const alertSpy = vi
      .spyOn(Alert, "alert")
      .mockImplementation((() => {}) as typeof Alert.alert);
    handlePlanPersistError(CAP_ERROR, "persistPlan");
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, body] = alertSpy.mock.calls[0];
    expect(title).toBe("Plan didn't sync");
    expect(body).toContain("1-day meal plans");
  });

  it("stays silent (no alert) for unrelated persist failures", () => {
    const alertSpy = vi
      .spyOn(Alert, "alert")
      .mockImplementation((() => {}) as typeof Alert.alert);
    handlePlanPersistError(
      { code: "42883", message: "function does not exist" },
      "persistPlan",
    );
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
