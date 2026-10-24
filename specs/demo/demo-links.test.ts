import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every reference in a demo page must point at something that exists.
 *
 * Six demo pages shipped broken (blank page / Vite 500) purely because of bad
 * paths: four `demo/bundles/web/*.html` had an off-by-one `../../web/…` (copied
 * from one directory level shallower than they live at), `custom-icons.html`
 * pointed a stylesheet and its import at paths that moved, and
 * `cloud-image-editor-plugin.html` imported `@/core`, which has never existed.
 * None of it was catchable by the component-level e2e suite, and a broken demo
 * silently blocks manual QA of whatever it demonstrates.
 *
 * This is deliberately a STATIC check — it resolves specifiers, it does not run
 * the pages. It catches the whole class of bug above at spec speed; it says
 * nothing about runtime behaviour once a page does load.
 */

const REPO_ROOT = resolve(__dirname, '../..');
const DEMO_ROOT = join(REPO_ROOT, 'demo');

// Build outputs — gitignored, present only after `npm run build`. A reference
// into these is checked for *containment* always (that is what the off-by-one
// bug violated) and for existence only when the directory is actually built.
const BUILD_DIRS = ['web', 'dist'].map((d) => join(REPO_ROOT, d));

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\?)/i;

/** `src`/`href` on script/link/img tags. */
const ATTR_REF = /<(?:script|link|img)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
/** Static `import … from 'x'` / `import 'x'`, plus `import('x')`. */
const STATIC_IMPORT = /\bimport\s+(?:[^'"();]*?\bfrom\s+)?["']([^"']+)["']/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*["']([^"']+)["']/g;

const htmlFiles = readdirSync(DEMO_ROOT, { recursive: true, encoding: 'utf8' })
  .filter((entry) => entry.endsWith('.html'))
  .map((entry) => join(DEMO_ROOT, entry))
  .sort();

const collect = (source: string, pattern: RegExp): string[] => {
  // Fresh lastIndex per call — these are module-level `g` regexes.
  pattern.lastIndex = 0;
  return [...source.matchAll(pattern)].map((match) => match[1] as string);
};

/**
 * Resolve a demo specifier to an absolute path the way Vite would, or `null`
 * when it is not ours to check (a CDN URL, a bare npm specifier).
 */
const resolveSpecifier = (htmlFile: string, specifier: string): string | null => {
  if (EXTERNAL.test(specifier)) {
    return null;
  }
  if (specifier.startsWith('@/')) {
    return join(REPO_ROOT, 'src', specifier.slice(2));
  }
  if (specifier.startsWith('~/')) {
    return join(REPO_ROOT, specifier.slice(2));
  }
  if (specifier.startsWith('/')) {
    return join(REPO_ROOT, specifier.slice(1));
  }
  if (specifier.startsWith('.')) {
    return resolve(dirname(htmlFile), specifier);
  }
  return null; // bare specifier → node_modules, not our problem
};

/**
 * Vite resolves a `.js` specifier to its TS source, and an extensionless one to
 * `.ts`/`.tsx`/a directory index — accept any of those.
 */
const existsResolved = (path: string): boolean => {
  const candidates = [path];
  if (path.endsWith('.js')) {
    const base = path.slice(0, -'.js'.length);
    candidates.push(`${base}.ts`, `${base}.tsx`);
  } else if (!/\.[a-z0-9]+$/i.test(path)) {
    candidates.push(`${path}.ts`, `${path}.tsx`, `${path}.js`, join(path, 'index.ts'), join(path, 'index.js'));
  }
  return candidates.some((candidate) => existsSync(candidate));
};

const isInside = (dir: string, path: string): boolean => !relative(dir, path).startsWith('..');

describe('demo pages', () => {
  it('finds demo pages to check (guards against a broken glob silently passing)', () => {
    expect(htmlFiles.length).toBeGreaterThan(15);
  });

  for (const htmlFile of htmlFiles) {
    const label = relative(REPO_ROOT, htmlFile).split(sep).join('/');

    it(`${label} — every local reference resolves`, () => {
      const source = readFileSync(htmlFile, 'utf8');
      const specifiers = [
        ...collect(source, ATTR_REF),
        ...collect(source, STATIC_IMPORT),
        ...collect(source, DYNAMIC_IMPORT),
      ];

      const broken: string[] = [];
      for (const specifier of specifiers) {
        const path = resolveSpecifier(htmlFile, specifier);
        if (!path) {
          continue;
        }

        const buildDir = BUILD_DIRS.find((dir) => isInside(dir, path));
        if (!isInside(REPO_ROOT, path)) {
          // Escaped the repo entirely — this is what `../../web/…` from
          // `demo/bundles/web/` did (it landed on `demo/web/…`, or above root).
          broken.push(`${specifier} → outside the repo (${path})`);
          continue;
        }
        if (buildDir && !existsSync(buildDir)) {
          continue; // not built yet; containment (checked above) is all we can assert
        }
        if (!existsResolved(path)) {
          broken.push(`${specifier} → missing ${relative(REPO_ROOT, path)}`);
        }
      }

      expect(broken).toEqual([]);
    });
  }
});
