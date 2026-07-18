import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { CollectionStateController } from '../../abstract/controllers/CollectionStateController';
import { ChildBlock } from '../../lit/ChildBlock';
import './progress-bar-common.css';

import '../ProgressBar/ProgressBar';

export class ProgressBarCommon extends ChildBlock {
  public static override readonly uses = [CollectionStateController] as const;

  @state()
  private _visible = false;

  // Tracked read: `commonProgress` (owned by `CollectionStateController`)
  // auto-tracks under `SignalWatcher`, so a progress change re-renders —
  // replacing the v1 `ctx.sub('*commonProgress')` subscription that mirrored it
  // into a `_value` @state. No `init$`: `commonProgress` is seeded by the
  // controller, not this block.
  private get _value(): number {
    return this.use(CollectionStateController).getTracked('commonProgress');
  }

  protected override controllerReady(): void {
    // The uploader-scope `*uploadCollection` instance may not have registered
    // yet when this block's controller adopts — go through `bag.when` rather
    // than the throwing `bag.uploadCollection` getter (DynamicBtn precedent).
    // Kept on the v1 `bag` path: the registration race makes an eager
    // `use(UploadCollectionController)` unsafe here (step 8).
    this.trackSub(
      this.bag.when('uploadCollection', (collection) => {
        this.trackSub(
          collection.observeProperties(() => {
            const anyUploading = collection.items().some((id) => {
              const item = collection.read(id);
              return item?.getValue('isUploading') ?? false;
            });

            this._visible = anyUploading;
          }),
        );
      }),
    );
  }

  public override render() {
    return html` <uc-progress-bar .value=${this._value} .visible=${this._visible}></uc-progress-bar> `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-progress-bar-common': ProgressBarCommon;
  }
}
