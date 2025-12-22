import { ContextConsumer, createContext } from '@lit/context';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { LitBlock } from '../../../lit/LitBlock';
import type { PubSub, Unsubscriber } from '../../../lit/PubSubCompat';
import type { CloudImageEditorState } from './state';

export const cloudImageEditorContext = createContext<PubSub<CloudImageEditorState>>('cloud-image-editor-context');

export class CloudImageEditorContextController implements ReactiveController {
  public pubsub?: PubSub<CloudImageEditorState>;

  private _stateProxy?: CloudImageEditorState;
  private _subscriptions = new Set<Unsubscriber>();
  private _onAttachCallbacks = new Set<() => void>();
  private readonly _consumer: ContextConsumer<typeof cloudImageEditorContext, ReactiveControllerHost & LitBlock>;

  public constructor(host: ReactiveControllerHost & LitBlock) {
    host.addController(this);
    this._consumer = new ContextConsumer(host, {
      context: cloudImageEditorContext,
      subscribe: true,
      callback: (value) => this._attach(value),
    });
  }

  public hostConnected(): void {
    this._attach(this._consumer.value);
  }

  public hostDisconnected(): void {
    this._cleanup();
  }

  private _attach(pubsub?: PubSub<CloudImageEditorState>): void {
    if (!pubsub || this.pubsub === pubsub) {
      return;
    }
    this._cleanup();
    this.pubsub = pubsub;
    this._stateProxy = undefined;

    if (this._onAttachCallbacks.size > 0) {
      for (const cb of this._onAttachCallbacks) {
        cb();
      }
      this._onAttachCallbacks.clear();
    }
  }

  public get store(): PubSub<CloudImageEditorState> {
    if (!this.pubsub) {
      throw new Error('Cloud image editor context is not available');
    }
    return this.pubsub;
  }

  public get $(): CloudImageEditorState {
    if (!this._stateProxy) {
      this._stateProxy = new Proxy({} as CloudImageEditorState, {
        get: (_target, key: string | symbol) => {
          if (typeof key !== 'string') {
            return undefined;
          }
          return this.store.read(key as keyof CloudImageEditorState);
        },
        set: (_target, key: string | symbol, value: CloudImageEditorState[keyof CloudImageEditorState]) => {
          if (typeof key !== 'string') {
            return false;
          }
          this.store.pub(
            key as keyof CloudImageEditorState,
            value as CloudImageEditorState[keyof CloudImageEditorState],
          );
          return true;
        },
      });
    }
    return this._stateProxy;
  }

  public sub<K extends keyof CloudImageEditorState>(
    key: K,
    callback: (value: CloudImageEditorState[K]) => void,
    init = true,
  ): Unsubscriber {
    const unsubscribe = this.store.sub(key, callback as (value: unknown) => void, init);

    const trackedUnsubscribe = () => {
      unsubscribe?.();
      this._subscriptions.delete(trackedUnsubscribe);
    };
    this._subscriptions.add(trackedUnsubscribe);
    return trackedUnsubscribe;
  }

  public setPubSub(pubsub: PubSub<CloudImageEditorState>): void {
    this._attach(pubsub);
  }

  public onAttach(callback: () => void): void {
    if (this.pubsub) {
      callback();
      return;
    }
    this._onAttachCallbacks.add(callback);
  }

  private _cleanup(): void {
    if (this._subscriptions.size === 0) {
      return;
    }
    for (const unsubscribe of [...this._subscriptions]) {
      unsubscribe?.();
    }
    this._subscriptions.clear();
  }
}

export class CloudImageEditorElement extends LitBlock {
  protected readonly editorCtxController = new CloudImageEditorContextController(this);
  private _initRan = false;

  public override initCallback(): void {
    const runOnContextConsumed = () => {
      if (this._initRan) {
        return;
      }
      this._initRan = true;
      super.initCallback();
      this.contextConsumedCallback();
    };

    this.editorCtxController.onAttach(runOnContextConsumed);
  }

  public contextConsumedCallback(): void {}

  public get editor$(): CloudImageEditorState {
    return this.editorCtxController.$;
  }

  protected editorSub = this.editorCtxController.sub.bind(this.editorCtxController);
}
