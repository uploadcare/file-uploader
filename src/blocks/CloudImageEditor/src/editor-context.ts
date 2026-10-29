import { ContextConsumer, createContext } from '@lit/context';
import { SignalWatcher } from '@lit-labs/signals';
import { LitElement, type ReactiveController, type ReactiveControllerHost } from 'lit';
import { Lifetime } from '../../../abstract/di/Lifetime';
import type { L10nArguments } from '../../../abstract/l10n';
import { type Logger, logger } from '../../../abstract/logger';
import { LightDomMixin } from '../../../lit/LightDomMixin';
import { RegisterableElementMixin } from '../../../lit/RegisterableElementMixin';
import { registerHostSubscriptions } from '../../../lit/subscription';
import type { CloudImageEditorController } from './CloudImageEditorController';
import type { EditorL10nKey } from './editor-locale';

const log = logger.scope('cloud-image-editor');

/**
 * The editor's own `@lit/context` — resolved by DOM ancestry, distinct from
 * (and coexisting with) the uploader ctx's `ctxNameContext`. The root
 * `<uc-cloud-image-editor>` provides a `CloudImageEditorController` instance
 * here (`ContextProvider`); descendants consume it
 * through `CloudImageEditorContextController`/`EditorBlock` below.
 */
export const cloudImageEditorContext = createContext<CloudImageEditorController>('cloud-image-editor-controller');

/**
 * A fresh {@link Lifetime} per adoption, ended when the adoption is released and still ended between adoptions. One
 * adoption is one attached controller for an `EditorBlock` and one connection for the root `<uc-cloud-image-editor>`,
 * which provides the controller rather than adopting one.
 */
export class AdoptionLifetime {
  #current = Lifetime.ended();

  public constructor(private readonly _log: Pick<Logger, 'error'>) {}

  /** Aborted once the current adoption ends; already aborted between adoptions. */
  public get signal(): AbortSignal {
    return this.#current.signal;
  }

  /** End the current adoption, if one is live, and start a fresh one. */
  public begin(): void {
    this.#current.end();
    this.#current = new Lifetime();
  }

  public end(): void {
    this.#current.end();
  }

  /** {@link Lifetime.guard} on the current adoption. */
  public guard<T>(work: PromiseLike<T>, dispose?: (value: T) => void): Promise<T> {
    return this.#current.guard(work, dispose);
  }

  /** {@link Lifetime.run} on the current adoption, logging a failure that is not its abort. */
  public run(task: (signal: AbortSignal) => unknown): void {
    this.#current.run(task, (error) => this._log.error('an async task failed', error));
  }

  /** Run `dispose` when the current adoption ends — right away if none is live. */
  public onEnd(dispose: () => void): void {
    const signal = this.#current.signal;
    if (signal.aborted) {
      dispose();
    } else {
      signal.addEventListener('abort', dispose, { once: true });
    }
  }
}

/**
 * `ReactiveController` that adopts the `CloudImageEditorController` provided
 * by the nearest ancestor `ContextProvider`.
 */
export class CloudImageEditorContextController implements ReactiveController {
  private _controller?: CloudImageEditorController;
  /** One adoption per adopted controller, ended on detach (host disconnect or re-attach). */
  public readonly lifetime: AdoptionLifetime;
  // Attach listeners are persistent: `EditorBlock` needs its `@subscription` methods re-wired on every (re)attach, not just
  // the first, so a listener registered via `onAttach` fires immediately if a
  // controller is already adopted, and again on every later (re)attach.
  private _onAttachCallbacks = new Set<() => void>();
  private readonly _consumer: ContextConsumer<typeof cloudImageEditorContext, ReactiveControllerHost & HTMLElement>;

  public constructor(host: ReactiveControllerHost & HTMLElement, hostLog: Pick<Logger, 'error'>) {
    this.lifetime = new AdoptionLifetime(hostLog);
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
    // Releases the adoption's subscriptions too (`onEnd`), and stops async work still in flight at its next guarded await.
    this.lifetime.end();
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
    this.lifetime.end();
    this._controller = controller;
    this.lifetime.begin();
    for (const cb of this._onAttachCallbacks) {
      // Isolate-and-warn: one throwing callback must not stop the rest.
      try {
        cb();
      } catch (error) {
        log.warn('An editor attach callback threw', error);
      }
    }
  }
}

