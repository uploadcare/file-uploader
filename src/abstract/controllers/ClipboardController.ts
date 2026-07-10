import { ACTIVITY_TYPES, type ActivityId } from '../../lit/activity-constants';

export type PasteScope = 'local' | 'global' | false;

const ALLOWED_PASTE_ACTIVITIES = new Set<string>([ACTIVITY_TYPES.START_FROM, ACTIVITY_TYPES.UPLOAD_LIST]);

export type ClipboardControllerDeps = {
  /** Live `pasteScope` config read. */
  getPasteScope: () => PasteScope;
  /** Effective (modal-aware) current activity. */
  getCurrentActivity: () => ActivityId | null;
  addFileFromObject: (file: File, options: { source: 'clipboard' }) => void;
  addFileFromUrl: (url: string, options: { source: 'clipboard' }) => void;
  /** Post-add navigation intent (`router.traverse('onFileAdd')`). */
  onFileAdd: () => void;
  /** Paste-event source, injectable for tests. Defaults to `window`. */
  eventTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
};

/**
 * Window paste handling (v2 port of the `ClipboardLayer` shared instance).
 * Owns the single `paste` listener and the set of registered scopes; all
 * uploader couplings (config, router, public API) are injected, so the
 * controller is constructible and testable without the `$` state or the
 * shared-instances bag. It is DOM-*event*-coupled by nature — it exists to
 * adapt the browser clipboard to the uploader — but imports nothing from lit.
 */
export class ClipboardController {
  private _deps: ClipboardControllerDeps;
  private _eventTarget: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  private _scopes: Set<Node> = new Set();
  private _listener: (event: ClipboardEvent) => void;

  public constructor(deps: ClipboardControllerDeps) {
    this._deps = deps;
    this._eventTarget = deps.eventTarget ?? window;
    this._listener = (event) => void this._handlePasteEvent(event);
    this._eventTarget.addEventListener('paste', this._listener);
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

  private _hasRegularSolutionScope(): boolean {
    return [...this._scopes].some((scope) => {
      return scope.isConnected && scope instanceof Element && scope.localName === 'uc-file-uploader-regular';
    });
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

    const currentActivity = this._deps.getCurrentActivity();
    const isInitialState = currentActivity === null;
    const isAllowedActivity = this._isAllowedPasteActivity(currentActivity);

    switch (this._deps.getPasteScope()) {
      case 'global':
        if (!isAllowedActivity && !(isInitialState && this._hasRegularSolutionScope())) {
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
      files.forEach((file) => {
        this._deps.addFileFromObject(file, { source: 'clipboard' });
      });
      hasAddedFiles = true;
    }

    if (urlItems.length > 0) {
      const resolvedUrls = (await Promise.all(urlItems)).filter((url): url is string => url !== null);
      resolvedUrls.forEach((url) => {
        this._deps.addFileFromUrl(url, { source: 'clipboard' });
      });
      hasAddedFiles ||= resolvedUrls.length > 0;
    }

    if (hasAddedFiles) {
      this._deps.onFileAdd();
    }
  }

  /**
   * Register a DOM scope pastes may land in (`pasteScope: 'local'` only
   * handles pastes targeted inside a registered scope; a `'global'` scope
   * must merely be connected). Returns an unregister fn.
   */
  public registerScope(scope: Node): () => void {
    this._scopes.add(scope);

    return () => {
      this._scopes.delete(scope);
    };
  }

  public destroy(): void {
    this._eventTarget.removeEventListener('paste', this._listener);
    this._scopes.clear();
  }
}
