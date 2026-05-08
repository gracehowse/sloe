import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";
import { verifyIngredients } from "@/lib/nutrition/verifyIngredients";
import { callAiText } from "@/lib/server/aiProvider";

export const runtime = "nodejs";

// 2026-05-08 (`docs/decisions/2026-05-08-food-correction-verification-pipeline.md`):
// migrated from OpenAI gpt-4o-mini to Anthropic Claude Sonnet 4.6 via the
// shared `callAiText` helper. Voice transcription happens on-device
// (expo-speech-recognition) so there's no Whisper dependency to migrate.

export type VoiceLogItem = {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence?: number;
  source?: string;
};

export type VoiceLogResponse = {
  ok: true;
  transcript: string;
  items: VoiceLogItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  confidenceTier: "high" | "medium" | "low";
};

export async function POST(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const tier = await getUserTier(userId);
  // Voice is Pro-only by product intent (mirrors the client gates in
  // `apps/mobile/app/(tabs)/index.tsx` and `voice-log-dialog.tsx`, the
  // `.maestro/08_voice_log.yaml` test, and `docs/journeys/food-tracking.md`).
  // Close the previous Base loophole (2026-04-19 sync-enforcer finding)
  // so the server matches what the UI tells Free + Base users.
  if (tier !== "pro") {
    return NextResponse.json(
      { ok: false, error: "upgrade_required", message: "Voice logging is a Pro feature." },
      { status: 403 },
    );
  }

  // P0-6 (2026-04-25): scope per-user via the new `userId` field
  // (parity with photo-log).
  const limited = await rateLimit({
    keyPrefix: "api:voice-log",
    userId,
    limit: 100,
    windowMs: 24 * 60 * 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: { transcript?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const transcript = body.transcript?.trim();
  if (!transcript) {
    return NextResponse.json({ ok: false, error: "missing_transcript" }, { status: 400 });
  }

  // ── Step 1: Use LLM to PARSE transcript into structured food items
  // (not estimate nutrition — that comes from the verified pipeline). ──
  const parsePrompt = `Parse this food description into individual food items with amounts and units.

Transcript: "${transcript}"

Return a single JSON object (no markdown fences):
{
  "items": [
    {
      "name": "specific food name (e.g. 'scrambled eggs' not just 'eggs')",
      "amount": "numeric amount as string (e.g. '2', '200', '1')",
      "unit": "unit of measure (e.g. 'large', 'g', 'cup', 'slice', 'piece', 'medium')"
    }
  ]
}

Rules:
- Parse natural language quantities ("two eggs" = amount "2", unit "large", name "scrambled eggs")
- "a cup of rice" = amount "1", unit "cup", name "cooked white rice"
- Be specific about preparation when implied ("eggs" for breakfast = "scrambled eggs")
- Separate compound items ("chicken and rice" = two items)
- Do NOT estimate calories or macros — only parse foods and portions`;

  const aiResult = await callAiText({
    callSite: "voice-log",
    userText: parsePrompt,
    expectJson: true,
    temperature: 0.2,
    maxTokens: 1000,
  });
  if (!aiResult.ok) {
    return NextResponse.json(
      { ok: false, error: aiResult.error, message: aiResult.message },
      { status: aiResult.status },
    );
  }

  let parsed: { items?: Array<{ name?: string; amount?: string; unit?: string }> };
  try {
    const cleaned = aiResult.text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
    parsed = JSON.parse(cleaned) as typeof parsed;
  } catch {
    return NextResponse.json(
      { ok: false, error: "unparseable_model_output", message: "The AI returned an unexpected format. Please try again." },
      { status: 502 },
    );
  }

  const identified = (parsed.items ?? []).map((item) => ({
    name: String(item.name ?? "Unknown food").trim(),
    amount: String(item.amount ?? "1").trim(),
    unit: String(item.unit ?? "serving").trim(),
  }));

  if (identified.length === 0) {
    return NextResponse.json(
      { ok: false, error: "no_food_parsed", message: "No food items could be parsed from the transcript. Try again with more detail." },
      { status: 422 },
    );
  }

  // ── Step 2: Run parsed foods through verified nutrition pipeline ──
  try {
    const result = await verifyIngredients({
      ingredients: identified,
      servings: 1,
      provider: "auto",
      overrides: [],
    });

    const items: VoiceLogItem[] = result.verified.map((ing) => ({
      name: ing.matchedName ?? ing.resolved.name ?? "Unknown",
      quantity: `${ing.resolved.amount ?? ""} ${ing.resolved.unit ?? ""}`.trim() || "1 serving",
      calories: Math.round(ing.macros?.calories ?? 0),
      protein: Math.round(ing.macros?.protein ?? 0),
      carbs: Math.round(ing.macros?.carbs ?? 0),
      fat: Math.round(ing.macros?.fat ?? 0),
      confidence: ing.confidence,
      source: ing.source,
    }));

    const totalCalories = items.reduce((a, i) => a + i.calories, 0);
    const totalProtein = items.reduce((a, i) => a + i.protein, 0);
    const totalCarbs = items.reduce((a, i) => a + i.carbs, 0);
    const totalFat = items.reduce((a, i) => a + i.fat, 0);

    const confidenceTier =
      result.avgIngredientConfidence >= 0.75
        ? "high"
        : result.avgIngredientConfidence >= 0.5
          ? "medium"
          : "low";

    return NextResponse.json({
      ok: true,
      transcript,
      items,
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat,
      confidenceTier,
    } satisfies VoiceLogResponse);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "verify_failed",
        message: "Food was parsed but nutrition lookup failed. Please try again.",
      },
      { status: 502 },
    );
  }
}
