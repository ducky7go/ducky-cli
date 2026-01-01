import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { mkdir, rm, writeFile } from 'fs/promises';
import {
  DuckyError,
  ValidationError,
  ConfigError,
  NetworkError,
  FileSystemError,
  NuGetError,
} from '../../src/utils/errors.js';
import { resolveConfig, getApiKey, getServerUrl } from '../../src/utils/config.js';
import { validateMod } from '../../src/formats/nuget/validator.js';
import { collectFilesForPackage, formatFileSize } from '../../src/formats/nuget/collector.js';
import { parseInfoIniContent, loadDescription, loadReleaseNotes } from '../../src/formats/nuget/parser.js';
import type { ModMetadata } from '../../src/formats/nuget/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, '..', 'fixtures');

describe('Error Classes', () => {
  it('DuckyError should format with suggestions', () => {
    const error = new DuckyError('Test error', 'TEST_ERROR', [
      'Suggestion 1',
      'Suggestion 2',
    ]);
    expect(error.name).toBe('DuckyError');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.suggestions).toEqual(['Suggestion 1', 'Suggestion 2']);

    const formatted = error.format();
    expect(formatted).toContain('Test error');
    expect(formatted).toContain('Suggestions:');
    expect(formatted).toContain('Suggestion 1');
    expect(formatted).toContain('Suggestion 2');
  });

  it('DuckyError should format without suggestions', () => {
    const error = new DuckyError('Test error', 'TEST_ERROR');
    const formatted = error.format();
    expect(formatted).toContain('Test error');
    expect(formatted).not.toContain('Suggestions:');
  });

  it('ValidationError should have correct name and code', () => {
    const error = new ValidationError('Validation failed', ['Fix it']);
    expect(error.name).toBe('ValidationError');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Validation failed');
  });

  it('ConfigError should have correct name and code', () => {
    const error = new ConfigError('Config invalid', ['Check config']);
    expect(error.name).toBe('ConfigError');
    expect(error.code).toBe('CONFIG_ERROR');
  });

  it('NetworkError should have correct name and code', () => {
    const error = new NetworkError('Network failed');
    expect(error.name).toBe('NetworkError');
    expect(error.code).toBe('NETWORK_ERROR');
  });

  it('FileSystemError should have correct name and code', () => {
    const error = new FileSystemError('File not found');
    expect(error.name).toBe('FileSystemError');
    expect(error.code).toBe('FILESYSTEM_ERROR');
  });

  it('NuGetError should have correct name and code', () => {
    const error = new NuGetError('NuGet failed');
    expect(error.name).toBe('NuGetError');
    expect(error.code).toBe('NUGET_ERROR');
  });
});

