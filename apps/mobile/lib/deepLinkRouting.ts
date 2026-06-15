import * as Linking from "expo-linking";

import { extractUrlFromShareText, urlFromDeepLink } from "@/lib/resolveImportUrl";
import { isSocialShareRecipeUrl } from "@/lib/clipboardShareForward";
import { parseSiriDeepLink } from "@/lib/siriDeepLinks";

/**
 * Pure decision logic for incoming deep links.
 *
 * Extracted 2026-04-29 from the inline `forward` callback in
 * `app/_layout.tsx` so the routing rules are unit-testable. The
 * regression we're locking in: a previous version of this logic
 * always called `router.replace("/")` for any `suppr://` URL whose
 * `urlFromDeepLink` returned null, which silently captured every
 * navigation deep link (suppr:///settings, suppr:///more, etc.) and
 * forced the user back to Today. See
 * `docs/audits/2026-04-29-mobile-e2e-audit-findings.md` and the
 * companion decision doc `docs/decisions/2026-04-29-deeplink-fix.md`.
 *
 * The contract:
 *   - "ignore"            — do nothing; let Expo Router handle it.
 *   - "forward-to-import" — replace nav stack with /import-shared,
 *                            passing the resolved recipe URL.
 *   - "siri"              — caller defers to `HandleSiriDeepLinks`.
 *   - "navigate"          — replace nav stack with a resolved in-app
 *                            route (used for path aliases like
 *                            `suppr:///plan` → the Plan tab).
 */
export type DeepLinkAction =
  | { kind: "ignore" }
  | { kind: "siri" }
  | { kind: "forward-to-import"; url: string }
  | { kind: "navigate"; pathname: string };

/**
 * ENG-800 (2026-05-30) — well-known navigation aliases.
 *
 * The Plan tab's route file is `app/(tabs)/planner.tsx`, so its
 * canonical Expo Router path is `/planner`. External surfaces
 * (push payloads, Siri/Shortcuts, marketing links, hand-typed
 * deep links) reasonably address the tab by its user-facing label
 * `plan` — `suppr:///plan`. Before this map, that path had no
 * registered route, so Expo Router fell through to `+not-found.tsx`,
 * which renders the "the recipe may have been deleted" 404. The
 * deep link was being treated as a stale recipe link rather than a
 * tab.
 *
 * Each entry maps the bare path segment of a `suppr://` deep link
 * (case-insensitive, no leading slash) to the real in-app route the
 * caller should `router.replace` to. Keep this tight — only add an
 * alias when the user-facing label genuinely diverges from the
 * route file name (Plan → planner). Paths that already match their
 * route file (settings, more, progress, library, discover, …) stay
 * out of this map and resolve via Expo Router directly.
 */
const NAV_PATH_ALIASES: Readonly<Record<string, string>> = {
  plan: "/(tabs)/planner",
  // ENG-1162 — Recipes sub-tabs must follow the deep-link path. Expo Router
  // can land on the Recipes tab while the last-visited sub-tab (Discover)
  // stays selected; explicit `router.replace` makes `/library` and
  // `/discover` the source of truth for the sub-tab chrome.
  library: "/(tabs)/library",
  discover: "/(tabs)/discover",
};

/**
 * Extract the bare, lowercased path segment from a `suppr://` deep
 * link, with leading/trailing slashes stripped and any query string
 * dropped. Returns `null` when the link carries no path (bare
 * `suppr://`) or can't be parsed. Used only for alias lookup — never
 * for recipe-URL extraction.
 *
 * `suppr:///plan`            → "plan"
 * `suppr://plan`             → "plan"   (parsed as host, not path)
 * `suppr:///plan?ref=push`   → "plan"
 * `suppr://`                 → null
 *
 * Both the two-slash (`suppr://plan`, where `plan` parses as the
 * host) and three-slash (`suppr:///plan`, where `plan` parses as the
 * path) forms are accepted — push payloads and hand-typed links use
 * both, and Expo Router's own linking config treats them the same.
 */
function navPathSegment(href: string): string | null {
  try {
    const parsed = Linking.parse(href);
    const raw =
      parsed.path && parsed.path.replace(/\//g, "").trim().length > 0
        ? parsed.path
        : parsed.hostname;
    if (!raw) return null;
    const seg = raw.replace(/^\/+/, "").replace(/\/+$/, "").trim().toLowerCase();
    return seg.length > 0 ? seg : null;
  } catch {
    return null;
  }
}

/**
 * Decide what to do with an incoming deep link in the
 * "social share / import forwarder" pipeline. Pure — no React
 * Navigation calls; the caller wires the action to `router`.
 */
export function decideDeepLinkAction(href: string): DeepLinkAction {
  const t = href.trim();
  if (!t) return { kind: "ignore" };

  // Siri / Shortcuts URLs are owned by HandleSiriDeepLinks. Never
  // race-navigate from this pipeline.
  if (parseSiriDeepLink(t) != null) return { kind: "siri" };

  if (/^suppr:/i.test(t)) {
    const u = urlFromDeepLink(t);
    if (u) return { kind: "forward-to-import", url: u };
    // No recipe URL embedded → this is a navigation deep link.
    // First check the well-known alias map (e.g. `suppr:///plan` →
    // the Plan tab, whose route file is `planner.tsx`). Aliased
    // paths must be routed explicitly because Expo Router has no
    // matching route and would otherwise fall through to
    // `+not-found.tsx` (ENG-800).
    const seg = navPathSegment(t);
    if (seg && seg in NAV_PATH_ALIASES) {
      return { kind: "navigate", pathname: NAV_PATH_ALIASES[seg]! };
    }
    // Otherwise this is a navigation deep link whose path already
    // matches a registered route (suppr:///settings, suppr:///more,
    // etc.). Let Expo Router handle it; do not redirect.
    return { kind: "ignore" };
  }

  if (!/^https?:\/\//i.test(t)) return { kind: "ignore" };

  const u = extractUrlFromShareText(t);
  if (!u || !isSocialShareRecipeUrl(u)) return { kind: "ignore" };
  return { kind: "forward-to-import", url: u };
}
