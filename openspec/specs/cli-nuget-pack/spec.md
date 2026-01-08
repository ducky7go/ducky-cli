# cli-nuget-pack Specification

## Purpose
TBD - created by archiving change ducky-cli-tool. Update Purpose after archive.
## Requirements
### Requirement: Parse mod metadata from info.ini

The CLI MUST parse the `info.ini` file from the specified mod directory to extract metadata required for NuGet packaging.

#### Scenario: Valid info.ini file

**Given** a mod directory containing a valid `info.ini` file with all required fields
**When** the user runs `ducky nuget pack ./mods/MyMod`
**Then** the CLI should successfully parse the metadata fields (name, version, description, author, etc.)

#### Scenario: Missing info.ini file

**Given** a mod directory without an `info.ini` file
**When** the user runs `ducky nuget pack ./mods/MyMod`
**Then** the CLI should exit with an error indicating the missing file

#### Scenario: Invalid info.ini format

**Given** a mod directory with a malformed `info.ini` file
**When** the user runs `ducky nuget pack ./mods/MyMod`
**Then** the CLI should exit with an error indicating the parsing failure and line number

#### Scenario: Parse tags with comma separator

**Given** an `info.ini` file with tags separated by commas
```ini
tags = tag1, tag2, tag3
```
**When** the CLI parses the metadata
**Then** the tags array should contain `['tag1', 'tag2', 'tag3']`

#### Scenario: Parse tags with quoted strings containing spaces

**Given** an `info.ini` file with tags where some are quoted to contain spaces (comma-separated)
```ini
tags = tag1, "tag2 with spaces", tag3
```
**When** the CLI parses the metadata
**Then** the tags array should contain `['tag1', 'tag2 with spaces', 'tag3']`

#### Scenario: Parse tags with only quoted entries

**Given** an `info.ini` file with all tags quoted (comma-separated)
```ini
tags = "multi word tag 1", "multi word tag 2"
```
**When** the CLI parses the metadata
**Then** the tags array should contain `['multi word tag 1', 'multi word tag 2']`

#### Scenario: Parse empty tags field

**Given** an `info.ini` file with an empty tags field
```ini
tags =
```
**When** the CLI parses the metadata
**Then** the tags should be `undefined`

---

### Requirement: Generate .nuspec file from metadata

The CLI MUST generate a valid `.nuspec` file based on the parsed metadata and the NuGet Mod Packaging Specification v1.0, using the full description content loaded from available description sources.

#### Scenario: Generate nuspec with all fields

**Given** successfully parsed mod metadata with all optional fields present
**When** the CLI generates the `.nuspec` file
**Then** the file should contain all metadata fields mapped to NuGet specification format
**And** the `<description>` field should contain the full description content from available sources

#### Scenario: Generate nuspec with required fields only

**Given** successfully parsed mod metadata with only required fields
**When** the CLI generates the `.nuspec` file
**Then** the file should be valid with default values for missing optional fields
**And** the `<description>` field should fall back to the `info.ini` description field

#### Scenario: Handle special characters in metadata

**Given** metadata containing XML special characters (e.g., `<`, `>`, `&`, quotes)
**When** the CLI generates the `.nuspec` file
**Then** all special characters should be properly escaped

#### Scenario: Use detailed description from description/zh.md

**Given** a mod directory with `description/zh.md` file containing detailed markdown content
**When** the CLI generates the `.nuspec` file
**Then** the `<description>` field should contain the content from `description/zh.md` wrapped in CDATA

#### Scenario: Use detailed description from description/en.md

**Given** a mod directory with `description/en.md` file (and no `description/zh.md`)
**When** the CLI generates the `.nuspec` file
**Then** the `<description>` field should contain the content from `description/en.md` wrapped in CDATA

#### Scenario: Use readme file path from info.ini

**Given** a mod directory with `info.ini` specifying `readme=docs/README.md` and the file exists
**When** the CLI generates the `.nuspec` file
**Then** the `<description>` field should contain the content from the specified readme file

#### Scenario: Use readme content from info.ini

**Given** a mod directory with `info.ini` containing inline `readme` content that is not a file path
**When** the CLI generates the `.nuspec` file
**Then** the `<description>` field should contain the inline readme content from `info.ini`

#### Scenario: Fallback to info.ini description field

**Given** a mod directory with no description files and no readme in `info.ini`
**When** the CLI generates the `.nuspec` file
**Then** the `<description>` field should contain the brief description from the `info.ini` description field

