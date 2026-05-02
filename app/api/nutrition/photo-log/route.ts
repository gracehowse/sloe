import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";
import { verifyIngredients } from "@/lib/nutrition/verifyIngredients";
import { FREE_PHOTO_LOG_DAILY_LIMIT } from "@/lib/nutrition/photoLogQuota";

export const runtime = "nodejs";

const MAX_BYTES = 6 * 1024 * 1024;

export type PhotoLogItem = {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence?: number;
  source?: string;
};

export type PhotoLogResponse = {
  ok: true;
  items: PhotoLogItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  confidenceTier: "high" | "medium" | "low";
  /**
   * Free-taster quota signal (2026-05-02 — see
   * `docs/decisions/2026-05-02-photo-log-free-taster.md`). Non-Pro users
   * get `FREE_PHOTO_LOG_DAILY_LIMIT` photo logs per rolling 24h. The
   * value is the *remaining* count after this request was billed; clients
   * use it to render "X free logs remaining today" copy and to decide
   * whether to show the paywall on the *next* attempt. Pro users see
   * `null` — no quota is surfaced to them.
   */
  freeQuotaRemaining: number | null;
};

export async function POST(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const tier = await getUserTier(userId);
  // 2026-05-02 — photo-log free taster (P0). Non-Pro users get
  // `FREE_PHOTO_LOG_DAILY_LIMIT` photo logs per rolling 24h before the
  // paywall lands. Cal AI's growth comes from one free shot; we have
  // the better feature (kcal ranges + verified DB) and previously gated
  // it before the user could taste it. Decision doc:
  // `docs/decisions/2026-05-02-photo-log-free-taster.md`.
  //
  // Server-side enforcement is a separate Upstash bucket
  // (`api:photo-log:free-quota:user:<uid>:<ip>`) so it drains
  // independently of the Pro per-user 100/day bucket below. The Pro
  // bucket still applies on top for Pro users (no double-counting:
  // non-Pro never hits the Pro limiter).
  let freeQuotaRemaining: number | null = null;
  if (tier !== "pro") {
    const freeQuota = await rateLimit({
      keyPrefix: "api:photo-log:free-quota",
      userId,
      limit: FREE_PHOTO_LOG_DAILY_LIMIT,
      windowMs: 24 * 60 * 60_000,
    });
    if (!freeQuota.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "upgrade_required",
          message: `You've used your ${FREE_PHOTO_LOG_DAILY_LIMIT} free photo logs for today. Upgrade to Pro for unlimited.`,
          freeQuotaRemaining: 0,
        },
        { status: 403 },
      );
    }
    freeQuotaRemaining = freeQuota.remaining;
  }

  // P0-6 (2026-04-25): scope per-user via the new `userId` field rather
  // than embedding it in the prefix. Bucket key is now
  // `api:photo-log:user:<uid>:<ip>` — drains independently for each
  // (user, IP) tuple, closing both the IP-rotation bypass and the
  // shared-NAT starvation case.
  //
  // 2026-05-02 — applies to ALL tiers (free 3/day taster + Pro 100/day
  // ceiling). For non-Pro, the free-quota above is the binding cap (3
  // < 100), so this 100/day bucket effectively only constrains Pro.
  // We still apply it universally for defence-in-depth (an attacker
  // who somehow bypasses the free quota still hits this).
  const limited = await rateLimit({
    keyPrefix: "api:photo-log",
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

  // ── Step 1: Use GPT-4o to IDENTIFY foods and portions (not estimate nutrition) ──
  const identifyPrompt = `Analyze this photo of a meal or food items.

For each distinct food item visible, identify the food and estimate the portion size.

Return a single JSON object (no markdown fences):
{
  "items": [
    {
      "name": "specific food name (e.g. 'grilled chicken breast' not just 'chicken')",
      "amount": "numeric amount (e.g. '200', '1', '2')",
      "unit": "unit of measure (e.g. 'g', 'cup', 'medium', 'slice', 'piece')"
    }
  ]
}

Rules:
- Be specific about food items (e.g. "grilled chicken breast" not "chicken")
- Use reasonable portion estimates based on visual cues (plate size, utensils for scale)
- Separate amount and unit (amount should be a number, unit should be the measure)
- Include condiments, sauces, and sides if visible
- If you cannot identify a food item with reasonable confidence, include it with name prefixed with "unknown: "
- Do NOT estimate calories or macros — only identify foods and portions`;

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
              { type: "text", text: identifyPrompt },
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
    return NextResponse.json(
      { ok: false, error: "openai_http_error", status: res.status },
      { status: 502 },
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim() ?? "";

  let parsed: { items?: Array<{ name?: string; amount?: string; unit?: string }> };
  try {
    const cleaned = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
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
      { ok: false, error: "no_food_detected", message: "No food items detected in the photo. Try a clearer angle." },
      { status: 422 },
    );
  }

  // ── Step 2: Run identified foods through verified nutrition pipeline ──
  // This matches against USDA, Open Food Facts, FatSecret with confidence scoring
  try {
    const result = await verifyIngredients({
      ingredients: identified,
      servings: 1,
      provider: "auto",
      overrides: [],
    });

    const items: PhotoLogItem[] = result.verified.map((ing) => ({
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
      items,
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat,
      confidenceTier,
      freeQuotaRemaining,
    } satisfies PhotoLogResponse);
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: "verify_failed",
        message: "Food was identified but nutrition lookup failed. Please try again.",
      },
      { status: 502 },
    );
  }
}
