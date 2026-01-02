## 1. Implementation

- [x] 1.1 Update `parseList` function to handle quoted strings with spaces (while keeping comma as the only delimiter)
- [x] 1.2 Add unit tests for comma-separated tags
- [x] 1.3 Add unit tests for quoted tags with spaces (comma-separated)
- [x] 1.4 Add unit tests for mixed quoted and unquoted tags (comma-separated)
- [x] 1.5 Add unit test for empty tag handling
- [x] 1.6 Update existing tests to ensure they use comma-separated format
- [x] 1.7 Add documentation clarifying comma as the only delimiter

## 2. Validation

- [x] 2.1 Run `npm run test` to ensure all tests pass
- [x] 2.2 Run `npm run build` to ensure TypeScript compilation succeeds
- [x] 2.3 Test with a real mod containing quoted tags with spaces
- [x] 2.4 Verify the generated .nuspec file contains correct tags
