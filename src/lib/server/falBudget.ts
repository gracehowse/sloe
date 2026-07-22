/**
 * fal.ai image-generation spend guardrail (ENG-999).
 *
 * Fixed-price image models do not fit the token-based AI budget helper, so this
 * module tracks reserved image spend directly in pence. It enforces hard daily
 * and monthly caps before a fal request is made, emits one 70% alarm per period,
 * and refunds the reservation when the vendor call/download/upload fails.
 *
 * Redis fail-policy (ENG-1411): mirrors `aiBudget.ts`'s posture exactly —
 * see that file's top-of-file doc comment for the full rationale.
 *
 *   - First 5 minutes after the first Upstash failure → fail-OPEN (the
 *     reservation is granted with `reservedPence: 0` and is never
 *     registered as a settleable grant, so a later `commitFalImageBudget`/
 *     `releaseFalImageBudget` on it is a silent no-op — same as aiBudget's
 *     synthetic fail-open grant).
 *   - After 5 minutes of sustained failure → fail-CLOSED (the reservation
 *     is denied, reason `"upstash_unavailable"`). This denial is
 *     unconditional — NOT gated by `FAL_BUDGET_ENFORCEMENT_ENABLED` — same
 *     as aiBudget's Upstash-outage deny is independent of
 *     `AI_BUDGET_ENFORCEMENT_ENABLED`: a broken counter can't be trusted to
 *     enforce anything, so a sustained outage denies regardless of the
 *     dark-launch flag.
 *   - Every Redis failure is logged (`console.error`) and reported via
 *     `recordUpstashFailure` (Sentry `warning`/`error` + PostHog event),
 *     tagged `subsystem: "fal_budget"`.
 *   - Fail-open/closed state lives in a module-scope `globalThis` slot, one
 *     independent state machine per Upstash-backed budget module (this file
 *     does not share state with `aiBudget.ts`).
 */

import { Redis } from "@upstash/redis";

import { recordUpstashFailure } from "./upstashMonitoring";

export type FalBudgetPeriod = "daily" | "monthly";
export type FalBudgetGrant = {
  ok: true;
  grantId: string;
  modelId: string;
  imageClass: "hero" | "ingredient";
  reservedPence: number;
  dailyKey: string;
  monthlyKey: string;
};
export type FalBudgetDenied = {
  ok: false;
  reason: "daily_spend" | "monthly_spend" | "upstash_unavailable";
  retryAfterSec: number;
};

const DEFAULT_DAILY_GBP = 10;
const DEFAULT_MONTHLY_GBP = 150;
const ALARM_THRESHOLD = 0.7;
const COUNTER_TTL_SEC = 65 * 24 * 60 * 60;

const MODEL_PRICE_PENCE: Record<string, number> = {
  "fal-ai/nano-banana-pro": 11, // ~$0.13/image at £0.85/$.
  "fal-ai/flux-pro/v2": 3, // ~$0.025/image rounded up.
  "fal-ai/flux/dev": 2,
};
const FALLBACK_PRICE_PENCE = 11;

const g = globalThis as unknown as {
  __pm_falBudgetRedis?: Redis;
  __pm_falBudgetMemStore?: Map<string, { value: number; expiresAtMs: number }>;
  __pm_falBudgetGrants?: Map<string, FalBudgetGrant & { settled: boolean }>;
  __pm_falBudgetUpstashState?: {
    firstFailureAt: number | null;
    /** When set, incrBy/setIfAbsent failures are treated as fail-OPEN. */
    failOpenUntil: number | null;
  };
};

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  if (!g.__pm_falBudgetRedis) g.__pm_falBudgetRedis = new Redis({ url, token });
  return g.__pm_falBudgetRedis;
}

function memStore() {
  if (!g.__pm_falBudgetMemStore) g.__pm_falBudgetMemStore = new Map();
  return g.__pm_falBudgetMemStore;
}

function memIncrBy(key: string, delta: number, ttlSec: number): number {
  const store = memStore();
  const now = Date.now();
  const existing = store.get(key);
  const expiresAtMs = existing && existing.expiresAtMs > now ? existing.expiresAtMs : now + ttlSec * 1000;
  const next = (existing && existing.expiresAtMs > now ? existing.value : 0) + delta;
  store.set(key, { value: next, expiresAtMs });
  return next;
}

function memGet(key: string): number {
  const existing = memStore().get(key);
  if (!existing || existing.expiresAtMs <= Date.now()) return 0;
  return existing.value;
}

// ─────────────────────────────────────────────────────────────────────
// Upstash fail-open / fail-closed state (ENG-1411)
//
// Mirrors `aiBudget.ts`'s `noteUpstashFailure` / `noteUpstashSuccess` /
// `isInFailOpenWindow` exactly — same 5-minute window, same
// console.error + `recordUpstashFailure` alerting shape, same
// "first-failure-anchors-the-window" semantics. Kept as its own
// module-scope state (not shared with aiBudget.ts) since the two
// budgets are independent failure domains.
// ─────────────────────────────────────────────────────────────────────

