-- cleanup_pantry_shopping_list.sql
--
-- This migration cleans up pantry staple and spice ingredients by
-- standardizing their names to canonical forms and removing the recipe-specific
-- quantity and unit fields. This makes the ingredients more suitable for a shopping list.
--
-- For example:
--   "1 tbsp extra-virgin olive oil" becomes "olive oil" with no quantity/unit.
--   "1 tbsp yellow mustard" becomes "mustard" with no quantity/unit.
--   "1 clove garlic" becomes "garlic" (but leaves "garlic powder" unchanged).
--   Similar cleanup is applied to salt, pepper (excluding compound items like "pepperjack"),
--   vinegar (trims trailing descriptors), onion powder, paprika, cumin, turmeric, chili powder,
--   and red pepper flakes.
--
-- The update only applies to rows matching the pattern for these keywords and avoids
-- compound ingredients (using a simple "NOT LIKE '% and %'" check).

BEGIN;

UPDATE public.ingredients
SET 
  name = CASE
    WHEN lower(name) LIKE '%olive oil%' 
         AND lower(name) NOT LIKE '% and %' 
         THEN 'olive oil'
    WHEN lower(name) LIKE '%mustard%' 
         AND lower(name) NOT LIKE '%honey mustard%' 
         AND lower(name) NOT LIKE '% and %'
         THEN 'mustard'
    WHEN lower(name) LIKE '%garlic%' 
         AND lower(name) NOT LIKE '%garlic powder%' 
         AND lower(name) NOT LIKE '% and %'
         THEN 'garlic'
    WHEN lower(name) LIKE '%salt%' 
         AND lower(name) NOT LIKE '% and %'
         THEN 'salt'
    WHEN lower(name) LIKE '%pepper%' 
         AND lower(name) NOT LIKE '%pepperjack%'
         AND lower(name) NOT LIKE '%chipotle%'
         AND lower(name) NOT LIKE '% and %'
         THEN 'pepper'
    WHEN lower(name) LIKE '%vinegar%' 
         AND lower(name) NOT LIKE '% and %'
         THEN trim(regexp_replace(name, ',.*', '', 'g'))
    WHEN lower(name) LIKE '%onion powder%' 
         AND lower(name) NOT LIKE '% and %'
         THEN 'onion powder'
    WHEN lower(name) LIKE '%paprika%' 
         AND lower(name) NOT LIKE '% and %'
         THEN 'paprika'
    WHEN lower(name) LIKE '%cumin%' 
         AND lower(name) NOT LIKE '% and %'
         THEN 'cumin'
    WHEN lower(name) LIKE '%turmeric%' 
         AND lower(name) NOT LIKE '% and %'
         THEN 'turmeric'
    WHEN lower(name) LIKE '%chili powder%' 
         AND lower(name) NOT LIKE '% and %'
         THEN 'chili powder'
    WHEN lower(name) SIMILAR TO '%red[- ]?pepper flakes%' 
         AND lower(name) NOT LIKE '% and %'
         THEN 'red pepper flakes'
    ELSE name
  END,
  quantity = NULL,
  unit = NULL
WHERE lower(name) SIMILAR TO '%(olive oil|mustard|garlic|salt|pepper|vinegar|onion powder|paprika|cumin|turmeric|chili powder|red[ -]?pepper flakes)%';

COMMIT;