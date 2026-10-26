import { ContextProvider } from '@lit/context';
import { html, LitElement } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LightDomMixin } from '../../../lit/LightDomMixin';
import { CloudImageEditorController } from './CloudImageEditorController';
import { EditorImageCropper } from './EditorImageCropper';
import { EditorImageFader } from './EditorImageFader';
import { cloudImageEditorContext } from './editor-context';
import { TabId } from './toolbar-constants';

class ActivationRoot extends LightDomMixin(LitElement) {
  public readonly provider = new ContextProvider(this, {
    context: cloudImageEditorContext,
    initialValue: new CloudImageEditorController(),
  });

  public override render() {
    return html`${this.yield('')}`;
  }
}
customElements.define('uc-test-activation-root', ActivationRoot);
EditorImageCropper.reg('uc-test-activation-cropper');
EditorImageFader.reg('uc-test-activation-fader');

const mounted: HTMLElement[] = [];

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  vi.restoreAllMocks();
});

const cases = [
  { name: 'EditorImageCropper', Block: EditorImageCropper, tag: 'uc-test-activation-cropper', tabId: TabId.CROP },
  { name: 'EditorImageFader', Block: EditorImageFader, tag: 'uc-test-activation-fader', tabId: TabId.TUNING },
] as const;

describe.each(cases)('$name activation across a reconnect', ({ Block, tag, tabId }) => {
  it('re-activates on the next attach when the in-flight activation was aborted', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const activate = vi.spyOn(Block.prototype, 'activate');

    const root = document.createElement('uc-test-activation-root') as ActivationRoot;
    document.body.append(root);
    mounted.push(root);
    const controller = root.provider.value;
    controller.set('*originalUrl', 'https://ucarecdn.com/9a3c8d5e-0b1f-4c2a-8e7d-6f5b4a3c2d1e/');
    controller.set('*tabId', tabId);
    // Keep every activation in flight at its image-source await.
    vi.spyOn(controller, 'proxyUrl').mockReturnValue(new Promise<string>(() => {}));

    const block = document.createElement(tag) as InstanceType<typeof Block>;
    root.append(block);
    block.imageSize = { width: 100, height: 100 };
    await vi.waitFor(() => expect(activate).toHaveBeenCalledTimes(1));

    // Disconnect while the activation is still awaiting, then reconnect.
    block.remove();
    root.append(block);

    await vi.waitFor(() => expect(activate).toHaveBeenCalledTimes(2));
  });
});

describe('EditorImageCropper commit without a laid-out image box', () => {
  it('keeps the committed crop and logs nothing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = document.createElement('uc-test-activation-root') as ActivationRoot;
    document.body.append(root);
    mounted.push(root);
    const controller = root.provider.value;
    const crop = { dimensions: [50, 50], coords: [10, 10] } as const;
    controller.set('*editorTransformations', { crop: { dimensions: [...crop.dimensions], coords: [...crop.coords] } });

    const cropper = document.createElement('uc-test-activation-cropper') as EditorImageCropper;
    root.append(cropper);
    await cropper.updateComplete;
    // An image is known but the box has not been measured yet: 0×0, as while the editor is detached mid-move.
    const internals = cropper as unknown as { _imageSize: { width: number; height: number }; _commit(): void };
    internals._imageSize = { width: 100, height: 100 };
    internals._commit();

    expect(controller.get('*editorTransformations').crop).toEqual({ dimensions: [50, 50], coords: [10, 10] });
    expect(error).not.toHaveBeenCalled();
  });
});
