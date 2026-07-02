-- ENG-1306 (a) — duplicate-import guard at the database layer.
-- Stage this migration for `supabase db push --linked`; do not apply via MCP.
--
-- The import save path (shared `src/lib/recipes/persistImportedRecipe.ts`,
-- used by BOTH web and mobile via @suppr/shared) does a check-then-insert on
-- (author_id, source_url). Two concurrent imports of the same URL (double-tap,
-- retry after a slow response, two devices) both pass the check and insert two
-- identical private stubs. This index makes the database the arbiter.
--
-- Scope — deliberately narrow:
--   * `source_url is not null`  — manual/first-party recipes and plan/cookbook
--     imports (which write source_url = null) are unaffected.
--   * `content_origin = 'imported_stub'` — the ENG-870 claim flow can
--     legitimately leave one author with BOTH a private imported stub AND a
--     claimed/published row for the same source_url; only the import path is
--     racy, so only it is constrained.
--
-- Conservative dupe handling (strategy):
--   Existing duplicate (author_id, source_url) stub groups — possible from
--   historic races — would block index creation. We DELETE NOTHING and
--   re-point nothing. The earliest-created row in each group (the canonical
--   first import, the one most likely referenced by history) keeps its
--   source_url; later duplicates get `source_url = null`. Every row, its
--   ingredients, saves, and any meal references stay intact; the only loss on
--   the later dupes is the attribution *link* (source_name still renders).
--   Prod risk is ~zero (solo tester; race-only dupes) but the handling must
--   still be safe if rows exist.

with ranked as (
  select
    id,
    row_number() over (
      partition by author_id, source_url
      order by created_at asc, id asc
    ) as rn
  from public.recipes
  where source_url is not null
    and content_origin = 'imported_stub'
)
update public.recipes r
set source_url = null
from ranked
where r.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists recipes_import_author_source_url_unique
  on public.recipes (author_id, source_url)
  where source_url is not null
    and content_origin = 'imported_stub';

comment on index public.recipes_import_author_source_url_unique is
  'ENG-1306: one imported stub per (author, source_url). App handles 23505 by returning the existing recipe (idempotent re-import).';
