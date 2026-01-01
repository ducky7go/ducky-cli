# Design: ducky-cli Architecture

**Change ID:** `ducky-cli-tool`

## Overview

This document describes the architecture and technical decisions for the `ducky-cli` command-line tool.

## Architecture

### Project Structure

```
ducky-cli/
├── src/
│   ├── cli.ts              # Main CLI entry point
│   ├── commands/
│   │   ├── nuget/
│   │   │   ├── pack.ts         # NuGet pack command implementation
│   │   │   ├── push.ts         # NuGet push command implementation
│   │   │   └── validate.ts     # NuGet validation command implementation
│   │   └── index.ts            # Command registry
│   ├── formats/
│   │   ├── nuget/
│   │   │   ├── parser.ts       # info.ini parser
│   │   │   ├── nuspec.ts       # .nuspec generator
│   │   │   ├── validator.ts    # Validation rules
│   │   │   └── client.ts       # NuGet API client
│   │   └── index.ts            # Format registry
│   └── utils/
│       ├── config.ts       # Configuration handling
│       ├── fs.ts           # File system utilities
│       └── logger.ts       # Logging utilities
├── bin/
│   └── ducky               # Executable script
├── test/
│   ├── unit/               # Unit tests
│   └── integration/        # Integration tests
└── package.json
```

**Note**: The structure separates format-specific logic (under `formats/`) from command implementations, enabling future support for other package formats (e.g., `formats/zip/`, `formats/tar/`).

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLI Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ ducky nuget  │  │ ducky [fmt]  │  │ ducky [cmd]  │          │
│  │   pack/push  │  │   (future)   │  │   (future)   │          │
│  └──────┬───────┘  └──────────────┘  └──────────────┘          │
└─────────┼──────────────────────────────────────────────────────┘
          │
┌─────────┴──────────────────────────────────────────────────────┐
│                       Command Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  nuget-pack  │  │  nuget-push  │  │nuget-validate│          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼──────────────────┼──────────────────┼────────────────┘
          │                  │                  │
┌─────────┴──────────────────┴──────────────────┴────────────────┐
│                       Format Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   NuGet      │  │  (Zip/Tar)   │  │  (Future)    │          │
│  │   Format     │  │  (Future)    │  │  Formats     │          │
│  │              │  │              │  │              │          │
│  │ ┌────────┐   │  │              │  │              │          │
│  │ │parser  │   │  │              │  │              │          │
│  │ │nuspec  │   │  │              │  │              │          │
│  │ │validator│   │  │              │  │              │          │
│  │ │client  │   │  │              │  │              │          │
│  │ └────────┘   │  │              │  │              │          │
│  └──────┬───────┘  └──────────────┘  └──────────────┘          │
└─────────┼──────────────────────────────────────────────────────┘
          │
┌─────────┴──────────────────────────────────────────────────────┐
│                      Utilities Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    config    │  │      fs      │  │    logger    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

**Key Design Points**:
- Commands are organized under format namespaces (`nuget`, with `zip`/`tar` as future options)
- Format-specific logic (parsers, validators, clients) lives under `formats/`
- Adding a new format requires creating a new `formats/<name>/` directory and command registry

## Technical Decisions

### 1. CLI Framework Selection

