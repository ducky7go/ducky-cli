# Tasks: ducky-cli Implementation

**Change ID:** `ducky-cli-tool`

## Implementation Tasks

This is an ordered list of implementation tasks. Each task should produce verifiable progress.

### Phase 1: Project Foundation

- [x] **T1: Initialize Node.js project**
  - Create `package.json` with project metadata
  - Set up TypeScript configuration (`tsconfig.json`)
  - Configure ESLint and Prettier
  - Create basic directory structure (`src/`, `bin/`, `test/`, `src/commands/`, `src/formats/`)
  - **Validation**: `npm install` succeeds, `tsc --version` works

- [x] **T2: Set up CLI framework with namespace support**
  - Install Commander.js dependency
  - Create basic `cli.ts` entry point with help text
  - Create `bin/ducky` executable script
  - Add npm `bin` entry to package.json
  - Implement namespace registration pattern for `ducky <format> <command>`
  - **Validation**: `ducky --help` displays usage information, `ducky nuget --help` shows NuGet commands

- [x] **T3: Set up testing framework**
  - Install Vitest for testing
  - Configure test scripts in package.json
  - Create test directory structure
  - Add sample unit test
  - **Validation**: `npm test` runs successfully

### Phase 2: Core Utilities

- [x] **T4: Implement configuration management**
  - Create `src/utils/config.ts`
  - Implement environment variable loading (`NUGET_API_KEY`, `NUGET_SERVER`)
  - Implement CLI flag resolution precedence
  - Add support for `.duckyrc` config file (optional)
  - **Validation**: Unit tests for config resolution with multiple sources

- [x] **T5: Implement file system utilities**
  - Create `src/utils/fs.ts`
  - Add file existence checking
  - Add directory traversal utilities
  - Add path validation (prevent directory traversal)
  - **Validation**: Unit tests for all fs utilities

- [x] **T6: Implement logger utilities**
  - Create `src/utils/logger.ts`
  - Add colored console output using chalk
  - Add error, warning, info, success logging methods
  - Add support for verbose mode
  - **Validation**: Manual testing of output formats

- [x] **T7: Implement error handling**
  - Create `src/utils/errors.ts`
  - Define error types (ValidationError, ConfigError, NetworkError, FileSystemError)
  - Add error code system
  - Add suggestion system for errors
  - **Validation**: Unit tests for error types and formatting

### Phase 3: NuGet Format Logic

- [x] **T8: Implement info.ini parser**
  - Create `src/formats/nuget/parser.ts`
  - Parse INI format using `ini` library
  - Extract required fields (name, version, description, author)
  - Extract optional fields (icon, tags, etc.)
  - Validate INI structure
  - **Validation**: Unit tests with valid and invalid INI files

- [x] **T9: Implement .nuspec generator**
  - Create `src/formats/nuget/nuspec.ts`
  - Generate XML from parsed metadata
  - Apply NuGet Mod Packaging Specification template
  - Handle XML special character escaping
  - **Validation**: Unit tests compare generated XML against expected output

- [x] **T10: Implement file collector**
  - Create `src/formats/nuget/collector.ts`
  - Implement wildcard file matching
  - Collect DLL files recursively
  - Handle icon file (preview.png -> icon.png)
  - **Validation**: Unit tests with sample directory structures

- [x] **T11: Implement validation rules**
  - Create `src/formats/nuget/validator.ts`
  - Implement DLL name matching validation
  - Implement SemVer 2.0 version validation
  - Implement NuGet ID validation
  - Implement required fields validation
  - **Validation**: Unit tests for each validation rule with pass/fail cases

- [x] **T12: Create NuGet format registry**
  - Create `src/formats/nuget/index.ts`
  - Export parser, nuspec generator, collector, validator
  - Define format interface for future formats
  - **Validation**: Imports work correctly, types are defined

### Phase 4: NuGet Integration

- [x] **T13: Implement NuGet CLI manager**
  - Create `src/formats/nuget/client.ts`
  - Detect NuGet CLI in PATH
  - Implement automatic download for platform-appropriate binary
  - Implement caching in `~/.ducky/nuget/`
  - Verify checksum of downloaded binary
  - **Validation**: Manual testing on at least two platforms

- [x] **T14: Implement NuGet pack wrapper**
  - Add `pack()` method to `src/formats/nuget/client.ts`
  - Invoke NuGet CLI with pack command
  - Handle output directory specification
  - Parse NuGet CLI output for errors
  - **Validation**: Integration test with sample mod

