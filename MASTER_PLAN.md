## Docker based "prod" env
For running on my linux box.

## Adding recipes
- "Process ingredients" Shouldn't be a necessary step. I should be able to just have a textarea full of ingredients and the processing should just happen.

## Tasks
- Have AI normalize all of the ingredients one-time
- Also have AI normalize ingredients when inserting into the DB
- Have a repeatable script for this

## Agent mode for recipe management
Add, edit, etc
- Basically a free form text area and have the AI figure out all of the pieces of the receipe, then insert into the DB.
- Maybe a recipe workshopping feature or something.

## Refactors
- Extract handlers out of main.ts in the agent-service so we can unit test them properly.
- Fix HTTP client response parsing: The generated @hey-api/openapi-ts client is treating JSON responses as strings instead of parsing them. This causes double-JSON-parsing in the UI. Options: configure parseAs: 'json', update swagger generation, or switch to a more protobuf-friendly HTTP client.