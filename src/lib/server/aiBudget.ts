/**
 * AI cost circuit-breaker — Blocker 3 (2026-05-14 production-readiness audit).
 *
 * Two-layer budget enforcement, both Upstash-backed counters:
 *
 *   Layer A — per-user daily call cap.
 *     Default 50 calls / 24h per `user_id`. Configurable via
 *     `AI_BUDGET_PER_USER_DAILY_CALLS`. Resets on UTC day boundary.
 *
 *   Layer B — global daily spend cap (£).
 *     Default £50 / 24h across all users. Configurable via
 *     `AI_BUDGET_GLOBAL_DAILY_GBP`. Resets on UTC day boundary. Spend
 *     is computed from model + token count using the static price
 *     table below.
 *
 * Each AI call:
 *   1. `reserveBudget(userId, modelId, maxOutputTokens, maxInputTokens?)`
 *      computes a worst-case cost from `max_tokens` and reserves it
 *      against both counters. Returns `BudgetGrant` on success,
 *      `BudgetDenied` on cap-exceeded.
 *   2. After the model call: `commitBudget(grantId, actualUsage)`
 *      reconciles the reservation against actual token usage. If the
 *      call used less than reserved, the diff is refunded.
 *   3. On model-call failure: `releaseBudget(grantId)` fully refunds
 *      the reservation.
 *
 * Enforcement (the 503 path) is gated behind the env-flag
 * `AI_BUDGET_ENFORCEMENT_ENABLED` (default `false`). Tracking (counter
 * increments + alarms) ALWAYS runs. This lets Grace dark-launch the
 * counters, eyeball real spend for a week, then turn enforcement on
 * once the cap values are right-sized to legitimate use.
 *
 * Fail-mode on Upstash unreachable:
 *   - First 5 minutes after the first failure → fail-OPEN (counters
 *     short-circuit, calls proceed). Reason: Upstash blip shouldn't
 *     take the product down.
 *   - After 5 minutes of sustained Upstash unavailability → fail-CLOSED
 *     (calls denied). Reason: sustained outage shouldn't be a free pass
 *     for runaway spend.
 *
 * All amounts are tracked in **pence** internally (integer arithmetic)
 * to avoid floating-point drift across thousands of small calls.
 *
 * See `docs/decisions/2026-05-14-ai-cost-circuit-breaker.md`.
 */

import { Redis } from "@upstash/redis";

import { recordUpstashFailure } from "./upstashMonitoring";

// ─────────────────────────────────────────────────────────────────────
// Price table
//
// Source: published vendor prices as of 2026-01 model launches.
//   - Anthropic: https://www.anthropic.com/pricing#anthropic-api
//   - OpenAI:    https://openai.com/api/pricing/
//
// USD → GBP conversion uses a conservative 0.85 GBP/USD rate (i.e.
// $1 = £0.85). This intentionally OVERESTIMATES spend in pounds —
// when the real rate is lower (e.g. £0.78) we have headroom; when it's
// higher (e.g. £0.90) we're already conservative. Re-verify when the
// FX rate drifts more than 10% from 0.85.
//
// Values are in **pence per million tokens**, separately for input
// and output. Stored as integers to avoid float drift.
// ─────────────────────────────────────────────────────────────────────

const USD_TO_GBP = 0.85;

/**
 * Multiplies a USD price (e.g. $3.00 per 1M tokens) by the conversion
 * rate, scaled to pence (× 100). Returns an integer.
 *
 *   priceToPence(3.00)   →   3.00 × 0.85 × 100 = 255 pence / 1M tokens
 *   priceToPence(15.00)  →  15.00 × 0.85 × 100 = 1275 pence / 1M tokens
 */
function priceToPence(usdPerMillionTokens: number): number {
  return Math.round(usdPerMillionTokens * USD_TO_GBP * 100);
}

type ModelPrice = {
  inputPencePerMillion: number;
  outputPencePerMillion: number;
};

/**
 * Hard-coded per-model price table (pence per 1M tokens, in/out).
 * When adding a model, update this table AND mention the new entry in
 * `docs/decisions/2026-05-14-ai-cost-circuit-breaker.md`.
 *
 * Unknown models fall through to `FALLBACK_PRICE` — a deliberately
 * expensive worst-case so the budget never under-counts. If you see
 * `[ai-budget] unknown model` log lines in production, add the model
 * here.
 */
