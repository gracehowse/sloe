/**
 * Pure URL + string helpers extracted from `extractSocialRecipe.ts`.
 *
 * Lives here so mobile bundles can import these helpers without
 * transitively pulling in the AI / server-only chain
 * (`aiProvider` → `aiBudget` → `@upstash/redis`). Metro doesn't
 * tree-shake at the import-graph level, so any mobile file importing
 * from `extractSocialRecipe.ts` historically dragged the full server
 * dependency tree into the bundle.
 *
 * Server-side callers still import these via the back-compat re-export
 * in `extractSocialRecipe.ts` (no code change needed there).
 *
 * Zero non-stdlib imports — keep it that way.
 */

const RESERVED_IG_SEGMENTS = new Set([
  "p",
  "reel",
  "reels",
  "tv",
  "stories",
  "explore",
  "accounts",
  "direct",
  "legal",
]);

/**
 * Instagram URLs like `instagram.com/HANDLE/reel/…` or `…/HANDLE/p/…` encode the post owner.
 * Prefer this over oEmbed `author_name`, which can be a generic display string or wrong in edge cases.
 */
export function instagramHandleFromPostUrl(postUrl: string): string | null {
  try {
    const u = new URL(postUrl);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (!host.includes("instagram")) return null;
    const seg = u.pathname.split("/").filter(Boolean);
    if (seg.length < 2) return null;
    const first = seg[0].toLowerCase();
    const second = seg[1].toLowerCase();
    if (RESERVED_IG_SEGMENTS.has(first)) return null;
    if (["p", "reel", "reels", "tv"].includes(second)) return `@${seg[0]}`;
    return null;
  } catch {
    return null;
  }
}

export function tiktokHandleFromPostUrl(postUrl: string): string | null {
  try {
    const u = new URL(postUrl);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (!host.includes("tiktok")) return null;
    const m = u.pathname.match(/^\/@([^/]+)/i);
    if (m?.[1]) return `@${m[1]}`;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Strip an anchored "For [phrase]:" section prefix from the start of a
 * string. Conservative — must start with "For", end with a colon, with
 * 1-80 chars between. Used to clean LLM-extracted ingredient lines.
 */
export function stripSectionPrefix(s: string): string {
  return s.replace(/^\s*For\s+[^:]{1,80}:\s*/i, "").trim();
}

/** Internal re-export so `extractSocialRecipe.ts` keeps using the same
 *  Set without duplicating the literal. */
export const _RESERVED_IG_SEGMENTS_FOR_BACKCOMPAT = RESERVED_IG_SEGMENTS;
