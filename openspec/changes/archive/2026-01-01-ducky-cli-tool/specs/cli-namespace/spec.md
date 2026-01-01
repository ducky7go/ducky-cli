# Spec: CLI Namespace Structure

**Capability ID:** `cli-namespace`
**Change ID:** `ducky-cli-tool`
**Status:** Proposed

## ADDED Requirements

### Requirement: Organize commands by format namespace

The CLI MUST organize package format commands under format-specific namespaces (e.g., `nuget`, with future support for `zip`, `tar`).

#### Scenario: NuGet format namespace exists

**Given** the CLI is installed
**When** the user runs `ducky nuget --help`
**Then** the CLI should display available NuGet commands (pack, push, validate)

#### Scenario: Namespace structure in help

**Given** the CLI is installed
**When** the user runs `ducky --help`
**Then** the CLI should list available format namespaces (currently `nuget`)

---

### Requirement: Support extensible format registration

The CLI MUST support adding new package format namespaces through code registration without modifying existing commands.

#### Scenario: Future format can be registered

**Given** a developer wants to add ZIP format support
**When** they create `src/commands/zip/` and register in `src/cli.ts`
**Then** the new `ducky zip pack` command should be available

#### Scenario: Existing formats unaffected

**Given** multiple format namespaces are registered
**When** a new format is added
**Then** existing NuGet commands should continue to work unchanged

---

### Requirement: Consistent command structure across formats

The CLI MUST maintain a consistent command structure pattern: `ducky <format> <action>`.

#### Scenario: NuGet follows pattern

**Given** the NuGet format is implemented
**When** commands are invoked
**Then** they must follow the pattern: `ducky nuget pack`, `ducky nuget push`, `ducky nuget validate`

#### Scenario: Future formats follow pattern

**Given** a new format (e.g., ZIP) is added
**When** commands are defined
**Then** they must follow the pattern: `ducky zip pack`, `ducky zip push`, etc.

---

### Requirement: Format-specific command help

The CLI MUST provide help text specific to each format namespace and command.

#### Scenario: Format-level help

**Given** the user runs `ducky nuget --help`
**Then** the CLI should display help for NuGet-specific commands

#### Scenario: Command-level help

**Given** the user runs `ducky nuget pack --help`
**Then** the CLI should display help specific to the NuGet pack command

---

### Requirement: Support global commands

The CLI MUST support global commands that are not format-specific (e.g., `ducky info`, `ducky config`).

#### Scenario: Global command exists

**Given** the CLI is installed
**When** the user runs a global command like `ducky info ./package.nupkg`
**Then** the command should work without a format prefix

#### Scenario: Global command works alongside format commands

**Given** the CLI has both global commands and format namespaces
**When** the user runs `ducky --help`
**Then** both global commands and format namespaces should be listed

---

## Related Specifications

- `cli-nuget-pack`: NuGet pack command implementation
- `cli-nuget-push`: NuGet push command implementation
- `cli-nuget-validation`: NuGet validation command implementation
