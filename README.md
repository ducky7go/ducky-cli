# ducky-cli

A command-line tool for packaging and publishing game mods to NuGet servers. `ducky-cli` brings the functionality of `action-ducky-nuget` GitHub Action to local development environments, enabling game mod developers to package and publish their mods directly from the command line.

## Features

- **NuGet Packaging**: Create `.nupkg` packages from mod directories
- **NuGet Publishing**: Publish packages to nuget.org or custom NuGet servers
- **Validation**: Validate mods against the [NuGet Mod Packaging Specification v1.0](https://github.com/ducky7go/dukcy-package-spec)
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Namespace Design**: Organized commands for future support of other package formats

## Installation

```bash
npm install -g ducky-cli
```

Or use directly with npx:

```bash
npx ducky-cli --help
```

## Quick Start

### Package a Mod

```bash
ducky nuget pack ./mods/MyMod
```

This creates a `.nupkg` file in the mod directory.

### Publish to NuGet

```bash
# Set your API key
export NUGET_API_KEY=your-api-key

# Push a .nupkg file
ducky nuget push ./mods/MyMod.1.0.0.nupkg

# Or pack and push in one step
ducky nuget push ./mods/MyMod --pack
```

### Validate a Mod

```bash
ducky nuget validate ./mods/MyMod
```

## Commands

### `ducky nuget pack`

Package a mod directory into a `.nupkg` file.

```bash
ducky nuget pack <path> [options]
```

**Arguments:**
- `<path>` - Path to the mod directory

**Options:**
- `-o, --output <path>` - Output directory for the `.nupkg` file (default: same as input)
- `-v, --verbose` - Enable verbose output

**Example:**
```bash
ducky nuget pack ./mods/MyMod -o ./output
```

### `ducky nuget push`

Publish a `.nupkg` file to a NuGet server.

```bash
ducky nuget push <path> [options]
```

**Arguments:**
- `<path>` - Path to the `.nupkg` file or mod directory (with `--pack`)

**Options:**
- `-p, --pack` - Package the mod before pushing
- `-s, --server <url>` - NuGet server URL (default: `https://api.nuget.org/v3/index.json`)
- `-k, --api-key <key>` - NuGet API key
- `-o, --output <path>` - Output directory for `.nupkg` file (when using `--pack`)
- `-v, --verbose` - Enable verbose output

**Examples:**
```bash
# Push an existing .nupkg file
ducky nuget push ./mods/MyMod.1.0.0.nupkg

# Pack and push in one step
ducky nuget push ./mods/MyMod --pack

# Use a custom NuGet server
ducky nuget push ./mods/MyMod.1.0.0.nupkg --server https://my-nuget-server.com/v3/index.json
```

### `ducky nuget validate`

Validate a mod directory against the NuGet Mod Packaging Specification.

```bash
ducky nuget validate <path> [options]
```

**Arguments:**
- `<path>` - Path to the mod directory

**Options:**
- `-v, --verbose` - Enable verbose output

**Example:**
```bash
ducky nuget validate ./mods/MyMod
```

## Configuration

Configuration can be provided via:
1. Command-line flags (highest priority)
2. Environment variables
3. Default values (lowest priority)

### Environment Variables

- `NUGET_API_KEY` - API key for NuGet authentication
- `NUGET_SERVER` - Default NuGet server URL
- `NUGET_VERBOSE` - Enable verbose output

## Mod Directory Structure

A valid mod directory should contain:

```
MyMod/
├── info.ini              # Mod metadata (required)
├── MyMod.dll             # Main DLL (required, name must match info.ini name field)
├── preview.png           # Optional preview image
└── ...other files        # Any other mod files
```

### info.ini Format

```ini
name=MyMod
version=1.0.0
description=My awesome game mod
author=Your Name
projectUrl=https://github.com/yourname/mymod
license=MIT
tags=game,mod,example

[dependencies]
OtherMod=1.0.0
```

**Required fields:**
- `name` - NuGet package ID (must start with letter or underscore, max 100 chars)
- `version` - SemVer 2.0 version (e.g., `1.0.0`, `2.1.0-beta`)

**Optional fields:**
- `description` - Package description
- `author` - Package author
- `projectUrl` - Project URL
- `license` - License identifier
- `tags` - Comma-separated list of tags
- `dependencies` - Comma-separated list of dependencies with optional versions

## Validation Rules

The tool validates mods against these rules:

1. **DLL Name Matching**: At least one DLL file must have a base name matching the `name` field in `info.ini`
2. **SemVer 2.0 Version**: Version must follow semantic versioning 2.0 format
3. **Valid NuGet ID**: Package name must be a valid NuGet identifier
4. **Required Fields**: `name` and `version` fields are required

## Examples

### Complete Workflow

```bash
# 1. Create your mod directory with info.ini and DLL files
mkdir -p ./mods/MyMod

# 2. Validate your mod
ducky nuget validate ./mods/MyMod

# 3. Package your mod
ducky nuget pack ./mods/MyMod

# 4. Publish to NuGet
export NUGET_API_KEY=your-api-key
ducky nuget push ./mods/MyMod.1.0.0.nupkg
```

### Using Custom NuGet Server

```bash
export NUGET_SERVER=https://my-nuget-server.com/v3/index.json
export NUGET_API_KEY=your-api-key
ducky nuget push ./mods/MyMod.1.0.0.nupkg
```

## Error Handling

The tool provides helpful error messages with suggestions:

```
✖ Invalid version format: 1.0

Suggestions:
  • Version must follow SemVer 2.0 format
  • Examples: 1.0.0, 2.1.0-beta, 3.0.0-rc.1
```

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT License - see LICENSE file for details

## Related Projects

- [action-ducky-nuget](https://github.com/ducky7go/action-ducky-nuget) - GitHub Action for CI/CD
- [NuGet Mod Packaging Specification](https://github.com/ducky7go/dukcy-package-spec) - Specification for mod packaging

## Support

- Report bugs: [GitHub Issues](https://github.com/ducky7go/ducky-cli/issues)
- Documentation: [GitHub Wiki](https://github.com/ducky7go/ducky-cli/wiki)
