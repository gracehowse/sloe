-- ENG-1396 (2026-07-05 deep audit, live-DB security & RLS, finding SEC-02) —
-- recipe_ingredients / recipe_steps SELECT is `USING (true)` for `public`,
-- leaking unpublished draft content (ingredients + full method steps) to
-- every anon/authenticated caller regardless of the parent recipe's
-- published/ownership state.
--
-- THE BUG (confirmed against the live DB via pg_policies): both
-- `recipe_ingredients_select_public` and `recipe_steps_select_public` are
-- `USING (true)`. Meanwhile the parent `recipes` table's own SELECT policy
-- (`recipes_select_published_own_or_saved`) correctly gates on
-- `published = true OR auth.uid() = author_id OR EXISTS(saves row)` — the
-- child tables never inherited that gate, so a direct PostgREST read of
-- `/rest/v1/recipe_ingredients?recipe_id=eq.<draft-id>` (or `recipe_steps`)
-- returns full content for a recipe its own SELECT policy would reject.
--
-- THE FIX: mirror the parent policy's exact three-part condition via an
-- EXISTS join to `recipes`. This is NOT a novel pattern on this table — the
-- existing INSERT/UPDATE/DELETE policies on recipe_ingredients already join
-- back to `recipes` the same way (`EXISTS (SELECT 1 FROM recipes r WHERE
-- r.id = recipe_ingredients.recipe_id AND r.author_id = auth.uid())`), and
-- `recipes`'s own SELECT policy does not recurse back into either child
-- table — so this carries none of the self-referential recursion risk that
-- forced the security-definer helper pattern on `saves` / `household_members`
-- (20260423110000_household_rls_recursion_fix.sql,
-- 20260520100000_saves_rls_recursion_fix.sql).
--
-- FORWARD-ONLY SAFE: replaces two SELECT policies only; no column, no other
-- policy, no trigger touched.
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration — MCP
-- rewrites schema_migrations.version to wall-clock NOW(), drifting from the
-- future-dated filename prefix used for monotonic ordering).

set search_path = public;

drop policy if exists "recipe_ingredients_select_public" on public.recipe_ingredients;
create policy "recipe_ingredients_select_published_own_or_saved"
  on public.recipe_ingredients for select
  to public
  using (
    exists (
      select 1
        from public.recipes r
       where r.id = recipe_ingredients.recipe_id
         and (
           r.published = true
           or r.author_id = (select auth.uid())
           or exists (
             select 1
               from public.saves s
              where s.recipe_id = r.id
                and s.user_id = (select auth.uid())
           )
         )
    )
  );

drop policy if exists "recipe_steps_select_public" on public.recipe_steps;
create policy "recipe_steps_select_published_own_or_saved"
  on public.recipe_steps for select
  to public
  using (
    exists (
      select 1
        from public.recipes r
       where r.id = recipe_steps.recipe_id
         and (
           r.published = true
           or r.author_id = (select auth.uid())
           or exists (
             select 1
               from public.saves s
              where s.recipe_id = r.id
                and s.user_id = (select auth.uid())
           )
         )
    )
  );

notify pgrst, 'reload schema';
