-- Migration: Add breakfast and lunch meals
-- This migration adds various breakfast and lunch meals with their ingredients
-- Each variant is created as a separate meal as specified in the plan

-- First, let's add the breakfast meals

-- Honey Nut Cheerios
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Honey Nut Cheerios', 1, false, 'breakfast') 
RETURNING id;

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Honey Nut Cheerios'), 'honey nut cheerios', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Honey Nut Cheerios'), 'milk', NULL, '');

-- Frosted Mini Wheats (Variant)
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Frosted Mini Wheats', 1, false, 'breakfast');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Frosted Mini Wheats'), 'frosted mini wheats', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Frosted Mini Wheats'), 'milk', NULL, '');

-- Special K Fruit & Yogurt (Variant)
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Special K Fruit & Yogurt', 1, false, 'breakfast');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Special K Fruit & Yogurt'), 'Special K Fruit & Yogurt', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Special K Fruit & Yogurt'), 'milk', NULL, '');

-- Raisin Bran (Variant)
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Raisin Bran', 1, false, 'breakfast');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Raisin Bran'), 'raisin bran', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Raisin Bran'), 'milk', NULL, '');

-- Eggs, Toast, and Fruit
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Eggs, Toast, and Fruit', 2, false, 'breakfast');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Eggs, Toast, and Fruit'), '10 eggs', 10, 'each'),
((SELECT id FROM meals WHERE meal_name = 'Eggs, Toast, and Fruit'), 'bread', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Eggs, Toast, and Fruit'), 'strawberries', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Eggs, Toast, and Fruit'), 'blueberries', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Eggs, Toast, and Fruit'), 'blackberries', NULL, '');

-- Eggs and a Parfait
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Eggs and a Parfait', 2, false, 'breakfast');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Eggs and a Parfait'), '10 eggs', 10, 'each'),
((SELECT id FROM meals WHERE meal_name = 'Eggs and a Parfait'), '4 ct coconut chobani', 4, 'ct'),
((SELECT id FROM meals WHERE meal_name = 'Eggs and a Parfait'), 'protein granola', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Eggs and a Parfait'), 'honey', NULL, '');

-- Oatmeal
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Oatmeal', 1, false, 'breakfast');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Oatmeal'), 'quaker oatmeal variety pack', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Oatmeal'), 'milk', NULL, '');

-- Waffles and Eggs
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Waffles and Eggs', 2, false, 'breakfast');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Waffles and Eggs'), 'homestyle eggo waffles', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Waffles and Eggs'), 'maple syrup', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Waffles and Eggs'), '10 eggs', 10, 'each'),
((SELECT id FROM meals WHERE meal_name = 'Waffles and Eggs'), 'fruit', NULL, '');

-- Frozen Eggo Pancakes and Eggs (Variant)
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Frozen Eggo Pancakes and Eggs', 2, false, 'breakfast');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Frozen Eggo Pancakes and Eggs'), 'frozen eggo pancakes', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Frozen Eggo Pancakes and Eggs'), 'maple syrup', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Frozen Eggo Pancakes and Eggs'), '10 eggs', 10, 'each'),
((SELECT id FROM meals WHERE meal_name = 'Frozen Eggo Pancakes and Eggs'), 'fruit', NULL, '');

-- Breakfast Smoothies
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Breakfast Smoothies', 1, false, 'breakfast');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Breakfast Smoothies'), 'frozen strawberries', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Breakfast Smoothies'), '6 bananas', 6, 'each'),
((SELECT id FROM meals WHERE meal_name = 'Breakfast Smoothies'), 'almond milk', NULL, '');

-- Plain Bagels and Yogurt
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Plain Bagels and Yogurt', 1, false, 'breakfast');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Plain Bagels and Yogurt'), 'Thomas'' Plain bagels', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Plain Bagels and Yogurt'), 'coconut chobani', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Plain Bagels and Yogurt'), 'pineapple chobani', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Plain Bagels and Yogurt'), 'cherry chobani', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Plain Bagels and Yogurt'), 'mango chobani', NULL, '');

-- Blueberry Bagels and Yogurt (Variant)
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Blueberry Bagels and Yogurt', 1, false, 'breakfast');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Blueberry Bagels and Yogurt'), 'Thomas'' Blueberry bagels', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Blueberry Bagels and Yogurt'), 'coconut chobani', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Blueberry Bagels and Yogurt'), 'pineapple chobani', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Blueberry Bagels and Yogurt'), 'cherry chobani', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Blueberry Bagels and Yogurt'), 'mango chobani', NULL, '');

-- Cinnamon Raisin Bagels and Yogurt (Variant)
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Cinnamon Raisin Bagels and Yogurt', 1, false, 'breakfast');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Cinnamon Raisin Bagels and Yogurt'), 'Thomas'' Cinnamon Raisin bagels', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Cinnamon Raisin Bagels and Yogurt'), 'coconut chobani', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Cinnamon Raisin Bagels and Yogurt'), 'pineapple chobani', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Cinnamon Raisin Bagels and Yogurt'), 'cherry chobani', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Cinnamon Raisin Bagels and Yogurt'), 'mango chobani', NULL, '');

