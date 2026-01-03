# Change: Read CLI version from package.json

## Why

The current CLI has a hardcoded version string (`'0.1.0'`) in `src/cli.ts` that is inconsistent with the actual version in `package.json` (`'0.0.1'`). This violates the single source of truth principle and creates maintenance overhead, as version updates require manual synchronization across multiple files.

## What Changes

- Modify `src/cli.ts` to dynamically read the version from `package.json` at runtime
- Remove the hardcoded version string `'0.1.0'`
- Ensure the `--version` flag displays the correct version from `package.json`

## Impact

- Affected specs: `cli-namespace` (new requirement for dynamic version loading)
- Affected code: `src/cli.ts:12`
- No breaking changes for end users
- Simplifies release workflow: only `package.json` needs to be updated for version bumps
