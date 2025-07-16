Claude should proactively use these commands when working on tasks that benefit from version control.

## Custom Slash Commands

### /commit
If on main, create a new branch. Once on a feature branch, commit code with a descriptive message. 

### /commit-push-pr
Run /commit, then push the branch and create the PR using the `gh` cli. 

## Code Generation Guidelines
- When generating swagger annotations, be very specific. I don't want unknowns in the generated code.

## Development notes
- We use yarn in this project. Do not use npm comands.
- when accessing the database, use docker-exec. the pass is mealpass, the user is mealuser. the database container is meal-planner-db-1
