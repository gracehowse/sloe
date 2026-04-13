-- Allow 'unspecified' as a valid sex value for users who prefer not to disclose.
-- BMR calculation uses the midpoint of male and female estimates for this case.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_sex_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_sex_check CHECK (sex IN ('female', 'male', 'unspecified'));
