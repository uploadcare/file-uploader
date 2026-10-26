import { test } from 'vitest';
import type { PluginRegistryApi } from '../../dist/index';
import { plainText } from '../../dist/index';

/**
 * A plugin's label is a declared l10n key, or text marked with `plainText()`. A plugin declares its own keys by
 * augmenting `CustomLocaleDefinition`, which also lets `registerL10n` take them.
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

test('an undeclared key or unmarked text is not a label', () => {
  // @ts-expect-error neither a declared key nor plainText()
  registry.registerSource({ id: 'a', label: 'My source', onSelect: () => {} });
  // @ts-expect-error a misspelt built-in key
  registry.registerSource({ id: 'b', label: 'src-type-locla', onSelect: () => {} });
  // @ts-expect-error a string from elsewhere has to be marked
  registry.registerSource({ id: 'c', label: String('x'), onSelect: () => {} });
  // @ts-expect-error a label function returns a label, not any string
  registry.registerActivity({ id: 'panel', label: () => 'Panel', render: () => undefined });
});

test('registerL10n takes declared keys only', () => {
  registry.registerL10n({ en: { 'my-plugin.source': 'My source', 'upload-file': 'Upload' } });
  // @ts-expect-error undeclared key
  registry.registerL10n({ en: { 'my-plugin.nope': 'Nope' } });
});
