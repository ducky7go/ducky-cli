# cli-steam-validate Specification

## Purpose
TBD - created by archiving change steam-publishing-via-steamworks-js. Update Purpose after archive.
## Requirements
### Requirement: Steam Validate Command

The system SHALL provide a `ducky steam validate` command that validates Steam Workshop publishing configuration for game mods.

#### Scenario: Validate a valid mod directory
- **GIVEN** a valid mod directory at `./mods/MyMod` containing:
  - `info.ini` with required fields (name, version)
  - `preview.png` for Workshop preview
  - Steam App ID is set (default: 3167020)
- **WHEN** the user runs `ducky steam validate ./mods/MyMod`
- **THEN** the command should:
  - Display header "Steam Workshop Validation"
  - Display "Using Steam App ID: 3167020"
  - Display "✔ All validations passed!"
  - Display "ℹ Your mod is ready to publish to Steam Workshop."
  - Exit with code 0

#### Scenario: Validate with verbose output
- **GIVEN** a valid mod directory at `./mods/MyMod`
- **WHEN** the user runs `ducky steam validate ./mods/MyMod --verbose`
- **THEN** the command should:
  - Display all validation steps with debug information
  - Display success message
  - Exit with code 0

#### Scenario: Validate directory that doesn't exist
- **GIVEN** a non-existent directory path
- **WHEN** the user runs `ducky steam validate ./mods/NonExistent`
- **THEN** the command should:
  - Display "✖ Directory does not exist: ./mods/NonExistent"
  - Display suggestions:
    - "Ensure the mod directory path is correct"
    - "Create the directory if it does not exist"
  - Exit with code 1

#### Scenario: Validate directory without info.ini
- **GIVEN** a directory that exists but lacks `info.ini`
- **WHEN** the user runs `ducky steam validate ./mods/NoInfo`
- **THEN** the command should:
  - Display "✖ info.ini not found in mod directory"
  - Display suggestions:
    - "Create an info.ini file in the mod directory"
    - "Include required fields: name, version"
  - Exit with code 1

#### Scenario: Validate directory without preview.png
- **GIVEN** a directory with `info.ini` but no `preview.png`
- **WHEN** the user runs `ducky steam validate ./mods/NoPreview`
- **THEN** the command should:
  - Display "✖ preview.png not found in mod directory"
  - Display suggestions:
    - "Add a preview.png image to the mod directory"
    - "Recommended size: 512x512 pixels or larger"
    - "Supported formats: PNG, JPG"
  - Exit with code 1

#### Scenario: Validate with custom Steam App ID
- **GIVEN** a valid mod directory
- **AND** environment variable `STEAM_APP_ID=123456`
- **WHEN** the user runs `ducky steam validate ./mods/MyMod`
- **THEN** the command should:
  - Display "Using Steam App ID: 123456"
  - Display success message
  - Exit with code 0

### Requirement: Steam App ID Configuration

The system SHALL support configuring the Steam App ID via the `STEAM_APP_ID` environment variable, with a default value of `3167020`.

#### Scenario: Default App ID is used when not specified
- **GIVEN** a valid mod directory
- **WHEN** the user runs `ducky steam validate ./mods/MyMod` without setting `STEAM_APP_ID`
- **THEN** the command should display "Using Steam App ID: 3167020"

#### Scenario: Custom App ID from environment variable
- **GIVEN** a valid mod directory
- **AND** the environment variable `STEAM_APP_ID=123456` is set
- **WHEN** the user runs `ducky steam validate ./mods/MyMod`
- **THEN** the command should display "Using Steam App ID: 123456"

### Requirement: Command Options

The system SHALL support the following options for the `ducky steam validate` command:

- `--verbose`, `-v` (boolean, default: false): Enable verbose output

#### Scenario: All options are recognized
- **GIVEN** the help system
- **WHEN** the user runs `ducky steam validate --help`
- **THEN** all options should be documented with their types and defaults