// Light-DOM Lit base with NO ChildBlock coupling: no forced uploader-scope
// creation, no uploader controller graph, no registry adoption machinery,
// no ctx-lifecycle, no upload stack: editor blocks must not pull that
// machinery into the standalone editor bundle (its build lists
// `forbiddenModules`). Only the mixins ChildBlock itself is built on.
//
// `SignalWatcher` sits at the base of the mixin chain, as on `ChildBlock`, so it
// wraps `performUpdate` (not `render()`): a block's `willUpdate`/`render`/
// `updated` auto-track the controller state and `l10n`/`getConfig` they read,
// and re-render when it changes.
const EditorBlockBase = SignalWatcher(RegisterableElementMixin(LightDomMixin(LitElement)));

/**
 * Base for editor descendants. Deliberately NOT `ChildBlock`: `ChildBlock`
 * value-imports the uploader adoption graph, which would bloat the standalone `<uc-cloud-image-editor>`
 * bundle with uploader machinery it doesn't use.
 *
 * Descendants get EVERYTHING — cross-cutting editor state AND the
 * l10n/config/telemetry/proxy services — through `this.editorController`,
 * which the root injects (`CloudImageEditorController.setServices`) from its
 * own props and, through the root only, a sibling `<uc-config>`. No
 * ctx-name resolution, no uploader ctx read, happens in this base or its
 * descendants.
 */
export abstract class EditorBlock extends EditorBlockBase {
  /**
   * Shared editor logger for this block and every descendant `EditorBlock` —
   * one `cloud-image-editor` scope instead of a per-file scope in each editor
   * component. `error`/`warn`/`warnOnce` always print; the verbose tier
   * (`log`/`debug`) is gated by the editor's `debug` config (null-safe before a
   * controller is adopted). No ctx-name — the editor base stays bundle-isolated.
   * @internal
   */
  protected readonly _log = logger.scope('cloud-image-editor', {
    isVerbose: () => this.editorControllerOrNull?.getConfig('debug') ?? false,
  });

  private readonly _editorCtx = new CloudImageEditorContextController(this, this._log);

  public constructor() {
    super();
    // Wired on every (re)attach: a release (host disconnect or a controller
    // swap) ends the `@subscription` teardowns with the adoption.
    this._editorCtx.onAttach(() => {
      for (const teardown of registerHostSubscriptions(this, this._log)) {
        this._editorCtx.lifetime.onEnd(teardown);
      }
      // A render before the attach read no controller, so no signal tracks the
      // attach itself: anything computed then (a11y labels, translated text, …)
      // stays on its no-controller fallback unless this re-renders now.
      this.requestUpdate();
    });

    // `data-testid` for e2e/`getByTestId` locators — same contract as
    // `ChildBlock._applyTestMode`, reimplemented here since `EditorBlock` deliberately isn't `ChildBlock`
    // (see the class doc). `testMode` is read once per (re)attach rather than
    // tracked reactively — it isn't expected to flip after setup.
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

  /** Report a click as an action event on the current tab; `extra` adds metadata and can name another tab. */
  protected sendClickEvent(e: MouseEvent, extra: Record<string, unknown> = {}): void {
    this.editorController.telemetry.sendActionEvent(e.type, (e.currentTarget as HTMLElement | null)?.tagName, {
      tabId: this.editorController.tabId,
      ...extra,
    });
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
  protected l10nSafe<K extends EditorL10nKey>(key: K, ...variables: L10nArguments<K>): string {
    return this.editorControllerOrNull?.l10n(key, variables[0]) ?? key;
  }

  /**
   * Aborted when the editor controller is released (host disconnect or re-attach to another controller); already
   * aborted before the first attach. Pass it to APIs that take a signal — `addEventListener`, `fetch` — and they clean
   * up on their own. Same contract as `ChildBlock.adoptionSignal`, one adoption being one attached controller.
   */
  protected get adoptionSignal(): AbortSignal {
    return this._editorCtx.lifetime.signal;
  }

  /**
   * Await `work` for as long as the current editor controller stays adopted. If it is released first, the await throws
   * an abort (swallowed by {@link runTask}) instead of resuming against a detached block, and a value that arrives too
   * late goes to `dispose`. After it, `editorController` is safe to read.
   */
  protected whileAdopted<T>(work: PromiseLike<T>, dispose?: (value: T) => void): Promise<T> {
    return this._editorCtx.lifetime.guard(work, dispose);
  }

  /**
   * Run fire-and-forget async work bound to the current adoption. Its `whileAdopted` awaits abort once the controller
   * is released, and that abort is swallowed; any other error is logged rather than left as an unhandled rejection.
   */
  protected runTask(task: (signal: AbortSignal) => unknown): void {
    this._editorCtx.lifetime.run(task);
  }

  /** Run `callback` once the editor controller is available (immediately if already attached, else on first/next attach). */
  protected onEditorAttach(callback: () => void): void {
    this._editorCtx.onAttach(callback);
  }
}
