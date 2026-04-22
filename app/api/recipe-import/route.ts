import { NextResponse } from "next/server";
import { classifyMealType } from "@/lib/recipe-import/classifyMealType";
import { parseRecipeFromHtml, siteNameFromUrl } from "@/lib/recipe-import/parseRecipeFromHtml";
import {
  detectSocialPlatform,
  fetchSocialPostMeta,
  extractRecipeFromCaption,
  socialImportSourceName,
  extractCommentsFromHtml,
} from "@/lib/recipe-import/extractSocialRecipe";
import { rateLimit } from "@/lib/server/rateLimit";
import { verifyIngredients, parseRawIngredients } from "@/lib/nutrition/verifyIngredients";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { normaliseSource } from "@/lib/recipes/persistSourceAttribution";

/** Block private/reserved IP ranges to prevent SSRF attacks. */
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  // Localhost
  if (h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1") return true;
  // IPv4 private ranges
  if (/^10\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  // Link-local
  if (/^169\.254\./.test(h)) return true;
  // IPv6 private
  if (h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("fc")) return true;
  // Metadata endpoints (cloud providers)
  if (h === "metadata.google.internal" || h === "169.254.169.254") return true;
  // IPv6-mapped IPv4 private addresses (e.g. ::ffff:10.0.0.1, ::ffff:169.254.169.254)
  if (/^::ffff:/.test(h)) {
    const mapped = h.replace("::ffff:", "");
    if (/^10\./.test(mapped) || /^172\.(1[6-9]|2\d|3[01])\./.test(mapped) || /^192\.168\./.test(mapped) || /^169\.254\./.test(mapped) || mapped === "127.0.0.1") return true;
  }
  return false;
}

function isAllowedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (isPrivateHost(u.hostname)) return false;
    return true;
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

  // If the final URL after redirects is not Pinterest, we're done.
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

  // Heuristic: pick the first candidate that doesn't look like an ad/analytics redirect.
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

// Vercel serverless: allow up to 50s for social imports with video transcription
export const maxDuration = 50;

export async function POST(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

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

  const socialPlatform = detectSocialPlatform(trimmed);
  const ac = new AbortController();
  // Social imports need more headroom for video download + Whisper transcription
  const t = setTimeout(() => ac.abort(), socialPlatform ? 45000 : 20000);
  try {
    // Instagram / TikTok: extract caption via meta tags, then parse recipe with OpenAI.
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
      let recipe = await extractRecipeFromCaption(captionText, openaiKey, meta.imageUrl);

      // Tier 2: Try augmenting with Instagram comments from embedded HTML
      if (!recipe.ingredients.length && !recipe.steps.length) {
        if (meta.platform === "instagram" && meta.rawHtml) {
          const commentText = extractCommentsFromHtml(meta.rawHtml);
          if (commentText) {
            const augmentedCaption = captionText + "\n\n--- Comments ---\n" + commentText;
            recipe = await extractRecipeFromCaption(augmentedCaption, openaiKey, meta.imageUrl);
          }
        }
      }

      // Tier 3: (removed) Video audio transcription via Whisper.
      // Downloading Instagram/TikTok video content and transcribing its audio
      // is a reproduction of the audio track (17 USC § 106(1)) and typically
      // violates the platforms' terms of service. Removed on IP-counsel
      // advice (2026-04-19). Users whose recipe is only in a video caption
      // can paste the caption text manually into the importer.

      // Tier 4: If still no recipe, look for a URL in the caption and scrape the website
      if (!recipe.ingredients.length && !recipe.steps.length) {
        const urlMatch = captionText.match(/https?:\/\/[^\s"'<>]+/i)
          ?? meta.caption?.match(/https?:\/\/[^\s"'<>]+/i);
        let websiteRecipe: ReturnType<typeof parseRecipeFromHtml> = null;
        if (urlMatch) {
          try {
            const linkUrl = urlMatch[0].replace(/[.,;!?)]+$/, "");
            if (isAllowedUrl(linkUrl)) {
              const linkRes = await fetch(linkUrl, {
                signal: ac.signal,
                headers: {
                  Accept: "text/html",
                  "User-Agent": "SupprBot/1.0 (+https://suppr-club.com/bot)",
                },
                redirect: "follow",
              });
              if (linkRes.ok) {
                const html = await linkRes.text();
                websiteRecipe = parseRecipeFromHtml(html);
              }
            }
          } catch { /* link fetch failed — continue to error */ }
        }

        if (websiteRecipe && websiteRecipe.ingredients?.length) {
          // Successfully scraped from linked website — use it
          const ingList = Array.isArray(websiteRecipe.ingredients) ? websiteRecipe.ingredients.map(String) : [];
          const srv = websiteRecipe.servings ?? 1;
          const parsedIngs = parseRawIngredients(ingList);
          let nutrition: Awaited<ReturnType<typeof verifyIngredients>> | null = null;
          try {
            nutrition = await verifyIngredients({ ingredients: parsedIngs, servings: srv });
          } catch { /* verification optional */ }

          const mealType = classifyMealType({
            title: websiteRecipe.title,
            ingredients: ingList,
            caloriesPerServing: websiteRecipe.siteNutrition?.calories ?? null,
            caption: captionText,
          });

          const linkedAttribution = normaliseSource({
            url: trimmed,
            name: websiteRecipe.sourceName ?? siteNameFromUrl(trimmed),
          });

          return NextResponse.json({
            ok: true,
            recipe: {
              title: websiteRecipe.title,
              description: websiteRecipe.description,
              ingredients: ingList,
              instructions: websiteRecipe.instructions ?? [],
              servings: srv,
              prepTimeMin: websiteRecipe.prepTimeMin,
              cookTimeMin: websiteRecipe.cookTimeMin,
              imageUrl: meta.imageUrl ?? websiteRecipe.imageUrl,
              sourceUrl: linkedAttribution.source_url,
              sourceName: linkedAttribution.source_name,
              mealType,
              calories: nutrition?.perServing.calories ?? websiteRecipe.siteNutrition?.calories ?? 0,
              protein: nutrition?.perServing.protein ?? websiteRecipe.siteNutrition?.protein ?? 0,
              carbs: nutrition?.perServing.carbs ?? websiteRecipe.siteNutrition?.carbs ?? 0,
              fat: nutrition?.perServing.fat ?? websiteRecipe.siteNutrition?.fat ?? 0,
              fiberG: nutrition?.perServing.fiberG ?? websiteRecipe.siteNutrition?.fiberG ?? 0,
              sugarG: nutrition?.perServing.sugarG ?? 0,
              sodiumMg: nutrition?.perServing.sodiumMg ?? 0,
              ingredientMacros: nutrition
                ? nutrition.verified.map((v) => ({
                    name: v.input.name,
                    amount: v.resolved.amount,
                    unit: v.resolved.unit,
                    calories: v.macros?.calories ?? 0,
                    protein: v.macros?.protein ?? 0,
                    carbs: v.macros?.carbs ?? 0,
                    fat: v.macros?.fat ?? 0,
                    fiberG: v.macros?.fiberG ?? 0,
                    sugarG: v.macros?.sugarG ?? 0,
                    sodiumMg: v.macros?.sodiumMg ?? 0,
                    source: v.source,
                    confidence: v.confidence,
                    matchedName: v.matchedName ?? null,
                  }))
                : parsedIngs.map((p) => ({
                    name: p.name,
                    amount: p.amount,
                    unit: p.unit,
                    calories: 0,
                    protein: 0,
                    carbs: 0,
                    fat: 0,
                    fiberG: 0,
                    sugarG: 0,
                    sodiumMg: 0,
                    source: "Unverified" as const,
                    confidence: null,
                    matchedName: null,
                  })),
              primarySource: nutrition?.primarySource ?? "Unverified",
              importedFromWebsite: true,
            },
          });
        }

        return NextResponse.json(
          {
            ok: false,
            error: "social_no_recipe",
            message: "This post doesn't appear to contain a recipe. Try a different post or use image import.",
          },
          { status: 422 },
        );
      }

      const servings = recipe.servings ?? 1;
      const parsed = parseRawIngredients(recipe.ingredients);
      let nutrition: Awaited<ReturnType<typeof verifyIngredients>> | null = null;
      try {
        nutrition = await verifyIngredients({ ingredients: parsed, servings });
      } catch (e) {
        console.error("[recipe-import] verifyIngredients failed:", e instanceof Error ? e.message : e);
      }

      const mealType = classifyMealType({
        title: recipe.title ?? meta.title ?? "",
        ingredients: recipe.ingredients,
        caloriesPerServing: nutrition?.perServing.calories ?? null,
        caption: captionText,
      });

      const socialAttribution = normaliseSource({
        url: trimmed,
        name: socialImportSourceName(socialPlatform, trimmed, meta.authorDisplay ?? null, captionText),
      });

      return NextResponse.json({
        ok: true,
        source: socialPlatform,
        recipe: {
          title: recipe.title ?? meta.title ?? "Imported recipe",
          description: null,
          ingredients: recipe.ingredients,
          instructions: recipe.steps,
          servings,
          prepTimeMin: recipe.prepTimeMin ?? null,
          cookTimeMin: recipe.cookTimeMin ?? null,
          imageUrl: meta.imageUrl,
          sourceUrl: socialAttribution.source_url,
          sourceName: socialAttribution.source_name,
          mealType,
          calories: nutrition?.perServing.calories ?? 0,
          protein: nutrition?.perServing.protein ?? 0,
          carbs: nutrition?.perServing.carbs ?? 0,
          fat: nutrition?.perServing.fat ?? 0,
          fiberG: nutrition?.perServing.fiberG ?? 0,
          sugarG: nutrition?.perServing.sugarG ?? 0,
          sodiumMg: nutrition?.perServing.sodiumMg ?? 0,
          ingredientMacros: nutrition
            ? nutrition.verified.map((v) => ({
                name: v.input.name,
                amount: v.resolved.amount,
                unit: v.resolved.unit,
                calories: v.macros?.calories ?? 0,
                protein: v.macros?.protein ?? 0,
                carbs: v.macros?.carbs ?? 0,
                fat: v.macros?.fat ?? 0,
                fiberG: v.macros?.fiberG ?? 0,
                sugarG: v.macros?.sugarG ?? 0,
                sodiumMg: v.macros?.sodiumMg ?? 0,
                source: v.source,
                confidence: v.confidence,
                matchedName: v.matchedName ?? null,
              }))
            : parsed.map((p) => ({
                name: p.name,
                amount: p.amount,
                unit: p.unit,
                calories: 0,
                protein: 0,
                carbs: 0,
                fat: 0,
                fiberG: 0,
                sugarG: 0,
                sodiumMg: 0,
                source: "Unverified" as const,
                confidence: null,
                matchedName: null,
              })),
          primarySource: nutrition?.primarySource ?? "Unverified",
        },
      });
    }

    // Pinterest pins usually link out to the original recipe site. Resolve that first.
    let effectiveUrl = trimmed;
    if (isPinterestUrl(trimmed)) {
      try {
        const outbound = await resolvePinterestOutboundUrl(trimmed);
        if (outbound && isAllowedUrl(outbound)) {
          effectiveUrl = outbound;
        }
      } catch {
        // If Pinterest resolution fails, fall back to the original URL and let the normal importer handle it.
      }
    }

    // Re-validate resolved URL (may have changed via redirect)
    if (!isAllowedUrl(effectiveUrl)) {
      return NextResponse.json({ ok: false, error: "Resolved URL is not allowed." }, { status: 400 });
    }

    // Declared, honest User-Agent: identifies Suppr and links to a public-facing
    // bot page so site operators can contact us or block us cleanly. We do not
    // rotate UAs or impersonate another crawler — that would be evidence of
    // knowing circumvention under CFAA / DMCA § 1201 / platform ToS.
    const fetchHeaders = {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": "SupprBot/1.0 (+https://suppr-club.com/bot)",
    };
    // Follow redirects manually to re-validate each hop against the SSRF allowlist
    let currentUrl = effectiveUrl;
    let res: Response | undefined;
    for (let hop = 0; hop < 5; hop++) {
      res = await fetch(currentUrl, {
        signal: ac.signal,
        headers: fetchHeaders,
        redirect: "manual",
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        const resolved = new URL(location, currentUrl).href;
        if (!isAllowedUrl(resolved)) {
          return NextResponse.json({ ok: false, error: "Redirect target is not allowed." }, { status: 400 });
        }
        currentUrl = resolved;
        continue;
      }
      break;
    }
    if (!res) {
      return NextResponse.json({ ok: false, error: "Failed to fetch URL." }, { status: 502 });
    }
    const contentType = res.headers.get("content-type") ?? "";
    const isHtml = contentType.toLowerCase().includes("text/html");
    const html = isHtml ? await res.text() : "";
    const parsed = parseRecipeFromHtml(html);
    // Some sites respond with 404/403 while still serving real HTML (geo, bot-mitigation, A/B).
    // If we can extract a Recipe JSON-LD anyway, treat as success.
    if (parsed) {
      const ingList = Array.isArray(parsed.ingredients) ? parsed.ingredients.map(String) : [];
      const srv = parsed.servings ?? 1;

      // Use site-provided nutrition (JSON-LD) as initial values
      if (parsed.siteNutrition) {
        const sn = parsed.siteNutrition;
        parsed.calories = sn.calories ?? 0;
        parsed.protein = sn.protein ?? 0;
        parsed.carbs = sn.carbs ?? 0;
        parsed.fat = sn.fat ?? 0;
        (parsed as any).fiberG = sn.fiberG ?? 0;
        (parsed as any).sugarG = sn.sugarG ?? 0;
        (parsed as any).sodiumMg = sn.sodiumMg ?? 0;
        (parsed as any).primarySource = "Site";
      }

      if (ingList.length > 0) {
        const parsedIngs = parseRawIngredients(ingList);
        // Always store parsed quantities so ingredient rows have amount/unit even
        // when FatSecret verification fails (F-66, 2026-04-22: all-zero ingredients
        // when verifyIngredients throws on difficult ingredient lists).
        (parsed as any).ingredientMacros = parsedIngs.map((p) => ({
          name: p.name,
          amount: p.amount,
          unit: p.unit,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiberG: 0,
          sugarG: 0,
          sodiumMg: 0,
          source: "Unverified",
          confidence: null,
          matchedName: null,
        }));
        try {
          const nutrition = await verifyIngredients({ ingredients: parsedIngs, servings: srv });
          // Only overwrite recipe-level macros if the site didn't provide them
          // (site nutrition is typically from a dietitian and more trustworthy)
          if (!parsed.siteNutrition) {
            parsed.calories = nutrition.perServing.calories;
            parsed.protein = nutrition.perServing.protein;
            parsed.carbs = nutrition.perServing.carbs;
            parsed.fat = nutrition.perServing.fat;
            (parsed as any).fiberG = nutrition.perServing.fiberG;
            (parsed as any).sugarG = nutrition.perServing.sugarG;
            (parsed as any).sodiumMg = nutrition.perServing.sodiumMg;
          }
          (parsed as any).ingredientMacros = nutrition.verified.map((v) => ({
            name: v.input.name,
            amount: v.resolved.amount,
            unit: v.resolved.unit,
            calories: v.macros?.calories ?? 0,
            protein: v.macros?.protein ?? 0,
            carbs: v.macros?.carbs ?? 0,
            fat: v.macros?.fat ?? 0,
            fiberG: v.macros?.fiberG ?? 0,
            sugarG: v.macros?.sugarG ?? 0,
            sodiumMg: v.macros?.sodiumMg ?? 0,
            source: v.source,
            confidence: v.confidence,
            matchedName: v.matchedName ?? null,
          }));
          (parsed as any).primarySource = nutrition.primarySource;
        } catch (e) {
          console.error("[recipe-import] nutrition verification failed:", e instanceof Error ? e.message : e);
        }
      }

      const mealType = classifyMealType({
        title: parsed.title,
        ingredients: ingList,
        caloriesPerServing: parsed.calories ?? null,
        caption: [parsed.description, parsed.title].filter(Boolean).join("\n\n"),
      });

      /**
       * Persist both URL and name whenever the URL is known (F-5, `AI-CNKcmy7y`).
       * The web-scrape branch previously returned only `sourceName`, so saves on
       * both platforms inserted rows with a name and no URL — the source card
       * rendered as flat text.
       */
      const attribution = normaliseSource({
        url: currentUrl,
        name:
          typeof parsed.sourceName === "string" && parsed.sourceName.trim().length > 0
            ? parsed.sourceName.trim()
            : siteNameFromUrl(currentUrl),
      });

      return NextResponse.json({
        ok: true,
        recipe: {
          ...parsed,
          mealType,
          sourceUrl: attribution.source_url,
          sourceName: attribution.source_name,
        },
      });
    }
    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "fetch_failed",
          status: res.status,
          message:
            res.status === 404
              ? `We fetched the page but it didn't contain a recipe. Double-check the URL (some sites use a different slug, e.g. ending in "-recipe").`
              : "We couldn't fetch a recipe from this URL (some sites block automated imports). Try another URL or paste ingredients manually.",
        },
        { status: 502 },
      );
    }
    if (!isHtml) {
      return NextResponse.json(
        { ok: false, error: "not_html", message: "This URL didn't return HTML we can parse." },
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
      return NextResponse.json(
        { ok: false, error: "timeout", message: "The recipe page took too long to load. The site may be slow or blocking imports. Try again, or paste the recipe manually." },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "import_failed", message: `Import failed: ${msg}. Try a different URL or paste ingredients manually.` },
      { status: 502 },
    );
  } finally {
    clearTimeout(t);
  }
}