-- Plain Bagels and Fruit Salad
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Plain Bagels and Fruit Salad', 1, false, 'breakfast');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Plain Bagels and Fruit Salad'), 'Thomas'' Plain bagels', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Plain Bagels and Fruit Salad'), '2 Bananas', 2, 'each'),
((SELECT id FROM meals WHERE meal_name = 'Plain Bagels and Fruit Salad'), 'Blueberries', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Plain Bagels and Fruit Salad'), 'Strawberries', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Plain Bagels and Fruit Salad'), 'Grapes', NULL, '');

-- Blueberry Bagels and Fruit Salad (Variant)
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Blueberry Bagels and Fruit Salad', 1, false, 'breakfast');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Blueberry Bagels and Fruit Salad'), 'Thomas'' Blueberry bagels', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Blueberry Bagels and Fruit Salad'), '2 Bananas', 2, 'each'),
((SELECT id FROM meals WHERE meal_name = 'Blueberry Bagels and Fruit Salad'), 'Blueberries', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Blueberry Bagels and Fruit Salad'), 'Strawberries', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Blueberry Bagels and Fruit Salad'), 'Grapes', NULL, '');

-- Cinnamon Raisin Bagels and Fruit Salad (Variant)
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Cinnamon Raisin Bagels and Fruit Salad', 1, false, 'breakfast');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Cinnamon Raisin Bagels and Fruit Salad'), 'Thomas'' Cinnamon Raisin bagels', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Cinnamon Raisin Bagels and Fruit Salad'), '2 Bananas', 2, 'each'),
((SELECT id FROM meals WHERE meal_name = 'Cinnamon Raisin Bagels and Fruit Salad'), 'Blueberries', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Cinnamon Raisin Bagels and Fruit Salad'), 'Strawberries', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Cinnamon Raisin Bagels and Fruit Salad'), 'Grapes', NULL, '');

-- Now let's add the lunch meals

-- Peanut Butter and Jelly Sandwich and Fruit
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Peanut Butter and Jelly Sandwich and Fruit', 1, false, 'lunch');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Peanut Butter and Jelly Sandwich and Fruit'), 'bread', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Peanut Butter and Jelly Sandwich and Fruit'), 'peanut butter', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Peanut Butter and Jelly Sandwich and Fruit'), 'jelly', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Peanut Butter and Jelly Sandwich and Fruit'), 'strawberries', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Peanut Butter and Jelly Sandwich and Fruit'), 'blueberries', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Peanut Butter and Jelly Sandwich and Fruit'), 'cheese stick', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Peanut Butter and Jelly Sandwich and Fruit'), 'Nutri-grain bar', NULL, '');

-- Ham and Cheese Sandwich and Fruit
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Ham and Cheese Sandwich and Fruit', 1, false, 'lunch');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Ham and Cheese Sandwich and Fruit'), 'bread', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Ham and Cheese Sandwich and Fruit'), 'sliced ham', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Ham and Cheese Sandwich and Fruit'), 'cheese slices', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Ham and Cheese Sandwich and Fruit'), 'strawberries', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Ham and Cheese Sandwich and Fruit'), 'blueberries', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Ham and Cheese Sandwich and Fruit'), 'cheese stick', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Ham and Cheese Sandwich and Fruit'), 'Nutri-grain bar', NULL, '');

-- Grilled Cheese Sandwich and Fruit
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Grilled Cheese Sandwich and Fruit', 2, false, 'lunch');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Grilled Cheese Sandwich and Fruit'), 'bread', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Grilled Cheese Sandwich and Fruit'), 'cheese slices', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Grilled Cheese Sandwich and Fruit'), 'butter', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Grilled Cheese Sandwich and Fruit'), 'strawberries', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Grilled Cheese Sandwich and Fruit'), 'blueberries', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Grilled Cheese Sandwich and Fruit'), 'cheese stick', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Grilled Cheese Sandwich and Fruit'), 'Nutri-grain bar', NULL, '');

-- Quesadillas and Fruit
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Quesadillas and Fruit', 2, false, 'lunch');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Quesadillas and Fruit'), 'tortillas', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Quesadillas and Fruit'), 'shredded cheese', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Quesadillas and Fruit'), 'strawberries', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Quesadillas and Fruit'), 'blueberries', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Quesadillas and Fruit'), 'cheese stick', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Quesadillas and Fruit'), 'Nutri-grain bar', NULL, '');

-- Turkey & Cheese Pinwheels
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Turkey & Cheese Pinwheels', 2, false, 'lunch');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Turkey & Cheese Pinwheels'), 'Tortilla', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Turkey & Cheese Pinwheels'), 'sliced turkey', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Turkey & Cheese Pinwheels'), 'cheddar cheese', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Turkey & Cheese Pinwheels'), 'Cucumber slices', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Turkey & Cheese Pinwheels'), 'Goldfish crackers', NULL, '');

