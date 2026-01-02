# Change: Fix tag parsing in NuGet packages

## Why

The `tags` field in `info.ini` should use comma (`,`) as the sole delimiter for consistency and to avoid ambiguity. The current `parseList` function already implements comma-separated parsing correctly. This change clarifies that:
1. Comma is the only valid delimiter: `tags = tag1, tag2, tag3`
2. Tags containing spaces should be quoted: `tags = "tag with spaces", another-tag`
3. Space-only separation (e.g., `tags = tag1 tag2`) is not supported

## What Changes

- Update documentation and validation to clarify that comma (`,`) is the ONLY supported delimiter
- Add support for quoted strings to allow tags with spaces: `tags = "tag with spaces", normal-tag`
- Remove ambiguity around space-separated tags (they are not supported)
- Maintain backward compatibility - existing comma-separated tags continue to work

## Impact

- Affected specs: `cli-nuget-pack`
- Affected code: `src/formats/nuget/parser.ts:parseList()`
- Tests: `test/unit/parser.test.ts` (tag parsing tests)
