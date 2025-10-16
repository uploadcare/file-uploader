import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Biome } from '@biomejs/js-api/nodejs';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();

const __dirname = dirname(fileURLToPath(import.meta.url));

const DIST_PATH = resolve(__dirname, '../dist');

// biome-ignore lint/suspicious/noExplicitAny: Type is used to represent any class
type AnyClass = new (...args: any[]) => any;

const isClass = (value: unknown): value is AnyClass => {
  return typeof value === 'function' && /^\s*class\s/.test(Function.prototype.toString.call(value));
};

const getClassStaticProperties = (klass: AnyClass) => {
  const extractedProperties: Record<string, unknown> = {};
  // biome-ignore lint/suspicious/noExplicitAny: Type is used to represent any class
  const extract = (proto: any) => {
    if (proto === null) return;
    if (proto === HTMLElement || proto === HTMLElement.prototype) {
      return;
    }
    Object.getOwnPropertyNames(proto)
      .filter((name) => {
        const isPublic = !name.startsWith('_');
        const isOwn = !['arguments', 'prototype', 'caller', 'constructor', 'name', 'length'].includes(name);
        const isDefined = isOwn && !!proto[name as keyof typeof proto];
        return isPublic && isOwn && isDefined;
      })
      .forEach((name) => {
        extractedProperties[name] = proto[name as keyof typeof proto];
      });
    extract(Object.getPrototypeOf(proto));
  };
  extract(klass);
  return extractedProperties;
};

const stubClass = (klass: AnyClass) => {
  const properties = getClassStaticProperties(klass);
  return `class {
    ${Object.entries(properties)
      .map(([key, value]) => {
        let valueString: string;
        if (typeof value === 'function') {
          valueString = '() => {}';
        } else if (typeof value === 'string') {
          valueString = `\`${value}\``;
        } else if (Array.isArray(value)) {
          valueString = JSON.stringify(value);
        } else if (typeof value === 'object') {
          valueString = JSON.stringify(value);
        } else {
          throw new Error(`Unexpected property type: ${typeof value}`);
        }
        return `static ${key} = ${valueString}`;
      })
      .join('\n')}
  }`;
};

// Import from source since build:lib runs after build:ssr-stubs
const realExports: Record<string, unknown> = await import(join(DIST_PATH, 'index.js'));
const stubbedExports = Object.fromEntries(
  Object.entries(realExports).map(([key, value]) => {
    let newValue: string;
    if (isClass(value)) {
      newValue = stubClass(value);
    } else if (typeof value === 'function') {
      newValue = '() => {}';
    } else if (typeof value === 'string') {
      newValue = `\`${value}\``;
    } else if (typeof value === 'object') {
      newValue = JSON.stringify(value);
    } else {
      throw new Error(`Unexpected export type: ${typeof value}`);
    }
    return [key, newValue];
  }),
);

const content = [...Object.entries(stubbedExports), ['IS_SSR_STUBS', 'true']]
  .map(([key, value]) => {
    return `export const ${key} = ${value};`;
  })
  .join('\n');

const biome = new Biome();
const { projectKey } = biome.openProject(join(__dirname, '..'));

const formatted = biome.formatContent(projectKey, content, {
  filePath: join(DIST_PATH, 'index.ssr.js'),
});

writeFileSync(join(DIST_PATH, 'index.ssr.js'), formatted.content);
