import { html, type PropertyValues } from 'lit';
import { state } from 'lit/decorators.js';
import { ChildBlock } from '../../lit/ChildBlock';
import './progress-bar-common.css';

import '../ProgressBar/ProgressBar';

export class ProgressBarCommon extends ChildBlock {
  @state()
  private _visible = false;

  @state()
  private _value = 0;

  // No `init$` here: `*commonProgress` is a ctx-scope key seeded by v1
  // uploader blocks (`UploaderController`/solution wiring), not by this
  // block — `ChildBlock` has no `init$` seam to declare it in.
  protected override controllerReady(): void {
    this.trackSub(
      this.bag.ctx.sub('*commonProgress', (progress: number) => {
        this._value = progress;
      }),
    );

    // The uploader-scope `*uploadCollection` instance may not have registered
    // yet when this block's controller adopts — go through `bag.when` rather
    // than the throwing `bag.uploadCollection` getter (DynamicBtn precedent).
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

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    // Known-dead code, preserved bug-for-bug from v1: this checks
    // `changedProperties.has('visible')` but the backing field is `_visible`,
    // so this branch never fires and the host `active` attribute is never
    // toggled. Not fixed here — activating it would change CSS-visible
    // behavior that v1 never exercised (see M9h task-3 brief / progress.md).
    if (changedProperties.has('visible' as keyof ProgressBarCommon)) {
      if (this._visible) {
        this.setAttribute('active', '');
      } else {
        this.removeAttribute('active');
      }
    }
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
