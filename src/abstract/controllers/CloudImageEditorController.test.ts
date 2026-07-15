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
    expect(controller.get('*cropPresetList')).toEqual([]);
    expect(controller.get('*faderEl')).toBeNull();
    expect(controller.get('*cropperEl')).toBeNull();
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

  it('set() dedup uses Object.is, so NaN written twice does not notify twice', () => {
    const controller = new CloudImageEditorController();
    const listener = vi.fn();
    controller.set('*currentAspectRatio', { type: 'aspect-ratio', width: Number.NaN, height: 1, id: 'x' });
    controller.subscribe(listener);
    const nan = { type: 'aspect-ratio' as const, width: Number.NaN, height: 1, id: 'x' };
    controller.set('*currentAspectRatio', nan);
    expect(listener).toHaveBeenCalledTimes(1);
    controller.set('*currentAspectRatio', nan); // same reference — unchanged
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

  it('setHandlers wires apply/cancel/retryNetwork without notifying subscribers', () => {
    const controller = new CloudImageEditorController();
    const listener = vi.fn();
    controller.subscribe(listener);

    const onApply = vi.fn();
    const onCancel = vi.fn();
    const onRetryNetwork = vi.fn();
    controller.setHandlers({ onApply, onCancel, onRetryNetwork });
    expect(listener).not.toHaveBeenCalled();

    controller.apply({ rotate: 90 });
    expect(onApply).toHaveBeenCalledWith({ rotate: 90 });

    controller.cancel();
    expect(onCancel).toHaveBeenCalledTimes(1);

    controller.retryNetwork();
    expect(onRetryNetwork).toHaveBeenCalledTimes(1);
  });

  it('setHandlers merges partial updates rather than replacing the whole set', () => {
    const controller = new CloudImageEditorController();
    const onApply = vi.fn();
    const onCancel = vi.fn();
    controller.setHandlers({ onApply, onCancel });
    controller.setHandlers({ onCancel: vi.fn() });

    controller.apply({});
    expect(onApply).toHaveBeenCalledTimes(1); // still wired from the first call
  });

  it('action methods are no-ops when no handler is set', () => {
    const controller = new CloudImageEditorController();
    expect(() => controller.apply({})).not.toThrow();
    expect(() => controller.cancel()).not.toThrow();
    expect(() => controller.retryNetwork()).not.toThrow();
  });

  it('destroy() clears subscribers and handlers', () => {
    const controller = new CloudImageEditorController();
    const listener = vi.fn();
    controller.subscribe(listener);
    const onCancel = vi.fn();
    controller.setHandlers({ onCancel });

    controller.destroy();

    controller.set('*tabId', TabId.TUNING);
    expect(listener).not.toHaveBeenCalled();

    controller.cancel();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
