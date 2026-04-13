import { Platform } from "react-native";

/**
 * Subscribe to offline/online changes without crashing when the NetInfo native
 * module is missing (e.g. dev client not rebuilt after adding the dependency).
 */
export function subscribeOffline(listener: (offline: boolean) => void): () => void {
  if (Platform.OS === "web") {
    const sync = () => {
      const off = typeof navigator !== "undefined" && !navigator.onLine;
      listener(off);
    };
    sync();
    if (typeof window !== "undefined") {
      window.addEventListener("online", sync);
      window.addEventListener("offline", sync);
      return () => {
        window.removeEventListener("online", sync);
        window.removeEventListener("offline", sync);
      };
    }
    return () => {};
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native module; package throws at load if RNCNetInfo is null
    const NetInfo = require("@react-native-community/netinfo").default as {
      addEventListener: (cb: (s: { isConnected: boolean | null; isInternetReachable: boolean | null }) => void) => () => void;
      fetch: () => Promise<{ isConnected: boolean | null; isInternetReachable: boolean | null }>;
    };
    const apply = (state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => {
      listener(state.isConnected === false || state.isInternetReachable === false);
    };
    const unsub = NetInfo.addEventListener(apply);
    void NetInfo.fetch().then(apply);
    return unsub;
  } catch {
    listener(false);
    return () => {};
  }
}
