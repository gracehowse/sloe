/**
 * Shared URL-import job builder (ENG-981).
 *
 * The recipe-import queue runs ONE `EnqueueSpec` per URL. The orchestration of
 * that job — derive a deterministic id, seed the drawer title from the URL
 * host, then `extracting → fetch → cancel-check → organizing → setTitle → land`
 * — is byte-identical on web and mobile; only the platform `fetchRecipe`
 * (the API call) and `land` (apply-to-form / save-first) differ. Centralising
 * the spec here keeps the job shape from drifting between platforms (the same
 * reason `importJobIdForUrl` / `importJobIdForImage` are shared) and lets the
 * multi-URL path (`urls.forEach(buildUrlImportJob)`) reuse the exact single-URL
 * job, so a single and a batched import behave identically.
 */
import { importJobIdForUrl } from "./importProgressMachine";
import { BULK_PHOTO_IMPORT_MAX } from "./photoImport";
import type { EnqueueSpec, ImportRunnerControls } from "./recipeImportScheduler";

const SCHEMELESS_HOST_RE =
  /\b(?:https?:\/\/)?(?:www\.)?(?:l\.instagram\.com|instagram\.com|instagr\.am|tiktok\.com|vm\.tiktok\.com|pin\.it|pinterest\.com)[^\s<>"']*/gi;

/**
 * ENG-981 — extract EVERY recipe URL from a multi-link paste/share blob, for the
 * multi-link import path (shared web + mobile so extraction can't drift). Matches
 * all `http(s)` URLs globally plus the scheme-less known-host forms the mobile
 * share path recognises (Share often sends "instagram.com/p/..." without a
 * scheme), normalises scheme-less hosts to `https://`, strips trailing
 * punctuation, de-dupes preserving first-seen order, and caps at
 * {@link BULK_PHOTO_IMPORT_MAX} so a single paste can't fan out an unbounded
 * number of paid import jobs (mirrors the bulk-photo ceiling). `[]` when empty.
 */
export function extractAllHttpUrls(text: string): string[] {
  const trimmed = text?.trim();
  if (!trimmed) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    let u = raw.trim().replace(/[),.;!?]+$/, "");
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    if (seen.has(u)) return;
    seen.add(u);
    out.push(u);
  };

  for (const m of trimmed.matchAll(/https?:\/\/[^\s<>"']+/gi)) push(m[0]!);
  for (const m of trimmed.matchAll(SCHEMELESS_HOST_RE)) push(m[0]!);

  return out.slice(0, BULK_PHOTO_IMPORT_MAX);
}

/** What a platform `fetchRecipe` resolves to (recipe shape is platform-typed). */
export interface FetchedImport<R> {
  recipe: R;
  imageUsed?: boolean;
  captionTruncated?: boolean;
}

export interface UrlImportJobDeps<R> {
  /** Fetch + parse ONE URL. Throws `ImportRunnerError` on failure; honours `signal`. */
  fetchRecipe: (url: string, signal: AbortSignal) => Promise<FetchedImport<R>>;
  /** Apply the parsed recipe to the review form / save-first (last-wins). */
  land: (
    recipe: R,
    imageUsed: boolean | undefined,
    options: { captionTruncated?: boolean },
  ) => Promise<unknown>;
  /** Read a display title off the parsed recipe (`recipe.title`). */
  titleOf: (recipe: R) => string | undefined;
}

/** Seed title shown before the recipe title is known — the URL host, or "Recipe". */
export function seedTitleForUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Recipe";
  }
}

/**
 * Build the `EnqueueSpec` for importing ONE recipe URL. `importQueue.enqueue`
 * dedupes by the deterministic id, so enqueuing the SAME url twice (a duplicate
 * share/clipboard/deep-link, or the same link twice in a multi-paste) is a
 * no-op — identical to the single-URL behaviour.
 */
export function buildUrlImportJob<R>(url: string, deps: UrlImportJobDeps<R>): EnqueueSpec {
  const trimmed = url.trim();
  const seedTitle = seedTitleForUrl(trimmed);
  return {
    id: importJobIdForUrl("url", trimmed),
    kind: "url",
    title: seedTitle,
    run: async (controls: ImportRunnerControls) => {
      controls.setStage("extracting");
      const { recipe, imageUsed, captionTruncated } = await deps.fetchRecipe(trimmed, controls.signal);
      if (controls.isCancelled()) throw new DOMException("Aborted", "AbortError");
      controls.setStage("organizing");
      const title = deps.titleOf(recipe) ?? seedTitle;
      controls.setTitle(title);
      // Last-wins: the most recent finished import populates the review form.
      await deps.land(recipe, imageUsed, { captionTruncated });
      return { title };
    },
  };
}
