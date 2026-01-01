import type { ModMetadata } from './parser.js';

/**
 * Generate .nuspec XML content from mod metadata
 * Based on NuGet Mod Packaging Specification v1.0
 *
 * @param metadata - Parsed mod metadata
 * @returns .nuspec XML content
 */
export function generateNuspec(metadata: ModMetadata): string {
  const tags = metadata.tags?.join(' ') || '';
  const dependencies = formatDependencies(metadata.dependencies);
  const icon = metadata.icon ? `<icon>${escapeXml(metadata.icon)}</icon>` : '';

  return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://schemas.microsoft.com/packaging/2013/05/nuspec.xsd">
  <metadata>
    <id>${escapeXml(metadata.name)}</id>
    <version>${escapeXml(metadata.version)}</version>
    ${metadata.description ? `<description>${escapeXml(metadata.description)}</description>` : ''}
    ${metadata.author ? `<authors>${escapeXml(metadata.author)}</authors>` : ''}
    ${metadata.projectUrl ? `<projectUrl>${escapeXml(metadata.projectUrl)}</projectUrl>` : ''}
    ${metadata.license ? `<license type="expression">${escapeXml(metadata.license)}</license>` : ''}
    ${metadata.copyright ? `<copyright>${escapeXml(metadata.copyright)}</copyright>` : ''}
    ${tags ? `<tags>${escapeXml(tags)}</tags>` : ''}
    ${icon}
    ${dependencies}
  </metadata>
</package>`;
}

/**
 * Format dependencies as NuGet dependency groups
 */
function formatDependencies(dependencies?: string[]): string {
  if (!dependencies || dependencies.length === 0) {
    return '<dependencies />';
  }

  const dependencyItems = dependencies
    .map((dep) => {
      const [id, version] = dep.split(':');
      if (version) {
        return `<dependency id="${escapeXml(id)}" version="${escapeXml(version)}" />`;
      }
      return `<dependency id="${escapeXml(dep)}" />`;
    })
    .join('\n    ');

  return `<dependencies>
      ${dependencyItems}
    </dependencies>`;
}

/**
 * Escape special XML characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
