import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { rateLimit } from "@/lib/server/rateLimit";
import { isServerFeatureEnabled } from "@/lib/server/featureFlags";
import { captureRouteError } from "@/lib/observability/captureRouteError";
import { AiBudgetExceededError, callAiText } from "@/lib/server/aiProvider";
import {
  buildNarrativeFacts,
  buildNarrativeUserMessage,
  buildTemplateNarrative,
  DIGEST_NARRATIVE_SYSTEM_PROMPT,
  parseNarrative,
  type DigestNarrativeResult,
  type MaintenanceMove,
} from "@/lib/nutrition/digestNarrative";

export const runtime = "nodejs";

/**
 * POST /api/nutrition/digest-narrative
 *
 * Takes the already-computed weekly digest payload and returns a warm
 * 2-3 sentence coach narrative (the adaptive-TDEE move story included
 * when it moved). The model is given ONLY computed facts and is
 * forbidden from inventing numbers/claims; output is schema-validated.
 * When AI is unavailable / over budget / off-contract, a deterministic
 * template narrative is returned — the surface never goes empty.
 *
 * Request body (the client passes what its digest already computed):
 *   {
 *     weekLabel: string,
 *     daysLogged: number,
 *     avgCalories: number,
 *     targetCalories: number,
 *     proteinOnTargetDays: number,
 *     closestDayLabel?: string | null,
 *     maintenanceMove?: { direction, previousKcal, newKcal, reason } | null
 *   }
 *
 * Response: { ok: true, narrative: string, source: "ai" | "template" }
 */

type NarrativeRequestBody = {
  weekLabel?: string;
  daysLogged?: number;
  avgCalories?: number;
  targetCalories?: number;
  proteinOnTargetDays?: number;
  closestDayLabel?: string | null;
  maintenanceMove?: Partial<MaintenanceMove> | null;
};

const VALID_DIRECTIONS = new Set<MaintenanceMove["direction"]>(["rose", "fell"]);
const VALID_REASONS = new Set<MaintenanceMove["reason"]>([
  "ate_more_held_weight",
  "ate_less_lost_slower",
  "more_data",
]);

export async function POST(req: Request) {
  const killAi = await isServerFeatureEnabled("kill_digest_narrative_ai").catch(
    () => false,
  );

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit({
    keyPrefix: "api:digest-narrative",
    userId,
    limit: 60,
    windowMs: 60 * 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: NarrativeRequestBody;
  try {
    body = (await req.json()) as NarrativeRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const weekLabel = typeof body.weekLabel === "string" ? body.weekLabel.trim() : "";
  if (!weekLabel) {
    return NextResponse.json(
      { ok: false, error: "missing_week_label" },
      { status: 400 },
    );
  }

  const facts = buildNarrativeFacts({
    weekLabel,
    daysLogged: Number(body.daysLogged) || 0,
    avgCalories: Number(body.avgCalories) || 0,
    targetCalories: Number(body.targetCalories) || 0,
    proteinOnTargetDays: Number(body.proteinOnTargetDays) || 0,
    closestDayLabel:
      typeof body.closestDayLabel === "string" ? body.closestDayLabel : null,
    maintenanceMove: sanitizeMaintenanceMove(body.maintenanceMove),
  });

  // Deterministic template — the fallback AND the answer when AI is off.
  const template = buildTemplateNarrative(facts);

  if (killAi) {
    return templateResponse(template);
  }

  const userMessage = buildNarrativeUserMessage(facts);
  let aiResult;
  try {
    aiResult = await callAiText({
      callSite: "digest-narrative",
      userId,
      systemPrompt: DIGEST_NARRATIVE_SYSTEM_PROMPT,
      userText: userMessage,
      expectJson: true,
      temperature: 0.5,
      maxTokens: 300,
      claudeModel: "claude-haiku-4-5-20251001",
    });
  } catch (err) {
    if (err instanceof AiBudgetExceededError) {
      return templateResponse(template);
    }
    captureRouteError(err, "/api/nutrition/digest-narrative", { stage: "narrate" });
    return templateResponse(template);
  }

  if (!aiResult.ok) {
    return templateResponse(template);
  }

  const narrative = parseNarrative(aiResult.text, facts);
  if (!narrative) {
    // Off-contract output (invented number, banned phrase, unparseable) —
    // use the grounded template instead of risking a bad coach line.
    return templateResponse(template);
  }

  const result: DigestNarrativeResult = { narrative, source: "ai" };
  return NextResponse.json({ ok: true, ...result });
}

function templateResponse(narrative: string) {
  const result: DigestNarrativeResult = { narrative, source: "template" };
  return NextResponse.json({ ok: true, ...result });
}

function sanitizeMaintenanceMove(
  raw: Partial<MaintenanceMove> | null | undefined,
): MaintenanceMove | null {
  if (!raw || typeof raw !== "object") return null;
  const direction = raw.direction;
  const reason = raw.reason;
  const previousKcal = Number(raw.previousKcal);
  const newKcal = Number(raw.newKcal);
  if (!direction || !VALID_DIRECTIONS.has(direction)) return null;
  if (!reason || !VALID_REASONS.has(reason)) return null;
  if (!Number.isFinite(previousKcal) || !Number.isFinite(newKcal)) return null;
  return {
    direction,
    reason,
    previousKcal: Math.round(previousKcal),
    newKcal: Math.round(newKcal),
  };
}
