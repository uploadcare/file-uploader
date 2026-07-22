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

  /** Recompute `_visible` from current collection membership + `isUploading` state. */
  private _recomputeVisible(collection: UploadCollectionController): void {
    this._visible = collection.items().some((id) => collection.read(id)?.get('isUploading') ?? false);
  }

  // The uploader-scope `UploadCollectionController` resolves only once the scope
  // attaches, so go through `whenController` (now-or-when-available); its callback
  // returns both observers, which `whenController`'s unsubscribe (an array
  // teardown) disposes. `_visible` depends on both entry PROPERTIES
  // (`isUploading` flipping on an existing entry — `observeProperties`) and
  // collection MEMBERSHIP (an entry added/removed altogether, e.g. `remove()`/
  // `abort()` clearing the last uploading entry, which fires only the
  // collection observer, never a property one — `observeCollection`). Wiring
  // only the former left the bar stuck visible after the last upload was
  // removed. The initial recompute covers an already-populated collection,
  // which otherwise wouldn't set `_visible` until the next property/collection
  // change.
  @subscription()
  protected _wireProgress(): Unsubscribe {
    return this.container.whenController(UploadCollectionController, (collection) => {
      this._recomputeVisible(collection);
      return [
        // Visibility derives only from entries' `isUploading` — declare just
        // that key so a progress/thumb/etc. mutation doesn't wake this observer.
        collection.observeProperties(['isUploading'], () => this._recomputeVisible(collection)),
        collection.observeCollection(() => this._recomputeVisible(collection)),
      ];
    });
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
