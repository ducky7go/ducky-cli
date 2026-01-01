# cli-nuget-validation Specification

## Purpose
TBD - created by archiving change ducky-cli-tool. Update Purpose after archive.
## Requirements
### Requirement: Validate DLL name matches info.ini name field

The CLI MUST verify that at least one `.dll` file in the mod directory has a base name matching the `name` field in `info.ini`.

#### Scenario: Matching DLL name

**Given** an `info.ini` with `name=MyMod` and a file `MyMod.dll`
**When** the CLI runs validation
**Then** validation should pass for the DLL name check

#### Scenario: Non-matching DLL name

**Given** an `info.ini` with `name=MyMod` but only `OtherMod.dll` exists
**When** the CLI runs validation
**Then** validation should fail with an error indicating the DLL name mismatch

#### Scenario: No DLL files present

**Given** a mod directory with no `.dll` files
**When** the CLI runs validation
**Then** validation should fail with an error indicating no DLL was found

#### Scenario: Case-insensitive matching

**Given** an `info.ini` with `name=mymod` and a file `MyMod.dll`
**When** the CLI runs validation
**Then** validation should pass (case-insensitive comparison)

---

### Requirement: Validate SemVer 2.0 version format

The CLI MUST verify that the `version` field in `info.ini` conforms to SemVer 2.0 format (major.minor.patch[-prerelease][+build]).

#### Scenario: Valid SemVer 2.0 version

**Given** an `info.ini` with `version=1.2.3`
**When** the CLI runs validation
**Then** validation should pass for the version format

#### Scenario: Valid version with prerelease

**Given** an `info.ini` with `version=1.2.3-alpha.1`
**When** the CLI runs validation
**Then** validation should pass for the version format

#### Scenario: Valid version with build metadata

**Given** an `info.ini` with `version=1.2.3+build.123`
**When** the CLI runs validation
**Then** validation should pass for the version format

#### Scenario: Invalid version format

**Given** an `info.ini` with `version=1.2` (missing patch)
**When** the CLI runs validation
**Then** validation should fail with an error indicating invalid SemVer 2.0 format

#### Scenario: Missing version field

**Given** an `info.ini` without a `version` field
**When** the CLI runs validation
**Then** validation should fail with an error indicating the missing field

---

### Requirement: Validate NuGet ID validity

The CLI MUST verify that the NuGet ID derived from the `name` field is valid according to NuGet ID rules.

#### Scenario: Valid NuGet ID

**Given** an `info.ini` with `name=MyMod`
**When** the CLI runs validation
**Then** validation should pass for the NuGet ID

#### Scenario: Invalid NuGet ID with spaces

**Given** an `info.ini` with `name=My Mod` (contains space)
**When** the CLI runs validation
**Then** validation should fail with an error indicating invalid NuGet ID

#### Scenario: Invalid NuGet ID with special characters

**Given** an `info.ini** with `name=My$Mod` (contains invalid character)
**When** the CLI runs validation
**Then** validation should fail with an error indicating invalid NuGet ID

#### Scenario: NuGet ID starts with number

**Given** an `info.ini` with `name=123Mod` (starts with number)
**When** the CLI runs validation
**Then** validation should fail with an error indicating NuGet ID cannot start with a number

---

### Requirement: Validate required fields in info.ini

The CLI MUST verify that all required fields are present in `info.ini` according to the NuGet Mod Packaging Specification.

#### Scenario: All required fields present

**Given** an `info.ini` with all required fields (name, version, description, author)
**When** the CLI runs validation
**Then** validation should pass for required fields

#### Scenario: Missing required field

**Given** an `info.ini` missing the `author` field
**When** the CLI runs validation
**Then** validation should fail with an error indicating the missing field

#### Scenario: Empty field value

**Given** an `info.ini` with `name=` (empty value)
**When** the CLI runs validation
**Then** validation should fail with an error indicating the field is empty

---

### Requirement: Validate icon file exists if specified

The CLI MUST verify that if an icon file is referenced in `info.ini`, the file exists in the mod directory.

#### Scenario: Icon file exists

**Given** an `info.ini` with `icon=preview.png` and the file exists
**When** the CLI runs validation
**Then** validation should pass for the icon

#### Scenario: Icon file missing

**Given** an `info.ini` with `icon=preview.png` but the file does not exist
**When** the CLI runs validation
**Then** validation should fail with an error indicating the missing icon file

#### Scenario: No icon specified

**Given** an `info.ini` without an `icon` field
**When** the CLI runs validation
**Then** validation should pass (icon is optional)

---

### Requirement: Provide clear error messages

The CLI MUST provide clear, actionable error messages for each validation failure.

#### Scenario: Specific error for each failure

**Given** multiple validation failures
**When** the CLI runs validation
**Then** each failure should be listed with a specific error message and suggested fix

#### Scenario: Error with location information

**Given** a validation failure related to a specific field
**When** the CLI runs validation
**Then** the error message should indicate which field and line number caused the failure

---

### Requirement: Support standalone validate command

The CLI MUST provide a `ducky nuget validate` command that runs validation without packaging or publishing.

#### Scenario: Validate existing mod directory

**Given** a mod directory with `info.ini`
**When** the user runs `ducky nuget validate ./mods/MyMod`
**Then** the CLI should run all validation rules and display results

#### Scenario: Validate shows all errors

**Given** a mod directory with multiple validation errors
**When** the user runs `ducky nuget validate ./mods/MyMod`
**Then** the CLI should display all validation errors and exit with non-zero status

#### Scenario: Validate passes successfully

**Given** a mod directory with no validation errors
**When** the user runs `ducky nuget validate ./mods/MyMod`
**Then** the CLI should display a success message and exit with zero status

---

### Requirement: Support --verbose flag for detailed output

The CLI MUST provide a `--verbose` flag that displays detailed validation information.

#### Scenario: Verbose validation output

**Given** a mod directory being validated
**When** the user runs `ducky nuget validate ./mods/MyMod --verbose`
**Then** the CLI should display detailed information about each validation check

---

### Requirement: Support validation rules configuration

The CLI MUST allow users to enable/disable specific validation rules via configuration.

#### Scenario: Disable specific rule

**Given** a configuration file with a disabled validation rule
**When** the user runs `ducky nuget validate ./mods/MyMod`
**Then** the CLI should skip the disabled rule

---

