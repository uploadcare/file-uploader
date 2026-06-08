import type { PasteScope } from '../../types/exported';
import type { ActivityId } from '../activity-ids';
import type { ConfigController } from './ConfigController';
import type { RouterController } from './RouterController';
import type { UploadCollectionController } from './UploadCollectionController';

const ALLOWED_PASTE_ACTIVITIES = new Set<ActivityId>(['start-from', 'upload-list']);
const REGULAR_SOLUTION_TAGS = new Set(['uc-uploader-regular', 'uc-file-uploader-regular']);

/**
 * v2 clipboard-paste feature. Port of v1's `ClipboardLayer`, adapted to the
 * controller model: each uploader instance owns one, the `Uploader` element
 * registers itself as a scope on connect (and unregisters on disconnect).
 *
 * Listens for `paste` on `window` while at least one scope is connected, and —
 * gated by the `pasteScope` config and the current activity — adds pasted
 * files (and http(s) URLs) to the collection, then routes to the upload list.
 * Pastes into editable targets (inputs, textareas, contenteditable, …) are
 * ignored so the feature never hijacks normal text paste.
 *
 * Inherently DOM-coupled (a window event + target inspection), unlike the pure
 * state controllers — kept here as a self-contained feature rather than spread
 * across the element.
 */
export class ClipboardController {
  private _scopes = new Set<Node>();
  private _listening = false;
  private readonly _listener = (event: ClipboardEvent): void => {
    void this._onPaste(event);
  };

  public constructor(
    private _config: ConfigController,
    private _collection: UploadCollectionController,
    private _router: RouterController,
  ) {}

  /** Register an uploader element as a paste scope. Returns an unregister fn. */
  public registerScope(scope: Node): () => void {
    this._scopes.add(scope);
    this._ensureListening();
    return () => {
      this._scopes.delete(scope);
      if (this._scopes.size === 0) this._stopListening();
    };
  }

  public destroy(): void {
    this._stopListening();
    this._scopes.clear();
  }

  // ─── Listener lifecycle ────────────────────────────────────────────────

  private _ensureListening(): void {
    if (this._listening) return;
    window.addEventListener('paste', this._listener);
    this._listening = true;
  }

  private _stopListening(): void {
    if (!this._listening) return;
    window.removeEventListener('paste', this._listener);
    this._listening = false;
  }

  // ─── Guards ────────────────────────────────────────────────────────────

  private static _isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    if (target.closest('input, textarea, select')) return true;
    const editable = target.closest('[contenteditable]');
    if (editable && editable.getAttribute('contenteditable')?.toLowerCase() !== 'false') return true;
    if (target.closest('[role="textbox"], [role="searchbox"], [role="combobox"]')) return true;
    return false;
  }

  private static _isEditablePaste(event: ClipboardEvent): boolean {
    return event.composedPath().some((target) => ClipboardController._isEditableTarget(target));
  }

  private static _parseHttpUrl(text: string): string | null {
    const trimmed = text.trim();
    if (!trimmed) return null;
    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      return url.toString();
    } catch {
      return null;
    }
  }

  private get _pasteScope(): PasteScope {
    return (this._config.values as { pasteScope?: PasteScope }).pasteScope ?? false;
  }

  private get _currentActivity(): ActivityId | null {
    return this._router.modal ?? this._router.activity;
  }

  private _hasConnectedScope(): boolean {
    return [...this._scopes].some((scope) => scope.isConnected);
  }

  private _hasRegularSolutionScope(): boolean {
    return [...this._scopes].some(
      (scope) => scope.isConnected && scope instanceof Element && REGULAR_SOLUTION_TAGS.has(scope.localName),
    );
  }

  private _isInsideScope(target: Node | null): boolean {
    if (!target) return false;
    return [...this._scopes].some((scope) => scope.isConnected && scope.contains(target));
  }

  // ─── Handling ──────────────────────────────────────────────────────────

  private async _onPaste(event: ClipboardEvent): Promise<void> {
    if (!event.clipboardData) return;
    if (ClipboardController._isEditablePaste(event)) return;
    if (!this._hasConnectedScope()) return;

    const activity = this._currentActivity;
    const isInitialState = activity === null;
    const isAllowedActivity = activity !== null && ALLOWED_PASTE_ACTIVITIES.has(activity);

    switch (this._pasteScope) {
      case 'global':
        if (!isAllowedActivity && !(isInitialState && this._hasRegularSolutionScope())) return;
        await this._handlePaste(event);
        return;
      case 'local': {
        const target = event.target instanceof Node ? event.target : null;
        if (!this._isInsideScope(target) || (!isAllowedActivity && !isInitialState)) return;
        await this._handlePaste(event);
        return;
      }
      default:
        return;
    }
  }

  private async _handlePaste(event: ClipboardEvent): Promise<void> {
    if (!event.clipboardData) return;
    const items = Array.from(event.clipboardData.items);

    const files = items
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    const urlPromises = items
      .filter((item) => item.kind === 'string' && (item.type === 'text/plain' || item.type === 'text/uri-list'))
      .map(
        (item) =>
          new Promise<string | null>((resolve) => {
            item.getAsString((text) => resolve(ClipboardController._parseHttpUrl(text)));
          }),
      );

    let added = false;

    for (const file of files) {
      this._collection.addFile(file, { source: 'clipboard' });
      added = true;
    }

    if (urlPromises.length > 0) {
      const urls = (await Promise.all(urlPromises)).filter((url): url is string => url !== null);
      for (const url of urls) {
        this._collection.addFileFromUrl(url, { source: 'clipboard' });
      }
      added ||= urls.length > 0;
    }

    if (added) this._router.navigate('upload-list');
  }
}
