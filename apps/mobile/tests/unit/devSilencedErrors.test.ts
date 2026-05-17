import { describe, expect, it } from "vitest";

import {
  DEV_SILENCED_ERROR_PATTERNS,
  matchesSilencedDevError,
} from "@/lib/devSilencedErrors";

describe("matchesSilencedDevError", () => {
  it("matches the keychain entitlement failure that fires on unsigned dev sim builds", () => {
    // Verbatim message captured in sim 2026-05-17. The wrapping varies
    // (sometimes prefixed by "Possible Unhandled Promise Rejection", sometimes
    // a bare Error.message); the patterns are unanchored so both forms match.
    const verbatim =
      "Calling the 'getRegistrationInfoAsync' function has failed → Caused by: Keychain access failed: A required entitlement isn't present.";
    expect(matchesSilencedDevError(verbatim)).toBe(true);

    const wrapped = `Possible Unhandled Promise Rejection (id: 0): Error: ${verbatim}`;
    expect(matchesSilencedDevError(wrapped)).toBe(true);

    // Also matches when handed an Error object (ExceptionsManager path).
    expect(matchesSilencedDevError(new Error(verbatim))).toBe(true);
  });

  it("still matches the original PostHog flush patterns (no regression)", () => {
    expect(matchesSilencedDevError("Error while flushing PostHog")).toBe(true);
    expect(matchesSilencedDevError("PostHogFetchNetworkError: timeout")).toBe(
      true,
    );
    expect(
      matchesSilencedDevError(new Error("PostHogFetchNetworkError: foo")),
    ).toBe(true);
  });

  it("matches network-flake fallbacks carried over from the legacy LogBox list", () => {
    expect(
      matchesSilencedDevError(
        "[expo-notifications] Error thrown while updating the device push token",
      ),
    ).toBe(true);
    expect(
      matchesSilencedDevError(
        "[expoPushToken] Network request failed: getaddrinfo",
      ),
    ).toBe(true);
    expect(
      matchesSilencedDevError("[tzSync] profiles.tz_iana update failed"),
    ).toBe(true);
  });

  it("does NOT swallow unrelated errors", () => {
    expect(matchesSilencedDevError("Cannot read property 'foo' of undefined")).toBe(
      false,
    );
    expect(matchesSilencedDevError("Some random user-visible bug")).toBe(false);
    expect(matchesSilencedDevError(new Error("Real crash to surface"))).toBe(false);
  });

  it("returns false for null / undefined / non-stringifiable junk", () => {
    expect(matchesSilencedDevError(null)).toBe(false);
    expect(matchesSilencedDevError(undefined)).toBe(false);
    expect(matchesSilencedDevError({})).toBe(false);
  });

  it("exports the patterns array so LogBox.ignoreLogs can spread it (single source of truth)", () => {
    expect(Array.isArray(DEV_SILENCED_ERROR_PATTERNS)).toBe(true);
    expect(DEV_SILENCED_ERROR_PATTERNS.length).toBeGreaterThan(0);
    expect(DEV_SILENCED_ERROR_PATTERNS.every((p) => p instanceof RegExp)).toBe(
      true,
    );
  });
});
