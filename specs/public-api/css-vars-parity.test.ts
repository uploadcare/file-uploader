import { globSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import surface from './public-surface.json' with { type: 'json' };

/**
 * `styling.mdx` documents the `--uc-*` custom properties as a themeable contract. Reading the built CSS is the only
 * way to tell whether a variable still exists — renaming one silently breaks every theme in the wild.
 *
 * Needs `npm run build`, same as `specs/npm`.
 */

const distCss = (): string => {
  const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../../dist');
  return globSync('**/*.css', { cwd: dist })
    .map((file) => readFileSync(resolve(dist, file), 'utf8'))
    .join('\n');
};

describe('documented CSS custom properties', () => {
  const css = distCss();

  it('has CSS to check', () => {
    expect(css.length).toBeGreaterThan(0);
  });

  it.each(surface.cssVars)('%s is declared in the built CSS', (name) => {
    // A declaration, not any occurrence: `--uc-primary` appears inside `--uc-primary-dark` and inside every
    // `var(--uc-primary)` reference, so a substring check would still pass after the variable itself was removed.
    expect(css).toMatch(new RegExp(`${name}\\s*:`));
  });
});
