import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UploadCollectionController } from '../../abstract/controllers/UploadCollectionController';
import type { Uid } from '../../abstract/Uid';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { Thumb } from './Thumb';

// Every CDN thumbnail load is held until the test settles it, by the size in its url.
const mocks = vi.hoisted(() => ({
  loads: new Map<number, { resolve: () => void; reject: (reason: Error) => void }>(),
}));

vi.mock('../../utils/preloadImage', () => ({
  preloadImage: (src: string) => ({
    promise: new Promise<void>((resolve, reject) => {
      const size = Number(/scale_crop\/(\d+)x/.exec(src)?.[1]);
      if (size) mocks.loads.set(size, { resolve, reject });
    }),
    image: new Image(),
    cancel: () => {},
  }),
}));

Thumb.reg('uc-thumb');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];
let resize: () => void = () => {};

beforeEach(() => {
  mocks.loads.clear();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      public constructor(callback: () => void) {
        resize = callback;
      }
      public observe(): void {}
      public disconnect(): void {}
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) UploaderRegistry.dispose(name);
});

const uuid = 'c2499162-eb07-4b93-b31e-94a89a47e858';

/** A thumb of an uploaded image, in a box of `side` px that `setSide` resizes. */
const setup = async (side: number) => {
  const ctxName = `thumb-resize-spec-${seq++}`;
  ctxNames.push(ctxName);
  ensureUploaderCtx(ctxName);
  const collection = UploaderRegistry.get(ctxName)?.get(UploadCollectionController);
  if (!collection) throw new Error('collection controller not resolved');
  const el = document.createElement('uc-thumb') as Thumb;
  el.setAttribute('ctx-name', ctxName);
  const box = { side };
  vi.spyOn(el, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, box.side, box.side));
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  const uid = collection.add({ fileInfo: { uuid } as never, isImage: true, uuid, cdnUrlModifiers: null });
  el.uid = uid as Uid;
  const setSide = (next: number) => {
    box.side = next;
    resize();
  };
  const storedSize = () => Number(/scale_crop\/(\d+)x/.exec(collection.readProp(uid, 'thumbUrl') ?? '')?.[1] ?? 0);
  const held = (size: number) => {
    const load = mocks.loads.get(size);
    if (!load) throw new Error(`no thumbnail of ${size}px was requested`);
    return load;
  };
  const load = (size: number) => held(size).resolve();
  const fail = (size: number) => held(size).reject(new Error('cdn down'));
  return { setSide, storedSize, load, fail };
};

const requested = (size: number) => vi.waitFor(() => expect(mocks.loads.has(size)).toBe(true));

describe('Thumb in a box that changes size', () => {
  it('asks for a larger thumbnail when the box grows', async () => {
    const { setSide, storedSize, load } = await setup(80);
    await requested(80);

    setSide(120);
    await requested(120);
    load(120);

    await vi.waitFor(() => expect(storedSize()).toBe(120));
  });

  it('keeps the thumbnail it has when the box shrinks', async () => {
    const { setSide, storedSize, load } = await setup(120);
    await requested(120);
    load(120);
    await vi.waitFor(() => expect(storedSize()).toBe(120));

    vi.useFakeTimers();
    setSide(80);
    // Past the 100 ms a request waits before it goes out.
    await vi.advanceTimersByTimeAsync(1000);

    expect(mocks.loads.has(80)).toBe(false);
  });

  it('keeps the larger thumbnail when the smaller one it replaced loads last', async () => {
    const { setSide, storedSize, load } = await setup(80);
    await requested(80);

    setSide(120);
    await requested(120);
    load(120);
    await vi.waitFor(() => expect(storedSize()).toBe(120));

    load(80);
    // The box grows once more: by the time that request is out, the late load of 80 has been handled.
    setSide(200);
    await requested(200);

    expect(storedSize()).toBe(120);
  });

  it('shows the smaller thumbnail when the larger one fails to load', async () => {
    const { setSide, storedSize, load, fail } = await setup(80);
    await requested(80);

    setSide(120);
    await requested(120);
    fail(120);
    load(80);

    await vi.waitFor(() => expect(storedSize()).toBe(80));
  });
});
