# Proposal: Create ducky-cli Tool

**Change ID:** `ducky-cli-tool`
**Status:** ExecutionCompleted
**Created:** 2025-01-01

## Overview

Create a new command-line tool `ducky-cli` that brings the functionality of `action-ducky-nuget` GitHub Action to local development environments. This tool will enable game mod developers to package and publish their mods to NuGet servers directly from their command line, without requiring GitHub Actions workflows.

## Background

The existing `action-ducky-nuget` project provides core functionality for packaging game mods according to the [NuGet Mod Packaging Specification v1.0](https://github.com/ducky7go/dukcy-package-spec):

- Parse `info.ini` metadata and generate `.nuspec` files
- Wildcard file inclusion (automatically include all mod files)
- Validation (DLL name matching, SemVer 2.0 compliance, NuGet ID validity)
- Multi-server support (nuget.org or custom NuGet servers)
- Icon handling (auto-copy `preview.png` as `icon.png`)
- OIDC/Trusted Publisher or API Key authentication

Currently, these features are only available within GitHub Actions environments, creating a barrier for local development and testing.

## Problem Statement

The current `action-ducky-nuget` implementation has several limitations:

1. **Environment Dependency**: Must run within GitHub Actions; cannot be used in local development environments
2. **Workflow Complexity**: Requires configuring GitHub Actions YAML files, setting secrets, and installing dependencies like Mono
3. **Testing Difficulty**: Local testing of mod packaging and publishing requires running through GitHub Actions, reducing debugging efficiency
4. **High Barrier to Entry**: Users unfamiliar with GitHub Actions face significant configuration and usage costs

## Proposed Solution

Create a standalone `ducky-cli` command-line tool that migrates the core functionality of `action-ducky-nuget` to a locally runnable application.

### Core Features

1. **NuGet Packaging Command (`ducky nuget pack`)**
   - Parse `info.ini` metadata from mod directory
   - Generate `.nuspec` file based on specification
   - Create `.nupkg` package file

2. **NuGet Publishing Command (`ducky nuget push`)**
   - Publish to nuget.org or custom NuGet servers
   - Support API Key authentication via environment variables or flags
   - Option to pack and publish in one step

3. **NuGet Validation (`ducky nuget validate`)**
   - DLL name matches `name` field in `info.ini`
   - SemVer 2.0 version format compliance
   - NuGet ID validity checks

4. **CLI Interface**

```bash
# Package a mod
ducky nuget pack ./mods/MyMod

# Publish a .nupkg file
ducky nuget push ./mods/MyMod.nupkg

# Pack and publish in one step
ducky nuget push ./mods/MyMod --pack

# Validate a mod
ducky nuget validate ./mods/MyMod

# Specify custom NuGet server
ducky nuget push ./mods/MyMod --server https://my-nuget-server.com/v3/index.json

# Specify API key
ducky nuget push ./mods/MyMod --api-key $NUGET_API_KEY
```

**Note**: The commands are namespaced under `ducky nuget` to allow for future support of other package formats (e.g., `ducky zip pack`, `ducky tar pack`).

### Technical Approach

- **Language**: TypeScript/Node.js (for code reuse and cross-platform support)
- **CLI Framework**: Commander.js
- **Code Reuse**: Extract and adapt existing validation/parsing logic from `action-ducky-nuget`
- **Configuration**: Support environment variables (`NUGET_API_KEY`, `NUGET_SERVER`) and optional config file
- **NuGet Operations**: Use embedded or auto-downloaded NuGet CLI for packaging/publishing

## Scope

### In Scope

1. Core `ducky nuget pack` command for creating `.nupkg` files
2. Core `ducky nuget push` command for uploading to NuGet servers
3. Core `ducky nuget validate` command for validating mods
4. All validation rules from the existing action
5. API Key authentication
6. Support for custom NuGet servers
7. Cross-platform support (Windows, macOS, Linux)
8. CLI help documentation
9. Basic error handling and user-friendly error messages
10. Namespace design to support future package formats

### Out of Scope (Future Considerations)

1. OIDC/Trusted Publisher authentication (can be added later)
2. GUI or interactive mode
3. Mod discovery or browsing features
4. Batch operations on multiple mods
5. Integration with package managers like npm/yarn
6. Other package format support (e.g., zip, tar) - namespace is designed for this but implementation is deferred

## Impact

### Benefits

1. **Improved Developer Experience**: Users can quickly test packaging and publishing locally without waiting for CI/CD
2. **Lower Barrier to Entry**: No need to configure GitHub Actions; direct command-line operations
3. **Increased Flexibility**: Supports local builds, pre-release testing, batch operations
4. **Consistency**: Follows the same packaging specification and validation rules as the GitHub Action

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Code duplication between action and CLI | Consider extracting shared library; for now, accept duplication for simplicity |
| NuGet CLI dependency complexity | Provide clear installation instructions; consider embedding CLI in future |
| Breaking changes in specification | Version the CLI and document supported spec version |
| Platform-specific issues | Test on all three platforms; use cross-platform Node.js APIs |

## Success Criteria

1. CLI can package a valid mod directory into a `.nupkg` file
2. CLI can publish a `.nupkg` file to nuget.org with API Key authentication
3. All validation rules from `action-ducky-nuget` are enforced
4. CLI works on Windows, macOS, and Linux
5. Published packages are identical to those created by the GitHub Action
6. Clear error messages guide users when validation fails

## Related Changes

This is a new standalone project. No existing specs are being modified.

## Specs Affected

New capabilities to be added:
- `cli-nuget-pack` - NuGet package command and file handling
- `cli-nuget-push` - NuGet push command and server communication
- `cli-nuget-validation` - Validation rules and error reporting
- `cli-namespace` - Namespace structure for multi-format support
