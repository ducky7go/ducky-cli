# Change: Fix Cross-Platform Path Separator Handling

## Why

The codebase contains hardcoded path separator logic (`split('/')`) that works on Linux/macOS but fails on Windows, which uses backslash (`\`) as the path separator. This creates a cross-platform compatibility issue where Windows users cannot correctly extract filenames from paths in validation and file collection operations.

## What Changes

- Replace all hardcoded `split('/')` path operations with Node.js native `path` module methods
- Use `path.basename()` to extract filenames from paths
- Update affected files:
  - `src/formats/steam/validator.ts` (lines 170, 177)
  - `src/formats/nuget/collector.ts` (line 86)
  - `src/formats/nuget/validator.ts` (lines 74, 81)
  - `src/commands/nuget/validate.ts` (line 57)
- Remove inconsistent dual-handling patterns (`split('/').pop() || split('\\').pop()`)
- Ensure proper `path` module imports in all affected files

## Impact

- **Affected specs**: `path-handling` (new specification for cross-platform path utilities)
- **Affected code**:
  - `src/formats/steam/validator.ts` - Steam Workshop DLL name validation
  - `src/formats/nuget/collector.ts` - NuGet package file collection
  - `src/formats/nuget/validator.ts` - NuGet DLL name validation
  - `src/commands/nuget/validate.ts` - NuGet validate command output

## Benefits

- **True cross-platform compatibility**: Consistent behavior on Windows, macOS, and Linux
- **Improved maintainability**: Uses standard Node.js APIs instead of custom string manipulation
- **Reduced bug surface**: Eliminates platform-specific edge cases in path handling

## Migration

No user-facing migration required. This is an internal implementation change that fixes Windows compatibility without affecting APIs or functionality.

## Testing Requirements

- Test path extraction on Windows environment
- Run existing tests on Linux/macOS to ensure no regression
- Verify `nuget pack/push/validate` commands work correctly on all platforms
- Verify `steam push/validate` commands work correctly on all platforms