describe('Config Utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear env vars before each test
    delete process.env.NUGET_API_KEY;
    delete process.env.NUGET_SERVER;
    delete process.env.NUGET_VERBOSE;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('resolveConfig should return default values', () => {
    const config = resolveConfig();
    expect(config.server).toBe('https://api.nuget.org/v3/index.json');
    expect(config.verbose).toBe(false);
    expect(config.apiKey).toBeUndefined();
  });

  it('resolveConfig should prioritize CLI flags', () => {
    process.env.NUGET_API_KEY = 'env-key';
    process.env.NUGET_SERVER = 'https://env.example.com';
    process.env.NUGET_VERBOSE = 'true';

    const config = resolveConfig({
      apiKey: 'cli-key',
      server: 'https://cli.example.com',
      verbose: false,
    });

    expect(config.apiKey).toBe('cli-key');
    expect(config.server).toBe('https://cli.example.com');
    expect(config.verbose).toBe(false);
  });

  it('resolveConfig should load from environment variables', () => {
    process.env.NUGET_API_KEY = 'env-api-key';
    process.env.NUGET_SERVER = 'https://env.server.com';
    process.env.NUGET_VERBOSE = 'true';

    const config = resolveConfig();

    expect(config.apiKey).toBe('env-api-key');
    expect(config.server).toBe('https://env.server.com');
    expect(config.verbose).toBe(true);
  });

  it('resolveConfig should parse verbose string correctly', () => {
    process.env.NUGET_VERBOSE = '1';
    expect(resolveConfig().verbose).toBe(true);

    process.env.NUGET_VERBOSE = '0';
    expect(resolveConfig().verbose).toBe(false);

    process.env.NUGET_VERBOSE = 'false';
    expect(resolveConfig().verbose).toBe(false);
  });

  it('resolveConfig should use custom env prefix', () => {
    process.env.CUSTOM_API_KEY = 'custom-key';
    const config = resolveConfig({}, 'CUSTOM');
    expect(config.apiKey).toBe('custom-key');
  });

  it('getApiKey should return API key when present', () => {
    const config = { apiKey: 'test-key', server: 'https://example.com' };
    expect(getApiKey(config)).toBe('test-key');
  });

  it('getApiKey should throw ConfigError when missing', () => {
    const config = { server: 'https://example.com' };
    expect(() => getApiKey(config)).toThrow(ConfigError);
    expect(() => getApiKey(config)).toThrow('NuGet API key is required');
  });

  it('getServerUrl should return server when present', () => {
    const config = { server: 'https://custom.server.com' };
    expect(getServerUrl(config)).toBe('https://custom.server.com');
  });

  it('getServerUrl should return default when server is empty', () => {
    const config = {};
    expect(getServerUrl(config)).toBe('https://api.nuget.org/v3/index.json');
  });

  it('getServerUrl should throw ConfigError for invalid URL', () => {
    const config = { server: 'not-a-valid-url' };
    expect(() => getServerUrl(config)).toThrow(ConfigError);
    expect(() => getServerUrl(config)).toThrow('Invalid server URL');
  });
});

describe('Validator', () => {
  it('should validate mod with matching DLL', async () => {
    const validModPath = join(fixturesDir, 'valid-mod');
    const metadata = {
      name: 'ExampleMod',
      version: '1.0.0',
      description: 'Test mod',
    };
    const result = await validateMod(validModPath, metadata);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail validation for non-matching DLL', async () => {
    const validModPath = join(fixturesDir, 'dll-mismatch');
    const metadata = {
      name: 'NotMatchingName',
      version: '1.0.0',
      description: 'Test',
    };
    const result = await validateMod(validModPath, metadata);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.message.includes('No DLL file matches mod name'))).toBe(
      true,
    );
  });

  it('should fail validation for invalid version format', async () => {
    const validModPath = join(fixturesDir, 'invalid-version');
    const metadata = {
      name: 'ExampleMod',
      version: '1.0',
    };
    const result = await validateMod(validModPath, metadata);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('version'))).toBe(true);
  });

  it('should fail validation for invalid name format', async () => {
    const validModPath = join(fixturesDir, 'invalid-name');
    const metadata = {
      name: '123Invalid',
      version: '1.0.0',
    };
    const result = await validateMod(validModPath, metadata);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Invalid NuGet ID format'))).toBe(
      true,
    );
  });

  it('should fail validation for missing required fields', async () => {
    const validModPath = join(fixturesDir, 'missing-field');
    const metadata = {
      name: '',
      version: '',
    };
    const result = await validateMod(validModPath, metadata);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should add warning for missing description', async () => {
    const validModPath = join(fixturesDir, 'valid-mod');
    const metadata = {
      name: 'ExampleMod',
      version: '1.0.0',
      description: undefined,
    };
    const result = await validateMod(validModPath, metadata);
    // Description is recommended but not required for validity
    expect(result.errors.some((e) => e.message.includes('description'))).toBe(true);
  });
});

