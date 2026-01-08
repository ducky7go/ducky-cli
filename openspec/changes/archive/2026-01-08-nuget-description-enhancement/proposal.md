# Change: Enhance NuGet package description with detailed content

**Status:** ExecutionCompleted

## Why

The current NuGet packaging flow only uses the short `description` field from `info.ini` for the package's `<description>` element. This brief text is insufficient for users browsing the NuGet Gallery, who need more comprehensive information about the mod. The codebase already has a `loadDescription()` function that can fetch detailed descriptions from multiple sources (readme files, description/*.md files), but it is not being used during `.nuspec` generation.

## What Changes

- Modify `src/formats/nuget/nuspec.ts` to import and call the existing `loadDescription()` function from `parser.ts`
- Update the `generateNuspec()` function to accept the `modPath` parameter required by `loadDescription()`
- Use the full description content returned by `loadDescription()` instead of the brief `metadata.description` field

## Impact

- **Affected specs:** `cli-nuget-pack` (modify `.nuspec` generation requirement)
- **Affected code:**
  - `src/formats/nuget/nuspec.ts:42-115` - `generateNuspec()` function
  - `src/formats/nuget/nuspec.ts:77-78` - description assignment logic
  - Any callers of `generateNuspec()` (need to pass `modPath` parameter)

- **Backward compatibility:** Fully maintained - `loadDescription()` has a fallback chain that ends with `metadata.description`, so existing mods without detailed description files will continue to work as before

- **User experience:** NuGet Gallery users will see complete mod descriptions instead of one-liners
