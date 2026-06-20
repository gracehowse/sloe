import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import { getMyHousehold } from "@suppr/shared/household/householdClient";

const HOUSEHOLD_FETCH_TIMEOUT_MS = 18_000;
const householdFetchTimedOut = Symbol("household_member_count_timeout");

/**
 * ENG-849 — household headcount for decorative copy (Weekly insight card).
 * Solo users (no household row) resolve to 1 so the card reads
 * "Planning for you this week"; shared households use the live member count.
 */
export function useHouseholdMemberCount(userId: string | null | undefined): number {
  const [count, setCount] = useState(1);

  useEffect(() => {
    if (!userId) {
      setCount(1);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const pack = await Promise.race([
          getMyHousehold(supabase as any, userId),
          new Promise<typeof householdFetchTimedOut>((resolve) => {
            setTimeout(() => resolve(householdFetchTimedOut), HOUSEHOLD_FETCH_TIMEOUT_MS);
          }),
        ]);
        if (cancelled || pack === householdFetchTimedOut) return;

        const { data } = pack;
        const memberLen = data?.members?.length ?? 0;
        setCount(memberLen > 0 ? memberLen : 1);
      } catch {
        if (!cancelled) setCount(1);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return count;
}
