-- ENG-1267: attribute non-copyright recipe reports to the signed-in reporter.
--
-- The /api/recipe-report route has required an authenticated session since
-- ENG-1226, but the insert dropped the resolved `userId` on the floor. Persist
-- it so reviewers can attribute reports, spot repeat reporters, and follow up
-- with the user who flagged a recipe. Nullable: pre-ENG-1267 rows have no
-- attribution, and the column is independent of the abuse-defence
-- `reporter_ip` / `reporter_user_agent` audit fields.

ALTER TABLE public.recipe_reports
  ADD COLUMN IF NOT EXISTS reporter_user_id uuid;

COMMENT ON COLUMN public.recipe_reports.reporter_user_id IS
  'auth.users id of the signed-in user who filed the report (ENG-1226 requires auth). Nullable: pre-ENG-1267 rows are unattributed. Distinct from the reporter_ip / reporter_user_agent abuse-defence metadata.';
