import { ContextConsumer, createContext } from '@lit/context';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { CloudImageEditorController } from '../../../abstract/controllers/CloudImageEditorController';
import { ChildBlock } from '../../../lit/ChildBlock';

/**
 * The editor's own `@lit/context` — resolved by DOM ancestry, distinct from
 * (and coexisting with) the uploader ctx's `ctxNameContext`. The root
 * `<uc-cloud-image-editor>` provides a `CloudImageEditorController` instance
 * here (`ContextProvider`, wired in a later phase); descendants consume it
 * through `CloudImageEditorContextController`/`EditorChildBlock` below.
 */
export const cloudImageEditorContext = createContext<CloudImageEditorController>('cloud-image-editor-controller');

/**
 * `ReactiveController` that adopts the `CloudImageEditorController` provided
 * by the nearest ancestor `ContextProvider`. Adapted from the
 * `refactor/editor-separate-state` spike's `CloudImageEditorContextController`
 * (`git show 682d7172:.../context.ts`) for the v2 DOM-free-controller
 * architecture: the spike wrapped a raw `PubSub` store, this wraps the real
 * `CloudImageEditorController`.
 */
export class CloudImageEditorContextController implements ReactiveController {
  private _controller?: CloudImageEditorController;
  private _subscriptions = new Set<() => void>();
  // Attach listeners are persistent (unlike the spike's one-shot `onAttach`,
  // which existed only to gate a single `initCallback` run): `EditorChildBlock`
  // needs its re-render subscription re-wired on every (re)attach, not just
  // the first, so a listener registered via `onAttach` fires immediately if a
  // controller is already adopted, and again on every later (re)attach.
  private _onAttachCallbacks = new Set<() => void>();
  private readonly _consumer: ContextConsumer<typeof cloudImageEditorContext, ReactiveControllerHost & HTMLElement>;

  public constructor(host: ReactiveControllerHost & HTMLElement) {
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
    this._cleanupSubscriptions();
    // Forget the adopted controller (not just its subscriptions): `ChildBlock`
    // is light-DOM (`LightDomMixin`), and re-rendering an ancestor that
    // `yield()`s this host can physically re-`insertBefore` the same DOM node
    // — which fires disconnectedCallback then connectedCallback back to back
    // for the *same* controller instance. Without this reset, `_attach`'s
    // `controller === this._controller` dedup would treat that reconnect as a
    // no-op and never re-run the attach callbacks, leaving the subscriptions
    // just torn down above permanently dropped.
    this._controller = undefined;
  }

  /** The adopted controller. Throws if no provider ancestor has resolved yet — read it from `controllerOrNull`, or defer to `onAttach`, when adoption timing isn't guaranteed. */
  public get controller(): CloudImageEditorController {
    if (!this._controller) {
      throw new Error(
        'CloudImageEditorController is not available yet — no cloudImageEditorContext provider ancestor.',
      );
    }
    return this._controller;
  }

  public get controllerOrNull(): CloudImageEditorController | null {
    return this._controller ?? null;
  }

  /** Subscribe to the adopted controller; auto-unsubscribes on host disconnect or controller re-attach. Throws if no controller is adopted yet (see `onAttach`). */
  public subscribe(callback: () => void): () => void {
    const unsubscribe = this.controller.subscribe(callback);
    const tracked = () => {
      unsubscribe();
      this._subscriptions.delete(tracked);
    };
    this._subscriptions.add(tracked);
    return tracked;
  }

  /** Runs `callback` once immediately if a controller is already adopted, then again on every later (re)attach. */
  public onAttach(callback: () => void): void {
    this._onAttachCallbacks.add(callback);
    if (this._controller) {
      callback();
    }
  }

  private _attach(controller?: CloudImageEditorController): void {
    if (!controller || controller === this._controller) {
      return;
    }
    this._cleanupSubscriptions();
    this._controller = controller;
    for (const cb of this._onAttachCallbacks) {
      cb();
    }
  }

  private _cleanupSubscriptions(): void {
    if (this._subscriptions.size === 0) {
      return;
    }
    for (const unsubscribe of [...this._subscriptions]) {
      unsubscribe();
    }
    this._subscriptions.clear();
  }
}

/**
 * Base for editor descendants: the uploader surface (`l10n`, `bag`,
 * `proxyUrl`, `subConfigValue`, …) via `ChildBlock`, plus the editor
 * controller consumer. The ROOT *provides* the controller (via
 * `ContextProvider`, wired when `CloudImageEditorBlock` ports in P5) — this
 * base only *consumes*.
 */
export abstract class EditorChildBlock extends ChildBlock {
  private readonly _editorCtx = new CloudImageEditorContextController(this);
  private _editorRerenderSub?: () => void;

  public constructor() {
    super();
    // Re-render whenever the editor controller notifies — wired on every
    // (re)attach so a controller swap (exotic, but symmetric with
    // `ChildBlock`'s own controller re-adoption) doesn't leave a stale
    // subscription behind.
    this._editorCtx.onAttach(() => {
      this._editorRerenderSub?.();
      this._editorRerenderSub = this._editorCtx.subscribe(() => this.requestUpdate());
    });
  }

  /** The adopted `CloudImageEditorController`. Throws if no provider ancestor exists yet. */
  protected get editorController(): CloudImageEditorController {
    return this._editorCtx.controller;
  }

  protected get editorControllerOrNull(): CloudImageEditorController | null {
    return this._editorCtx.controllerOrNull;
  }

  /**
   * Extra editor-controller subscription beyond the automatic re-render one
   * above (e.g. to run side effects, not just `requestUpdate`). Auto-tracked
   * with the editor context's lifecycle (unsubscribes on host disconnect or
   * controller re-attach) — no manual teardown needed.
   */
  protected subscribeEditor(callback: () => void): () => void {
    return this._editorCtx.subscribe(callback);
  }

  /** Run `callback` once the editor controller is available (immediately if already attached, else on first/next attach). */
  protected onEditorAttach(callback: () => void): void {
    this._editorCtx.onAttach(callback);
  }
}
