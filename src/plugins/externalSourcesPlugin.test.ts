import { describe, expect, it } from 'vitest';
import type { PluginSourceRegistration } from '../abstract/managers/plugin/PluginTypes';
import { ExternalUploadSource } from '../utils/UploadSource';
import { externalSourcesPlugin } from './externalSourcesPlugin';

describe('externalSourcesPlugin', () => {
  it('gives an aliased source the icon of the source it stands for', async () => {
    const sources: PluginSourceRegistration[] = [];
    const registry = { registerActivity: () => {}, registerSource: (s: PluginSourceRegistration) => sources.push(s) };
    await externalSourcesPlugin.setup({ pluginApi: { registry }, uploaderApi: {} } as never);

    expect(sources.find((s) => s.id === ExternalUploadSource.DROPBOX_CHOOSER)?.icon).toBe(ExternalUploadSource.DROPBOX);
  });
});
