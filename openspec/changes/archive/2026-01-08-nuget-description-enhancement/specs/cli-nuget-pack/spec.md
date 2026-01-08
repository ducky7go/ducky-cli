## MODIFIED Requirements

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

## ADDED Requirements

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
