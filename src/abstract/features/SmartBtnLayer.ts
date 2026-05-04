import { ACTIVITY_TYPES } from '../../lit/activity-constants';
import { findBlockInCtx } from '../../lit/findBlockInCtx';
import { SharedInstance } from '../../lit/shared-instances';

type SmartBtnSolutionBlock = {
  isSmartBtnActive: boolean;
};

export class SmartBtnLayer extends SharedInstance {
  public get isActive(): boolean {
    const solutionBlock = findBlockInCtx(
      this._sharedInstancesBag.blocksRegistry,
      (block) => 'isSmartBtnActive' in block,
    ) as SmartBtnSolutionBlock | undefined;

    return solutionBlock?.isSmartBtnActive ?? false;
  }

  public shouldReturnToSmartButtonAfterFileAdd(): boolean {
    const history = this._sharedInstancesBag.ctx.read('*history');

    return this.isActive && history.length === 0;
  }

  public showUploadListAfterFileAdd(): void {
    if (this.shouldReturnToSmartButtonAfterFileAdd()) {
      this._returnToSmartButton();
      return;
    }

    this._sharedInstancesBag.ctx.pub('*currentActivity', ACTIVITY_TYPES.UPLOAD_LIST);
    this._sharedInstancesBag.modalManager?.open(ACTIVITY_TYPES.UPLOAD_LIST);
  }

  private _returnToSmartButton(): void {
    const currentActivity = this._sharedInstancesBag.ctx.read('*currentActivity');

    if (currentActivity) {
      this._sharedInstancesBag.modalManager?.close(currentActivity);
    } else {
      this._sharedInstancesBag.modalManager?.closeAll();
    }

    this._sharedInstancesBag.ctx.pub('*currentActivity', null);
  }
}
