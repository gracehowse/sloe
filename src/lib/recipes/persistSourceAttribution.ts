/**
 * Shared helper for `recipes.source_url` + `recipes.source_name` at import time.
 *
 * Every code path that INSERTs a recipe derived from a URL or social post
 * (web URL-paste import, mobile share-sheet import, API routes) must run the
 * attribution values through `normaliseSource` right before the Supabase
 * insert. That keeps two invariants:
 *
 *   1. If a URL is available at import time we persist it, always. Historic
 *      bug (TestFlight `AI-CNKcmy7y3fRqj6V0Yr4A`, 2026-04-19, build 10): the
 *      web-scrape API branch returned `sourceName` but dropped `sourceUrl`,
 *      so mobile and web both inserted rows with a name and no URL — the
 *      source card rendered as flat text `"Source · Esther Clark"` with no
 *      tap target. Fixed here at the upstream write boundary rather than
 *      patching the render gate for the second time.
 *   2. We never synthesise a URL from a name or invent a fallback — if only
 *      the name is known the URL stays null and the detail page renders the
 *      three-mode source card accordingly (see
 *      `apps/mobile/tests/unit/recipeSourceCardParity.test.ts`).
 *
 * Rules applied by `normaliseSource`:
 *   - Trim both inputs. Empty / whitespace-only → null.
 *   - URL must match `^https?://` and parse via `new URL(...)`. Anything
 *     else → null, with a single `console.warn` so CI logs flag bad feeds.
 *     We intentionally accept `http` on top of `https` because some legacy
 *     seed URLs and a small number of recipe blogs still serve plain HTTP;
 *     the SSRF allowlist at `app/api/recipe-import/route.ts` already gates
 *     what we fetch, and the stored value is display-only downstream.
 *   - When the URL is valid and no name was provided, derive a neutral
 *     attribution from the hostname (strip leading `www.`). If the hostname
 *     parse itself fails for any reason we fall back to the literal string
 *     "Website" so a recipe with a URL never renders as nameless.
 *   - When the URL is invalid but a name exists, keep the name and null
 *     the URL — a name-only attribution is still useful and won't mislead
 *     users into tapping a broken link.
 *
 * Returns the exact keys used by the Supabase `recipes` row builder so the
 * caller can spread the result directly into an insert object.
 */

export interface NormalisedSource {
  source_url: string | null;
  source_name: string | null;
}

export interface NormaliseSourceInput {
  url?: string | null;
  name?: string | null;
}

/** `https://` or `http://` followed by a non-space host. Matched before parsing with `new URL`. */
const URL_SHAPE = /^https?:\/\/\S+$/i;

function cleanString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hostnameLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    return host.length > 0 ? host : "Website";
  } catch {
    console.warn("[persistSourceAttribution] hostname parse failed for", url);
    return "Website";
  }
}

export function normaliseSource(input: NormaliseSourceInput): NormalisedSource {
  const rawUrl = cleanString(input.url ?? null);
  const rawName = cleanString(input.name ?? null);

  let source_url: string | null = null;
  if (rawUrl) {
    if (URL_SHAPE.test(rawUrl)) {
      try {
        // Round-trip through URL so we also catch malformed hosts that pass the regex.
        new URL(rawUrl);
        source_url = rawUrl;
      } catch {
        console.warn("[persistSourceAttribution] invalid URL dropped:", rawUrl);
        source_url = null;
      }
    } else {
      console.warn("[persistSourceAttribution] invalid URL dropped:", rawUrl);
    }
  }

  let source_name: string | null = rawName;
  if (source_url && !source_name) {
    source_name = hostnameLabel(source_url);
  }

  return { source_url, source_name };
}
