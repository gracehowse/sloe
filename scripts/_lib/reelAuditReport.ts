/**
 * Pure helpers for the TikTok/Reel parse-rate audit harness (ENG-7 / ENG-670).
 *
 * Extracted from `scripts/audit-tiktok-reels.ts` so the aggregation +
 * report-rendering logic is unit-testable without a network, a dev server,
 * or Supabase. The runner is the I/O shell; everything deterministic lives
 * here.
 *
 * The gate this feeds is documented in `docs/operations/viral-push-gate.md`:
 * ≥90% successful parse over a 100-Reel battery, three consecutive green
 * days, before the 2026-07-01 viral push opens the import wedge.
 */

/** Outcome of a single Reel import attempt. */
export type ReelAttempt = {
  /** Source URL that was POSTed. */
  url: string;
  /** `true` when the API returned `{ ok: true }` (a recipe was parsed). */
  ok: boolean;
  /**
   * Stable import error code from `{ ok: false, error }`, or a synthetic
   * code for transport failures the route never reached:
   *   - `timeout`        — the per-attempt abort fired
   *   - `network_error`  — fetch threw (DNS / connection reset / etc.)
   *   - `http_<status>`  — non-2xx with no parseable `error` field
   *   - `bad_response`   — 2xx but the body was not the expected shape
   * `null` when `ok` is true.
   */
  errorCode: string | null;
  /** Wall-clock duration of the attempt in milliseconds. */
  durationMs: number;
  /**
   * Whether the post's image was actually analysed (`imageUsed` from the
   * route). `null` when the attempt failed or the field was absent.
   */
  imageUsed: boolean | null;
};

/** A failure mode bucket: one error code, its count, and a few sample URLs. */
export type FailureMode = {
  errorCode: string;
  count: number;
  /** Up to `SAMPLE_URLS_PER_MODE` example URLs that produced this code. */
  sampleUrls: string[];
};

/** Aggregate roll-up across every attempt in a run. */
export type ReelAuditSummary = {
  total: number;
  succeeded: number;
  failed: number;
  /** Whole-number percent, 0–100, rounded. 0 when `total` is 0. */
  successRatePct: number;
  /** Failure modes sorted by count desc, then errorCode asc for stability. */
  failureModes: FailureMode[];
  /** Count of successful attempts where the image was analysed. */
  imageUsedCount: number;
  /** Mean attempt duration in ms, rounded. 0 when `total` is 0. */
  avgDurationMs: number;
  /** Slowest single attempt duration in ms. 0 when `total` is 0. */
  maxDurationMs: number;
};

/** Max sample URLs retained per failure mode in the summary + report. */
export const SAMPLE_URLS_PER_MODE = 3;

/**
 * Roll up a list of attempts into a summary. Pure: no clock, no I/O.
 *
 * An empty list yields a well-formed zero summary (0% success, no failure
 * modes) rather than NaN — the runner can still render a report and the gate
 * reads it as "not met".
 */
export function aggregateAttempts(attempts: ReelAttempt[]): ReelAuditSummary {
  const total = attempts.length;
  const succeeded = attempts.filter((a) => a.ok).length;
  const failed = total - succeeded;

  const byCode = new Map<string, { count: number; sampleUrls: string[] }>();
  for (const a of attempts) {
    if (a.ok) continue;
    const code = a.errorCode ?? "unknown";
    const bucket = byCode.get(code) ?? { count: 0, sampleUrls: [] };
    bucket.count += 1;
    if (bucket.sampleUrls.length < SAMPLE_URLS_PER_MODE) {
      bucket.sampleUrls.push(a.url);
    }
    byCode.set(code, bucket);
  }

  const failureModes: FailureMode[] = [...byCode.entries()]
    .map(([errorCode, v]) => ({ errorCode, count: v.count, sampleUrls: v.sampleUrls }))
    .sort((a, b) => b.count - a.count || a.errorCode.localeCompare(b.errorCode));

  const imageUsedCount = attempts.filter((a) => a.ok && a.imageUsed === true).length;

  const durationSum = attempts.reduce((sum, a) => sum + a.durationMs, 0);
  const avgDurationMs = total === 0 ? 0 : Math.round(durationSum / total);
  const maxDurationMs = total === 0 ? 0 : Math.max(...attempts.map((a) => a.durationMs));

  return {
    total,
    succeeded,
    failed,
    successRatePct: total === 0 ? 0 : Math.round((succeeded / total) * 100),
    failureModes,
    imageUsedCount,
    avgDurationMs,
    maxDurationMs,
  };
}

/** The gate threshold, re-exported so the report + tests can't drift from it. */
export const GATE_SUCCESS_THRESHOLD_PCT = 90;
/** The 100-Reel battery size the gate is defined against. */
export const GATE_TARGET_SAMPLE_SIZE = 100;