- [x] **T15: Implement NuGet push wrapper**
  - Add `push()` method to `src/formats/nuget/client.ts`
  - Invoke NuGet CLI with push command
  - Handle API key authentication
  - Handle custom server URLs
  - Parse NuGet CLI output for errors
  - **Validation**: Manual testing with test NuGet server

### Phase 5: CLI Commands

- [x] **T16: Implement nuget pack command**
  - Create `src/commands/nuget/pack.ts`
  - Parse command arguments (input path, output directory)
  - Call parser, validator, nuspec generator, collector from format
  - Call NuGet pack wrapper
  - Display progress and results
  - **Validation**: Manual test with `ducky nuget pack ./mods/MyMod`

- [x] **T17: Implement nuget push command**
  - Create `src/commands/nuget/push.ts`
  - Parse command arguments (package path or directory with --pack)
  - Load API key from environment or flag
  - Handle --pack flag for combined workflow
  - Call NuGet push wrapper
  - Display progress and results
  - **Validation**: Manual test with `ducky nuget push ./mods/MyMod.nupkg`

- [x] **T18: Implement nuget validate command**
  - Create `src/commands/nuget/validate.ts`
  - Parse command arguments (input path)
  - Run all validation rules from format
  - Display results with clear error messages
  - Support --verbose flag
  - **Validation**: Manual test with `ducky nuget validate ./mods/MyMod`

- [x] **T19: Create command registry**
  - Create `src/commands/index.ts`
  - Register NuGet namespace with pack, push, validate commands
  - Set up help text for namespace and commands
  - **Validation**: `ducky --help` shows `nuget` command, `ducky nuget --help` shows subcommands

- [x] **T20: Wire commands in main CLI**
  - Update `src/cli.ts` to register command namespaces
  - Add command-specific help text
  - Add global options (--verbose, --version)
  - **Validation**: `ducky nuget pack --help` provides useful information

### Phase 6: Testing & Documentation

- [x] **T21: Create integration test fixtures**
  - Create sample valid mod directory in `test/fixtures/`
  - Create sample invalid mod directories (one per validation rule)
  - Add sample .nupkg files for testing
  - **Validation**: Fixtures are properly structured

- [x] **T22: Write integration tests**
  - Test full `ducky nuget pack` command workflow
  - Test full `ducky nuget validate` command workflow
  - Test `ducky nuget push` command with mock NuGet server
  - Test error handling scenarios
  - Test namespace registration
  - **Validation**: All tests pass

- [x] **T23: Write README documentation**
  - Document installation instructions
  - Document all commands with namespace examples (`ducky nuget pack`, etc.)
  - Document configuration options
  - Document common errors and solutions
  - Explain namespace design and future extensibility
  - **Validation**: README renders correctly with examples

- [x] **T24: Add CLI help text**
  - Add comprehensive help text for each namespace and command
  - Add examples in help text
  - Add link to full documentation
  - **Validation**: `ducky nuget <command> --help` provides useful information

### Phase 7: Release Preparation

- [x] **T25: Set up package publishing**
  - Configure `package.json` for npm publishing
  - Add files field to include necessary files
  - Add bin entry for executable
  - Add repository and bugs links
  - **Validation**: `npm pack` produces valid tarball

- [x] **T26: Create release scripts**
  - Add build script to compile TypeScript
  - Add pre-publish script to run tests
  - Add version bump script
  - **Validation**: All scripts run successfully

- [x] **T27: Cross-platform testing**
  - Test on Windows (or Windows VM)
  - Test on macOS (or macOS VM)
  - Test on Linux (already primary dev environment)
  - **Validation**: All core functionality works on all platforms

## Dependencies

- T2 depends on T1 (project must exist)
- T16, T17, T18 depend on T4-T15 (format logic must exist)
- T19 depends on T16-T18 (commands must exist)
- T20 depends on T19 (registry must exist)
- T22 depends on T21 (fixtures must exist)
- T25-T27 can be done in parallel after T24

## Parallelizable Work

The following tasks can be done in parallel:
- T4, T5, T6, T7 (all utilities)
- T8, T9, T10, T11 (format logic, after utilities exist)
- T16, T17, T18 (CLI commands, after format logic exists)
- T23, T24 (documentation, in parallel with testing)
