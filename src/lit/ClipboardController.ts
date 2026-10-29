import { ACTIVITY_TYPES } from '../abstract/activity-constants';
import type { PasteScope } from '../abstract/config/validatorsType';
import { controllerLogger } from '../abstract/controllerLogger';
import { ConfigController } from '../abstract/controllers/ConfigController';
import { RouterController } from '../abstract/controllers/RouterController';
import { lifetimeOf } from '../abstract/di/ControllerContainer';
import { inject } from '../abstract/di/inject';
import { UploaderPublicApi } from '../abstract/UploaderPublicApi';

export type { PasteScope };

const ALLOWED_PASTE_ACTIVITIES = new Set<string>([ACTIVITY_TYPES.START_FROM, ACTIVITY_TYPES.UPLOAD_LIST]);

/**
 * Window paste handling. Owns the single `paste` listener and the set of
 * registered scopes.
 *
 * Container-resolved via `@inject` — its uploader couplings (config, router,
 * public API) are resolved lazily from the per-ctx DI container at paste
 * time, not captured at construction: there is no throw-before-set window.
 *
 * It `@inject`s the real {@link UploaderPublicApi} directly. That is
 * editor-bundle-safe because this controller is NOT constructed at ctx creation:
 * it is resolved per-solution in `SolutionChildBlock.controllerReady` (which
 * registers the paste scope), so it — and its value import of the public API —
 * enter only the uploader-solution bundles, never the editor-alone
 * `uc-cloud-image-editor` bundle (whose `ChildBlock` graph no longer reaches it).
 * It is DOM-*event*-coupled by nature — it exists to adapt the browser clipboard
 * to the uploader — but imports nothing from lit.
 */
export class ClipboardController {
  // Per-ctx logger: `warn`/`error` always print, prefixed with THIS ctx's name
  // (resolved lazily at log time via the container that built this instance).
  private readonly _log = controllerLogger(this, 'clipboard');
  // Config is a leaf, imported directly; the router graph is circular-prone
  // (event bus ↔ controllers), so it uses a token thunk. Resolution is lazy, so
  // there is zero construction cycle. The public API is a direct `@inject`
  // (editor-bundle-safe — see the class doc).
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(() => RouterController) private readonly _router!: RouterController;
  @inject(UploaderPublicApi) private readonly _api!: UploaderPublicApi;

  private _scopes: Set<Node> = new Set();
  // Scopes whose solution takes a paste anywhere on the page while it sits on its start screen.
  private _pagePasteScopes: Set<Node> = new Set();
  private _listener: (event: ClipboardEvent) => void;

  public constructor() {
    // Isolate-and-warn (AGENTS.md #3): a rejection from the injected api's
    // add-file path must stay contained here, not surface as an unhandled
    // rejection. Bound to the ctx lifetime, so a paste still resolving its URLs
    // when the ctx is torn down stops instead of adding to it.
    this._listener = (event) => {
      lifetimeOf(this).run(
        () => this._handlePasteEvent(event),
        (err) => this._log.warn('clipboard paste handling failed', err),
      );
    };
  }

