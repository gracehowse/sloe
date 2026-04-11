import { NextResponse } from "next/server";
import { parseRecipeFromHtml } from "@/lib/recipe-import/parseRecipeFromHtml";
import {
  detectSocialPlatform,
  fetchSocialPostMeta,
  extractRecipeFromCaption,
} from "@/lib/recipe-import/extractSocialRecipe";
import { rateLimit } from "@/lib/server/rateLimit";

function isAllowedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function isPinterestUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return host === "pinterest.com" || host.endsWith(".pinterest.com") || host === "pin.it";
  } catch {
    return false;
  }
}

function extractOutboundUrlsFromHtml(html: string): string[] {
  const out: string[] = [];
  const hrefs = html.matchAll(/\shref=["']([^"'#\s]+)["']/gi);
  for (const m of hrefs) {
    const href = m[1]?.trim();
    if (!href) continue;
    if (!href.startsWith("http://") && !href.startsWith("https://")) continue;
    out.push(href);
  }
  return out;
}

function isProbablyPinterestInternal(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === "pinterest.com" || host.endsWith(".pinterest.com") || host === "pin.it") return true;
    if (host.endsWith("pinimg.com")) return true;
    return false;
  } catch {
    return true;
  }
}

async function resolvePinterestOutboundUrl(inputUrl: string): Promise<string | null> {
  // Strategy:
  // 1) Follow redirects; if we end up off Pinterest, that final URL is already the outbound URL.
  // 2) If still on Pinterest, fetch HTML and pick the best-looking external href.
  const res = await fetch(inputUrl, {
    redirect: "follow",
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });

  // If the final URL after redirects is not Pinterest, we’re done.
  const finalUrl = res.url;
  if (finalUrl && !isPinterestUrl(finalUrl)) {
    return finalUrl;
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) return null;
  const html = await res.text();

  // Prefer outbound links that clearly include a URL parameter, common in Pinterest linkouts.
  const hrefs = extractOutboundUrlsFromHtml(html);
  const candidates = hrefs
    .map((h) => {
      try {
        const u = new URL(h);
        const maybe = u.searchParams.get("url") || u.searchParams.get("u");
        if (maybe && (maybe.startsWith("http://") || maybe.startsWith("https://"))) {
          return maybe;
        }
      } catch {
        // ignore
      }
      return h;
    })
    .filter((h) => !isProbablyPinterestInternal(h));

  // Heuristic: pick the first candidate that doesn’t look like an ad/analytics redirect.
  const best =
    candidates.find((u) => {
      try {
        const h = new URL(u).hostname.toLowerCase();
        return !h.includes("doubleclick") && !h.includes("googleadservices") && !h.includes("pinterest");
      } catch {
        return false;
      }
    }) ?? candidates[0];

  return best ?? null;
}

export async function POST(req: Request) {
  const rl = await rateLimit({ keyPrefix: "api:recipe-import", limit: 20, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many imports. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const url = typeof body === "object" && body !== null && "url" in body ? String((body as { url: unknown }).url) : "";
  const trimmed = url.trim();
  if (!trimmed || !isAllowedUrl(trimmed)) {
    return NextResponse.json({ ok: false, error: "invalid_url" }, { status: 400 });
  }

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 20000);
  try {
    // Instagram / TikTok: extract caption via meta tags, then parse recipe with OpenAI.
    const socialPlatform = detectSocialPlatform(trimmed);
    if (socialPlatform) {
      const openaiKey = process.env.OPENAI_API_KEY?.trim();
      if (!openaiKey) {
        return NextResponse.json(
          { ok: false, error: "openai_not_configured", message: "Set OPENAI_API_KEY to enable social recipe import." },
          { status: 503 },
        );
      }

      const meta = await fetchSocialPostMeta(trimmed);
      if (!meta || (!meta.caption && !meta.title)) {
        return NextResponse.json(
          {
            ok: false,
            error: "social_no_caption",
            message: `Could not extract content from this ${socialPlatform} post. Try screenshotting the recipe and using image import instead.`,
          },
          { status: 422 },
        );
      }

      const captionText = [meta.title, meta.caption].filter(Boolean).join("\n\n");
      const recipe = await extractRecipeFromCaption(captionText, openaiKey, meta.imageUrl);

      if (!recipe.ingredients.length && !recipe.steps.length) {
        return NextResponse.json(
          {
            ok: false,
            error: "social_no_recipe",
            message: "This post doesn't appear to contain a recipe. Try a different post or use image import.",
          },
          { status: 422 },
        );
      }

      return NextResponse.json({
        ok: true,
        source: socialPlatform,
        recipe: {
          title: recipe.title ?? meta.title ?? "Imported recipe",
          description: null,
          ingredients: recipe.ingredients,
          instructions: recipe.steps,
          servings: recipe.servings,
          prepTimeMin: null,
          cookTimeMin: null,
          imageUrl: meta.imageUrl,
        },
      });
    }

    // Pinterest pins usually link out to the original recipe site. Resolve that first.
    let effectiveUrl = trimmed;
    if (isPinterestUrl(trimmed)) {
      try {
        const outbound = await resolvePinterestOutboundUrl(trimmed);
        if (outbound) {
          effectiveUrl = outbound;
        }
      } catch {
        // If Pinterest resolution fails, fall back to the original URL and let the normal importer handle it.
      }
    }

    const res = await fetch(effectiveUrl, {
      signal: ac.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        // Some publishers block non-browser UAs. Use a mainstream UA to maximize compatibility.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      redirect: "follow",
    });
    const contentType = res.headers.get("content-type") ?? "";
    const isHtml = contentType.toLowerCase().includes("text/html");
    const html = isHtml ? await res.text() : "";
    const parsed = parseRecipeFromHtml(html);
    // Some sites respond with 404/403 while still serving real HTML (geo, bot-mitigation, A/B).
    // If we can extract a Recipe JSON-LD anyway, treat as success.
    if (parsed) {
      return NextResponse.json({ ok: true, recipe: parsed });
    }
    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "fetch_failed",
          status: res.status,
          message:
            res.status === 404
              ? "We fetched the page but it didn’t contain a recipe. Double-check the URL (some sites use a different slug, e.g. ending in “-recipe”)."
              : "We couldn’t fetch a recipe from this URL (some sites block automated imports). Try another URL or paste ingredients manually.",
        },
        { status: 502 },
      );
    }
    if (!isHtml) {
      return NextResponse.json(
        { ok: false, error: "not_html", message: "This URL didn’t return HTML we can parse." },
        { status: 422 },
      );
    }
    if (!parsed) {
      return NextResponse.json(
        {
          ok: false,
          error: "no_recipe_schema",
          message:
            "No Recipe JSON-LD found on this page. Paste ingredients and steps manually, or try another URL.",
        },
        { status: 422 },
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg.includes("abort")) {
      return NextResponse.json({ ok: false, error: "timeout" }, { status: 504 });
    }
    return NextResponse.json({ ok: false, error: "import_failed", message: msg }, { status: 502 });
  } finally {
    clearTimeout(t);
  }
}
