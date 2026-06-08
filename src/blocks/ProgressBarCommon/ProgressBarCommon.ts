import { html } from 'lit';
import '../../blocks/ProgressBarCommon/progress-bar-common.css';
import '../ProgressBar/ProgressBar';
import { ChildBlock } from '../../abstract/ChildBlock';
import type { UploaderController } from '../../abstract/controllers/UploaderController';

/**
 * v2 `<uc-progress-bar-common>`. Aggregate progress bar across the upload
 * collection. Derives `visible` (any item uploading) and `value`
 * (average progress) directly from `controller.collection.items` —
 * v2's UploadCollectionController exposes per-item progress, so no
 * dedicated `*commonProgress` shared-state key is needed.
 */
export class ProgressBarCommon extends ChildBlock {
  protected override subscriptionsFor(ctrl: UploaderController) {
    return [ctrl.collection.subscribe.bind(ctrl.collection)];
  }

  public override render() {
    const ctrl = this.uploaderOrNull;
    if (!ctrl) return html`<uc-progress-bar .value=${0} .visible=${false}></uc-progress-bar>`;

    const uploading = ctrl.collection.items.filter((i) => i.status === 'uploading');
    const visible = uploading.length > 0;
    const sum = uploading.reduce((acc, i) => acc + (i.uploadProgress ?? 0), 0);
    const value = uploading.length > 0 ? Math.round((sum / uploading.length) * 100) : 0;

    this.toggleAttribute('active', visible);

    return html`
      <uc-progress-bar .value=${value} .visible=${visible}></uc-progress-bar>
    `;
  }
}

if (!customElements.get('uc-progress-bar-common')) customElements.define('uc-progress-bar-common', ProgressBarCommon);
