# cli-steam-validate Spec Delta

## Purpose

Add DLL name validation to Steam Workshop validation, matching the behavior of NuGet validation.

## ADDED Requirements

### Requirement: Validate DLL name matches info.ini name field

The CLI MUST verify that at least one `.dll` file in the mod directory has a base name matching the `name` field in `info.ini`. A mod package may contain multiple DLL files; only one needs to match the package name.

#### Scenario: Matching DLL name

**Given** an `info.ini` with `name=MyMod` and a file `MyMod.dll`
**When** the CLI runs `ducky steam validate ./mods/MyMod`
**Then** validation should pass for the DLL name check

#### Scenario: Multiple DLLs with one matching

**Given** an `info.ini` with `name=MyMod` and files `MyMod.dll`, `Dependency.dll` exist
**When** the CLI runs `ducky steam validate ./mods/MyMod`
**Then** validation should pass (at least one DLL matches)

#### Scenario: Non-matching DLL name

**Given** an `info.ini** with `name=MyMod` but only `OtherMod.dll` exists
**When** the CLI runs `ducky steam validate ./mods/MyMod`
**Then** validation should fail with an error indicating the DLL name mismatch

#### Scenario: No DLL files present

**Given** a mod directory with no `.dll` files
**When** the CLI runs `ducky steam validate ./mods/MyMod`
**Then** validation should fail with an error indicating no DLL was found

#### Scenario: Case-insensitive matching

**Given** an `info.ini** with `name=mymod` and a file `MyMod.dll`
**When** the CLI runs `ducky steam validate ./mods/MyMod`
**Then** validation should pass (case-insensitive comparison)

---

### Requirement: Provide helpful error message listing all DLLs

When DLL name validation fails for Steam Workshop, the CLI MUST list all DLL files found in the error message to help users identify which files are present.

#### Scenario: Error lists all DLL names

**Given** an `info.ini** with `name=MyMod` but only `OtherMod.dll` and `Helper.dll` exist
**When** the CLI runs `ducky steam validate ./mods/MyMod`
**Then** the error message should list "OtherMod.dll, Helper.dll" and suggest renaming one to match the package name

---
