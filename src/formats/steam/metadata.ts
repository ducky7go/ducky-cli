import { readTextFile, directoryExists, fileExists } from '../../utils/fs.js';
import { join } from 'path';

/**
 * Localized description
 */
export interface LocalizedDescription {
  language: string; // Steam language code (e.g., "schinese", "english")
  content: string; // BBCode content (converted from Markdown)
}

/**
 * Localized title
 */
export interface LocalizedTitle {
  language: string; // Steam language code
  title: string; // Localized title
}

/**
 * Language code mapping from filename to Steam language code
 * Based on Steam's supported languages:
 * https://partner.steamgames.com/doc/store/localization
 */
const LANGUAGE_CODE_MAP: Record<string, string> = {
  // Chinese variants
  'zh': 'schinese',
  'zh-cn': 'schinese',
  'zh_cn': 'schinese',
  'zh-hans': 'schinese',
  'zh_hans': 'schinese',
  'schinese': 'schinese',
  'zh-hant': 'tchinese',
  'zh_hant': 'tchinese',
  'zh-tw': 'tchinese',
  'zh_tw': 'tchinese',
  'tchinese': 'tchinese',

  // English
  'en': 'english',
  'english': 'english',

  // Japanese
  'ja': 'japanese',
  'japanese': 'japanese',

  // Korean
  'ko': 'koreana',
  'koreana': 'koreana',

  // Spanish - use latam for Spanish (Latin America)
  'es': 'latam',
  'spanish': 'latam',
  'latam': 'latam',

  // Portuguese - use brazilian for Portuguese
  'pt': 'brazilian',
  'pt-br': 'brazilian',
  'pt_br': 'brazilian',
  'brazilian': 'brazilian',

  // German
  'de': 'german',
  'german': 'german',

  // French
  'fr': 'french',
  'french': 'french',

  // Italian
  'it': 'italian',
  'italian': 'italian',

  // Russian
  'ru': 'russian',
  'russian': 'russian',

  // Polish
  'pl': 'polish',
  'polish': 'polish',

  // Thai
  'th': 'thai',
  'thai': 'thai',

  // Turkish
  'tr': 'turkish',
  'turkish': 'turkish',

  // Czech
  'cs': 'czech',
  'czech': 'czech',

  // Hungarian
  'hu': 'hungarian',
  'hungarian': 'hungarian',

  // Dutch
  'nl': 'dutch',
  'dutch': 'dutch',

  // Swedish
  'sv': 'swedish',
  'swedish': 'swedish',

  // Norwegian
  'no': 'norwegian',
  'norwegian': 'norwegian',

  // Danish
  'da': 'danish',
  'danish': 'danish',

  // Finnish
  'fi': 'finnish',
  'finnish': 'finnish',

  // Greek
  'el': 'greek',
  'greek': 'greek',

  // Bulgarian
  'bg': 'bulgarian',
  'bulgarian': 'bulgarian',

  // Romanian
  'ro': 'romanian',
  'romanian': 'romanian',

  // Ukrainian
  'uk': 'ukrainian',
  'ukrainian': 'ukrainian',

  // Vietnamese
  'vi': 'vietnamese',
  'vietnamese': 'vietnamese',

  // Arabic
  'ar': 'arabic',
  'arabic': 'arabic',

  // Indonesian
  'id': 'indonesian',
  'indonesian': 'indonesian',
};

/**
 * Map filename to Steam language code
 * @param filename - The filename without extension (e.g., "zh", "en", "japanese")
 * @returns Steam language code or null if not found
 */
export function mapFilenameToLanguage(filename: string): string | null {
  const normalized = filename.toLowerCase().trim();
  return LANGUAGE_CODE_MAP[normalized] || null;
}

/**
 * Extract title from markdown content
 * The title is the first H1 heading found in the markdown
 * @param markdown - The markdown content
 * @returns The extracted title or empty string if not found
 */
function extractTitleFromMarkdown(markdown: string): string {
  // Match first H1 heading (# Title)
  const h1Match = markdown.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }
  return '';
}

/**
 * Convert Markdown to Steam Workshop BBCode format
 * @param markdown - The markdown content
 * @returns BBCode content
 */
