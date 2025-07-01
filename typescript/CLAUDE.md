# Claude Development Procedures

## Fix-Test-Commit Flow

When working on bug fixes or new features, always follow this procedure:

### 1. Fix
- Identify and implement the solution to the problem
- Make minimal, focused changes that address the specific issue
- Follow existing code conventions and patterns

### 2. Test
- Write comprehensive tests for the fix
- Test both positive cases (expected behavior) and edge cases
- Run the full test suite to ensure no regressions
- Frontend tests: `npm test -- --watchAll=false`
- Backend tests: `cd backend && go test ./...`

### 3. Commit
- Commit changes immediately after tests pass
- Use descriptive commit messages that explain the "why" not just the "what"
- Include test files in the same commit as the fix

## Test Requirements

For every fix, ensure:
- **Unit tests** cover the specific functionality changed
- **Integration tests** verify the fix works end-to-end
- **Edge case tests** handle boundary conditions
- **Regression tests** prevent the bug from reoccurring

## Example Test Categories

### Frontend (React/TypeScript)
- Component rendering tests
- User interaction tests
- API integration tests
- State management tests

### Backend (Go)
- Handler function tests
- Model method tests
- Database operation tests
- API endpoint tests

## Commands to Remember

### Frontend Testing
```bash
npm test -- --watchAll=false                    # Run all tests
npm test -- --testNamePattern="pattern"         # Run specific tests
npm test -- --watchAll=false --coverage=false   # Skip coverage
```

### Backend Testing
```bash
cd backend && go test ./...                      # Run all backend tests
go test ./handlers                               # Test specific package
go test -v ./models                              # Verbose output
```

### Linting & Type Checking
```bash
npm run lint                                     # Frontend linting
npm run typecheck                               # TypeScript checking
```

## Git Workflow

1. Make changes
2. Run tests
3. Commit with meaningful message
4. Only push when explicitly requested

## Notes

- Never commit without passing tests
- Write tests that would have caught the original bug
- Test edge cases and error conditions
- Keep commits focused and atomic