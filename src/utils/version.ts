import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Reads the version from package.json
 * @returns The version string from package.json, or "0.0.0" if unable to read
 */
export async function getVersion(): Promise<string> {
  try {
    // package.json is in the project root, two levels up from src/utils/
    const packageJsonPath = join(__dirname, '..', '..', 'package.json');
    const content = await readFile(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);
    return pkg.version || '0.0.0';
  } catch {
    // Fallback to "0.0.0" if unable to read package.json
    return '0.0.0';
  }
}
