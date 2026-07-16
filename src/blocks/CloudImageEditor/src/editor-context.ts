import { ContextConsumer, createContext } from '@lit/context';
import { LitElement, type ReactiveController, type ReactiveControllerHost } from 'lit';
import type {
  CloudImageEditorController,
  CloudImageEditorControllerState,
} from '../../../abstract/controllers/CloudImageEditorController';
import { LightDomMixin } from '../../../lit/LightDomMixin';
import { RegisterableElementMixin } from '../../../lit/RegisterableElementMixin';

/**
 * The editor's own `@lit/context` — resolved by DOM ancestry, distinct from
 * (and coexisting with) the uploader ctx's `ctxNameContext`. The root
 * `<uc-cloud-image-editor>` provides a `CloudImageEditorController` instance
 * here (`ContextProvider`, wired in a later phase); descendants consume it
 * through `CloudImageEditorContextController`/`EditorBlock` below.
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
  // which existed only to gate a single `initCallback` run): `EditorBlock`
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
    // Forget the adopted controller (not just its subscriptions): the editor
    // base is light-DOM (`LightDomMixin`), and re-rendering an ancestor that
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

// Light-DOM Lit base with NO ChildBlock coupling: no forced uploader-scope
// creation, no uploader controller graph, no registry adoption machinery,
// no ctx-lifecycle, no upload stack. See the
// "Bundle-independence constraints" section of the M12 plan
// (`docs/superpowers/plans/2026-07-15-v2-m12-cloud-image-editor-port.md`):
// editor blocks must not pull that machinery into the standalone editor
// bundle. Only the two structural mixins ChildBlock itself is built on.
const EditorBlockBase = RegisterableElementMixin(LightDomMixin(LitElement));

/**
 * Base for editor descendants. Deliberately NOT `ChildBlock` — see the
 * "Bundle-independence constraints" in the M12 plan: `ChildBlock`
 * value-imports the uploader adoption graph, which would bloat the standalone `<uc-cloud-image-editor>`
 * bundle with uploader machinery it doesn't use today.
 *
 * Descendants get EVERYTHING — cross-cutting editor state AND the
 * l10n/config/telemetry/proxy services — through `this.editorController`,
 * which the root injects (`CloudImageEditorController.setServices`) from
 * whatever it resolves them from (today: the shared uploader ctx read by the
 * root only; see the plan for the deferred fully-standalone follow-up). No
 * ctx-name resolution, no uploader ctx read, happens in this base or its
 * descendants.
 */
export abstract class EditorBlock extends EditorBlockBase {
  private readonly _editorCtx = new CloudImageEditorContextController(this);
  private _editorRerenderSub?: () => void;

  public constructor() {
    super();
    // Re-render whenever the editor controller notifies (state change,
    // `notify()` after a services swap, etc.) — wired on every (re)attach so
    // a controller swap (exotic, but symmetric with `ChildBlock`'s own
    // controller re-adoption) doesn't leave a stale subscription behind.
    this._editorCtx.onAttach(() => {
      this._editorRerenderSub?.();
      this._editorRerenderSub = this._editorCtx.subscribe(() => this.requestUpdate());
      // A descendant's FIRST render can race ahead of the context actually
      // resolving (property bindings from a parent's render commit before
      // `ContextConsumer`'s own `hostConnected` dispatches the
      // `context-request` event that finds the provider) — any
      // `editorController`/`l10nSafe`-dependent output computed during that
      // first pass (a11y labels, translated text, …) would otherwise be
      // frozen on its no-controller fallback forever, since arming the
      // subscription above only reacts to FUTURE controller notifications,
      // not to the attach itself. Force one re-render right on attach so
      // `render()`/`willUpdate()` recompute with the now-available controller.
      this.requestUpdate();
    });

    // `data-testid` for e2e/`getByTestId` locators — same contract as
    // `ChildBlock._syncTestId`/v1 `LitBlock.subConfigValue('testMode', ...)`,
    // reimplemented here since `EditorBlock` deliberately isn't `ChildBlock`
    // (see the class doc). `testMode` is read once per (re)attach rather than
    // tracked reactively — `EditorServices.getConfig` has no dedicated
    // config-change subscription (only the coarse controller `notify()`), and
    // `testMode` isn't expected to flip after setup.
    this.onEditorAttach(() => {
      if (this.editorController.getConfig('testMode')) {
        this.setAttribute('data-testid', this.tagName.toLowerCase());
      } else {
        this.removeAttribute('data-testid');
      }
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
   * `l10n` that tolerates running with no adopted controller — falls back to
   * the raw key. For lifecycle hooks (`willUpdate`/`updated`/a debounced
   * callback) that can still fire once during teardown, after the editor
   * context has already released its controller (a disconnect can land
   * between the debounce's `setTimeout` firing and its callback running).
   * Interaction handlers gated by user input (`onClick` et al.) only ever run
   * while connected/attached, so they can keep using `editorController.l10n`
   * directly.
   */
  protected l10nSafe(key: string, variables?: Record<string, string | number>): string {
    return this.editorControllerOrNull?.l10n(key, variables) ?? key;
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

  /**
   * Per-key reactive subscription to a single cross-cutting controller state
   * key — mirrors `ChildBlock.subConfigValue`. `subscribeEditor` above is
   * coarse (fires on ANY controller state change, for "re-render on
   * anything"); many descendants instead have per-key imperative reactions
   * (the old shared-ctx `this.sub('*tabId', ...)`, etc.) that must NOT fire on
   * unrelated changes — this filters the coarse notifications down to one key
   * via `Object.is` dedup, firing `cb` immediately with the current value and
   * again only when that key's value actually changes.
   *
   * Wired through `onEditorAttach` (not just called once), so it re-seeds and
   * re-subscribes on every (re)attach — same reasoning as `EditorImageCropper`
   * /`EditorImageFader`'s constructor-time `onEditorAttach` setup: a
   * controller re-attach tears down the previous coarse subscription (see
   * `CloudImageEditorContextController.hostDisconnected`/`_attach`), so the
   * per-key tracking must be re-established alongside it.
   */
  protected subEditorKey<K extends keyof CloudImageEditorControllerState>(
    key: K,
    cb: (value: CloudImageEditorControllerState[K]) => void,
  ): void {
    this.onEditorAttach(() => {
      let last = this.editorController.get(key);
      cb(last);
      this.subscribeEditor(() => {
        const next = this.editorController.get(key);
        if (!Object.is(next, last)) {
          last = next;
          cb(next);
        }
      });
    });
  }
}
