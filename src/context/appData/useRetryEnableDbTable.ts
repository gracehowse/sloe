import { useEffect } from "react";

const RETRY_DELAYS_MS = [2000, 5000, 15_000, 30_000] as const;

/**
 * If a Supabase table probe failed at startup, retry enabling it in the background
 * (handles schema cache lag after first deploy).
 */
export function useRetryEnableDbTable(
  authedUserId: string | null,
  enabled: boolean,
  tryEnable: () => Promise<boolean>,
): void {
  useEffect(() => {
    if (!authedUserId || enabled) return;
    let cancelled = false;
    (async () => {
      for (const delay of RETRY_DELAYS_MS) {
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, delay));
        if (cancelled) return;
        const ok = await tryEnable();
        if (ok) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedUserId, enabled, tryEnable]);
}
