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
 */
export type DeepLinkAction =
  | { kind: "ignore" }
  | { kind: "siri" }
  | { kind: "forward-to-import"; url: string };

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
    // No recipe URL embedded → this is a navigation deep link
    // (suppr:///settings, suppr:///more, etc.). Let Expo Router
    // handle it; do not redirect.
    return { kind: "ignore" };
  }

  if (!/^https?:\/\//i.test(t)) return { kind: "ignore" };

  const u = extractUrlFromShareText(t);
  if (!u || !isSocialShareRecipeUrl(u)) return { kind: "ignore" };
  return { kind: "forward-to-import", url: u };
}
