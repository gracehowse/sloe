import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/browserClient";
import {
  DELETE_ACCOUNT_SHEET_FLAG,
  type DeleteAccountLedgerRow,
  type DeleteAccountLeaveReason,
} from "@/lib/settings/deleteAccountFlow";
import { fetchDeleteAccountLedger } from "@/lib/settings/fetchDeleteAccountLedger";
import { executeAccountDelete } from "@/lib/settings/executeAccountDelete";
import { isFeatureEnabled } from "@/lib/analytics/track";

export function useDeleteAccountSheet(authedUserId: string | null, localClearKeys: string[]) {
  const enabled = isFeatureEnabled(DELETE_ACCOUNT_SHEET_FLAG);
  const [open, setOpen] = useState(false);
  const [ledger, setLedger] = useState<DeleteAccountLedgerRow[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open || !authedUserId) return;
    setLoadingLedger(true);
    void fetchDeleteAccountLedger(supabase, authedUserId)
      .then(setLedger)
      .finally(() => setLoadingLedger(false));
  }, [open, authedUserId]);

  const openDeleteFlow = useCallback(() => setOpen(true), []);

  const deleteForever = useCallback(
    async (_reason: DeleteAccountLeaveReason | null) => {
      setDeleting(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const result = await executeAccountDelete("", token);
        if (result.ok) {
          for (const k of localClearKeys) {
            try {
              localStorage.removeItem(k);
            } catch {
              /* ignore */
            }
          }
          toast.success("Account deleted.");
          window.location.href = "/login";
        } else {
          toast.error(result.error);
        }
      } finally {
        setDeleting(false);
      }
    },
    [localClearKeys],
  );

  return {
    enabled,
    open,
    setOpen,
    ledger,
    loadingLedger,
    deleting,
    openDeleteFlow,
    deleteForever,
  };
}
