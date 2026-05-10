/**
 * Friendlier persistence-error mapping for recipe-attached client tables.
 *
 * Why this exists (F-144, 2026-05-10):
 *
 * The 2026-05-14 Suppr Kitchen recipes wipe (`20260514100000_replace_
 * recipes_with_suppr_kitchen.sql`) cascaded deletes through the FKs on:
 *
 *   - `user_recipe_notes.recipe_id`     → on delete cascade
 *   - `recipe_cook_history.recipe_id`   → on delete cascade
 *   - `recipe_plan_add_events.recipe_id` → on delete cascade
 *   - `saves.recipe_id`                 → on delete cascade
 *
 * For users whose app cache still holds an old recipe id, the next
 * write to one of these tables produces a Postgres `23503` FK
 * violation. The raw error message ("insert or update on table X
 * violates foreign key constraint…") surfaces to the user as
 * "Could not save", which is what testers reported in the
 * 2026-05-10 ASC pull (`APU2FBCjLAL...` and the rating-save thread).
 *
 * `mapPersistenceError` recognises the FK violation and rethrows with
 * copy a human can act on. The helper also maps the 22P02
 * "invalid input syntax for type uuid" case for parity with the
 * existing UUID guard in `recipeNotesClient.ts`.
 */

const FK_VIOLATION_CODE = "23503";
const UUID_PARSE_CODE = "22P02";
const RLS_DENY_CODES = new Set(["42501", "42P01"]);

export type PersistenceErrorContext =
  /** A note / rating / cook entry tied to a recipe id */
  | "recipe_attached"
  /** A user-owned record where the user_id link is the typical FK */
  | "user_attached";

export type PgErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

function isPgErrorLike(err: unknown): err is PgErrorLike {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  // Require a non-empty `code` string. Plain Error instances have a
  // `message` but no `code`, and we want those to pass through unchanged
  // rather than be re-wrapped.
  return typeof e.code === "string" && e.code.length > 0;
}

/**
 * Translate a raw Postgres / PostgREST error into a user-facing
 * message. Returns the original error untouched when no friendlier
 * mapping is available — callers should `throw mapPersistenceError(...)`
 * unconditionally and never lose the original code.
 */
export function mapPersistenceError(
  err: unknown,
  context: PersistenceErrorContext = "recipe_attached",
): Error {
  if (!isPgErrorLike(err)) {
    return err instanceof Error
      ? err
      : new Error(typeof err === "string" ? err : "Persistence failed");
  }

  const code = err.code ?? "";
  const original = err.message ?? "Persistence failed";

  if (code === FK_VIOLATION_CODE) {
    if (context === "recipe_attached") {
      const out = new Error(
        "This recipe is no longer in your library — save it again to keep notes, ratings, and cook history.",
      );
      (out as Error & { code?: string; cause?: unknown }).code = code;
      (out as Error & { code?: string; cause?: unknown }).cause = err;
      return out;
    }
    const out = new Error(
      "This item is linked to something that no longer exists — refresh and try again.",
    );
    (out as Error & { code?: string; cause?: unknown }).code = code;
    (out as Error & { code?: string; cause?: unknown }).cause = err;
    return out;
  }

  if (code === UUID_PARSE_CODE) {
    const out = new Error(
      "Save this recipe to your library first — notes, ratings, and cook history only persist for saved recipes.",
    );
    (out as Error & { code?: string; cause?: unknown }).code = code;
    (out as Error & { code?: string; cause?: unknown }).cause = err;
    return out;
  }

  if (RLS_DENY_CODES.has(code)) {
    const out = new Error(
      "You're not signed in for this action. Try signing in again.",
    );
    (out as Error & { code?: string; cause?: unknown }).code = code;
    (out as Error & { code?: string; cause?: unknown }).cause = err;
    return out;
  }

  // Unknown code — pass through with the original message so we don't
  // silently swallow useful diagnostics. Callers can still surface as
  // a friendlier toast at the UI layer.
  const passthrough = new Error(original);
  (passthrough as Error & { code?: string; cause?: unknown }).code = code;
  (passthrough as Error & { code?: string; cause?: unknown }).cause = err;
  return passthrough;
}

/**
 * Returns true when a thrown error matches the FK violation we expect
 * from the recipe wipe cascade — useful for callers that want to
 * branch UI behaviour (e.g. clear the local cache row vs surface a
 * toast).
 */
export function isRecipeForeignKeyViolation(err: unknown): boolean {
  return isPgErrorLike(err) && err.code === FK_VIOLATION_CODE;
}
