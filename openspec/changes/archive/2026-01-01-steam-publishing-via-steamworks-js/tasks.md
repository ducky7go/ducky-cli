# Implementation Tasks

## Overview

This document outlines the implementation tasks for adding Steam Workshop publishing support to Ducky CLI via steamworks.js, based on the existing C# reference implementation.

## Task Sequence

### Phase 1: Foundation Setup

#### Task 1.1: Create Steam command structure
- [x] Create `src/commands/steam/` directory
- [x] Create `src/commands/steam/index.ts` with `registerSteamCommands()` function
- [x] Register steam commands in `src/cli.ts`
- [x] Create basic command skeleton with placeholder descriptions

**Validation**: Running `ducky steam --help` displays the Steam namespace help

---

#### Task 1.2: Add @ducky7go/steamworks.js dependency
- [x] Add `@ducky7go/steamworks.js` to `package.json` dependencies
- [x] Verify installation works across platforms
- [x] Add any required build scripts or configuration

**Validation**: `npm install` completes successfully, basic import works

---

#### Task 1.3: Extend configuration system for Steam
- [x] Add Steam-specific config loading to `src/formats/steam/config.ts`
- [x] Support `STEAM_APP_ID` environment variable (default: 3167020)
- [x] Note: appId cannot be added by user in info.ini, only via environment variable

**Validation**: Config loads from environment correctly, defaults to 3167020

---

#### Task 1.4: Extend info.ini handling for publishedFileId
- [x] Create `src/formats/steam/parser.ts`
- [x] Note: `publishedFileId` is already a top-level property in `ModMetadata` interface
- [x] Implement `savePublishedFileId()` to write/update `publishedFileId` in info.ini
- [x] No need to add appId to info.ini - it's fixed or environment-only

**Validation**: Can update publishedFileId in info.ini

---

#### Task 1.5: Implement multi-language description loading
- [x] Create `src/formats/steam/metadata.ts`
- [x] Implement `loadDescriptions()` that scans `description/*.md` directory
- [x] Map filename to Steam language code (e.g., `zh.md` → `schinese`, `en.md` → `english`, `japanese.md` → `japanese`)
- [x] Read Markdown content from each file
- [x] Implement `loadTitles()` for multi-language title support
- [x] Convert Markdown to Steam-supported format (HTML)

**Validation**: Loads all description files and maps to correct Steam languages

---

