import { test } from 'vitest';
import '../jsx';
import { UploadCtxProvider } from '../../dist/index.js';

const api = new UploadCtxProvider().getAPI();

test('setCurrentActivity takes no params for activities that have none', () => {
  api.setCurrentActivity('camera');
  // @ts-expect-error camera has no params
  api.setCurrentActivity('camera', { invalidParam: 'value' });
});

test('setCurrentActivity requires the params of cloud-image-edit and external', () => {
  api.setCurrentActivity('cloud-image-edit', { internalId: 'id' });
  api.setCurrentActivity('external', { externalSourceType: 'type' });
  // @ts-expect-error params are required
  api.setCurrentActivity('cloud-image-edit');
  // @ts-expect-error params are required
  api.setCurrentActivity('external');
});

test('setCurrentActivity rejects unknown params', () => {
  api.setCurrentActivity('cloud-image-edit', {
    // @ts-expect-error unknown param
    invalidParam: 'value',
  });
  api.setCurrentActivity('external', {
    // @ts-expect-error unknown param
    invalidParam: 'value',
  });
});
