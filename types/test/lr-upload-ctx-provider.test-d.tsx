import { expectType } from 'tsd';
import { EventMap, UploadCtxProvider } from '../../index.js';
import { useRef } from 'react';

const instance = new UploadCtxProvider();

instance.addFileFromUrl('https://example.com/image.png');
instance.uploadCollection.size;
instance.setOrAddState('fileId', 'uploading');

instance.addEventListener('data-output', (e) => {
  expectType<EventMap['data-output']>(e);

  // @ts-expect-error - wrong event type
  expectType<EventMap['init-flow']>(e);
});

const onDataOutput = (e: EventMap['data-output']) => {
  // noop
};

instance.addEventListener('data-output', onDataOutput);

() => {
  const ref = useRef<InstanceType<UploadCtxProvider>>(null);
  return <lr-upload-ctx-provider ctx-name="ctx" ref={ref}></lr-upload-ctx-provider>;
};
