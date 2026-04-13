-- Convert meal_type from single text to text array to support multiple tags.
-- e.g. a recipe can be both "lunch" and "dinner".

-- Step 1: Add new array column
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS meal_types text[] DEFAULT '{}';

-- Step 2: Migrate existing single values into the array
UPDATE public.recipes
SET meal_types = ARRAY[meal_type]
WHERE meal_type IS NOT NULL AND meal_type != '';

-- Step 3: Drop the old column
ALTER TABLE public.recipes DROP COLUMN IF EXISTS meal_type;

-- Step 4: Rename new column to meal_type for backwards compat
ALTER TABLE public.recipes RENAME COLUMN meal_types TO meal_type;

COMMENT ON COLUMN public.recipes.meal_type IS 'Meal slots this recipe fits: breakfast, lunch, dinner, snack (array)';
