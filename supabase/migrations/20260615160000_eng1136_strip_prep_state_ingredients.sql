-- ENG-1136: remove leaked prep-state / serving-note ingredient rows (high-confidence only).
-- Does not recompute recipe macros; slurry rows were duplicate noise, not primary nutrition.

delete from recipe_ingredients
where name ~* '\ymixed with\y'
   or name ~* '\y(combined|stirred|whisked|dissolved)\s+(with|in|into)\y'
   or (name ~* '\yto serve\y' and name ~* 'optional');
