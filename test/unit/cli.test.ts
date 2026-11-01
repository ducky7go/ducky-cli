import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, '..', 'fixtures');

describe('CLI and Client - Basic Coverage', () => {
  beforeEach(() => {
    // Mock console methods to avoid output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Mock process.exit to avoid exiting
    vi.stubGlobal('process', { ...process, exit: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Command modules', () => {
    it('should import pack command module', async () => {
      const module = await import('../../src/commands/nuget/pack.js');
      expect(module).toBeDefined();
      expect(module.nugetPackCommand).toBeDefined();
    });

    it('should import push command module', async () => {
      const module = await import('../../src/commands/nuget/push.js');
      expect(module).toBeDefined();
      expect(module.nugetPushCommand).toBeDefined();
    });

    it('should import validate command module', async () => {
      const module = await import('../../src/commands/nuget/validate.js');
      expect(module).toBeDefined();
      expect(module.nugetValidateCommand).toBeDefined();
    });

    it('should import nuget command index', async () => {
      const module = await import('../../src/commands/nuget/index.js');
      expect(module).toBeDefined();
      // The index exports a setup function or registers commands
      expect(Object.keys(module).length).toBeGreaterThan(0);
    });
  });

  describe('Logger', () => {
    it('should import and create logger', async () => {
      const { createLogger } = await import('../../src/utils/logger.js');
      const logger = createLogger();
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.success).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should have LogLevel enum', async () => {
      const { LogLevel } = await import('../../src/utils/logger.js');
      expect(LogLevel).toBeDefined();
      expect(typeof LogLevel.DEBUG).toBe('number');
      expect(typeof LogLevel.INFO).toBe('number');
      expect(typeof LogLevel.ERROR).toBe('number');
    });

    it('should have all log levels', async () => {
      const { LogLevel } = await import('../../src/utils/logger.js');
      expect(LogLevel.DEBUG).toBe(0);
      expect(LogLevel.INFO).toBe(1);
      expect(LogLevel.SUCCESS).toBe(2);
      expect(LogLevel.WARNING).toBe(3);
      expect(LogLevel.ERROR).toBe(4);
    });

    it('should support quiet mode', async () => {
      const { Logger, LogLevel } = await import('../../src/utils/logger.js');
      const logger = new Logger({ quiet: true });
      expect(logger).toBeDefined();
      logger.setLevel(LogLevel.DEBUG);
      // Should not throw in quiet mode
      logger.info('test');
      logger.success('test');
    });

    it('should support verbose mode', async () => {
      const { Logger } = await import('../../src/utils/logger.js');
      const logger = new Logger({ verbose: true });
      expect(logger).toBeDefined();
      logger.debug('test');
    });

    it('should log errors with DuckyError', async () => {
      const { createLogger } = await import('../../src/utils/logger.js');
      const { DuckyError } = await import('../../src/utils/errors.js');
      const logger = createLogger();
      const error = new DuckyError('Test error', 'TEST_CODE', ['Suggestion']);
      logger.error(error);
      // Should not throw
    });

    it('should log header messages', async () => {
      const { createLogger } = await import('../../src/utils/logger.js');
      const logger = createLogger();
      logger.header('Test Header');
      // Should not throw
    });

    it('should log blank lines', async () => {
      const { createLogger } = await import('../../src/utils/logger.js');
      const logger = createLogger();
      logger.blank();
      // Should not throw
    });

    it('should log warning messages', async () => {
      const { createLogger } = await import('../../src/utils/logger.js');
      const logger = createLogger();
      logger.warn('Warning message');
      // Should not throw
    });

    it('should log all message types', async () => {
      const { Logger, LogLevel } = await import('../../src/utils/logger.js');
      const logger = new Logger({ verbose: true });
      logger.debug('debug');
      logger.info('info');
      logger.success('success');
      logger.warn('warning');
      logger.error('error');
      logger.header('header');
      logger.blank();
      // Should not throw
    });

    it('should log Error instance (line 85)', async () => {
      const { createLogger } = await import('../../src/utils/logger.js');
      const logger = createLogger();
      const error = new Error('Test error message');
      logger.error(error);
      // Should not throw
    });

    it('should log string error messages', async () => {
      const { createLogger } = await import('../../src/utils/logger.js');
      const logger = createLogger();
      logger.error('String error message');
      // Should not throw
    });

    it('should create spinner with start/stop (lines 116-128)', async () => {
      const { createLogger } = await import('../../src/utils/logger.js');
      const logger = createLogger();
      const spinner = logger.spinner('Loading...');
      expect(spinner).toBeDefined();
      expect(typeof spinner.start).toBe('function');
      expect(typeof spinner.stop).toBe('function');
      spinner.start();
      spinner.stop();
      // Should not throw
    });

    it('should create spinner in quiet mode', async () => {
      const { Logger } = await import('../../src/utils/logger.js');
      const logger = new Logger({ quiet: true });
      const spinner = logger.spinner('Quiet spinner');
      spinner.start();
      spinner.stop();
      // Should not throw
    });

    it('should handle multiple spinner start/stop calls', async () => {
      const { createLogger } = await import('../../src/utils/logger.js');
      const logger = createLogger();
      const spinner = logger.spinner('Test');
      spinner.start();
      spinner.start(); // Should not start again
      spinner.stop();
      spinner.stop(); // Should handle multiple stops
      // Should not throw
    });
  });

  describe('Client', () => {
    it('should import NuGetCliManager class', async () => {
      const { NuGetCliManager } = await import('../../src/formats/nuget/client.js');
      expect(NuGetCliManager).toBeDefined();
      expect(typeof NuGetCliManager).toBe('function');
    });

    it('should create NuGetCliManager instance', async () => {
      const { NuGetCliManager } = await import('../../src/formats/nuget/client.js');
      const client = new NuGetCliManager();
      expect(client).toBeDefined();
      expect(typeof client.pack).toBe('function');
      expect(typeof client.push).toBe('function');
    });
  });

  describe('Index exports', () => {
    it('utils/index should export functions', async () => {
      const utilsIndex = await import('../../src/utils/index.js');
      expect(utilsIndex.createLogger).toBeDefined();
      expect(utilsIndex.resolveConfig).toBeDefined();
      expect(utilsIndex.getApiKey).toBeDefined();
      expect(utilsIndex.getServerUrl).toBeDefined();
    });

    it('formats/index should export functions', async () => {
      const formatsIndex = await import('../../src/formats/index.js');
      expect(formatsIndex.parseInfoIni).toBeDefined();
      expect(formatsIndex.generateNuspec).toBeDefined();
      expect(formatsIndex.collectFilesForPackage).toBeDefined();
      expect(formatsIndex.validateMod).toBeDefined();
      expect(formatsIndex.NuGetCliManager).toBeDefined();
    });

    it('formats/nuget/index should export functions', async () => {
      const nugetIndex = await import('../../src/formats/nuget/index.js');
      expect(nugetIndex.parseInfoIni).toBeDefined();
      expect(nugetIndex.generateNuspec).toBeDefined();
      expect(nugetIndex.collectFilesForPackage).toBeDefined();
      expect(nugetIndex.validateMod).toBeDefined();
      expect(nugetIndex.NuGetCliManager).toBeDefined();
    });
  });
});

describe('Steam push documented command lines', () => {
  it('lists the new push options and accepts every documented push command line', async () => {
    const { steamPushCommand } = await import('../../src/commands/steam/push.js');
    const longFlags = steamPushCommand.options.map((o) => o.long);
    for (const flag of ['--visibility', '--tags', '--dry-run', '--app-id', '--verbose', '--changelog', '--update-description', '--skip-tail']) {
      expect(longFlags).toContain(flag);
    }

    const documented = [
      ['./mods/MyMod'],
      ['./mods/MyMod', '--update-description', '--changelog', 'fix'],
      ['./mods/MyMod', '--visibility', 'friends', '--tags', 'Weapons,Balance'],
      ['./mods/MyMod', '--dry-run', '--visibility', 'friends', '--tags', 'a,b', '--changelog', 'Fix'],
      ['./mods/MyMod', '--app-id', '3167020', '-v'],
    ];
    for (const argv of documented) {
      const { unknown } = steamPushCommand.parseOptions(argv);
      expect(unknown, `unknown options for ${argv.join(' ')}`).toEqual([]);
    }
  });

  it('push help text documents --visibility, --tags, --dry-run and --app-id', async () => {
    const { steamPushCommand } = await import('../../src/commands/steam/push.js');
    const help = steamPushCommand.helpInformation();
    expect(help).toContain('--visibility <name>');
    expect(help).toContain('--tags <list>');
    expect(help).toContain('--dry-run');
    expect(help).toContain('--app-id <id>');
  });
});

describe('Steam subcommand help lists shared options', () => {
  it('every steam subcommand documents --app-id and -v, --verbose', async () => {
    const { Command } = await import('commander');
    const { registerSteamCommands } = await import('../../src/commands/steam/index.js');
    const program = new Command();
    registerSteamCommands(program);
    const steam = program.commands.find((c) => c.name() === 'steam');
    expect(steam).toBeDefined();
    const names = ['validate', 'push', 'list', 'info', 'subscribed', 'link', 'pull'];
    for (const name of names) {
      const sub = steam!.commands.find((c) => c.name() === name);
      expect(sub, `subcommand ${name}`).toBeDefined();
      const help = sub!.helpInformation();
      expect(help, `${name} --app-id`).toContain('--app-id <id>');
      expect(help, `${name} -v`).toContain('-v, --verbose');
    }
  });

  it('link and pull document their own options', async () => {
    const { Command } = await import('commander');
    const { registerSteamCommands } = await import('../../src/commands/steam/index.js');
    const program = new Command();
    registerSteamCommands(program);
    const steam = program.commands.find((c) => c.name() === 'steam')!;
    const link = steam.commands.find((c) => c.name() === 'link')!.helpInformation();
    expect(link).toContain('--force');
    const pull = steam.commands.find((c) => c.name() === 'pull')!.helpInformation();
    expect(pull).toContain('--language <code>');
    expect(pull).toContain('--force');
  });
});
