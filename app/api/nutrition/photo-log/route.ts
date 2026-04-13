import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";

export const runtime = "nodejs";

const MAX_BYTES = 6 * 1024 * 1024;

export type PhotoLogItem = {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type PhotoLogResponse = {
  ok: true;
  items: PhotoLogItem[];
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
  const dailyLimit = tier === "pro" ? 100 : tier === "base" ? 50 : 10;

  const limited = await rateLimit({
    keyPrefix: `photo_log_${userId}`,
    limit: dailyLimit,
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
      { ok: false, error: "openai_not_configured", message: "Set OPENAI_API_KEY to enable photo logging." },
      { status: 503 },
    );
  }

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json({ ok: false, error: "expected_multipart" }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing_image" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "file_too_large", maxBytes: MAX_BYTES }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";
  const b64 = buf.toString("base64");
  const dataUrl = `data:${mime};base64,${b64}`;

  const prompt = `You are a nutrition estimation assistant. Analyze this photo of a meal or food items.

For each distinct food item visible, estimate the portion size and provide nutritional values.

Return a single JSON object (no markdown fences):
{
  "items": [
    {
      "name": "food item name",
      "quantity": "estimated portion (e.g. '1 cup', '200g', '1 medium')",
      "calories": number,
      "protein": number (grams),
      "carbs": number (grams),
      "fat": number (grams)
    }
  ]
}

Rules:
- Be specific about food items (e.g. "grilled chicken breast" not just "chicken")
- Use reasonable portion estimates based on visual cues (plate size, utensils for scale)
- Round all numbers to integers
- If you cannot identify a food item, make your best estimate and note it in the name
- Include condiments, sauces, and sides if visible`;

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.2,
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "openai_network_error", message: "Could not reach the AI service. Please try again." },
      { status: 502 },
    );
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
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

  const items: PhotoLogItem[] = (parsed.items ?? []).map((item) => ({
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
    items,
    totalCalories,
    totalProtein,
    totalCarbs,
    totalFat,
  } satisfies PhotoLogResponse);
}
