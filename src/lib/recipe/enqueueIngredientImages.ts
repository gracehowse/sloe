/**
 * `enqueueIngredientImages` — fire the lazy generate-on-miss request for the
 * ingredient tiles that have no `ready` image yet (Sloe image system §4,
 * 2026-06-08).
 *
 * Shared by web (`RecipeDetail.tsx`) and mobile (`recipe/[id].tsx`) so the
 * enqueue behaviour (dedupe, in-flight guard, fire-and-forget, never-throw)
 * is identical on both platforms — only the transport (`post`) differs:
 *   - web:    POST "/api/ingredient-image" with `credentials: same-origin`
 *   - mobile: `authedFetch(`${apiBase}/api/ingredient-image`)`
 *
 * Strictly fire-and-forget: this NEVER blocks render, NEVER throws, and its
 * result is ignored by the caller. The endpoint generates + caches the
 * missing tiles in the background; the screen re-hydrates the image map on
 * its next load and the (previously placeholder) tiles become photos. The
 * library grows itself.
 *
 * Idempotency lives on BOTH sides: this module skips keys it has already
 * enqueued in the current session (a process-lifetime guard so re-renders
 * don't re-POST), and the endpoint itself dedupes by `name_key` (an atomic
 * `pending` claim) so two devices never double-generate.
 */

import { canonicalImageKey } from "./canonicalImageKey";

/** The POST transport. Returns nothing useful — callers ignore it. Must not
 *  throw (wrap your fetch in a `.catch`). */
export type IngredientImagePost = (body: { names: string[] }) => Promise<unknown>;

/** Process-lifetime set of canonical keys already enqueued this session, so a
 *  re-render of the same recipe doesn't re-POST. Cleared only on reload. */
const enqueuedKeys = new Set<string>();

/**
 * Enqueue generation for the given raw ingredient names whose canonical keys
 * have not already been enqueued this session. No-ops (and does NOT call
 * `post`) when there is nothing new to request.
 *
 * @param names   raw `recipe_ingredients.name` values that currently show the
 *   placeholder (i.e. the screen's `missingKeys` mapped back to names, or
 *   simply all ingredient names — the endpoint skips any already `ready`).
 * @param post    platform transport. Wrapped here so a throw/reject is
 *   swallowed — a failed cache-fill is never worth surfacing.
 * @returns the canonical keys newly enqueued (for tests / telemetry).
 */
export function enqueueIngredientImages(
  names: ReadonlyArray<string | null | undefined>,
  post: IngredientImagePost,
): string[] {
  // Distinct raw names whose canonical key is new this session.
  const seenKeys = new Set<string>();
  const toSend: string[] = [];
  const newKeys: string[] = [];
  for (const raw of names) {
    if (typeof raw !== "string" || raw.trim() === "") continue;
    const key = canonicalImageKey(raw);
    if (!key || enqueuedKeys.has(key) || seenKeys.has(key)) continue;
    seenKeys.add(key);
    toSend.push(raw);
    newKeys.push(key);
  }
  if (toSend.length === 0) return [];

  // Mark enqueued up-front so a synchronous re-render can't double-fire while
  // the request is in flight.
  for (const k of newKeys) enqueuedKeys.add(k);

  // Fire-and-forget: call `post` now (not awaited, so it never blocks render).
  // Any throw/rejection is swallowed — and on failure we RELEASE the keys so a
  // later visit can retry (the endpoint is idempotent anyway).
  try {
    Promise.resolve(post({ names: toSend })).catch(() => {
      for (const k of newKeys) enqueuedKeys.delete(k);
    });
  } catch {
    for (const k of newKeys) enqueuedKeys.delete(k);
  }

  return newKeys;
}

/** Test-only: reset the session enqueue guard. */
export function __resetEnqueuedKeysForTest(): void {
  enqueuedKeys.clear();
}
