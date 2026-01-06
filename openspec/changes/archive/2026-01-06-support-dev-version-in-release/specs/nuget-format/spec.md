## MODIFIED Requirements

### Requirement: SemVer 2.0 Version Parsing
The parser SHALL validate and preserve version strings following SemVer 2.0 format, including pre-release identifiers such as `-dev.x`, `-beta`, `-rc.1`, and build metadata.

#### Scenario: Valid dev version format
- **WHEN** a version string `0.1.2-dev.1` is provided in info.ini
- **THEN** the parser SHALL preserve the full version string including the `-dev.1` suffix
- **AND** the validator SHALL accept this as a valid SemVer 2.0 version

#### Scenario: Valid standard pre-release version
- **WHEN** a version string like `2.1.0-beta` or `3.0.0-rc.1` is provided
- **THEN** the parser SHALL preserve the full version string including pre-release identifiers
- **AND** the validator SHALL accept these as valid SemVer 2.0 versions

#### Scenario: Version with build metadata
- **WHEN** a version string like `1.0.0+build.123` is provided
- **THEN** the parser SHALL preserve the full version string including build metadata
- **AND** the validator SHALL accept this as a valid SemVer 2.0 version

#### Scenario: Invalid version format
- **WHEN** a version string does not match SemVer 2.0 format
- **THEN** the parser SHALL throw a ValidationError
- **AND** the error message SHALL include examples of valid formats including dev versions
