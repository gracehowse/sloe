import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Icons } from "../ui/icons";
import { supabase } from "../../../lib/supabase/browserClient.ts";
import {
  BARCODE_CONTRIBUTIONS_PRIVACY_COPY,
  BARCODE_CONTRIBUTIONS_SETTINGS_LABEL,
  BARCODE_CONTRIBUTIONS_SETTINGS_SUB,
  barcodeContributionStatusLabel,
  barcodeContributionTitle,
  barcodeContributionsCountLabel,
  type BarcodeContributionSummary,
} from "../../../lib/nutrition-core/barcodeContributions.ts";

/**
 * Barcode community-contribution withdrawal row (ENG-1250). Self-contained:
 * owns its own fetch/state so it doesn't bloat the parent Settings screen
 * (ENG-717 screen-budget). Lists the caller's shared barcode products and lets
 * them remove (withdraw) any of them via DELETE /api/user-foods. Mobile parity:
 * `apps/mobile/components/settings/BarcodeContributionsSection.tsx`.
 */
export function BarcodeContributionsSection() {
  const [barcodeContributions, setBarcodeContributions] = useState<BarcodeContributionSummary[]>([]);
  const [barcodeContributionsOpen, setBarcodeContributionsOpen] = useState(false);
  const [barcodeContributionsLoading, setBarcodeContributionsLoading] = useState(false);
  const [barcodeContributionDeletingId, setBarcodeContributionDeletingId] = useState<string | null>(null);

  const loadBarcodeContributions = useCallback(async () => {
    setBarcodeContributionsLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        setBarcodeContributions([]);
        return;
      }
      const res = await fetch("/api/user-foods?mine=1&limit=25", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setBarcodeContributions([]);
        return;
      }
      const body = (await res.json()) as {
        ok?: boolean;
        foods?: BarcodeContributionSummary[];
      };
      setBarcodeContributions(body.ok ? body.foods ?? [] : []);
    } finally {
      setBarcodeContributionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBarcodeContributions();
  }, [loadBarcodeContributions]);

  const handleDeleteBarcodeContribution = useCallback(
    async (item: BarcodeContributionSummary) => {
      if (
        typeof window !== "undefined" &&
        !window.confirm(`Remove ${barcodeContributionTitle(item)} from the community database?`)
      ) {
        return;
      }

      setBarcodeContributionDeletingId(item.id);
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) {
          toast.error("Sign in to manage barcode contributions.");
          return;
        }
        const res = await fetch(`/api/user-foods?id=${encodeURIComponent(item.id)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          toast.error("Could not remove that contribution.");
          return;
        }
        setBarcodeContributions((current) => current.filter((candidate) => candidate.id !== item.id));
        toast.success("Barcode contribution removed.");
      } finally {
        setBarcodeContributionDeletingId(null);
      }
    },
    [],
  );

  return (
    <div
      data-testid="settings-barcode-contributions-row"
      className="w-full rounded-lg bg-muted/60 text-foreground"
    >
      <button
        type="button"
        onClick={() => {
          setBarcodeContributionsOpen((open) => !open);
          if (!barcodeContributionsOpen) void loadBarcodeContributions();
        }}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted rounded-lg transition-all"
        aria-expanded={barcodeContributionsOpen}
      >
        <span>
          <span className="block font-medium">{BARCODE_CONTRIBUTIONS_SETTINGS_LABEL}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {barcodeContributionsLoading
              ? "Loading shared barcode products…"
              : `${barcodeContributionsCountLabel(barcodeContributions.length)}. ${BARCODE_CONTRIBUTIONS_SETTINGS_SUB}`}
          </span>
        </span>
        <Icons.scan className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {barcodeContributionsOpen ? (
        <div className="border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {BARCODE_CONTRIBUTIONS_PRIVACY_COPY}
          </p>
          {barcodeContributions.length > 0 ? (
            <div className="mt-3 space-y-2">
              {barcodeContributions.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {barcodeContributionTitle(item)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {item.barcode} · {barcodeContributionStatusLabel(item.verification_status)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void handleDeleteBarcodeContribution(item);
                    }}
                    disabled={barcodeContributionDeletingId === item.id}
                    className="shrink-0 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {barcodeContributionDeletingId === item.id ? "Removing…" : "Remove"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing shared yet. Barcode corrections you add will appear here.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default BarcodeContributionsSection;
