import { ContextProvider } from '@lit/context';
import { html, LitElement } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LightDomMixin } from '../../../lit/LightDomMixin';
import { CloudImageEditorController } from './CloudImageEditorController';
import { CropFrame } from './CropFrame';
import { EditorFilterControl } from './EditorFilterControl';
import { EditorImageCropper } from './EditorImageCropper';
import { cloudImageEditorContext } from './editor-context';
import { TabId } from './toolbar-constants';

class OwnCancelRoot extends LightDomMixin(LitElement) {
  public readonly provider = new ContextProvider(this, {
    context: cloudImageEditorContext,
    initialValue: new CloudImageEditorController(),
  });

  public override render() {
    return html`${this.yield('')}`;
  }
}
customElements.define('uc-test-own-cancel-root', OwnCancelRoot);
CropFrame.reg('uc-crop-frame');
EditorImageCropper.reg('uc-test-own-cancel-cropper');
EditorFilterControl.reg('uc-test-own-cancel-filter');

const mounted: HTMLElement[] = [];

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  vi.restoreAllMocks();
});

function mountRoot(): CloudImageEditorController {
  const root = document.createElement('uc-test-own-cancel-root') as OwnCancelRoot;
  document.body.append(root);
  mounted.push(root);
  const controller = root.provider.value;
  controller.originalUrl = 'https://ucarecdn.com/9a3c8d5e-0b1f-4c2a-8e7d-6f5b4a3c2d1e/';
  // The image never loads in happy-dom, so the preload stays in flight until cancelled.
  vi.spyOn(controller, 'proxyUrl').mockImplementation((url) => Promise.resolve(url));
  return controller;
}

type FilterInternals = {
  _cancelPreload?: () => void;
  _loadPreview(): Promise<void>;
  _observerCallback(entries: Pick<IntersectionObserverEntry, 'isIntersecting'>[]): void;
};

describe('editor blocks cancelling their own work while adopted', () => {
  it('a filter preview scrolled out of view mid-load logs nothing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const loadPreview = vi.spyOn(EditorFilterControl.prototype as unknown as FilterInternals, '_loadPreview');
    mountRoot();

    const control = document.createElement('uc-test-own-cancel-filter') as EditorFilterControl;
    control.filter = 'adaris';
    mounted[0]?.append(control);
    await control.updateComplete;
    const internals = control as unknown as FilterInternals;

    internals._observerCallback([{ isIntersecting: true }]);
    await vi.waitFor(() => expect(internals._cancelPreload).toBeDefined());
    internals._observerCallback([{ isIntersecting: false }]);

    await loadPreview.mock.results[0]?.value.catch(() => {});
    await Promise.resolve();
    expect(error).not.toHaveBeenCalled();
  });

  it('a cropper deactivated mid-load logs nothing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const activate = vi.spyOn(EditorImageCropper.prototype, 'activate');
    const controller = mountRoot();
    controller.tabId = TabId.CROP;

    const cropper = document.createElement('uc-test-own-cancel-cropper') as EditorImageCropper;
    mounted[0]?.append(cropper);
    cropper.imageSize = { width: 100, height: 100 };
    await vi.waitFor(() => expect(controller.proxyUrl).toHaveBeenCalled());
    await Promise.resolve();
    cropper.deactivate({ reset: true });

    await activate.mock.results[0]?.value.catch(() => {});
    await Promise.resolve();
    expect(error).not.toHaveBeenCalled();
  });
});
