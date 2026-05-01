/**
 * Shared FatSecret-autocomplete client used by both web FoodSearchPanel
 * and the mobile equivalent. Always hits the same `/api/fatsecret/autocomplete`
 * route — FatSecret credentials are server-only.
 *
 * Behaviour contract:
 *
 *   - On Premier tier the route returns
 *     `{ ok: true, tier: "premier", suggestions: string[] }`.
 *   - On Basic tier the route returns
 *     `{ ok: true, tier: "basic", suggestions: [] }` so callers can
 *     issue the request unconditionally without 4xx-handling.
 *   - On any failure (network, 4xx, 5xx, 503 misconfigured) the helper
 *     resolves to `{ tier: "basic", suggestions: [] }` so the search
 *     UX never breaks. Surface diagnostic errors via Sentry only —
 *     never bubble to the user.
 *
 * The helper accepts an optional `fetchImpl` for tests so we can mock
 * out the network without monkey-patching `globalThis.fetch`.
 *
 * See `docs/decisions/2026-04-26-fatsecret-upgrade.md`.
 */

export type FatSecretAutocompleteResult = {
  /** Tier the server reported. `"basic"` indicates the typeahead row should be hidden. */
  tier: "basic" | "premier";
  /** Up to N suggested completion strings. Always [] on basic. */
  suggestions: string[];
};

export type FatSecretAutocompleteClientOpts = {
  /** Override for tests. Defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
  /** Optional override path for the autocomplete route. Defaults to `/api/fatsecret/autocomplete`. */
  path?: string;
  /** Max suggestions to ask for. Server clamps to 1..10. */
  maxResults?: number;
  /** AbortSignal for cancellation when the user types again. */
  signal?: AbortSignal;
};

const DEFAULT_PATH = "/api/fatsecret/autocomplete";

export async function fetchFatSecretAutocomplete(
  query: string,
  opts: FatSecretAutocompleteClientOpts = {},
): Promise<FatSecretAutocompleteResult> {
  const q = query.trim();
  if (!q) return { tier: "basic", suggestions: [] };
  const fetchImpl = opts.fetchImpl ?? (typeof fetch === "function" ? fetch : null);
  if (!fetchImpl) return { tier: "basic", suggestions: [] };
  const path = opts.path ?? DEFAULT_PATH;
  const max = Math.max(1, Math.min(10, opts.maxResults ?? 4));
  const url = `${path}?q=${encodeURIComponent(q)}&max=${max}`;
  try {
    const res = await fetchImpl(url, { signal: opts.signal });
    if (!res.ok) return { tier: "basic", suggestions: [] };
    const json = (await res.json()) as unknown;
    if (typeof json !== "object" || json === null) return { tier: "basic", suggestions: [] };
    const obj = json as Record<string, unknown>;
    if (obj.ok !== true) return { tier: "basic", suggestions: [] };
    const tier = obj.tier === "premier" ? "premier" : "basic";
    const raw = Array.isArray(obj.suggestions) ? obj.suggestions : [];
    const suggestions = raw.filter((s: unknown): s is string => typeof s === "string" && s.length > 0);
    return { tier, suggestions };
  } catch {
    // Network / abort / parse error — fall back silently.
    return { tier: "basic", suggestions: [] };
  }
}
