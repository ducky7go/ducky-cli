# cli-nuget-validation Spec Delta

## Purpose

Clarify that the DLL name validation supports packages containing multiple DLL files.

## ADDED Requirements

### Requirement: Validate at least one DLL matches package name

The CLI MUST verify that at least one `.dll` file in the mod directory has a base name matching the `name` field in `info.ini`. A mod package may contain multiple DLL files; only one needs to match the package name.

#### Scenario: Single matching DLL

**Given** an `info.ini` with `name=MyMod` and only `MyMod.dll` exists
**When** the CLI runs validation
**Then** validation should pass for the DLL name check

#### Scenario: Multiple DLLs with one matching

**Given** an `info.ini` with `name=MyMod` and files `MyMod.dll`, `Dependency.dll`, `Helper.dll` exist
**When** the CLI runs validation
**Then** validation should pass (at least one DLL matches)

#### Scenario: Multiple DLLs with none matching

**Given** an `info.ini** with `name=MyMod` but only `OtherMod.dll` and `Helper.dll` exist
**When** the CLI runs validation
**Then** validation should fail with an error indicating no matching DLL was found

#### Scenario: Case-insensitive matching with multiple DLLs

**Given** an `info.ini` with `name=mymod` and files `MyMod.dll`, `dependency.dll` exist
**When** the CLI runs validation
**Then** validation should pass (case-insensitive comparison, at least one match)

---

### Requirement: Provide helpful error message listing all DLLs

When DLL name validation fails, the CLI MUST list all DLL files found in the error message to help users identify which files are present.

#### Scenario: Error lists all DLL names

**Given** an `info.ini` with `name=MyMod` but only `OtherMod.dll` and `Helper.dll` exist
**When** the CLI runs validation
**Then** the error message should list "OtherMod.dll, Helper.dll" and suggest renaming one to match the package name

---

## MODIFIED Requirements

### Requirement: Validate DLL name matches info.ini name field

The CLI MUST verify that at least one `.dll` file in the mod directory has a base name matching the `name` field in `info.ini`. **Modified**: Packages may contain multiple DLL files; validation requires only that at least one DLL matches the package name, not all DLLs.

#### Scenario: Multiple DLLs with matching name present (NEW)

**Given** an `info.ini` with `name=MyMod` and files `MyMod.dll`, `Dependency.dll`
**When** the CLI runs validation
**Then** validation should pass
**And** no warning should be issued for additional non-matching DLLs

#### Scenario: Matching DLL name (EXISTING)

**Given** an `info.ini` with `name=MyMod` and a file `MyMod.dll`
**When** the CLI runs validation
**Then** validation should pass for the DLL name check

#### Scenario: Non-matching DLL name (EXISTING)

**Given** an `info.ini** with `name=MyMod` but only `OtherMod.dll` exists
**When** the CLI runs validation
**Then** validation should fail with an error indicating the DLL name mismatch

#### Scenario: No DLL files present (EXISTING)

**Given** a mod directory with no `.dll` files
**When** the CLI runs validation
**Then** validation should fail with an error indicating no DLL was found

#### Scenario: Case-insensitive matching (EXISTING)

**Given** an `info.ini` with `name=mymod` and a file `MyMod.dll`
**When** the CLI runs validation
**Then** validation should pass (case-insensitive comparison)

---
