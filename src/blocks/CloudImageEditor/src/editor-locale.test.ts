import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EDITOR_DEFAULT_LOCALE, resolveEditorL10n } from './editor-locale';

const EDITOR_SOURCE_DIR = join(process.cwd(), 'src/blocks/CloudImageEditor/src');
const L10N_LITERAL_RE = /\bl10n(?:Safe)?\(\s*['"]([^'"]+)['"]/g;

function findEditorSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findEditorSourceFiles(path));
    } else if (extname(entry.name) === '.ts' && !entry.name.endsWith('.test.ts')) {
      files.push(path);
    }
  }
  return files;
}

function findLiteralL10nKeys(): string[] {
  const keys = new Set<string>();
  for (const file of findEditorSourceFiles(EDITOR_SOURCE_DIR)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(L10N_LITERAL_RE)) {
      const [, key] = match;
      if (key) {
        keys.add(key);
      }
    }
  }
  return [...keys].sort();
}

describe('resolveEditorL10n', () => {
  it('resolves bundled English defaults', () => {
    expect(resolveEditorL10n()('cancel')).toBe('Cancel');
  });

  it('falls back to the key when no locale entry exists', () => {
    expect(resolveEditorL10n()('unknown-editor-key')).toBe('unknown-editor-key');
  });

  it('lets overrides win over bundled defaults', () => {
    expect(resolveEditorL10n({ cancel: 'Abort' })('cancel')).toBe('Abort');
  });

  it('interpolates template variables', () => {
    expect(resolveEditorL10n()('a11y-cloud-editor-apply-tuning', { name: 'brightness' })).toContain('brightness');
  });
});

describe('EDITOR_DEFAULT_LOCALE', () => {
  it('covers every literal editor l10n key', () => {
    const missingKeys = findLiteralL10nKeys().filter((key) => !(key in EDITOR_DEFAULT_LOCALE));

    expect(missingKeys).toEqual([]);
  });
});
