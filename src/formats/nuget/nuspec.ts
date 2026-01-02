import type { ModMetadata } from './parser.js';

// Inline template following NuGet Mod Packaging Specification v1.0
const NUSPEC_TEMPLATE = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://schemas.microsoft.com/packaging/2013/05/nuspec.xsd">
  <metadata>
    <id>{{NAME}}</id>
    <version>{{VERSION}}</version>
    <title>{{TITLE}}</title>
    <authors>{{AUTHOR}}</authors>
    <description>{{DESCRIPTION}}</description>
    <tags>{{TAGS}}</tags>
    <icon>icon.png</icon>
    {{PROJECT_URL_BLOCK}}
    {{LICENSE_BLOCK}}
    {{COPYRIGHT_BLOCK}}
    {{DEPENDENCIES}}
    {{README_BLOCK}}
    {{RELEASE_NOTES_BLOCK}}
  </metadata>
  <files>
    <!-- Icon to package root (for NuGet gallery display) -->
    <file src="preview.png" target="icon.png" />
    <!-- Icon also in content/ (preserves original mod structure) -->
    <file src="preview.png" target="content/preview.png" />
    <!-- README.md to docs/ (for NuGet gallery display) -->
    {{README_FILE}}
    <!-- ALL other mod files to content/ -->
    <file src="**" target="content/" exclude="preview.png;README.md;*.nupkg;*.nuspec" />
  </files>
</package>`;

/**
 * Generate .nuspec XML content from mod metadata using template
 * Based on NuGet Mod Packaging Specification v1.0
 *
 * @param metadata - Parsed mod metadata
 * @param readmeFilePath - Relative path from mod dir to README.md (e.g., "../pkg/README.md")
 * @param releaseNotes - Optional release notes content
 * @returns .nuspec XML content
 */
export async function generateNuspec(
  metadata: ModMetadata,
  readmeFilePath?: string,
  releaseNotes?: string
): Promise<string> {
  let template = NUSPEC_TEMPLATE;

  // Default tags (per spec: duckymod game-mod)
  const defaultTags = 'duckymod game-mod';
  // Format tags for NuGet: replace spaces with hyphens since NuGet uses space as delimiter
  const formattedTags = metadata.tags?.map(tag => tag.replace(/\s+/g, '-')) || [];
  const tags = formattedTags.length ? formattedTags.join(' ') + ' ' + defaultTags : defaultTags;

  // Title: use displayName, fallback to name
  const title = metadata.displayName || metadata.name;

  // Format dependencies
  const dependencies = formatDependencies(metadata.dependencies);

  // Handle optional blocks
  let projectUrlBlock = '';
  if (metadata.projectUrl) {
    projectUrlBlock = `<projectUrl>${escapeXml(metadata.projectUrl)}</projectUrl>`;
  }

  let licenseBlock = '';
  if (metadata.license) {
    licenseBlock = `<license type="expression">${escapeXml(metadata.license)}</license>`;
  }

  let copyrightBlock = '';
  if (metadata.copyright) {
    copyrightBlock = `<copyright>${escapeXml(metadata.copyright)}</copyright>`;
  }

  // Description: use metadata.description for short description
  const description = metadata.description || '';

  // README: add <readme> block if readmeFilePath is provided
  let readmeBlock = '';
  let readmeFile = '';
  if (readmeFilePath) {
    readmeBlock = `<readme>docs/README.md</readme>`;
    readmeFile = `<file src="${escapeXml(readmeFilePath)}" target="docs/" />`;
  }

  // Release notes: add <releaseNotes> block if provided
  let releaseNotesBlock = '';
  if (releaseNotes && releaseNotes.length > 0) {
    // Use CDATA for multi-line content
    if (releaseNotes.includes('\n') || releaseNotes.length > 400) {
      releaseNotesBlock = `<releaseNotes><![CDATA[${releaseNotes}]]></releaseNotes>`;
    } else {
      releaseNotesBlock = `<releaseNotes>${escapeXml(releaseNotes)}</releaseNotes>`;
    }
  }

  // Replace placeholders
  template = template.replace(/\{\{NAME\}\}/g, escapeXml(metadata.name));
  template = template.replace(/\{\{VERSION\}\}/g, escapeXml(metadata.version));
  template = template.replace(/\{\{TITLE\}\}/g, escapeXml(title));
  template = template.replace(/\{\{AUTHOR\}\}/g, escapeXml(metadata.author || 'Unknown'));
  template = template.replace(/\{\{DESCRIPTION\}\}/g, formatDescription(description));
  template = template.replace(/\{\{TAGS\}\}/g, escapeXml(tags));
  template = template.replace(/\{\{PROJECT_URL_BLOCK\}\}/g, projectUrlBlock);
  template = template.replace(/\{\{LICENSE_BLOCK\}\}/g, licenseBlock);
  template = template.replace(/\{\{COPYRIGHT_BLOCK\}\}/g, copyrightBlock);
  template = template.replace(/\{\{DEPENDENCIES\}\}/g, dependencies);
  template = template.replace(/\{\{README_BLOCK\}\}/g, readmeBlock);
  template = template.replace(/\{\{README_FILE\}\}/g, readmeFile);
  template = template.replace(/\{\{RELEASE_NOTES_BLOCK\}\}/g, releaseNotesBlock);

  return template;
}

/**
 * Format dependencies as NuGet dependency groups
 * Always declares .NETStandard2.1 framework support
 */
function formatDependencies(dependencies?: string[]): string {
  // Build mod dependency items
  let depItems = '';
  if (dependencies && dependencies.length > 0) {
    const items = dependencies
      .map((dep) => {
        const [id, version] = dep.split(':');
        if (version) {
          return `    <dependency id="${escapeXml(id)}" version="${escapeXml(version)}" />`;
        }
        return `    <dependency id="${escapeXml(dep)}" />`;
      })
      .join('\n');
    depItems = '\n' + items;
  }

  // Always declare .NETStandard2.1 framework support
  return `<dependencies>
  <group targetFramework=".NETStandard2.1">${depItems}
  </group>
</dependencies>`;
}

/**
 * Format description for nuspec
 * Uses CDATA for multi-line or long content (e.g., markdown README)
 */
function formatDescription(description: string): string {
  // Use CDATA for multi-line content or markdown
  if (description.includes('\n') || description.length > 400) {
    return `<![CDATA[${description}]]>`;
  }
  return escapeXml(description);
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
