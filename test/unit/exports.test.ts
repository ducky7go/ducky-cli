import { describe, it, expect } from 'vitest';

describe('Module Exports', () => {
  describe('NuGet format exports', () => {
    it('should export all parser functions', async () => {
      const parser = await import('../../src/formats/nuget/parser.js');
      expect(typeof parser.parseInfoIni).toBe('function');
      expect(typeof parser.parseInfoIniContent).toBe('function');
      expect(typeof parser.loadDescription).toBe('function');
      expect(typeof parser.loadReleaseNotes).toBe('function');
    });

    it('should export all nuspec functions', async () => {
      const nuspec = await import('../../src/formats/nuget/nuspec.js');
      expect(typeof nuspec.generateNuspec).toBe('function');
    });

    it('should export all collector functions', async () => {
      const collector = await import('../../src/formats/nuget/collector.js');
      expect(typeof collector.collectFilesForPackage).toBe('function');
      expect(typeof collector.formatFileSize).toBe('function');
    });

    it('should export all validator functions', async () => {
      const validator = await import('../../src/formats/nuget/validator.js');
      expect(typeof validator.validateMod).toBe('function');
    });
  });

  describe('Utils exports', () => {
    it('should export config functions', async () => {
      const config = await import('../../src/utils/config.js');
      expect(typeof config.resolveConfig).toBe('function');
      expect(typeof config.getApiKey).toBe('function');
      expect(typeof config.getServerUrl).toBe('function');
    });

    it('should export error classes', async () => {
      const errors = await import('../../src/utils/errors.js');
      expect(typeof errors.DuckyError).toBe('function');
      expect(typeof errors.ValidationError).toBe('function');
      expect(typeof errors.ConfigError).toBe('function');
      expect(typeof errors.NetworkError).toBe('function');
      expect(typeof errors.FileSystemError).toBe('function');
      expect(typeof errors.NuGetError).toBe('function');
    });

    it('should export fs functions', async () => {
      const fs = await import('../../src/utils/fs.js');
      expect(typeof fs.fileExists).toBe('function');
      expect(typeof fs.directoryExists).toBe('function');
      expect(typeof fs.collectFiles).toBe('function');
      expect(typeof fs.readTextFile).toBe('function');
      expect(typeof fs.validatePath).toBe('function');
    });

    it('should export logger functions', async () => {
      const logger = await import('../../src/utils/logger.js');
      expect(typeof logger.Logger).toBe('function');
      expect(typeof logger.createLogger).toBe('function');
      expect(typeof logger.LogLevel).toBe('object');
    });
  });

  describe('Format index exports', () => {
    it('formats/index should export all functions', async () => {
      const formatsIndex = await import('../../src/formats/index.js');
      expect(formatsIndex.parseInfoIni).toBeDefined();
      expect(formatsIndex.generateNuspec).toBeDefined();
      expect(formatsIndex.collectFilesForPackage).toBeDefined();
      expect(formatsIndex.validateMod).toBeDefined();
      expect(formatsIndex.NuGetCliManager).toBeDefined();
    });

    it('formats/nuget/index should export all functions', async () => {
      const nugetIndex = await import('../../src/formats/nuget/index.js');
      expect(nugetIndex.parseInfoIni).toBeDefined();
      expect(nugetIndex.generateNuspec).toBeDefined();
      expect(nugetIndex.collectFilesForPackage).toBeDefined();
      expect(nugetIndex.validateMod).toBeDefined();
      expect(nugetIndex.NuGetCliManager).toBeDefined();
    });
  });

  describe('Utils index exports', () => {
    it('utils/index should export all functions', async () => {
      const utilsIndex = await import('../../src/utils/index.js');
      expect(utilsIndex.createLogger).toBeDefined();
      expect(utilsIndex.resolveConfig).toBeDefined();
      expect(utilsIndex.getApiKey).toBeDefined();
      expect(utilsIndex.getServerUrl).toBeDefined();
      expect(utilsIndex.DuckyError).toBeDefined();
      expect(utilsIndex.ValidationError).toBeDefined();
      expect(utilsIndex.ConfigError).toBeDefined();
      expect(utilsIndex.NetworkError).toBeDefined();
      expect(utilsIndex.FileSystemError).toBeDefined();
      expect(utilsIndex.NuGetError).toBeDefined();
    });
  });
});
