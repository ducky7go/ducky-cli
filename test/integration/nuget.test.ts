import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { readTextFile, collectFiles, fileExists } from '../../src/utils/fs.js';
import { parseInfoIniContent, parseInfoIni } from '../../src/formats/nuget/parser.js';
import { generateNuspec } from '../../src/formats/nuget/nuspec.js';
import { collectFilesForPackage } from '../../src/formats/nuget/collector.js';
import { validateMod } from '../../src/formats/nuget/validator.js';
import { ValidationError } from '../../src/utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, '..', 'fixtures');

describe('NuGet Format Integration Tests', () => {
  describe('Parser', () => {
    it('should parse valid info.ini content', () => {
      const content = `
name=TestMod
version=1.0.0
description=A test mod
author=Test Author
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.name).toBe('TestMod');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.description).toBe('A test mod');
      expect(metadata.author).toBe('Test Author');
    });

    it('should parse info.ini with tags', () => {
      const content = `
name=TestMod
version=1.0.0
tags=game,mod,test
`;
      const metadata = parseInfoIniContent(content);
      expect(metadata.tags).toEqual(['game', 'mod', 'test']);
    });

    it('should throw error for missing required fields', () => {
      const content = `
name=TestMod
`;
      expect(() => parseInfoIniContent(content)).toThrow(ValidationError);
    });

    it('should throw error for invalid version format', () => {
      const content = `
name=TestMod
version=1.0
`;
      expect(() => parseInfoIniContent(content)).toThrow(ValidationError);
    });

    it('should throw error for invalid NuGet ID', () => {
      const content = `
name=123Invalid
version=1.0.0
`;
      expect(() => parseInfoIniContent(content)).toThrow(ValidationError);
    });

    it('should parse valid mod from fixture', async () => {
      const validModPath = join(fixturesDir, 'valid-mod');
      const metadata = await parseInfoIni(validModPath);
      expect(metadata.name).toBe('ExampleMod');
      expect(metadata.version).toBe('1.0.0');
    });
  });

  describe('.nuspec Generator', () => {
    it('should generate valid .nuspec XML', () => {
      const metadata = {
        name: 'TestMod',
        version: '1.0.0',
        description: 'A test mod',
        author: 'Test Author',
        tags: ['game', 'mod'],
      };
      const nuspec = generateNuspec(metadata);
      expect(nuspec).toContain('<?xml version="1.0" encoding="utf-8"?>');
      expect(nuspec).toContain('<id>TestMod</id>');
      expect(nuspec).toContain('<version>1.0.0</version>');
      expect(nuspec).toContain('<description>A test mod</description>');
      expect(nuspec).toContain('<authors>Test Author</authors>');
      expect(nuspec).toContain('<tags>game mod</tags>');
    });

    it('should escape XML special characters', () => {
      const metadata = {
        name: 'TestMod',
        version: '1.0.0',
        description: 'A & B < C > D "E" \'F\'',
      };
      const nuspec = generateNuspec(metadata);
      expect(nuspec).toContain('&amp;');
      expect(nuspec).toContain('&lt;');
      expect(nuspec).toContain('&gt;');
      expect(nuspec).toContain('&quot;');
      expect(nuspec).toContain('&apos;');
    });

    it('should format dependencies correctly', () => {
      const metadata = {
        name: 'TestMod',
        version: '1.0.0',
        dependencies: ['OtherMod:1.0.0', 'AnotherMod'],
      };
      const nuspec = generateNuspec(metadata);
      expect(nuspec).toContain('<dependency id="OtherMod" version="1.0.0" />');
      expect(nuspec).toContain('<dependency id="AnotherMod" />');
    });
  });

  describe('File Collector', () => {
    it('should collect files from valid mod', async () => {
      const validModPath = join(fixturesDir, 'valid-mod');
      const files = await collectFilesForPackage({
        modPath: validModPath,
        outputPath: '/tmp/output',
      });
      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.target.endsWith('ExampleMod.dll'))).toBe(true);
      expect(files.some((f) => f.target.endsWith('README.md'))).toBe(true);
    });
  });

  describe('Validator', () => {
    it('should validate a valid mod', async () => {
      const validModPath = join(fixturesDir, 'valid-mod');
      const metadata = await parseInfoIni(validModPath);
      const result = await validateMod(validModPath, metadata);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for missing DLL', async () => {
      // Create a test case for missing DLL
      const metadata = {
        name: 'NoDllMod',
        version: '1.0.0',
      };
      const result = await validateMod(fixturesDir, metadata);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Full Workflow', () => {
    it('should parse, validate, and generate .nuspec for valid mod', async () => {
      const validModPath = join(fixturesDir, 'valid-mod');

      // Parse
      const metadata = await parseInfoIni(validModPath);
      expect(metadata.name).toBe('ExampleMod');

      // Validate
      const validation = await validateMod(validModPath, metadata);
      expect(validation.valid).toBe(true);

      // Generate .nuspec
      const nuspec = generateNuspec(metadata);
      expect(nuspec).toContain('<id>ExampleMod</id>');

      // Collect files
      const files = await collectFilesForPackage({
        modPath: validModPath,
        outputPath: '/tmp/output',
      });
      expect(files.length).toBeGreaterThan(0);
    });
  });
});