**Decision**: Use [Commander.js](https://www.npmjs.com/package/commander) with subcommand architecture

**Rationale**:
- Mature, widely-adopted CLI framework for Node.js
- Native support for subcommands via `.command()`
- Declarative API for defining commands and options
- Built-in help generation for nested commands
- Good TypeScript support

**Namespace Implementation**:
```typescript
// Main CLI registers format subcommands
program
  .command('nuget')
  .description('NuGet package format commands')
  .addCommand(nugetPackCommand)
  .addCommand(nugetPushCommand)
  .addCommand(nugetValidateCommand);
```

**Alternatives Considered**:
- **yargs**: More complex API, steeper learning curve
- **oclif**: More opinionated, better for multi-command CLIs with plugins
- **CAC**: Lightweight but less feature-rich

### 2. NuGet Operations Strategy

**Decision**: Use embedded NuGet CLI (via automatic download)

**Rationale**:
- Full compatibility with official NuGet behavior
- Supports all packaging and publishing features
- Single cross-platform Node.js dependency

**Implementation**:
1. On first run, detect if NuGet CLI is available in PATH
2. If not found, download appropriate binary for platform
3. Cache in user's home directory (`~/.ducky/nuget/`)
4. Use child_process to execute NuGet commands

**Alternatives Considered**:
- **Require manual installation**: Poor user experience
- **Pure Node.js implementation**: Would require re-implementing NuGet protocol, high maintenance burden
- **Bundle with package**: Increases package size significantly

### 3. Configuration Management

**Decision**: Support multiple configuration sources with precedence

**Precedence (highest to lowest)**:
1. Command-line flags
2. Environment variables
3. Config file (`.duckyrc` or `ducky.config.js`)
4. Default values

**Rationale**:
- Flexibility for different use cases
- CI/CD friendly (environment variables)
- Power-user friendly (config files)

### 4. Code Sharing with action-ducky-nuget

**Decision**: Copy/adapt core logic initially; consider shared library later

**Rationale**:
- This is a new project; no existing code to share
- When action-ducky-nuget code exists, evaluate extraction
- For now, focus on making ducky-cli work independently

**Future Consideration**:
- If both projects mature, extract `@ducky/core` package
- Shared package would contain: parser, validator, nuspec generator
- Format-specific logic (NuGet, Zip, etc.) remains in respective format modules

### 5. Namespace and Format Extensibility

**Decision**: Organize commands by format namespace

**Rationale**:
- Allows future support for other package formats without command conflicts
- Clear separation of format-specific logic
- Consistent CLI structure: `ducky <format> <action>`

**Adding a New Format**:
```typescript
// src/commands/zip/index.ts
export const zipPackCommand = new Command('pack');
export const zipPushCommand = new Command('push');

// src/cli.ts
program
  .command('zip')
  .description('Zip package format commands')
  .addCommand(zipPackCommand)
  .addCommand(zipPushCommand);
```

### 6. Error Handling Strategy

**Decision**: Structured error types with user-friendly messages

**Error Categories**:
- `ValidationError`: Mod fails validation (with specific field/issue)
- `ConfigError`: Missing or invalid configuration
- `NetworkError`: NuGet server communication failure
- `FileSystemError`: File access/permission issues

**Implementation**:
```typescript
class DuckyError extends Error {
  code: string;
  suggestions?: string[];

  constructor(message: string, code: string, suggestions?: string[]) {
    super(message);
    this.code = code;
    this.suggestions = suggestions;
  }
}
```

### 7. Testing Strategy

**Unit Tests**:
- Parser logic for `info.ini`
- Nuspec template generation
- Validation rules
- Configuration resolution

**Integration Tests**:
- End-to-end pack command with sample mod
- End-to-end publish command (to test NuGet server)
- Error handling scenarios

**Fixtures**:
- Sample valid mod directory
- Sample invalid mod directories (one per validation rule)

### 8. Versioning and Compatibility

**Decision**: Semantic Versioning (SemVer 2.0)

**Compatibility Promise**:
- Major versions: Breaking changes
- Minor versions: New features, backward compatible
- Patch versions: Bug fixes, backward compatible

**Specification Version**:
- Support NuGet Mod Packaging Specification v1.0
- Document supported spec version in package.json
- Fail gracefully if spec version mismatch detected

## Data Flow

### Pack Command Flow

```
User Input
    │
    ▼
┌─────────────────┐
│ Validate Input │
│ (path exists)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Read info.ini   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Parse Metadata  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Run Validators │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate .nuspec│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Collect Files   │
│ (wildcards)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Call NuGet CLI  │
│ (pack command)  │
└────────┬────────┘
         │
         ▼
    Output .nupkg
```

### Publish Command Flow

```
User Input
    │
    ▼
┌─────────────────┐
│ Validate Input │
│ (.nupkg exists)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Load Config     │
│ (API key, etc.) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Validate Creds  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Call NuGet CLI  │
│ (push command)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Handle Response │
└────────┬────────┘
         │
         ▼
    Success/Error
```

## Dependencies

### Runtime Dependencies

```json
{
  "commander": "^11.0.0",
  "chalk": "^5.3.0",
  "ini": "^4.1.0",
  "ora": "^7.0.0",
  "fs-extra": "^11.1.0"
}
```

### Development Dependencies

```json
{
  "@types/node": "^20.0.0",
  "typescript": "^5.0.0",
  "vitest": "^1.0.0",
  "eslint": "^8.0.0",
  "prettier": "^3.0.0"
}
```

## Security Considerations

1. **API Key Handling**
   - Never log or display API keys
   - Support environment variables for CI/CD
   - Warn when using API key via command-line flag (appears in process list)

2. **File Operations**
   - Validate file paths to prevent directory traversal
   - Limit file operations to specified mod directory

3. **NuGet CLI Download**
   - Verify checksum of downloaded executable
   - Use HTTPS only
   - Download from official NuGet sources

4. **Package Publishing**
   - Confirm before publishing (unless `--yes` flag)
   - Display what will be published before pushing

## Future Extensibility

### Potential Future Commands

```bash
# NuGet commands (current implementation)
ducky nuget pack ./mods/MyMod
ducky nuget push ./mods/MyMod.nupkg
ducky nuget validate ./mods/MyMod

# Future format support
ducky zip pack ./mods/MyMod
ducky zip push ./mods/MyMod.zip
ducky tar pack ./mods/MyMod

# Global commands
ducky info ./mods/MyMod.nupkg      # Inspect any package format
ducky init MyMod                   # Initialize a new mod project
ducky config set api-key ***       # Configure settings
```

### Adding New Package Formats

To add a new package format (e.g., ZIP):

1. Create `src/formats/zip/` directory with format-specific logic:
   - `parser.ts` - Parse metadata for this format
   - `packager.ts` - Create packages
   - `client.ts` - Upload to repository
   - `validator.ts` - Validate against format rules

2. Create `src/commands/zip/` directory with command implementations:
   - `pack.ts` - Pack command
   - `push.ts` - Push command
   - `validate.ts` - Validate command

3. Register the format in `src/cli.ts`:
   ```typescript
   import { zipPackCommand, zipPushCommand } from './commands/zip';

   program
     .command('zip')
     .description('ZIP package format commands')
     .addCommand(zipPackCommand)
     .addCommand(zipPushCommand);
   ```

## Open Questions

1. Should we support `--dry-run` for publish command? (Recommended)
2. Should we support `.nupkg` inspection/extraction? (Future consideration)
3. Should we support batch operations on multiple directories? (Future consideration)
