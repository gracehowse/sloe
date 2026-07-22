import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { track } from "../../../lib/analytics/track.ts";
import { AnalyticsEvents } from "../../../lib/analytics/events.ts";
import { supabase } from "../../../lib/supabase/browserClient.ts";
import {
  listMealShares,
  revokeMealShare,
} from "../../../lib/share/mealShareClient.ts";
import {
  MEAL_SHARED_LINKS_PRIVACY_COPY,
  MEAL_SHARED_LINKS_SETTINGS_LABEL,
  MEAL_SHARED_LINKS_SETTINGS_SUB,
  formatMealShareDate,
  mealShareViewState,
  mealShareViewStateLabel,
  mealSharedLinksCountLabel,
  type MealShareRow,
} from "../../../lib/share/mealSharedLinks.ts";
import { Icons } from "../ui/icons";

export interface MealSharedLinksSectionProps {
  /** When true, expand the list on mount (e.g. toast "Manage" deep link). */
  initialOpen?: boolean;
}

/**
 * ENG-1648 — meal share link management (list + revoke). Self-contained:
 * owns fetch/state so it doesn't bloat Settings (ENG-717 screen budget).
 * Mobile parity: `apps/mobile/components/settings/MealSharedLinksSection.tsx`.
 */
export function MealSharedLinksSection({ initialOpen = false }: MealSharedLinksSectionProps) {
  const [rows, setRows] = useState<MealShareRow[]>([]);
  const [open, setOpen] = useState(initialOpen);
  const [loading, setLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const next = await listMealShares(supabase);
      setRows(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (initialOpen) setOpen(true);
  }, [initialOpen]);

  const handleRevoke = useCallback(
    async (row: MealShareRow) => {
      if (mealShareViewState(row) !== "active") return;
      if (
        typeof window !== "undefined" &&
        !window.confirm(`Revoke the link for "${row.title}"? Recipients won't be able to add this meal anymore.`)
      ) {
        return;
      }

      setRevokingId(row.id);
      try {
        const result = await revokeMealShare(supabase, row.id);
        if (result.status !== "revoked") {
          toast.error("Couldn't revoke that link. Try again.");
          return;
        }
        track(AnalyticsEvents.meal_share_link_revoked, { surface: "settings_privacy" });
        setRows((current) =>
          current.map((candidate) =>
            candidate.id === row.id
              ? { ...candidate, revokedAt: new Date().toISOString() }
              : candidate,
          ),
        );
        toast.success("Link revoked");
      } finally {
        setRevokingId(null);
      }
    },
    [],
  );

  return (
    <div
      data-testid="settings-meal-shared-links-row"
      className="w-full rounded-lg bg-muted/60 text-foreground"
    >
      <button
        type="button"
        onClick={() => {
          setOpen((wasOpen) => !wasOpen);
          if (!open) void loadRows();
        }}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted rounded-lg transition-all"
        aria-expanded={open}
      >
        <span>
          <span className="block font-medium">{MEAL_SHARED_LINKS_SETTINGS_LABEL}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {loading
              ? "Loading shared meal links…"
              : `${mealSharedLinksCountLabel(rows.length)}. ${MEAL_SHARED_LINKS_SETTINGS_SUB}`}
          </span>
        </span>
        <Icons.link className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open ? (
        <div
          data-testid="settings-meal-shared-links-list"
          className="border-t border-border px-4 py-3"
        >
          <p className="text-xs text-muted-foreground">{MEAL_SHARED_LINKS_PRIVACY_COPY}</p>
          {rows.length > 0 ? (
            <div className="mt-3 space-y-2">
              {rows.map((row) => {
                const state = mealShareViewState(row);
                const canRevoke = state === "active";
                return (
                  <div
                    key={row.id}
                    data-testid={`settings-meal-shared-link-${row.id}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{row.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {row.mealSlot} · Created {formatMealShareDate(row.createdAt)} · Expires{" "}
                        {formatMealShareDate(row.expiresAt)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {mealShareViewStateLabel(state)}
                      </span>
                    </span>
                    {canRevoke ? (
                      <button
                        type="button"
                        data-testid={`settings-meal-shared-link-revoke-${row.id}`}
                        onClick={() => {
                          void handleRevoke(row);
                        }}
                        disabled={revokingId === row.id}
                        className="shrink-0 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        {revokingId === row.id ? "Revoking…" : "Revoke"}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing shared yet. Meal links you create from Today will appear here.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default MealSharedLinksSection;
