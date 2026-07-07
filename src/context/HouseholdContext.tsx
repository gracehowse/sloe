import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabase/browserClient.ts";
import { useAuthSession } from "./AuthSessionContext.tsx";
import { getMyHousehold } from "../lib/household/householdClient.ts";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface HouseholdContextValue {
  /**
   * Honeydew parity (2026-04-30): the user's active household id, or
   * null when solo. Surfaced so the ShoppingList component can render
   * the "Shared with Sarah & Tom" banner + per-row attribution chips
   * without re-fetching `getMyHousehold` itself.
   */
  activeHouseholdId: string | null;
  /** ENG-849 — member count for household-aware decorative copy on Today. */
  householdMemberCount: number;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * ENG-1364 (phase 2) — household split out of the `AppDataContext` monolith.
 * This is the cleanest of the phase-1 domains: it has no incoming
 * dependencies from any other domain (its only outgoing use is feeding
 * `activeHouseholdId` into the shopping-list scope calculation, which reads
 * this context rather than the other way around), and it is NOT part of the
 * `usePersistLocalAppSnapshot` local-storage blob — it is purely
 * server-derived. That made it the first domain moved, ahead of the more
 * deeply cross-referenced meal-plan / journal / hydration state that remains
 * in `AppDataContext` for now.
 *
 * Behaviour is unchanged from the original `AppDataProvider` inline effect:
 * resolve the user's active household once on auth, and re-resolve after a
 * join/leave (best-effort — the `HouseholdSettingsPage` hard-reloads on those
 * flows so the next mount picks up the new id).
 */
export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { authedUserId } = useAuthSession();
  const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(null);
  const [householdMemberCount, setHouseholdMemberCount] = useState(1);

  useEffect(() => {
    if (!authedUserId) {
      setActiveHouseholdId(null);
      setHouseholdMemberCount(1);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await getMyHousehold(
          supabase as unknown as {
            from: (t: string) => unknown;
            rpc: (f: string, p: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
          },
          authedUserId,
        );
        if (!cancelled) {
          const hh = (data as { household?: { id?: string } | null; members?: unknown[] } | null)
            ?.household;
          setActiveHouseholdId(hh?.id ?? null);
          const memberLen = (data as { members?: unknown[] } | null)?.members?.length ?? 0;
          setHouseholdMemberCount(memberLen > 0 ? memberLen : 1);
        }
      } catch {
        if (!cancelled) {
          setActiveHouseholdId(null);
          setHouseholdMemberCount(1);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedUserId]);

  const value = useMemo(
    (): HouseholdContextValue => ({ activeHouseholdId, householdMemberCount }),
    [activeHouseholdId, householdMemberCount],
  );

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useHousehold(): HouseholdContextValue {
  const ctx = useContext(HouseholdContext);
  if (!ctx) {
    throw new Error("useHousehold must be used within HouseholdProvider");
  }
  return ctx;
}