function markdownToBBCode(markdown: string): string {
  let result = markdown;

  // Escape HTML tags first (prevent HTML injection)
  result = result.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Code blocks - must be processed before other transformations
  result = result.replace(/```(\w*)\n([\s\S]*?)```/g, '[code]$2[/code]');

  // Inline code - convert to bold for single-line code
  result = result.replace(/`([^`]+)`/g, '[b]$1[/b]');

  // Headers (h1-h6)
  result = result.replace(/^######\s+(.+)$/gm, '[h6]$1[/h6]');
  result = result.replace(/^#####\s+(.+)$/gm, '[h5]$1[/h5]');
  result = result.replace(/^####\s+(.+)$/gm, '[h4]$1[/h4]');
  result = result.replace(/^###\s+(.+)$/gm, '[h3]$1[/h3]');
  result = result.replace(/^##\s+(.+)$/gm, '[h2]$1[/h2]');
  result = result.replace(/^#\s+(.+)$/gm, '[h1]$1[/h1]');

  // Bold and Italic combinations (must be processed before individual ones)
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, '[b][i]$1[/i][/b]');
  result = result.replace(/___(.+?)___/g, '[b][i]$1[/i][/b]');

  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, '[b]$1[/b]');
  result = result.replace(/__(.+?)__/g, '[b]$1[/b]');

  // Italic
  result = result.replace(/\*(.+?)\*/g, '[i]$1[/i]');
  result = result.replace(/_(.+?)_/g, '[i]$1[/i]');

  // Strikethrough
  result = result.replace(/~~(.+?)~~/g, '[s]$1[/s]');

  // Horizontal rule
  result = result.replace(/^-{3,}$/gm, '[hr]');
  result = result.replace(/^\*{3,}$/gm, '[hr]');

  // Images ![alt](url)
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '[img]$2[/img]');

  // Links [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '[url=$2]$1[/url]');

  // Unordered lists
  result = result.replace(/^[\*\-]\s+(.+)$/gm, '[*]$1');

  // Ordered lists
  result = result.replace(/^\d+\.\s+(.+)$/gm, '[*]$1');

  // Wrap lists in [list] tags
  // Find consecutive [*] lines and wrap them
  result = result.replace(/(\[\*].+\n?)+/g, (match) => {
    // Remove trailing newline from the match
    const content = match.trimEnd();
    return `[list]\n${content}\n[/list]\n`;
  });

  // Blockquotes
  result = result.replace(/^>\s+(.+)$/gm, '[quote]$1[/quote]');

  // Multiple consecutive quotes should be grouped
  result = result.replace(/(\[quote\].+\n?)+/g, (match) => {
    const content = match.trimEnd();
    return content + '\n';
  });

  // Paragraphs - double newline becomes paragraph break
  result = result.replace(/\n\n+/g, '\n\n');

  return result;
}

/**
 * Load descriptions from description/*.md files
 * @param directory - Path to the mod directory
 * @returns Array of localized descriptions
 */
export async function loadDescriptions(directory: string): Promise<LocalizedDescription[]> {
  const descriptions: LocalizedDescription[] = [];
  const descDir = join(directory, 'description');

  // Check if description directory exists
  if (!(await directoryExists(descDir))) {
    return descriptions;
  }

  // Import fs for reading directory
  const fs = await import('fs/promises');
  const { readdir } = fs;

  try {
    const files = await readdir(descDir);

    for (const file of files) {
      if (!file.endsWith('.md')) {
        continue;
      }

      const languageCode = file.slice(0, -3); // Remove .md extension
      const steamLanguage = mapFilenameToLanguage(languageCode);

      if (steamLanguage) {
        const filePath = join(descDir, file);
        const markdown = await readTextFile(filePath);
        const bbcode = markdownToBBCode(markdown);

        descriptions.push({
          language: steamLanguage,
          content: bbcode,
        });
      }
    }
  } catch (error) {
    // If directory read fails, return empty array
    console.warn(`Failed to read description directory: ${error}`);
  }

  return descriptions;
}

/**
 * Load titles from description/*.md files
 * @param directory - Path to the mod directory
 * @param defaultTitle - The default title to use if no title is found in a file
 * @returns Array of localized titles
 */
export async function loadTitles(
  directory: string,
  defaultTitle: string
): Promise<LocalizedTitle[]> {
  const titles: LocalizedTitle[] = [];
  const descDir = join(directory, 'description');

  // Check if description directory exists
  if (!(await directoryExists(descDir))) {
    return titles;
  }

  // Import fs for reading directory
  const fs = await import('fs/promises');
  const { readdir } = fs;

  try {
    const files = await readdir(descDir);

    for (const file of files) {
      if (!file.endsWith('.md')) {
        continue;
      }

      const languageCode = file.slice(0, -3); // Remove .md extension
      const steamLanguage = mapFilenameToLanguage(languageCode);

      if (steamLanguage) {
        const filePath = join(descDir, file);
        const markdown = await readTextFile(filePath);
        const title = extractTitleFromMarkdown(markdown) || defaultTitle;

        titles.push({
          language: steamLanguage,
          title,
        });
      }
    }
  } catch (error) {
    // If directory read fails, return empty array
    console.warn(`Failed to read description directory: ${error}`);
  }

  return titles;
}

/**
 * Get the primary language description and title
 * Priority: english -> schinese -> first available
 * @param descriptions - Array of localized descriptions
 * @param titles - Array of localized titles
 * @returns Primary description and title
 */
export function getPrimaryLanguageContent(
  descriptions: LocalizedDescription[],
  titles: LocalizedTitle[]
): { description?: LocalizedDescription; title?: LocalizedTitle } {
  // Try English first
  const englishDesc = descriptions.find((d) => d.language === 'english');
  const englishTitle = titles.find((t) => t.language === 'english');
  if (englishDesc || englishTitle) {
    return { description: englishDesc, title: englishTitle };
  }

  // Try Simplified Chinese second
  const schineseDesc = descriptions.find((d) => d.language === 'schinese');
  const schineseTitle = titles.find((t) => t.language === 'schinese');
  if (schineseDesc || schineseTitle) {
    return { description: schineseDesc, title: schineseTitle };
  }

  // Return first available
  return {
    description: descriptions[0],
    title: titles[0],
  };
}
