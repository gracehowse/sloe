import { useEffect, useState } from "react";

import { getMyHousehold } from "../lib/household/householdClient";
import { supabase } from "../lib/supabase/browserClient";

const HOUSEHOLD_FETCH_TIMEOUT_MS = 18_000;
const householdFetchTimedOut = Symbol("household_banner_timeout");

/** Banner shape consumed by `PlanV3Surface`/`PlanV3WebDashboard` `household`. */
export interface HouseholdBannerData {
  members: { initial: string; isOwner: boolean }[];
  servingCount: number;
  names: string;
  mismatchEaters: number | null;
}

const firstName = (n: string): string => (n ?? "").trim().split(/\s+/)[0] || "?";

/**
 * ENG-1247 — web twin of `apps/mobile/hooks/useHouseholdBanner`. Loads the
 * caller's household into the Plan "Cooking for N · names" banner shape;
 * returns `null` for solo users (no household, or a single member) so the v3
 * Plan surface hides the banner. The legacy `<HouseholdBar>` is the v3-OFF
 * household UI; this feeds the v3-ON surface only.
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
