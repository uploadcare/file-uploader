import { describe, expect, it, vi } from 'vitest';
import { ControllerContainer } from '../di/ControllerContainer';
import { UploaderEventType } from '../EventBus';
import { EventEmitter } from '../EventEmitter';
import { UploadCollectionController } from './UploadCollectionController';
import { UploadFileEventsController } from './UploadFileEventsController';

const setup = () => {
  const container = new ControllerContainer();
  const emit = vi.fn();
  container.bind(EventEmitter, () => ({ emit }) as unknown as EventEmitter);
  const collection = container.get(UploadCollectionController);
  const events = container.get(UploadFileEventsController);
  const urlEmits = () => emit.mock.calls.filter(([type]) => type === UploaderEventType.FILE_URL_CHANGED);
  return { collection, events, urlEmits };
};

describe('UploadFileEventsController.urlChanged', () => {
  it('reports a URL once, though a later flush names the file again (cropPreset sets it mid-flush)', () => {
    const t = setup();
    const uid = t.collection.add({ fileName: 'a.jpg' });
    t.collection.read(uid)!.set('cdnUrl', 'https://ucarecdn.com/x/-/crop/1x1/0,0/');

    t.events.urlChanged([uid]);
    t.events.urlChanged([uid]);

    expect(t.urlEmits()).toHaveLength(1);
  });

  it('reports each new URL of a file', () => {
    const t = setup();
    const uid = t.collection.add({ fileName: 'a.jpg' });
    const entry = t.collection.read(uid)!;

    entry.set('cdnUrl', 'https://ucarecdn.com/x/');
    t.events.urlChanged([uid]);
    entry.set('cdnUrl', 'https://ucarecdn.com/x/-/rotate/90/');
    t.events.urlChanged([uid]);

    expect(t.urlEmits()).toHaveLength(2);
  });
});
