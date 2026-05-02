/**
 * Cook handsfree listener (v2, 2026-05-02) — on-device speech
 * recognition wired against `expo-speech-recognition`.
 *
 * Architecture (from `docs/decisions/2026-05-01-cook-voice-handsfree.md`):
 *   - Option A: on-device recognition only. We pass
 *     `requiresOnDeviceRecognition: true` to the underlying module so
 *     the iOS Speech framework refuses to fall back to network-routed
 *     recognition. If the device cannot do on-device recognition the
 *     start call fails — the toggle is disabled upstream.
 *   - Zero-retention: `recordingOptions` is NOT set, so audio is never
 *     persisted to disk. Transcripts live only in the JS event handler
 *     and the matched-command emit. Nothing is stored or transmitted.
 *   - English-only at launch (`en-US`). Other locales are deferred
 *     because the keyword vocabulary in `cookHandsfree.matchHandsfreeCommand`
 *     is English. Adding `es-ES` etc. without translating the vocab
 *     would silently break for non-English users.
 *
 * Surface area exposed to `cook.tsx`:
 *   - `startCookHandsfreeListener({ onCommand, onError })` returns a
 *     `stop()` function. Callers must invoke it on unmount, screen
 *     blur, toggle-off, and isDone — the contract is "stops within
 *     200ms of the request" (per legal review).
 *   - `isOnDeviceRecognitionSupported()` — synchronous capability
 *     check. Used to decide whether to render the toggle as disabled
 *     with a "not supported on this device" tooltip.
 *
 * The module is intentionally written so it can be imported on web
 * without crashing — the dynamic `require()` returns `null` if the
 * native module is unavailable (e.g. web bundle, jest/vitest test
 * environment). Callers must check the return type and fall back to
 * the manual nav buttons when the listener is null.
 */

import { matchHandsfreeCommand, type HandsfreeCommand } from "./cookHandsfree";
import * as SpeechRecognitionModule from "expo-speech-recognition";

/** Subset of the `expo-speech-recognition` surface we depend on.
 *  Re-declared here so this module doesn't fail typecheck if the
 *  package is absent on a future bundler config. */
type SpeechModule = {
  start(options: {
    lang?: string;
    interimResults?: boolean;
    continuous?: boolean;
    requiresOnDeviceRecognition?: boolean;
    maxAlternatives?: number;
  }): void;
  stop(): void;
  abort(): void;
  addListener?: (
    eventName: string,
    listener: (event: unknown) => void,
  ) => { remove(): void };
};

type SpeechApi = {
  ExpoSpeechRecognitionModule: SpeechModule;
  supportsOnDeviceRecognition?: () => boolean;
  isRecognitionAvailable?: () => boolean;
  addSpeechRecognitionListener: (
    eventName: string,
    listener: (event: unknown) => void,
  ) => { remove(): void };
};

/** Resolve the native module. Returns null on any failure
 *  (missing native side, web bundle, test environment without
 *  `vi.mock`).
 *
 *  We import the module statically up top so `vi.mock` from the
 *  test suite intercepts it cleanly. The module is wrapped here in
 *  a function so callers don't capture a reference at module-eval
 *  time — that lets the test suite's per-test mock state flow
 *  through every call. */
function loadSpeechApi(): SpeechApi | null {
  try {
    const mod = SpeechRecognitionModule as unknown as Partial<SpeechApi>;
    if (!mod || !mod.ExpoSpeechRecognitionModule) return null;
    return mod as SpeechApi;
  } catch {
    return null;
  }
}

/**
 * Synchronous capability check. Returns `true` only if the host
 * device exposes on-device speech recognition AND recognition is
 * available at all. The cook-screen toggle reads this on mount and
 * disables itself with a "Voice control isn't supported on this
 * device." tooltip when it returns false.
 *
 * Catches every error path so a misconfigured device never throws
 * out of the synchronous render — voice is a nice-to-have, not the
 * critical-path.
 */
export function isOnDeviceRecognitionSupported(): boolean {
  const api = loadSpeechApi();
  if (!api) return false;
  try {
    if (
      typeof api.isRecognitionAvailable === "function" &&
      !api.isRecognitionAvailable()
    ) {
      return false;
    }
    if (typeof api.supportsOnDeviceRecognition === "function") {
      return api.supportsOnDeviceRecognition() === true;
    }
    // If the module is loaded but doesn't expose the capability check,
    // we err on the safe side and report unsupported — better to hide
    // the toggle than to start the listener and have it fail.
    return false;
  } catch {
    return false;
  }
}