describe('Collector', () => {
  it('should throw ValidationError for non-existent directory', async () => {
    await expect(
      collectFilesForPackage({
        modPath: '/non/existent/path',
        outputPath: '/tmp/output',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('should format file sizes correctly', () => {
    expect(formatFileSize(0)).toBe('0.0 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('should handle preview.png as icon.png', async () => {
    // Create a temporary mod with preview.png
    const tempMod = join(fixturesDir, 'temp-icon-test');
    await mkdir(tempMod, { recursive: true });
    await writeFile(join(tempMod, 'preview.png'), 'fake png content', 'utf-8');
    await writeFile(join(tempMod, 'info.ini'), 'name=TestMod\nversion=1.0.0', 'utf-8');

    const files = await collectFilesForPackage({
      modPath: tempMod,
      outputPath: '/tmp/output',
    });

    // Should have icon.png entry
    const iconFile = files.find((f) => f.target === 'icon.png');
    expect(iconFile).toBeDefined();
    expect(iconFile?.source).toContain('preview.png');

    // Cleanup
    await rm(tempMod, { recursive: true, force: true });
  });

  it('should exclude info.ini from collected files', async () => {
    const tempMod = join(fixturesDir, 'temp-exclude-test');
    await mkdir(tempMod, { recursive: true });
    await writeFile(join(tempMod, 'info.ini'), 'name=TestMod\nversion=1.0.0', 'utf-8');

    const files = await collectFilesForPackage({
      modPath: tempMod,
      outputPath: '/tmp/output',
    });

    // info.ini should not be in the files
    expect(files.some((f) => f.target === 'info.ini')).toBe(false);

    // Cleanup
    await rm(tempMod, { recursive: true, force: true });
  });
});

describe('Parser - loadDescription', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(fixturesDir, 'temp-test');
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should load description from readme file when specified', async () => {
    const readmePath = join(tempDir, 'README.md');
    await writeFile(readmePath, 'Test readme content', 'utf-8');

    const metadata: ModMetadata = {
      name: 'TestMod',
      version: '1.0.0',
      readme: 'README.md',
    };
    const description = await loadDescription(tempDir, metadata);
    expect(description).toBe('Test readme content');
  });

  it('should use readme content when file does not exist', async () => {
    const metadata: ModMetadata = {
      name: 'TestMod',
      version: '1.0.0',
      readme: 'Direct readme content',
    };
    const description = await loadDescription(tempDir, metadata);
    expect(description).toBe('Direct readme content');
  });

  it('should load from description/zh.md', async () => {
    const descDir = join(tempDir, 'description');
    await mkdir(descDir, { recursive: true });
    await writeFile(join(descDir, 'zh.md'), 'Chinese description', 'utf-8');

    const metadata: ModMetadata = { name: 'TestMod', version: '1.0.0' };
    const description = await loadDescription(tempDir, metadata);
    expect(description).toBe('Chinese description');
  });

  it('should load from description/en.md when zh.md does not exist', async () => {
    const descDir = join(tempDir, 'description');
    await mkdir(descDir, { recursive: true });
    await writeFile(join(descDir, 'en.md'), 'English description', 'utf-8');

    const metadata: ModMetadata = { name: 'TestMod', version: '1.0.0' };
    const description = await loadDescription(tempDir, metadata);
    expect(description).toBe('English description');
  });

  it('should fallback to description field', async () => {
    const metadata: ModMetadata = {
      name: 'TestMod',
      version: '1.0.0',
      description: 'Fallback description',
    };
    const description = await loadDescription(tempDir, metadata);
    expect(description).toBe('Fallback description');
  });

  it('should return empty string when no description found', async () => {
    const metadata: ModMetadata = { name: 'TestMod', version: '1.0.0' };
    const description = await loadDescription(tempDir, metadata);
    expect(description).toBe('');
  });

  it('should prioritize readme file over description files', async () => {
    const readmePath = join(tempDir, 'README.md');
    await writeFile(readmePath, 'Readme content', 'utf-8');

    const descDir = join(tempDir, 'description');
    await mkdir(descDir, { recursive: true });
    await writeFile(join(descDir, 'zh.md'), 'Chinese content', 'utf-8');

    const metadata: ModMetadata = {
      name: 'TestMod',
      version: '1.0.0',
      readme: 'README.md',
    };
    const description = await loadDescription(tempDir, metadata);
    expect(description).toBe('Readme content');
  });
});

describe('Parser - loadReleaseNotes', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(fixturesDir, 'temp-test-rn');
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should load release notes from file when specified', async () => {
    const rnPath = join(tempDir, 'releaseNotes.md');
    await writeFile(rnPath, '## v1.0.0\n- Initial release', 'utf-8');

    const metadata: ModMetadata = {
      name: 'TestMod',
      version: '1.0.0',
      releaseNotes: 'releaseNotes.md',
    };
    const releaseNotes = await loadReleaseNotes(tempDir, metadata);
    expect(releaseNotes).toContain('Initial release');
  });

  it('should use releaseNotes content when file does not exist', async () => {
    const metadata: ModMetadata = {
      name: 'TestMod',
      version: '1.0.0',
      releaseNotes: 'Fixed bug #123',
    };
    const releaseNotes = await loadReleaseNotes(tempDir, metadata);
    expect(releaseNotes).toBe('Fixed bug #123');
  });

  it('should load from releaseNotes.md in mod directory', async () => {
    const rnPath = join(tempDir, 'releaseNotes.md');
    await writeFile(rnPath, '## Changelog', 'utf-8');

    const metadata: ModMetadata = { name: 'TestMod', version: '1.0.0' };
    const releaseNotes = await loadReleaseNotes(tempDir, metadata);
    expect(releaseNotes).toBe('## Changelog');
  });

  it('should return empty string when no release notes found', async () => {
    const metadata: ModMetadata = { name: 'TestMod', version: '1.0.0' };
    const releaseNotes = await loadReleaseNotes(tempDir, metadata);
    expect(releaseNotes).toBe('');
  });

  it('should prioritize file over directory releaseNotes.md', async () => {
    const customRnPath = join(tempDir, 'custom.md');
    await writeFile(customRnPath, 'Custom release notes', 'utf-8');

    const defaultRnPath = join(tempDir, 'releaseNotes.md');
    await writeFile(defaultRnPath, 'Default release notes', 'utf-8');

    const metadata: ModMetadata = {
      name: 'TestMod',
      version: '1.0.0',
      releaseNotes: 'custom.md',
    };
    const releaseNotes = await loadReleaseNotes(tempDir, metadata);
    expect(releaseNotes).toBe('Custom release notes');
  });
});

