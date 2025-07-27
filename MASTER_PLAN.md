## Docker based "prod" env
For running on my linux box.

## Tasks
- Have AI normalize all of the ingredients one-time
- Also have AI normalize ingredients when inserting into the DB
- Have a repeatable script for this

## Bugs
- When starting a new session, monday doesn't come back. When reloading the page, it's fine.
- Last Planned appears to be "never" for everything...that ain't great!
- After editing a meal, 'done' should go back to the list of meals. they should also update whenever you load the meal library.

## QoL Improvements
- Allow user to edit 'last planned' with a date picker

## Adding recipes
- UI returns an error despite the backend completing properly
- "Process ingredients" Shouldn't be a necessary step. I should be able to just have a textarea full of ingredients and the processing should just happen.


## Agent mode for recipe management
Add, edit, etc
- Basically a free form text area and have the AI figure out all of the pieces of the receipe, then insert into the DB.
- Maybe a recipe workshopping feature or something.

We are approaching perfection.