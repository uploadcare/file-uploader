import '../jsx';
import React from 'react';
import { expectAssignable, expectType } from 'tsd';
import type { ActivityType, Config, PluginConfigApi, UploadCtxProvider } from '../../dist/index';

/**
 * The two documented extension points: `CustomConfig` (customConfigOptions.ts) for plugin options, and
 * `CustomActivities` (LitActivityBlock.ts) for plugin activities. Augmenting them must flow into the api types.
 *
 * tsd compiles every test file into one program, so this augmentation is visible to the other files too.
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

// A custom option is readable through the plugin config api with its declared type.
declare const configApi: PluginConfigApi;
expectType<number>(configApi.get('myOption'));
configApi.subscribe('myOption', (value) => {
  expectType<number>(value);
});

// A custom activity is a valid activity, with its params enforced.
expectAssignable<ActivityType>('my-activity');
declare const api: ReturnType<UploadCtxProvider['getAPI']>;
api.setCurrentActivity('my-activity', { id: 'x' });
api.setCurrentActivity('bare-activity');
// @ts-expect-error params are required
api.setCurrentActivity('my-activity');
// @ts-expect-error unknown param
api.setCurrentActivity('my-activity', { id: 'x', nope: 1 });
// @ts-expect-error unregistered activity
api.setCurrentActivity('not-registered');

// A custom option is a typed property of the `<uc-config>` element.
declare const config: Config;
expectType<number>(config.myOption);

// QUIRK(types): the same option is not accepted as a `<uc-config>` JSX attribute, because `Config.attributesMeta` is
// built from `ConfigPlainType` alone (Config.ts) while the runtime reads custom options from attributes too
// (Config._processCustomConfigs). Pinned as current behaviour, not endorsed.
// @ts-expect-error custom options are missing from the JSX attributes
() => <uc-config ctx-name="x" myOption={1}></uc-config>;
