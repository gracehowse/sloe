-- Performance: add composite index for per-user per-day nutrition queries.
CREATE INDEX IF NOT EXISTS idx_nutrition_entries_user_date
  ON nutrition_entries (user_id, created_at DESC);