const PRICE_TABLE: Record<string, ModelPrice> = {
  // Anthropic Claude Sonnet 4.5 — $3.00 input, $15.00 output / 1M
  "claude-sonnet-4-5": {
    inputPencePerMillion: priceToPence(3.0),
    outputPencePerMillion: priceToPence(15.0),
  },
  "claude-sonnet-4-5-20250929": {
    inputPencePerMillion: priceToPence(3.0),
    outputPencePerMillion: priceToPence(15.0),
  },
  // Anthropic Claude Haiku 4.5 — $1.00 input, $5.00 output / 1M
  "claude-haiku-4-5": {
    inputPencePerMillion: priceToPence(1.0),
    outputPencePerMillion: priceToPence(5.0),
  },
  // OpenAI GPT-4o — $2.50 input, $10.00 output / 1M
  "gpt-4o": {
    inputPencePerMillion: priceToPence(2.5),
    outputPencePerMillion: priceToPence(10.0),
  },
  // OpenAI GPT-4o-mini — $0.15 input, $0.60 output / 1M
  "gpt-4o-mini": {
    inputPencePerMillion: priceToPence(0.15),
    outputPencePerMillion: priceToPence(0.6),
  },
  // OpenAI GPT-5 — $5.00 input, $25.00 output / 1M (forecast band; if
  // launch pricing differs by >20%, update here).
  "gpt-5": {
    inputPencePerMillion: priceToPence(5.0),
    outputPencePerMillion: priceToPence(25.0),
  },
};

// Worst-case fallback for unknown models — priced as if every call was
// Sonnet 4.5. Conservative on purpose: missing-entry → over-count, not
// under-count.
const FALLBACK_PRICE: ModelPrice = {
  inputPencePerMillion: priceToPence(3.0),
  outputPencePerMillion: priceToPence(15.0),
};

/**
 * Returns the per-million-token price (in pence) for a model id, or a
 * conservative fallback when the model isn't in the table. Logs a
 * warning on unknown models so the table can be updated.
 */
function priceFor(modelId: string): ModelPrice {
  const entry = PRICE_TABLE[modelId];
  if (entry) return entry;
  console.warn(
    `[ai-budget] unknown model "${modelId}" — using fallback (sonnet-4-5 prices). ` +
      `Update PRICE_TABLE in src/lib/server/aiBudget.ts.`,
  );
  return FALLBACK_PRICE;
}

// ─────────────────────────────────────────────────────────────────────
// Cost helpers
// ─────────────────────────────────────────────────────────────────────

/**
 * Compute cost in pence for a given (model, inputTokens, outputTokens)
 * triple. Integer arithmetic throughout — we multiply tokens by
 * price-per-million then divide by 1M, rounding up to the nearest
 * pence to avoid under-counting on small calls.
 */
export function computeCostPence(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = priceFor(modelId);
  // Math.ceil → round UP so a tiny call still costs ≥ 1p in counter terms.
  const inP = Math.ceil((Math.max(0, inputTokens) * price.inputPencePerMillion) / 1_000_000);
  const outP = Math.ceil((Math.max(0, outputTokens) * price.outputPencePerMillion) / 1_000_000);
  return inP + outP;
}

// ─────────────────────────────────────────────────────────────────────
// Env helpers
// ─────────────────────────────────────────────────────────────────────

const DEFAULT_PER_USER_DAILY_CALLS = 50;
const DEFAULT_GLOBAL_DAILY_GBP = 50;

function perUserDailyCallCap(): number {
  const raw = process.env.AI_BUDGET_PER_USER_DAILY_CALLS;
  if (!raw) return DEFAULT_PER_USER_DAILY_CALLS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PER_USER_DAILY_CALLS;
  return n;
}

function globalDailyCapPence(): number {
  const raw = process.env.AI_BUDGET_GLOBAL_DAILY_GBP;
  if (!raw) return DEFAULT_GLOBAL_DAILY_GBP * 100;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_GLOBAL_DAILY_GBP * 100;
  return n * 100;
}

export function isAiBudgetEnforcementEnabled(): boolean {
  return process.env.AI_BUDGET_ENFORCEMENT_ENABLED === "true";
}

// ─────────────────────────────────────────────────────────────────────
// Upstash plumbing
// ─────────────────────────────────────────────────────────────────────

