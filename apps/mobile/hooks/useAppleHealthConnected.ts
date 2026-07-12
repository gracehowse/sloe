import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { probeHealthAccess } from "@/lib/healthSync";

/** AsyncStorage flag the `/health-sync` screen writes after a successful
 *  connect and clears on detected revocation. Kept in sync with
 *  `HEALTH_APPLE_CONNECTED_KEY` in `app/health-sync.tsx` — it is also the flag
 *  Settings reads to seed its "Connected" row. */
const HEALTH_APPLE_CONNECTED_KEY = "health_sync_apple_connected";

/**
 * ENG-1534 — real Apple Health connection state, for Today's Activity/energy
 * empty-state copy.
 *
 * Mirrors the Settings resolution (`SettingsBundleContent`) exactly so Today's
 * notion of "connected" never diverges from the row Settings shows: seed from
 * the cached connect flag, then re-probe HealthKit on focus via
 * `probeHealthAccess()` and flip to disconnected on a bridge error (user
 * revoked in iOS Settings → Privacy → Health). A read returning zero samples is
 * NOT a denial signal — only bridge errors / unavailability are — so a genuinely
 * inactive but connected user still reads as connected.
 *
 * The probe is a single 24h step read routed through the global HealthKit mutex
 * (`enqueueHk`), so it serialises safely against the focus-time body sync
 * (`useHealthSyncOnFocus`); Today never calls `initHealthKit`, so the
 * probe-during-permission-sheet crash the Health Sync screen guards against
 * cannot occur here.
 *
 * Returns `null` while the first probe is in flight so callers can avoid
 * flashing the wrong copy; `true` when connected; `false` when denied /
 * unavailable / never connected.
 */
export function useAppleHealthConnected(): boolean | null {
  const [connected, setConnected] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          const AsyncStorage = (
            await import("@react-native-async-storage/async-storage")
          ).default;
          const cached = await AsyncStorage.getItem(HEALTH_APPLE_CONNECTED_KEY);
          // Optimistic seed for connected users → no "enable" flash before the
          // authoritative probe resolves. The probe below can still flip it off.
          if (!cancelled && cached === "true") setConnected(true);
        } catch {
          // ignore — the probe below is authoritative.
        }
        const status = await probeHealthAccess();
        if (cancelled) return;
        setConnected(status === "connected");
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return connected;
}
