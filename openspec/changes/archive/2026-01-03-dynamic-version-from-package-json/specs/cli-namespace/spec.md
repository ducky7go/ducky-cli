# cli-namespace Specification Delta

## ADDED Requirements

### Requirement: Dynamic version from package.json

The CLI MUST read its version from the `version` field in `package.json` at runtime, rather than using a hardcoded version string.

#### Scenario: Version displays correct value from package.json

**Given** the `package.json` contains version `"0.0.1"`
**When** the user runs `ducky --version`
**Then** the CLI should display `0.0.1`

#### Scenario: Version updates when package.json changes

**Given** the `package.json` version is updated to `"1.0.0"`
**When** the CLI is rebuilt and the user runs `ducky --version`
**Then** the CLI should display `1.0.0`

#### Scenario: CLI initialization reads package.json at runtime

**Given** the CLI is being initialized
**When** the program starts
**Then** the version MUST be read dynamically from `package.json` located relative to the module
