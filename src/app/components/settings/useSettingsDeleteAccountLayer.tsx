"use client";

import { DeleteAccountSheet } from "./DeleteAccountSheet";
import { useDeleteAccountSheet } from "./useDeleteAccountSheet";

/** ENG-1260 — delete-account sheet hook + overlay for Settings hosts. */
export function useSettingsDeleteAccountLayer(
  authedUserId: string | null,
  localClearKeys: string[],
  runCsvExport: () => void | Promise<void>,
) {
  const deleteAccount = useDeleteAccountSheet(authedUserId, localClearKeys);
  const overlay = (
    <DeleteAccountSheet
      open={deleteAccount.open}
      onOpenChange={deleteAccount.setOpen}
      ledger={deleteAccount.ledger}
      loadingLedger={deleteAccount.loadingLedger}
      deleting={deleteAccount.deleting}
      onExportFirst={() => {
        void runCsvExport();
      }}
      onDeleteForever={deleteAccount.deleteForever}
    />
  );
  return { ...deleteAccount, overlay };
}
