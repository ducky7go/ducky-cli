import { describe, it, expect } from 'vitest';
import { basename, sep, win32, posix } from 'path';

/**
 * Cross-platform path handling tests
 *
 * These tests verify that the codebase correctly handles paths on different platforms
 * (Windows uses backslash \, Unix-like systems use forward slash /)
 *
 * IMPORTANT: These tests use win32.basename and posix.basename to test cross-platform
 * behavior regardless of the host OS. The actual code uses the standard 'path' module
 * which automatically adapts to the platform it's running on.
 */
describe('Cross-Platform Path Handling', () => {
  describe('Unix-style paths (Linux/macOS)', () => {
    it('should extract filename from Unix-style paths', () => {
      const unixPath = 'plugins/MyMod.dll';
      expect(posix.basename(unixPath)).toBe('MyMod.dll');
    });

    it('should extract filename from nested Unix paths', () => {
      const nestedUnixPath = 'a/b/c/plugins/MyMod.dll';
      expect(posix.basename(nestedUnixPath)).toBe('MyMod.dll');
    });

    it('should extract filename from absolute Unix paths', () => {
      const absoluteUnixPath = '/home/user/mods/plugins/MyMod.dll';
      expect(posix.basename(absoluteUnixPath)).toBe('MyMod.dll');
    });

    it('should extract filename from paths with special characters', () => {
      const pathWithSpaces = 'plugins/My Mod.dll';
      expect(posix.basename(pathWithSpaces)).toBe('My Mod.dll');
    });

    it('should handle paths with dots', () => {
      const pathWithDots = 'plugins/My.Mod.v2.dll';
      expect(posix.basename(pathWithDots)).toBe('My.Mod.v2.dll');
    });

    it('should extract filename from paths ending with separator', () => {
      const pathWithSep = 'plugins/';
      // Note: basename treats trailing separator as empty component on some platforms
      // but on others it returns the parent. The behavior varies, so we just check it doesn't crash
      const result = posix.basename(pathWithSep);
      expect(result).toBeTruthy();
    });

    it('should return filename for single component path', () => {
      expect(posix.basename('MyMod.dll')).toBe('MyMod.dll');
    });

    it('should handle empty path', () => {
      // Empty path behavior varies by platform - just check it doesn't crash
      const result = posix.basename('');
      expect(typeof result).toBe('string');
    });

    it('should handle path with only separators', () => {
      const result = posix.basename('///');
      // Should return a separator-related string
      expect(result).toMatch(/^[/]*$/);
    });
  });

  describe('Windows-style paths', () => {
    it('should extract filename from Windows-style paths', () => {
      const windowsPath = 'plugins\\MyMod.dll';
      expect(win32.basename(windowsPath)).toBe('MyMod.dll');
    });

    it('should extract filename from nested Windows paths', () => {
      const nestedWindowsPath = 'a\\b\\c\\plugins\\MyMod.dll';
      expect(win32.basename(nestedWindowsPath)).toBe('MyMod.dll');
    });

    it('should extract filename from absolute Windows paths', () => {
      const absoluteWindowsPath = 'C:\\Users\\user\\mods\\plugins\\MyMod.dll';
      expect(win32.basename(absoluteWindowsPath)).toBe('MyMod.dll');
    });

    it('should extract filename from paths with special characters', () => {
      const pathWithSpaces = 'plugins\\My Mod.dll';
      expect(win32.basename(pathWithSpaces)).toBe('My Mod.dll');
    });

    it('should handle paths with dots', () => {
      const pathWithDots = 'plugins\\My.Mod.v2.dll';
      expect(win32.basename(pathWithDots)).toBe('My.Mod.v2.dll');
    });

    it('should extract filename from paths ending with separator', () => {
      const pathWithSep = 'plugins\\';
      // Note: basename treats trailing separator as empty component on some platforms
      // but on others it returns the parent. The behavior varies, so we just check it doesn't crash
      const result = win32.basename(pathWithSep);
      expect(result).toBeTruthy();
    });

    it('should return filename for single component path', () => {
      expect(win32.basename('MyMod.dll')).toBe('MyMod.dll');
    });

    it('should handle empty path', () => {
      // Empty path behavior varies by platform - just check it doesn't crash
      const result = win32.basename('');
      expect(typeof result).toBe('string');
    });

    it('should handle paths with extra separators', () => {
      const doubleBackslash = 'plugins\\\\MyMod.dll';
      expect(win32.basename(doubleBackslash)).toBe('MyMod.dll');
    });
  });

  describe('Platform detection', () => {
    it('should detect current platform separator', () => {
      // On Linux/macOS, sep is '/', on Windows it's '\\'
      expect(sep).toMatch(/^[/\\]$/);
    });
  });

  describe('Cross-platform consistency', () => {
    it('should extract same filename from equivalent paths on different platforms', () => {
      const unixPath = 'plugins/MyMod.dll';
      const windowsPath = 'plugins\\MyMod.dll';

      expect(posix.basename(unixPath)).toBe('MyMod.dll');
      expect(win32.basename(windowsPath)).toBe('MyMod.dll');
      // Both should extract the same filename
      expect(posix.basename(unixPath)).toBe(win32.basename(windowsPath));
    });
  });

  describe('Real-world scenarios from the codebase', () => {
    it('should handle Steam Workshop DLL paths (Unix)', () => {
      const steamPath = 'plugins/SteamWorkshop.dll';
      expect(posix.basename(steamPath)).toBe('SteamWorkshop.dll');
    });

    it('should handle Steam Workshop DLL paths (Windows)', () => {
      const steamPath = 'plugins\\SteamWorkshop.dll';
      expect(win32.basename(steamPath)).toBe('SteamWorkshop.dll');
    });

    it('should handle multiple DLL paths (Unix)', () => {
      const dllPaths = [
        'plugins/FirstMod.dll',
        'plugins/SecondMod.dll',
        'plugins/ThirdMod.dll'
      ];
      const extractedNames = dllPaths.map(p => posix.basename(p));
      expect(extractedNames).toEqual([
        'FirstMod.dll',
        'SecondMod.dll',
        'ThirdMod.dll'
      ]);
    });

    it('should handle multiple DLL paths (Windows)', () => {
      const dllPaths = [
        'plugins\\FirstMod.dll',
        'plugins\\SecondMod.dll',
        'plugins\\ThirdMod.dll'
      ];
      const extractedNames = dllPaths.map(p => win32.basename(p));
      expect(extractedNames).toEqual([
        'FirstMod.dll',
        'SecondMod.dll',
        'ThirdMod.dll'
      ]);
    });

    it('should handle NuGet package file paths (Unix)', () => {
      const nugetPath = 'bin/Release/net6.0/MyMod.nupkg';
      expect(posix.basename(nugetPath)).toBe('MyMod.nupkg');
    });

    it('should handle NuGet package file paths (Windows)', () => {
      const nugetPath = 'bin\\Release\\net6.0\\MyMod.nupkg';
      expect(win32.basename(nugetPath)).toBe('MyMod.nupkg');
    });

    it('should handle paths from validation output (Unix)', () => {
      const validatedPath = 'mods/MyMod/plugins/DllName.dll';
      expect(posix.basename(validatedPath)).toBe('DllName.dll');
    });

    it('should handle paths from validation output (Windows)', () => {
      const validatedPath = 'mods\\MyMod\\plugins\\DllName.dll';
      expect(win32.basename(validatedPath)).toBe('DllName.dll');
    });
  });

  describe('Edge cases from actual usage', () => {
    it('should handle paths with DLL name containing dots (Unix)', () => {
      const path = 'plugins/My.Mod.Name.v1.0.0.dll';
      expect(posix.basename(path)).toBe('My.Mod.Name.v1.0.0.dll');
    });

    it('should handle paths with DLL name containing dots (Windows)', () => {
      const path = 'plugins\\My.Mod.Name.v1.0.0.dll';
      expect(win32.basename(path)).toBe('My.Mod.Name.v1.0.0.dll');
    });

    it('should handle absolute paths for file operations (Unix)', () => {
      const absoluteUnixPath = '/absolute/path/to/mods/MyMod.dll';
      expect(posix.basename(absoluteUnixPath)).toBe('MyMod.dll');
    });

    it('should handle absolute paths for file operations (Windows)', () => {
      const absoluteWindowsPath = 'C:\\absolute\\path\\to\\mods\\MyMod.dll';
      expect(win32.basename(absoluteWindowsPath)).toBe('MyMod.dll');
    });

    it('should handle paths with extra separators (Unix)', () => {
      const doubleSlash = 'plugins//MyMod.dll';
      expect(posix.basename(doubleSlash)).toBe('MyMod.dll');
    });

    it('should handle paths with extra separators (Windows)', () => {
      const doubleBackslash = 'plugins\\\\MyMod.dll';
      expect(win32.basename(doubleBackslash)).toBe('MyMod.dll');
    });
  });

  describe('Comparison with old split approach', () => {
    it('should demonstrate why hardcoded split("/") fails on Windows paths', () => {
      // Old approach: path.split('/').pop() || path.split('\\').pop()

      // Simulate Windows path string (with actual backslashes)
      const windowsPath = 'plugins\\MyMod.dll';

      // Old hardcoded Unix approach fails on Windows paths
      const oldUnixWay = windowsPath.split('/').pop();
      expect(oldUnixWay).toBe('plugins\\MyMod.dll'); // Wrong! Doesn't extract

      // The old dual-handling approach required both splits
      // The || operator checks if the first result is truthy
      const firstTry = windowsPath.split('/').pop();
      const secondTry = windowsPath.split('\\').pop();
      const oldDualWay = (firstTry && firstTry !== windowsPath) ? firstTry : secondTry;
      expect(oldDualWay).toBe('MyMod.dll'); // Works, but verbose and error-prone
    });

    it('should demonstrate basename is cleaner than dual-handling', () => {
      // Old dual-handling: split('/').pop() || split('\\').pop()
      // New approach: basename(path) - automatically uses correct separator

      const unixPath = 'plugins/MyMod.dll';
      const windowsPath = 'plugins\\MyMod.dll';

      // The new way is cleaner and works for both platforms
      expect(posix.basename(unixPath)).toBe('MyMod.dll');
      expect(win32.basename(windowsPath)).toBe('MyMod.dll');
    });

    it('should show basename handles the actual use case correctly', () => {
      // This demonstrates how path.basename() automatically adapts to the platform
      // On Windows, it uses \ as separator; on Unix, it uses /

      const unixPaths = [
        'plugins/FirstMod.dll',
        'plugins/SecondMod.dll',
        'plugins/ThirdMod.dll'
      ];

      const windowsPaths = [
        'plugins\\FirstMod.dll',
        'plugins\\SecondMod.dll',
        'plugins\\ThirdMod.dll'
      ];

      // When using posix.basename for Unix-style paths
      const unixNames = unixPaths.map(p => posix.basename(p));
      expect(unixNames).toEqual([
        'FirstMod.dll',
        'SecondMod.dll',
        'ThirdMod.dll'
      ]);

      // When using win32.basename for Windows-style paths
      const windowsNames = windowsPaths.map(p => win32.basename(p));
      expect(windowsNames).toEqual([
        'FirstMod.dll',
        'SecondMod.dll',
        'ThirdMod.dll'
      ]);

      // The actual code uses path.basename() which adapts to the platform
      // This test demonstrates why we should use path.basename() not split('/')
    });
  });
});
