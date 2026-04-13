/**
 * Voice logging scaffold.
 *
 * Uses expo-speech-recognition for on-device speech-to-text when available.
 * Falls back to a simple text input if the native module is missing (Expo Go).
 *
 * To enable native speech recognition:
 *   npx expo install expo-speech-recognition
 *   Then create a dev build (EAS Build).
 */

/** Shown under the voice-log sheet when users type instead of dictating. */
export const VOICE_LOG_NATIVE_BUILD_HINT =
  "Expo Go: type here. For spoken dictation, use a dev build with expo-speech-recognition (EAS).";

import { Platform } from "react-native";

type SpeechModule = {
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  startAsync: (opts?: any) => Promise<void>;
  stopAsync: () => Promise<void>;
  addListener: (event: string, cb: (data: any) => void) => { remove: () => void };
};

let ExpoSpeech: SpeechModule | null = null;

function getSpeechModule(): SpeechModule | null {
  if (ExpoSpeech) return ExpoSpeech;
  try {
    ExpoSpeech = require("expo-speech-recognition") as SpeechModule;
    return ExpoSpeech;
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
    const { granted } = await mod.requestPermissionsAsync();
    return granted;
  } catch {
    return false;
  }
}

/**
 * Start listening and resolve with the final transcript.
 * Rejects if speech recognition is unavailable or fails.
 */
export function listenForSpeech(opts?: {
  locale?: string;
  maxDurationMs?: number;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const mod = getSpeechModule();
    if (!mod) {
      reject(new Error("Speech recognition not available. Requires a native build."));
      return;
    }

    let transcript = "";
    let resolved = false;

    const resultSub = mod.addListener("result", (data: any) => {
      if (data?.results?.[0]?.transcript) {
        transcript = data.results[0].transcript;
      }
      if (data?.isFinal && !resolved) {
        resolved = true;
        resultSub.remove();
        errorSub.remove();
        resolve(transcript);
      }
    });

    const errorSub = mod.addListener("error", (err: any) => {
      if (!resolved) {
        resolved = true;
        resultSub.remove();
        errorSub.remove();
        reject(new Error(err?.message ?? "Speech recognition error"));
      }
    });

    mod.startAsync({
      locale: opts?.locale ?? (Platform.OS === "ios" ? "en-US" : undefined),
    }).catch((e: Error) => {
      if (!resolved) {
        resolved = true;
        resultSub.remove();
        errorSub.remove();
        reject(e);
      }
    });

    if (opts?.maxDurationMs) {
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resultSub.remove();
          errorSub.remove();
          mod.stopAsync().catch(() => {});
          resolve(transcript);
        }
      }, opts.maxDurationMs);
    }
  });
}
