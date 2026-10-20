import '../jsx';
import React from 'react';
import { expectTypeOf, test } from 'vitest';
import type { ActivityType, Config, PluginConfigApi, UploadCtxProvider } from '../../dist/index';

/**
 * The two documented extension points: `CustomConfig` (customConfigOptions.ts) for plugin options, and
 * `CustomActivities` (LitActivityBlock.ts) for plugin activities. Augmenting them must flow into the api types.
 *
 * The type tests compile as one program, so this augmentation is visible to the other files too.
 */
declare module '../../dist/index' {
  interface CustomConfig {
    myOption: number;
  }
  interface CustomActivities {
    'my-activity': { params: { id: string } };
    'bare-activity': { params: never };
  }
}

declare const configApi: PluginConfigApi;
declare const config: Config;
declare const api: ReturnType<UploadCtxProvider['getAPI']>;

test('a custom option is readable through the plugin config api with its declared type', () => {
  expectTypeOf(configApi.get('myOption')).toEqualTypeOf<number>();
  configApi.subscribe('myOption', (value) => {
    expectTypeOf(value).toEqualTypeOf<number>();
  });
});

test('a custom option is a typed property of the <uc-config> element', () => {
  expectTypeOf(config.myOption).toEqualTypeOf<number>();
});

test('a custom activity is a valid activity, with its params enforced', () => {
  expectTypeOf<'my-activity'>().toExtend<ActivityType>();
  api.setCurrentActivity('my-activity', { id: 'x' });
  api.setCurrentActivity('bare-activity');
  // @ts-expect-error params are required
  api.setCurrentActivity('my-activity');
  // @ts-expect-error unknown param
  api.setCurrentActivity('my-activity', { id: 'x', nope: 1 });
  // @ts-expect-error unregistered activity
  api.setCurrentActivity('not-registered');
});

test('QUIRK(types): a custom option is not accepted as a <uc-config> JSX attribute', () => {
  // `Config.attributesMeta` is built from `ConfigPlainType` alone (Config.ts) while the runtime reads custom options
  // from attributes too (Config._processCustomConfigs). Pinned as current behaviour, not endorsed.
  // @ts-expect-error custom options are missing from the JSX attributes
  () => <uc-config ctx-name="x" myOption={1}></uc-config>;
});