  private _isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
      return false;
    }

    if (target.closest('input, textarea, select')) {
      return true;
    }

    const editableElement = target.closest('[contenteditable]');
    if (editableElement && editableElement.getAttribute('contenteditable')?.toLowerCase() !== 'false') {
      return true;
    }

    if (target.closest('[role="textbox"], [role="searchbox"], [role="combobox"]')) {
      return true;
    }

    return false;
  }

  private _isEditablePaste(event: ClipboardEvent): boolean {
    return event.composedPath().some((target) => this._isEditableTarget(target));
  }

  private _isAllowedPasteActivity(activity: unknown): boolean {
    return typeof activity === 'string' && ALLOWED_PASTE_ACTIVITIES.has(activity);
  }

  private _hasConnectedScope(): boolean {
    return [...this._scopes].some((scope) => scope.isConnected);
  }

  private _hasPagePasteScope(): boolean {
    return [...this._pagePasteScopes].some((scope) => scope.isConnected);
  }

  private _isInsideScope(target: Node | null): boolean {
    if (!target) {
      return false;
    }

    return [...this._scopes].some((scope) => scope.isConnected && scope.contains(target));
  }

  private _getPastedUrl(text: string): string | null {
    const trimmedText = text.trim();
    if (!trimmedText) {
      return null;
    }

    try {
      const url = new URL(trimmedText);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null;
      }
      return url.toString();
    } catch {
      return null;
    }
  }

  private async _handlePasteEvent(event: ClipboardEvent): Promise<void> {
    if (!event.clipboardData) {
      return;
    }

    if (this._isEditablePaste(event)) {
      return;
    }

    if (!this._hasConnectedScope()) {
      return;
    }

    const currentActivity = this._router.currentActivity;
    const isInitialState = currentActivity === null;
    const isAllowedActivity = this._isAllowedPasteActivity(currentActivity);

    switch (this._config.get('pasteScope')) {
      case 'global':
        if (!isAllowedActivity && !(isInitialState && this._hasPagePasteScope())) {
          return;
        }
        await this._handlePaste(event.clipboardData);
        return;
      case 'local': {
        const target = event.target instanceof Node ? event.target : null;
        if (!this._isInsideScope(target) || (!isAllowedActivity && !isInitialState)) {
          return;
        }
        await this._handlePaste(event.clipboardData);
        return;
      }
      default:
        return;
    }
  }

  private async _handlePaste(clipboardData: DataTransfer): Promise<void> {
    const items = Array.from(clipboardData.items);

    const files = items
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    const urlItems = items
      .filter((item) => item.kind === 'string' && (item.type === 'text/plain' || item.type === 'text/uri-list'))
      .map((item) => {
        return new Promise<string | null>((resolve) => {
          item.getAsString((text) => {
            resolve(this._getPastedUrl(text));
          });
        });
      });

    let hasAddedFiles = false;

    if (files.length > 0) {
      const api = this._api;
      files.forEach((file) => {
        api.addFileFromObject(file, { source: 'clipboard' });
      });
      hasAddedFiles = true;
    }

    if (urlItems.length > 0) {
      const resolvedUrls = (await lifetimeOf(this).guard(Promise.all(urlItems))).filter(
        (url): url is string => url !== null,
      );
      if (resolvedUrls.length > 0) {
        const api = this._api;
        resolvedUrls.forEach((url) => {
          api.addFileFromUrl(url, { source: 'clipboard' });
        });
      }
      hasAddedFiles ||= resolvedUrls.length > 0;
    }

    if (hasAddedFiles) {
      this._router.traverse('onFileAdd');
    }
  }

  /**
   * Register a DOM scope pastes may land in (`pasteScope: 'local'` only
   * handles pastes targeted inside a registered scope; a `'global'` scope
   * must merely be connected). `ownsPagePaste` lets a global paste through
   * while the uploader sits on its start screen. Returns an unregister fn.
   */
  public registerScope(scope: Node, { ownsPagePaste = false }: { ownsPagePaste?: boolean } = {}): () => void {
    if (lifetimeOf(this).signal.aborted) {
      return () => {};
    }

    const wasEmpty = this._scopes.size === 0;
    this._scopes.add(scope);
    if (ownsPagePaste) {
      this._pagePasteScopes.add(scope);
    }
    // The `paste` listener is attached on the first scope (0 → 1), not at
    // construction, so construction never touches `window`.
    if (wasEmpty) {
      window.addEventListener('paste', this._listener);
    }

    return () => {
      this._scopes.delete(scope);
      this._pagePasteScopes.delete(scope);
      if (this._scopes.size === 0) {
        window.removeEventListener('paste', this._listener);
      }
    };
  }

  public destroy(): void {
    if (this._scopes.size > 0) {
      window.removeEventListener('paste', this._listener);
    }
    this._scopes.clear();
    this._pagePasteScopes.clear();
  }
}
