"use client";

import { useCallback, useState } from "react";

import { DeleteAccountSheet } from "./DeleteAccountSheet";
import { useDeleteAccountSheet } from "./useDeleteAccountSheet";

/** ENG-1260 — delete-account sheet hook + overlay for Settings hosts.
 *
 *  ENG-1262: `runExport` is now the COMPLETE server-authoritative archive
 *  (`/api/export/me` via `downloadSupprExport`), not a meal-log-only CSV — the
 *  user must get a full copy before permanent deletion. We track the in-flight
 *  state so the sheet's "Download a copy first" button disables + shows progress
 *  and can't be double-submitted. The callback may resolve to a structured
 *  result, but the layer only needs the loading boundary here. */
export function useSettingsDeleteAccountLayer(
  authedUserId: string | null,
  localClearKeys: string[],
  runExport: () => void | Promise<unknown>,
) {
  const deleteAccount = useDeleteAccountSheet(authedUserId, localClearKeys);
  const [exportingFirst, setExportingFirst] = useState(false);

  const onExportFirst = useCallback(() => {
    if (exportingFirst) return;
    setExportingFirst(true);
    void Promise.resolve(runExport()).finally(() => setExportingFirst(false));
  }, [exportingFirst, runExport]);

  const overlay = (
    <DeleteAccountSheet
      open={deleteAccount.open}
      onOpenChange={deleteAccount.setOpen}
      ledger={deleteAccount.ledger}
      loadingLedger={deleteAccount.loadingLedger}
      deleting={deleteAccount.deleting}
      exportingFirst={exportingFirst}
      onExportFirst={onExportFirst}
      onDeleteForever={deleteAccount.deleteForever}
    />
  );
  return { ...deleteAccount, overlay };
}
