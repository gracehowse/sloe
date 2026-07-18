/**
 * alertOrToast (ENG-1344 first slice) — the flag-gated Alert-vs-Toast
 * switch used by planner.tsx's 7 migrated non-blocking call sites.
 *
 * Pinned here in isolation from the (very large) planner.tsx screen:
 *   - flag OFF -> calls Alert.alert(title, message) unchanged, never calls
 *     showToast.
 *   - flag ON -> calls showToast with "Title — lowercased message", never
 *     calls Alert.alert.
 *   - the variant defaults to "info" and is passed through when given.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Alert } from "react-native";

const isFeatureEnabledMock = vi.fn((_flag: string) => false);
vi.mock("@/lib/analytics", () => ({
  isFeatureEnabled: (flag: string) => isFeatureEnabledMock(flag),
}));

import { alertOrToast } from "../../lib/alertOrToast";

describe("alertOrToast", () => {
  let alertSpy: ReturnType<typeof vi.spyOn>;
  let showToast: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    isFeatureEnabledMock.mockReset().mockReturnValue(false);
    alertSpy = vi.spyOn(Alert, "alert").mockImplementation(() => {});
    showToast = vi.fn();
  });

  it("flag OFF: calls Alert.alert(title, message) unchanged, never showToast", () => {
    alertOrToast(showToast, "No alternatives", "Save more recipes to swap.");
    expect(alertSpy).toHaveBeenCalledWith("No alternatives", "Save more recipes to swap.");
    expect(showToast).not.toHaveBeenCalled();
  });

  it("flag ON: calls showToast with 'Title — lowercased message', never Alert.alert", () => {
    isFeatureEnabledMock.mockReturnValue(true);
    alertOrToast(showToast, "No alternatives", "Save more recipes to swap.");
    expect(showToast).toHaveBeenCalledWith(
      "No alternatives — save more recipes to swap.",
      { variant: "info" },
    );
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("flag ON: defaults to the info variant when none is given", () => {
    isFeatureEnabledMock.mockReturnValue(true);
    alertOrToast(showToast, "Nothing to move", "This slot is empty.");
    expect(showToast).toHaveBeenCalledWith(
      "Nothing to move — this slot is empty.",
      { variant: "info" },
    );
  });

  it("flag ON: passes through a custom variant", () => {
    isFeatureEnabledMock.mockReturnValue(true);
    alertOrToast(showToast, "Log failed", "Could not save to tracker.", "error");
    expect(showToast).toHaveBeenCalledWith(
      "Log failed — could not save to tracker.",
      { variant: "error" },
    );
  });

  it("flag ON: only lowercases the FIRST character of the message, preserving the rest verbatim", () => {
    isFeatureEnabledMock.mockReturnValue(true);
    alertOrToast(showToast, "Log failed", "Could not save to tracker. Network error.", "error");
    expect(showToast).toHaveBeenCalledWith(
      "Log failed — could not save to tracker. Network error.",
      { variant: "error" },
    );
  });

  it("checks the plan_alert_to_toast_v1 flag specifically", () => {
    alertOrToast(showToast, "Title", "Message");
    expect(isFeatureEnabledMock).toHaveBeenCalledWith("plan_alert_to_toast_v1");
  });
});