const gUp = globalThis as unknown as {
  __pm_aiBudgetRedis?: Redis;
  __pm_aiBudgetUpstashState?: {
    firstFailureAt: number | null;
    /** When set, all reserve/commit calls short-circuit during fail-open. */
    failOpenUntil: number | null;
  };
  __pm_aiBudgetMemStore?: Map<string, { value: number; expiresAtMs: number }>;
};

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  if (!gUp.__pm_aiBudgetRedis) {
    gUp.__pm_aiBudgetRedis = new Redis({ url, token });
  }
  return gUp.__pm_aiBudgetRedis;
}

function upstashState() {
  if (!gUp.__pm_aiBudgetUpstashState) {
    gUp.__pm_aiBudgetUpstashState = { firstFailureAt: null, failOpenUntil: null };
  }
  return gUp.__pm_aiBudgetUpstashState;
}

const FAIL_OPEN_WINDOW_MS = 5 * 60_000;

/** Test-only — reset Upstash failure state between unit tests. */
export function _resetUpstashStateForTest(): void {
  gUp.__pm_aiBudgetUpstashState = { firstFailureAt: null, failOpenUntil: null };
  gUp.__pm_aiBudgetMemStore = new Map();
}

/**
 * Records a Upstash failure. Within the first 5 minutes we fail-OPEN
 * (allow calls through); after that we fail-CLOSED (deny calls). The
 * "open" window is anchored to the first failure so a steady stream of
 * failures over 6 minutes flips closed at minute 5, not perpetually.
 */
function noteUpstashFailure(err: unknown): void {
  const state = upstashState();
  const now = Date.now();
  if (state.firstFailureAt == null) {
    state.firstFailureAt = now;
    state.failOpenUntil = now + FAIL_OPEN_WINDOW_MS;
    console.error("[ai-budget] Upstash failure — entering 5-minute fail-OPEN window", err);
    recordUpstashFailure(
      { subsystem: "ai_budget", mode: "call_threw", operation: "budget_window", failBehavior: "open" },
      err,
    );
  } else if (state.failOpenUntil != null && now > state.failOpenUntil) {
    // Already past the window — just log; the calling code checks
    // `isInFailOpenWindow()` for the decision.
    console.error("[ai-budget] Upstash still failing past fail-open window — failing CLOSED", err);
    recordUpstashFailure(
      { subsystem: "ai_budget", mode: "call_threw", operation: "budget_window", failBehavior: "closed" },
      err,
    );
  }
}

/** Clear failure state on successful Upstash interaction. */
function noteUpstashSuccess(): void {
  const state = upstashState();
  if (state.firstFailureAt != null) {
    state.firstFailureAt = null;
    state.failOpenUntil = null;
  }
}

function isInFailOpenWindow(): boolean {
  const state = upstashState();
  if (state.failOpenUntil == null) return false;
  return Date.now() <= state.failOpenUntil;
}

// ─────────────────────────────────────────────────────────────────────
// In-memory fallback (dev-only, no Upstash configured)
// ─────────────────────────────────────────────────────────────────────

function memStore(): Map<string, { value: number; expiresAtMs: number }> {
  if (!gUp.__pm_aiBudgetMemStore) {
    gUp.__pm_aiBudgetMemStore = new Map();
  }
  return gUp.__pm_aiBudgetMemStore;
}

function memIncrBy(key: string, delta: number, ttlSec: number): number {
  const store = memStore();
  const now = Date.now();
  const existing = store.get(key);
  const expiresAtMs =
    existing && existing.expiresAtMs > now ? existing.expiresAtMs : now + ttlSec * 1000;
  const next = (existing && existing.expiresAtMs > now ? existing.value : 0) + delta;
  store.set(key, { value: next, expiresAtMs });
  return next;
}

function memGet(key: string): number {
  const store = memStore();
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || existing.expiresAtMs <= now) return 0;
  return existing.value;
}

function memSet(key: string, value: number, ttlSec: number): void {
  memStore().set(key, { value, expiresAtMs: Date.now() + ttlSec * 1000 });
}

// ─────────────────────────────────────────────────────────────────────
// Counter helpers (Upstash + memory fallback, unified API)
// ─────────────────────────────────────────────────────────────────────

const COUNTER_TTL_SEC = 36 * 60 * 60; // 36h — covers UTC reset + replay

