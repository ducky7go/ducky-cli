/**
 * Steam Workshop BBCode -> Markdown conversion (the reverse of markdownToBBCode in metadata.ts).
 *
 * Supports the constructs that markdownToBBCode produces: headings h1-h6, bold, italic,
 * strikethrough, lists, links, images, quotes, code blocks and horizontal rules.
 * Unknown tags are removed while their text is kept, and their names are reported.
 *
 * Known loss: inline code is emitted as [b] by markdownToBBCode, so it comes back as bold;
 * ordered lists come back as unordered items, and image alt text is not stored.
 */

/** Footer appended by `push`, spelled "Submmited" (and "Submitted" in some copies) */
const FOOTER_WITH_SEPARATOR = /\n\n\[hr\]\s*Subm{1,2}it{1,2}ed via ducky cli\s*$/i;
const FOOTER_ANY_WHITESPACE = /\s*\[hr\]\s*Subm{1,2}it{1,2}ed via ducky cli\s*$/i;

/**
 * Remove the submission footer from the end of a BBCode description.
 * The exact "\n\n" separator that push adds is removed first, so content whose own
 * trailing newline matters survives the round trip unchanged.
 */
export function stripSubmissionFooter(bbcode: string): string {
  if (FOOTER_WITH_SEPARATOR.test(bbcode)) {
    return bbcode.replace(FOOTER_WITH_SEPARATOR, '');
  }
  return bbcode.replace(FOOTER_ANY_WHITESPACE, '');
}

/** Decode the HTML entities that markdownToBBCode produces */
export function decodeBBCodeEntities(text: string): string {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/**
 * Result of a conversion
 */
export interface BBCodeConversion {
  markdown: string;
  /** Names of tags with no Markdown equivalent (removed, text kept) */
  unknownTags: string[];
}

// Private-use characters delimit placeholders so they never clash with real text
const CODE_PLACEHOLDER = (index: number) => `\uE000CODE${index}\uE001`;
const CODE_PLACEHOLDER_PATTERN = /\uE000CODE(\d+)\uE001/g;
const PART_PLACEHOLDER_PATTERN = /\uE002PART(\d+)\uE003/g;

/**
 * Convert a Steam BBCode description to Markdown.
 * @param input - BBCode text (the push footer is removed if present)
 */
export function bbcodeToMarkdown(input: string): BBCodeConversion {
  const normalized = stripSubmissionFooter(input.replace(/\r\n/g, '\n'));
  const keepsTrailingNewline = normalized.endsWith('\n');
  let text = normalized;

  // 1. Protect code blocks so their content is not converted
  const codeBlocks: string[] = [];
  // Markdown links and images contain brackets; keep them out of the unknown-tag pass
  const parts: string[] = [];
  const protectPart = (markdown: string) => {
    parts.push(markdown);
    return `\uE002PART${parts.length - 1}\uE003`;
  };
  text = text.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, (_match, body: string) => {
    codeBlocks.push(body);
    return CODE_PLACEHOLDER(codeBlocks.length - 1);
  });

  // 2. Headings h1-h6
  for (let level = 1; level <= 6; level++) {
    const pattern = new RegExp(`\\[h${level}\\]([\\s\\S]*?)\\[\\/h${level}\\]`, 'gi');
    text = text.replace(pattern, (_m, title: string) => `\n${'#'.repeat(level)} ${title.trim()}\n`);
  }

  // 3. Emphasis: combined first, then single
  text = text.replace(/\[b\]\s*\[i\]([\s\S]*?)\[\/i\]\s*\[\/b\]/gi, '***$1***');
  text = text.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '**$1**');
  text = text.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '*$1*');
  text = text.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '~~$1~~');

  // 4. Links and images
  text = text.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, (_m, url: string, label: string) =>
    protectPart(`[${label}](${url})`),
  );
  text = text.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (_m, url: string) => protectPart(`[${url}](${url})`));
  text = text.replace(/\[img\]([\s\S]*?)\[\/img\]/gi, (_m, url: string) => protectPart(`![](${url})`));

  // 5. Quotes: every line becomes a quoted line
  text = text.replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, (_m, body: string) =>
    `\n${body.trim().split('\n').map((line) => `> ${line.trim()}`).join('\n')}\n`,
  );

  // 6. Lists: [list] unordered, [olist] ordered, items introduced by [*]
  const convertList = (ordered: boolean) => (_m: string, body: string) => {
    const items = body
      .split(/\[\*\]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return `\n${items.map((item, i) => (ordered ? `${i + 1}. ${item}` : `- ${item}`)).join('\n')}\n`;
  };
  text = text.replace(/\[list\]([\s\S]*?)\[\/list\]/gi, convertList(false));
  text = text.replace(/\[olist\]([\s\S]*?)\[\/olist\]/gi, convertList(true));

  // 7. Horizontal rule
  text = text.replace(/\[hr\]/gi, '\n---\n');

  // 8. Remove unknown tags, keep their text, and remember their names
  const unknownTags = new Set<string>();
  text = text.replace(/\[\/?([a-z][a-z0-9]*)(?:=[^\]]*)?\]/gi, (_m, name: string) => {
    unknownTags.add(name.toLowerCase());
    return '';
  });

  // 9. Restore code blocks as fenced code, then decode entities
  text = text.replace(CODE_PLACEHOLDER_PATTERN, (_m, index: string) => {
    const body = codeBlocks[Number(index)].replace(/^\n+|\n+$/g, '');
    return `\n\`\`\`\n${body}\n\`\`\`\n`;
  });
  text = text.replace(PART_PLACEHOLDER_PATTERN, (_m, index: string) => parts[Number(index)]);
  text = decodeBBCodeEntities(text);

  // 10. Collapse runs of blank lines and trim the ends, keeping one trailing newline if the input had it
  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (keepsTrailingNewline && text.length > 0) {
    text += '\n';
  }

  return { markdown: text, unknownTags: [...unknownTags].sort() };
}
