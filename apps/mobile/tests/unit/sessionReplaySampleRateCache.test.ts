/**
 * ENG-516 — mobile-side glue for the `session-replay-sample-rate`
 * PostHog feature flag. The shared coercion logic is unit-tested in
 * `tests/unit/sessionReplaySampleRate.test.ts` at the repo root; here
 * we cover the AsyncStorage round-trip and the PostHog-client-payload
 * read.
 *
 * The mobile vitest setup ships an in-memory `AsyncStorage` shim
 * (see `tests/shims/async-storage.ts`), so we can write through the
 * real `readCachedSampleRate` / `writeSampleRateFromClient` and assert
 * the persisted value without mocking.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  readCachedSampleRate,
  writeSampleRateFromClient,
} from "@/lib/sessionReplaySampleRateCache";

const CACHE_KEY = "suppr.posthog.session_replay_sample_rate";

beforeEach(async () => {
  await AsyncStorage.clear();
});
afterEach(async () => {
  await AsyncStorage.clear();
});

describe("readCachedSampleRate", () => {
  it("returns the default 1.0 when nothing is cached (first launch)", async () => {
    expect(await readCachedSampleRate()).toBe(1.0);
  });

  it("returns the cached value when one is present", async () => {
    await AsyncStorage.setItem(CACHE_KEY, "0.1");
    expect(await readCachedSampleRate()).toBeCloseTo(0.1);
  });

  it("returns the default when the cached value is malformed", async () => {
    await AsyncStorage.setItem(CACHE_KEY, "not-a-number");
    expect(await readCachedSampleRate()).toBe(1.0);
  });

  it("returns the default when the cached value is out of range", async () => {
    await AsyncStorage.setItem(CACHE_KEY, "1.5");
    expect(await readCachedSampleRate()).toBe(1.0);
  });

  it("accepts 0 (recording disabled) as a valid cached rate", async () => {
    await AsyncStorage.setItem(CACHE_KEY, "0");
    expect(await readCachedSampleRate()).toBe(0);
  });
});

describe("writeSampleRateFromClient", () => {
  it("persists the flag payload value to AsyncStorage", async () => {
    const client = {
      getFeatureFlagPayload: (flag: string) => {
        return flag === "session-replay-sample-rate" ? 0.1 : null;
      },
    };
    const written = await writeSampleRateFromClient(client);
    expect(written).toBeCloseTo(0.1);
    const stored = await AsyncStorage.getItem(CACHE_KEY);
    expect(stored).toBe("0.1");
  });

  it("accepts string payloads (PostHog returns JSON-stringified values)", async () => {
    const client = {
      getFeatureFlagPayload: (_flag: string) => "0.25",
    };
    const written = await writeSampleRateFromClient(client);
    expect(written).toBe(0.25);
    expect(await AsyncStorage.getItem(CACHE_KEY)).toBe("0.25");
  });

  it("does nothing when the payload is missing", async () => {
    const client = {
      getFeatureFlagPayload: (_flag: string) => undefined,
    };
    const written = await writeSampleRateFromClient(client);
    expect(written).toBeNull();
    expect(await AsyncStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it("does nothing when the payload is out of range", async () => {
    const client = {
      getFeatureFlagPayload: (_flag: string) => 1.5,
    };
    const written = await writeSampleRateFromClient(client);
    expect(written).toBeNull();
    expect(await AsyncStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it("does nothing when the client doesn't expose getFeatureFlagPayload", async () => {
    const client = {};
    const written = await writeSampleRateFromClient(client);
    expect(written).toBeNull();
    expect(await AsyncStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it("swallows getFeatureFlagPayload throws (non-fatal for the running session)", async () => {
    const client = {
      getFeatureFlagPayload: (_flag: string): unknown => {
        throw new Error("SDK shape drift");
      },
    };
    const written = await writeSampleRateFromClient(client);
    expect(written).toBeNull();
    expect(await AsyncStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it("round-trips: write a flag value, read it back as the cached rate", async () => {
    const client = {
      getFeatureFlagPayload: (_flag: string) => 0.1,
    };
    await writeSampleRateFromClient(client);
    expect(await readCachedSampleRate()).toBeCloseTo(0.1);
  });
});
