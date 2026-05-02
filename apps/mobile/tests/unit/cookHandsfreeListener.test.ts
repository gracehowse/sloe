/**
 * cookHandsfreeListener — capability + start/stop contract tests
 * (v2 P0/P1 privacy, 2026-05-02).
 *
 * Pins:
 *   1. `isOnDeviceRecognitionSupported()` returns false when the
 *      native module is missing (web bundle, vitest env, package
 *      not installed). The cook screen's "device unsupported"
 *      tooltip path keys off this.
 *   2. `isOnDeviceRecognitionSupported()` returns false when
 *      `supportsOnDeviceRecognition()` reports false even though
 *      the module IS loaded. Catches a regression where we'd
 *      treat module-loaded as a green light.
 *   3. `startCookHandsfreeListener` invokes `module.start({...})`
 *      with `requiresOnDeviceRecognition: true` — the privacy
 *      claim depends on this flag never being relaxed.
 *   4. The result-event listener routes matched transcripts to
 *      `onCommand` with the canonical command, and unmatched
 *      transcripts to `onMiss` with the raw text.
 *   5. The `stop()` handle disposes the underlying listeners.
 *
 * Strategy: we mock the entire `expo-speech-recognition` module
 * via `vi.mock` so the listener helper sees a controllable fake
 * module. The fake records every call so we can assert the
 * options passed to `start()`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (event: unknown) => void;

const fakeListeners = new Map<string, Listener[]>();
const fakeStart = vi.fn();
const fakeStop = vi.fn();
const fakeAbort = vi.fn();
const fakeRequestPermissions = vi.fn(async () => ({ granted: true }));
let fakeSupports: () => boolean = () => true;
let fakeAvailable: () => boolean = () => true;
let fakeModulePresent = true;

vi.mock("expo-speech-recognition", () => ({
  ExpoSpeechRecognitionModule: {
    start: (opts: unknown) => fakeStart(opts),
    stop: () => fakeStop(),
    abort: () => fakeAbort(),
    requestPermissionsAsync: () => fakeRequestPermissions(),
  },
  supportsOnDeviceRecognition: () => fakeSupports(),
  isRecognitionAvailable: () => fakeAvailable(),
  addSpeechRecognitionListener: (eventName: string, listener: Listener) => {
    if (!fakeModulePresent) {
      throw new Error("module unavailable");
    }
    const arr = fakeListeners.get(eventName) ?? [];
    arr.push(listener);
    fakeListeners.set(eventName, arr);
    return {
      remove: () => {
        const next = fakeListeners.get(eventName)?.filter((l) => l !== listener);
        fakeListeners.set(eventName, next ?? []);
      },
    };
  },
}));

import {
  isOnDeviceRecognitionSupported,
  startCookHandsfreeListener,
} from "../../lib/cookHandsfreeListener";

function emit(eventName: string, payload: unknown): void {
  const listeners = fakeListeners.get(eventName) ?? [];
  for (const l of [...listeners]) {
    l(payload);
  }
}

describe("cookHandsfreeListener — capability check", () => {
  beforeEach(() => {
    fakeListeners.clear();
    fakeStart.mockReset();
    fakeStop.mockReset();
    fakeAbort.mockReset();
    fakeSupports = () => true;
    fakeAvailable = () => true;
    fakeModulePresent = true;
  });

  it("returns true when the module is loaded and supports on-device", () => {
    expect(isOnDeviceRecognitionSupported()).toBe(true);
  });

  it("returns false when the module is unavailable", () => {
    // Simulate "module loaded but native side missing" by making both
    // capability checks throw — that is the signal real iOS sends on
    // a device that has the JS package but no Speech-framework support
    // (e.g. older iPad on iOS 12).
    fakeSupports = () => {
      throw new Error("native missing");
    };
    fakeAvailable = () => {
      throw new Error("native missing");
    };
    expect(isOnDeviceRecognitionSupported()).toBe(false);
  });

  it("returns false when supportsOnDeviceRecognition reports false", () => {
    fakeSupports = () => false;
    // Privacy non-negotiable — even though the module is loaded, the
    // device can't run on-device recognition. We must not silently
    // fall back to network-routed recognition.
    expect(isOnDeviceRecognitionSupported()).toBe(false);
  });

  it("returns false when isRecognitionAvailable reports false", () => {
    fakeAvailable = () => false;
    expect(isOnDeviceRecognitionSupported()).toBe(false);
  });
});

describe("cookHandsfreeListener — start contract", () => {
  beforeEach(() => {
    fakeListeners.clear();
    fakeStart.mockReset();
    fakeStop.mockReset();
    fakeAbort.mockReset();
    fakeSupports = () => true;
    fakeAvailable = () => true;
    fakeModulePresent = true;
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("starts with requiresOnDeviceRecognition: true (privacy claim)", () => {
    const handle = startCookHandsfreeListener({
      onCommand: vi.fn(),
    });
    expect(handle).not.toBeNull();
    expect(fakeStart).toHaveBeenCalledTimes(1);
    const opts = fakeStart.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(opts.requiresOnDeviceRecognition).toBe(true);
    expect(opts.lang).toBe("en-US");
    expect(opts.continuous).toBe(true);
    expect(opts.interimResults).toBe(false);
  });

  it("routes matched transcripts to onCommand with the canonical command", () => {
    const onCommand = vi.fn();
    startCookHandsfreeListener({ onCommand });

    emit("result", {
      isFinal: true,
      results: [{ transcript: "next" }],
    });

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand.mock.calls[0]?.[0]).toBe("next");
    expect(onCommand.mock.calls[0]?.[1]).toBe("next");
  });

  it("matches the 'previous step' two-word synonym", () => {
    const onCommand = vi.fn();
    startCookHandsfreeListener({ onCommand });

    emit("result", {
      isFinal: true,
      results: [{ transcript: "previous step" }],
    });

    expect(onCommand).toHaveBeenCalledWith("previous", "previous step");
  });

  it("routes unmatched transcripts to onMiss without firing onCommand", () => {
    const onCommand = vi.fn();
    const onMiss = vi.fn();
    startCookHandsfreeListener({ onCommand, onMiss });

    emit("result", {
      isFinal: true,
      results: [{ transcript: "next time we cook this" }],
    });

    expect(onCommand).not.toHaveBeenCalled();
    expect(onMiss).toHaveBeenCalledWith("next time we cook this");
  });

  it("ignores interim (non-final) transcripts so partial matches don't fire", () => {
    // The cook screen only acts on final transcripts. Acting on
    // interim "next..." would advance the step on every utterance
    // mid-stream.
    const onCommand = vi.fn();
    startCookHandsfreeListener({ onCommand });

    emit("result", {
      isFinal: false,
      results: [{ transcript: "next" }],
    });

    expect(onCommand).not.toHaveBeenCalled();
  });

  it("returns a stop handle that disposes underlying listeners", () => {
    const onCommand = vi.fn();
    const handle = startCookHandsfreeListener({ onCommand });
    expect(handle).not.toBeNull();

    // Pre-stop: there should be at least the result + error
    // listeners registered.
    const beforeCount =
      (fakeListeners.get("result")?.length ?? 0) +
      (fakeListeners.get("error")?.length ?? 0);
    expect(beforeCount).toBeGreaterThan(0);

    handle?.stop();
    expect(fakeStop).toHaveBeenCalledTimes(1);

    // Post-stop: listeners should be removed (helper holds .remove
    // handles for every subscription it added).
    const afterCount =
      (fakeListeners.get("result")?.length ?? 0) +
      (fakeListeners.get("error")?.length ?? 0);
    expect(afterCount).toBe(0);

    // A subsequent post-stop result event must not fire onCommand
    // — the listener has been disposed.
    emit("result", {
      isFinal: true,
      results: [{ transcript: "next" }],
    });
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("returns null + reports an error code when the listener can't start", () => {
    // Simulate a native init failure by making the listener-add helper
    // throw — that's the signal real iOS sends on a device that's
    // had its mic permission revoked between `start()` calls.
    fakeModulePresent = false;
    const onError = vi.fn();
    const handle = startCookHandsfreeListener({
      onCommand: vi.fn(),
      onError,
    });
    expect(handle).toBeNull();
    // The exact error code is "start_failed" — set by the helper's
    // outer try/catch when the underlying module rejects the start
    // call. Either name is acceptable as long as the cook screen
    // can route it to the same "voice unavailable" UX.
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toMatch(/^(unsupported|start_failed)$/);
  });

  it("propagates native error events to onError", () => {
    const onError = vi.fn();
    startCookHandsfreeListener({
      onCommand: vi.fn(),
      onError,
    });

    emit("error", { error: "audio-capture", message: "mic blocked" });

    expect(onError).toHaveBeenCalledWith("audio-capture", "mic blocked");
  });
});
