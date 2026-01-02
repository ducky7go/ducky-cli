# Implementation Tasks

## Phase 1: Add Test Coverage

- [x] Create test fixture with multiple DLLs where one matches the package name
- [x] Create test fixture with multiple DLLs where none match the package name
- [x] Add unit tests for NuGet validator with multi-DLL scenarios
- [x] Add integration tests for `ducky nuget validate` command with multi-DLL fixtures
- [x] Run tests and verify current behavior is captured

## Phase 2: Improve NuGet Validator Error Messages

- [x] Update `validateDllName` error message to explicitly mention multi-DLL support
- [x] Update error suggestions to reference "at least one DLL" phrasing
- [x] Add verbose mode output showing all found DLL names
- [x] Verify `ducky nuget validate` command displays improved error messages

## Phase 3: Add DLL Validation to Steam Validator

- [x] Import necessary utilities (collectFiles, parseInfoIni) into Steam validator
- [x] Add `validateDllNames` method to SteamValidator class
- [x] Integrate DLL validation into main `validate` method
- [x] Add unit tests for Steam validator DLL checking
- [x] Add integration tests for `ducky steam validate` command with multi-DLL fixtures

## Phase 4: Update Documentation

- [x] Update error handling docs to clarify multi-DLL support
- [x] Update Steam validation spec to include DLL name requirement
- [x] Add example in documentation showing multi-DLL mod structure
- [x] Document that `ducky nuget validate` and `ducky steam validate` both support multi-DLL validation

## Phase 5: Validation

- [x] Run full test suite with `npm test`
- [x] Test manually with a multi-DLL mod package
- [x] Verify `ducky nuget validate` with multi-DLL fixture
- [x] Verify `ducky steam validate` with multi-DLL fixture
- [x] Verify `ducky nuget pack` still works correctly with multi-DLL packages
- [x] Verify `ducky steam push` validates DLL names correctly
- [x] Run `openspec validate multiple-dll-package-validation --strict`

## Task Dependencies

- Phase 2 and 3 can be done in parallel
- Phase 1 should be completed first to establish baseline tests
- Phase 4 depends on Phase 2 and 3 completion
- Phase 5 is final validation

## Notes

- The NuGet validator already has correct logic; we're primarily improving messaging
- Steam validator needs new validation logic added
- Both `ducky nuget validate` and `ducky steam validate` standalone commands are affected
- The `ducky nuget pack` and `ducky steam push` commands use the same validators, so they benefit from these changes
- All changes maintain backward compatibility
