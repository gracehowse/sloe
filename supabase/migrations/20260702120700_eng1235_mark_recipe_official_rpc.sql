-- ENG-1235 — owner "mark macros official" via service-role RPC.
--
-- Stage for `supabase db push --linked`; DO NOT apply via MCP apply_migration.

CREATE OR REPLACE FUNCTION public.mark_recipe_macros_official(
  p_recipe_id uuid,
  p_method text,
  p_source_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_recipe public.recipes%ROWTYPE;
  v_verification jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_method NOT IN ('oauth_handle', 'bio_code', 'dns_meta') THEN
    RAISE EXCEPTION 'invalid_method';
  END IF;

  SELECT * INTO v_recipe FROM public.recipes WHERE id = p_recipe_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'recipe_not_found';
  END IF;

  IF v_recipe.author_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'not_owner';
  END IF;

  IF COALESCE(trim(p_source_url), '') = '' THEN
    RAISE EXCEPTION 'source_url_required';
  END IF;

  v_verification := jsonb_build_object(
    'method', p_method,
    'verified_at', to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'source_url', trim(p_source_url),
    'attestation', true
  );

  UPDATE public.recipes
  SET
    content_origin = 'claimed',
    claimed_by = v_uid,
    claimed_at = now(),
    claim_verification = v_verification,
    source_url = trim(p_source_url),
    is_verified = true,
    verified_at = now()
  WHERE id = p_recipe_id;

  INSERT INTO public.recipe_claims (
    claimant_id,
    recipe_id,
    source_url,
    status,
    verification,
    attested_at,
    verified_at
  ) VALUES (
    v_uid,
    p_recipe_id,
    trim(p_source_url),
    'verified',
    v_verification,
    now(),
    now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_recipe_macros_official(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_recipe_macros_official(uuid, text, text) TO authenticated;
