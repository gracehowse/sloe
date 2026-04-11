import { NativeModules, Platform } from "react-native";

type ExpoClipboardNative = {
  getStringAsync?: (options?: Record<string, unknown>) => Promise<string>;
};

/** Optional Turbo path when `NativeModules.ExpoClipboard` is empty (some bridgeless setups). */
let turboModuleGet: (<T>(name: string) => T | null) | undefined;
try {
  turboModuleGet = require("react-native/Libraries/TurboModule/TurboModuleRegistry")
    .get as <T>(name: string) => T | null;
} catch {
  turboModuleGet = undefined;
}

function getClipboardNative(): ExpoClipboardNative | undefined {
  const fromNm = NativeModules.ExpoClipboard as ExpoClipboardNative | undefined;
  if (fromNm?.getStringAsync) {
    return fromNm;
  }
  const get = turboModuleGet;
  if (get) {
    const fromTurbo = get<ExpoClipboardNative>("ExpoClipboard");
    if (fromTurbo?.getStringAsync) {
      return fromTurbo;
    }
  }
  return undefined;
}

/**
 * Read clipboard without importing `expo-clipboard`. That package calls `requireNativeModule` at load
 * time and crashes when the dev client binary does not include `ExpoClipboard`.
 */
export async function safeGetClipboardString(): Promise<string> {
  if (Platform.OS === "web") {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        return await navigator.clipboard.readText();
      }
    } catch {
      /* permission denied or unsupported */
    }
    return "";
  }

  const native = getClipboardNative();
  if (!native?.getStringAsync) {
    return "";
  }

  try {
    return await native.getStringAsync({});
  } catch {
    return "";
  }
}
