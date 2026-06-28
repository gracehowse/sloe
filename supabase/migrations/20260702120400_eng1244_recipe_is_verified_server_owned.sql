-- ENG-1244 — server-own recipes.is_verified + lock anon claim-column reads.
--
-- Stage for `supabase db push --linked`; DO NOT apply via MCP apply_migration.
--
-- 1) Clients must not flip is_verified=true; only service-role / tier_writer paths may.
-- 2) Anon SELECT on published recipes must not expose claim provenance columns.

CREATE OR REPLACE FUNCTION public.guard_recipes_is_verified_client_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Bypass writers, matching the tier-lockdown pattern (ENG-1043, see
  -- redeem_promo_code / profiles_tier_column_lockdown): service_role for direct
  -- server writes, OR an in-transaction `app.tier_writer = 'on'` GUC set only by
  -- a SECURITY DEFINER RPC. Note auth.role() is NOT 'service_role' inside a
  -- definer, which is exactly why mark_recipe_macros_official sets the GUC.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF coalesce(current_setting('app.tier_writer', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND COALESCE(NEW.is_verified, false) = true THEN
    NEW.is_verified := false;
  ELSIF TG_OP = 'UPDATE' AND NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    IF NEW.is_verified = true THEN
      NEW.is_verified := OLD.is_verified;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_recipes_is_verified ON public.recipes;
CREATE TRIGGER trg_guard_recipes_is_verified
  BEFORE INSERT OR UPDATE OF is_verified ON public.recipes
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_recipes_is_verified_client_write();

-- Publish no longer requires client-set is_verified; verification is server-owned.
DROP POLICY IF EXISTS "recipes_update_own" ON public.recipes;
CREATE POLICY "recipes_update_own" ON public.recipes FOR UPDATE
  USING (
    auth.uid() = author_id
    AND content_origin <> 'claimed'
    AND claimed_by IS NULL
    AND claimed_at IS NULL
    AND claim_verification IS NULL
  )
  WITH CHECK (
    auth.uid() = author_id
    AND content_origin <> 'claimed'
    AND claimed_by IS NULL
    AND claimed_at IS NULL
    AND claim_verification IS NULL
    AND (
      published = false
      OR COALESCE(
        (SELECT user_tier FROM public.profiles WHERE id = auth.uid()),
        'free'
      ) IN ('base', 'pro')
    )
  );

-- Anon: column-level SELECT excludes claim provenance fields.
REVOKE SELECT ON public.recipes FROM anon;
GRANT SELECT (
  id,
  author_id,
  creator_id,
  title,
  description,
  image_url,
  image_source,
  image_model,
  image_generated_at,
  calories,
  protein,
  carbs,
  fat,
  fiber_g,
  sugar_g,
  sodium_mg,
  caffeine_mg,
  alcohol_g,
  prep_time_min,
  cook_time_min,
  servings,
  meal_type,
  cuisine,
  dietary,
  dietary_flags,
  allergens,
  instructions,
  source_url,
  source_name,
  published,
  content_origin,
  is_verified,
  verified_at,
  verified_source,
  verified_confidence,
  creator_calories,
  caption_nutrition_claim,
  created_at
) ON public.recipes TO anon;
