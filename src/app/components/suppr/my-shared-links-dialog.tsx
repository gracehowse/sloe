"use client";

/**
 * MySharedLinksDialog — ENG-1648 "My shared links" management surface, the
 * revoke UI ENG-1642 promised but never shipped. Lists the caller's OWN
 * `meal_shares` rows (title / slot / created / expiry / state) with a
 * per-row Revoke action on active rows. Free tier, no paywall.
 *
 * Scaffolding mirrors `household/HouseholdInviteDialog.tsx`: loading state,
 * empty-state copy, then a `divide-y` list of rows. Revoke confirmation
 * reuses the shared `DestructiveConfirmDialog` (not `window.confirm`) — one
 * instance for the whole list, opened with the target row's id held in
 * state. On a successful revoke the row STAYS in the list; only its
 * `revokedAt` flips locally and its Revoke button disappears — never
 * removed, so the list keeps reading as a full history of what was shared.
 *
 * Mobile mirror: `apps/mobile/app/my-shared-meals.tsx`.
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { EmptyState } from "./empty-state";
import { DestructiveConfirmDialog } from "./destructive-confirm-dialog";
import { supabase } from "../../../lib/supabase/browserClient.ts";
import { listMealShares, revokeMealShare } from "../../../lib/share/mealShareClient.ts";
import {
  deriveMealShareRowState,
  type MealShareListRow,
  type MealShareRowState,
} from "../../../lib/share/mealShareLink.ts";
import { track } from "../../../lib/analytics/track.ts";
import { AnalyticsEvents } from "../../../lib/analytics/events.ts";

export interface MySharedLinksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

const STATE_BADGE_LABEL: Record<MealShareRowState, string> = {
  active: "Active",
  expired: "Expired",
  revoked: "Revoked",
};

const STATE_BADGE_CLASS: Record<MealShareRowState, string> = {
  active: "bg-success-soft text-success",
  expired: "bg-muted text-muted-foreground",
  revoked: "bg-destructive-soft text-destructive",
};

function formatShareDate(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function MySharedLinksDialog({ open, onOpenChange, userId }: MySharedLinksDialogProps) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<MealShareListRow[]>([]);
  const [error, setError] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeTargetId, setRevokeTargetId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(false);
    const result = await listMealShares(supabase, userId);
    setLoading(false);
    if (result.status === "error") {
      setError(true);
      setRows([]);
      return;
    }
    setRows(result.rows);
    track(AnalyticsEvents.shared_links_list_viewed, {
      surface: "web_settings_privacy",
      shareCount: result.rows.length,
    });
  }, [userId]);

  useEffect(() => {
    if (open) {
      void reload();
    } else {
      // Closing mid-confirm shouldn't leave the confirm dialog floating
      // with no list dialog behind it.
      setRevokeTargetId(null);
    }
  }, [open, reload]);

  const handleRevoke = useCallback(async () => {
    const shareId = revokeTargetId;
    if (!shareId) return;
    setRevokingId(shareId);
    try {
      const result = await revokeMealShare(supabase, shareId);
      if (result.status !== "revoked") {
        toast.error("Couldn't revoke that link — try again in a moment.");
        return;
      }
      const revokedAt = new Date().toISOString();
      setRows((current) =>
        current.map((row) => (row.id === shareId ? { ...row, revokedAt } : row)),
      );
      track(AnalyticsEvents.shared_link_revoked, {
        surface: "web_settings_privacy",
      });
      toast.success("Link revoked.");
    } finally {
      setRevokingId(null);
    }
  }, [revokeTargetId]);

  const revokeTargetTitle = rows.find((row) => row.id === revokeTargetId)?.title ?? "this link";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Shared meals</DialogTitle>
            <DialogDescription>
              Links you've shared, with the ability to revoke access anytime.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {loading ? (
              <p className="text-xs text-muted-foreground py-2">Loading…</p>
            ) : error ? (
              <p className="text-xs text-destructive py-2">
                Couldn't load your shared links — try again in a moment.
              </p>
            ) : rows.length === 0 ? (
              <EmptyState title="You haven't shared any meals yet." />
            ) : (
              <ul className="rounded-md border border-border bg-card divide-y divide-border max-h-96 overflow-y-auto">
                {rows.map((row) => {
                  const now = new Date();
                  const state = deriveMealShareRowState(row, now);
                  return (
                    <li
                      key={row.id}
                      className="flex items-center gap-3 p-3"
                      data-testid={`shared-link-row-${row.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {row.title}
                          </p>
                          <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {row.mealSlot}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Shared {formatShareDate(row.createdAt)}
                          {state === "revoked" && row.revokedAt
                            ? ` · Revoked ${formatShareDate(row.revokedAt)}`
                            : ` · Expires ${formatShareDate(row.expiresAt)}`}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${STATE_BADGE_CLASS[state]}`}
                        data-testid={`shared-link-state-${row.id}`}
                      >
                        {STATE_BADGE_LABEL[state]}
                      </span>
                      {state === "active" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive shrink-0"
                          onClick={() => setRevokeTargetId(row.id)}
                          disabled={revokingId === row.id}
                          data-testid={`shared-link-revoke-${row.id}`}
                        >
                          Revoke
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DestructiveConfirmDialog
        open={revokeTargetId !== null}
        onOpenChange={(next) => {
          if (!next) setRevokeTargetId(null);
        }}
        title={`Revoke "${revokeTargetTitle}"?`}
        description="Anyone with this link will no longer be able to view or add this meal."
        confirmLabel="Revoke"
        onConfirm={handleRevoke}
      />
    </>
  );
}

export default MySharedLinksDialog;