---

### Requirement: Collect mod files using wildcards

The CLI MUST collect all mod files from the directory according to the NuGet Mod Packaging Specification wildcard rules.

#### Scenario: Collect all files recursively

**Given** a mod directory with DLL files and subdirectories
**When** the CLI runs `ducky nuget pack ./mods/MyMod`
**Then** all relevant files should be included in the package according to wildcard patterns

#### Scenario: Handle preview.png icon

**Given** a mod directory containing `preview.png`
**When** the CLI runs `ducky nuget pack ./mods/MyMod`
**Then** `preview.png` should be copied to `icon.png` and included in the package

---

### Requirement: Create .nupkg package file

The CLI MUST invoke the NuGet CLI to create a `.nupkg` package file from the generated `.nuspec` and collected files.

#### Scenario: Successful package creation

**Given** a valid mod directory with proper metadata and files
**When** the CLI runs `ducky nuget pack ./mods/MyMod`
**Then** a `.nupkg` file should be created in the specified output directory

#### Scenario: Specify custom output directory

**Given** a valid mod directory
**When** the CLI runs `ducky nuget pack ./mods/MyMod --output ./build`
**Then** the `.nupkg` file should be created in the `./build` directory

#### Scenario: NuGet CLI not found

**Given** a valid mod directory but NuGet CLI is not installed
**When** the CLI runs `ducky nuget pack ./mods/MyMod`
**Then** the CLI should automatically download and cache the NuGet CLI, then proceed with packaging

---

### Requirement: Validate before packaging

The CLI MUST run all validation rules before attempting to create the package.

#### Scenario: Validation passes

**Given** a mod directory that passes all validation rules
**When** the CLI runs `ducky nuget pack ./mods/MyMod`
**Then** packaging should proceed without errors

#### Scenario: Validation fails

**Given** a mod directory with validation errors (e.g., DLL name mismatch)
**When** the CLI runs `ducky nuget pack ./mods/MyMod`
**Then** the CLI should display all validation errors and exit without creating a package

---

### Requirement: Support --skip-validation flag

The CLI MUST allow users to skip validation with a `--skip-validation` flag for advanced use cases.

#### Scenario: Skip validation with flag

**Given** a mod directory with validation errors
**When** the CLI runs `ducky nuget pack ./mods/MyMod --skip-validation`
**Then** packaging should proceed despite validation errors

---

### Requirement: Display packaging progress

The CLI MUST display progress information during the packaging process.

#### Scenario: Show packaging steps

**Given** a valid mod directory
**When** the CLI runs `ducky nuget pack ./mods/MyMod`
**Then** the CLI should display steps: parsing metadata, generating nuspec, collecting files, creating package

#### Scenario: Show success message

**Given** successful package creation
**When** the packaging completes
**Then** the CLI should display the output file path and package size

---

### Requirement: Load full description with precedence order

The CLI MUST load the description content for the NuGet package using the following precedence order: (1) readme file path from `info.ini`, (2) inline readme content from `info.ini`, (3) `description/zh.md`, (4) `description/en.md`, (5) `description` field from `info.ini`.

#### Scenario: Description from readme file path takes precedence

**Given** a mod directory with `info.ini` containing `readme=docs/README.md` and the file exists
**And** the directory also contains `description/zh.md`
**When** the CLI loads the description for NuGet packaging
**Then** the content from the readme file should be used

#### Scenario: Inline readme content takes precedence over description files

**Given** a mod directory with `info.ini` containing inline readme content (not a file path)
**And** the directory also contains `description/zh.md`
**When** the CLI loads the description for NuGet packaging
**Then** the inline readme content should be used

#### Scenario: description/zh.md takes precedence over description/en.md

**Given** a mod directory with both `description/zh.md` and `description/en.md` files
**When** the CLI loads the description for NuGet packaging
**Then** the content from `description/zh.md` should be used

#### Scenario: description/en.md used when zh.md not present

**Given** a mod directory with only `description/en.md` file
**When** the CLI loads the description for NuGet packaging
**Then** the content from `description/en.md` should be used

#### Scenario: Fallback to info.ini description field

**Given** a mod directory with no readme and no description files
**When** the CLI loads the description for NuGet packaging
**Then** the `description` field from `info.ini` should be used

#### Scenario: Empty string when no description sources available

**Given** a mod directory with no readme, no description files, and no description field in `info.ini`
**When** the CLI loads the description for NuGet packaging
**Then** an empty string should be returned

---

