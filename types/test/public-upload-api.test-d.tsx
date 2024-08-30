import { UploadCtxProvider } from '../../index.js';

const instance = new UploadCtxProvider();
const api = instance.getAPI();

api.addFileFromUrl('https://example.com/image.png');

api.setCurrentActivity('camera');
api.setCurrentActivity('cloud-image-edit', { internalId: 'id' });
api.setCurrentActivity('external', {
  externalSourceType: 'type',
});

// @ts-expect-error - should not allow to set activity without params
api.setCurrentActivity('cloud-image-edit');
// @ts-expect-error - should not allow to set activity without params
api.setCurrentActivity('external');

// @ts-expect-error - should not allow to set activity with invalid params
api.setCurrentActivity('camera', {
  invalidParam: 'value',
});
api.setCurrentActivity('cloud-image-edit', {
  // @ts-expect-error - should not allow to set activity with invalid params
  invalidParam: 'value',
});
api.setCurrentActivity('external', {
  // @ts-expect-error - should not allow to set activity with invalid params
  invalidParam: 'value',
});

// should allow to set some custom activity
api.setCurrentActivity('my-custom-activity');
api.setCurrentActivity('my-custom-activity', { myCustomParam: 'value' });
