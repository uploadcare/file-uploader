import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ActivityId } from '../../lit/activity-constants';
import { ClipboardController, type PasteScope } from './ClipboardController';

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
  const api = {
    addFileFromObject: vi.fn(),
    addFileFromUrl: vi.fn(),
  };
  const onFileAdd = vi.fn();
  const layer = new ClipboardController({
    getPasteScope: () => pasteScope,
    getCurrentActivity: () => currentActivity as ActivityId | null,
    addFileFromObject: api.addFileFromObject,
    addFileFromUrl: api.addFileFromUrl,
    onFileAdd,
  });
  return { layer, api, onFileAdd };
};

const connectedScope = (tag = 'div'): Element => {
  const scope = document.createElement(tag);
  document.body.append(scope);
  return scope;
};

describe('ClipboardController', () => {
  const layers: ClipboardController[] = [];
  const track = (layer: ClipboardController) => {
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
    layer.registerScope(connectedScope());

    window.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  it('global scope: adds pasted files with the clipboard source and runs post-add routing', async () => {
    const { layer, api, onFileAdd } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    track(layer);
    layer.registerScope(connectedScope());
    const file = new File(['x'], 'x.png');

    window.dispatchEvent(pasteEvent([fileItem(file)]));
    await flush();

    expect(api.addFileFromObject).toHaveBeenCalledWith(file, { source: 'clipboard' });
    expect(onFileAdd).toHaveBeenCalled();
  });

  it('global scope: skips a null file entry from the clipboard', async () => {
    const { layer, api } = setup({ pasteScope: 'global', currentActivity: 'upload-list' });
    track(layer);
    layer.registerScope(connectedScope());

    window.dispatchEvent(pasteEvent([fileItem(null)]));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  it('global scope: ignores paste while a non-paste activity (camera) is open', async () => {
    const { layer, api } = setup({ pasteScope: 'global', currentActivity: 'camera' });
    track(layer);
    layer.registerScope(connectedScope());

    window.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  it('global scope: initial state (no activity) is allowed only for the regular solution', async () => {
    const regular = setup({ pasteScope: 'global', currentActivity: null });
    track(regular.layer);
    regular.layer.registerScope(connectedScope('uc-file-uploader-regular'));
    window.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();
    expect(regular.api.addFileFromObject).toHaveBeenCalled();
  });

  it('global scope: initial state with a non-regular scope is ignored', async () => {
    const { layer, api } = setup({ pasteScope: 'global', currentActivity: null });
    track(layer);
    layer.registerScope(connectedScope('uc-file-uploader-minimal'));

    window.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  it('does nothing without a connected scope', async () => {
    const { layer, api } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    track(layer);
    const scope = document.createElement('div'); // never connected
    layer.registerScope(scope);

    window.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  it('unregistering a scope stops handling', async () => {
    const { layer, api } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    track(layer);
    const unregister = layer.registerScope(connectedScope());
    unregister();

    window.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  it('ignores paste without clipboardData', async () => {
    const { layer, api } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    track(layer);
    layer.registerScope(connectedScope());

    window.dispatchEvent(pasteEvent(null));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  it('ignores paste into editable targets (input, contenteditable, role=textbox)', async () => {
    const { layer, api } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    track(layer);
    const scope = connectedScope();
    layer.registerScope(scope);

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
    layer.registerScope(scope);
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
    layer.registerScope(scope);
    const inner = document.createElement('span');
    scope.append(inner);

    inner.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).toHaveBeenCalled();
  });

  it('local scope: ignores paste targeted outside every scope', async () => {
    const { layer, api } = setup({ pasteScope: 'local', currentActivity: 'upload-list' });
    track(layer);
    layer.registerScope(connectedScope());
    const outside = document.createElement('span');
    document.body.append(outside);

    outside.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  it('local scope: ignores paste whose target is not a DOM node (window)', async () => {
    const { layer, api } = setup({ pasteScope: 'local', currentActivity: 'upload-list' });
    track(layer);
    layer.registerScope(connectedScope());

    window.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  it('local scope: allows the initial (no activity) state', async () => {
    const { layer, api } = setup({ pasteScope: 'local', currentActivity: null });
    track(layer);
    const scope = connectedScope();
    layer.registerScope(scope);
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
    layer.registerScope(scope);
    const inner = document.createElement('span');
    scope.append(inner);

    inner.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  it('adds a pasted http(s) URL via addFileFromUrl and runs post-add routing', async () => {
    const { layer, api, onFileAdd } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    track(layer);
    layer.registerScope(connectedScope());

    window.dispatchEvent(pasteEvent([textItem(' https://ucarecdn.com/image.png ', 'text/uri-list')]));
    await flush();

    expect(api.addFileFromUrl).toHaveBeenCalledWith('https://ucarecdn.com/image.png', { source: 'clipboard' });
    expect(onFileAdd).toHaveBeenCalled();
  });

  it('rejects pasted text that is not an http(s) URL (plain text, ftp, empty)', async () => {
    const { layer, api, onFileAdd } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    track(layer);
    layer.registerScope(connectedScope());

    window.dispatchEvent(pasteEvent([textItem('hello world'), textItem('ftp://host/file'), textItem('   ')]));
    await flush();

    expect(api.addFileFromUrl).not.toHaveBeenCalled();
    expect(onFileAdd).not.toHaveBeenCalled();
  });

  it('ignores string items of non-text types', async () => {
    const { layer, api } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    track(layer);
    layer.registerScope(connectedScope());

    window.dispatchEvent(pasteEvent([textItem('https://example.com/a.png', 'text/html')]));
    await flush();

    expect(api.addFileFromUrl).not.toHaveBeenCalled();
  });

  it('handles mixed file + URL pastes in one event', async () => {
    const { layer, api, onFileAdd } = setup({ pasteScope: 'global', currentActivity: 'upload-list' });
    track(layer);
    layer.registerScope(connectedScope());

    window.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.png')), textItem('https://example.com/b.png')]));
    await flush();

    expect(api.addFileFromObject).toHaveBeenCalledTimes(1);
    expect(api.addFileFromUrl).toHaveBeenCalledTimes(1);
    expect(onFileAdd).toHaveBeenCalledTimes(1);
  });

  it('contains a rejection from an injected add-file dep (warns instead of unhandled rejection)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { layer, api } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    track(layer);
    layer.registerScope(connectedScope());
    api.addFileFromObject.mockImplementation(() => {
      throw new Error('boom');
    });

    window.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(warn).toHaveBeenCalledWith('[uc] clipboard paste handling failed', expect.any(Error));
  });

  it('destroy() detaches the window listener and clears scopes', async () => {
    const { layer, api } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    layer.registerScope(connectedScope());
    layer.destroy();

    window.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  // Gap-fill ahead of M9l's lazy-arm split: a fresh instance with
  // `registerScope` never called even once (not merely with a disconnected
  // scope) — this is exactly the shape a config-only ctx produces
  // (`UploaderController` constructs `*clipboard` unconditionally;
  // `registerScope` only runs from `LitSolutionBlock`/`CloudImageEditor`
  // `initCallback`). Pins the load-bearing fact behind arm-on-registration:
  // `_hasConnectedScope()` over an empty `Set` is unconditionally `false`, so
  // `_handlePasteEvent` bails before any side effect.
  it('a never-registered instance is inert on a real window paste event', async () => {
    const { layer, api, onFileAdd } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    track(layer);

    window.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.png'))]));
    await flush();

    expect(api.addFileFromObject).not.toHaveBeenCalled();
    expect(api.addFileFromUrl).not.toHaveBeenCalled();
    expect(onFileAdd).not.toHaveBeenCalled();
  });

  it('construction attaches no window listener (arming is deferred to first registerScope)', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');

    track(setup({ pasteScope: 'global', currentActivity: 'start-from' }).layer);

    const pasteAdds = addSpy.mock.calls.filter((call) => call[0] === 'paste');
    expect(pasteAdds).toHaveLength(0);
  });

  it('arms exactly once across multiple registerScope calls (idempotent)', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const { layer } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    track(layer);

    layer.registerScope(connectedScope());
    layer.registerScope(connectedScope());
    layer.registerScope(connectedScope());

    const pasteAdds = addSpy.mock.calls.filter((call) => call[0] === 'paste');
    expect(pasteAdds).toHaveLength(1);
  });

  it('disarms only once the last registered scope is unregistered', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { layer } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    track(layer);

    const unregisterA = layer.registerScope(connectedScope());
    const unregisterB = layer.registerScope(connectedScope());

    unregisterA();
    expect(removeSpy.mock.calls.filter((call) => call[0] === 'paste')).toHaveLength(0);

    unregisterB();
    expect(removeSpy.mock.calls.filter((call) => call[0] === 'paste')).toHaveLength(1);
  });

  it('re-arms after a full disarm + re-registration cycle (scopes can cycle 0 → 1 → 0 → 1)', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const { layer, api } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    track(layer);

    const unregisterFirst = layer.registerScope(connectedScope());
    unregisterFirst();

    layer.registerScope(connectedScope());
    window.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();

    expect(api.addFileFromObject).toHaveBeenCalled();
    // Precision over the functional re-arm assertion above: the double cycle
    // (arm → disarm → re-arm) must add the `paste` listener exactly twice —
    // once per arm — not merely "at least once".
    expect(addSpy.mock.calls.filter((call) => call[0] === 'paste')).toHaveLength(2);
  });

  it('destroy() disarms unconditionally, and registrations after destroy() do not re-arm', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const { layer, api } = setup({ pasteScope: 'global', currentActivity: 'start-from' });

    layer.registerScope(connectedScope());
    layer.destroy();
    addSpy.mockClear();

    layer.registerScope(connectedScope());
    const pasteAdds = addSpy.mock.calls.filter((call) => call[0] === 'paste');
    expect(pasteAdds).toHaveLength(0);

    window.dispatchEvent(pasteEvent([fileItem(new File(['x'], 'x.txt'))]));
    await flush();
    expect(api.addFileFromObject).not.toHaveBeenCalled();
  });

  it('default eventTarget (window) is dereferenced lazily at arm time, not at construction', () => {
    // Constructing with no injected eventTarget must not touch `window` at
    // all until the first registerScope arms the listener.
    const addSpy = vi.spyOn(window, 'addEventListener');
    const layer = new ClipboardController({
      getPasteScope: () => 'global',
      getCurrentActivity: () => null,
      addFileFromObject: vi.fn(),
      addFileFromUrl: vi.fn(),
      onFileAdd: vi.fn(),
    });
    track(layer);

    expect(addSpy.mock.calls.filter((call) => call[0] === 'paste')).toHaveLength(0);

    layer.registerScope(connectedScope());
    expect(addSpy.mock.calls.filter((call) => call[0] === 'paste')).toHaveLength(1);
  });

  it('the window paste listener add/remove count returns to baseline across a full construct → registerScope → unregister → destroy() cycle', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    // Pins pairing, not timing: whether `addEventListener('paste', ...)` fires
    // at construction (v1) or on first `registerScope` (M9l's lazy-arm split,
    // current), the net effect of a full lifecycle must be that every
    // `paste` listener this instance added is removed by the time `destroy()`
    // returns — no leaked window listener survives the cycle.
    const { layer } = setup({ pasteScope: 'global', currentActivity: 'start-from' });
    const unregister = layer.registerScope(connectedScope());
    unregister();
    layer.destroy();

    const pasteAdds = addSpy.mock.calls.filter((call) => call[0] === 'paste').map((call) => call[1]);
    const pasteRemoves = removeSpy.mock.calls.filter((call) => call[0] === 'paste').map((call) => call[1]);

    expect(pasteAdds.length).toBeGreaterThan(0);
    expect(pasteRemoves).toEqual(pasteAdds);
  });
});
