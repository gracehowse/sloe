import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { rateLimit } from "@/lib/server/rateLimit";
import { isServerFeatureEnabled } from "@/lib/server/featureFlags";
import { captureRouteError } from "@/lib/observability/captureRouteError";
import { AiBudgetExceededError, callAiText } from "@/lib/server/aiProvider";
import {
  buildCoachAskFacts,
  buildCoachAskUserMessage,
  buildTemplateCoachAskAnswer,
  COACH_ASK_CHIPS,
  COACH_ASK_SYSTEM_PROMPT,
  parseCoachAskAnswer,
  type CoachAskChipId,
  type CoachAskResult,
} from "@/lib/nutrition/coachAsk";
import { buildCoachDayFacts } from "@/lib/nutrition/coachDayNarrative";
import { assertOrigin } from "@/lib/api/assertOrigin";

export const runtime = "nodejs";

/**
 * POST /api/nutrition/coach-ask
 *
 * Bounded "Ask the coach" chip answers — grounded in the user's day facts.
 */

const VALID_CHIP_IDS = new Set<CoachAskChipId>(COACH_ASK_CHIPS.map((c) => c.id));

type CoachAskRequestBody = {
  chipId?: string;
  dateLabel?: string;
  caloriesLogged?: number;
  calorieTarget?: number;
  proteinLogged?: number;
  proteinTarget?: number;
  mealsLoggedCount?: number;
  nextMealSlot?: string | null;
  topCandidateTitle?: string | null;
  topCandidateCalories?: number | null;
  topCandidateProtein?: number | null;
};

export async function POST(req: Request) {
  const originErr = assertOrigin(req);
  if (originErr) return originErr;

  const killAi = await isServerFeatureEnabled("kill_coach_ask_ai").catch(() => false);

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit({
    keyPrefix: "api:coach-ask",
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

  let body: CoachAskRequestBody;
  try {
    body = (await req.json()) as CoachAskRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const chipId = body.chipId;
  if (!chipId || !VALID_CHIP_IDS.has(chipId as CoachAskChipId)) {
    return NextResponse.json({ ok: false, error: "invalid_chip" }, { status: 400 });
  }

  const dateLabel = typeof body.dateLabel === "string" ? body.dateLabel.trim() : "";
  if (!dateLabel) {
    return NextResponse.json({ ok: false, error: "missing_date_label" }, { status: 400 });
  }

  const dayFacts = buildCoachDayFacts({
    dateLabel,
    caloriesLogged: Number(body.caloriesLogged) || 0,
    calorieTarget: Number(body.calorieTarget) || 0,
    proteinLogged: Number(body.proteinLogged) || 0,
    proteinTarget: Number(body.proteinTarget) || 0,
    mealsLoggedCount: Number(body.mealsLoggedCount) || 0,
    nextMealSlot:
      typeof body.nextMealSlot === "string" ? body.nextMealSlot : body.nextMealSlot ?? null,
  });

  const facts = buildCoachAskFacts({
    ...dayFacts,
    chipId: chipId as CoachAskChipId,
    topCandidateTitle: body.topCandidateTitle,
    topCandidateCalories: body.topCandidateCalories,
    topCandidateProtein: body.topCandidateProtein,
  });

  const template = buildTemplateCoachAskAnswer(facts);
  if (killAi) {
    return templateResponse(template);
  }

  try {
    const aiResult = await callAiText({
      callSite: "coach-ask",
      userId,
      systemPrompt: COACH_ASK_SYSTEM_PROMPT,
      userText: buildCoachAskUserMessage(facts),
      expectJson: true,
      temperature: 0.5,
      maxTokens: 360,
      claudeModel: "claude-haiku-4-5-20251001",
    });

    if (!aiResult.ok) {
      return templateResponse(template);
    }

    const answer = parseCoachAskAnswer(aiResult.text, facts);
    if (!answer) {
      return templateResponse(template);
    }

    const result: CoachAskResult = { answer, source: "ai" };
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof AiBudgetExceededError) {
      return templateResponse(template);
    }
    captureRouteError(err, "/api/nutrition/coach-ask", { stage: "ask" });
    return templateResponse(template);
  }
}

function templateResponse(answer: string) {
  const result: CoachAskResult = { answer, source: "template" };
  return NextResponse.json({ ok: true, ...result });
}