/**
 * Permission request — defers to the speech-recognition module's
 * own request flow, which presents the iOS combined Speech-Recognition
 * + Microphone consent dialogs. Returns `true` if the user granted
 * (or had previously granted) both permissions, `false` otherwise.
 *
 * Caller responsibility: only call this AFTER the user has tapped the
 * "Turn on voice control" button in `CookHandsfreeConsentSheet.tsx`.
 * Calling it eagerly would surface the iOS prompt without the
 * pre-permission explainer, which the legal review flagged as a P1
 * fail. */
export async function requestHandsfreePermissions(): Promise<boolean> {
  const api = loadSpeechApi();
  if (!api) return false;
  try {
    const mod = api.ExpoSpeechRecognitionModule as unknown as {
      requestPermissionsAsync?: () => Promise<{ granted: boolean }>;
    };
    if (typeof mod.requestPermissionsAsync !== "function") return false;
    const result = await mod.requestPermissionsAsync();
    return Boolean(result?.granted);
  } catch {
    return false;
  }
}

/** Listener handle returned by `startCookHandsfreeListener`. */
export type HandsfreeListener = {
  /** Stop the listener. Idempotent. Resolves when the underlying
   *  module has acknowledged the stop. The cook screen requires
   *  this to settle within 200ms — meet that by calling
   *  `module.stop()` synchronously and not awaiting any tear-down. */
  stop(): void;
};

export type StartListenerOptions = {
  /** Fires with the canonical command on every recognised match. */
  onCommand: (command: HandsfreeCommand, transcript: string) => void;
  /** Fires when an error occurs (recognition failure, permission
   *  revoked mid-session, hardware unavailable). The cook screen
   *  uses this to render the error-tinted mic state. */
  onError?: (code: string, message: string) => void;
  /** Fires when the listener has fully started — used by the cook
   *  screen to flip the mic icon to its "listening" state without
   *  jumping to it on an optimistic toggle. */
  onStart?: () => void;
  /** Fires on every unmatched final transcript. The cook screen
   *  uses this to drive the soft-cap miss counter. */
  onMiss?: (transcript: string) => void;
};

/**
 * Start the listener. Returns a stop handle. If the native module is
 * unavailable (web, tests, missing dep), returns null and `onError`
 * is called synchronously with `"unsupported"` — callers should
 * surface a graceful "voice not available" UX rather than crash.
 *
 * The continuous / interim-results combination is deliberate:
 *   - `continuous: true` keeps the listener alive across short
 *     pauses so the user doesn't have to re-tap the mic between
 *     steps. (Without it the iOS Speech framework auto-stops
 *     after ~1s of silence and we'd burn the consent UX on every
 *     step transition.)
 *   - `interimResults: false` because we only want to act on the
 *     final transcript. Acting on interim results would advance
 *     steps mid-utterance ("next time" → "next" — false positive).
 *   - `requiresOnDeviceRecognition: true` is the privacy claim. Do
 *     not relax this without re-reading the decision doc.
 */
export function startCookHandsfreeListener(
  options: StartListenerOptions,
): HandsfreeListener | null {
  const api = loadSpeechApi();
  if (!api) {
    options.onError?.("unsupported", "Speech recognition is not available.");
    return null;
  }

  const subs: { remove(): void }[] = [];

  try {
    // Result event — fires when the recogniser produces a final
    // transcript. We pull the most-confident transcript, run it
    // through the keyword matcher, and emit either `onCommand` or
    // `onMiss`.
    const resultSub = api.addSpeechRecognitionListener(
      "result",
      (event: unknown) => {
        const e = event as {
          isFinal?: boolean;
          results?: Array<{ transcript?: string }>;
        };
        if (!e || e.isFinal === false) return;
        const transcript =
          e.results?.[0]?.transcript?.trim() ?? "";
        if (!transcript) return;
        const command = matchHandsfreeCommand(transcript);
        if (command) {
          options.onCommand(command, transcript);
        } else {
          options.onMiss?.(transcript);
        }
      },
    );
    subs.push(resultSub);

    const errorSub = api.addSpeechRecognitionListener(
      "error",
      (event: unknown) => {
        const e = event as { error?: string; message?: string };
        options.onError?.(e?.error ?? "unknown", e?.message ?? "");
      },
    );
    subs.push(errorSub);

    if (options.onStart) {
      const startSub = api.addSpeechRecognitionListener(
        "start",
        () => {
          options.onStart?.();
        },
      );
      subs.push(startSub);
    }

    api.ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: false,
      continuous: true,
      requiresOnDeviceRecognition: true,
      maxAlternatives: 1,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    options.onError?.("start_failed", message);
    subs.forEach((s) => {
      try {
        s.remove();
      } catch {
        /* listener already removed */
      }
    });
    return null;
  }

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try {
      api.ExpoSpeechRecognitionModule.stop();
    } catch {
      /* module may already have torn down */
    }
    subs.forEach((s) => {
      try {
        s.remove();
      } catch {
        /* listener already removed */
      }
    });
  };

  return { stop };
}
