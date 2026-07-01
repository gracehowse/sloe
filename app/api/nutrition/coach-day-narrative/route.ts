import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { rateLimit } from "@/lib/server/rateLimit";
import { isServerFeatureEnabled } from "@/lib/server/featureFlags";
import { captureRouteError } from "@/lib/observability/captureRouteError";
import { AiBudgetExceededError, callAiText } from "@/lib/server/aiProvider";
import {
  buildCoachDayFacts,
  buildCoachDayUserMessage,
  buildTemplateCoachDayNarrative,
  COACH_DAY_SYSTEM_PROMPT,
  parseCoachDayNarrative,
  type CoachDayNarrativeResult,
} from "@/lib/nutrition/coachDayNarrative";
import { assertOrigin } from "@/lib/api/assertOrigin";

export const runtime = "nodejs";

/**
 * POST /api/nutrition/coach-day-narrative
 *
 * Returns a grounded "Today's read" paragraph for the full Coach screen.
 * Client passes already-computed day totals; AI may only phrase over those facts.
 */

type CoachDayRequestBody = {
  dateLabel?: string;
  caloriesLogged?: number;
  calorieTarget?: number;
  proteinLogged?: number;
  proteinTarget?: number;
  mealsLoggedCount?: number;
  nextMealSlot?: string | null;
};

export async function POST(req: Request) {
  const originErr = assertOrigin(req);
  if (originErr) return originErr;

  const killAi = await isServerFeatureEnabled("kill_coach_day_narrative_ai").catch(
    () => false,
  );

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit({
    keyPrefix: "api:coach-day-narrative",
    userId,
    limit: 90,
    windowMs: 60 * 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: CoachDayRequestBody;
  try {
    body = (await req.json()) as CoachDayRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const dateLabel = typeof body.dateLabel === "string" ? body.dateLabel.trim() : "";
  if (!dateLabel) {
    return NextResponse.json({ ok: false, error: "missing_date_label" }, { status: 400 });
  }

  const facts = buildCoachDayFacts({
    dateLabel,
    caloriesLogged: Number(body.caloriesLogged) || 0,
    calorieTarget: Number(body.calorieTarget) || 0,
    proteinLogged: Number(body.proteinLogged) || 0,
    proteinTarget: Number(body.proteinTarget) || 0,
    mealsLoggedCount: Number(body.mealsLoggedCount) || 0,
    nextMealSlot:
      typeof body.nextMealSlot === "string" ? body.nextMealSlot : body.nextMealSlot ?? null,
  });

  const template = buildTemplateCoachDayNarrative(facts);
  if (killAi) {
    return templateResponse(template);
  }

  try {
    const aiResult = await callAiText({
      callSite: "coach-day-narrative",
      userId,
      systemPrompt: COACH_DAY_SYSTEM_PROMPT,
      userText: buildCoachDayUserMessage(facts),
      expectJson: true,
      temperature: 0.5,
      maxTokens: 320,
      claudeModel: "claude-haiku-4-5-20251001",
    });

    if (!aiResult.ok) {
      return templateResponse(template);
    }

    const narrative = parseCoachDayNarrative(aiResult.text, facts);
    if (!narrative) {
      return templateResponse(template);
    }

    const result: CoachDayNarrativeResult = { narrative, source: "ai" };
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof AiBudgetExceededError) {
      return templateResponse(template);
    }
    captureRouteError(err, "/api/nutrition/coach-day-narrative", { stage: "narrate" });
    return templateResponse(template);
  }
}

function templateResponse(narrative: string) {
  const result: CoachDayNarrativeResult = { narrative, source: "template" };
  return NextResponse.json({ ok: true, ...result });
}
