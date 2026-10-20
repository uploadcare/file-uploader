import { describe, expect, it } from 'vitest';
import { getCtxName } from '../utils/test-renderer';
import { createTestPlugin, renderUploader } from './utils';

describe('Custom Config', () => {
  it('re-adopting <uc-config> into a plugin-less ctx does not throw when a now-stale custom-config setter is written (pluginManagerOrNull guard)', async () => {
    const plugin = createTestPlugin({
      id: 'cfg-readopt',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerConfig({ name: 'readoptOption', defaultValue: 'a' });
      },
    });
    const { config } = await renderUploader([plugin]);
    await expect.poll(() => config.readoptOption).toBe('a');

    // Re-adopt the `<uc-config>` alone into a brand-new, plugin-less ctx (the
    // solution/provider stay on the original ctx). `*pluginManager` is absent
    // there, but the `readoptOption` accessor defined during the original
    // adoption survives on the instance and `_customConfigKeys` stays stale
    // (the new ctx never runs `_processCustomConfigs`). Writing the property
    // therefore routes `_setValue` -> `_getCustomConfigDefinition`, which reads
    // the plugin manager: before the fix `bag.pluginManager` threw
    // synchronously here; `pluginManagerOrNull` returns null so the write is a
    // tolerated no-op.
    const ctxNameB = getCtxName();
    config.setAttribute('ctx-name', ctxNameB);
    await config.updateComplete;

    expect(() => {
      config.readoptOption = 'b';
    }).not.toThrow();
  });
});

declare module '@/types/index' {
  interface CustomConfig {
    readableOption: number;
    subscribedOption: string;
    attrOption: string;
    cleanupOption: string;
    jsPropOption: boolean;
    noAttrOption: string;
    myOption: string;
    dupOption: string;
    normalizedOption: number;
    syncGetOption: string;
    syncSubscribeOption: string;
    removableAttrOption: string;
    throwingNormOption: string;
    preAssignedProp: string;
    lateAssignedProp: string;
    preAttrOption: string;
    readoptOption: string;
  }
}
