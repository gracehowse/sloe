import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import { getMyHousehold } from "@suppr/shared/household/householdClient";

const HOUSEHOLD_FETCH_TIMEOUT_MS = 18_000;
const householdFetchTimedOut = Symbol("household_banner_timeout");

/** Banner shape consumed by `PlanV3Surface.household` / `PlanHouseholdBannerV3`. */
export interface HouseholdBannerData {
  members: { initial: string; isOwner: boolean }[];
  servingCount: number;
  names: string;
  mismatchEaters: number | null;
}

const firstName = (n: string): string => (n ?? "").trim().split(/\s+/)[0] || "?";

/**
 * ENG-1247 — loads the caller's household into the Plan "Cooking for N · names"
 * banner shape. Returns `null` for solo users (no household, or a household with
 * a single member) so `PlanV3Surface` hides the banner; shared households
 * (> 1 member) render it. Mirrors `useHouseholdMemberCount`'s fetch+timeout
 * pattern (getMyHousehold races an 18s guard; failures resolve to no banner).
 */
export function useHouseholdBanner(
  userId: string | null | undefined,
): HouseholdBannerData | null {
  const [data, setData] = useState<HouseholdBannerData | null>(null);

  useEffect(() => {
    if (!userId) {
      setData(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const pack = await Promise.race([
          getMyHousehold(supabase as never, userId),
          new Promise<typeof householdFetchTimedOut>((resolve) => {
            setTimeout(() => resolve(householdFetchTimedOut), HOUSEHOLD_FETCH_TIMEOUT_MS);
          }),
        ]);
        if (cancelled || pack === householdFetchTimedOut) return;

        const members = pack.data?.members ?? [];
        // Solo (or no household) → no banner; the Plan reads as a single cook.
        if (members.length <= 1) {
          setData(null);
          return;
        }
        setData({
          members: members.map((m) => ({
            initial: firstName(m.displayName).charAt(0).toUpperCase(),
            isOwner: m.role === "owner",
          })),
          servingCount: members.length,
          names: members.map((m) => firstName(m.displayName)).join(", "),
          // Eater/serving mismatch is a future household-servings feature; the
          // banner degrades to a chevron when null.
          mismatchEaters: null,
        });
      } catch {
        if (!cancelled) setData(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return data;
}