const FAIL_OPEN_WINDOW_MS = 5 * 60_000;

function upstashState() {
  if (!g.__pm_falBudgetUpstashState) {
    g.__pm_falBudgetUpstashState = { firstFailureAt: null, failOpenUntil: null };
  }
  return g.__pm_falBudgetUpstashState;
}

/**
 * Records an Upstash failure. Within the first 5 minutes we fail-OPEN
 * (allow reservations through); after that we fail-CLOSED (deny). The
 * "open" window is anchored to the first failure so a steady stream of
 * failures over 6 minutes flips closed at minute 5, not perpetually.
 */
function noteUpstashFailure(err: unknown): void {
  const state = upstashState();
  const now = Date.now();
  if (state.firstFailureAt == null) {
    state.firstFailureAt = now;
    state.failOpenUntil = now + FAIL_OPEN_WINDOW_MS;
    console.error("[fal-budget] Upstash failure — entering 5-minute fail-OPEN window", err);
    recordUpstashFailure(
      { subsystem: "fal_budget", mode: "call_threw", operation: "budget_window", failBehavior: "open" },
      err,
    );
  } else if (state.failOpenUntil != null && now > state.failOpenUntil) {
    console.error("[fal-budget] Upstash still failing past fail-open window — failing CLOSED", err);
    recordUpstashFailure(
      { subsystem: "fal_budget", mode: "call_threw", operation: "budget_window", failBehavior: "closed" },
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

/**
 * Returns the counter value after applying `delta`, or `null` when Redis
 * threw (caller treats `null` as "Upstash unhealthy" and applies the
 * fail-open/fail-closed policy above — same contract as aiBudget.ts's
 * `incrBy`). Falls straight to the in-memory store, no try/catch needed,
 * when no Upstash credentials are configured at all (dev/test).
 */
async function incrBy(key: string, delta: number): Promise<number | null> {
  const redis = getRedis();
  if (!redis) return memIncrBy(key, delta, COUNTER_TTL_SEC);
  try {
    const next = await redis.incrby(key, delta);
    // EXPIRE only matters the first time the key is created; setting it
    // every increment is cheap and survives a previous expire being lost.
    await redis.expire(key, COUNTER_TTL_SEC);
    noteUpstashSuccess();
    return next;
  } catch (err) {
    noteUpstashFailure(err);
    return null;
  }
}

/**
 * NX-SET dedupe for the 70% alarm. Returns `false` (not claimed) both
 * when another caller already claimed the key AND when Redis threw — the
 * alarm is best-effort, so a Redis error simply skips this period's
 * alarm rather than escalating (the Upstash failure itself is already
 * alerted via `incrBy`'s `noteUpstashFailure`).
 */
async function setIfAbsent(key: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) {
    if (memGet(key) > 0) return false;
    memIncrBy(key, 1, COUNTER_TTL_SEC);
    return true;
  }
  try {
    const r = await redis.set(key, 1, { nx: true, ex: COUNTER_TTL_SEC });
    noteUpstashSuccess();
    return r === "OK";
  } catch (err) {
    noteUpstashFailure(err);
    return false;
  }
}

function parsePositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function dailyCapPence(): number {
  return parsePositiveIntEnv("FAL_BUDGET_DAILY_GBP", DEFAULT_DAILY_GBP) * 100;
}

function monthlyCapPence(): number {
  return parsePositiveIntEnv("FAL_BUDGET_MONTHLY_GBP", DEFAULT_MONTHLY_GBP) * 100;
}

export function isFalBudgetEnforcementEnabled(): boolean {
  return process.env.FAL_BUDGET_ENFORCEMENT_ENABLED !== "false";
}

export function falImageCostPence(modelId: string): number {
  const price = MODEL_PRICE_PENCE[modelId];
  if (price != null) return price;
  console.warn(`[fal-budget] unknown model "${modelId}" — using Nano fallback price.`);
  return FALLBACK_PRICE_PENCE;
}

function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function utcMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

function secondsToNextUtcDay(now = new Date()): number {
  return Math.max(1, Math.ceil((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime()) / 1000));
}

function secondsToNextUtcMonth(now = new Date()): number {
  return Math.max(1, Math.ceil((Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - now.getTime()) / 1000));
}

function spendKey(period: FalBudgetPeriod, key: string): string {
  return `fal_budget:${period}:${key}`;
}

function alarmKey(period: FalBudgetPeriod, key: string): string {
  return `fal_budget:alarm:${period}:${key}`;
}

function grants() {
  if (!g.__pm_falBudgetGrants) g.__pm_falBudgetGrants = new Map();
  return g.__pm_falBudgetGrants;
}

function newGrantId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `fal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function maybeAlarm(period: FalBudgetPeriod, key: string, used: number, cap: number) {
  if (used < cap * ALARM_THRESHOLD) return;
  if (!(await setIfAbsent(alarmKey(period, key)))) return;
  console.warn(`[fal-budget] ALARM 70% — period=${period} key=${key} used=£${(used / 100).toFixed(2)} cap=£${(cap / 100).toFixed(2)}`);
}

export async function reserveFalImageBudget(args: {
  modelId: string;
  imageClass: "hero" | "ingredient";
}): Promise<FalBudgetGrant | FalBudgetDenied> {
  const reservedPence = falImageCostPence(args.modelId);
  const day = utcDay();
  const month = utcMonth();
  const dailyKey = spendKey("daily", day);
  const monthlyKey = spendKey("monthly", month);
  const dailyAfter = await incrBy(dailyKey, reservedPence);
  const monthlyAfter = await incrBy(monthlyKey, reservedPence);
  const dailyCap = dailyCapPence();
  const monthlyCap = monthlyCapPence();

  // Fail-open-then-closed on Upstash unreachable (ENG-1411) — mirrors
  // aiBudget.ts's `reserveBudget` exactly. At least one of the two
  // increments succeeding counts as "healthy"; both returning `null`
  // means Redis threw for both calls (the same underlying outage), so
  // treat it as one failure rather than two.
  const upstashHealthy = dailyAfter != null || monthlyAfter != null;
  if (!upstashHealthy) {
    if (isInFailOpenWindow()) {
      console.warn("[fal-budget] Upstash unhealthy — failing OPEN (within 5min window)");
      return {
        ok: true,
        grantId: newGrantId(),
        modelId: args.modelId,
        imageClass: args.imageClass,
        reservedPence: 0,
        dailyKey,
        monthlyKey,
      };
    }
    // Past the fail-open window → deny. Unconditional — NOT gated by
    // `isFalBudgetEnforcementEnabled()`. A broken counter can't be
    // trusted to enforce a cap, so a sustained Upstash outage denies
    // regardless of the dark-launch flag, exactly like aiBudget.ts's
    // Upstash-outage deny is independent of `AI_BUDGET_ENFORCEMENT_ENABLED`.
    return {
      ok: false,
      reason: "upstash_unavailable",
      retryAfterSec: secondsToNextUtcDay(),
    };
  }

  void maybeAlarm("daily", day, dailyAfter ?? 0, dailyCap);
  void maybeAlarm("monthly", month, monthlyAfter ?? 0, monthlyCap);

  if (dailyAfter != null && dailyAfter > dailyCap && isFalBudgetEnforcementEnabled()) {
    void incrBy(dailyKey, -reservedPence);
    void incrBy(monthlyKey, -reservedPence);
    return { ok: false, reason: "daily_spend", retryAfterSec: secondsToNextUtcDay() };
  }
  if (monthlyAfter != null && monthlyAfter > monthlyCap && isFalBudgetEnforcementEnabled()) {
    void incrBy(dailyKey, -reservedPence);
    void incrBy(monthlyKey, -reservedPence);
    return { ok: false, reason: "monthly_spend", retryAfterSec: secondsToNextUtcMonth() };
  }

  const grant: FalBudgetGrant = {
    ok: true,
    grantId: newGrantId(),
    modelId: args.modelId,
    imageClass: args.imageClass,
    reservedPence,
    dailyKey,
    monthlyKey,
  };
  grants().set(grant.grantId, { ...grant, settled: false });
  return grant;
}

export async function releaseFalImageBudget(grantId: string): Promise<void> {
  const grant = grants().get(grantId);
  if (!grant || grant.settled) return;
  grant.settled = true;
  void incrBy(grant.dailyKey, -grant.reservedPence);
  void incrBy(grant.monthlyKey, -grant.reservedPence);
}

export function commitFalImageBudget(grantId: string): void {
  const grant = grants().get(grantId);
  if (!grant || grant.settled) return;
  grant.settled = true;
}

export function _resetFalBudgetForTest(): void {
  g.__pm_falBudgetMemStore = new Map();
  g.__pm_falBudgetGrants = new Map();
  delete g.__pm_falBudgetRedis;
  g.__pm_falBudgetUpstashState = { firstFailureAt: null, failOpenUntil: null };
}

export function _readFalBudgetCounterForTest(key: string): number {
  return memGet(key);
}

export const _falBudgetKeysForTest = { spend: spendKey, alarm: alarmKey };

/** Test-only — force the Upstash fail-open window into a specific state.
 *  `expired` simulates "Upstash has been down for >5min". Mirrors
 *  aiBudget.ts's `_setFailOpenStateForTest`. */
export function _setFalBudgetFailOpenStateForTest(state: "open" | "expired" | "healthy"): void {
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
