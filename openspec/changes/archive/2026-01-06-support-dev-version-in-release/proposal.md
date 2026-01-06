# Change: Support dev version in release

## Why

The current version parsing logic in ducky-cli strips the `-dev.x` suffix from version numbers. When a user specifies version `0.1.2-dev.1`, the system incorrectly treats it as `0.1.2`, losing important pre-release information. This prevents developers from publishing and testing development versions of their mods.

## What Changes

- **Fix version parsing** to correctly preserve `-dev.x` and other pre-release suffixes in SemVer 2.0 format
- **Verify SemVer regex** properly handles pre-release identifiers like `dev.1`, `dev.2`, etc.
- **Add test coverage** for dev version formats including `0.1.2-dev.1`, `1.0.0-dev.2`, etc.
- **Ensure NuGet compatibility** with the fixed version format

## Impact

- **Affected specs**: `nuget-format` (version parsing and validation)
- **Affected code**:
  - `src/formats/nuget/parser.ts` (line 228-233: `isValidSemVer` function)
  - `src/formats/nuget/validator.ts` (line 95-113: `validateSemVer` function)
- **Backward compatibility**: No breaking changes - existing version formats continue to work
- **Testing**: New unit tests for dev version format edge cases
