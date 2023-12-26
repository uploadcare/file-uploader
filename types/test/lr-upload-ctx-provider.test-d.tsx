import { expectType } from 'tsd';
import { EventMap, UploadCtxProvider } from '../../index.js';
import { useRef } from 'react';

const instance = new UploadCtxProvider();

instance.addFileFromUrl('https://example.com/image.png');
instance.uploadCollection.size;
instance.setOrAddState('fileId', 'uploading');

instance.addEventListener('change', (e) => {
  expectType<EventMap['change']>(e);
});

const onChange = (e: EventMap['change']) => {
  const state = e.detail;
  if (state.isSuccess) {
    expectType<'success'>(state.status);
  }

  if (state.isFailed) {
    state.errors.forEach((error) => {
      if (error.type === 'TOO_FEW_FILES') {
        error.total;
      }
    });
  }
};

instance.addEventListener('change', onChange);

() => {
  const ref = useRef<InstanceType<UploadCtxProvider>>(null);
  return <lr-upload-ctx-provider ctx-name="ctx" ref={ref}></lr-upload-ctx-provider>;
};