async function incrBy(key: string, delta: number): Promise<number | null> {
  const redis = getRedis();
  if (!redis) {
    return memIncrBy(key, delta, COUNTER_TTL_SEC);
  }
  try {
    const next = await redis.incrby(key, delta);
    // EXPIRE only matters the first time the key is created; setting it
    // every increment is cheap and survives the case where the previous
    // expire was lost.
    await redis.expire(key, COUNTER_TTL_SEC);
    noteUpstashSuccess();
    return next;
  } catch (err) {
    noteUpstashFailure(err);
    return null;
  }
}

async function _getValue(key: string): Promise<number | null> {
  const redis = getRedis();
  if (!redis) {
    return memGet(key);
  }
  try {
    const v = (await redis.get<number | string>(key)) ?? 0;
    noteUpstashSuccess();
    return typeof v === "number" ? v : Number.parseInt(String(v), 10) || 0;
  } catch (err) {
    noteUpstashFailure(err);
    return null;
  }
}

async function setIfAbsent(key: string, value: number, ttlSec: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) {
    if (memGet(key) > 0) return false;
    memSet(key, value, ttlSec);
    return true;
  }
  try {
    // NX + EX in a single op — atomic dedupe.
    const r = await redis.set(key, value, { nx: true, ex: ttlSec });
    noteUpstashSuccess();
    return r === "OK";
  } catch (err) {
    noteUpstashFailure(err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Date helpers — counters reset on UTC day boundary
// ─────────────────────────────────────────────────────────────────────

/** YYYY-MM-DD in UTC. Used to bucket counter keys per UTC calendar day. */
export function utcDateKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Seconds until the next UTC midnight (00:00:00 UTC). Used for
 *  client-facing `retry-after` headers when capacity is exhausted. */
export function secondsToUtcMidnight(now: Date = new Date()): number {
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  );
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

// ─────────────────────────────────────────────────────────────────────
// Key helpers
// ─────────────────────────────────────────────────────────────────────

function globalSpendKey(dateKey: string): string {
  return `ai_budget:global:${dateKey}`;
}

function userSpendKey(userId: string, dateKey: string): string {
  return `ai_budget:user:${userId}:${dateKey}`;
}

function userCallsKey(userId: string, dateKey: string): string {
  return `ai_budget:user_calls:${userId}:${dateKey}`;
}

function alarmFiredKey(scope: "global" | "user", id: string, dateKey: string): string {
  return `ai_budget:alarm_fired:${scope}:${id}:${dateKey}`;
}

// ─────────────────────────────────────────────────────────────────────
// 70%-of-cap alarm
//
// Emits a structured log line (and a Sentry warning when @sentry/nextjs
// is wired) the FIRST time a per-day counter crosses 70% of its cap.
// De-duped via an Upstash NX-SET key with the same daily TTL so a
// single alarm fires per UTC day per scope.
// ─────────────────────────────────────────────────────────────────────

const ALARM_THRESHOLD = 0.7;

type AlarmScope = "global" | "user";

async function fireAlarmOnce(args: {
  scope: AlarmScope;
  scopeId: string;
  dateKey: string;
  used: number;
  cap: number;
  unit: "calls" | "pence";
}): Promise<void> {
  const { scope, scopeId, dateKey, used, cap, unit } = args;
  const claimed = await setIfAbsent(alarmFiredKey(scope, scopeId, dateKey), 1, COUNTER_TTL_SEC);
  if (!claimed) return;

  const usedDisplay = unit === "pence" ? `£${(used / 100).toFixed(2)}` : `${used}`;
  const capDisplay = unit === "pence" ? `£${(cap / 100).toFixed(2)}` : `${cap}`;
  const pct = Math.round((used / cap) * 100);
  const tag = scope === "global" ? "global_spend" : `user:${scopeId}`;
  console.warn(
    `[ai-budget] ALARM 70% — scope=${tag} date=${dateKey} used=${usedDisplay} cap=${capDisplay} pct=${pct}%`,
  );

  // Best-effort Sentry breadcrumb so the alarm shows up in the
  // operational dashboard alongside other warnings. Wrapped in
  // try/catch + dynamic import so units that don't initialise Sentry
  // (tests, local dev) don't break.
  try {
    const Sentry = await import("@sentry/nextjs").catch(() => null);
    if (Sentry && typeof Sentry.captureMessage === "function") {
      Sentry.captureMessage(`AI budget 70% threshold crossed — ${tag}`, {
        level: "warning",
        tags: {
          ai_budget_scope: scope,
          ai_budget_date: dateKey,
        },
        extra: {
          scopeId,
          used: usedDisplay,
          cap: capDisplay,
          pct,
        },
      });
    }
  } catch {
    // Swallow — Sentry alarm is best-effort, not load-bearing.
  }
}

async function maybeFireAlarms(args: {
  userId: string | null;
  userCallsUsed: number;
  userCallsCap: number;
  globalSpendUsed: number;
  globalSpendCap: number;
  dateKey: string;
}): Promise<void> {
  const {
    userId,
    userCallsUsed,
    userCallsCap,
    globalSpendUsed,
    globalSpendCap,
    dateKey,
  } = args;
  if (globalSpendUsed >= globalSpendCap * ALARM_THRESHOLD) {
    await fireAlarmOnce({
      scope: "global",
      scopeId: "all",
      dateKey,
      used: globalSpendUsed,
      cap: globalSpendCap,
      unit: "pence",
    });
  }
  if (userId && userCallsUsed >= userCallsCap * ALARM_THRESHOLD) {
    await fireAlarmOnce({
      scope: "user",
      scopeId: userId,
      dateKey,
      used: userCallsUsed,
      cap: userCallsCap,
      unit: "calls",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────
// Grant lifecycle
// ─────────────────────────────────────────────────────────────────────

export type BudgetGrant = {
  ok: true;
  grantId: string;
  /** Reserved cost in pence (worst-case from max_tokens). Used by
   *  `commitBudget` to compute the refund delta when the call comes
   *  back under-spent. */
  reservedPence: number;
  /** Date key (UTC) the grant was issued under. Used to address the
   *  same counter when committing/releasing. */
  dateKey: string;
  /** Captured fields for reconciliation. */
  userId: string | null;
  modelId: string;
};

export type BudgetDenied = {
  ok: false;
  /** Which layer denied. */
  reason: "per_user_calls" | "global_spend";
  /** Counter-only mode (enforcement flag off) — counter incremented
   *  but caller MUST NOT block. Always `false` when enforcement is on. */
  shadow: boolean;
  /** Hint for the user: seconds to UTC midnight (when caps reset). */
  retryAfterSec: number;
};

/**
 * The in-memory record of active grants so `commitBudget` can locate
 * the original reservation. Keyed by `grantId` (uuid-shaped). Lives at
 * module scope (per Node worker) — a grant lost to a process restart
 * is just leaked overhead, never a missed refund that overspends.
 */
type GrantRecord = {
  reservedPence: number;
  dateKey: string;
  userId: string | null;
  modelId: string;
  /** When set, this grant has already been committed/released. Used
   *  to prevent double-refunds. */
  settled: boolean;
};

const gGrants = globalThis as unknown as { __pm_aiBudgetGrants?: Map<string, GrantRecord> };
function grantStore(): Map<string, GrantRecord> {
  if (!gGrants.__pm_aiBudgetGrants) gGrants.__pm_aiBudgetGrants = new Map();
  return gGrants.__pm_aiBudgetGrants;
}

function newGrantId(): string {
  // crypto.randomUUID is available in Node 18+ (Vercel runtime).
  // Fallback to time + random for any environment without it.
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `g-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Reserve worst-case cost against both budget counters. Always
 * increments the counters; only RETURNS a `BudgetDenied` when
 * enforcement is on AND a cap was exceeded.
 *
 * @param userId  Supabase user id. Pass `null` only for genuinely
 *                system-level calls (cron jobs, etc.). System calls
 *                skip the per-user layer but still count against the
 *                global spend cap.
 * @param modelId The vendor model id (e.g. `claude-sonnet-4-5-20250929`).
 * @param maxOutputTokens The `max_tokens` value the caller will pass.
 * @param maxInputTokens  Optional estimate of input tokens (we don't
 *                see the prompt here, so the caller can supply a
 *                conservative ceiling). When omitted, defaults to
 *                4× the output cap — a rough worst-case for vision
 *                calls where the image dominates the input.
 */
export async function reserveBudget(
  userId: string | null,
  modelId: string,
  maxOutputTokens: number,
  maxInputTokens?: number,
): Promise<BudgetGrant | BudgetDenied> {
  const inputCeiling = Math.max(0, maxInputTokens ?? maxOutputTokens * 4);
  const reservedPence = computeCostPence(modelId, inputCeiling, Math.max(0, maxOutputTokens));
  const dateKey = utcDateKey();
  const enforcement = isAiBudgetEnforcementEnabled();

  // Fail-open short-circuit — if Upstash is in the open window AND
  // we have no Redis (or recent failures), don't block.
  // We let the increments below try anyway — if they succeed, great;
  // if they fail, we stay in the open window.

  const userCallsCap = perUserDailyCallCap();
  const globalCapPence = globalDailyCapPence();

  // Layer A: per-user daily call count.
  let userCallsAfter: number | null = null;
  if (userId) {
    userCallsAfter = await incrBy(userCallsKey(userId, dateKey), 1);
  }

  // Layer B: global spend.
  const globalSpendAfter = await incrBy(globalSpendKey(dateKey), reservedPence);

  // Best-effort: also track per-user spend (useful for ops; not used
  // for enforcement decisions).
  if (userId) {
    void incrBy(userSpendKey(userId, dateKey), reservedPence);
  }

  // If Upstash failed during a fail-open window, allow through.
  const upstashHealthy = userCallsAfter != null || globalSpendAfter != null;
  if (!upstashHealthy) {
    if (isInFailOpenWindow()) {
      console.warn("[ai-budget] Upstash unhealthy — failing OPEN (within 5min window)");
      return {
        ok: true,
        grantId: newGrantId(),
        reservedPence: 0,
        dateKey,
        userId,
        modelId,
      };
    }
    // Past the fail-open window → deny.
    return {
      ok: false,
      reason: "global_spend",
      shadow: !enforcement,
      retryAfterSec: secondsToUtcMidnight(),
    };
  }

  // Alarms: fire-and-forget at 70% threshold (de-duped per day).
  void maybeFireAlarms({
    userId,
    userCallsUsed: userCallsAfter ?? 0,
    userCallsCap,
    globalSpendUsed: globalSpendAfter ?? 0,
    globalSpendCap: globalCapPence,
    dateKey,
  });

  // Cap check — per-user calls.
  if (userId && userCallsAfter != null && userCallsAfter > userCallsCap) {
    console.warn(
      `[ai-budget] per-user cap exceeded — user=${userId} used=${userCallsAfter} cap=${userCallsCap} ` +
        `enforcement=${enforcement ? "on" : "off"}`,
    );
    if (!enforcement) {
      // Counter-only mode: still grant. Refund this reservation
      // immediately so dry-run doesn't pollute the spend counter when
      // the model call fails downstream. Actually we WANT to count
      // shadow spend so Grace can see the trace — keep it on the
      // counter.
      return {
        ok: true,
        grantId: registerGrant({ reservedPence, dateKey, userId, modelId }),
        reservedPence,
        dateKey,
        userId,
        modelId,
      };
    }
    // Refund the increments since we're denying.
    if (userId) void incrBy(userCallsKey(userId, dateKey), -1);
    void incrBy(globalSpendKey(dateKey), -reservedPence);
    if (userId) void incrBy(userSpendKey(userId, dateKey), -reservedPence);
    return {
      ok: false,
      reason: "per_user_calls",
      shadow: false,
      retryAfterSec: secondsToUtcMidnight(),
    };
  }

  // Cap check — global spend.
  if (globalSpendAfter != null && globalSpendAfter > globalCapPence) {
    console.warn(
      `[ai-budget] global cap exceeded — used=${globalSpendAfter}p cap=${globalCapPence}p ` +
        `enforcement=${enforcement ? "on" : "off"}`,
    );
    if (!enforcement) {
      return {
        ok: true,
        grantId: registerGrant({ reservedPence, dateKey, userId, modelId }),
        reservedPence,
        dateKey,
        userId,
        modelId,
      };
    }
    if (userId) void incrBy(userCallsKey(userId, dateKey), -1);
    void incrBy(globalSpendKey(dateKey), -reservedPence);
    if (userId) void incrBy(userSpendKey(userId, dateKey), -reservedPence);
    return {
      ok: false,
      reason: "global_spend",
      shadow: false,
      retryAfterSec: secondsToUtcMidnight(),
    };
  }

  return {
    ok: true,
    grantId: registerGrant({ reservedPence, dateKey, userId, modelId }),
    reservedPence,
    dateKey,
    userId,
    modelId,
  };
}

function registerGrant(rec: Omit<GrantRecord, "settled">): string {
  const id = newGrantId();
  grantStore().set(id, { ...rec, settled: false });
  return id;
}

/**
 * Reconcile a reservation against actual token usage. Refunds any
 * over-reservation back to the counters. If the actual usage was
 * higher than reserved (shouldn't happen given `max_tokens`), accept
 * the over-spend without adjustment — the counter already reflects
 * the worst case.
 */
export async function commitBudget(
  grantId: string,
  actualUsage: { inputTokens: number; outputTokens: number },
): Promise<void> {
  const store = grantStore();
  const grant = store.get(grantId);
  if (!grant) {
    // Could be a fail-open synthetic grant — silently accept.
    return;
  }
  if (grant.settled) return;
  grant.settled = true;

  const actualPence = computeCostPence(
    grant.modelId,
    actualUsage.inputTokens,
    actualUsage.outputTokens,
  );
  const refund = grant.reservedPence - actualPence;
  if (refund > 0) {
    void incrBy(globalSpendKey(grant.dateKey), -refund);
    if (grant.userId) {
      void incrBy(userSpendKey(grant.userId, grant.dateKey), -refund);
    }
  }
  // Don't delete the record — keep it briefly so a double-commit
  // (defensive caller) is a no-op. The map is per-process and the GC
  // never trims old entries; if we ever care about footprint, prune
  // entries older than 36h here.
}

/**
 * Refund the FULL reservation back to the counters. Called when the
 * AI call failed before the model returned a usage payload (network
 * error, vendor 5xx, timeout) — we shouldn't charge the user for a
 * call we never made.
 */
export async function releaseBudget(grantId: string): Promise<void> {
  const store = grantStore();
  const grant = store.get(grantId);
  if (!grant) return;
  if (grant.settled) return;
  grant.settled = true;

  if (grant.reservedPence > 0) {
    void incrBy(globalSpendKey(grant.dateKey), -grant.reservedPence);
    if (grant.userId) {
      void incrBy(userSpendKey(grant.userId, grant.dateKey), -grant.reservedPence);
      // Refund the per-user call count too — failed call shouldn't
      // count toward the daily cap.
      void incrBy(userCallsKey(grant.userId, grant.dateKey), -1);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Public errors
// ─────────────────────────────────────────────────────────────────────

/**
 * Thrown by `callAiVision` / `callAiText` when the budget reservation
 * denies the call. Route handlers should catch and return HTTP 503
 * with the `ai_capacity_reached` code and a `Retry-After` header.
 */
export class AiBudgetExceededError extends Error {
  readonly reason: "per_user_calls" | "global_spend";
  readonly retryAfterSec: number;
  constructor(reason: "per_user_calls" | "global_spend", retryAfterSec: number) {
    super(`AI budget exceeded — ${reason}`);
    this.name = "AiBudgetExceededError";
    this.reason = reason;
    this.retryAfterSec = retryAfterSec;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Test-only inspectors
// ─────────────────────────────────────────────────────────────────────

/** Test-only — read the in-memory counter (Upstash-disabled mode).
 *  Returns 0 when the key is unset/expired. */
export function _readCounterForTest(key: string): number {
  return memGet(key);
}

/** Test-only — clear all in-memory counters. Used by `beforeEach`. */
export function _resetCountersForTest(): void {
  gUp.__pm_aiBudgetMemStore = new Map();
  gGrants.__pm_aiBudgetGrants = new Map();
}

/** Test-only — internal key constructors so tests can assert exact
 *  key shapes (regression guard against an accidental key rename
 *  silently losing existing counters across deploys). */
export const _keyComposersForTest = {
  globalSpend: globalSpendKey,
  userSpend: userSpendKey,
  userCalls: userCallsKey,
  alarmFired: alarmFiredKey,
};

/** Test-only — force the Upstash fail-open window into a specific
 *  state. `expired` simulates "Upstash has been down for >5min". */
export function _setFailOpenStateForTest(state: "open" | "expired" | "healthy"): void {
  const s = upstashState();
  const now = Date.now();
  if (state === "open") {
    s.firstFailureAt = now;
    s.failOpenUntil = now + FAIL_OPEN_WINDOW_MS;
  } else if (state === "expired") {
    s.firstFailureAt = now - FAIL_OPEN_WINDOW_MS - 1000;
    s.failOpenUntil = now - 1000;
  } else {
    s.firstFailureAt = null;
    s.failOpenUntil = null;
  }
}
