import { useCallback, useState } from "react";

import { getHealthSyncStatusForDebug } from "@/lib/healthSync";

export type HealthSyncDebugStatus = ReturnType<
  typeof getHealthSyncStatusForDebug
>;

/**
 * Debug-only snapshot hook for ENG-1023 HealthKit hang investigations.
 * It is intentionally pull-based: production UI should not poll this, but Grace
 * can refresh a debug surface after reproducing a native bridge hang and inspect
 * queue depth, recent bridge calls, and the last error breadcrumb.
 */
export function useHealthSyncStatus(): {
  status: HealthSyncDebugStatus;
  refresh: () => void;
} {
  const [status, setStatus] = useState<HealthSyncDebugStatus>(() =>
    getHealthSyncStatusForDebug(),
  );
  const refresh = useCallback(() => {
    setStatus(getHealthSyncStatusForDebug());
  }, []);
  return { status, refresh };
}