/** Does this single run's success rate clear the gate's per-run threshold? */
export function runMeetsGateThreshold(summary: ReelAuditSummary): boolean {
  return summary.total > 0 && summary.successRatePct >= GATE_SUCCESS_THRESHOLD_PCT;
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, "\\|");
}

/**
 * Render the run's markdown report body. Pure: the caller passes the date
 * string so the function stays deterministic + testable.
 */
export function renderReport(args: {
  dateIso: string;
  baseUrl: string;
  summary: ReelAuditSummary;
  attempts: ReelAttempt[];
  sampleFixture: boolean;
}): string {
  const { dateIso, baseUrl, summary, attempts, sampleFixture } = args;
  const met = runMeetsGateThreshold(summary);
  const lines: string[] = [
    `# TikTok / Reel parse-rate audit — ${dateIso}`,
    "",
    "**Harness:** `scripts/audit-tiktok-reels.ts` (ENG-7 / ENG-670)  ",
    `**Target:** \`${baseUrl}/api/recipe-import\`  `,
    `**Gate:** ≥${GATE_SUCCESS_THRESHOLD_PCT}% parse over ${GATE_TARGET_SAMPLE_SIZE} Reels — see \`docs/operations/viral-push-gate.md\``,
    "",
  ];

  if (sampleFixture) {
    lines.push(
      "> **Placeholder fixture in use.** This run used the sample URL list, not",
      "> Grace's curated 100-Reel battery. The success rate below is NOT a gate",
      "> reading — replace `scripts/fixtures/reel-urls.sample.json` with the real",
      "> list and re-run before reading this against the gate.",
      "",
    );
  }

  lines.push(
    "## Summary",
    "",
    `- Attempts: **${summary.total}**`,
    `- Parsed (ok): **${summary.succeeded}**`,
    `- Failed: **${summary.failed}**`,
    `- Parse rate: **${summary.successRatePct}%** ${met ? "✅ clears" : "❌ below"} the ${GATE_SUCCESS_THRESHOLD_PCT}% per-run threshold`,
    `- Image actually analysed (of successes): **${summary.imageUsedCount}/${summary.succeeded}**`,
    `- Duration: avg **${summary.avgDurationMs}ms**, max **${summary.maxDurationMs}ms**`,
    "",
    "## Top failure modes",
    "",
  );

  if (summary.failureModes.length === 0) {
    lines.push("_No failures._", "");
  } else {
    lines.push("| Error code | Count | Sample URLs |", "|---|---|---|");
    for (const mode of summary.failureModes) {
      const samples = mode.sampleUrls.map((u) => `\`${escapeCell(u)}\``).join("<br>") || "—";
      lines.push(`| \`${escapeCell(mode.errorCode)}\` | ${mode.count} | ${samples} |`);
    }
    lines.push("");
  }

  lines.push("## Per-attempt detail", "", "| # | URL | Result | Code | Image | ms |", "|---|---|---|---|---|---|");
  attempts.forEach((a, i) => {
    lines.push(
      `| ${i + 1} | \`${escapeCell(a.url)}\` | ${a.ok ? "ok" : "fail"} | ${
        a.errorCode ? `\`${escapeCell(a.errorCode)}\`` : "—"
      } | ${a.imageUsed === null ? "—" : a.imageUsed ? "yes" : "no"} | ${a.durationMs} |`,
    );
  });
  lines.push("");

  return lines.join("\n");
}

/**
 * Map a raw fetch outcome to a normalised `errorCode`. Pure so the runner's
 * branchy transport handling is testable in isolation.
 *
 * `body` is whatever `res.json()` produced (or `null` if it threw / wasn't
 * JSON). `status` is the HTTP status. When the route returns its stable
 * `{ ok:false, error }` contract we surface that code verbatim; otherwise we
 * synthesise one so every failure lands in a bucket.
 */
export function classifyResponse(
  status: number,
  body: unknown,
): { ok: boolean; errorCode: string | null; imageUsed: boolean | null } {
  const obj = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;

  if (status >= 200 && status < 300 && obj?.ok === true) {
    const imageUsed = typeof obj.imageUsed === "boolean" ? (obj.imageUsed as boolean) : null;
    return { ok: true, errorCode: null, imageUsed };
  }

  // Stable contract: { ok:false, error:<code> }
  if (obj && typeof obj.error === "string" && obj.error.trim().length > 0) {
    return { ok: false, errorCode: obj.error, imageUsed: null };
  }

  // 2xx but not the shape we expected.
  if (status >= 200 && status < 300) {
    return { ok: false, errorCode: "bad_response", imageUsed: null };
  }

  return { ok: false, errorCode: `http_${status}`, imageUsed: null };
}
