import { describe, it, expect } from "vitest";
import { formatInstalledBuildLabel } from "../../lib/installedBuild";

/**
 * Locks the format used in the "What's new" header so the audit fix at
 * #12 (2026-04-30) doesn't silently regress to "Build 10 (1.0.0 #10)"
 * when the next changelog entry shifts.
 */
describe("formatInstalledBuildLabel", () => {
  it("uses runtime values when both are present", () => {
    const label = formatInstalledBuildLabel(
      { appVersion: "1.0.7", buildNumber: "12" },
      { appVersion: "1.0.0", buildNumber: 11 },
    );
    expect(label).toBe("Build 12 (1.0.7 #12)");
  });

  it("falls back to the changelog entry when expo-constants returns null", () => {
    const label = formatInstalledBuildLabel(
      { appVersion: null, buildNumber: null },
      { appVersion: "1.0.0", buildNumber: 11 },
    );
    expect(label).toBe("Build 11 (1.0.0 #11)");
  });

  it("prefers the runtime build number even if the version is missing", () => {
    const label = formatInstalledBuildLabel(
      { appVersion: null, buildNumber: "13" },
      { appVersion: "1.0.0", buildNumber: 11 },
    );
    expect(label).toBe("Build 13 (1.0.0 #13)");
  });

  it("prefers the runtime version even if the build number is missing", () => {
    const label = formatInstalledBuildLabel(
      { appVersion: "1.0.7", buildNumber: null },
      { appVersion: "1.0.0", buildNumber: 11 },
    );
    expect(label).toBe("Build 11 (1.0.7 #11)");
  });
});