-- Hummus & Carrot Pita Pockets
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Hummus & Carrot Pita Pockets', 1, false, 'lunch');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Hummus & Carrot Pita Pockets'), 'Pita bread', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Hummus & Carrot Pita Pockets'), 'hummus', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Hummus & Carrot Pita Pockets'), 'shredded carrots', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Hummus & Carrot Pita Pockets'), 'Apple slices', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Hummus & Carrot Pita Pockets'), 'Nature Valley Granola bar', NULL, '');

-- Cheese Quesadilla
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Cheese Quesadilla', 2, false, 'lunch');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Cheese Quesadilla'), 'Tortilla', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Cheese Quesadilla'), 'shredded cheese', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Cheese Quesadilla'), 'Grape tomatoes', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Cheese Quesadilla'), 'Ritz crackers', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Cheese Quesadilla'), 'Apple Sauce pouch', NULL, '');

-- Hard-Boiled Egg & Avocado Toast
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Hard-Boiled Egg & Avocado Toast', 2, false, 'lunch');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Hard-Boiled Egg & Avocado Toast'), 'bread', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Hard-Boiled Egg & Avocado Toast'), 'Sabra guacamole', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Hard-Boiled Egg & Avocado Toast'), 'hard-boiled eggs', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Hard-Boiled Egg & Avocado Toast'), 'Strawberries', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Hard-Boiled Egg & Avocado Toast'), 'Yogurt pouch', NULL, '');

-- Peanut Butter and Jelly Roll-Up
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Peanut Butter and Jelly Roll-Up', 1, false, 'lunch');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Peanut Butter and Jelly Roll-Up'), 'Tortilla', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Peanut Butter and Jelly Roll-Up'), 'Peanut Butter', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Peanut Butter and Jelly Roll-Up'), 'Welch''s Grape Jelly', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Peanut Butter and Jelly Roll-Up'), 'banana', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Peanut Butter and Jelly Roll-Up'), 'Baby carrots', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Peanut Butter and Jelly Roll-Up'), 'Graham crackers', NULL, '');

-- Sunbutter & Banana Roll-Up
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Sunbutter & Banana Roll-Up', 1, false, 'lunch');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Sunbutter & Banana Roll-Up'), 'Tortilla', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Sunbutter & Banana Roll-Up'), 'sunbutter', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Sunbutter & Banana Roll-Up'), 'banana', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Sunbutter & Banana Roll-Up'), 'Baby carrots', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Sunbutter & Banana Roll-Up'), 'Graham crackers', NULL, '');

-- Bagel with Cream Cheese & Turkey
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Bagel with Cream Cheese & Turkey', 1, false, 'lunch');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Bagel with Cream Cheese & Turkey'), 'Thomas'' plain bagel', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Bagel with Cream Cheese & Turkey'), 'cream cheese', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Bagel with Cream Cheese & Turkey'), 'sliced turkey', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Bagel with Cream Cheese & Turkey'), 'Cantaloupe', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Bagel with Cream Cheese & Turkey'), 'Goldfish crackers', NULL, '');

-- Mini Meatballs & Cheese Cubes
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Mini Meatballs & Cheese Cubes', 2, false, 'lunch');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Mini Meatballs & Cheese Cubes'), 'mini turkey meatballs', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Mini Meatballs & Cheese Cubes'), 'cheese cubes', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Mini Meatballs & Cheese Cubes'), 'Grapes', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Mini Meatballs & Cheese Cubes'), 'Ritz crackers', NULL, '');

-- Cream Cheese & Cucumber Sandwich
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Cream Cheese & Cucumber Sandwich', 1, false, 'lunch');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Cream Cheese & Cucumber Sandwich'), 'Whole wheat bread', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Cream Cheese & Cucumber Sandwich'), 'cream cheese', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Cream Cheese & Cucumber Sandwich'), 'thin cucumber slices', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Cream Cheese & Cucumber Sandwich'), 'Watermelon chunks', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Cream Cheese & Cucumber Sandwich'), 'Goldfish crackers', NULL, '');

-- Mini Waffle with Nut Butter
INSERT INTO meals (meal_name, relative_effort, red_meat, meal_type) 
VALUES ('Mini Waffle with Nut Butter', 1, false, 'lunch');

INSERT INTO ingredients (meal_id, name, quantity, unit) VALUES 
((SELECT id FROM meals WHERE meal_name = 'Mini Waffle with Nut Butter'), 'Eggo waffles', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Mini Waffle with Nut Butter'), 'Sunbutter', NULL, ''),
((SELECT id FROM meals WHERE meal_name = 'Mini Waffle with Nut Butter'), '4 bananas', 4, 'each'),
((SELECT id FROM meals WHERE meal_name = 'Mini Waffle with Nut Butter'), 'Graham crackers', NULL, ''); 