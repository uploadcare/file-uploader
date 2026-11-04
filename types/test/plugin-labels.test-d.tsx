import { test } from 'vitest';
import type { PlainText, PluginRegistryApi } from '../../dist/index';

/**
 * A plugin's label is a declared l10n key, or text asserted `as PlainText`. A plugin declares its own keys by
 * augmenting `CustomLocaleDefinition`, which also lets `registerL10n` autocomplete them. Any other string compiles too.
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
  registry.registerSource({ id: 'c', label: 'My source' as PlainText, onSelect: () => {} });
  registry.registerFileAction({
    id: 'edit',
    icon: 'edit',
    label: 'Edit' as PlainText,
    shouldRender: () => true,
    onClick: () => {},
  });
  registry.registerActivity({ id: 'panel', label: 'my-plugin.source', render: () => undefined });
});

// QUIRK(plugins): `PluginLabel` takes any string through its deprecated `string & {}` arm (NEXT-MAJOR(plugins) in
// PluginTypes.ts). Pinned as current behaviour, not endorsed.
test('a plain string still compiles as a label (deprecated)', () => {
  // extension-points.mdx
  registry.registerSource({ id: 'a', label: 'my-source.label', onSelect: () => {} });
  registry.registerFileAction({ id: 'edit', icon: 'edit', label: 'Edit', shouldRender: () => true, onClick: () => {} });
  registry.registerSource({ id: 'c', label: String('x'), onSelect: () => {} });
  registry.registerActivity({ id: 'panel', label: () => 'Panel', render: () => undefined });
});

// QUIRK(plugins): `PluginL10nRegistration` takes undeclared keys (NEXT-MAJOR(plugins) in PluginTypes.ts). Pinned as
// current behaviour, not endorsed.
test('registerL10n takes declared keys and any other key', () => {
  registry.registerL10n({ en: { 'my-plugin.source': 'My source', 'upload-file': 'Upload' } });
  registry.registerL10n({ en: { 'my-source.label': 'My Source' }, de: { 'my-source.label': 'Meine Quelle' } });
});
