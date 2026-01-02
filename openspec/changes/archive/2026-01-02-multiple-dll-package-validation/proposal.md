# Multiple DLL Package Validation

## Summary

Allow mod packages to contain multiple DLL files, with validation requiring only that at least one DLL matches the package name, rather than requiring all DLLs to match.

## Background

In the ducky-cli tool for packaging game mods for NuGet and Steam Workshop, a mod package may contain multiple DLL files (e.g., a main mod DLL plus dependency DLLs). The current validation behavior needs clarification and potential adjustment to properly support this scenario.

### Current State Analysis

After codebase analysis:
- **NuGet validator** (`src/formats/nuget/validator.ts:71-77`): Already correctly implements "at least one DLL must match" logic using `Array.some()`
- **Steam validator** (`src/formats/steam/validator.ts`): Does NOT validate DLL names at all
- **NuGet validate command** (`src/commands/nuget/validate.ts`): Uses the validator, will benefit from improved messaging
- **Steam validate command** (`src/commands/steam/validate.ts`): Uses the validator, needs DLL validation added
- **Spec** (`openspec/specs/cli-nuget-validation/spec.md:6-26`): Correctly documents "at least one .dll file" requirement

### The Problem

While the NuGet implementation already follows the correct behavior, there are potential issues:

1. **Inconsistency**: Steam validator lacks DLL name validation entirely
2. **Unclear error messaging**: Current error suggests renaming "one of the DLLs" but could be clearer about multi-DLL support
3. **Missing test coverage**: No test fixtures with multiple DLLs where one matches and others don't
4. **Documentation gap**: The behavior should be explicitly documented for users
5. **Validate commands**: Both `ducky nuget validate` and `ducky steam validate` commands should properly reflect multi-DLL validation behavior

## Proposed Changes

### 1. Clarify NuGet Validation Behavior (Documentation & Error Messages)

Update the error message and documentation to make it explicit that packages may contain multiple DLLs. This will benefit both the `ducky nuget pack` command and the standalone `ducky nuget validate` command.

### 2. Add DLL Validation to Steam Validator

Ensure Steam validator checks that at least one DLL matches the mod name, consistent with NuGet behavior. This affects both `ducky steam push` and the standalone `ducky steam validate` command.

### 3. Add Test Coverage

Create test fixtures covering the multi-DLL scenario for both validators and validate commands.

## Impact

### User Benefits
- Multi-DLL mods are properly supported across both NuGet and Steam publishing
- Clearer error messages when validation fails
- Consistent validation behavior across publishing targets and validate commands
- Both `ducky nuget validate` and `ducky steam validate` commands properly handle multi-DLL scenarios

### Backward Compatibility
- No breaking changes
- Single-DLL mods continue to work exactly as before
- Mods that already pass validation will continue to pass

## Alternatives Considered

1. **No change** - Current NuGet behavior is already correct
   - Rejected: Steam validation inconsistency remains, test coverage missing

2. **Allow any DLL names** - Remove name matching entirely
   - Rejected: Name matching provides important package identity verification

3. **Make validation optional** - Add a flag to disable DLL name check
   - Rejected: Unnecessary complexity; the correct validation is not overly restrictive

## Open Questions

None identified. The proposal clarifies existing correct behavior and adds consistency.

## Dependencies

- None. This is a standalone change.

## Success Criteria

1. NuGet validator maintains current "at least one DLL matches" behavior
2. Steam validator gains equivalent DLL name validation
3. Test fixtures exist for multi-DLL scenarios
4. Error messages clearly indicate multi-DLL support
5. Both `ducky nuget validate` and `ducky steam validate` commands correctly validate multi-DLL packages
