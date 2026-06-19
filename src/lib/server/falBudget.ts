/**
 * fal.ai image-generation spend guardrail (ENG-999).
 *
 * Fixed-price image models do not fit the token-based AI budget helper, so this
 * module tracks reserved image spend directly in pence. It enforces hard daily
 * and monthly caps before a fal request is made, emits one 70% alarm per period,
 * and refunds the reservation when the vendor call/download/upload fails.
 */

import { Redis } from "@upstash/redis";

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
  reason: "daily_spend" | "monthly_spend";
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

async function incrBy(key: string, delta: number): Promise<number> {
  const redis = getRedis();
  if (!redis) return memIncrBy(key, delta, COUNTER_TTL_SEC);
  const next = await redis.incrby(key, delta);
  await redis.expire(key, COUNTER_TTL_SEC);
  return next;
}

async function setIfAbsent(key: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) {
    if (memGet(key) > 0) return false;
    memIncrBy(key, 1, COUNTER_TTL_SEC);
    return true;
  }
  return (await redis.set(key, 1, { nx: true, ex: COUNTER_TTL_SEC })) === "OK";
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

  void maybeAlarm("daily", day, dailyAfter, dailyCap);
  void maybeAlarm("monthly", month, monthlyAfter, monthlyCap);

  if (dailyAfter > dailyCap && isFalBudgetEnforcementEnabled()) {
    void incrBy(dailyKey, -reservedPence);
    void incrBy(monthlyKey, -reservedPence);
    return { ok: false, reason: "daily_spend", retryAfterSec: secondsToNextUtcDay() };
  }
  if (monthlyAfter > monthlyCap && isFalBudgetEnforcementEnabled()) {
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
}

export function _readFalBudgetCounterForTest(key: string): number {
  return memGet(key);
}

export const _falBudgetKeysForTest = { spend: spendKey };
