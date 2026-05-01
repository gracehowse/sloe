"use client";

/**
 * Quick-submission form for /dmca. Posts to /api/dmca-takedown which inserts
 * a row in `dmca_takedowns` (service-role only — see migration
 * `20260505010000_dmca_takedowns.sql`).
 *
 * The form is in addition to (not instead of) the email channel documented
 * higher on the page. Some rights agents prefer email; some prefer a web
 * form. We accept both.
 *
 * Validation matches the server route's checks so the user sees the same
 * error pattern locally before submission. The server is still the source
 * of truth.
 */

import { useState, type FormEvent } from "react";

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string; field: string | null };

const MAX_DESCRIPTION_LEN = 5000;

export function DmcaTakedownForm() {
  const [reporterEmail, setReporterEmail] = useState("");
  const [originalPostUrl, setOriginalPostUrl] = useState("");
  const [supprRecipeId, setSupprRecipeId] = useState("");
  const [description, setDescription] = useState("");
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "submitting") return;
    setState({ kind: "submitting" });

    try {
      const res = await fetch("/api/dmca-takedown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reporterEmail,
          originalPostUrl,
          supprRecipeId: supprRecipeId.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        field?: string;
        error?: string;
      };
      if (data.ok) {
        setState({
          kind: "success",
          message: data.message ?? "Submission received.",
        });
        // Clear sensitive fields on success.
        setReporterEmail("");
        setOriginalPostUrl("");
        setSupprRecipeId("");
        setDescription("");
        return;
      }
      setState({
        kind: "error",
        message: data.message ?? "Submission failed. Please email dmca@suppr-club.com instead.",
        field: typeof data.field === "string" ? data.field : null,
      });
    } catch {
      setState({
        kind: "error",
        message:
          "Network error. Please retry or email dmca@suppr-club.com directly.",
        field: null,
      });
    }
  }

  const submitting = state.kind === "submitting";
  const errorField = state.kind === "error" ? state.field : null;

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4"
      aria-label="Copyright takedown form"
      data-testid="dmca-takedown-form"
    >
      <div>
        <label
          htmlFor="dmca-email"
          className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
        >
          Your email <span aria-hidden="true">*</span>
        </label>
        <input
          id="dmca-email"
          type="email"
          required
          value={reporterEmail}
          onChange={(e) => setReporterEmail(e.target.value)}
          aria-invalid={errorField === "reporterEmail" || undefined}
          className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
          autoComplete="email"
        />
      </div>

      <div>
        <label
          htmlFor="dmca-original-url"
          className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
        >
          Original post URL <span aria-hidden="true">*</span>
        </label>
        <input
          id="dmca-original-url"
          type="url"
          required
          placeholder="https://www.instagram.com/p/..."
          value={originalPostUrl}
          onChange={(e) => setOriginalPostUrl(e.target.value)}
          aria-invalid={errorField === "originalPostUrl" || undefined}
          className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
          autoComplete="off"
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          The URL of your post on Instagram, TikTok, YouTube, or wherever the
          recipe was originally published.
        </p>
      </div>

      <div>
        <label
          htmlFor="dmca-recipe"
          className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
        >
          Suppr recipe ID or link <span aria-hidden="true">*</span>
        </label>
        <input
          id="dmca-recipe"
          type="text"
          required
          placeholder="https://suppr-club.com/recipe/..."
          value={supprRecipeId}
          onChange={(e) => setSupprRecipeId(e.target.value)}
          aria-invalid={errorField === "supprRecipeId" || undefined}
          className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
          autoComplete="off"
        />
      </div>

      <div>
        <label
          htmlFor="dmca-description"
          className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
        >
          Description (optional)
        </label>
        <textarea
          id="dmca-description"
          rows={4}
          maxLength={MAX_DESCRIPTION_LEN}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-invalid={errorField === "description" || undefined}
          className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          Up to {MAX_DESCRIPTION_LEN} characters. You don&rsquo;t have to repeat
          everything in the formal notice above &mdash; this field is for any
          extra context that helps us locate and act on the content.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit takedown request"}
        </button>
        {state.kind === "success" && (
          <p className="text-xs text-emerald-700 dark:text-emerald-400" role="status">
            {state.message}
          </p>
        )}
        {state.kind === "error" && (
          <p className="text-xs text-rose-700 dark:text-rose-400" role="alert">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
