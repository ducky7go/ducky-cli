# Spec: CLI NuGet Push Command

**Capability ID:** `cli-nuget-push`
**Change ID:** `ducky-cli-tool`
**Status:** Proposed

## ADDED Requirements

### Requirement: Publish .nupkg to NuGet server

The CLI MUST publish a `.nupkg` file to a specified NuGet server using the NuGet CLI.

#### Scenario: Publish to nuget.org

**Given** a valid `.nupkg` file and valid API key
**When** the user runs `ducky nuget push ./mods/MyMod.nupkg`
**Then** the package should be published to nuget.org

#### Scenario: Publish to custom server

**Given** a valid `.nupkg` file and custom server URL
**When** the user runs `ducky nuget push ./mods/MyMod.nupkg --server https://my-nuget-server.com/v3/index.json`
**Then** the package should be published to the specified server

#### Scenario: Specify API key via flag

**Given** a valid `.nupkg` file
**When** the user runs `ducky nuget push ./mods/MyMod.nupkg --api-key $NUGET_API_KEY`
**Then** the CLI should use the provided API key for authentication

---

### Requirement: Load API key from environment variable

The CLI MUST read the `NUGET_API_KEY` environment variable when no API key is explicitly provided.

#### Scenario: API key from environment

**Given** the `NUGET_API_KEY` environment variable is set
**When** the user runs `ducky nuget push ./mods/MyMod.nupkg` without `--api-key`
**Then** the CLI should use the value from `NUGET_API_KEY`

#### Scenario: No API key available

**Given** no `NUGET_API_KEY` environment variable and no `--api-key` flag
**When** the user runs `ducky nuget push ./mods/MyMod.nupkg`
**Then** the CLI should exit with an error indicating the missing API key

---

### Requirement: Support --pack flag for combined workflow

The CLI MUST support packaging and publishing in a single command when the `--pack` flag is provided with a directory path.

#### Scenario: Pack and publish in one step

**Given** a valid mod directory
**When** the user runs `ducky nuget push ./mods/MyMod --pack`
**Then** the CLI should first package the mod, then publish the resulting `.nupkg` file

#### Scenario: Pack and publish with custom output

**Given** a valid mod directory
**When** the user runs `ducky nuget push ./mods/MyMod --pack --output ./build`
**Then** the CLI should package to `./build` and then publish the package

---

### Requirement: Validate .nupkg before publishing

The CLI MUST verify that the specified `.nupkg` file exists and is valid before attempting to publish.

#### Scenario: Valid .nupkg file

**Given** an existing `.nupkg` file
**When** the user runs `ducky nuget push ./mods/MyMod.nupkg`
**Then** publishing should proceed

#### Scenario: Missing .nupkg file

**Given** a non-existent `.nupkg` file path
**When** the user runs `ducky nuget push ./mods/MyMod.nupkg`
**Then** the CLI should exit with an error indicating the file was not found

#### Scenario: Invalid .nupkg file

**Given** a file with `.nupkg` extension that is not a valid NuGet package
**When** the user runs `ducky nuget push ./mods/MyMod.nupkg`
**Then** the CLI should exit with an error indicating the file is invalid

---

### Requirement: Handle publish responses

The CLI MUST handle responses from the NuGet server and provide appropriate feedback to the user.

#### Scenario: Successful publish

**Given** a valid `.nupkg` file and credentials
**When** publishing succeeds
**Then** the CLI should display a success message with the package URL

#### Scenario: Authentication failure

**Given** a valid `.nupkg` file with invalid API key
**When** the user attempts to publish
**Then** the CLI should exit with an error indicating authentication failed

#### Scenario: Package already exists

**Given** a `.nupkg` file with a version already published
**When** the user attempts to publish
**Then** the CLI should exit with an error indicating the package version already exists

#### Scenario: Server unavailable

**Given** a valid `.nupkg` file
**When** the NuGet server is unreachable
**Then** the CLI should exit with an error indicating the server connection failed

---

### Requirement: Support --dry-run flag

The CLI MUST support a `--dry-run` flag to validate the package and credentials without actually publishing.

#### Scenario: Dry run with valid setup

**Given** a valid `.nupkg` file and credentials
**When** the user runs `ducky nuget push ./mods/MyMod.nupkg --dry-run`
**Then** the CLI should validate the setup and display "Would publish to [server]" without actually publishing

#### Scenario: Dry run with invalid setup

**Given** a `.nupkg` file with invalid credentials
**When** the user runs `ducky nuget push ./mods/MyMod.nupkg --dry-run`
**Then** the CLI should exit with the appropriate error message

---

### Requirement: Display publish progress

The CLI MUST display progress information during the publish process.

#### Scenario: Show upload progress

**Given** a valid `.nupkg` file being published
**When** the upload is in progress
**Then** the CLI should display an upload progress indicator

#### Scenario: Show server response

**Given** a publish operation
**When** the server responds
**Then** the CLI should display the relevant response information (success or error details)

---

### Requirement: Confirm before publishing

The CLI MUST require user confirmation before publishing, unless a `--yes` flag is provided.

#### Scenario: Confirm by default

**Given** a valid `.nupkg` file
**When** the user runs `ducky nuget push ./mods/MyMod.nupkg` without `--yes`
**Then** the CLI should display what will be published and prompt for confirmation

#### Scenario: Skip confirmation with flag

**Given** a valid `.nupkg` file
**When** the user runs `ducky nuget push ./mods/MyMod.nupkg --yes`
**Then** the CLI should publish immediately without prompting

---

### Requirement: Support server configuration from environment

The CLI MUST read the `NUGET_SERVER` environment variable to determine the default NuGet server URL.

#### Scenario: Default server from environment

**Given** the `NUGET_SERVER` environment variable is set
**When** the user runs `ducky nuget push ./mods/MyMod.nupkg` without `--server`
**Then** the CLI should use the server URL from `NUGET_SERVER`

#### Scenario: Default to nuget.org

**Given** no `NUGET_SERVER` environment variable and no `--server` flag
**When** the user runs `ducky nuget push ./mods/MyMod.nupkg`
**Then** the CLI should default to `https://api.nuget.org/v3/index.json`

---

## Related Specifications

- `cli-nuget-pack`: Creating the .nupkg file to be published
- `cli-nuget-validation`: Pre-publish validation of the package
