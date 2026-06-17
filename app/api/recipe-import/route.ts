import { NextResponse } from "next/server";
import { classifyMealType } from "@/lib/recipe-import/classifyMealType";
import { parseRecipeFromHtml, siteNameFromUrl } from "@/lib/recipe-import/parseRecipeFromHtml";
import { paraphraseInstructionsArray } from "@/lib/recipes/normaliseRecipeSteps";
import {
  CaptionExtractionError,
  detectSocialPlatform,
  fetchSocialPostMeta,
  extractRecipeFromCaption,
  socialImportSourceName,
  extractCommentsFromHtml,
  sanitiseImportedTitle,
} from "@/lib/recipe-import/extractSocialRecipe";
import { AiBudgetExceededError } from "@/lib/server/aiProvider";
import { rateLimit } from "@/lib/server/rateLimit";
import { verifyIngredients, parseRawIngredients } from "@/lib/nutrition/verifyIngredients";
import { captureRouteError } from "@/lib/observability/captureRouteError";
import { isServerFeatureEnabled } from "@/lib/server/featureFlags";
import { extractCaptionNutrition } from "@/lib/recipe-import/extractCaptionNutrition";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { normaliseSource } from "@/lib/recipes/persistSourceAttribution";
import { deriveImportedRecipeTitle } from "@/lib/recipes/deriveImportedRecipeTitle";
import { importErrorResponse } from "@/lib/recipes/importErrorCopy";
import {
  traceExtraction,
  traceParsing,
  traceNutritionLookup,
  traceCaptionNutrition,
  traceAcquisition,
} from "@/lib/analytics/recipeImportPipelineTrace";
import { isAllowedUrl, followWithSsrfGuard } from "@/lib/recipe-import/ssrfGuard";
import {
  acquireScrapedHtmlRecipe,
  acquireTranscriptCaption,
} from "@/lib/server/supadata/wireAcquisition";
import { hasSupadataConfig } from "@/lib/server/supadata/client";
import { assertOrigin } from "@/lib/api/assertOrigin";

// Supadata acquisition (ENG-994) — the swappable acquisition adapter runs as
// stage 0 (BEFORE the existing extraction) when the `supadata-acquisition`
// flag is on. On any failure the existing path below runs unchanged (old path
// alive in the else). The key is server-only (`SUPADATA_KEY`, no public prefix)
// and lives in `src/lib/server/supadata/` — never in a client bundle.

