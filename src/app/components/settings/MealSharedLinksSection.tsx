"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { isFeatureEnabled, track } from "../../../lib/analytics/track.ts";
import { AnalyticsEvents } from "../../../lib/analytics/events.ts";
import { supabase } from "../../../lib/supabase/browserClient.ts";
import {
  listOwnMealShares,
  revokeMealShare,
} from "../../../lib/share/mealShareClient.ts";
import {
  MEAL_SHARE_MANAGE_FLAG,
  deriveOwnMealShareLinkState,
  type OwnMealShareRow,
} from "../../../lib/share/mealShareLink.ts";

function stateLabel(row: OwnMealShareRow): string {
  const state = deriveOwnMealShareLinkState(row);
  if (state === "active") return "Active";
  if (state === "expired") return "Expired";
  return "Revoked";
}

/**
 * ENG-1648 — "My shared links" Settings list + revoke.
 * Flag-gated (`meal_share_manage_v1`, default OFF). Mirror:
 * `apps/mobile/components/settings/MealSharedLinksSection.tsx`.
 */
export function MealSharedLinksSection() {
  const enabled = isFeatureEnabled(MEAL_SHARE_MANAGE_FLAG);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<OwnMealShareRow[]>([]);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listOwnMealShares(supabase));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  const onRevoke = useCallback(
    async (row: OwnMealShareRow) => {
      if (deriveOwnMealShareLinkState(row) !== "active") return;
      if (
        typeof window !== "undefined" &&
        !window.confirm(`Revoke the share link for “${row.title}”? Recipients will no longer be able to open it.`)
      ) {
        return;
      }
      setRevokingId(row.id);
      try {
        const result = await revokeMealShare(supabase, row.id);
        if (result.status !== "revoked") {
          toast.error("Could not revoke that link.");
          return;
        }
        track(AnalyticsEvents.meal_share_link_revoked, { share_id: row.id });
        setRows((current) =>
          current.map((candidate) =>
            candidate.id === row.id
              ? { ...candidate, revokedAt: new Date().toISOString() }
              : candidate,
          ),
        );
        toast.success("Share link revoked.");
      } finally {
        setRevokingId(null);
      }
    },
    [],
  );

  if (!enabled) return null;

  const activeCount = rows.filter((r) => deriveOwnMealShareLinkState(r) === "active").length;

  return (
    <div
      data-testid="settings-meal-shared-links-row"
      className="w-full rounded-lg bg-muted/60 text-foreground"
    >
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted rounded-lg transition-all"
        aria-expanded={open}
      >
        <span>
          <span className="block font-medium">My shared links</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {loading
              ? "Loading shared meal links…"
              : `${activeCount} active · Manage or revoke meal share links`}
          </span>
        </span>
      </button>
      {open ? (
        <div className="border-t border-border px-4 py-3 space-y-2">
          {rows.length === 0 && !loading ? (
            <p className="text-xs text-muted-foreground">
              No shared meal links yet. Share a meal from Today to create one.
            </p>
          ) : null}
          {rows.map((row) => {
            const state = deriveOwnMealShareLinkState(row);
            const canRevoke = state === "active";
            return (
              <div
                key={row.id}
                data-testid={`meal-share-row-${row.id}`}
                className="flex items-start justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{row.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.mealSlot} · {stateLabel(row)} ·{" "}
                    {new Date(row.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {canRevoke ? (
                  <button
                    type="button"
                    data-testid={`meal-share-revoke-${row.id}`}
                    disabled={revokingId === row.id}
                    onClick={() => void onRevoke(row)}
                    className="shrink-0 text-xs font-semibold text-destructive hover:opacity-80 disabled:opacity-50"
                  >
                    {revokingId === row.id ? "…" : "Revoke"}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
