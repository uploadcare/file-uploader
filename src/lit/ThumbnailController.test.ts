import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { UploadCollectionController } from '../abstract/controllers/UploadCollectionController';
import { ControllerContainer } from '../abstract/di/ControllerContainer';
import { delay } from '../utils/delay';
import { queueThumbnail } from '../utils/thumbnail-queue';
import { ThumbnailController } from './ThumbnailController';

const mocks = vi.hoisted(() => ({ generateThumb: vi.fn<(file: Blob, size?: number) => Promise<string>>() }));

vi.mock('../utils/resizeImage', () => ({ generateThumb: mocks.generateThumb }));

const file = new File(['x'], 'a.png', { type: 'image/png' });

let container: ControllerContainer;
let revoke: MockInstance<typeof URL.revokeObjectURL>;
/** Drawings the test started and left unsettled, finished afterwards so the page's queue is empty for the next test. */
let drawings: PromiseWithResolvers<string>[];

beforeEach(() => {
  container = new ControllerContainer();
  drawings = [];
  mocks.generateThumb.mockReset();
  mocks.generateThumb.mockImplementation(() => {
    const drawing = Promise.withResolvers<string>();
    drawings.push(drawing);
    return drawing.promise;
  });
  revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(async () => {
  for (const drawing of drawings) drawing.resolve('blob:late');
  await delay(0);
  if (!container.disposed) container.dispose();
});

const setup = () => {
  const collection = container.get(UploadCollectionController);
  const uid = collection.add({ file });
  const entry = collection.read(uid);
  if (!entry) throw new Error('entry not added');
  return { thumbnails: container.get(ThumbnailController), collection, uid, entry };
};

/** Takes the page's four drawing slots, so the next drawing waits. Returns what frees them. */
const fillQueue = () => {
  const busy = Promise.withResolvers<void>();
  const taken = [1, 2, 3, 4].map(() => queueThumbnail(() => busy.promise));
  return async () => {
    busy.resolve();
    await Promise.all(taken);
  };
};

describe('ThumbnailController.draw', () => {
  it('draws once for every thumb asking for the same entry, and stores the result', async () => {
    const { thumbnails, entry } = setup();

    const first = thumbnails.draw(entry, file, 40, new AbortController().signal);
    const second = thumbnails.draw(entry, file, 80, new AbortController().signal);
    drawings[0]?.resolve('blob:drawn');
    await Promise.all([first, second]);

    expect(mocks.generateThumb).toHaveBeenCalledOnce();
    expect(mocks.generateThumb).toHaveBeenCalledWith(file, 40);
    expect(entry.get('thumbUrl')).toBe('blob:drawn');
  });

  it('finishes a started drawing after its thumb is gone, and the next thumb joins it', async () => {
    const { thumbnails, entry } = setup();
    const gone = new AbortController();

    const first = thumbnails.draw(entry, file, 40, gone.signal);
    gone.abort();
    const second = thumbnails.draw(entry, file, 40, new AbortController().signal);
    drawings[0]?.resolve('blob:drawn');
    await Promise.all([first, second]);

    expect(mocks.generateThumb).toHaveBeenCalledOnce();
    expect(entry.get('thumbUrl')).toBe('blob:drawn');
  });

  it('keeps a waiting drawing while one of its thumbs still waits', async () => {
    const { thumbnails, entry } = setup();
    const freeQueue = fillQueue();
    const gone = new AbortController();

    const first = thumbnails.draw(entry, file, 40, gone.signal);
    const second = thumbnails.draw(entry, file, 40, new AbortController().signal);
    gone.abort();
    await freeQueue();
    drawings[0]?.resolve('blob:drawn');
    await Promise.all([first, second]);

    expect(entry.get('thumbUrl')).toBe('blob:drawn');
  });

  it('drops a waiting drawing once every thumb that asked is gone', async () => {
    const { thumbnails, entry } = setup();
    const freeQueue = fillQueue();
    const [one, other] = [new AbortController(), new AbortController()];

    const dropped = Promise.allSettled([
      thumbnails.draw(entry, file, 40, one.signal),
      thumbnails.draw(entry, file, 40, other.signal),
    ]);
    one.abort();
    other.abort();
    await freeQueue();

    const aborted = { status: 'rejected', reason: expect.objectContaining({ name: 'AbortError' }) };
    expect(await dropped).toEqual([aborted, aborted]);
    expect(mocks.generateThumb).not.toHaveBeenCalled();
  });

  it('draws for a thumb that asks again in the task its drawing was dropped in', async () => {
    const { thumbnails, entry } = setup();
    const freeQueue = fillQueue();
    const gone = new AbortController();

    const dropped = thumbnails.draw(entry, file, 40, gone.signal);
    gone.abort();
    const again = thumbnails.draw(entry, file, 40, new AbortController().signal);
    await expect(dropped).rejects.toMatchObject({ name: 'AbortError' });
    await freeQueue();
    drawings[0]?.resolve('blob:drawn');
    await again;

    expect(entry.get('thumbUrl')).toBe('blob:drawn');
  });

  it('rejects when drawing fails, and draws again for the next thumb', async () => {
    const { thumbnails, entry } = setup();
    const failure = new Error('decode');

    const failed = thumbnails.draw(entry, file, 40, new AbortController().signal);
    drawings[0]?.reject(failure);
    await expect(failed).rejects.toBe(failure);
    const retried = thumbnails.draw(entry, file, 40, new AbortController().signal);
    drawings[1]?.resolve('blob:drawn');
    await retried;

    expect(entry.get('thumbUrl')).toBe('blob:drawn');
  });
});

describe('ThumbnailController.store', () => {
  it('revokes the object url it replaces', () => {
    const { thumbnails, entry } = setup();

    thumbnails.store(entry, 'blob:local');
    thumbnails.store(entry, 'https://ucarecdn.com/thumb/');

    expect(entry.get('thumbUrl')).toBe('https://ucarecdn.com/thumb/');
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:local');
  });

  it('leaves alone a url it did not store', () => {
    const { thumbnails, entry } = setup();
    entry.set('thumbUrl', 'blob:foreign');

    thumbnails.store(entry, 'https://ucarecdn.com/thumb/');

    expect(revoke).not.toHaveBeenCalled();
  });

  it('revokes the object url of an entry once it is removed', async () => {
    const { thumbnails, collection, uid, entry } = setup();
    thumbnails.store(entry, 'blob:local');

    collection.remove(uid);
    // The collection reports a removal on its next flush.
    await delay(0);

    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:local');
  });

  it('revokes an object url that arrives after its entry was removed, and leaves the entry as it was', async () => {
    const { thumbnails, collection, uid, entry } = setup();
    const drawn = thumbnails.draw(entry, file, 40, new AbortController().signal);

    collection.remove(uid);
    await delay(0);
    drawings[0]?.resolve('blob:late-drawn');
    await drawn;

    expect(entry.get('thumbUrl')).toBeNull();
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:late-drawn');
  });

  it('revokes every object url it stored once the uploader is destroyed', () => {
    const { thumbnails, collection, entry } = setup();
    const other = collection.read(collection.add({ file }));
    if (!other) throw new Error('entry not added');
    thumbnails.store(entry, 'blob:one');
    thumbnails.store(other, 'blob:other');

    container.dispose();

    expect(revoke.mock.calls).toEqual([['blob:one'], ['blob:other']]);
  });

  it('revokes an object url that arrives after the uploader was destroyed', async () => {
    const { thumbnails, entry } = setup();
    const drawn = thumbnails.draw(entry, file, 40, new AbortController().signal);

    container.dispose();
    drawings[0]?.resolve('blob:late-drawn');
    await drawn;

    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:late-drawn');
  });
});