#### Task 1.6: Implement progress tracking
- [x] Create `src/formats/steam/progress.ts`
- [x] Define `WorkshopUploadStatus` enum (mirroring C# implementation)
- [x] Define `WorkshopUploadProgress` interface
- [x] Implement progress event/callback system

**Validation**: Progress tracking system works for all upload stages

---

### Phase 2: Validation Command

#### Task 2.1: Implement steam validate command
- [x] Create `src/commands/steam/validate.ts`
- [x] Implement argument parsing (path to mod directory)
- [x] Add `--verbose` flag support
- [x] Display validation results in consistent format

**Validation**: `ducky steam validate <path>` runs without crashing

---

#### Task 2.2: Implement Steam App ID validation
- [x] Validate App ID from environment variable `STEAM_APP_ID`
- [x] Use default value 3167020 when not specified
- [x] Validate App ID format (numeric)
- [x] Provide clear error messages for invalid App ID

**Validation**: Validates App ID from environment, uses default 3167020 when not specified

---

#### Task 2.3: Validate Steamworks SDK availability
- [x] Check if steamworks.js can initialize
- [x] Verify Steam client is running
- [x] Check for valid Steam credentials
- [x] Provide helpful error messages for setup issues

**Validation**: Correctly identifies when Steamworks SDK is unavailable

---

#### Task 2.4: Validate mod build artifacts
- [x] Check for required mod files
- [x] Validate `preview.png` exists for Workshop preview
- [x] Check file sizes and directory structure
- [x] Warn about common issues (missing executables, etc.)

**Validation**: Identifies missing or incorrectly structured mod builds

---

### Phase 3: Push Command (Workshop Upload)

#### Task 3.1: Implement steam push command structure
- [x] Create `src/commands/steam/push.ts`
- [x] Implement argument parsing (path to mod directory)
- [x] Add `--update-description` flag for updating Workshop descriptions
- [x] Add `--changelog <note>` flag for update notes
- [x] Add `--verbose` flag support

**Validation**: Command accepts all options and displays help correctly

---

#### Task 3.2: Implement Steam authentication
- [x] Integrate steamworks.js authentication flow
- [x] Handle Steam login/token refresh
- [x] Store credentials securely for session
- [x] Provide clear prompts for authentication

**Validation**: Can authenticate with Steam successfully

---

#### Task 3.3: Implement Workshop item creation (first-time upload)
- [x] Check if `publishedFileId` exists in info.ini (top-level property)
- [x] If no `publishedFileId`, call SteamUGC.CreateItem to request new Workshop ID
- [x] Save new `publishedFileId` to info.ini as top-level property
- [x] Output log showing new `publishedFileId` (e.g., "Created new Workshop item with ID: 12345")
- [x] Handle creation failures gracefully

**Validation**: Can create new Workshop items, save ID to info.ini, and log the new ID

---

#### Task 3.4: Implement Workshop file upload
- [x] Create `src/formats/steam/workshop.ts` with Workshop upload logic
- [x] Use SteamUGC.StartItemUpdate to create update handle
- [x] Set item content path with SteamUGC.SetItemContent
- [x] Set preview image (preview.png) with SteamUGC.SetItemPreview
- [x] Set visibility to Public
- [x] Implement progress indication for large uploads
- [x] Handle network errors and retry logic
- [x] Submit update with SteamUGC.SubmitItemUpdate

**Validation**: Can upload a small test mod to Steam Workshop

---

#### Task 3.5: Implement multi-language title and description update
- [x] **First-time upload (no publishedFileId)**:
  - Always set primary language title and description (English or first available)
  - Call SteamUGC.StartItemUpdate with new publishedFileId
  - SetItemTitle and SetItemDescription for primary language
  - Submit update
- [x] **Update with --update-description flag**:
  - For ALL languages (including primary):
    - Call SteamUGC.StartItemUpdate
    - Set language with SteamUGC.SetItemUpdateLanguage
    - Set title with SteamUGC.SetItemTitle
    - Set description with SteamUGC.SetItemDescription
    - Submit update
  - Display progress for each language (e.g., "Uploading translations 1/5")
  - Handle individual language update failures
- [x] **Update without --update-description flag**:
  - Skip ALL title and description updates (including primary)
  - Only upload content files (SetItemContent, SetItemPreview)

**Validation**: First upload always has descriptions, --update-description updates all, no flag skips all

---

#### Task 3.6: Implement --update-description workflow
- [x] Call `loadDescriptions()` to get all language descriptions
- [x] Call `loadTitles()` to get all language titles
- [x] Integrate with upload workflow:
  - **First-time upload**: Always set primary language description
  - **With --update-description**: Update all languages
  - **Without --update-description**: Skip all description updates
- [x] Append changelog to description if provided (only when updating descriptions)
- [x] Display which languages were updated (or "No description updates" if flag not set)

**Validation**: Properly handles first-time, with-flag, and without-flag scenarios

---

#### Task 3.7: Integrate metadata upload with push
- [x] Parse info.ini to load mod metadata (including existing publishedFileId)
- [x] Determine if this is first-time upload (no publishedFileId) or update (has publishedFileId)
- [x] If `--update-description` flag is set, update descriptions
- [x] If `--changelog` is provided, include in update
- [x] Display loaded metadata info during push
- [x] Handle metadata update failures gracefully

**Validation**: Push workflow handles both first-time and update scenarios

---

### Phase 4: Testing & Documentation

#### Task 4.1: Add unit tests for validation logic
- [ ] Test App ID validation
- [ ] Test file structure validation
- [ ] Test Steamworks SDK availability checks
- [ ] Mock steamworks.js for tests

**Validation**: All tests pass, coverage > 80%

---

#### Task 4.2: Add integration tests
- [ ] Test end-to-end validate workflow
- [ ] Test push with test Steam App ID if available
- [ ] Test error handling paths
- [ ] Test progress reporting
- [ ] Test info.ini update when creating new Workshop items (first-time upload)
- [ ] Test update to existing Workshop items
- [ ] Test default App ID (3167020) behavior

**Validation**: Integration tests pass

---

#### Task 4.3: Create spec deltas
- [x] Create `openspec/changes/steam-publishing-via-steamworks-js/specs/cli-steam-validate/spec.md`
- [x] Create `openspec/changes/steam-publishing-via-steamworks-js/specs/cli-steam-push/spec.md`
- [x] Follow existing spec format from NuGet specs
- [x] Include scenarios for all requirements

**Validation**: Specs pass `openspec validate --strict`

---

#### Task 4.4: Update documentation
- [x] Add Steam section to README.md
- [x] Document required setup (Steamworks SDK, fixed App ID 3167020, environment variable override)
- [x] Add usage examples for both commands
- [x] Document info.ini publishedFileId configuration (top-level property)
- [x] Document multi-language description setup
- [x] Document troubleshooting common issues
- [x] Document publishedFileId logging behavior
- [x] Add flow diagrams for first-time upload vs update scenarios

**Validation**: Documentation is clear and complete

---

#### Task 4.5: Add error handling improvements
- [x] Ensure all errors have clear messages
- [x] Add suggestions for fixing common errors
- [x] Handle Steam API rate limits gracefully
- [x] Add retry logic for transient failures

**Validation**: Error messages are helpful and actionable

---

## Summary

**Completed**: 1.1-1.6, 2.1-2.4, 3.1-3.7, 4.3-4.5

**Pending**: 4.1, 4.2 (testing tasks)

The MVP (Minimum Viable Product) is complete with all core functionality implemented. The remaining tasks are test coverage which can be added incrementally.
