import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// The build mangles every `_`-prefixed property (`mangleProps: /^_/` in build.ts), so a public `_` member in the
// published types names something that doesn't exist at runtime, for a caller or for a subclass. Keep such members private, or mark them `@internal`
// so the DTS drops them.
const ROOT = join(import.meta.dirname, '..');
const DIRS = ['dist', 'web'];
// Type-only brands: never a runtime property, so the mangler has nothing to rename.
const TYPE_ONLY = new Set(['__uid']);
const MEMBER = /^\s+((?:readonly|static|get|set|public|protected|abstract|declare)\s+)*(_\w*)[?!]?\s*[:(<]/;

const offenders: string[] = [];
for (const dir of DIRS) {
  for (const file of readdirSync(join(ROOT, dir), { recursive: true, encoding: 'utf8' })) {
    if (!file.endsWith('.d.ts')) continue;
    const lines = readFileSync(join(ROOT, dir, file), 'utf8').split('\n');
    lines.forEach((line, index) => {
      const name = MEMBER.exec(line)?.[2];
      if (name && !TYPE_ONLY.has(name)) offenders.push(`${dir}/${file}:${index + 1}: ${line.trim()}`);
    });
  }
}

if (offenders.length > 0) {
  console.error(
    `Public \`_\` members in the published types; the build renames them, so they are undefined at runtime:`,
  );
  for (const offender of offenders) console.error(`  ${offender}`);
  process.exit(1);
}
console.log('check-dts-internals: no public or protected `_` members in the published types');
