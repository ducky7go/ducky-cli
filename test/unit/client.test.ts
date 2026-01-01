import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { mkdir, rm, writeFile } from 'fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, '..', 'fixtures');

describe('Client Coverage', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ducky-client-'));
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('NuGetCliManager - Method Coverage', () => {
    it('should have pack method', async () => {
      const { NuGetCliManager } = await import('../../src/formats/nuget/client.js');
      const client = new NuGetCliManager();
      expect(typeof client.pack).toBe('function');
    });

    it('should have push method', async () => {
      const { NuGetCliManager } = await import('../../src/formats/nuget/client.js');
      const client = new NuGetCliManager();
      expect(typeof client.push).toBe('function');
    });
  });
});
