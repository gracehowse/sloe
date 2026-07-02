"use client";

import * as React from "react";
import { ChevronRight, Flame, Minus, Plus, ShoppingCart, UtensilsCrossed, X } from "lucide-react";
import { toast } from "sonner";

import {
  batchPerPortionCalories,
  clampBatchPortions,
  type BatchCookRecipeCandidate,
} from "@/lib/planning/batchCook";

export interface BatchCookSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipes: BatchCookRecipeCandidate[];
  saving?: boolean;
  onSave: (recipe: BatchCookRecipeCandidate, portions: number) => void | Promise<void>;
  onCook: (recipe: BatchCookRecipeCandidate, portions: number) => void;
}

/** ENG-1255 — web parity twin of `apps/mobile/components/plan/BatchCookSurface.tsx`. */
export function BatchCookSheet({
  open,
  onOpenChange,
  recipes,
  saving = false,
  onSave,
  onCook,
}: BatchCookSheetProps) {
  const [chosen, setChosen] = React.useState<BatchCookRecipeCandidate | null>(null);
  const [portions, setPortions] = React.useState(4);

  React.useEffect(() => {
    if (!open) {
      setChosen(null);
      setPortions(4);
    }
  }, [open]);

  if (!open) return null;

  const perPortionKcal = chosen
    ? batchPerPortionCalories(chosen.calories, chosen.servings)
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Batch cook"
    >
      <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <button
          type="button"
          onClick={() => (chosen ? setChosen(null) : onOpenChange(false))}
          className="flex size-10 items-center justify-center rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          style={{ borderColor: "var(--border)" }}
          aria-label={chosen ? "Back to recipe list" : "Close batch cook"}
        >
          {chosen ? <ChevronRight className="size-5 rotate-180" /> : <X className="size-5" />}
        </button>
        <h1 className="text-base font-semibold text-foreground">Batch cook</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!chosen ? (
          <>
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span
                className="flex size-14 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--background-secondary)" }}
              >
                <Flame className="size-6" style={{ color: "var(--primary)" }} />
              </span>
              <p className="text-lg font-semibold text-foreground">Cook once, eat all week</p>
              <p className="max-w-sm text-sm text-foreground-secondary">
                Pick a recipe that keeps well and Sloe scales it into several meals — ingredients and
                shopping list handled.
              </p>
            </div>
            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-foreground-tertiary">
              Good for batching
            </p>
            <div
              className="overflow-hidden rounded-xl border"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              {recipes.length === 0 ? (
                <p className="p-4 text-center text-sm text-foreground-secondary">
                  Save recipes that make 2+ servings to batch cook.
                </p>
              ) : (
                recipes.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setChosen(r);
                      setPortions(Math.max(4, r.servings));
                    }}
                    className="flex w-full items-center gap-3 border-t p-3 text-left first:border-t-0 hover:bg-[var(--background-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: "var(--accent-primary-soft)" }}
                    >
                      <UtensilsCrossed className="size-4" style={{ color: "var(--primary)" }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">{r.title}</span>
                      <span className="mt-0.5 block text-xs tabular-nums text-foreground-tertiary">
                        {batchPerPortionCalories(r.calories, r.servings)} kcal · keeps 4 days
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-foreground-tertiary" />
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <div
              className="mb-4 flex min-h-[120px] items-end rounded-xl p-4"
              style={{ backgroundColor: "var(--accent-primary-soft)" }}
            >
              <p className="text-xs font-semibold" style={{ color: "var(--primary)" }}>
                Cook once · eat {portions}×
              </p>
            </div>
            <h2 className="text-xl font-semibold text-foreground">{chosen.title}</h2>
            <p className="mt-2 mb-4 text-sm text-foreground-secondary">
              One pot now, {portions} meals handled. Scales the ingredients and your shopping list
              automatically.
            </p>
            <div
              className="space-y-3 rounded-xl border p-4"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Batch size</p>
                  <p className="text-xs text-foreground-tertiary">Portions to cook now</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Decrease batch size"
                    onClick={() => setPortions((p) => clampBatchPortions(p - 1))}
                    className="flex size-8 items-center justify-center rounded-full border"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <Minus className="size-4" />
                  </button>
                  <span
                    className="min-w-[24px] text-center text-base font-medium tabular-nums text-foreground"
                    style={{ fontFamily: "var(--font-headline)" }}
                  >
                    {portions}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase batch size"
                    onClick={() => setPortions((p) => p + 1)}
                    className="flex size-8 items-center justify-center rounded-full border"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs tabular-nums text-foreground-secondary">
                <strong className="text-foreground">{perPortionKcal}</strong> kcal each ·{" "}
                <strong className="text-foreground">{Math.round(chosen.protein)}</strong>g protein ·{" "}
                <strong className="text-foreground">{chosen.timeMin}</strong> min once
              </p>
            </div>
            <div
              className="mt-4 flex items-center gap-2 rounded-lg p-3 text-sm font-semibold"
              style={{ backgroundColor: "var(--accent-primary-soft)", color: "var(--primary)" }}
            >
              <ShoppingCart className="size-4 shrink-0" />
              Shopping list scaled to {portions} portions.
            </div>
          </>
        )}
      </div>

      {chosen ? (
        <div
          className="flex gap-2 border-t p-4"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <button
            type="button"
            disabled={saving}
            onClick={() => void onSave(chosen, portions)}
            className="flex-1 rounded-xl border py-3 text-sm font-semibold text-primary-solid hover:bg-[var(--background-secondary)] disabled:opacity-50"
            style={{ borderColor: "var(--border)" }}
          >
            {saving ? "Saving…" : "Save plan"}
          </button>
          <button
            type="button"
            onClick={() => {
              onCook(chosen, portions);
              toast.success("Opening cook mode");
            }}
            className="flex-1 rounded-xl py-3 text-sm font-semibold text-primary-foreground"
            style={{ backgroundColor: "var(--primary)" }}
          >
            Cook the batch
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default BatchCookSheet;
