import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { CollectionStateController } from '../../abstract/controllers/CollectionStateController';
import { UploadCollectionController } from '../../abstract/controllers/UploadCollectionController';
import { inject } from '../../abstract/di/inject';
import { ChildBlock } from '../../lit/ChildBlock';
import { subscription, type Unsubscribe } from '../../lit/subscription';
import './progress-bar-common.css';

import '../ProgressBar/ProgressBar';

export class ProgressBarCommon extends ChildBlock {
  @inject(CollectionStateController) private readonly _collectionState!: CollectionStateController;

  @state()
  private _visible = false;

  // Tracked read: `commonProgress` (owned by `CollectionStateController`)
  // auto-tracks under `SignalWatcher`, so a progress change re-renders —
  // replacing the v1 `ctx.sub('*commonProgress')` subscription that mirrored it
  // into a `_value` @state. No `init$`: `commonProgress` is seeded by the
  // controller, not this block.
  private get _value(): number {
    return this._collectionState.getTracked('commonProgress');
  }

  // The uploader-scope `UploadCollectionController` resolves only once the scope
  // attaches, so go through `whenController` (now-or-when-available); its callback
  // returns the property observer, which `whenController`'s unsubscribe disposes.
  @subscription()
  protected _wireProgress(): Unsubscribe {
    return this.container.whenController(UploadCollectionController, (collection) =>
      collection.observeProperties(() => {
        this._visible = collection.items().some((id) => collection.read(id)?.getValue('isUploading') ?? false);
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
