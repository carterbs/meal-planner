# Testing `tools/validate`

- Recommended: run tests from the module directory to avoid workspace effects:
  - `cd /absolute/path/to/meal-planner/tools/validate && go test ./... -v`

- Notes:
  - Avoid committing a `go.work` unless you mean for all contributors/CI to use the workspace behavior.
  - When in doubt, run tests from the module directory.
