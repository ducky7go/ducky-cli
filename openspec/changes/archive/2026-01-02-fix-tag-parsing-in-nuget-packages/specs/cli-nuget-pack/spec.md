# cli-nuget-pack Specification

## MODIFIED Requirements

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
