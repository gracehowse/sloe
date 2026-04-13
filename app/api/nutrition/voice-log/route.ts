import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";

export const runtime = "nodejs";

export type VoiceLogItem = {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type VoiceLogResponse = {
  ok: true;
  transcript: string;
  items: VoiceLogItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
};

export async function POST(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const tier = await getUserTier(userId);
  if (tier === "free") {
    return NextResponse.json(
      { ok: false, error: "upgrade_required", message: "Voice logging is a Base+ feature." },
      { status: 403 },
    );
  }

  const limited = await rateLimit({
    keyPrefix: `voice_log_${userId}`,
    limit: 50,
    windowMs: 24 * 60 * 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "openai_not_configured" },
      { status: 503 },
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

  const prompt = `You are a nutrition estimation assistant. The user described what they ate via voice.

Parse the transcript into individual food items with estimated nutrition per item.

Transcript: "${transcript}"

Return a single JSON object (no markdown fences):
{
  "items": [
    {
      "name": "food item name",
      "quantity": "estimated portion (e.g. '2 large', '1 cup', '200g')",
      "calories": number,
      "protein": number (grams),
      "carbs": number (grams),
      "fat": number (grams)
    }
  ]
}

Rules:
- Parse natural language quantities ("two eggs" = 2 eggs, "a cup of rice" = 1 cup rice)
- Use standard USDA-style nutrition values for common foods
- Round all numbers to integers
- If a food is ambiguous, use the most common preparation (e.g. "eggs" = large scrambled eggs)
- If the transcript is unclear, make your best effort`;

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "openai_network_error", message: "Could not reach the AI service. Please try again." },
      { status: 502 },
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: "openai_http_error", status: res.status },
      { status: 502 },
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim() ?? "";

  let parsed: { items?: Array<{ name?: string; quantity?: string; calories?: number; protein?: number; carbs?: number; fat?: number }> };
  try {
    const cleaned = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
    parsed = JSON.parse(cleaned) as typeof parsed;
  } catch {
    return NextResponse.json(
      { ok: false, error: "unparseable_model_output", message: "The AI returned an unexpected format. Please try again." },
      { status: 502 },
    );
  }

  const items: VoiceLogItem[] = (parsed.items ?? []).map((item) => ({
    name: String(item.name ?? "Unknown food").trim(),
    quantity: String(item.quantity ?? "1 serving").trim(),
    calories: Math.round(Number(item.calories) || 0),
    protein: Math.round(Number(item.protein) || 0),
    carbs: Math.round(Number(item.carbs) || 0),
    fat: Math.round(Number(item.fat) || 0),
  }));

  const totalCalories = items.reduce((a, i) => a + i.calories, 0);
  const totalProtein = items.reduce((a, i) => a + i.protein, 0);
  const totalCarbs = items.reduce((a, i) => a + i.carbs, 0);
  const totalFat = items.reduce((a, i) => a + i.fat, 0);

  return NextResponse.json({
    ok: true,
    transcript,
    items,
    totalCalories,
    totalProtein,
    totalCarbs,
    totalFat,
  } satisfies VoiceLogResponse);
}
