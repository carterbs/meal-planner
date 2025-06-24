# Claude Development Procedures

This guide explains how Claude should modify the frontend. The rest of the project is described in the repository [README](../README.md).

## Fix-Test-Commit Flow
1. **Fix** – implement the change following existing patterns
2. **Test** – run the full test suite
3. **Commit** – commit code and tests together with a clear message

## Test Requirements
- Unit, integration and regression coverage for new code

## Useful Commands
### Frontend Testing
```bash
yarn test --watchAll=false   # Run all tests
yarn test                    # Also runs all tests
yarn coverage                # Generate coverage
```

### Backend Testing
```bash
cd backend && go test ./...
```

### Linting & Type Checking
```bash
yarn lint
yarn typecheck
```

## Git Workflow
1. Make changes
2. Run tests
3. Commit once tests pass
4. Push only when requested

## Notes
- Never commit without passing tests
- Edge cases and error conditions should have tests
- Keep commits focused and atomic
