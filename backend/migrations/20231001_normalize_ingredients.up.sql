-- 20231001_normalize_ingredients.up.sql
-- Migration to normalize the ingredients data.

-- Convert synonyms for unit.
UPDATE ingredients
SET unit = 'lb'
WHERE lower(unit) IN ('pound', 'lbs');

-- Set quantity to '1' where it is NULL or empty.
UPDATE ingredients
SET quantity = '1'
WHERE quantity IS NULL OR trim(quantity) = '';

-- Replace special fraction characters in quantity (e.g. '½' -> '0.5').
UPDATE ingredients
SET quantity = replace(quantity, '½', '0.5')
WHERE quantity LIKE '%½%';

-- For rows where quantity is not a valid number,
-- smoosh the quantity and unit values into the name.
UPDATE ingredients
SET name = trim(coalesce(quantity, '') || ' ' || coalesce(unit, '') || ' ' || coalesce(name, '')),
    quantity = '1',
    unit = NULL
WHERE NOT (trim(coalesce(quantity, '')) ~ '^[0-9]+(\.[0-9]+)?$'); 