import { Signal } from '@lit-labs/signals';
import { describe, expect, it, vi } from 'vitest';
import { CloudImageEditorController } from './CloudImageEditorController';
import { TabId } from './toolbar-constants';

describe('CloudImageEditorController', () => {
  it('seeds the cross-cutting defaults', () => {
    const controller = new CloudImageEditorController();
    expect(controller.originalUrl).toBeNull();
    expect(controller.networkProblems).toBe(false);
    expect(controller.tabId).toBe(TabId.CROP);
    expect(controller.editorTransformations).toEqual({});
    expect(controller.colorPreview).toBeNull();
  });

  it('accepts a partial initial state overriding only the given keys', () => {
    const controller = new CloudImageEditorController({ tabId: TabId.FILTERS, networkProblems: true });
    expect(controller.tabId).toBe(TabId.FILTERS);
    expect(controller.networkProblems).toBe(true);
    // Untouched keys still get their default.
    expect(controller.originalUrl).toBeNull();
  });

  it('a write stores the value and notifies observers, deduping unchanged writes (Object.is)', () => {
    const controller = new CloudImageEditorController();
    const listener = vi.fn();
    controller.observe('originalUrl', listener);

    controller.originalUrl = 'https://example.com/a.png';
    expect(controller.originalUrl).toBe('https://example.com/a.png');
    expect(listener).toHaveBeenCalledTimes(1);

    controller.originalUrl = 'https://example.com/a.png'; // unchanged — no notify
    expect(listener).toHaveBeenCalledTimes(1);

    controller.originalUrl = 'https://example.com/b.png';
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('a write dedups a re-written same-reference value (no notify)', () => {
    const controller = new CloudImageEditorController();
    const listener = vi.fn();
    controller.currentAspectRatio = { type: 'aspect-ratio', width: 16, height: 9, id: 'x' };
    controller.observe('currentAspectRatio', listener);
    const ratio = { type: 'aspect-ratio' as const, width: 16, height: 9, id: 'y' };
    controller.currentAspectRatio = ratio; // new reference — notifies
    expect(listener).toHaveBeenCalledTimes(1);
    controller.currentAspectRatio = ratio; // same reference — Object.is dedup, no notify
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('observe fires with the new value for its own key only', () => {
    const controller = new CloudImageEditorController();
    const listener = vi.fn();
    controller.observe('tabId', listener);

    controller.networkProblems = true;
    controller.tabId = TabId.TUNING;
    expect(listener.mock.calls).toEqual([[TabId.TUNING]]);
  });

  it('observe with immediate also fires once with the current value', () => {
    const controller = new CloudImageEditorController({ tabId: TabId.FILTERS });
    const listener = vi.fn();
    controller.observe('tabId', listener, { immediate: true });
    expect(listener.mock.calls).toEqual([[TabId.FILTERS]]);
  });

  it('unsubscribe stops notifications', () => {
    const controller = new CloudImageEditorController();
    const listener = vi.fn();
    const off = controller.observe('tabId', listener);
    off();

    controller.tabId = TabId.TUNING;
    expect(listener).not.toHaveBeenCalled();
  });

  it('reads state tracked, so a computation over it recomputes on a write', () => {
    const controller = new CloudImageEditorController();
    const tab = new Signal.Computed(() => controller.tabId);
    expect(tab.get()).toBe(TabId.CROP);

    controller.tabId = TabId.TUNING;
    expect(tab.get()).toBe(TabId.TUNING);
  });

  it('runs an observer untracked, so a computation that writes does not depend on what the observer reads', () => {
    const controller = new CloudImageEditorController();
    controller.observe('tabId', () => controller.networkProblems);
    let runs = 0;
    const writer = new Signal.Computed(() => {
      runs += 1;
      controller.tabId = TabId.TUNING;
    });
    writer.get();

    controller.networkProblems = true;
    writer.get();
    expect(runs).toBe(1);
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
    const sendActionEvent = vi.fn();
    controller.setServices({
      l10n: (key, variables) => `${key}:${JSON.stringify(variables ?? {})}`,
      getConfig: ((key: string) =>
        key === 'pubkey' ? 'demopublickey' : undefined) as CloudImageEditorController['getConfig'],
      telemetry: { sendEvent, sendEventError, sendActionEvent },
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
      telemetry: { sendEvent: () => {}, sendEventError: () => {}, sendActionEvent: () => {} },
      proxyUrl: async (url) => url,
    });
    expect(controller.l10n('cancel')).toBe('pre:cancel');
  });

  it('servicesChanged() re-runs a computation over l10n/getConfig with no state change (e.g. a locale load)', () => {
    const controller = new CloudImageEditorController();
    let runs = 0;
    const label = new Signal.Computed(() => {
      runs += 1;
      return `${controller.l10n('cancel')}:${String(controller.getConfig('debug'))}`;
    });
    label.get();

    controller.servicesChanged();
    label.get();
    expect(runs).toBe(2);
    // No state mutated.
    expect(controller.tabId).toBe(TabId.CROP);
  });

  it('setServices() re-runs a computation over l10n', () => {
    const controller = new CloudImageEditorController();
    const label = new Signal.Computed(() => controller.l10n('cancel'));
    expect(label.get()).toBe('cancel');

    controller.setServices({
      l10n: (key) => `de:${key}`,
      getConfig: (() => undefined) as CloudImageEditorController['getConfig'],
      telemetry: { sendEvent: () => {}, sendEventError: () => {}, sendActionEvent: () => {} },
      proxyUrl: async (url) => url,
    });
    expect(label.get()).toBe('de:cancel');
  });

  it('destroy() clears observers and keeps the state', () => {
    const controller = new CloudImageEditorController();
    const listener = vi.fn();
    controller.observe('tabId', listener);

    controller.destroy();

    controller.tabId = TabId.TUNING;
    expect(listener).not.toHaveBeenCalled();
    expect(controller.tabId).toBe(TabId.TUNING);
  });
});

describe('CloudImageEditorController default services', () => {
  it('ignores an action event before setServices', () => {
    const controller = new CloudImageEditorController();
    expect(controller.telemetry.sendActionEvent('click', 'UC-BTN-UI', { tabId: TabId.CROP })).toBeUndefined();
  });
});
