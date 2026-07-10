import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SharedInstancesBag } from '../../lit/shared-instances';
import { sharedConfigKey } from '../sharedConfigKey';
import { ClipboardLayer, type PasteScope } from './ClipboardLayer';

type FakeItem =
  | { kind: 'file'; type?: string; getAsFile: () => File | null }
  | { kind: 'string'; type: string; getAsString: (cb: (text: string) => void) => void };

const fileItem = (file: File | null): FakeItem => ({ kind: 'file', getAsFile: () => file });
const textItem = (text: string, type = 'text/plain'): FakeItem => ({
  kind: 'string',
  type,
  getAsString: (cb) => cb(text),
});

const pasteEvent = (items: FakeItem[] | null): Event => {
  const event = new Event('paste', { bubbles: true, composed: true });
  Object.defineProperty(event, 'clipboardData', {
    value: items === null ? null : { items },
  });
  return event;
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const setup = ({ pasteScope, currentActivity = null }: { pasteScope: PasteScope; currentActivity?: string | null }) => {
  const state = new Map<string, unknown>([[sharedConfigKey('pasteScope'), pasteScope]]);
  const router = {
    currentActivity,
    traverse: vi.fn(),
  };
  const api = {
    addFileFromObject: vi.fn(),
    addFileFromUrl: vi.fn(),
  };
  const ctx = {
    has: (key: string) => state.has(key),
    read: (key: string) => state.get(key),
  };
  const bag = { ctx, router, api } as unknown as SharedInstancesBag;
  const layer = new ClipboardLayer(bag);
  return { layer, router, api };
};

const connectedScope = (tag = 'div'): Element => {
  const scope = document.createElement(tag);
  document.body.append(scope);
  return scope;
};

describe('ClipboardLayer', () => {
  const layers: ClipboardLayer[] = [];
  const track = (layer: ClipboardLayer) => {
    layers.push(layer);
    return layer;
  };

  afterEach(() => {
    for (const layer of layers.splice(0)) {
      layer.destroy();
    }
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('ignores paste entirely when pasteScope is false (default)', async () => {
    const { layer, api } = setup({ pasteScope: false, currentActivity: 'start-from' });
    track(layer);
    layer.registerBlock(connectedScope());

    window.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  it('global scope: adds pasted files with the clipboard source and runs post-add routing', async () => {
    const { layer, api, router } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    track(layer);
    layer.registerBlock(connectedScope());
    const file = new File(['x'], 'x.png');

    window.dispatchEvent(pasteEvent([fileItem(file)]));
    await flush();

    expect(api.addFileFromObject).toHaveBeenCalledWith(file, { source: 'clipboard' });
    expect(router.traverse).toHaveBeenCalledWith('onFileAdd');
  });

  it('global scope: skips a null file entry from the clipboard', async () => {
    const { layer, api } = setup({ pasteScope: 'global', currentActivity: 'upload-list' });
    track(layer);
    layer.registerBlock(connectedScope());

    window.dispatchEvent(pasteEvent([fileItem(null)]));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  it('global scope: ignores paste while a non-paste activity (camera) is open', async () => {
    const { layer, api } = setup({ pasteScope: 'global', currentActivity: 'camera' });
    track(layer);
    layer.registerBlock(connectedScope());

    window.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  it('global scope: initial state (no activity) is allowed only for the regular solution', async () => {
    const regular = setup({ pasteScope: 'global', currentActivity: null });
    track(regular.layer);
    regular.layer.registerBlock(connectedScope('uc-file-uploader-regular'));
    window.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();
    expect(regular.api.addFileFromObject).toHaveBeenCalled();
  });

  it('global scope: initial state with a non-regular scope is ignored', async () => {
    const { layer, api } = setup({ pasteScope: 'global', currentActivity: null });
    track(layer);
    layer.registerBlock(connectedScope('uc-file-uploader-minimal'));

    window.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  it('does nothing without a connected scope', async () => {
    const { layer, api } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    track(layer);
    const scope = document.createElement('div'); // never connected
    layer.registerBlock(scope);

    window.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  it('unregistering a scope stops handling', async () => {
    const { layer, api } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    track(layer);
    const unregister = layer.registerBlock(connectedScope());
    unregister();

    window.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  it('ignores paste without clipboardData', async () => {
    const { layer, api } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    track(layer);
    layer.registerBlock(connectedScope());

    window.dispatchEvent(pasteEvent(null));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  it('ignores paste into editable targets (input, contenteditable, role=textbox)', async () => {
    const { layer, api } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    track(layer);
    const scope = connectedScope();
    layer.registerBlock(scope);

    const input = document.createElement('input');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', '');
    const textbox = document.createElement('div');
    textbox.setAttribute('role', 'textbox');
    scope.append(input, editable, textbox);

    for (const el of [input, editable, textbox]) {
      el.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    }
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  it('treats contenteditable="false" as non-editable', async () => {
    const { layer, api } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    track(layer);
    const scope = connectedScope();
    layer.registerBlock(scope);
    const notEditable = document.createElement('div');
    notEditable.setAttribute('contenteditable', 'false');
    scope.append(notEditable);

    notEditable.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).toHaveBeenCalled();
  });

  it('local scope: handles paste targeted inside a registered scope', async () => {
    const { layer, api } = setup({ pasteScope: 'local', currentActivity: 'upload-list' });
    track(layer);
    const scope = connectedScope();
    layer.registerBlock(scope);
    const inner = document.createElement('span');
    scope.append(inner);

    inner.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).toHaveBeenCalled();
  });

  it('local scope: ignores paste targeted outside every scope', async () => {
    const { layer, api } = setup({ pasteScope: 'local', currentActivity: 'upload-list' });
    track(layer);
    layer.registerBlock(connectedScope());
    const outside = document.createElement('span');
    document.body.append(outside);

    outside.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  it('local scope: ignores paste whose target is not a DOM node (window)', async () => {
    const { layer, api } = setup({ pasteScope: 'local', currentActivity: 'upload-list' });
    track(layer);
    layer.registerBlock(connectedScope());

    window.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  it('local scope: allows the initial (no activity) state', async () => {
    const { layer, api } = setup({ pasteScope: 'local', currentActivity: null });
    track(layer);
    const scope = connectedScope();
    layer.registerBlock(scope);
    const inner = document.createElement('span');
    scope.append(inner);

    inner.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).toHaveBeenCalled();
  });

  it('local scope: ignores paste while a non-paste activity is open', async () => {
    const { layer, api } = setup({ pasteScope: 'local', currentActivity: 'camera' });
    track(layer);
    const scope = connectedScope();
    layer.registerBlock(scope);
    const inner = document.createElement('span');
    scope.append(inner);

    inner.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  it('adds a pasted http(s) URL via addFileFromUrl and runs post-add routing', async () => {
    const { layer, api, router } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    track(layer);
    layer.registerBlock(connectedScope());

    window.dispatchEvent(pasteEvent([textItem(' https://ucarecdn.com/image.png ', 'text/uri-list')]));
    await flush();

    expect(api.addFileFromUrl).toHaveBeenCalledWith('https://ucarecdn.com/image.png', { source: 'clipboard' });
    expect(router.traverse).toHaveBeenCalledWith('onFileAdd');
  });

  it('rejects pasted text that is not an http(s) URL (plain text, ftp, empty)', async () => {
    const { layer, api, router } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    track(layer);
    layer.registerBlock(connectedScope());

    window.dispatchEvent(pasteEvent([textItem('hello world'), textItem('ftp://host/file'), textItem('   ')]));
    await flush();

    expect(api.addFileFromUrl).not.toHaveBeenCalled();
    expect(router.traverse).not.toHaveBeenCalled();
  });

  it('ignores string items of non-text types', async () => {
    const { layer, api } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    track(layer);
    layer.registerBlock(connectedScope());

    window.dispatchEvent(pasteEvent([textItem('https://example.com/a.png', 'text/html')]));
    await flush();

    expect(api.addFileFromUrl).not.toHaveBeenCalled();
  });

  it('handles mixed file + URL pastes in one event', async () => {
    const { layer, api, router } = setup({ pasteScope: 'global', currentActivity: 'upload-list' });
    track(layer);
    layer.registerBlock(connectedScope());

    window.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.png')), textItem('https://example.com/b.png')]));
    await flush();

    expect(api.addFileFromObject).toHaveBeenCalledTimes(1);
    expect(api.addFileFromUrl).toHaveBeenCalledTimes(1);
    expect(router.traverse).toHaveBeenCalledTimes(1);
  });

  it('destroy() detaches the window listener and clears scopes', async () => {
    const { layer, api } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    layer.registerBlock(connectedScope());
    layer.destroy();

    window.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });
});
