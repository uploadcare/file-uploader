import { test } from 'vitest';
import type { PluginRegistryApi } from '../../dist/index';

declare const registry: PluginRegistryApi;

test("an activity's render may return nothing, or a dispose function", () => {
  registry.registerActivity({
    id: 'act',
    render(host) {
      host.append(document.createElement('div'));
    },
  });
  registry.registerActivity({
    id: 'act',
    render(host) {
      return () => host.replaceChildren();
    },
  });
  // @ts-expect-error a render returns a dispose function or nothing
  registry.registerActivity({ id: 'act', render: () => 1 });
});
