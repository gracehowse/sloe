import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";

import { supabase } from "@/lib/supabase";
import { getSupprWebBase } from "@/lib/supprWeb";
import { isFeatureEnabled } from "@/lib/analytics";
import {
  DELETE_ACCOUNT_SHEET_FLAG,
  type DeleteAccountLedgerRow,
  type DeleteAccountLeaveReason,
} from "@suppr/shared/settings/deleteAccountFlow";
import { fetchDeleteAccountLedger } from "@suppr/shared/settings/fetchDeleteAccountLedger";
import { executeAccountDelete } from "@suppr/shared/settings/executeAccountDelete";

// ENG-1262: `runExport` is the COMPLETE server-authoritative archive
// (`exportEverythingToFile` → `/api/export/me`), not a meal-log-only CSV —
// the user must get a full copy before permanent deletion (GDPR Art. 20).
export function useDeleteAccountSheet(userId: string | null, runExport: () => void) {
  const enabled = isFeatureEnabled(DELETE_ACCOUNT_SHEET_FLAG);
  const [open, setOpen] = useState(false);
  const [ledger, setLedger] = useState<DeleteAccountLedgerRow[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    setLoadingLedger(true);
    void fetchDeleteAccountLedger(supabase, userId)
      .then(setLedger)
      .finally(() => setLoadingLedger(false));
  }, [open, userId]);

  const deleteForever = useCallback(async (_reason: DeleteAccountLeaveReason | null) => {
    setDeleting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const base = getSupprWebBase();
      const result = await executeAccountDelete(base ?? "", token);
      if (result.ok) {
        await supabase.auth.signOut();
        setOpen(false);
        Alert.alert("Account deleted", "Your account has been permanently deleted.");
      } else {
        Alert.alert("Deletion failed", result.error);
      }
    } finally {
      setDeleting(false);
    }
  }, []);

  const openLegacyDeleteAlerts = useCallback(() => {
    Alert.alert(
      "Delete your account?",
      "This will permanently delete your account, all data, and sign you out. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "I want to delete",
          style: "destructive",
          onPress: () => {
            Alert.prompt?.(
              "Type 'delete' to confirm",
              "We won't be able to recover this account.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete account",
                  style: "destructive",
                  onPress: async (text?: string) => {
                    if ((text ?? "").trim().toLowerCase() !== "delete") {
                      Alert.alert("Not deleted", "Type the word delete to confirm.");
                      return;
                    }
                    try {
                      const { data: sessionData } = await supabase.auth.getSession();
                      const token = sessionData?.session?.access_token;
                      const base = getSupprWebBase();
                      if (!base) {
                        Alert.alert("Error", "API URL not configured. Please contact support.");
                        return;
                      }
                      const res = await fetch(`${base}/api/account/delete`, {
                        method: "DELETE",
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                      });
                      const json = await res.json();
                      if (json.ok) {
                        await supabase.auth.signOut();
                        Alert.alert(
                          "Account deleted",
                          "Your account has been permanently deleted.",
                        );
                      } else {
                        Alert.alert("Deletion failed", json.error || "Please try again.");
                      }
                    } catch {
                      Alert.alert("Deletion failed", "Please try again later.");
                    }
                  },
                },
              ],
              "plain-text",
            );
          },
        },
      ],
    );
  }, []);

  const handleDeleteAccount = useCallback(() => {
    if (enabled) {
      setOpen(true);
      return;
    }
    openLegacyDeleteAlerts();
  }, [enabled, openLegacyDeleteAlerts]);

  return {
    enabled,
    open,
    setOpen,
    ledger,
    loadingLedger,
    deleting,
    handleDeleteAccount,
    deleteForever,
    exportFirst: runExport,
  };
}
