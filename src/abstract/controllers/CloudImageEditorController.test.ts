import { describe, expect, it, vi } from 'vitest';
import { TabId } from '../../blocks/CloudImageEditor/src/toolbar-constants';
import { CloudImageEditorController } from './CloudImageEditorController';

describe('CloudImageEditorController', () => {
  it('seeds the cross-cutting defaults', () => {
    const controller = new CloudImageEditorController();
    expect(controller.get('*originalUrl')).toBeNull();
    expect(controller.get('*networkProblems')).toBe(false);
    expect(controller.get('*tabId')).toBe(TabId.CROP);
    expect(controller.get('*editorTransformations')).toEqual({});
    expect(controller.get('*colorPreview')).toBeNull();
    expect(controller.get('*imgContainerEl')).toBeNull();
    expect(controller.state).toBe(controller.getState());
  });

  it('accepts a partial initial state overriding only the given keys', () => {
    const controller = new CloudImageEditorController({ '*tabId': TabId.FILTERS, '*networkProblems': true });
    expect(controller.get('*tabId')).toBe(TabId.FILTERS);
    expect(controller.get('*networkProblems')).toBe(true);
    // Untouched keys still get their default.
    expect(controller.get('*originalUrl')).toBeNull();
  });

  it('set() stores the value and notifies, deduping unchanged writes (Object.is)', () => {
    const controller = new CloudImageEditorController();
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.set('*originalUrl', 'https://example.com/a.png');
    expect(controller.get('*originalUrl')).toBe('https://example.com/a.png');
    expect(listener).toHaveBeenCalledTimes(1);

    controller.set('*originalUrl', 'https://example.com/a.png'); // unchanged — no notify
    expect(listener).toHaveBeenCalledTimes(1);

    controller.set('*originalUrl', 'https://example.com/b.png');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('set() dedups a re-written same-reference value (no notify)', () => {
    const controller = new CloudImageEditorController();
    const listener = vi.fn();
    controller.set('*currentAspectRatio', { type: 'aspect-ratio', width: 16, height: 9, id: 'x' });
    controller.subscribe(listener);
    const ratio = { type: 'aspect-ratio' as const, width: 16, height: 9, id: 'y' };
    controller.set('*currentAspectRatio', ratio); // new reference — notifies
    expect(listener).toHaveBeenCalledTimes(1);
    controller.set('*currentAspectRatio', ratio); // same reference — Object.is dedup, no notify
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('subscribe fires on every changed key, coarse (not per-key)', () => {
    const controller = new CloudImageEditorController();
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.set('*tabId', TabId.TUNING);
    controller.set('*networkProblems', true);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('unsubscribe stops notifications', () => {
    const controller = new CloudImageEditorController();
    const listener = vi.fn();
    const off = controller.subscribe(listener);
    off();

    controller.set('*tabId', TabId.TUNING);
    expect(listener).not.toHaveBeenCalled();
  });

  it('falls back to inert default services until setServices is called', () => {
    const controller = new CloudImageEditorController();
    expect(controller.l10n('cancel')).toBe('cancel'); // identity fallback
    expect(controller.getConfig('pubkey')).toBeUndefined();
    expect(controller.telemetry.sendEvent({})).toBeUndefined(); // no-op, doesn't throw
    expect(controller.telemetry.sendEventError(new Error('x'))).toBeUndefined();
    return expect(controller.proxyUrl('https://example.com/a.png')).resolves.toBe('https://example.com/a.png');
  });

  it('setServices swaps in the injected l10n/getConfig/telemetry/proxyUrl', async () => {
    const controller = new CloudImageEditorController();
    const sendEvent = vi.fn();
    const sendEventError = vi.fn();
    const sendEventCloudImageEditor = vi.fn();
    controller.setServices({
      l10n: (key, variables) => `${key}:${JSON.stringify(variables ?? {})}`,
      getConfig: ((key: string) =>
        key === 'pubkey' ? 'demopublickey' : undefined) as CloudImageEditorController['getConfig'],
      telemetry: { sendEvent, sendEventError, sendEventCloudImageEditor },
      proxyUrl: async (url) => `https://proxy.example.com/?u=${url}`,
    });

    expect(controller.l10n('cancel', { n: 1 })).toBe('cancel:{"n":1}');
    expect(controller.getConfig('pubkey')).toBe('demopublickey');
    controller.telemetry.sendEvent({ type: 'x' });
    expect(sendEvent).toHaveBeenCalledWith({ type: 'x' });
    controller.telemetry.sendEventError('boom', 'ctx');
    expect(sendEventError).toHaveBeenCalledWith('boom', 'ctx');
    await expect(controller.proxyUrl('https://example.com/a.png')).resolves.toBe(
      'https://proxy.example.com/?u=https://example.com/a.png',
    );
  });

  it('constructor accepts services up front, equivalent to setServices', () => {
    const controller = new CloudImageEditorController(undefined, {
      l10n: (key) => `pre:${key}`,
      getConfig: (() => undefined) as CloudImageEditorController['getConfig'],
      telemetry: { sendEvent: () => {}, sendEventError: () => {}, sendEventCloudImageEditor: () => {} },
      proxyUrl: async (url) => url,
    });
    expect(controller.l10n('cancel')).toBe('pre:cancel');
  });

  it('notify() fires subscribers with no state change (e.g. after a services swap)', () => {
    const controller = new CloudImageEditorController();
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.notify();
    expect(listener).toHaveBeenCalledTimes(1);
    // No state mutated.
    expect(controller.get('*tabId')).toBe(TabId.CROP);
  });

  it('destroy() clears subscribers', () => {
    const controller = new CloudImageEditorController();
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.destroy();

    controller.set('*tabId', TabId.TUNING);
    expect(listener).not.toHaveBeenCalled();
  });

  it('owns editor config with defaults and setConfig patch', () => {
    const controller = new CloudImageEditorController();
    expect(controller.getConfigValue('cdnCname')).toBe('https://ucarecdn.com');
    expect(controller.getConfigValue('testMode')).toBe(false);
    controller.setConfig({ cdnCname: 'https://cdn.example.com/', testMode: true });
    expect(controller.getConfigValue('cdnCname')).toBe('https://cdn.example.com/');
    expect(controller.getConfigValue('testMode')).toBe(true);
  });

  it('getOwnConfigValue distinguishes an explicit override from unset', () => {
    const controller = new CloudImageEditorController();
    // Nothing set yet → own is undefined (caller falls through to ctx/default).
    expect(controller.getOwnConfigValue('cdnCname')).toBeUndefined();
    controller.setConfig({ cdnCname: 'https://cdn.example.com/' });
    expect(controller.getOwnConfigValue('cdnCname')).toBe('https://cdn.example.com/');
  });

  it('setConfig with undefined REMOVES the override so it falls back to the default', () => {
    const controller = new CloudImageEditorController();
    controller.setConfig({ cdnCname: 'https://cdn.example.com/' });
    expect(controller.getConfigValue('cdnCname')).toBe('https://cdn.example.com/');
    // Prop unset (undefined) — override removed, not left stale.
    controller.setConfig({ cdnCname: undefined });
    expect(controller.getOwnConfigValue('cdnCname')).toBeUndefined();
    expect(controller.getConfigValue('cdnCname')).toBe('https://ucarecdn.com');
  });
});