// SSRF guard (isPrivateHost / isAllowedUrl / followWithSsrfGuard) is shared in
// @/lib/recipe-import/ssrfGuard so both the importer loop and the Pinterest
// resolver re-validate every redirect hop against the same allowlist (ENG-682).

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
  // 1) Follow redirects (each hop allowlist-checked — ENG-682); if we end up
  //    off Pinterest, that final URL is already the outbound URL.
  // 2) If still on Pinterest, fetch HTML and pick the best-looking external href.
  const fetched = await followWithSsrfGuard(inputUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });
  if (!fetched) return null; // entry or a redirect hop hit the SSRF blocklist
  const { res, finalUrl } = fetched;

  // If the final URL after redirects is not Pinterest, we're done.
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
    .filter((h) => !isProbablyPinterestInternal(h))
    // SSRF guard (ENG-682): never hand back a private/reserved or non-http(s) host.
    .filter((h) => isAllowedUrl(h));

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
  const originErr = assertOrigin(req);
  if (originErr) return originErr;

  // 2026-05-16 (ENG-519) — global kill switch. Flip the PostHog flag
  // `kill_recipe_import` to 100% rollout to disable the whole import
  // family (URL, image, caption) without a deploy. Useful if a provider
  // misbehaves or cost runs hot.
  if (await isServerFeatureEnabled("kill_recipe_import")) {
    return NextResponse.json(
      {
        ok: false,
        error: "service_unavailable",
        message: "Recipe import is temporarily unavailable. Try again shortly.",
      },
      { status: 503, headers: { "Retry-After": "300" } },
    );
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // P0-6 (2026-04-25): per-user scoping.
  const rl = await rateLimit({ keyPrefix: "api:recipe-import", userId, limit: 20, windowMs: 60_000 });
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
    // Instagram / TikTok: extract caption via meta tags, then parse recipe via Claude (or OpenAI fallback).
    if (socialPlatform) {
      // 2026-05-08: vendor selection happens inside `extractRecipeFromCaption`
      // via the shared `aiProvider` helper. Just check that *some* AI key
      // is configured before proceeding.
      const { activeVendor } = await import("@/lib/server/aiProvider");
      if (!activeVendor()) {
        return NextResponse.json(
          { ok: false, error: "ai_not_configured", message: "Set ANTHROPIC_API_KEY (preferred) or OPENAI_API_KEY to enable social recipe import." },
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

      let captionText = [meta.title, meta.caption].filter(Boolean).join("\n\n");

      // ENG-994 — Supadata acquisition stage 0 (transcript) for video posts.
      // Behind the `supadata-acquisition` flag. For YouTube this fetches the
      // real transcript (far richer than the oEmbed title alone) and appends it
      // to the caption text the EXISTING extractor already consumes — extraction
      // is unchanged. For TikTok/Instagram the adapter returns `blocked_by_policy`
      // (legal posture 2026-04-30) unless `IG_TT_IMPORT_ENABLED` is on, so this
      // is a no-op fall-through there. Never throws / hangs; on any failure we
      // proceed with the caption-only text below exactly as before.
      if (await isServerFeatureEnabled("supadata-acquisition")) {
        const acq = await acquireTranscriptCaption(trimmed);
        if (acq.ok) {
          traceAcquisition(userId, {
            outcome: "acquired",
            adapter: acq.acquisition.source,
            kind: "transcript",
            platform: acq.acquisition.platform,
            contentChars: acq.data.content.length,
          });
          captionText = [captionText, "--- Transcript ---", acq.data.content].filter(Boolean).join("\n\n");
        } else {
          traceAcquisition(userId, {
            outcome: "fallback",
            adapter: "supadata",
            platform: socialPlatform,
            reason: acq.result.reason,
          });
        }
      }

      let recipe = await extractRecipeFromCaption(captionText, meta.imageUrl, userId);

      // Tier 2: Try augmenting with Instagram comments from embedded HTML
      if (!recipe.ingredients.length && !recipe.steps.length) {
        if (meta.platform === "instagram" && meta.rawHtml) {
          const commentText = extractCommentsFromHtml(meta.rawHtml);
          if (commentText) {
            const augmentedCaption = captionText + "\n\n--- Comments ---\n" + commentText;
            recipe = await extractRecipeFromCaption(augmentedCaption, meta.imageUrl, userId);
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
            // ENG-1037 (SSRF): `linkUrl` comes from the caption of a user-pasted
            // social post — fully attacker-controllable. The prior code did an
            // initial `isAllowedUrl` string check then `fetch(redirect:"follow")`,
            // so a 30x chain could reach 169.254.169.254 / 127.0.0.1 / RFC-1918
            // with no per-hop recheck (the exact ENG-682 metadata-SSRF hole).
            // Route through `followWithSsrfGuard`: manual redirects, every hop
            // re-validated against the allowlist + a DNS re-resolve (ENG-730).
            const linkFetched = await followWithSsrfGuard(linkUrl, {
              signal: ac.signal,
              headers: {
                Accept: "text/html",
                "User-Agent": "SupprBot/1.0 (+https://suppr-club.com/bot)",
              },
            });
            if (linkFetched && linkFetched.res.ok) {
              const html = await linkFetched.res.text();
              websiteRecipe = parseRecipeFromHtml(html);
            }
          } catch { /* link fetch failed — continue to error */ }
        }

        if (websiteRecipe && websiteRecipe.ingredients?.length) {
          // Successfully scraped from linked website — use it
          const ingList = Array.isArray(websiteRecipe.ingredients) ? websiteRecipe.ingredients.map(String) : [];
          const srv = websiteRecipe.servings ?? 1;
          // Recipe-wave (2026-05-10) — per-stage telemetry.
          traceExtraction(userId, "url", "schema_org", {
            ingredientCount: ingList.length,
            stepCount: (websiteRecipe.instructions ?? []).length,
          });
          const parsedIngs = parseRawIngredients(ingList);
          traceParsing(userId, "url", parsedIngs.length);
          let nutrition: Awaited<ReturnType<typeof verifyIngredients>> | null = null;
          try {
            nutrition = await verifyIngredients({ ingredients: parsedIngs, servings: srv });
            traceNutritionLookup(userId, "url", {
              verified: nutrition.verified,
              primarySource: nutrition.primarySource,
              perServing: nutrition.perServing,
              servings: srv,
            });
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
              title: deriveImportedRecipeTitle({
                sanitizedTitle: sanitiseImportedTitle(websiteRecipe.title),
                ingredients: ingList,
                sourceUrl: trimmed,
              }),
              // ENG-857 (P0, legal): this is the web/blog server-fetch posture
              // (a link found in a caption, then scraped). The JSON-LD
              // `description` is the creator's verbatim headnote — protected
              // creative prose (Publications Int'l v. Meredith; UK CDPA).
              // We extract the FACTS (ingredients, steps, times, nutrition) and
              // attribute + link back, but we do NOT persist or render the prose.
              // `extractCaptionNutrition` below still reads the description text
              // for the macro-sanity check; only the stored/rendered field is
              // nulled. See docs/decisions/2026-06-03-recipe-import-posture-part1-part2.md.
              description: null,
              ingredients: ingList,
              instructions: paraphraseInstructionsArray(websiteRecipe.instructions ?? []),
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
              captionNutrition: extractCaptionNutrition(captionText),
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
      // Recipe-wave (2026-05-10) — per-stage telemetry for the social
      // caption branch (Instagram / TikTok / Pinterest etc.).
      traceExtraction(userId, "caption", "ai_caption", {
        ingredientCount: recipe.ingredients.length,
        stepCount: recipe.steps.length,
      });
      const parsed = parseRawIngredients(recipe.ingredients);
      traceParsing(userId, "caption", parsed.length);
      let nutrition: Awaited<ReturnType<typeof verifyIngredients>> | null = null;
      try {
        nutrition = await verifyIngredients({ ingredients: parsed, servings });
        traceNutritionLookup(userId, "caption", {
          verified: nutrition.verified,
          primarySource: nutrition.primarySource,
          perServing: nutrition.perServing,
          servings,
        });
      } catch (e) {
        console.error("[recipe-import] verifyIngredients failed:", e instanceof Error ? e.message : e);
      }
      const captionClaim = extractCaptionNutrition(captionText);
      traceCaptionNutrition(userId, "caption", {
        caloriesPerServing: captionClaim?.caloriesPerServing ?? null,
        proteinG: captionClaim?.proteinG ?? null,
        carbsG: captionClaim?.carbsG ?? null,
        fatG: captionClaim?.fatG ?? null,
      });

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

      // Build 41 (2026-05-01) F-76 follow-up: also sanitise `meta.title`
      // before using it as fallback. Instagram's og:title for a Reel is
      // frequently the entire caption (with hashtags) — without this
      // pass, a null `recipe.title` fell back to that raw caption.
      // Build 44 (2026-05-07): also sanitise `recipe.title` itself —
      // tester `AFVnLJIVdjQY` showed the LLM can still leak caption
      // shape past the prompt rules, so the helper is the only gate
      // we trust at the response boundary.
      const safeTitle = deriveImportedRecipeTitle({
        sanitizedTitle:
          sanitiseImportedTitle(recipe.title) ?? sanitiseImportedTitle(meta.title),
        ingredients: recipe.ingredients,
        sourceUrl: trimmed,
      });

      // Audit I03 (2026-05-05) — filter empty / whitespace-only entries
      // before the empty-recipe check is meaningful. The LLM occasionally
      // emits `[""]` which is truthy on `.length` but renders as a blank
      // line in the saved recipe.
      const filteredIngredients = recipe.ingredients.filter(
        (s) => typeof s === "string" && s.trim().length > 0,
      );
      const filteredSteps = recipe.steps.filter(
        (s) => typeof s === "string" && s.trim().length > 0,
      );

      return NextResponse.json({
        ok: true,
        source: socialPlatform,
        // Audit I05 (2026-05-05) — surface whether the image was
        // actually analysed, vs the silent text-only fallback that
        // OpenAI's CDN-rejection branch produces. `false` means the
        // recipe was extracted from caption alone even though an image
        // was supplied. Mobile/web previews flag this so users can
        // judge confidence.
        imageUsed: recipe.imageUsed,
        recipe: {
          title: safeTitle,
          description: null,
          ingredients: filteredIngredients,
          instructions: paraphraseInstructionsArray(filteredSteps),
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
          captionNutrition: extractCaptionNutrition(captionText),
          // Recipe-vision contract (2026-06-11) — per-ingredient parse-
          // confidence flags from the structured extractor. The review UI
          // surfaces these for explicit confirmation; empty when every line
          // parsed cleanly.
          flaggedIngredients: recipe.flaggedIngredients,
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

    let currentUrl = effectiveUrl;

    // ENG-994 — Supadata acquisition stage 0 (scrape) for general URLs.
    // Behind the `supadata-acquisition` flag. Supadata scrapes the page and the
    // EXISTING `parseRecipeFromHtml` JSON-LD parser runs against its content
    // (extraction unchanged). We short-circuit the manual fetch below ONLY when
    // Supadata's content yields a parseable recipe; if it scraped but found no
    // schema.org Recipe, we fall through to the existing fetch + parse so the
    // live page still gets a shot (old path alive in the else). Never throws /
    // hangs (the client bounds every call with a timeout + bounded retries).
    let supadataHtml: string | null = null;
    if (await isServerFeatureEnabled("supadata-acquisition")) {
      const acq = await acquireScrapedHtmlRecipe(currentUrl);
      if (acq.ok && acq.data.parsed) {
        supadataHtml = acq.data.content;
        traceAcquisition(userId, {
          outcome: "acquired",
          adapter: acq.acquisition.source,
          kind: "scrape",
          platform: acq.acquisition.platform,
          contentChars: acq.data.content.length,
        });
      } else {
        traceAcquisition(userId, {
          outcome: "fallback",
          adapter: "supadata",
          platform: acq.ok ? acq.acquisition.platform : detectSocialPlatform(currentUrl) ?? "blog",
          reason: acq.ok ? "empty" : acq.result.reason,
        });
      }
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
    // ENG-1037 / ENG-730: follow redirects through the shared SSRF guard so
    // every hop is re-validated against the allowlist AND its hostname is
    // re-resolved via DNS (the prior inline loop checked the redirect URL
    // string per hop but never the resolved IP, leaving DNS-rebinding TOCTOU
    // open). `followWithSsrfGuard` returns null for any refusal — a redirect
    // to a private/metadata host, a rebinding DNS answer, or the hop-limit.
    // Skipped entirely when Supadata already supplied page content above.
    let res: Response | undefined;
    if (!supadataHtml) {
      const fetched = await followWithSsrfGuard(currentUrl, {
        signal: ac.signal,
        headers: fetchHeaders,
      });
      if (!fetched) {
        // currentUrl was already isAllowedUrl-validated above, so a null here
        // means a redirect hop / DNS resolution hit the SSRF blocklist.
        return NextResponse.json({ ok: false, error: "Redirect target is not allowed." }, { status: 400 });
      }
      res = fetched.res;
      currentUrl = fetched.finalUrl;
    }
    const contentType = res?.headers.get("content-type") ?? "";
    const isHtml = supadataHtml != null || contentType.toLowerCase().includes("text/html");
    const html = supadataHtml ?? (res && isHtml ? await res.text() : "");
    let parsed = parseRecipeFromHtml(html);
    let recoveredViaSupadata = false;

    // ENG-1055: popular recipe sites (e.g. AllRecipes) often return 402/403 to
    // datacenter egress even with an honest SupprBot UA. When the direct fetch
    // fails and we have no JSON-LD, try Supadata vendor scrape before surfacing
    // fetch_failed — independent of the stage-0 `supadata-acquisition` flag
    // (that flag only gates "try Supadata first"; this is a reliability fallback).
    if (!parsed && !supadataHtml && res && !res.ok && hasSupadataConfig()) {
      const acq = await acquireScrapedHtmlRecipe(currentUrl);
      if (acq.ok && acq.data.parsed) {
        parsed = acq.data.parsed;
        recoveredViaSupadata = true;
        traceAcquisition(userId, {
          outcome: "acquired",
          adapter: acq.acquisition.source,
          kind: "scrape",
          platform: acq.acquisition.platform,
          contentChars: acq.data.content.length,
        });
      } else {
        traceAcquisition(userId, {
          outcome: "fallback",
          adapter: "supadata",
          platform: acq.ok ? acq.acquisition.platform : detectSocialPlatform(currentUrl) ?? "blog",
          reason: acq.ok ? "empty" : acq.result.reason,
        });
      }
    }

    // Some sites respond with 404/403 while still serving real HTML (geo, bot-mitigation, A/B).
    // If we can extract a Recipe JSON-LD anyway, treat as success.
    if (parsed) {
      const ingList = Array.isArray(parsed.ingredients) ? parsed.ingredients.map(String) : [];
      const srv = parsed.servings ?? 1;

      // Recipe-wave (2026-05-10) — extraction telemetry for the HTML
      // scrape branch.
      traceExtraction(userId, "url", "schema_org", {
        ingredientCount: ingList.length,
        stepCount: (parsed.instructions ?? []).length,
      });

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
        traceParsing(userId, "url", parsedIngs.length);
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
          traceNutritionLookup(userId, "url", {
            verified: nutrition.verified,
            primarySource: nutrition.primarySource,
            perServing: nutrition.perServing,
            servings: srv,
          });
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
          // F-76 build 44 (2026-05-07): the spread above includes
          // `parsed.title` from the HTML-scrape branch, which can
          // be a long meta-tag caption. Override with the sanitised
          // value so the response title always passes the helper.
          // ENG-1047: untitled scrapes fall back to first-ingredient → domain.
          title: deriveImportedRecipeTitle({
            sanitizedTitle: sanitiseImportedTitle(parsed.title),
            ingredients: ingList,
            sourceUrl: currentUrl,
          }),
          // ENG-857 (P0, legal): the spread above also carries
          // `parsed.description` — the creator's verbatim JSON-LD headnote,
          // which is protected creative prose (Publications Int'l v. Meredith;
          // UK CDPA). On the web/blog server-fetch path we extract the FACTS
          // (ingredients, steps, times, nutrition) and attribute + link back,
          // but we never persist or render the prose. The override MUST sit
          // after the spread so it wins. The raw `parsed.description` is still
          // fed to `extractCaptionNutrition` below (macro-sanity check only) —
          // that input is unchanged; only the stored/rendered field is nulled.
          // See docs/decisions/2026-06-03-recipe-import-posture-part1-part2.md.
          description: null,
          // ENG-1128 (legal): the spread also carries `parsed.instructions` —
          // verbatim JSON-LD HowToStep prose, which is protected creative
          // expression. Override with sentence-split imperative steps so the
          // creator's narrative step prose is never persisted/rendered (same
          // posture as the `description: null` override directly above).
          instructions: paraphraseInstructionsArray(parsed.instructions ?? []),
          mealType,
          sourceUrl: attribution.source_url,
          sourceName: attribution.source_name,
          // HTML importer: the recipe description is usually the creator's
          // intro text and frequently contains per-serving macro claims.
          // Pulling it through the same extractor means website imports
          // also get the caption-vs-calculated sanity check. (Reads the raw
          // `parsed.description` text — this is the ONLY use of the prose we
          // keep, and it never leaves the server.)
          captionNutrition: extractCaptionNutrition(
            [parsed.description, parsed.title].filter(Boolean).join("\n\n"),
          ),
        },
      });
    }
    // `res` is undefined only when Supadata supplied content above — but that
    // path sets `supadataHtml` solely when `parsed` is truthy, so we never
    // reach this tail without a live `res`. Guard anyway for type-safety.
    if (res && !res.ok && !recoveredViaSupadata) {
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
    // 2026-05-16 (ENG-518): capture every non-trivial error in this
    // route to Sentry. The AI budget + caption-extraction branches are
    // typed expected paths and don't need stack traces (they're product
    // signals, not bugs); they're tagged-but-skipped below. The generic
    // tail catches genuine bugs and gets the full stack.
    // Blocker 3 (2026-05-14) — AI daily budget caps. Surface 503 with
    // Retry-After so mobile + web clients can show a calm "try again
    // later" toast and a "log manually" CTA.
    if (e instanceof AiBudgetExceededError) {
      return NextResponse.json(
        { ...importErrorResponse("ai_capacity_reached"), retryAfterSec: e.retryAfterSec },
        { status: 503, headers: { "Retry-After": String(e.retryAfterSec) } },
      );
    }
    // Audit I02 (2026-05-05) — preserve AI-side rate-limit signal so
    // clients can read `Retry-After` and surface a countdown, instead
    // of flattening every CaptionExtractionError into "import_failed".
    if (e instanceof CaptionExtractionError) {
      const status = e.code === "ai_rate_limited" ? 429 : 502;
      const headers: Record<string, string> = {};
      if (e.retryAfterSec != null) headers["Retry-After"] = String(e.retryAfterSec);
      else if (e.code === "ai_rate_limited") headers["Retry-After"] = "30";
      console.error("[recipe-import] extractor failed:", e.code, e.upstreamStatus);
      return NextResponse.json(importErrorResponse(e.code), { status, headers });
    }
    captureRouteError(e, "/api/recipe-import");
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg.includes("abort")) {
      return NextResponse.json(importErrorResponse("timeout"), { status: 504 });
    }
    // Take main's version: PR #95's central `importErrorResponse`
    // mapper (audit I01, 2026-05-05) supersedes PR #93's inline
    // ai_rate_limited / ai_unavailable / ai_request_failed branches,
    // which are now handled by the typed `CaptionExtractionError`
    // catch above. Stops vendor names and HTTP statuses from leaking
    // into user copy.
    console.error("[recipe-import] failed:", msg);
    return NextResponse.json(importErrorResponse("import_failed"), { status: 502 });
  } finally {
    clearTimeout(t);
  }
}
