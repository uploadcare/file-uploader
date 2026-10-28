import { test } from 'vitest';
import type { PluginRegistryApi } from '../../dist/index';
import { plainText } from '../../dist/index';

/**
 * A plugin's label is a declared l10n key, or text marked with `plainText()`. A plugin declares its own keys by
 * augmenting `CustomLocaleDefinition`, which also lets `registerL10n` autocomplete them. Any other string compiles too,
 * as in v1.
 */
declare module '../../dist/index' {
  interface CustomLocaleDefinition {
    'my-plugin.source': string;
  }
}

declare const registry: PluginRegistryApi;

test('a label is a built-in key, a declared key, or marked plain text', () => {
  registry.registerSource({ id: 'a', label: 'src-type-local', onSelect: () => {} });
  registry.registerSource({ id: 'b', label: 'my-plugin.source', onSelect: () => {} });
  registry.registerSource({ id: 'c', label: plainText('My source'), onSelect: () => {} });
  registry.registerFileAction({
    id: 'edit',
    icon: 'edit',
    label: plainText('Edit'),
    shouldRender: () => true,
    onClick: () => {},
  });
  registry.registerActivity({ id: 'panel', label: 'my-plugin.source', render: () => undefined });
});

test('a plain string still compiles, as in v1 and the plugin docs (deprecated: it warns at runtime)', () => {
  // extension-points.mdx
  registry.registerSource({ id: 'a', label: 'my-source.label', onSelect: () => {} });
  registry.registerFileAction({ id: 'edit', icon: 'edit', label: 'Edit', shouldRender: () => true, onClick: () => {} });
  registry.registerSource({ id: 'c', label: String('x'), onSelect: () => {} });
  registry.registerActivity({ id: 'panel', label: () => 'Panel', render: () => undefined });
});

test('registerL10n takes declared keys and, as in v1 and assets.mdx, any other key', () => {
  registry.registerL10n({ en: { 'my-plugin.source': 'My source', 'upload-file': 'Upload' } });
  registry.registerL10n({ en: { 'my-source.label': 'My Source' }, de: { 'my-source.label': 'Meine Quelle' } });
});
