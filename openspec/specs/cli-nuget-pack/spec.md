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

---

### Requirement: Generate .nuspec file from metadata

The CLI MUST generate a valid `.nuspec` file based on the parsed metadata and the NuGet Mod Packaging Specification v1.0.

#### Scenario: Generate nuspec with all fields

**Given** successfully parsed mod metadata with all optional fields present
**When** the CLI generates the `.nuspec` file
**Then** the file should contain all metadata fields mapped to NuGet specification format

#### Scenario: Generate nuspec with required fields only

**Given** successfully parsed mod metadata with only required fields
**When** the CLI generates the `.nuspec` file
**Then** the file should be valid with default values for missing optional fields

#### Scenario: Handle special characters in metadata

**Given** metadata containing XML special characters (e.g., `<`, `>`, `&`, quotes)
**When** the CLI generates the `.nuspec` file
**Then** all special characters should be properly escaped

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

