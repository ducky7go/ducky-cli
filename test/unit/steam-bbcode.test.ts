import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { bbcodeToMarkdown, stripSubmissionFooter } from '../../src/formats/steam/bbcode.js';
import { markdownToBBCode, languageToFilename, mapFilenameToLanguage } from '../../src/formats/steam/metadata.js';

const here = dirname(fileURLToPath(import.meta.url));
const roundtripMd = readFileSync(join(here, '..', 'fixtures', 'steam-bbcode', 'roundtrip.md'), 'utf8');

/** Normalize blank lines and trailing spaces for semantic comparison */
function normalize(text: string): string {
  return text
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{2,}/g, '\n\n')
    .trim();
}

describe('bbcodeToMarkdown: supported constructs', () => {
  const cases: Array<[string, string, string]> = [
    ['heading h1', '[h1]Title[/h1]', '# Title'],
    ['heading h2', '[h2]Title[/h2]', '## Title'],
    ['heading h6', '[h6]Deep[/h6]', '###### Deep'],
    ['bold', '[b]x[/b]', '**x**'],
    ['italic', '[i]x[/i]', '*x*'],
    ['bold italic', '[b][i]x[/i][/b]', '***x***'],
    ['strikethrough', '[s]x[/s]', '~~x~~'],
    ['link with text', '[url=https://a.b]Text[/url]', '[Text](https://a.b)'],
    ['bare link', '[url]https://a.b[/url]', '[https://a.b](https://a.b)'],
    ['image', '[img]https://x/y.png[/img]', '![](https://x/y.png)'],
    ['unordered list', '[list]\n[*]one\n[*]two\n[/list]', '- one\n- two'],
    ['ordered list', '[olist]\n[*]one\n[*]two\n[/olist]', '1. one\n2. two'],
    ['quote', '[quote]hi[/quote]', '> hi'],
    ['code block', '[code]a &lt; b[/code]', '```\na < b\n```'],
    ['horizontal rule', '[hr]', '---'],
  ];

  for (const [name, input, expected] of cases) {
    it(`converts ${name}`, () => {
      expect(bbcodeToMarkdown(input).markdown).toBe(expected);
    });
  }
});

describe('bbcodeToMarkdown: entities, unknown tags and footer', () => {
  it('decodes &lt; &gt; &amp; into characters', () => {
    expect(bbcodeToMarkdown('1 &lt; 2 &amp; 3 &gt; 0').markdown).toBe('1 < 2 & 3 > 0');
  });

  it('removes unknown tags, keeps their text and reports their names', () => {
    const result = bbcodeToMarkdown('[color=red]Hi[/color] [u]there[/u]');
    expect(result.markdown).toBe('Hi there');
    expect(result.unknownTags).toEqual(['color', 'u']);
  });

  it('strips the push footer in both spellings', () => {
    expect(bbcodeToMarkdown('Body text\n\n[hr]Submmited via ducky cli').markdown).toBe('Body text');
    expect(bbcodeToMarkdown('Body text\n\n[hr]Submitted via ducky cli').markdown).toBe('Body text');
    expect(stripSubmissionFooter('Keep [hr]this')).toBe('Keep [hr]this');
  });
});

describe('markdown <-> BBCode round trip', () => {
  it('md -> bb -> md -> bb is stable and the Markdown is semantically equal', () => {
    const bb1 = markdownToBBCode(roundtripMd);
    const md2 = bbcodeToMarkdown(bb1).markdown;
    const bb2 = markdownToBBCode(md2);

    expect(bb2).toBe(bb1);
    expect(normalize(md2)).toBe(normalize(roundtripMd));
  });
});

describe('language filenames', () => {
  it('maps english, schinese and tchinese to en, zh and zh-tw', () => {
    expect(languageToFilename('english')).toBe('en');
    expect(languageToFilename('schinese')).toBe('zh');
    expect(languageToFilename('tchinese')).toBe('zh-tw');
  });

  it('keeps Steam codes for other languages and maps every name back', () => {
    expect(languageToFilename('japanese')).toBe('japanese');
    expect(languageToFilename('koreana')).toBe('koreana');
    for (const steam of ['english', 'schinese', 'tchinese', 'japanese', 'koreana']) {
      expect(mapFilenameToLanguage(languageToFilename(steam))).toBe(steam);
    }
  });
});