describe('Parser - parseInfoIniContent', () => {
  it('should parse homepage as projectUrl', () => {
    const content = `
name=TestMod
version=1.0.0
homepage=https://example.com
`;
    const metadata = parseInfoIniContent(content);
    expect(metadata.projectUrl).toBe('https://example.com');
  });

  it('should parse all optional fields', () => {
    const content = `
name=TestMod
version=1.0.0
displayName=Test Mod Display
description=A test mod
author=Test Author
readme=README.md
releaseNotes=Fixed bugs
icon=icon.png
tags=game,mod
dependencies=OtherMod:1.0.0,AnotherMod
projectUrl=https://example.com
license=MIT
copyright=2024 Test
publishedFileId=12345
`;
    const metadata = parseInfoIniContent(content);
    expect(metadata.displayName).toBe('Test Mod Display');
    expect(metadata.description).toBe('A test mod');
    expect(metadata.author).toBe('Test Author');
    expect(metadata.readme).toBe('README.md');
    expect(metadata.releaseNotes).toBe('Fixed bugs');
    expect(metadata.icon).toBe('icon.png');
    expect(metadata.tags).toEqual(['game', 'mod']);
    expect(metadata.dependencies).toEqual(['OtherMod:1.0.0', 'AnotherMod']);
    expect(metadata.projectUrl).toBe('https://example.com');
    expect(metadata.license).toBe('MIT');
    expect(metadata.copyright).toBe('2024 Test');
    expect(metadata.publishedFileId).toBe('12345');
  });

  it('should handle comments in INI', () => {
    const content = `
# This is a comment
name=TestMod
version=1.0.0 # inline comment
`;
    const metadata = parseInfoIniContent(content);
    expect(metadata.name).toBe('TestMod');
    expect(metadata.version).toBe('1.0.0');
  });

  it('should handle empty values', () => {
    const content = `
name=TestMod
version=1.0.0
description=
tags=
`;
    const metadata = parseInfoIniContent(content);
    expect(metadata.name).toBe('TestMod');
    expect(metadata.description).toBe('');
    expect(metadata.tags).toBeUndefined();
  });
});
