"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import type { PlanTemplate } from "../../../lib/nutrition/planTemplates";
import { DestructiveConfirmDialog } from "./destructive-confirm-dialog";

type Mode = "save" | "list";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Number of eligible meals (non-placeholder, non-leftover) in the current plan. */
  sourceMealCount: number;
  /** Max dayCount the user can save (defaults to 7, clamped by the current plan length). */
  maxDayCount: number;
  /** Templates list for the "My templates" tab. */
  templates: PlanTemplate[];
  loading: boolean;
  onSave: (name: string, dayCount: number) => Promise<{ ok: boolean; error?: string }>;
  onApply: (templateId: string) => void;
  onDelete: (templateId: string) => Promise<{ ok: boolean; error?: string }>;
};

/**
 * PlanTemplatesDialog — two-mode dialog covering:
 *  - "Save as template" with name + day-count slider (1..7)
 *  - "My templates" list with Apply / Delete actions
 *
 * The dialog is intentionally a single component so both affordances share
 * the same surface; the `Mode` tabs mirror the DuplicateDayDialog pattern.
 * Empty-week saves are rejected loudly via the inline error.
 */
export function PlanTemplatesDialog({
  open,
  onOpenChange,
  sourceMealCount,
  maxDayCount,
  templates,
  loading,
  onSave,
  onApply,
  onDelete,
}: Props) {
  const clampedMax = Math.max(1, Math.min(7, Math.floor(maxDayCount || 1)));
  const [mode, setMode] = useState<Mode>(sourceMealCount > 0 ? "save" : "list");
  const [name, setName] = useState("");
  const [dayCount, setDayCount] = useState<number>(clampedMax);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Audit M7 (2026-04-18) — themed destructive-confirm dialog
  // replaces the prior `window.confirm` call for template deletion.
  const [deleteTarget, setDeleteTarget] = useState<PlanTemplate | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setDayCount(clampedMax);
      setError(null);
      setMode(sourceMealCount > 0 ? "save" : "list");
    }
  }, [open, clampedMax, sourceMealCount]);

  const canSave = useMemo(
    () => sourceMealCount > 0 && name.trim().length > 0 && !saving,
    [name, sourceMealCount, saving],
  );

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const res = await onSave(name.trim(), dayCount);
    setSaving(false);
    if (res.ok) {
      onOpenChange(false);
    } else {
      setError(res.error ?? "Could not save template.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Plan templates</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Save a week (or a shorter slice) you like, and apply it to any future week.
          </DialogDescription>
        </DialogHeader>

        <div
          className="flex rounded-lg border border-border p-1 bg-muted/50"
          role="tablist"
          aria-label="Template mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "save"}
            onClick={() => setMode("save")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === "save" ? "bg-card shadow text-foreground" : "text-muted-foreground"
            }`}
          >
            Save as template
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "list"}
            onClick={() => setMode("list")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === "list" ? "bg-card shadow text-foreground" : "text-muted-foreground"
            }`}
          >
            My templates ({templates.length})
          </button>
        </div>

        {mode === "save" ? (
          <div className="grid gap-4 py-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-foreground">Template name</span>
              <input
                type="text"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder="Bulk week, Vacation week, …"
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm"
                aria-label="Template name"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-foreground">
                {`Day count: ${dayCount} day${dayCount === 1 ? "" : "s"}`}
              </span>
              <input
                type="range"
                min={1}
                max={clampedMax}
                value={dayCount}
                onChange={(e) => setDayCount(Number(e.target.value))}
                aria-label="Number of days to save"
              />
            </label>
            {sourceMealCount === 0 ? (
              <p className="text-xs text-warning" aria-live="polite">
                This plan has no meals to save. Generate a plan first.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Will save the first {dayCount} day{dayCount === 1 ? "" : "s"} of this plan
                ({sourceMealCount} total meal{sourceMealCount === 1 ? "" : "s"} eligible).
              </p>
            )}
            {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!canSave}>
                {saving ? "Saving…" : "Save template"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="grid gap-3 py-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No saved templates yet. Generate a plan, then switch back to &quot;Save as template&quot;.
              </p>
            ) : (
              <ul className="grid gap-2 max-h-80 overflow-y-auto">
                {templates.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border bg-muted/30"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {`${t.dayCount} day${t.dayCount === 1 ? "" : "s"} · ${t.slots.length} meal${t.slots.length === 1 ? "" : "s"}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => onApply(t.id)}
                      aria-label={`Apply ${t.name} to this week`}
                    >
                      Apply
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setDeleteTarget(t)}
                      aria-label={`Delete ${t.name}`}
                    >
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
      <DestructiveConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        title={
          deleteTarget ? `Delete template "${deleteTarget.name}"?` : "Delete template?"
        }
        description="This can't be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleteTarget) return;
          const res = await onDelete(deleteTarget.id);
          if (!res.ok) setError(res.error ?? "Could not delete template.");
        }}
      />
    </Dialog>
  );
}

export default PlanTemplatesDialog;
