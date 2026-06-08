import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfigController } from './ConfigController';
import { ClipboardController } from './ClipboardController';
import type { RouterController } from './RouterController';
import type { UploadCollectionController } from './UploadCollectionController';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

type Harness = {
  controller: ClipboardController;
  scope: HTMLElement;
  addFile: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
  cleanup: () => void;
};

function makeHarness(pasteScope: unknown, activity: string | null = null): Harness {
  const addFile = vi.fn();
  const navigate = vi.fn();
  const config = { values: { pasteScope } } as unknown as ConfigController;
  const collection = { addFile, addFileFromUrl: vi.fn() } as unknown as UploadCollectionController;
  const router = { get modal() {
    return null;
  }, get activity() {
    return activity;
  }, navigate } as unknown as RouterController;

  const controller = new ClipboardController(config, collection, router);
  const scope = document.createElement('uc-uploader-regular');
  document.body.appendChild(scope);
  const unregister = controller.registerScope(scope);

  return {
    controller,
    scope,
    addFile,
    navigate,
    cleanup: () => {
      unregister();
      controller.destroy();
      scope.remove();
    },
  };
}

function pasteFileInto(target: EventTarget, file: File): void {
  const dt = new DataTransfer();
  dt.items.add(file);
  target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, composed: true }));
}

const PNG = () => new File(['x'], 'pasted.png', { type: 'image/png' });

describe('ClipboardController', () => {
  let active: Harness | undefined;
  afterEach(() => {
    active?.cleanup();
    active = undefined;
  });

  it('adds a pasted file and routes to the upload list (local scope, initial activity)', async () => {
    active = makeHarness('local', null);
    pasteFileInto(active.scope, PNG());
    await flush();
    expect(active.addFile).toHaveBeenCalledTimes(1);
    expect(active.addFile.mock.calls[0]?.[1]).toMatchObject({ source: 'clipboard' });
    expect(active.navigate).toHaveBeenCalledWith('upload-list');
  });

  it('ignores paste when pasteScope is false', async () => {
    active = makeHarness(false, 'start-from');
    pasteFileInto(active.scope, PNG());
    await flush();
    expect(active.addFile).not.toHaveBeenCalled();
  });

  it('ignores paste into an editable target', async () => {
    active = makeHarness('local', 'start-from');
    const input = document.createElement('input');
    active.scope.appendChild(input);
    pasteFileInto(input, PNG());
    await flush();
    expect(active.addFile).not.toHaveBeenCalled();
  });

  it('stops listening after the last scope unregisters', async () => {
    active = makeHarness('global', 'upload-list');
    active.controller.destroy();
    pasteFileInto(window, PNG());
    await flush();
    expect(active.addFile).not.toHaveBeenCalled();
  });
});
