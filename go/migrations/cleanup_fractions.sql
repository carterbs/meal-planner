-- cleanup_fractions.sql
-- This migration converts fractional representations in ingredients to decimals.
-- For example:
--   "½" becomes ".5", "¾" becomes ".75", "¼" becomes ".25", "⅓" becomes ".33", and "⅔" becomes ".67"
-- This update is applied to both the "name" and "quantity" columns if they contain any of these characters.

BEGIN;

UPDATE public.ingredients
SET 
  name = regexp_replace(
           regexp_replace(
             regexp_replace(
               regexp_replace(
                 regexp_replace(name, '¼', '.25', 'g'),
               '½', '.5', 'g'),
             '¾', '.75', 'g'),
           '⅓', '.33', 'g'),
         '⅔', '.67', 'g'),
  quantity = regexp_replace(
               regexp_replace(
                 regexp_replace(
                   regexp_replace(
                     regexp_replace(quantity, '¼', '.25', 'g'),
                   '½', '.5', 'g'),
                 '¾', '.75', 'g'),
               '⅓', '.33', 'g'),
             '⅔', '.67', 'g')
WHERE (name ~ '[¼½¾⅓⅔]') OR (quantity ~ '[¼½¾⅓⅔]');

COMMIT;