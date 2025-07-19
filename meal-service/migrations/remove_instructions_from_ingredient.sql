-- remove_instructions_from_ingredient.sql
--
-- This migration cleans up ingredient names by removing preparation instructions.
-- For example:
--   "1 cup diced celery" will become "celery"
--   "finely chopped parsley" will become "parsley"
--   "ciabatta sandwich rolls, split and lightly toasted" will become "ciabatta sandwich rolls"
--
-- This version uses a single regexp_replace call with an alternation to remove any
-- of the unwanted phrases.
--
BEGIN;

UPDATE public.ingredients
SET name = trim(
regexp_replace(
    name,
    '(,?\s*(finely chopped|diced|minced|chopped|grated|split and\s+(?:lightly\s+)?toasted|peeled|seeded|halved|cut into [^,]+))',
    '',
    'gi'
)
);

COMMIT;