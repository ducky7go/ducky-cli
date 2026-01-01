# Steam Workshop Publishing Architecture Design

## Overview

This document describes the architectural design for adding Steam Workshop publishing support to Ducky CLI using steamworks.js, based on the existing C# reference implementation (`BmlSteamItemManager`).

## System Context

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Developer     │────▶│   Ducky CLI      │────▶│ Steam Workshop  │
│                 │     │  (steamworks.js) │     │   (UGC API)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  Local File      │
                       │  System          │
                       └──────────────────┘
```

## Architecture Diagram

```
src/
├── cli.ts                          # Entry point, registers commands
├── commands/
│   ├── nuget/                     # Existing NuGet commands
│   │   ├── index.ts
│   │   ├── validate.ts
│   │   ├── pack.ts
│   │   └── push.ts
│   └── steam/                     # NEW: Steam commands
│       ├── index.ts               # Registers steam commands
│       ├── validate.ts            # Steam validation command
│       └── push.ts                # Steam push command
├── formats/
│   ├── nuget/                     # Existing NuGet format handling
│   │   ├── client.ts
│   │   ├── validator.ts
│   │   └── ...
│   └── steam/                     # NEW: Steam format handling
│       ├── workshop.ts            # Steam Workshop UGC wrapper
│       ├── parser.ts              # Parse info.ini [steam] section
│       ├── metadata.ts            # Load multi-language descriptions
│       ├── validator.ts           # Workshop-specific validation
│       ├── progress.ts            # Upload progress tracking
│       └── config.ts              # Steam configuration
├── utils/
│   ├── config.ts                  # Extended for Steam config
│   ├── logger.ts                  # Existing logger
│   └── errors.ts                  # Existing errors, extended
```

## Component Design

### 1. Command Layer (`src/commands/steam/`)

#### `index.ts`
- Registers Steam namespace command
- Follows pattern from `commands/nuget/index.ts`
- Adds help text with examples

#### `validate.ts`
- Implements `ducky steam validate <path>` command
- Orchestrates validation checks from `formats/steam/validator.ts`
- Displays formatted validation results
- Uses existing `logger.ts` for output

#### `push.ts`
- Implements `ducky steam push <path>` command
- Handles `--update-description` flag for updating Workshop descriptions
- Handles `--changelog <note>` flag for update notes
- Loads metadata from steam.ini
- Loads multi-language descriptions from `description/*.md`
- Orchestrates upload via `formats/steam/workshop.ts`
- Displays upload progress via progress tracking system

### 2. Format Layer (`src/formats/steam/`)

#### `workshop.ts` - Steam Workshop UGC Wrapper
```typescript
class SteamWorkshopClient {
  // Initialize Steamworks client
  initialize(appId: number): Promise<void>

  // Check if Steam is available
  isAvailable(): boolean

  // Create new Workshop item
  createWorkshopItem(appId: number): Promise<number>

  // Start item update (returns update handle)
  startItemUpdate(publishedFileId: number): number

  // Set item content
  setItemContent(updateHandle: number, path: string): boolean

  // Set item preview (preview.png)
  setItemPreview(updateHandle: number, previewPath: string): boolean

  // Set item title
  setItemTitle(updateHandle: number, title: string): boolean

  // Set item description
  setItemDescription(updateHandle: number, description: string): boolean

  // Set update language
  setItemUpdateLanguage(updateHandle: number, language: string): boolean

  // Set item visibility
  setItemVisibility(updateHandle: number, visibility: number): boolean

  // Submit item update
  submitItemUpdate(updateHandle: number, changelog?: string): Promise<number>

  // Get upload progress
  getItemUpdateProgress(updateHandle: number): {
    bytesProcessed: number
    bytesTotal: number
  }

  // Clean shutdown
  shutdown(): void
}
```

**Design Decisions**:
- Wrapper abstraction over steamworks.js SteamUGC API
- Mirrors C# `BmlSteamItemManager` patterns
- Centralizes Steamworks initialization and lifecycle
- Simplifies testing (can mock this class)

#### `parser.ts` - Steam Configuration Handler
```typescript
// publishedFileId is already in ModMetadata interface
// from src/formats/nuget/parser.ts
interface ModMetadata {
  // ... existing fields ...
  publishedFileId?: string;  // Already exists as top-level property
}

// Steam configuration (not in info.ini, only environment/config)
interface SteamConfig {
  appId: number;  // Fixed at 3167020, overrideable via STEAM_APP_ID env var
}

// Function to save publishedFileId to info.ini
function savePublishedFileId(directory: string, publishedFileId: number): Promise<void>

// Function to get Steam App ID (from env or default)
function getSteamAppId(): number
```

**Design Decisions**:
- `publishedFileId` is already a top-level property in `ModMetadata` interface
- No need to create `[steam]` section in info.ini
- `appId` is fixed (3167020) and only configurable via environment variable
- Cannot add appId to info.ini - environment/config file only
- Saves `publishedFileId` to info.ini as top-level property after Workshop item creation

#### `metadata.ts` - Multi-Language Metadata Loader
```typescript
interface LocalizedDescription {
  language: string  // Steam language code (e.g., "schinese", "english")
  content: string   // Markdown content
}

interface LocalizedTitle {
  language: string  // Steam language code
  title: string     // Localized title
}

function loadDescriptions(directory: string): Promise<LocalizedDescription[]>
function loadTitles(directory: string, defaultTitle: string): Promise<LocalizedTitle[]>

// Language code mapping (mirrors C# MultiLanguageContentHelper)
function mapFilenameToLanguage(filename: string): string | null
// Common mappings:
//   zh.md → schinese
//   en.md → english
//   japanese.md → japanese
//   tchinese.md → tchinese
//   etc.
```

**Design Decisions**:
- Scans `description/*.md` directory for all language files
- Maps filenames to Steam language codes
- Separate loading for titles and descriptions
- Returns arrays of localized content for sequential update
- Handles missing directory gracefully (returns empty array)

#### `progress.ts` - Upload Progress Tracking
```typescript
enum WorkshopUploadStatus {
  Pending,
  Preparing,
  RequestingId,
  WritingIni,
  StartingSteamUpload,
  UploadingContent,
  UploadingTitles,
  UploadingTranslations,
  Completed,
  Failed
}

interface WorkshopUploadProgress {
  status: WorkshopUploadStatus
  bytesProcessed: number
  bytesTotal: number
  message: string
  exception?: Error
}

// Progress callback type
type ProgressCallback = (progress: WorkshopUploadProgress) => void

class ProgressTracker {
  // Report progress
  report(status: WorkshopUploadStatus, message: string, data?: Partial<WorkshopUploadProgress>): void

  // Get current progress
  getCurrentProgress(): WorkshopUploadProgress
}
```

**Design Decisions**:
- Mirrors C# `WorkshopUploadStatus` enum exactly
- Provides detailed progress reporting for all upload stages
- Supports callback pattern for progress updates
- Tracks bytes processed for content upload
- Tracks language update progress (1/5, 2/5, etc.)

#### `validator.ts` - Steam Workshop Validation
```typescript
class SteamValidator {
  // Validate App ID from environment or default
  validateAppId(appId: number): ValidationResult

  // Validate Steamworks SDK is available
  validateSteamworksAvailable(): ValidationResult

  // Validate mod build structure
  validateBuildStructure(directory: string): ValidationResult

  // Validate preview.png exists
  validatePreviewImage(directory: string): ValidationResult

  // Run all validations
  validate(directory: string): Promise<SteamValidationResult>
}
```

**Design Decisions**:
- Follows pattern from `formats/nuget/validator.ts`
- Returns consistent `ValidationResult` structure
- Each validation is independent for granular error reporting
- Workshop-specific: checks for preview.png
- App ID is validated from environment variable (default: 3167020)

---

### 3. Utils Extensions

#### `config.ts` Extension
- Add `getSteamConfig()` function
- Add `getSteamAppId()` function with default value 3167020
- Reuse existing config resolution pattern

#### `errors.ts` Extension
- Add `SteamError` base class
- Add specific errors: `SteamAuthError`, `SteamUploadError`, `SteamConfigError`

## Data Flow

### Validate Flow

```
┌─────────────────┐
│ User runs       │
│ validate command│
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ commands/steam/validate.ts              │
│ - Parse arguments                       │
│ - Load Steam config                     │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ formats/steam/validator.ts              │
│ - Validate App ID from environment      │
│   (default: 3167020)                     │
│ - Validate Steamworks SDK availability  │
│ - Validate build structure              │
│ - Check preview.png exists              │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Display results                         │
│ - Success message                       │
│ - List of errors with suggestions       │
└─────────────────────────────────────────┘
```

### Push Flow (Workshop Upload)

```
┌─────────────────┐
│ User runs       │
│ push command    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ commands/steam/push.ts                  │
│ - Parse arguments (--update-description, │
│               --changelog)             │
│ - Get Steam App ID (env or default)     │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ formats/steam/parser.ts                 │
│ - Parse info.ini for metadata           │
│ - Get App ID (default: 3167020)         │
│ - Check publishedFileId (top-level)     │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Progress: Preparing                     │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Check publishedFileId                    │
│ - If exists: UPDATE FLOW → use item     │
│ - If missing: FIRST-TIME FLOW           │
│   → Progress: RequestingId             │
│   → SteamUGC.CreateItem                 │
│   → Save new ID to info.ini             │
│   → Log: "Created new Workshop item    │
│           with ID: {publishedFileId}"   │
│   → Progress: WritingIni                │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ formats/steam/metadata.ts               │
│ - Load titles from description/*.md      │
│ - Load descriptions from description/*.md│
│ - Map filenames to Steam language codes │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ formats/steam/workshop.ts               │
│ - StartItemUpdate with publishedFileId  │
│ - SetItemContent (mod directory)         │
│ - SetItemPreview (preview.png)           │
│ - SetItemVisibility (Public)             │
│ - Check if first-time or update          │
│   and if --update-description flag       │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Description Update Logic:               │
│ - FIRST-TIME (no publishedFileId):      │
│   Always set primary language title     │
│   and description                       │
│ - UPDATE with --update-description:     │
│   Update ALL languages (incl primary)   │
│ - UPDATE without --update-description:  │
│   Skip ALL description updates          │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Progress: StartingSteamUpload           │
│ - SubmitItemUpdate with changelog        │
│ - Poll GetItemUpdateProgress            │
│ - Progress: UploadingContent            │
│ - Wait for submit result                 │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ If --update-description and more langs: │
│ For each additional language:            │
│   - StartItemUpdate                     │
│   - SetItemUpdateLanguage                │
│   - SetItemTitle (localized)             │
│   - SetItemDescription (localized)       │
│   - SubmitItemUpdate                     │
│   - Progress: UploadingTranslations n/m│
│   - Wait for result                      │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Display results                         │
│ - Progress: Completed                    │
│ - Success with publishedFileId          │
│ - Languages updated (if applicable)     │
│ - Error with recovery suggestions       │
└─────────────────────────────────────────┘
```

### First-Time Upload Flow (no publishedFileId)

```
┌─────────────────────────────────────────┐
│ Check publishedFileId                    │
│ Result: NOT FOUND                        │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Progress: RequestingId                  │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ SteamUGC.CreateItem(appId)             │
│ - Creates new Workshop item             │
│ - Returns new publishedFileId           │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Progress: WritingIni                    │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Save publishedFileId to info.ini        │
│ - Write as top-level property           │
│ - Format: "publishedFileId = 12345"     │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Log output                              │
│ "Created new Workshop item with ID:     │
│  12345"                                 │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Continue with main upload flow...       │
│ - Load titles and descriptions          │
│ - SetItemContent, SetItemPreview       │
│ - ALWAYS set primary language title     │
│   and description (required for new     │
│   Workshop items)                       │
│ - SubmitItemUpdate                     │
└─────────────────────────────────────────┘
```

### Update Flow (existing publishedFileId)

```
┌─────────────────────────────────────────┐
│ Check publishedFileId                    │
│ Result: FOUND (e.g., 12345)             │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Check --update-description flag         │
└────────┬────────────────────────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────────────────┐  ┌──────────────────────────────┐
│ FLAG PRESENT        │  │ FLAG NOT PRESENT            │
│ - Update ALL         │  │ - Skip ALL descriptions     │
│   languages         │  │ - Only upload content       │
│   (incl primary)    │  │   files (content, preview)  │
└─────────┬───────────┘  └─────────┬────────────────────┘
          │                       │
          └───────────┬───────────┘
                      ▼
┌─────────────────────────────────────────┐
│ Log output                              │
│ "Updating existing Workshop item:       │
│  12345"                                 │
│ "Description updates: enabled/disabled" │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Continue with main upload flow...       │
│ - Use existing publishedFileId          │
│ - No need to call CreateItem            │
└─────────────────────────────────────────┘
```

## Configuration Hierarchy

Steam App ID is resolved in this order (highest to lowest priority):

1. Environment variable `STEAM_APP_ID`
2. Project config file (`.ducky/steam.local.md`)
3. Default value: `3167020`

**Note**: App ID cannot be added to info.ini - it is fixed or environment-only.

The `publishedFileId` is a top-level property in info.ini (already in ModMetadata interface).

## Error Handling Strategy

### Error Categories

1. **Configuration Errors** (`SteamConfigError`)
   - Missing App ID
   - Invalid App ID format
   - Missing steam_appid.txt

2. **Authentication Errors** (`SteamAuthError`)
   - Invalid credentials
   - Steam not running
   - Account lacks permissions

3. **Upload Errors** (`SteamUploadError`)
   - Network failures
   - File not found
   - API rate limits
   - Depot not found

### Error Recovery

- **Retry**: Transient network errors (3 retries with exponential backoff)
- **Fail Fast**: Configuration errors (no point proceeding)
- **User Prompt**: Authentication failures (suggest re-auth)
- **Partial Success**: Upload failures (report what succeeded)

## Security Considerations

1. **Credentials**: Never log Steam credentials or tokens
2. **App ID**: App ID is not sensitive, but should be validated
3. **Local Files**: Steam session data stored in `.ducky/` directory
4. **Permissions**: Check account has upload permissions before starting upload

## Testing Strategy

### Unit Tests
- Mock `SteamClient` class
- Test validation logic independently
- Test error handling paths
- Test config resolution

### Integration Tests
- Use test Steam App ID (if available)
- Test against Steamworks SDK with dry-run mode
- Test error scenarios with mocked failures

### Manual Testing
- Test with real Steam App (developer's test app)
- Test on different platforms (Windows, macOS, Linux)
- Test large file uploads

## Performance Considerations

1. **Large Uploads**: Use chunked upload, show progress
2. **File Scanning**: Cache file list during validation
3. **Steamworks Init**: Initialize once per CLI invocation
4. **Progress Updates**: Throttle progress updates to avoid spam

## Migration Path

This is a new feature, so no migration is needed. However:

1. Existing `ducky nuget` commands are unchanged
2. Steam commands are additive only
3. No breaking changes to existing functionality
4. Can be released as minor version bump

## Future Enhancements

Out of scope for this proposal but worth noting:

1. **Workshop Tags**: Enhanced tag support (currently basic)
2. **Workshop Subscription Management**: Download and manage subscribed items
3. **Workshop Dependencies**: Handle mod dependencies
4. **Automated Builds**: Integration with build systems
5. **DLC Management**: Support for DLC Workshop items
