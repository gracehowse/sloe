-- Only notify followers when a recipe is published AND verified.
-- Prevents spam notifications from unverified/low-quality recipes.

CREATE OR REPLACE FUNCTION public.notify_followers_on_recipe_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE(new.published, false) THEN RETURN new; END IF;
  IF NOT COALESCE(new.is_verified, false) THEN RETURN new; END IF;
  IF tg_op = 'UPDATE' AND COALESCE(old.published, false) AND COALESCE(old.is_verified, false) THEN
    RETURN new;
  END IF;

  IF new.author_id IS NOT NULL THEN
    INSERT INTO public.creator_publish_notifications (user_id, recipe_id)
    SELECT af.follower_id, new.id
    FROM public.author_follows af
    WHERE af.author_id = new.author_id
    ON CONFLICT (user_id, recipe_id) DO NOTHING;
  END IF;

  IF new.creator_id IS NOT NULL THEN
    INSERT INTO public.creator_publish_notifications (user_id, recipe_id)
    SELECT f.user_id, new.id
    FROM public.follows f
    WHERE f.creator_id = new.creator_id
    ON CONFLICT (user_id, recipe_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;
