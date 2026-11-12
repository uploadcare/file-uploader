import { test } from 'vitest';
import type { PluginUploaderApi } from '../../dist/index';

/** The plugin docs open an activity whose params are all optional with `uploaderApi.navigate('my-activity')`. */
declare module '../../dist/index' {
  interface CustomActivities {
    'optional-activity': { params: { fileId?: string } };
  }
}

declare const uploaderApi: PluginUploaderApi;

test('an activity whose params are all optional opens without them', () => {
  uploaderApi.navigate('optional-activity');
  uploaderApi.navigate('optional-activity', { fileId: 'x' });
  uploaderApi.setCurrentActivity('optional-activity');
  // @ts-expect-error unknown param
  uploaderApi.navigate('optional-activity', { nope: 1 });
});
