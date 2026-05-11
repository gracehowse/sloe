"use client";

/**
 * F-138 Phase 4 — single row in the admin corrections queue.
 *
 * Spec: docs/planning/F-138-P4-admin-queue-spec.md (§3.3 + §3.4)
 *
 * Displays the submitted macros + metadata + evidence photo (if any) +
 * vote tallies + flag chips. Four action buttons trailing the row:
 * Approve / Reject / Edit & approve / Reject as duplicate.
 *
 * Edit-and-approve opens an inline editor (not a modal) that pre-fills
 * the editable macros. Save calls `editAndApproveCorrection` with the
 * changed columns + flips status to verified in a single UPDATE.
 *
 * The component is intentionally compact — the spec target is "clear a
 * queue of 20 rows in under 10 minutes" (§1). Anything fancier slows
 * the admin down.
 */

import { useState, useTransition } from "react";
import {
  approveCorrection,
  rejectCorrection,
  editAndApproveCorrection,
  type ActionResult,
  type EditPayload,
} from "./actions";
import { checkSubmissionPlausibility } from "../../../src/lib/foodCorrection/plausibility";

type Row = {
  id: string;
  barcode: string;
  brand: string | null;
  calories: number;
  carbs: number;
  category: string | null;
  created_at: string;
  downvotes: number;
  evidence_url: string | null;
  fat: number;
  fiber_g: number | null;
  flagged_for_admin_at: string | null;
  name: string;
  protein: number;
  saturated_fat_g: number | null;
  serving_size_g: number | null;
  sodium_mg: number | null;
  submitted_by: string | null;
  sugar_g: number | null;
  upvotes: number;
  verification_status: string;
};

function relativeAge(iso: string): string {
  const ageMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function plausibilityBand(row: Row): { verdict: "pass" | "warn" | "block"; tone: string } {
  const result = checkSubmissionPlausibility({
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    fiber: row.fiber_g ?? null,
    sugar: row.sugar_g ?? null,
    satFat: row.saturated_fat_g ?? null,
    sodium: row.sodium_mg ?? null,
  });
  // auto_verify collapses to pass for the band display (it's a positive
  // signal, not a separate state for the admin).
  const verdict = result.verdict === "auto_verify" ? "pass" : result.verdict;
  const tone =
    verdict === "block"
      ? "bg-destructive/15 text-destructive"
      : verdict === "warn"
        ? "bg-warning-soft text-warning"
        : "bg-success/15 text-success";
  return { verdict, tone };
}

export function QueueRow({ row }: { row: Row }) {
  const [editing, setEditing] = useState(false);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const band = plausibilityBand(row);

  function handleResult(result: ActionResult) {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setEditing(false);
  }

  return (
    <article
      className="bg-card border border-border rounded-xl p-4"
      data-testid="admin-queue-row"
      data-row-id={row.id}
    >
      <div className="flex items-start gap-4">
        {/* Evidence thumbnail — placeholder div until we wire the signed
            URL helper. Spec §3.3 calls for a clickable thumbnail that
            opens a 5-min signed URL in a new tab. */}
        <div
          className="w-20 h-20 rounded-lg border border-border flex-shrink-0 flex items-center justify-center text-[10px] uppercase tracking-wider text-muted-foreground"
          data-testid="admin-queue-row-evidence"
        >
          {row.evidence_url ? "Evidence" : "No photo"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">{row.name}</h3>
              {row.brand && (
                <p className="text-xs text-muted-foreground truncate">{row.brand}</p>
              )}
            </div>
            <span
              className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${band.tone}`}
              data-testid="admin-queue-row-plausibility"
            >
              {band.verdict}
            </span>
          </div>
          <p className="text-xs font-mono text-muted-foreground mb-2 truncate">
            {row.barcode}
          </p>
          <dl className="grid grid-cols-4 gap-2 text-xs mb-2">
            <Macro label="kcal" value={row.calories} />
            <Macro label="P" value={row.protein} />
            <Macro label="C" value={row.carbs} />
            <Macro label="F" value={row.fat} />
            {row.fiber_g != null && <Macro label="Fi" value={row.fiber_g} />}
            {row.sugar_g != null && <Macro label="Sg" value={row.sugar_g} />}
            {row.sodium_mg != null && <Macro label="Na" value={row.sodium_mg} unit="mg" />}
            {row.saturated_fat_g != null && (
              <Macro label="SatF" value={row.saturated_fat_g} />
            )}
          </dl>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>+{row.upvotes} / -{row.downvotes}</span>
            <span>·</span>
            <span>{relativeAge(row.created_at)}</span>
            {row.flagged_for_admin_at && (
              <>
                <span>·</span>
                <span className="text-warning">
                  flagged {relativeAge(row.flagged_for_admin_at)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {editing ? (
        <EditPanel row={row} busy={busy} onCancel={() => setEditing(false)} onSubmit={(edits) => {
          startTransition(async () => {
            const res = await editAndApproveCorrection(row.id, edits);
            handleResult(res);
          });
        }} />
      ) : (
        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              startTransition(async () => {
                const res = await approveCorrection(row.id);
                handleResult(res);
              })
            }
            data-testid="admin-queue-row-approve"
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-success text-white disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              startTransition(async () => {
                const res = await rejectCorrection(row.id);
                handleResult(res);
              })
            }
            data-testid="admin-queue-row-reject"
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-destructive text-white disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setEditing(true)}
            data-testid="admin-queue-row-edit"
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-muted text-foreground hover:bg-muted/80 disabled:opacity-50"
          >
            Edit & approve
          </button>
        </div>
      )}

      {error && (
        <p
          className="text-xs text-destructive mt-2"
          role="alert"
          data-testid="admin-queue-row-error"
        >
          {error}
        </p>
      )}
    </article>
  );
}

function Macro({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums text-foreground">
        {Math.round(value * 10) / 10}{unit ? ` ${unit}` : ""}
      </dd>
    </div>
  );
}

function EditPanel({
  row,
  busy,
  onCancel,
  onSubmit,
}: {
  row: Row;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (edits: EditPayload) => void;
}) {
  const [calories, setCalories] = useState(String(row.calories));
  const [protein, setProtein] = useState(String(row.protein));
  const [carbs, setCarbs] = useState(String(row.carbs));
  const [fat, setFat] = useState(String(row.fat));

  function parseField(s: string): number | null {
    const t = s.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function submit() {
    const cals = parseField(calories);
    const pro = parseField(protein);
    const car = parseField(carbs);
    const f = parseField(fat);
    if (cals == null || pro == null || car == null || f == null) return;
    onSubmit({ calories: cals, protein: pro, carbs: car, fat: f });
  }

  return (
    <div
      className="mt-4 pt-4 border-t border-border"
      data-testid="admin-queue-row-edit-panel"
    >
      <div className="grid grid-cols-4 gap-2 mb-3">
        <Field label="Calories" value={calories} onChange={setCalories} />
        <Field label="Protein" value={protein} onChange={setProtein} />
        <Field label="Carbs" value={carbs} onChange={setCarbs} />
        <Field label="Fat" value={fat} onChange={setFat} />
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-3 py-1.5 rounded-md text-xs font-medium bg-muted text-foreground hover:bg-muted/80 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          data-testid="admin-queue-row-edit-save"
          className="px-3 py-1.5 rounded-md text-xs font-medium bg-success text-white disabled:opacity-50"
        >
          Save & approve
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={0}
        step="any"
        className="px-2 py-1 rounded-md border border-border bg-card text-foreground text-sm"
      />
    </label>
  );
}
