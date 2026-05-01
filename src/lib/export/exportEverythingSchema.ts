/**
 * Constants for the "Export everything" data dump.
 *
 * Lives outside `app/api/export/me/route.ts` because Next.js 15
 * only allows specific exports (`GET`, `POST`, etc.) from a route
 * handler file. The schema version + window need to be importable
 * from tests + the docs runtime, so they live here.
 *
 * See `docs/operations/data-export.md` for the full schema
 * description.
 */

/** Increment when the export shape breaks consumer assumptions
 *  (key rename, removal, or semantics change). Additive new keys
 *  do NOT require a bump. */
export const SUPPR_EXPORT_SCHEMA_VERSION = 1;

/** How many days of meal log + weight history we include. The
 *  task spec calls for 365; centralised so tests can pin the
 *  value. */
export const SUPPR_EXPORT_LOG_DAYS = 365;
