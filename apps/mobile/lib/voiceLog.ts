/**
 * Voice logging — on-device speech-to-text via `expo-speech-recognition`.
 *
 * 2026-05-08 hotfix (build 47 follow-up): the previous implementation
 * called `mod.startAsync(...)` / `mod.stopAsync()` / `require("expo-
 * speech-recognition")` as a default export — none of those exist on
 * this package. The package's actual API:
 *
 *   import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
 *   ExpoSpeechRecognitionModule.requestPermissionsAsync()
 *   ExpoSpeechRecognitionModule.start({ lang, ... })
 *   ExpoSpeechRecognitionModule.stop()
 *   ExpoSpeechRecognitionModule.addListener("result"|"end"|"error", cb)
 *
 * Event names follow the W3C Web Speech API: `result` (with `{isFinal,
 * results: [{transcript, confidence}]}` payload), `end`, `error`.
 *
 * Falls back to a typing-only experience if the native module isn't
 * present (Expo Go / web preview). The press-and-hold mic UI in
 * VoiceLogSheet treats `isSpeechAvailable() === false` as "typing only".
 */

import { Platform } from "react-native";

export const VOICE_LOG_NATIVE_BUILD_HINT =
  "Expo Go: type here. For spoken dictation, use a dev build with expo-speech-recognition (EAS).";

// Loose subset of the package's API we depend on.
type SpeechModule = {
  requestPermissionsAsync: () => Promise<{ granted: boolean; status?: string }>;
  start: (opts: Record<string, unknown>) => void;
  stop: () => void;
  abort?: () => void;
  addListener: (
    event: string,
    cb: (data: unknown) => void,
  ) => { remove: () => void };
};

let cached: SpeechModule | null = null;

function getSpeechModule(): SpeechModule | null {
  if (cached) return cached;
  try {
    // The package exports `ExpoSpeechRecognitionModule` as a NAMED
    // export, not a default. The previous wrapper grabbed the whole
    // namespace and called `.startAsync` which doesn't exist.
    const mod = require("expo-speech-recognition") as {
      ExpoSpeechRecognitionModule?: SpeechModule;
    };
    if (mod && mod.ExpoSpeechRecognitionModule) {
      cached = mod.ExpoSpeechRecognitionModule;
      return cached;
    }
    return null;
  } catch {
    return null;
  }
}

export function isSpeechAvailable(): boolean {
  return getSpeechModule() !== null;
}

export async function requestSpeechPermission(): Promise<boolean> {
  const mod = getSpeechModule();
  if (!mod) return false;
  try {
    const res = await mod.requestPermissionsAsync();
    return Boolean(res?.granted);
  } catch {
    return false;
  }
}

/**
 * Start a recognition session. Resolves with the final transcript when
 * the user stops speaking, when stop() is called externally, or when
 * `maxDurationMs` elapses.
 *
 * Rejects if the native module isn't available, permission is denied,
 * or the recognition errors before producing any transcript.
 */
export function listenForSpeech(opts?: {
  locale?: string;
  maxDurationMs?: number;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const mod = getSpeechModule();
    if (!mod) {
      reject(
        new Error(
          "Speech recognition not available. Requires a native build with expo-speech-recognition.",
        ),
      );
      return;
    }

    let transcript = "";
    let resolved = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timeoutHandle != null) clearTimeout(timeoutHandle);
      try {
        resultSub.remove();
      } catch {
        /* noop */
      }
      try {
        endSub.remove();
      } catch {
        /* noop */
      }
      try {
        errorSub.remove();
      } catch {
        /* noop */
      }
    };

    const settle = (kind: "ok" | "err", payload: string | Error) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      try {
        mod.stop();
      } catch {
        /* noop — recognition may have already ended */
      }
      if (kind === "ok") resolve(payload as string);
      else reject(payload as Error);
    };

    const resultSub = mod.addListener("result", (data: unknown) => {
      const ev = data as {
        isFinal?: boolean;
        results?: Array<{ transcript?: string }>;
      };
      const newest = ev?.results?.[0]?.transcript;
      if (typeof newest === "string" && newest.length > 0) {
        transcript = newest;
      }
      if (ev?.isFinal) {
        settle("ok", transcript);
      }
    });

    // `end` fires when iOS hits its silence timeout or the user calls
    // stop(). We resolve with whatever transcript we accumulated so
    // press-and-release feels like "release to commit".
    const endSub = mod.addListener("end", () => {
      settle("ok", transcript);
    });

    const errorSub = mod.addListener("error", (data: unknown) => {
      const ev = data as { error?: string; message?: string };
      const msg = ev?.message ?? ev?.error ?? "Speech recognition error";
      // If we already have a transcript, prefer that over erroring.
      if (transcript) settle("ok", transcript);
      else settle("err", new Error(msg));
    });

    if (opts?.maxDurationMs) {
      timeoutHandle = setTimeout(() => {
        settle("ok", transcript);
      }, opts.maxDurationMs);
    }

    try {
      mod.start({
        lang: opts?.locale ?? (Platform.OS === "ios" ? "en-US" : undefined),
        // Web Speech defaults: not continuous, interim results on so we
        // get partial transcripts for live UI feedback.
        continuous: false,
        interimResults: true,
        maxAlternatives: 1,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to start speech recognition";
      settle("err", new Error(msg));
    }
  });
}
