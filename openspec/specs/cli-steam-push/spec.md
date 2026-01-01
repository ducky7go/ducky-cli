# cli-steam-push Specification

## Purpose
TBD - created by archiving change steam-publishing-via-steamworks-js. Update Purpose after archive.
## Requirements
### Requirement: Steam Push Command

The system SHALL provide a `ducky steam push` command that publishes game mods to Steam Workshop.

#### Scenario: First-time upload creates new Workshop item
- **GIVEN** a valid mod directory at `./mods/MyMod` containing:
  - `info.ini` with required fields but NO `publishedFileId`
  - `preview.png` for Workshop preview
  - Mod content files
- **WHEN** the user runs `ducky steam push ./mods/MyMod`
- **THEN** the command should:
  - Display header "Steam Workshop Publish"
  - Display "Using Steam App ID: 3167020"
  - Display "Creating new Workshop item..."
  - Display "✔ Created new Workshop item with ID: 12345"
  - Display "Saved publishedFileId 12345 to info.ini"
  - Initialize Steamworks and upload content to Steam
  - Display progress for content upload
  - Display "✔ Published Workshop item: 12345"
  - The `info.ini` file should now contain `publishedFileId = 12345`
  - Exit with code 0

#### Scenario: Update existing Workshop item without description update
- **GIVEN** a valid mod directory at `./mods/MyMod` containing:
  - `info.ini` with `publishedFileId = 12345`
  - `preview.png` for Workshop preview
- **WHEN** the user runs `ducky steam push ./mods/MyMod`
- **THEN** the command should:
  - Display header "Steam Workshop Publish"
  - Display "Using Steam App ID: 3167020"
  - Display "Updating existing Workshop item: 12345"
  - Display "Description updates: disabled (use --update-description to enable)"
  - Upload content to Steam and display progress
  - Display "✔ Published Workshop item: 12345"
  - Exit with code 0

#### Scenario: Update existing Workshop item with description update
- **GIVEN** a valid mod directory at `./mods/MyMod` containing:
  - `info.ini` with `publishedFileId = 12345`
  - `preview.png` for Workshop preview
  - `description/en.md` with English description
  - `description/zh.md` with Chinese description
- **WHEN** the user runs `ducky steam push ./mods/MyMod --update-description`
- **THEN** the command should:
  - Display header "Steam Workshop Publish"
  - Display "Using Steam App ID: 3167020"
  - Display "Updating existing Workshop item: 12345"
  - Display "Updating all language descriptions..."
  - Display "Updating 2 additional language(s)..."
  - Display "Uploading translations 1/2..." and "2/2..."
  - Upload content and display progress
  - Display "✔ Updated Workshop item: 12345 (2 language(s) updated)"
  - Exit with code 0

#### Scenario: Update with changelog
- **GIVEN** a valid mod directory with existing `publishedFileId`
- **WHEN** the user runs `ducky steam push ./mods/MyMod --changelog "Fixed critical bugs"`
- **THEN** the command should:
  - Display header "Steam Workshop Publish"
  - Upload content to Steam with changelog "Fixed critical bugs"
  - The changelog should appear in Steam Workshop update notes
  - Display success message and exit with code 0

#### Scenario: Update with both changelog and description update
- **GIVEN** a valid mod directory with existing `publishedFileId`
- **WHEN** the user runs `ducky steam push ./mods/MyMod --update-description --changelog "Added new features"`
- **THEN** the command should:
  - Display header "Steam Workshop Publish"
  - Update all language descriptions
  - Upload content with changelog
  - Display success message with language count
  - Exit with code 0

#### Scenario: Verbose output
- **GIVEN** a valid mod directory
- **WHEN** the user runs `ducky steam push ./mods/MyMod --verbose`
- **THEN** the command should:
  - Display all upload progress stages with debug info
  - Display detailed progress for each operation
  - Display success message and exit with code 0

### Requirement: Steam App ID Configuration

The system SHALL support configuring the Steam App ID via the `STEAM_APP_ID` environment variable, with a default value of `3167020`.

#### Scenario: Default App ID is used when not specified
- **GIVEN** a valid mod directory
- **WHEN** the user runs `ducky steam push ./mods/MyMod` without setting `STEAM_APP_ID`
- **THEN** the command should display "Using Steam App ID: 3167020"

#### Scenario: Custom App ID from environment variable
- **GIVEN** a valid mod directory
- **AND** the environment variable `STEAM_APP_ID=123456` is set
- **WHEN** the user runs `ducky steam push ./mods/MyMod`
- **THEN** the command should display "Using Steam App ID: 123456"

### Requirement: Command Options

The system SHALL support the following options for the `ducky steam push` command:

- `--update-description` (boolean, default: false): Update Workshop descriptions from description/*.md files
- `--changelog` (string): Update changelog notes for this update
- `--verbose`, `-v` (boolean, default: false): Enable verbose output

#### Scenario: All options are recognized
- **GIVEN** the help system
- **WHEN** the user runs `ducky steam push --help`
- **THEN** all options should be documented with their types and defaults

