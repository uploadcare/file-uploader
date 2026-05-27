import { ACTIVITY_TYPES } from '../../lit/activity-constants';
import { SharedInstance } from '../../lit/shared-instances';

type AfterFileAddContext = {
  historyLength: number;
};

type AfterFileAddHook = (ctx: AfterFileAddContext) => boolean;

export class RouterHooksLayer extends SharedInstance {
  private _afterFileAddHooks: AfterFileAddHook[] = [];

  public registerAfterFileAddHook(hook: AfterFileAddHook): () => void {
    this._afterFileAddHooks.push(hook);
    return () => {
      this._afterFileAddHooks = this._afterFileAddHooks.filter((h) => h !== hook);
    };
  }

  public navigateAfterFileAdd(): void {
    const history = this._sharedInstancesBag.ctx.read('*history');
    const ctx: AfterFileAddContext = { historyLength: history.length };

    const handled = this._afterFileAddHooks.some((hook) => hook(ctx));
    if (!handled) {
      this._sharedInstancesBag.ctx.pub('*currentActivity', ACTIVITY_TYPES.UPLOAD_LIST);
      this._sharedInstancesBag.modalManager?.open(ACTIVITY_TYPES.UPLOAD_LIST);
    }
  }
}
