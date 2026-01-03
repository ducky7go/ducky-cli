## 1. Implementation

- [x] 1.1 Create a utility function to read version from `package.json`
  - Use `fs.readFile` or `import.meta.url` to locate `package.json` relative to the module
  - Parse JSON and extract the `version` field
  - Handle errors gracefully (fallback to "0.0.0" if unable to read)
- [x] 1.2 Update `src/cli.ts` to use dynamic version
  - Import the version reading utility
  - Replace hardcoded `'0.1.0'` with dynamic version call
  - Pass version to `program.version()` method

## 2. Validation

- [x] 2.1 Add unit test for version reading utility
  - Test successful version reading
  - Test error handling (missing package.json, invalid JSON)
- [x] 2.2 Verify `ducky --version` output
  - Run `npm run dev -- --version` and confirm it matches `package.json` version
  - Update `package.json` version and verify output changes
- [x] 2.3 Run existing test suite
  - Ensure all tests pass: `npm test`
