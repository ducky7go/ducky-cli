## 1. Implementation

- [x] 1.1 Update `generateNuspec()` function signature to accept `modPath` parameter
- [x] 1.2 Import `loadDescription` function in `src/formats/nuget/nuspec.ts`
- [x] 1.3 Call `loadDescription(modPath, metadata)` to get full description content
- [x] 1.4 Update description assignment to use loaded content instead of `metadata.description`

## 2. Update Callers

- [x] 2.1 Find all callers of `generateNuspec()` in the codebase
- [x] 2.2 Update each caller to pass the `modPath` parameter

## 3. Testing

- [x] 3.1 Test with mod containing `description/zh.md`
- [x] 3.2 Test with mod containing `description/en.md`
- [x] 3.3 Test with mod containing readme file path in `info.ini`
- [x] 3.4 Test with mod having only `info.ini` description field (fallback)
- [x] 3.5 Verify generated `.nuspec` contains full description in CDATA when multi-line

## 4. Validation

- [x] 4.1 Run existing tests to ensure no regressions
- [x] 4.2 Add test case for enhanced description loading
- [x] 4.3 Verify NuGet package can be created successfully
