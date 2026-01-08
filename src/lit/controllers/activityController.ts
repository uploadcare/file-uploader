import type { ReactiveController } from 'lit';
import { EventType } from '../../blocks/UploadCtxProvider/EventEmitter';
import { debounce } from '../../utils/debounce';
import type { LitActivityBlock } from '../LitActivityBlock';

type ActivityControllerOptions = {
  getHistoryTracked: () => boolean;
};

export type ActivityCallbacks = {
  onActivate?: () => void;
  onDeactivate?: () => void;
};

const ACTIVE_ATTR = 'active';

export class ActivityController implements ReactiveController {
  private callbacks: ActivityCallbacks | null = null;
  private isActive = false;

  private readonly host: LitActivityBlock;
  private readonly getHistoryTracked: () => boolean;
  private readonly debouncedHistoryFlush = debounce(() => this.flushHistory(), 10);

  public constructor(host: LitActivityBlock, options: ActivityControllerOptions) {
    this.host = host;
    this.getHistoryTracked = options.getHistoryTracked;
    host.addController(this);
  }

  public initialize(): void {
    if (!this.host.activityType) {
      return;
    }

    if (!this.host.hasAttribute('activity')) {
      this.host.setAttribute('activity', this.host.activityType);
    }

    this.host.sharedCtx.sub('*currentActivity', this.handleCurrentActivityChange);
  }

  public registerActivity(callbacks: ActivityCallbacks = {}): void {
    this.callbacks = callbacks;
  }

  public unregisterActivity(): void {
    if (!this.callbacks) {
      return;
    }

    if (this.isActive) {
      this.deactivate();
    }

    this.callbacks = null;
  }

  public get active(): boolean {
    return this.isActive;
  }

  public historyBack(): void {
    this.navigateHistoryBack();
  }

  public hostDisconnected(): void {
    this.unregisterActivity();
  }

  private handleCurrentActivityChange = (val: string | null): void => {
    if (!this.host.activityType) {
      return;
    }

    try {
      if (this.host.activityType !== val && this.isActive) {
        this.deactivate();
      } else if (this.host.activityType === val && !this.isActive) {
        this.activate();
      }
    } catch (err) {
      this.host.telemetryManager.sendEventError(err, `activity "${this.host.activityType}"`);
      console.error(`Error in activity "${this.host.activityType}". `, err);
      const history = this.host.sharedCtx.read('*history') as string[] | undefined;
      this.host.sharedCtx.pub('*currentActivity', history?.[history.length - 1] ?? null);
    }

    if (!val) {
      this.host.sharedCtx.pub('*history', []);
    }
  };

  private activate(): void {
    if (this.isActive) {
      return;
    }

    this.host.sharedCtx.pub('*historyBack', this.host.historyBack.bind(this.host));
    this.isActive = true;
    this.host.setAttribute(ACTIVE_ATTR, '');
    this.callbacks?.onActivate?.();

    this.debouncedHistoryFlush();

    this.host.emit(EventType.ACTIVITY_CHANGE, {
      activity: this.host.activityType,
    });
  }

  private deactivate(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    this.host.removeAttribute(ACTIVE_ATTR);
    this.callbacks?.onDeactivate?.();
  }

  private flushHistory(): void {
    let history = this.host.sharedCtx.read('*history');

    if (!history) {
      return;
    }

    if (history.length > 10) {
      history = history.slice(history.length - 11, history.length - 1);
    }

    if (this.getHistoryTracked() && history[history.length - 1] !== this.host.activityType && this.host.activityType) {
      history.push(this.host.activityType);
    }

    this.host.sharedCtx.pub('*history', history);
  }

  private navigateHistoryBack(): void {
    const history = this.host.sharedCtx.read('*history');

    if (!history) {
      return;
    }

    let nextActivity = history.pop();

    while (nextActivity === this.host.activityType) {
      nextActivity = history.pop();
    }

    let couldOpenActivity = !!nextActivity;
    if (nextActivity) {
      const nextLitActivityBlock = [...this.host.blocksRegistry].find((block) => block.activityType === nextActivity);
      couldOpenActivity = (nextLitActivityBlock as LitActivityBlock | undefined)?.couldOpenActivity ?? false;
    }

    nextActivity = couldOpenActivity ? nextActivity : undefined;

    if (nextActivity) {
      this.host.modalManager?.open(nextActivity);
    }

    this.host.sharedCtx.pub('*currentActivity', nextActivity ?? null);
    this.host.sharedCtx.pub('*history', history);

    if (!nextActivity) {
      this.host.modalManager?.closeAll();
    }
  }
}
